namespace Backend.Application.Topics;

public class OutlineSubmissionDto
{
    public Guid Id { get; set; }
    public int VersionNo { get; set; }
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? Note { get; set; }
    public string SubmittedBy { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; }
    // Nộp trong hạn trễ riêng của mốc (PDR-041).
    public bool Late { get; set; }
    public string? ReviewComment { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    // Yêu cầu đang mở lúc nộp mà phiên bản này xử lý (PDR-013).
    public List<Guid> AddressedRequestIds { get; set; } = [];
}

public class RevisionRequestDto
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    // Phiên bản GVHD đang xem khi tạo yêu cầu.
    public int RaisedOnVersionNo { get; set; }
    // open | resolved
    public string Status { get; set; } = "open";
    public string? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }
    // Các phiên bản nộp lại có liên kết yêu cầu này.
    public List<int> AddressedInVersions { get; set; } = [];
    // Người xem (GVHD) đóng được: yêu cầu còn mở và nhóm đã nộp lại sau khi tạo.
    public bool CanResolve { get; set; }
}

// Chặng Đề cương của một đề tài (Không gian đề tài, PDR-013).
public class OutlineDto
{
    public Guid TopicId { get; set; }
    public string TopicCode { get; set; } = string.Empty;
    public string TopicTitle { get; set; } = string.Empty;
    // member | supervisor | staff
    public string ViewerRole { get; set; } = string.Empty;
    // Hạn mốc Đề cương (yyyy-MM-dd hoặc rỗng) và hạn trễ nếu có.
    public string Deadline { get; set; } = string.Empty;
    public string LateDeadline { get; set; } = string.Empty;
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public int? ApprovedVersionNo { get; set; }
    // Phiên bản hiện hành đang chờ GVHD xử lý (mới nhất), null khi chưa nộp.
    public Guid? CurrentSubmissionId { get; set; }
    public bool CanSubmit { get; set; }
    public string? SubmitBlockedReason { get; set; }
    // GVHD: nhận xét, tạo/đóng yêu cầu.
    public bool CanReview { get; set; }
    public bool CanApprove { get; set; }
    public string? ApproveBlockedReason { get; set; }
    // Mới nhất trước.
    public List<OutlineSubmissionDto> Submissions { get; set; } = [];
    // Yêu cầu mở trước, rồi theo thời điểm tạo mới nhất.
    public List<RevisionRequestDto> Requests { get; set; } = [];
}

public class RevisionRequestInputDto
{
    public string? Content { get; set; }
}

public class OutlineCommentDto
{
    public string? Comment { get; set; }
}

public class OutlineApproveDto
{
    public Guid SubmissionId { get; set; }
}

public sealed record SubmissionFile(byte[] Content, string FileName);
