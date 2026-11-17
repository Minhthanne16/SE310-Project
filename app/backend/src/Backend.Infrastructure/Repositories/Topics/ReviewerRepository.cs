using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Repositories.Topics;

public class ReviewerRepository(ApplicationDbContext context) : IReviewerRepository
{
    public async Task<IReadOnlyList<User>> GetUsersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default) =>
        userIds.Count == 0 ? [] : await context.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, ReportPresence>> GetReportPresenceAsync(
        IReadOnlyCollection<Guid> topicIds, CancellationToken cancellationToken = default)
    {
        if (topicIds.Count == 0) return new Dictionary<Guid, ReportPresence>();
        var kinds = await context.TopicSubmissions.AsNoTracking()
            .Where(s => topicIds.Contains(s.TopicId) && (s.Kind == SubmissionKind.Midterm || s.Kind == SubmissionKind.Final))
            .Select(s => new { s.TopicId, s.Kind }).Distinct().ToListAsync(cancellationToken);
        return topicIds.Distinct().ToDictionary(id => id, id => new ReportPresence(
            kinds.Any(k => k.TopicId == id && k.Kind == SubmissionKind.Midterm),
            kinds.Any(k => k.TopicId == id && k.Kind == SubmissionKind.Final)));
    }

    public async Task<IReadOnlyList<ThesisTopic>> ListByReviewerAsync(Guid reviewerId, CancellationToken cancellationToken = default) =>
        await context.ThesisTopics.AsNoTracking().Include(t => t.Supervisor).Include(t => t.Reviewer)
            .Where(t => t.ReviewerId == reviewerId)
            .OrderByDescending(t => t.ReviewerAssignedAt).ThenBy(t => t.Number).ToListAsync(cancellationToken);

    public async Task<ReviewerAssignOutcome> AssignAsync(Guid topicId, Guid newReviewerId, Guid? expectedReviewerId, Guid actorId,
        DateTime now, TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        // Mọi điều kiện kiểm lại ngay trong câu cập nhật: một dòng, nên hai Giáo vụ hoặc một lần đổi chạy song
        // song với nhập phiếu chỉ có một bên thắng (PDR-023, PDR-062).
        var updated = await context.ThesisTopics
            .Where(t => t.Id == topicId
                && t.ReviewerFirstScoredAt == null
                && t.OutlineApprovedAt != null
                && t.SupervisorId != newReviewerId
                && t.ReviewerId == expectedReviewerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.ReviewerId, newReviewerId)
                .SetProperty(t => t.ReviewerAssignedAt, now)
                .SetProperty(t => t.ReviewerAssignedById, actorId)
                .SetProperty(t => t.UpdatedAt, now), cancellationToken);
        if (updated == 0)
        {
            await transaction.RollbackAsync(CancellationToken.None);
            return await ClassifyAsync(topicId, newReviewerId, cancellationToken);
        }

        context.TopicHistoryEntries.Add(history);
        context.Notifications.AddRange(notifications);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ReviewerAssignOutcome.Done;
    }

    private async Task<ReviewerAssignOutcome> ClassifyAsync(Guid topicId, Guid newReviewerId, CancellationToken cancellationToken)
    {
        var topic = await context.ThesisTopics.AsNoTracking().Where(t => t.Id == topicId)
            .Select(t => new { t.ReviewerId, t.SupervisorId, t.ReviewerFirstScoredAt, t.OutlineApprovedAt })
            .FirstOrDefaultAsync(cancellationToken);
        if (topic is null) return ReviewerAssignOutcome.NotFound;
        if (topic.ReviewerId == newReviewerId) return ReviewerAssignOutcome.Unchanged;
        if (topic.ReviewerFirstScoredAt is not null) return ReviewerAssignOutcome.Locked;
        if (topic.SupervisorId == newReviewerId) return ReviewerAssignOutcome.SupervisorConflict;
        return ReviewerAssignOutcome.Changed;
    }
}
