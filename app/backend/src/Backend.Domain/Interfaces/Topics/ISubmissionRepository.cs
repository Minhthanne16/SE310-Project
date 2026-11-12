using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

// Người nộp để hiển thị (mã, họ tên).
public sealed record SubmitterInfo(string Code, string Name);

// Báo cáo giữa kỳ/cuối kỳ (P04-S02) dùng chung bảng bài nộp với đề cương (TopicSubmission).
public interface ISubmissionRepository
{
    // Báo cáo giữa kỳ và cuối kỳ của đề tài, không theo dõi thay đổi.
    Task<IReadOnlyList<TopicSubmission>> ListReportsAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<TopicSubmission?> GetReportAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<Guid, SubmitterInfo>> GetSubmittersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
    // Gán VersionNo kế tiếp trong (TopicId, Kind) rồi lưu bài nộp cùng mục lịch sử trong một lần lưu;
    // thử lại khi hai thành viên nộp cùng lúc lấy trùng số.
    Task AddReportAsync(TopicSubmission submission, TopicHistoryEntry history, CancellationToken cancellationToken = default);
}
