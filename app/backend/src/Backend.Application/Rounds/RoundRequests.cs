using System.Globalization;
using Backend.Application.Common;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Rounds;

public enum RoundResultStatus { Ok, Created, NotFound, Conflict, Invalid }

public sealed record RoundResult<T>(RoundResultStatus Status, ApiResponse<T> Response)
{
    public static RoundResult<T> Ok(T data, string message = "Thao tác thành công") =>
        new(RoundResultStatus.Ok, ApiResponse<T>.Ok(data, message));

    public static RoundResult<T> Fail(RoundResultStatus status, string message, List<string>? errors = null) =>
        new(status, ApiResponse<T>.Fail(message, errors));
}

// ViewerId = null: Giáo vụ thấy mọi đợt. Có giá trị: Giảng viên/Sinh viên chỉ thấy đợt đã mở mà mình tham gia.
public record GetRoundsQuery(string? Status, string? Program, string? Search, Guid? ViewerId = null) : IRequest<ApiResponse<IReadOnlyList<RoundDto>>>;
public record GetRoundQuery(Guid Id, Guid? ViewerId = null) : IRequest<RoundResult<RoundDto>>;
public record CreateRoundCommand(RoundInputDto Round) : IRequest<RoundResult<RoundDto>>;
public record UpdateRoundCommand(Guid Id, RoundInfoDto Round) : IRequest<RoundResult<RoundDto>>;
public record UpdateRoundMilestonesCommand(Guid Id, RoundMilestonesInputDto Input) : IRequest<RoundResult<RoundDto>>;
public record OpenRoundCommand(Guid Id) : IRequest<RoundResult<RoundDto>>;
public record FinishRoundCommand(Guid Id) : IRequest<RoundResult<RoundDto>>;
public record DeleteRoundCommand(Guid Id) : IRequest<RoundResult<bool>>;
// Kind là "lecturers" hoặc "students" (đoạn cuối của URL).
public record GetPeopleQuery(string Kind) : IRequest<ApiResponse<IReadOnlyList<ParticipantDto>>>;
public record GetCandidatesQuery(Guid Id, string Kind) : IRequest<RoundResult<IReadOnlyList<CandidateDto>>>;
public record CheckParticipantsCommand(Guid Id, string Kind, IReadOnlyList<string> Codes) : IRequest<RoundResult<IReadOnlyList<ParticipantCheckDto>>>;
public record AddParticipantsCommand(Guid Id, string Kind, IReadOnlyList<string> Codes) : IRequest<RoundResult<AddParticipantsResultDto>>;
public record RemoveParticipantCommand(Guid Id, string Kind, Guid UserId) : IRequest<RoundResult<RoundDto>>;

// Nhãn tiếng Việt, khóa JSON và quy tắc đợt (docs/DESIGN/03, PDR-029…PDR-034).
public static class RoundRules
{
    public const int MaxTextLength = 200;
    public const int MaxCodesPerRequest = 500;
    public const int MaxLecturerLoad = 50;

    public const string NotFoundMessage = "Không tìm thấy đợt.";
    public const string DuplicateNameMessage = "Tên đợt đã tồn tại. Đặt tên khác.";
    public const string NotDraftInfoMessage = "Đợt đã mở nên không sửa thông tin đợt được nữa.";
    public const string FinishedMessage = "Đợt đã kết thúc nên không sửa được nữa.";
    public const string OnlyDraftOpenMessage = "Chỉ mở được đợt Nháp.";
    public const string OnlyRunningFinishMessage = "Chỉ kết thúc được đợt đang diễn ra.";
    public const string OnlyDraftDeleteMessage = "Chỉ xóa được đợt Nháp.";
    public const string MilestonesIncompleteMessage = "Chưa mở được đợt: các mốc thời gian chưa đầy đủ hoặc chưa hợp lệ.";
    public const string InvalidKindMessage = "Loại người tham gia phải là lecturers hoặc students.";

    public static readonly string[] TopicStatuses =
        ["Chưa đăng ký", "Chờ GV duyệt", "Đã đăng ký", "Bị từ chối", "Đang thực hiện", "Đã cho điểm", "Đã hoàn tất"];

    private static readonly Dictionary<MilestoneKey, string> MilestoneNames = new()
    {
        [MilestoneKey.TopicSubmission] = "GV gửi đề tài",
        [MilestoneKey.TopicRegistration] = "Công bố đề tài · SV đăng ký",
        [MilestoneKey.Outline] = "Đề cương",
        [MilestoneKey.Midterm] = "Báo cáo giữa kỳ",
        [MilestoneKey.Final] = "Báo cáo cuối kỳ",
        [MilestoneKey.ReviewSchedule] = "Lịch phản biện",
        [MilestoneKey.DefenseSchedule] = "Lịch bảo vệ",
        [MilestoneKey.Grading] = "Thời gian cho điểm",
        [MilestoneKey.Finalize] = "Chốt bản cuối · công bố"
    };

