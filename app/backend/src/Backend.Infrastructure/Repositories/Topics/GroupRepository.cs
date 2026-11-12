using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Repositories.Topics;

public class GroupRepository(ApplicationDbContext context) : IGroupRepository
{
    private IQueryable<ThesisGroup> WithMembers() =>
        context.ThesisGroups.AsNoTracking().Include(g => g.Members).ThenInclude(m => m.Student);

    public Task<ThesisGroup?> GetByStudentAsync(Guid roundId, Guid studentId, CancellationToken cancellationToken = default) =>
        WithMembers().FirstOrDefaultAsync(g => g.RoundId == roundId && g.Members.Any(m => m.StudentId == studentId), cancellationToken);

    public async Task<IReadOnlySet<Guid>> GetGroupedStudentIdsAsync(Guid roundId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken = default)
    {
        if (studentIds.Count == 0) return new HashSet<Guid>();
        return (await context.GroupMembers
            .Where(m => m.RoundId == roundId && studentIds.Contains(m.StudentId))
            .Select(m => m.StudentId)
            .ToListAsync(cancellationToken)).ToHashSet();
    }

    public Task<ThesisTopic?> GetTopicOfGroupAsync(Guid groupId, CancellationToken cancellationToken = default) =>
        context.ThesisTopics.AsNoTracking().Include(t => t.Supervisor)
            .FirstOrDefaultAsync(t => t.GroupId == groupId && t.Status != TopicStatus.Cancelled, cancellationToken);

    public async Task<IReadOnlyList<(TopicRegistration Registration, ThesisTopic Topic)>> ListRegistrationsAsync(Guid groupId, CancellationToken cancellationToken = default)
    {
        var rows = await context.TopicRegistrations.AsNoTracking()
            .Where(r => r.GroupId == groupId)
            .Join(context.ThesisTopics.AsNoTracking(), r => r.TopicId, t => t.Id, (r, t) => new { r, t })
            .ToListAsync(cancellationToken);
        return rows.OrderByDescending(x => x.r.CreatedAt).Select(x => (x.r, x.t)).ToList();
    }

    public async Task<IReadOnlyDictionary<Guid, ThesisGroup>> GetGroupsAsync(IReadOnlyCollection<Guid> groupIds, CancellationToken cancellationToken = default)
    {
        if (groupIds.Count == 0) return new Dictionary<Guid, ThesisGroup>();
        return await WithMembers().Where(g => groupIds.Contains(g.Id)).ToDictionaryAsync(g => g.Id, cancellationToken);
    }

    public async Task<ProposalCreateOutcome> CreateProposalAsync(ThesisGroup group, bool newGroup, ThesisTopic proposal,
        CancellationToken cancellationToken = default)
    {
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                if (newGroup) context.ThesisGroups.Add(group);
                proposal.Number = (await context.ThesisTopics.Where(t => t.RoundId == proposal.RoundId)
                    .MaxAsync(t => (int?)t.Number, cancellationToken) ?? 0) + 1;
                context.ThesisTopics.Add(proposal);
                await context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return ProposalCreateOutcome.Created;
            }
            catch (DbUpdateException ex) when (UniqueViolation(ex, "IX_GroupMembers_RoundId_StudentId"))
            {
                await transaction.RollbackAsync(CancellationToken.None);
                Reset();
                return ProposalCreateOutcome.MemberTaken;
            }
            catch (DbUpdateException ex) when (UniqueViolation(ex, "IX_ThesisTopics_ActiveGroupId"))
            {
                await transaction.RollbackAsync(CancellationToken.None);
                Reset();
                return ProposalCreateOutcome.GroupHasTopic;
            }
            catch (DbUpdateException) when (attempt < 3)
            {
                await transaction.RollbackAsync(CancellationToken.None);
                Reset();
            }
        }

        return ProposalCreateOutcome.GroupHasTopic;
    }

    public async Task<RegisterOutcome> RegisterAsync(ThesisGroup group, bool newGroup, Guid topicId, TopicRegistration registration,
        TopicHistoryEntry history, IReadOnlyCollection<Notification> notifications, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            if (newGroup)
            {
                // Chỉ mục duy nhất (RoundId, StudentId) của GroupMembers chặn sinh viên vào hai nhóm.
                context.ThesisGroups.Add(group);
                await context.SaveChangesAsync(cancellationToken);
            }

            // Chỉ nhận khi đề tài còn trống: request thứ hai chờ khóa dòng rồi thấy 0 dòng.
            // Chỉ mục duy nhất GroupId của ThesisTopics chặn một nhóm giữ hai đề tài.
            var claimed = await context.ThesisTopics
                .Where(t => t.Id == topicId && t.GroupId == null && t.Status == TopicStatus.NotRegistered)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.GroupId, group.Id)
                    .SetProperty(t => t.Status, TopicStatus.Registered)
                    .SetProperty(t => t.UpdatedAt, registration.CreatedAt), cancellationToken);
            if (claimed == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                Reset();
                return RegisterOutcome.TopicTaken;
            }

            context.TopicRegistrations.Add(registration);
            context.TopicHistoryEntries.Add(history);
            context.Notifications.AddRange(notifications);
            await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return RegisterOutcome.Registered;
        }
        catch (DbUpdateException ex) when (UniqueViolation(ex, "IX_GroupMembers_RoundId_StudentId"))
        {
            await transaction.RollbackAsync(CancellationToken.None);
            Reset();
            return RegisterOutcome.MemberTaken;
        }
        catch (DbUpdateException ex) when (UniqueViolation(ex, "IX_ThesisTopics_ActiveGroupId"))
        {
            await transaction.RollbackAsync(CancellationToken.None);
            Reset();
            return RegisterOutcome.GroupHasTopic;
        }
    }

    public async Task<bool> CancelAsync(Guid topicId, Guid groupId, Guid actorId, DateTime now, TopicHistoryEntry history,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        var released = await context.ThesisTopics
            .Where(t => t.Id == topicId && t.GroupId == groupId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.GroupId, (Guid?)null)
                .SetProperty(t => t.Status, TopicStatus.NotRegistered)
                .SetProperty(t => t.UpdatedAt, now), cancellationToken);
        if (released == 0) return false;

        // Lần ghi danh cũ được giữ, chỉ ghi người/thời điểm hủy (PDR-047).
        await context.TopicRegistrations
            .Where(r => r.TopicId == topicId && r.GroupId == groupId && r.CancelledAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.CancelledAt, now).SetProperty(r => r.CancelledById, actorId), cancellationToken);
        context.TopicHistoryEntries.Add(history);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    private void Reset() => context.ChangeTracker.Clear();

    // PostgreSQL trả tên ràng buộc; SQLite (test) chỉ nêu cột nên so thêm theo tên cột.
    private static bool UniqueViolation(DbUpdateException ex, string index)
    {
        var message = ex.InnerException?.Message ?? string.Empty;
        if (ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation } pg)
            return pg.ConstraintName == index;
        return index switch
        {
            "IX_GroupMembers_RoundId_StudentId" => message.Contains("GroupMembers.RoundId"),
            _ => message.Contains("ThesisTopics.GroupId")
        };
    }
}
