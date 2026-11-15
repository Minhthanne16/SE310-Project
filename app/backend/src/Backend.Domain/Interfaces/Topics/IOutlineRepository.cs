using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface IOutlineRepository
{
    // Các phiên bản đề cương của đề tài, mới nhất trước, không theo dõi thay đổi.
    Task<IReadOnlyList<TopicSubmission>> ListSubmissionsAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RevisionRequest>> ListRequestsAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RevisionRequestLink>> ListLinksAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<TopicSubmission?> GetSubmissionAsync(Guid submissionId, CancellationToken cancellationToken = default);
    Task<bool> HasOutlineAsync(Guid topicId, CancellationToken cancellationToken = default);
    // Số phiên bản đề cương, số yêu cầu mở và phiên bản mới nhất có đang chờ GVHD hay không
    // (cho danh sách nhóm hướng dẫn).
    Task<IReadOnlyDictionary<Guid, OutlineSummary>> SummaryAsync(IReadOnlyCollection<Guid> topicIds, CancellationToken cancellationToken = default);

    // Gán VersionNo kế tiếp, liên kết mọi yêu cầu đang mở, ghi lịch sử và thông báo trong một
    // transaction. AlreadyApproved khi đề cương vừa được duyệt.
    Task<(OutlineWriteOutcome Outcome, TopicSubmission Submission, int LinkedRequests)> AddSubmissionAsync(
        TopicSubmission submission, TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications,
        CancellationToken cancellationToken = default);
    Task<OutlineWriteOutcome> AddRequestAsync(RevisionRequest request, TopicHistoryEntry history,
        IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default);
    // Chỉ đóng yêu cầu còn mở; false khi đã đóng (thao tác lặp).
    Task<bool> ResolveRequestAsync(Guid requestId, Guid actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default);
    Task SaveCommentAsync(Guid submissionId, string? comment, Guid actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default);
    // Duyệt có điều kiện: chưa duyệt, không còn yêu cầu mở và không có phiên bản mới hơn.
    Task<OutlineWriteOutcome> ApproveAsync(Guid topicId, TopicSubmission submission, Guid actorId, DateTime now,
        TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default);
}
