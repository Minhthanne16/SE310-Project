using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Repositories.Submissions;

public class SubmissionRepository(ApplicationDbContext context) : ISubmissionRepository
{
    private const int MaxVersionAttempts = 3;

    private IQueryable<TopicSubmission> Reports(Guid topicId) =>
        context.TopicSubmissions.AsNoTracking()
            .Where(s => s.TopicId == topicId && (s.Kind == SubmissionKind.Midterm || s.Kind == SubmissionKind.Final));

    public async Task<IReadOnlyList<TopicSubmission>> ListReportsAsync(Guid topicId, CancellationToken cancellationToken = default) =>
        await Reports(topicId).OrderBy(s => s.Kind).ThenByDescending(s => s.VersionNo).ToListAsync(cancellationToken);

    public Task<TopicSubmission?> GetReportAsync(Guid id, CancellationToken cancellationToken = default) =>
        context.TopicSubmissions.AsNoTracking().FirstOrDefaultAsync(
            s => s.Id == id && (s.Kind == SubmissionKind.Midterm || s.Kind == SubmissionKind.Final), cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, SubmitterInfo>> GetSubmittersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default)
    {
        if (userIds.Count == 0) return new Dictionary<Guid, SubmitterInfo>();
        return await context.Users.AsNoTracking().Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new SubmitterInfo(u.UserCode, u.FullName), cancellationToken);
    }

    public async Task AddReportAsync(TopicSubmission submission, TopicHistoryEntry history, CancellationToken cancellationToken = default)
    {
        // Phiên bản = lớn nhất của (đề tài, loại) + 1; hai thành viên nộp cùng lúc có thể lấy trùng số
        // nên dựa vào chỉ mục duy nhất (TopicId, Kind, VersionNo) và thử lại với số mới.
        for (var attempt = 1; ; attempt++)
        {
            await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
            submission.VersionNo = (await context.TopicSubmissions
                .Where(s => s.TopicId == submission.TopicId && s.Kind == submission.Kind)
                .MaxAsync(s => (int?)s.VersionNo, cancellationToken) ?? 0) + 1;
            var detail = $"Bản {submission.VersionNo} · {submission.FileName}";
            if (submission.Late) detail += " · Nộp trễ";
            if (submission.Note is not null) detail += $" · {submission.Note}";
            history.Detail = detail;

            // Một lần nộp cho cả lần sửa: liên kết mọi yêu cầu đang mở của loại này (PDR-013, PDR-060).
            var open = await context.RevisionRequests
                .Where(r => r.TopicId == submission.TopicId && r.Kind == submission.Kind && r.ResolvedAt == null)
                .Select(r => r.Id).ToListAsync(cancellationToken);
            context.TopicSubmissions.Add(submission);
            context.RevisionRequestLinks.AddRange(open.Select(id => new RevisionRequestLink { SubmissionId = submission.Id, RequestId = id }));
            context.TopicHistoryEntries.Add(history);
            try
            {
                await context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return;
            }
            catch (DbUpdateException) when (attempt < MaxVersionAttempts)
            {
                await transaction.RollbackAsync(CancellationToken.None);
                context.ChangeTracker.Clear();
            }
        }
    }

    public async Task<IReadOnlyList<RevisionRequest>> ListRequestsAsync(Guid topicId, CancellationToken cancellationToken = default) =>
        await context.RevisionRequests.AsNoTracking()
            .Where(r => r.TopicId == topicId && (r.Kind == SubmissionKind.Midterm || r.Kind == SubmissionKind.Final))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<RevisionRequestLink>> ListLinksAsync(Guid topicId, CancellationToken cancellationToken = default) =>
        await context.RevisionRequestLinks.AsNoTracking()
            .Where(l => context.RevisionRequests.Any(r => r.Id == l.RequestId && r.TopicId == topicId && (r.Kind == SubmissionKind.Midterm || r.Kind == SubmissionKind.Final)))
            .ToListAsync(cancellationToken);

    public Task<RevisionRequest?> GetRequestAsync(Guid requestId, CancellationToken cancellationToken = default) =>
        context.RevisionRequests.AsNoTracking().FirstOrDefaultAsync(
            r => r.Id == requestId && (r.Kind == SubmissionKind.Midterm || r.Kind == SubmissionKind.Final), cancellationToken);

    public async Task AddRequestAsync(RevisionRequest request, TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        context.RevisionRequests.Add(request);
        context.TopicHistoryEntries.Add(history);
        context.Notifications.AddRange(notifications);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<bool> ResolveRequestAsync(Guid requestId, Guid actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default)
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

    public async Task SaveCommentAsync(Guid submissionId, string? comment, Guid actorId, DateTime now, TopicHistoryEntry history, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await context.TopicSubmissions
            .Where(s => s.Id == submissionId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.ReviewComment, comment)
                .SetProperty(x => x.ReviewedById, actorId)
                .SetProperty(x => x.ReviewedAt, now), cancellationToken);
        context.TopicHistoryEntries.Add(history);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
