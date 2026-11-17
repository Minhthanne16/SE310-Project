using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

// Kết quả gán/đổi Giảng viên phản biện (PDR-021, PDR-023, PDR-062).
public enum ReviewerAssignOutcome
{
    Done,
    // Đề tài đã có đúng người này (thao tác lặp); không ghi lịch sử, không thông báo.
    Unchanged,
    // GVPB hiện tại khác expectedReviewerId: người khác vừa đổi.
    Changed,
    // GVPB đã nhập phiếu điểm đầu tiên (PDR-023).
    Locked,
    // Người được gán là GVHD của đề tài.
    SupervisorConflict,
    NotFound
}

// Đã có báo cáo giữa kỳ/cuối kỳ của đề tài hay chưa.
public sealed record ReportPresence(bool HasMidterm, bool HasFinal);

public interface IReviewerRepository
{
    // Tài khoản theo id (GV của đợt), không theo dõi thay đổi.
    Task<IReadOnlyList<User>> GetUsersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<Guid, ReportPresence>> GetReportPresenceAsync(IReadOnlyCollection<Guid> topicIds, CancellationToken cancellationToken = default);
    // Đề tài giảng viên đang là GVPB, kèm GVHD và GVPB, không theo dõi thay đổi; mới nhất trước.
    Task<IReadOnlyList<ThesisTopic>> ListByReviewerAsync(Guid reviewerId, CancellationToken cancellationToken = default);
    // Trong một transaction: cập nhật có điều kiện một dòng (chưa khóa, GVPB hiện tại đúng expected, khác GVHD,
    // đề cương đã duyệt) rồi ghi lịch sử và thông báo. Thua tranh chấp thì không lưu gì và trả kết quả phân loại.
    Task<ReviewerAssignOutcome> AssignAsync(Guid topicId, Guid newReviewerId, Guid? expectedReviewerId, Guid actorId, DateTime now,
        TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default);
}
