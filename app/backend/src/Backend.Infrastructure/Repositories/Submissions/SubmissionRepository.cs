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
            submission.VersionNo = (await context.TopicSubmissions
                .Where(s => s.TopicId == submission.TopicId && s.Kind == submission.Kind)
                .MaxAsync(s => (int?)s.VersionNo, cancellationToken) ?? 0) + 1;
            var detail = $"Bản {submission.VersionNo} · {submission.FileName}";
            if (submission.Late) detail += " · Nộp trễ";
            if (submission.Note is not null) detail += $" · {submission.Note}";
            history.Detail = detail;
            context.TopicSubmissions.Add(submission);
            context.TopicHistoryEntries.Add(history);
            try
            {
                await context.SaveChangesAsync(cancellationToken);
                return;
            }
            catch (DbUpdateException) when (attempt < MaxVersionAttempts)
            {
                context.Entry(submission).State = EntityState.Detached;
                context.Entry(history).State = EntityState.Detached;
            }
        }
    }
}
