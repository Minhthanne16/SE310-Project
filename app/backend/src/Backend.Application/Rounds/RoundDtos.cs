using System.Text.Json.Serialization;

namespace Backend.Application.Rounds;

// Hợp đồng khớp frontend app/frontend/src/types/round.ts. Trạng thái, chương trình,
// đối tượng thông báo đi qua API bằng nhãn tiếng Việt; khóa mốc dạng camelCase.
public sealed class RoundDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Program { get; set; } = string.Empty;
    public string PeriodLabel { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<RoundMilestoneDto> Milestones { get; set; } = [];
    public List<Guid> LecturerIds { get; set; } = [];
    public List<Guid> StudentIds { get; set; } = [];
    // Chưa có dữ liệu đề tài/điểm nên chưa khóa ai (PDR-030).
    public List<Guid> LockedStudentIds { get; set; } = [];
    public RoundTopicSummaryDto TopicSummary { get; set; } = new();
}

public sealed class RoundMilestoneDto
{
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    // yyyy-MM-dd; chuỗi rỗng nghĩa là chưa đặt ngày.
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string NotifyAudience { get; set; } = string.Empty;
    // Chỉ khác null với Đề cương, Giữa kỳ, Cuối kỳ.
    public bool? AllowLate { get; set; }
}

// Chưa có bảng đề tài nên mọi số đều 0; khóa là 7 nhãn trạng thái đề tài của frontend.
public sealed class RoundTopicSummaryDto
{
    public int Total { get; set; }
    public int UnpublishedCount { get; set; }
    public Dictionary<string, int> ByStatus { get; set; } = [];
}

public sealed class RoundInputDto
{
    public string Name { get; set; } = string.Empty;
    public string Program { get; set; } = string.Empty;
    public string PeriodLabel { get; set; } = string.Empty;
    // Đợt nguồn để sao chép khung cấu hình (PDR-034); null hoặc rỗng = đợt trống.
    public string? CopyFromId { get; set; }
}

public sealed class RoundInfoDto
{
    public string Name { get; set; } = string.Empty;
    public string Program { get; set; } = string.Empty;
    public string PeriodLabel { get; set; } = string.Empty;
}

public sealed class RoundMilestonesInputDto
{
    public List<RoundMilestoneInputDto> Milestones { get; set; } = [];
}

public sealed class RoundMilestoneInputDto
{
    public string Key { get; set; } = string.Empty;
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string NotifyAudience { get; set; } = string.Empty;
    public bool? AllowLate { get; set; }
}

public sealed class ParticipantDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    // Lớp (sinh viên) hoặc bộ môn (giảng viên).
    public string Unit { get; set; } = string.Empty;
}

public sealed class CandidateDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? BlockedReason { get; set; }
}

public sealed class ParticipantCheckDto
{
    public string Code { get; set; } = string.Empty;
    // valid | notFound | alreadyInRound | inOtherRound
    public string Status { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ParticipantDto? Participant { get; set; }
}

public sealed class ParticipantCodesDto
{
    public List<string> Codes { get; set; } = [];
}

public sealed class AddParticipantsResultDto
{
    public RoundDto Round { get; set; } = new();
    public List<ParticipantCheckDto> Results { get; set; } = [];
    public int Added { get; set; }
}
