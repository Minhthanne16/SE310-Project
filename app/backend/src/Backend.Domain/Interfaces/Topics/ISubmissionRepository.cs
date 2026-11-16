using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

// Người nộp để hiển thị (mã, họ tên).
public sealed record SubmitterInfo(string Code, string Name);
public sealed class ThesisSubmissionClosedException : Exception;

// Báo cáo giữa kỳ/cuối kỳ (P04-S02) dùng chung bảng bài nộp với đề cương (TopicSubmission).
public interface ISubmissionRepository
{
    // Báo cáo giữa kỳ và cuối kỳ của đề tài, không theo dõi thay đổi.
    Task<IReadOnlyList<TopicSubmission>> ListReportsAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TopicSubmission>> ListThesesForTopicsAsync(IReadOnlyCollection<Guid> topicIds, CancellationToken cancellationToken = default);
    Task<TopicSubmission?> GetReportAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<Guid, SubmitterInfo>> GetSubmittersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
    // Gán VersionNo kế tiếp trong (TopicId, Kind) rồi lưu bài nộp cùng các liên kết yêu cầu chỉnh sửa đang mở và mục lịch sử trong một lần lưu;
    // thử lại khi hai thành viên nộp cùng lúc lấy trùng số.
    Task AddReportAsync(TopicSubmission submission, TopicHistoryEntry history, CancellationToken cancellationToken = default);

    // Danh sách yêu cầu chỉnh sửa cho báo cáo giữa kỳ và cuối kỳ của đề tài.
    Task<IReadOnlyList<RevisionRequest>> ListRequestsAsync(Guid topicId, CancellationToken cancellationToken = default);
    // Danh sách liên kết giữa bài nộp báo cáo và yêu cầu chỉnh sửa của đề tài.
    Task<IReadOnlyList<RevisionRequestLink>> ListLinksAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<RevisionRequest?> GetRequestAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task AddRequestAsync(RevisionRequest request, TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default);
    Task<bool> ResolveRequestAsync(Guid requestId, Guid actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default);
    Task SaveCommentAsync(Guid submissionId, string? comment, Guid actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default);
    Task<bool> GrantThesisExtensionAsync(Guid topicId, DateOnly end, string reason, Guid actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default);
    Task<bool> LockThesisAsync(Guid topicId, Guid submissionId, Guid? actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default);
    Task<bool> MarkIneligibleAsync(Guid topicId, string reason, Guid actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Guid>> GetExpiredThesisTopicsAsync(DateOnly today, CancellationToken cancellationToken = default);
}