    private static readonly Dictionary<RoundStatus, string> StatusLabels = new()
    {
        [RoundStatus.Draft] = "Nháp",
        [RoundStatus.Running] = "Đang diễn ra",
        [RoundStatus.Finished] = "Đã kết thúc"
    };

    private static readonly Dictionary<NotifyAudience, string> AudienceLabels = new()
    {
        [NotifyAudience.Students] = "Sinh viên",
        [NotifyAudience.Lecturers] = "Giảng viên",
        [NotifyAudience.All] = "Tất cả"
    };

    public static IReadOnlyList<MilestoneKey> OrderedKeys { get; } = Enum.GetValues<MilestoneKey>().OrderBy(k => (int)k).ToList();

    public static string Name(MilestoneKey key) => MilestoneNames[key];
    public static string Label(RoundStatus status) => StatusLabels[status];
    public static string Label(NotifyAudience audience) => AudienceLabels[audience];
    // topicSubmission, topicRegistration, ...
    public static string KeyName(MilestoneKey key) => char.ToLowerInvariant(key.ToString()[0]) + key.ToString()[1..];

    public static bool TryParseKey(string? value, out MilestoneKey key)
    {
        key = default;
        var match = OrderedKeys.Where(k => KeyName(k) == value).Select(k => (MilestoneKey?)k).FirstOrDefault();
        if (match is null) return false;
        key = match.Value;
        return true;
    }

    public static bool TryParseAudience(string? value, out NotifyAudience audience)
    {
        audience = default;
        var match = AudienceLabels.Where(p => p.Value == value).Select(p => (NotifyAudience?)p.Key).FirstOrDefault();
        if (match is null) return false;
        audience = match.Value;
        return true;
    }

    // Bộ lọc trạng thái: rỗng hoặc "Tất cả" = mọi trạng thái.
    public static bool TryParseStatusFilter(string? value, out RoundStatus? status)
    {
        status = null;
        if (string.IsNullOrWhiteSpace(value) || value.Trim() == "Tất cả") return true;
        var match = StatusLabels.Where(p => p.Value == value.Trim()).Select(p => (RoundStatus?)p.Key).FirstOrDefault();
        status = match;
        return match is not null;
    }

    public static bool TryParseKind(string? value, out ParticipantKind kind)
    {
        kind = value switch
        {
            "lecturers" => ParticipantKind.Lecturer,
            "students" => ParticipantKind.Student,
            _ => default
        };
        return value is "lecturers" or "students";
    }

    public static string KindLabel(ParticipantKind kind) => kind == ParticipantKind.Student ? "sinh viên" : "giảng viên";
    public static UserRole RoleOf(ParticipantKind kind) => kind == ParticipantKind.Student ? UserRole.Student : UserRole.Lecturer;

