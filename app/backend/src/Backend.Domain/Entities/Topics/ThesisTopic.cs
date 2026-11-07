using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Nguồn đề tài: giảng viên gửi vào đợt, hoặc sinh viên đề xuất (P03-S03).
public enum TopicSource
{
    Lecturer = 1,
    StudentProposal = 2
}

// Vòng đời đề tài theo PDR-049, PDR-011, PDR-048. Giá trị lưu; trạng thái hiển thị
// có thể khác khi đăng ký đã đóng (xem TopicRules.Effective ở Application).
public enum TopicStatus
{
    NotRegistered = 1,
    PendingApproval = 2,
    Registered = 3,
    Rejected = 4,
    InProgress = 5,
    Grading = 6,
    Graded = 7,
    Deviation = 8,
    Confirmed = 9,
    Completed = 10,
    Ineligible = 11,
    NoGroup = 12
}

// Đề tài khóa luận thuộc một đợt (P03-S01, DESIGN · Đề tài của tôi / Quản lý đề tài).
public class ThesisTopic : BaseEntity
{
    public Guid RoundId { get; set; }
    // Số thứ tự trong đợt; mã hiển thị là DT-{Number:000}. Duy nhất trong đợt.
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Requirements { get; set; }
    public string Field { get; set; } = string.Empty;
    // Giảng viên hướng dẫn.
    public Guid SupervisorId { get; set; }
    public User? Supervisor { get; set; }
    public TopicSource Source { get; set; } = TopicSource.Lecturer;
    public TopicStatus Status { get; set; } = TopicStatus.NotRegistered;
    // Nhóm đang nhận đề tài; duy nhất để một nhóm không giữ hai đề tài (PDR-054).
    public Guid? GroupId { get; set; }
    public List<TopicHistoryEntry> History { get; set; } = [];

    public string Code => $"DT-{Number:000}";
}

// Lịch sử đề tài (DESIGN · Chi tiết đề tài, tab Lịch sử). ActorUserId null = Hệ thống.
public class TopicHistoryEntry : BaseEntity
{
    public Guid TopicId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Detail { get; set; }
}

public static class TopicHistoryCategories
{
    // Trùng nhãn HISTORY_CATEGORIES ở frontend (types/topic.ts).
    public const string Status = "Trạng thái";
    public const string Content = "Nội dung";
    public const string Group = "Nhóm";
}
