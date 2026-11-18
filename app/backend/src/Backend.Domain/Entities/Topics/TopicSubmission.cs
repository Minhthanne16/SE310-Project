using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Bốn loại bài nộp học thuật (PDR-039). P04-S01 dùng Outline; các loại khác thuộc P04-S02/S03.
public enum SubmissionKind
{
    Outline = 1,
    Midterm = 2,
    Final = 3,
    Thesis = 4
}

// Một phiên bản tệp PDF nhóm đã nộp. Không ghi đè, không tự xóa (PDR-042); tệp nằm trong
// object storage riêng tư, DB chỉ giữ khóa object.
public class TopicSubmission : BaseEntity
{
    public Guid TopicId { get; set; }
    public SubmissionKind Kind { get; set; }
    // Số thứ tự trong cùng đề tài và loại, bắt đầu từ 1; duy nhất (TopicId, Kind, VersionNo).
    public int VersionNo { get; set; }
    public string ObjectKey { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    // Ghi chú thay đổi / trả lời yêu cầu của nhóm.
    public string? Note { get; set; }
    public Guid SubmittedById { get; set; }
    // Nộp sau hạn thường nhưng trong hạn trễ riêng của mốc (PDR-041).
    public bool Late { get; set; }
    // Nhận xét của GVHD cho phiên bản này.
    public string? ReviewComment { get; set; }
    public Guid? ReviewedById { get; set; }
    public DateTime? ReviewedAt { get; set; }
}

// Yêu cầu chỉnh sửa của GVHD cho đề cương hoặc báo cáo giữa kỳ/cuối kỳ (PDR-013, PDR-060). Chỉ GVHD tạo và xác nhận hoàn tất.
public class RevisionRequest : BaseEntity
{
    public Guid TopicId { get; set; }
    public SubmissionKind Kind { get; set; } = SubmissionKind.Outline;
    public string Content { get; set; } = string.Empty;
    public Guid CreatedById { get; set; }
    // Phiên bản bài nộp GVHD đang xem khi tạo yêu cầu.
    public Guid RaisedOnSubmissionId { get; set; }
    public Guid? ResolvedById { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

// Phiên bản nộp lại xử lý những yêu cầu đang mở lúc nộp (một lần nộp cho cả lần sửa, PDR-013).
public class RevisionRequestLink
{
    public Guid SubmissionId { get; set; }
    public Guid RequestId { get; set; }
}

// AwaitingReview: đã có phiên bản và không có yêu cầu mở nào tạo sau phiên bản mới nhất,
// tức lượt tiếp theo thuộc về GVHD (chưa xét đề cương đã duyệt).
public sealed record OutlineSummary(int Versions, int OpenRequests, bool AwaitingReview);

public enum OutlineWriteOutcome
{
    Done,
    // Đề cương vừa được duyệt bởi request khác.
    AlreadyApproved,
    // Nhóm đã hủy ghi danh trong lúc gửi tệp.
    NoGroup,
    // Còn yêu cầu mở hoặc nhóm vừa nộp bản mới hơn bản được duyệt.
    Stale
}
