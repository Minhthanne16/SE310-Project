using System.Globalization;
using Backend.Application.Reviewers;
using Backend.Application.Topics;
using Backend.Domain.Entities;

namespace Backend.Application.Councils;

// Một lượt trong bản kế hoạch hội đồng đã đọc từ dữ liệu vào (theo thứ tự bảo vệ).
public sealed record PlannedSlot(Guid TopicId, TimeOnly Start, TimeOnly End);

// Hội đồng như Giáo vụ muốn lưu: dùng chung cho kiểm tra trước, tạo, sửa và công bố.
public sealed record CouncilPlan(
    Guid? CouncilId,
    Guid RoundId,
    string Name,
    Guid ChairId,
    Guid SecretaryId,
    DateOnly Date,
    string Room,
    IReadOnlyList<PlannedSlot> Slots);

// Dữ liệu cần để kiểm tra một kế hoạch, nạp sẵn (không truy cập dữ liệu trong CouncilRules).
public sealed class CouncilCheckContext
{
    public required ThesisRound Round { get; init; }
    public required DateOnly Today { get; init; }
    // Mọi đề tài của đợt theo id.
    public required IReadOnlyDictionary<Guid, ThesisTopic> Topics { get; init; }
    public required IReadOnlyDictionary<Guid, User> Users { get; init; }
    // Hội đồng chưa hủy của đợt (để chặn trùng tên).
    public required IReadOnlyList<DefenseCouncil> RoundCouncils { get; init; }
    // Hội đồng chưa hủy của mọi đợt có cùng ngày bảo vệ, chỉ với lượt có hiệu lực.
    public required IReadOnlyList<DefenseCouncil> SameDayCouncils { get; init; }
    public required IReadOnlyDictionary<Guid, string> RoundNames { get; init; }
}

// Quy tắc hội đồng và lịch bảo vệ (P06): ROLES, BUSINESS_RULES, PDR-014–020, PDR-063. Hàm thuần.
public static class CouncilRules
{
    public const int MaxNameLength = 100;
    public const int MaxRoomLength = 50;
    public const int MaxReasonLength = 800;
    public const int MaxCorrectionLength = 2000;
    public const int MaxSlots = 30;

    public const string NotFoundMessage = "Không tìm thấy hội đồng.";
    public const string RoundNotRunningMessage = "Đợt không còn diễn ra nên không lập hoặc sửa hội đồng.";
    public const string SameMemberMessage = "Chủ tịch và Thư ký phải là hai giảng viên khác nhau.";
    public const string ChangedMessage = "Hội đồng vừa được người khác sửa. Tải lại rồi thử lại.";
    public const string CancelledMessage = "Lịch của hội đồng đã hủy nên không sửa được.";
    public const string ScoredMessage =
        "Hội đồng đã có phiếu điểm: không sửa giờ, phòng hay thành viên, không hủy lịch. Ghi đính chính nếu thông tin lịch sai (PDR-018/020).";
    public const string ReasonRequiredMessage = "Nhập lý do sửa lịch đã công bố.";
    public const string PublishedNoDeleteMessage = "Hội đồng đã công bố không xóa được để lưu vết; dùng Hủy lịch nếu buổi bảo vệ không diễn ra.";
    public const string CancelledNoDeleteMessage = "Hội đồng đã hủy được giữ lại để lưu vết, không xóa được.";
    public const string NoSlotsMessage = "Hội đồng chưa có đề tài nào.";
    public const string NotPublishedMessage = "Chỉ hủy được lịch đã công bố; hội đồng Nháp thì xóa.";
    public const string CorrectionBeforeScoreMessage = "Chưa có phiếu điểm: sửa lịch trực tiếp (kèm lý do) thay vì ghi đính chính.";
    public const string CorrectionNotPublishedMessage = "Chỉ ghi đính chính cho lịch đã công bố.";
    public const string TopicTakenMessage = "Có đề tài vừa được xếp vào hội đồng khác. Tải lại rồi thử lại.";
    public const string AlreadyPublishedMessage = "Lịch đã công bố trước đó; không gửi lại thông báo.";
    public const string NoDraftsMessage = "Không có hội đồng Nháp nào để công bố.";
    public const string DuplicateNameMessage = "Tên hội đồng đã có trong đợt. Đặt tên khác.";

    private static readonly Dictionary<CouncilStatus, string> StatusLabels = new()
    {
        [CouncilStatus.Draft] = "Nháp",
        [CouncilStatus.Published] = "Đã công bố",
        [CouncilStatus.Cancelled] = "Đã hủy"
    };

    public static string Label(CouncilStatus status) => StatusLabels[status];

