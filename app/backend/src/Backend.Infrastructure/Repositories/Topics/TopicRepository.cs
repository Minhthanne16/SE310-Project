using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Repositories.Topics;

public class TopicRepository(ApplicationDbContext context) : ITopicRepository
{
    private const int MaxNumberAttempts = 3;

    public async Task<IReadOnlyList<ThesisTopic>> ListByRoundAsync(Guid roundId, Guid? supervisorId = null, CancellationToken cancellationToken = default)
    {
        var query = context.ThesisTopics.AsNoTracking().Include(t => t.Supervisor).Where(t => t.RoundId == roundId);
        if (supervisorId is { } id) query = query.Where(t => t.SupervisorId == id);
        return await query.OrderBy(t => t.Number).ToListAsync(cancellationToken);
    }

    public Task<ThesisTopic?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        context.ThesisTopics.Include(t => t.Supervisor).Include(t => t.History).AsSplitQuery()
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    public async Task AddAsync(ThesisTopic topic, CancellationToken cancellationToken = default)
    {
        // Số thứ tự = lớn nhất trong đợt + 1; hai GV gửi cùng lúc có thể lấy trùng số nên dựa vào
        // chỉ mục duy nhất (RoundId, Number) và thử lại với số mới.
        for (var attempt = 1; ; attempt++)
        {
            topic.Number = (await context.ThesisTopics.Where(t => t.RoundId == topic.RoundId)
                .MaxAsync(t => (int?)t.Number, cancellationToken) ?? 0) + 1;
            context.ThesisTopics.Add(topic);
            try
            {
                await context.SaveChangesAsync(cancellationToken);
                return;
            }
            catch (DbUpdateException) when (attempt < MaxNumberAttempts)
            {
                context.Entry(topic).State = EntityState.Detached;
                foreach (var entry in topic.History) context.Entry(entry).State = EntityState.Detached;
            }
        }
    }

    public Task SaveAsync(CancellationToken cancellationToken = default) => context.SaveChangesAsync(cancellationToken);

    public async Task DeleteAsync(ThesisTopic topic, CancellationToken cancellationToken = default)
    {
        context.ThesisTopics.Remove(topic);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, string>> GetUserNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default)
    {
        if (userIds.Count == 0) return new Dictionary<Guid, string>();
        return await context.Users.AsNoTracking().Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);
    }
}
