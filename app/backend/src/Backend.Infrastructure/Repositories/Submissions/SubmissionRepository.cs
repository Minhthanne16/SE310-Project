using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Repositories.Submissions;

public class SubmissionRepository(ApplicationDbContext context) : ISubmissionRepository
{
    private const int MaxVersionAttempts = 3;

    public async Task<IReadOnlyList<Submission>> ListByTopicAsync(Guid topicId, CancellationToken cancellationToken = default) =>
        await context.Submissions.AsNoTracking().Include(s => s.SubmittedBy)
            .Where(s => s.TopicId == topicId).OrderBy(s => s.Kind).ThenByDescending(s => s.Version).ToListAsync(cancellationToken);

    public Task<Submission?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        context.Submissions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public async Task AddAsync(Submission submission, TopicHistoryEntry history, CancellationToken cancellationToken = default)
    {
        // Phiên bản = lớn nhất của (đề tài, loại) + 1. Hai thành viên nộp cùng lúc có thể lấy trùng số,
        // nên dựa vào chỉ mục duy nhất (TopicId, Kind, Version) và thử lại với số mới.
        for (var attempt = 1; ; attempt++)
        {
            submission.Version = (await context.Submissions
                .Where(s => s.TopicId == submission.TopicId && s.Kind == submission.Kind)
                .MaxAsync(s => (int?)s.Version, cancellationToken) ?? 0) + 1;
            var detail = $"Bản {submission.Version} · {submission.FileName}";
            if (submission.IsLate) detail += " · Nộp trễ";
            if (submission.Note is not null) detail += $" · {submission.Note}";
            history.Detail = detail;
            context.Submissions.Add(submission);
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
