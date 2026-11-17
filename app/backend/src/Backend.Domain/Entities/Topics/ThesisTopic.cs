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
    NoGroup = 12,
    // Chỉ thuộc vòng đời đề xuất của SV (PDR-012), không phải nhánh của đề tài đã đăng ký.
    Cancelled = 13
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
    // Giảng viên phản biện (PDR-021, PDR-062): tối đa một mỗi đề tài, khác GVHD (ràng buộc ở database).
    public Guid? ReviewerId { get; set; }
    public User? Reviewer { get; set; }
    public DateTime? ReviewerAssignedAt { get; set; }
    public Guid? ReviewerAssignedById { get; set; }
    // Dấu khóa PDR-023: đặt cùng transaction với phiếu phản biện đầu tiên (P07); khác null thì không đổi GVPB.
    public DateTime? ReviewerFirstScoredAt { get; set; }
    public TopicSource Source { get; set; } = TopicSource.Lecturer;
    public TopicStatus Status { get; set; } = TopicStatus.NotRegistered;
    // Nhóm đang nhận đề tài; duy nhất để một nhóm không giữ hai đề tài (PDR-054).
    public Guid? GroupId { get; set; }
    // Duyệt đề cương (PDR-013): hoàn tất chặng Đề cương, không đổi trạng thái đề tài (PDR-049).
    public DateTime? OutlineApprovedAt { get; set; }
    public Guid? OutlineApprovedById { get; set; }
    public Guid? OutlineApprovedSubmissionId { get; set; }
    // PDR-011: một hạn bổ sung cho đúng nhóm/đề tài, giữ cả khi đã hết hạn.
    public DateOnly? ThesisExtensionEnd { get; set; }
    public string? ThesisExtensionReason { get; set; }
    public Guid? ThesisExtensionGrantedById { get; set; }
    public DateTime? ThesisExtensionGrantedAt { get; set; }
    // Con trỏ duy nhất tới phiên bản khóa luận đã chốt; null nghĩa là chưa có bản cuối.
    public Guid? FinalThesisSubmissionId { get; set; }
    public DateTime? FinalThesisLockedAt { get; set; }
    public Guid? FinalThesisLockedById { get; set; }
    public string? IneligibleReason { get; set; }
    public DateTime? IneligibleAt { get; set; }
    public Guid? IneligibleById { get; set; }
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
    public const string Submission = "Bài nộp";
    public const string Assignment = "Phân công";
    // Công bố, đổi, hủy, đính chính lịch bảo vệ (P06, PDR-063).
    public const string Defense = "Lịch bảo vệ";
}
