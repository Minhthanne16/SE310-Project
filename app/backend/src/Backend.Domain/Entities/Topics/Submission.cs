using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Loại bài nộp đang hỗ trợ (P04-S02). Đề cương và bản khóa luận sẽ dùng chung bảng khi làm P04-S01/S03.
public enum SubmissionKind
{
    Midterm = 1,
    Final = 2
}

// Một phiên bản báo cáo đã nộp (DOMAIN_MODEL · Bài nộp). Không sửa, không xóa: nộp lại tạo
// phiên bản mới và mọi phiên bản được giữ sau khi đợt kết thúc (PDR-042). CreatedAt là thời điểm nộp.
public class Submission : BaseEntity
{
    public Guid TopicId { get; set; }
    public SubmissionKind Kind { get; set; }
    // Đánh số từ 1 trong từng loại của đề tài; duy nhất theo (TopicId, Kind, Version).
    public int Version { get; set; }
    // Tên tệp gốc đã làm sạch, chỉ để hiển thị và đặt tên khi tải về.
    public string FileName { get; set; } = string.Empty;
    // Khóa object trong storage riêng tư; không bao giờ trả cho frontend.
    public string ObjectKey { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    // Ghi chú thay đổi; bắt buộc với báo cáo cuối kỳ (DESIGN · Không gian đề tài).
    public string? Note { get; set; }
    public Guid SubmittedById { get; set; }
    public User? SubmittedBy { get; set; }
    // Nộp sau hạn thường, trong hạn trễ riêng của mốc (PDR-041).
    public bool IsLate { get; set; }
}