    public static string SlotLabel(DefenseSlotStatus status) => status switch
    {
        DefenseSlotStatus.Active => "active",
        DefenseSlotStatus.Removed => "removed",
        _ => "cancelled"
    };

    // Giờ dạng HH:mm, 00:00–23:59.
    public static bool TryParseTime(string? value, out TimeOnly time) =>
        TimeOnly.TryParseExact(value?.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);

    public static string FormatTime(TimeOnly time) => time.ToString("HH:mm", CultureInfo.InvariantCulture);
    public static string FormatDay(DateOnly date) => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    // PDR-017: hai khoảng chỉ chạm nhau ở đầu/cuối không chồng lấn.
    public static bool Overlaps(TimeOnly startA, TimeOnly endA, TimeOnly startB, TimeOnly endB) => startA < endB && startB < endA;

    // Lý do đề tài chưa xếp được vào hội đồng; null = đủ điều kiện. Cùng điều kiện phân công phản biện (PDR-021, PDR-063):
    // có nhóm, chưa kết thúc, đề cương đã được GVHD duyệt. Không yêu cầu đã có GVPB hay báo cáo cuối kỳ.
    public static string? TopicBlocker(ThesisTopic topic, ThesisRound round, DateOnly today)
    {
        var status = TopicRules.Effective(topic, round, today);
        if (status is TopicStatus.Completed or TopicStatus.Ineligible) return ReviewerRules.EndedMessage;
        if (topic.GroupId is null || status is TopicStatus.NotRegistered or TopicStatus.NoGroup or TopicStatus.PendingApproval
            or TopicStatus.Rejected or TopicStatus.Cancelled) return ReviewerRules.NoGroupMessage;
        if (topic.OutlineApprovedAt is null) return ReviewerRules.OutlineNotApprovedMessage;
        return null;
    }

    // Đề tài hiện trong kho xếp hội đồng: bỏ đề xuất chưa nhận/bị từ chối/đã hủy.
    public static bool Listed(ThesisTopic topic) => TopicRules.CountsTowardLoad(topic);

    // Kiểm tra mọi bất biến của kế hoạch; danh sách rỗng = lưu được. Không xét trạng thái/phiên bản hội đồng.
    public static List<string> Check(CouncilPlan plan, CouncilCheckContext ctx)
    {
        var problems = new List<string>();
        void Add(string message)
        {
            if (!problems.Contains(message)) problems.Add(message);
        }

        if (ctx.Round.Status != RoundStatus.Running) Add(RoundNotRunningMessage);
        var normalizedName = NormalizeName(plan.Name);
        if (ctx.RoundCouncils.Any(c => c.Id != plan.CouncilId && c.Status != CouncilStatus.Cancelled && NormalizeName(c.Name) == normalizedName))
            Add(DuplicateNameMessage);

        // Thành viên: đúng hai người khác nhau, là giảng viên đang hoạt động của đợt (ROLES).
        if (plan.ChairId == plan.SecretaryId) Add(SameMemberMessage);
        MemberProblem("Chủ tịch", plan.ChairId, ctx, Add);
        MemberProblem("Thư ký", plan.SecretaryId, ctx, Add);
        var members = new[] { plan.ChairId, plan.SecretaryId };

        var seen = new HashSet<Guid>();
        PlannedSlot? previous = null;
        foreach (var slot in plan.Slots)
        {
            if (!ctx.Topics.TryGetValue(slot.TopicId, out var topic))
            {
                Add("Có đề tài không thuộc đợt này.");
                continue;
            }
            if (!seen.Add(slot.TopicId))
            {
                Add($"{topic.Code} xuất hiện hai lần trong hội đồng.");
                continue;
            }
            if (TopicBlocker(topic, ctx.Round, ctx.Today) is { } blocker) Add($"{topic.Code}: {blocker}.");
            // GVHD không ngồi hội đồng chấm đề tài mình hướng dẫn (BUSINESS_RULES). GVPB được phép (OQ-032, PDR-063).
            if (members.Contains(topic.SupervisorId))
                Add($"{topic.Code}: {PersonName(topic.SupervisorId, ctx)} là GVHD nhưng đang ngồi hội đồng chấm đề tài này.");
            // PDR-016: một lượt có hiệu lực mỗi đề tài.
            var owner = ctx.RoundCouncils.FirstOrDefault(c => c.Id != plan.CouncilId && c.Status != CouncilStatus.Cancelled
                && c.Slots.Any(s => s.TopicId == slot.TopicId && s.Status == DefenseSlotStatus.Active));
            if (owner is not null) Add($"{topic.Code} đã thuộc {owner.Name}.");

            // PDR-017: giờ kết thúc sau giờ bắt đầu; các lượt theo thứ tự và không chồng nhau (cùng phòng).
            if (slot.End <= slot.Start) Add($"{topic.Code}: giờ kết thúc phải sau giờ bắt đầu.");
            else if (previous is not null && previous.End > previous.Start && slot.Start < previous.End
                && ctx.Topics.TryGetValue(previous.TopicId, out var previousTopic))
                Add($"{topic.Code} bắt đầu trước khi {previousTopic.Code} kết thúc.");
            if (slot.End > slot.Start) previous = slot;
        }

        // PDR-014/015: trùng phòng hoặc trùng giảng viên với hội đồng khác cùng ngày (kể cả đợt khác) trong khoảng chồng lấn.
        var room = DefenseCouncil.NormalizeRoom(plan.Room);
        var valid = plan.Slots.Where(s => s.End > s.Start).ToList();
        foreach (var other in ctx.SameDayCouncils)
        {
            if (other.Id == plan.CouncilId || other.Status == CouncilStatus.Cancelled || other.DefenseDate != plan.Date) continue;
            var otherSlots = other.Slots.Where(s => s.Status == DefenseSlotStatus.Active && s.EndTime > s.StartTime).ToList();
            var overlap = valid.Any(a => otherSlots.Any(b => Overlaps(a.Start, a.End, b.StartTime, b.EndTime)));
            if (!overlap) continue;
            var label = $"{other.Name}{(other.RoundId == plan.RoundId ? string.Empty : $" · {ctx.RoundNames.GetValueOrDefault(other.RoundId, "đợt khác")}")}";
            var span = $"{FormatTime(otherSlots.Min(s => s.StartTime))}–{FormatTime(otherSlots.Max(s => s.EndTime))}";
            if (room.Length > 0 && room == other.NormalizedRoom) Add($"Phòng {plan.Room.Trim()} trùng giờ với {label} ({span}).");
            foreach (var member in members.Distinct())
                if (member == other.ChairId || member == other.SecretaryId)
                    Add($"{PersonName(member, ctx)} trùng giờ với {label} ({span}).");
        }
        return problems;
    }

