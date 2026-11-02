using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Vòng đời đợt theo docs/DESIGN/03: Nháp -> Đang diễn ra -> Đã kết thúc.
public enum RoundStatus
{
    Draft = 1,
    Running = 2,
    Finished = 3
}

// Chín mốc cố định của đợt, theo đúng thứ tự khai báo (giá trị enum = thứ tự).
public enum MilestoneKey
{
    TopicSubmission = 1,
    TopicRegistration = 2,
    Outline = 3,
    Midterm = 4,
    Final = 5,
    ReviewSchedule = 6,
    DefenseSchedule = 7,
    Grading = 8,
    Finalize = 9
}

// Đối tượng nhận thông báo của mốc.
public enum NotifyAudience
{
    Students = 1,
    Lecturers = 2,
    All = 3
}

public enum ParticipantKind
{
    Lecturer = 1,
    Student = 2
}

// Đợt khóa luận. Luôn có đúng 9 mốc (tạo cùng đợt) và danh sách người tham gia.
public class ThesisRound : BaseEntity
{
    public static readonly string[] Programs = ["Văn bằng 1", "Văn bằng 2", "Thạc sĩ"];

    public string Name { get; set; } = string.Empty;
    // Tên đã chuẩn hóa (trim + chữ thường) để chặn trùng tên không phân biệt hoa thường.
    public string NormalizedName { get; set; } = string.Empty;
    public string Program { get; set; } = string.Empty;
    // Học kỳ hoặc khóa, ví dụ "HK1 2026–2027".
    public string PeriodLabel { get; set; } = string.Empty;
    public RoundStatus Status { get; set; } = RoundStatus.Draft;
    // Đợt nguồn khi tạo bằng cách sao chép khung cấu hình (PDR-034), chỉ để truy vết.
    public Guid? CopiedFromId { get; set; }
    public DateTime? OpenedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public List<RoundMilestone> Milestones { get; set; } = [];
    public List<RoundParticipant> Participants { get; set; } = [];

    public static string NormalizeName(string name) => name.Trim().ToLowerInvariant();

    // Chỉ ba mốc báo cáo có công tắc "Cho nộp trễ".
    public static bool HasLateToggle(MilestoneKey key) =>
        key is MilestoneKey.Outline or MilestoneKey.Midterm or MilestoneKey.Final;
}

public class RoundMilestone : BaseEntity
{
    public Guid RoundId { get; set; }
    public MilestoneKey Key { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public NotifyAudience NotifyAudience { get; set; } = NotifyAudience.All;
    // Chỉ khác null với Đề cương, Giữa kỳ, Cuối kỳ (mặc định true).
    public bool? AllowLate { get; set; }
}

public class RoundParticipant : BaseEntity
{
    public Guid RoundId { get; set; }
    public ThesisRound? Round { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public ParticipantKind Kind { get; set; }
}
