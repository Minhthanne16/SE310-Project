using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Repositories.Notifications;

public sealed class NotificationRepository(ApplicationDbContext context) : INotificationRepository
{
    public async Task<IReadOnlyList<Notification>> ListForRecipientAsync(Guid recipientId, int limit, CancellationToken cancellationToken = default)
    {
        return await context.Notifications.AsNoTracking()
            .Include(n => n.Sender)
            .Where(n => n.RecipientUserId == recipientId)
            .OrderByDescending(n => n.CreatedAt)
            .ThenBy(n => n.Id)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> MarkReadAsync(Guid recipientId, IReadOnlyCollection<Guid> ids, DateTime readAt, CancellationToken cancellationToken = default)
    {
        var unread = await context.Notifications
            .Where(n => n.RecipientUserId == recipientId && n.ReadAt == null && ids.Contains(n.Id))
            .ToListAsync(cancellationToken);
        foreach (var notification in unread) notification.ReadAt = readAt;
        await context.SaveChangesAsync(cancellationToken);
        return unread.Count;
    }
}
