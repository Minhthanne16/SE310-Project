using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface ITopicRepository
{
    // Đề tài của đợt kèm GVHD, không theo dõi thay đổi. supervisorId lọc theo GVHD.
    Task<IReadOnlyList<ThesisTopic>> ListByRoundAsync(Guid roundId, Guid? supervisorId = null, CancellationToken cancellationToken = default);
    // Đề xuất của cùng một nhóm, gồm bản ghi đã hủy để tra cứu lịch sử PDR-012.
    Task<IReadOnlyList<ThesisTopic>> ListByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);
    // Đề tài kèm GVHD và lịch sử, có theo dõi thay đổi để sửa rồi gọi SaveAsync.
    Task<ThesisTopic?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    // Gán Number tiếp theo của đợt rồi lưu; thử lại khi request khác vừa lấy cùng số.
    Task AddAsync(ThesisTopic topic, CancellationToken cancellationToken = default);
    Task SaveAsync(CancellationToken cancellationToken = default);
    Task DeleteAsync(ThesisTopic topic, CancellationToken cancellationToken = default);
    // Các cập nhật đề xuất đều có điều kiện PendingApproval để chặn đua với duyệt/từ chối/hủy.
    Task<bool> UpdatePendingProposalAsync(Guid topicId, Guid supervisorId, string title, string field, string description,
        string? requirements, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default);
    Task<bool> TransitionPendingProposalAsync(Guid topicId, TopicStatus nextStatus, DateTime now,
        TopicHistoryEntry history, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<Guid, string>> GetUserNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
    // Lượt bảo vệ có hiệu lực của đề tài (PDR-016) kèm hội đồng, Chủ tịch, Thư ký; null khi chưa xếp hoặc hội đồng đã hủy.
    Task<DefenseSlot?> GetActiveDefenseAsync(Guid topicId, CancellationToken cancellationToken = default);
    // Đính chính của hội đồng (PDR-018), cũ trước.
    Task<IReadOnlyList<DefenseCouncilLog>> ListDefenseCorrectionsAsync(Guid councilId, CancellationToken cancellationToken = default);
}