    public static string NormalizeText(string? value) => string.Join(' ', (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    public static bool TryParseDate(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(value?.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    public static string FormatDate(DateOnly? date) => date?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty;

    // Kiểm tra từng mốc theo thứ tự (cổng của validateMilestones phía frontend): bắt đầu <= kết thúc và
    // mốc sau không bắt đầu sớm hơn mốc có ngày liền trước. requireAll=true (mở đợt, PDR-032): mốc nào
    // cũng phải có đủ ngày; false (lưu cấu hình): mốc để trống cả hai ngày được bỏ qua.
    public static List<string> ValidateMilestones(IEnumerable<(MilestoneKey Key, string? Start, string? End)> milestones, bool requireAll)
    {
        var errors = new List<string>();
        (string Name, DateOnly Start)? previous = null;
        foreach (var (key, rawStart, rawEnd) in milestones)
        {
            var name = Name(key);
            var start = rawStart?.Trim() ?? string.Empty;
            var end = rawEnd?.Trim() ?? string.Empty;
            if (start.Length == 0 && end.Length == 0)
            {
                if (requireAll) errors.Add($"{name}: Chưa đặt ngày bắt đầu và kết thúc.");
                continue;
            }
            if (!TryParseDate(start, out var s) || !TryParseDate(end, out var e))
            {
                errors.Add($"{name}: Nhập đủ ngày bắt đầu và ngày kết thúc.");
                continue;
            }
            if (s > e)
            {
                errors.Add($"{name}: Ngày kết thúc phải sau hoặc cùng ngày bắt đầu.");
                continue;
            }
            if (previous is { } p && s < p.Start)
            {
                errors.Add($"{name}: Mốc này bắt đầu trước mốc “{p.Name}”. Các mốc phải theo thứ tự thời gian.");
                continue;
            }
            previous = (name, s);
        }
        return errors;
    }
}

public abstract class RoundTextValidator<T> : AbstractValidator<T>
{
    protected void RulesFor(Func<T, string?> name, Func<T, string?> program, Func<T, string?> periodLabel)
    {
        RuleFor(x => name(x)).Must(n => RoundRules.NormalizeText(n).Length > 0).WithMessage("Nhập tên đợt.")
            .Must(n => RoundRules.NormalizeText(n).Length <= RoundRules.MaxTextLength)
            .WithMessage($"Tên đợt tối đa {RoundRules.MaxTextLength} ký tự.");
        RuleFor(x => program(x)).Must(p => p is not null && ThesisRound.Programs.Contains(p.Trim())).WithMessage("Chọn chương trình.");
        RuleFor(x => periodLabel(x)).Must(p => RoundRules.NormalizeText(p).Length > 0).WithMessage("Nhập học kỳ hoặc khóa.")
            .Must(p => RoundRules.NormalizeText(p).Length <= RoundRules.MaxTextLength)
            .WithMessage($"Học kỳ hoặc khóa tối đa {RoundRules.MaxTextLength} ký tự.");
    }
}

public sealed class CreateRoundValidator : RoundTextValidator<CreateRoundCommand>
{
    public CreateRoundValidator()
    {
        RuleFor(x => x.Round).NotNull();
        When(x => x.Round is not null, () =>
        {
            RulesFor(x => x.Round.Name, x => x.Round.Program, x => x.Round.PeriodLabel);
            RuleFor(x => x.Round.CopyFromId)
                .Must(id => string.IsNullOrWhiteSpace(id) || Guid.TryParse(id, out _)).WithMessage("Đợt nguồn không hợp lệ.");
        });
    }
}

public sealed class UpdateRoundValidator : RoundTextValidator<UpdateRoundCommand>
{
    public UpdateRoundValidator()
    {
        RuleFor(x => x.Round).NotNull();
        When(x => x.Round is not null, () =>
        {
            RulesFor(x => x.Round.Name, x => x.Round.Program, x => x.Round.PeriodLabel);
            RuleFor(x => x.Round.LecturerLoadMin).InclusiveBetween(0, RoundRules.MaxLecturerLoad)
                .WithMessage($"Số đề tài tối thiểu từ 0 đến {RoundRules.MaxLecturerLoad}.");
            RuleFor(x => x.Round.LecturerLoadMax).InclusiveBetween(0, RoundRules.MaxLecturerLoad)
                .WithMessage($"Số đề tài tối đa từ 0 đến {RoundRules.MaxLecturerLoad}.");
            // 0 = chưa đặt mức nên chỉ so khi cả hai đều đã đặt.
            RuleFor(x => x.Round).Must(r => r.LecturerLoadMin is not > 0 || r.LecturerLoadMax is not > 0 || r.LecturerLoadMin <= r.LecturerLoadMax)
                .WithMessage("Số đề tài tối thiểu không được lớn hơn tối đa.").OverridePropertyName("lecturerLoad");
        });
    }
}

public sealed class GetRoundsValidator : AbstractValidator<GetRoundsQuery>
{
    public GetRoundsValidator()
    {
        RuleFor(x => x.Status).Must(s => RoundRules.TryParseStatusFilter(s, out _))
            .WithMessage("Trạng thái phải là Nháp, Đang diễn ra, Đã kết thúc hoặc Tất cả.");
    }
}

public sealed class UpdateRoundMilestonesValidator : AbstractValidator<UpdateRoundMilestonesCommand>
{
    public UpdateRoundMilestonesValidator()
    {
        RuleFor(x => x.Input).NotNull();
        When(x => x.Input is not null, () =>
        {
            RuleFor(x => x.Input.Milestones).NotNull().WithMessage("Thiếu danh sách mốc.");
            RuleForEach(x => x.Input.Milestones).NotNull().WithMessage("Mốc không hợp lệ.").ChildRules(m =>
            {
                m.RuleFor(i => i.Key).Must(k => RoundRules.TryParseKey(k, out _)).WithMessage(i => $"Khóa mốc không hợp lệ: {i.Key}.");
                m.RuleFor(i => i.NotifyAudience).Must(a => RoundRules.TryParseAudience(a, out _))
                    .WithMessage("Đối tượng thông báo phải là Sinh viên, Giảng viên hoặc Tất cả.");
            });
            RuleFor(x => x.Input.Milestones).Must(list => list is null || list.Any(m => m is null)
                    || (list.Count == RoundRules.OrderedKeys.Count && list.Select(m => m.Key).Distinct().Count() == list.Count))
                .WithMessage("Cần đủ 9 mốc, mỗi mốc đúng một lần.");
        });
    }
}

