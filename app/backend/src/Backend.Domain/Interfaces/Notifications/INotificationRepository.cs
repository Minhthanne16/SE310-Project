using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface INotificationRepository
{
    // Mới nhất trước, kèm Sender để hiển thị người gửi.
    Task<IReadOnlyList<Notification>> ListForRecipientAsync(Guid recipientId, int limit, CancellationToken cancellationToken = default);
    // Chỉ đổi dòng của chính người nhận còn chưa đọc; id của người khác bị bỏ qua. Trả số dòng đã đổi.
    Task<int> MarkReadAsync(Guid recipientId, IReadOnlyCollection<Guid> ids, DateTime readAt, CancellationToken cancellationToken = default);
}
