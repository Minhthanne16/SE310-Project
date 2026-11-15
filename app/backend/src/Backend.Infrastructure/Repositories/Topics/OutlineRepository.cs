using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Repositories.Topics;

public class OutlineRepository(ApplicationDbContext context) : IOutlineRepository
{
    private const int MaxVersionAttempts = 3;

    private IQueryable<TopicSubmission> Outlines(Guid topicId) =>
        context.TopicSubmissions.AsNoTracking().Where(s => s.TopicId == topicId && s.Kind == SubmissionKind.Outline);

    public async Task<IReadOnlyList<TopicSubmission>> ListSubmissionsAsync(Guid topicId, CancellationToken cancellationToken = default) =>
        await Outlines(topicId).OrderByDescending(s => s.VersionNo).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<RevisionRequest>> ListRequestsAsync(Guid topicId, CancellationToken cancellationToken = default) =>
        await context.RevisionRequests.AsNoTracking().Where(r => r.TopicId == topicId).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<RevisionRequestLink>> ListLinksAsync(Guid topicId, CancellationToken cancellationToken = default) =>
        await context.RevisionRequestLinks.AsNoTracking()
            .Where(l => context.RevisionRequests.Any(r => r.Id == l.RequestId && r.TopicId == topicId))
            .ToListAsync(cancellationToken);

