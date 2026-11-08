using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface IGroupRepository
{
    // Nhóm của sinh viên trong đợt kèm thành viên (và tài khoản), không theo dõi thay đổi.
    Task<ThesisGroup?> GetByStudentAsync(Guid roundId, Guid studentId, CancellationToken cancellationToken = default);
    // Sinh viên đã có nhóm trong đợt, trong số các sinh viên cho trước.
    Task<IReadOnlySet<Guid>> GetGroupedStudentIdsAsync(Guid roundId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken = default);
    // Đề tài nhóm đang ghi danh (null nếu không có).
    Task<ThesisTopic?> GetTopicOfGroupAsync(Guid groupId, CancellationToken cancellationToken = default);
    // Các lần ghi danh của nhóm, mới nhất trước, kèm đề tài.
    Task<IReadOnlyList<(TopicRegistration Registration, ThesisTopic Topic)>> ListRegistrationsAsync(Guid groupId, CancellationToken cancellationToken = default);
    // Nhóm theo id kèm thành viên (và tài khoản), không theo dõi thay đổi.
    Task<IReadOnlyDictionary<Guid, ThesisGroup>> GetGroupsAsync(IReadOnlyCollection<Guid> groupIds, CancellationToken cancellationToken = default);

    // Trong một transaction: tạo nhóm (nếu mới), nhận đề tài chỉ khi đề tài còn trống
    // (cập nhật có điều kiện), ghi lần ghi danh, lịch sử và thông báo. Thua tranh chấp thì không lưu gì.
    Task<RegisterOutcome> RegisterAsync(ThesisGroup group, bool newGroup, Guid topicId, TopicRegistration registration,
        TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default);
    // Trả đề tài về Chưa đăng ký nếu vẫn thuộc nhóm; false khi đã được hủy trước đó (hủy lặp).
    Task<bool> CancelAsync(Guid topicId, Guid groupId, Guid actorId, DateTime now, TopicHistoryEntry history,
        CancellationToken cancellationToken = default);
}
