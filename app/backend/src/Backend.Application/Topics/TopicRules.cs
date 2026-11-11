using Backend.Application.Rounds;
using Backend.Domain.Entities;

namespace Backend.Application.Topics;

// Quy tắc đề tài dùng chung cho mô-đun Đề tài và Đợt (BUSINESS_RULES · Đợt, đề tài và nhóm,
// DESIGN · Đề tài của tôi, PDR-048/049, PDR-031).
public static class TopicRules
{
    public const int MaxTitleLength = 300;
    public const int MaxFieldLength = 100;
    public const int MaxDescriptionLength = 4000;
    public const int MaxRequirementsLength = 2000;

    public const string NotFoundMessage = "Không tìm thấy đề tài.";
    public const string NotSupervisorMessage = "Chỉ giảng viên hướng dẫn của đề tài được thao tác.";
    public const string NotRoundLecturerMessage = "Bạn không thuộc danh sách giảng viên của đợt này.";
    public const string NotRoundStudentMessage = "Bạn không thuộc danh sách sinh viên của đợt này.";
    public const string NotRunningMessage = "Chỉ gửi và sửa đề tài khi đợt đang diễn ra.";
    public const string PublishedNoAddMessage = "Danh sách đề tài đã công bố nên không thêm đề tài mới.";
    public const string PublishedNoDeleteMessage = "Danh sách đề tài đã công bố nên không xóa được đề tài.";
    public const string PublishedContentOnlyMessage = "Sau khi công bố chỉ sửa được mô tả và yêu cầu của đề tài.";
    public const string HasGroupMessage = "Đề tài đã có nhóm nên không sửa được.";
    public const string NotPublishedMessage = "Giáo vụ chưa công bố danh sách đề tài của đợt.";
    public const string NoTopicsToPublishMessage = "Đợt chưa có đề tài nào để công bố.";
    public const string RegistrationClosedMessage = "Đã hết thời gian đăng ký đề tài của đợt.";
    public const string TopicTakenMessage = "Đề tài vừa có nhóm khác nhận. Tải lại danh sách và chọn đề tài khác.";
    public const string GroupHasTopicMessage = "Nhóm của bạn đã ghi danh một đề tài. Hủy ghi danh trước khi chọn đề tài khác.";
    public const string OnlyRepresentativeMessage = "Chỉ đại diện nhóm được ghi danh cho nhóm.";
    public const string FixedMembersMessage = "Nhóm đã có thành viên cố định; không đổi thành viên khi ghi danh lại.";
    public const string NotRegisteredMessage = "Nhóm không còn ghi danh đề tài này.";
    public const string NotPublicTopicMessage = "Chỉ ghi danh được đề tài giảng viên đã công bố.";
    public const string OnlyProposalRepresentativeMessage = "Chỉ đại diện nhóm được tạo hoặc sửa đề xuất.";
    public const string ProposalNotPendingMessage = "Đề xuất không còn ở trạng thái Chờ GV duyệt.";

    private static readonly Dictionary<TopicStatus, string> StatusLabels = new()
    {
        [TopicStatus.NotRegistered] = "Chưa đăng ký",
        [TopicStatus.PendingApproval] = "Chờ GV duyệt",
        [TopicStatus.Registered] = "Đã đăng ký",
        [TopicStatus.Rejected] = "Bị từ chối",
        [TopicStatus.InProgress] = "Đang thực hiện",
        [TopicStatus.Grading] = "Đang cho điểm",
        [TopicStatus.Graded] = "Đã cho điểm",
        [TopicStatus.Deviation] = "Có lệch điểm",
        [TopicStatus.Confirmed] = "Đã xác nhận",
        [TopicStatus.Completed] = "Đã hoàn tất",
        [TopicStatus.Ineligible] = "Không đủ điều kiện công bố",
        [TopicStatus.NoGroup] = "Không có nhóm",
        [TopicStatus.Cancelled] = "Đã hủy"
    };

    public static string Label(TopicStatus status) => StatusLabels[status];
    public static string SourceLabel(TopicSource source) => source == TopicSource.Lecturer ? "GV công bố" : "SV đề xuất";

    public static DateOnly? MilestoneStart(ThesisRound round, MilestoneKey key) =>
        round.Milestones.FirstOrDefault(m => m.Key == key)?.StartDate;
    public static DateOnly? MilestoneEnd(ThesisRound round, MilestoneKey key) =>
        round.Milestones.FirstOrDefault(m => m.Key == key)?.EndDate;

    // Đăng ký tự đóng cuối ngày kết thúc mốc "Công bố đề tài · SV đăng ký" (giờ Việt Nam).
    public static bool RegistrationClosed(ThesisRound round, DateOnly today) =>
        round.TopicsPublishedAt is not null && MilestoneEnd(round, MilestoneKey.TopicRegistration) is { } end && today > end;

