using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface ISubmissionRepository
{
    // Mọi phiên bản của đề tài kèm người nộp, không theo dõi thay đổi.
    Task<IReadOnlyList<Submission>> ListByTopicAsync(Guid topicId, CancellationToken cancellationToken = default);
    Task<Submission?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    // Gán Version tiếp theo trong (TopicId, Kind) rồi lưu bài nộp cùng mục lịch sử trong một lần lưu;
    // thử lại khi hai thành viên nộp cùng lúc lấy trùng số.
    Task AddAsync(Submission submission, TopicHistoryEntry history, CancellationToken cancellationToken = default);
}