    public Task<TopicSubmission?> GetSubmissionAsync(Guid submissionId, CancellationToken cancellationToken = default) =>
        context.TopicSubmissions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == submissionId, cancellationToken);

    public Task<bool> HasOutlineAsync(Guid topicId, CancellationToken cancellationToken = default) =>
        Outlines(topicId).AnyAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, OutlineSummary>> SummaryAsync(
        IReadOnlyCollection<Guid> topicIds, CancellationToken cancellationToken = default)
    {
        if (topicIds.Count == 0) return new Dictionary<Guid, OutlineSummary>();
        var versions = await context.TopicSubmissions
            .Where(s => topicIds.Contains(s.TopicId) && s.Kind == SubmissionKind.Outline)
            .GroupBy(s => s.TopicId).Select(g => new { g.Key, Count = g.Count(), Latest = g.Max(s => s.CreatedAt) })
            .ToDictionaryAsync(x => x.Key, cancellationToken);
        var open = await context.RevisionRequests
            .Where(r => topicIds.Contains(r.TopicId) && r.ResolvedAt == null)
            .GroupBy(r => r.TopicId).Select(g => new { g.Key, Count = g.Count(), Newest = g.Max(r => r.CreatedAt) })
            .ToDictionaryAsync(x => x.Key, cancellationToken);
        return topicIds.Distinct().ToDictionary(id => id, id =>
        {
            var v = versions.GetValueOrDefault(id);
            var o = open.GetValueOrDefault(id);
            var awaiting = v is not null && (o is null || o.Newest < v.Latest);
            return new OutlineSummary(v?.Count ?? 0, o?.Count ?? 0, awaiting);
        });
    }

    public async Task<(OutlineWriteOutcome Outcome, TopicSubmission Submission, int LinkedRequests)> AddSubmissionAsync(
        TopicSubmission submission, TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications,
        CancellationToken cancellationToken = default)
    {
        // Hai thành viên nộp cùng lúc có thể lấy trùng số phiên bản: chỉ mục duy nhất
        // (TopicId, Kind, VersionNo) chặn và request thua thử lại với số mới.
        for (var attempt = 1; ; attempt++)
        {
            await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
            if (await context.ThesisTopics.AnyAsync(t => t.Id == submission.TopicId && t.OutlineApprovedAt != null, cancellationToken))
                return (OutlineWriteOutcome.AlreadyApproved, submission, 0);

            submission.VersionNo = (await Outlines(submission.TopicId).MaxAsync(s => (int?)s.VersionNo, cancellationToken) ?? 0) + 1;
            history.Action = $"Nộp đề cương lần {submission.VersionNo}";
            // Một lần nộp cho cả lần sửa: liên kết mọi yêu cầu đang mở (PDR-013).
            var open = await context.RevisionRequests
                .Where(r => r.TopicId == submission.TopicId && r.ResolvedAt == null)
                .Select(r => r.Id).ToListAsync(cancellationToken);
            context.TopicSubmissions.Add(submission);
            context.RevisionRequestLinks.AddRange(open.Select(id => new RevisionRequestLink { SubmissionId = submission.Id, RequestId = id }));
            context.TopicHistoryEntries.Add(history);
            context.Notifications.AddRange(notifications);
            try
            {
                await context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return (OutlineWriteOutcome.Done, submission, open.Count);
            }
            catch (DbUpdateException) when (attempt < MaxVersionAttempts)
            {
                await transaction.RollbackAsync(CancellationToken.None);
                context.ChangeTracker.Clear();
            }
        }
    }

    public async Task<OutlineWriteOutcome> AddRequestAsync(RevisionRequest request, TopicHistoryEntry history,
        IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        if (await context.ThesisTopics.AnyAsync(t => t.Id == request.TopicId && t.OutlineApprovedAt != null, cancellationToken))
            return OutlineWriteOutcome.AlreadyApproved;
        context.RevisionRequests.Add(request);
        context.TopicHistoryEntries.Add(history);
        context.Notifications.AddRange(notifications);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return OutlineWriteOutcome.Done;
    }

    public async Task<bool> ResolveRequestAsync(Guid requestId, Guid actorId, DateTime now, TopicHistoryEntry history,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        var resolved = await context.RevisionRequests
            .Where(r => r.Id == requestId && r.ResolvedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ResolvedAt, now).SetProperty(r => r.ResolvedById, actorId), cancellationToken);
        if (resolved == 0) return false;
        context.TopicHistoryEntries.Add(history);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task SaveCommentAsync(Guid submissionId, string? comment, Guid actorId, DateTime now, TopicHistoryEntry history,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await context.TopicSubmissions.Where(s => s.Id == submissionId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.ReviewComment, comment)
                .SetProperty(x => x.ReviewedById, actorId)
                .SetProperty(x => x.ReviewedAt, now), cancellationToken);
        context.TopicHistoryEntries.Add(history);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<OutlineWriteOutcome> ApproveAsync(Guid topicId, TopicSubmission submission, Guid actorId, DateTime now,
        TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        if (await context.ThesisTopics.AnyAsync(t => t.Id == topicId && t.OutlineApprovedAt != null, cancellationToken))
            return OutlineWriteOutcome.AlreadyApproved;
        // Điều kiện kiểm lại ngay trong câu cập nhật: không còn yêu cầu mở, không có phiên bản mới hơn.
        var approved = await context.ThesisTopics
            .Where(t => t.Id == topicId && t.OutlineApprovedAt == null
                && !context.RevisionRequests.Any(r => r.TopicId == topicId && r.ResolvedAt == null)
                && !context.TopicSubmissions.Any(s => s.TopicId == topicId && s.Kind == SubmissionKind.Outline && s.VersionNo > submission.VersionNo))
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.OutlineApprovedAt, now)
                .SetProperty(t => t.OutlineApprovedById, actorId)
                .SetProperty(t => t.OutlineApprovedSubmissionId, submission.Id)
                .SetProperty(t => t.UpdatedAt, now), cancellationToken);
        if (approved == 0) return OutlineWriteOutcome.Stale;
        context.TopicHistoryEntries.Add(history);
        context.Notifications.AddRange(notifications);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        // Đề tài đã nạp trong cùng DbContext không tự thấy ExecuteUpdate; nạp lại để handler trả đúng dấu duyệt.
        foreach (var entry in context.ChangeTracker.Entries<ThesisTopic>().Where(e => e.Entity.Id == topicId).ToList())
            await entry.ReloadAsync(cancellationToken);
        return OutlineWriteOutcome.Done;
    }
}