    // Ghi danh mở từ khi Giáo vụ công bố tới hết ngày kết thúc mốc đăng ký (PDR-048).
    public static bool RegistrationOpen(ThesisRound round, DateOnly today) =>
        round.Status == RoundStatus.Running && round.TopicsPublishedAt is not null &&
        (MilestoneEnd(round, MilestoneKey.TopicRegistration) is not { } end || today <= end);

    // Trạng thái hiển thị (PDR-049): hết hạn đăng ký thì đề tài đã có nhóm là Đang thực hiện,
    // chưa có nhóm là Không có nhóm. Tính khi đọc nên không cần tác vụ nền đổi dữ liệu.
    public static TopicStatus Effective(ThesisTopic topic, ThesisRound round, DateOnly today) =>
        RegistrationClosed(round, today)
            ? topic.Status switch
            {
                TopicStatus.NotRegistered => TopicStatus.NoGroup,
                TopicStatus.Registered => TopicStatus.InProgress,
                var other => other
            }
            : topic.Status;

    // Không còn chờ kết quả nên không chặn kết thúc đợt (PDR-031, PDR-048).
    public static bool IsSettled(TopicStatus status) =>
        status is TopicStatus.Completed or TopicStatus.Ineligible or TopicStatus.NoGroup or TopicStatus.Rejected or TopicStatus.Cancelled;

    // Số đề tài của GV = đề tài GV gửi + đề xuất SV đã chấp nhận.
    public static bool CountsTowardLoad(ThesisTopic topic) =>
        topic.Source == TopicSource.Lecturer || topic.Status is not (TopicStatus.PendingApproval or TopicStatus.Rejected or TopicStatus.Cancelled);

    public static LecturerLoadDto Load(Guid lecturerId, IEnumerable<ThesisTopic> roundTopics, ThesisRound round)
    {
        var count = roundTopics.Count(t => t.SupervisorId == lecturerId && CountsTowardLoad(t));
        var level = round.LecturerLoadMax > 0 && count > round.LecturerLoadMax ? "over"
            : count < round.LecturerLoadMin ? "below" : "ok";
        return new LecturerLoadDto
        {
            LecturerId = lecturerId, Count = count, Min = round.LecturerLoadMin, Max = round.LecturerLoadMax, Level = level
        };
    }

    // Lý do GV không gửi thêm được đề tài vào đợt; null = gửi được.
    public static string? SubmitBlocker(ThesisRound round, DateOnly today)
    {
        if (round.Status != RoundStatus.Running) return NotRunningMessage;
        if (round.TopicsPublishedAt is not null) return PublishedNoAddMessage;
        if (MilestoneStart(round, MilestoneKey.TopicSubmission) is { } start && today < start)
            return $"Chưa đến thời gian gửi đề tài (từ {start:dd/MM/yyyy}).";
        return null;
    }

    // Phạm vi sửa của GVHD: trước công bố mọi trường; sau công bố chỉ mô tả và yêu cầu khi chưa có nhóm.
    public static string EditScope(ThesisTopic topic, ThesisRound round, DateOnly today)
    {
        if (round.Status != RoundStatus.Running) return TopicEditScopes.None;
        if (round.TopicsPublishedAt is null) return TopicEditScopes.All;
        return Effective(topic, round, today) == TopicStatus.NotRegistered ? TopicEditScopes.Content : TopicEditScopes.None;
    }

    public static bool CanDelete(ThesisRound round) => round.Status == RoundStatus.Running && round.TopicsPublishedAt is null;

    public static TopicRoundDto RoundInfo(ThesisRound round, DateOnly today, bool forLecturer) => new()
    {
        RoundId = round.Id,
        RoundName = round.Name,
        RoundStatus = RoundRules.Label(round.Status),
        TopicsPublishedAt = round.TopicsPublishedAt is { } at ? DateTime.SpecifyKind(at, DateTimeKind.Utc) : null,
        SubmissionStart = RoundRules.FormatDate(MilestoneStart(round, MilestoneKey.TopicSubmission)),
        SubmissionEnd = RoundRules.FormatDate(MilestoneEnd(round, MilestoneKey.TopicSubmission)),
        RegistrationEnd = RoundRules.FormatDate(MilestoneEnd(round, MilestoneKey.TopicRegistration)),
        CanSubmit = forLecturer && SubmitBlocker(round, today) is null,
        SubmitBlockedReason = forLecturer ? SubmitBlocker(round, today) : null
    };

    public static string Clean(string? value) => (value ?? string.Empty).Trim();
    public static string? CleanOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