    // Kế hoạch tương ứng với hội đồng đã lưu (để tính xung đột hiện tại và kiểm tra lại khi công bố).
    public static CouncilPlan PlanOf(DefenseCouncil council) => new(council.Id, council.RoundId, council.Name, council.ChairId,
        council.SecretaryId, council.DefenseDate, council.Room,
        council.Slots.Where(s => s.Status == DefenseSlotStatus.Active).OrderBy(s => s.Order)
            .Select(s => new PlannedSlot(s.TopicId, s.StartTime, s.EndTime)).ToList());

    // Mô tả lịch để ghi lịch sử: giữ được thông tin lịch cũ khi sửa (PDR-016/018).
    public static string Describe(CouncilPlan plan, IReadOnlyDictionary<Guid, ThesisTopic> topics, IReadOnlyDictionary<Guid, User> users)
    {
        string Who(Guid id) => users.TryGetValue(id, out var u) ? $"{u.FullName} ({u.UserCode})" : "(không rõ)";
        var slots = plan.Slots.Count == 0 ? "chưa có đề tài"
            : string.Join("; ", plan.Slots.Select((s, i) =>
                $"{i + 1}. {(topics.TryGetValue(s.TopicId, out var t) ? t.Code : "?")} {FormatTime(s.Start)}–{FormatTime(s.End)}"));
        return $"{plan.Name} · Chủ tịch {Who(plan.ChairId)} · Thư ký {Who(plan.SecretaryId)} · ngày {FormatDay(plan.Date)} · phòng {plan.Room.Trim()} · lượt: {slots}";
    }

    public static string NormalizeName(string? name) => CleanText(name).ToLowerInvariant();

    public static string CleanText(string? value) =>
        string.Join(' ', (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static void MemberProblem(string role, Guid id, CouncilCheckContext ctx, Action<string> add)
    {
        if (!ctx.Users.TryGetValue(id, out var user) || user.Role != UserRole.Lecturer || !TopicMapping.IsLecturerOf(ctx.Round, id))
        {
            add($"{role} không thuộc danh sách giảng viên của đợt.");
            return;
        }
        if (!user.IsActive) add($"Tài khoản {role.ToLowerInvariant()} {user.FullName} đang bị vô hiệu hóa.");
    }

    private static string PersonName(Guid id, CouncilCheckContext ctx) =>
        ctx.Users.TryGetValue(id, out var user) ? user.FullName : "Giảng viên";
}
