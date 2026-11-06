using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Infrastructure.Repositories.Rounds;

public class RoundRepository(ApplicationDbContext context) : IRoundRepository
{
    private IQueryable<ThesisRound> WithChildren() =>
        context.ThesisRounds.Include(r => r.Milestones).Include(r => r.Participants).AsSplitQuery();

    public async Task<IReadOnlyList<ThesisRound>> ListAsync(RoundStatus? status, string? program, string? normalizedSearch, CancellationToken cancellationToken = default)
    {
        var query = WithChildren().AsNoTracking();
        if (status is { } s) query = query.Where(r => r.Status == s);
        if (!string.IsNullOrEmpty(program)) query = query.Where(r => r.Program == program);
        if (!string.IsNullOrEmpty(normalizedSearch)) query = query.Where(r => r.NormalizedName.Contains(normalizedSearch));
        return await query.OrderByDescending(r => r.CreatedAt).ToListAsync(cancellationToken);
    }

    public Task<ThesisRound?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        WithChildren().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public Task<bool> NameExistsAsync(string normalizedName, Guid? exceptId, CancellationToken cancellationToken = default)
    {
        var query = context.ThesisRounds.Where(r => r.NormalizedName == normalizedName);
        if (exceptId is { } id) query = query.Where(r => r.Id != id);
        return query.AnyAsync(cancellationToken);
    }

    public async Task AddAsync(ThesisRound round, CancellationToken cancellationToken = default)
    {
        context.ThesisRounds.Add(round);
        await SaveAsync(cancellationToken);
    }

    public void AddNotifications(IEnumerable<Notification> notifications) => context.Notifications.AddRange(notifications);

    public async Task SaveAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsDuplicateName(ex))
        {
            // Một yêu cầu khác vừa tạo trùng tên đợt sau bước kiểm tra.
            context.ChangeTracker.Clear();
            throw new DuplicateRoundNameException(ex);
        }
    }

    public async Task DeleteAsync(ThesisRound round, CancellationToken cancellationToken = default)
    {
        context.ThesisRounds.Remove(round);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddParticipantsAsync(IReadOnlyList<RoundParticipant> participants, CancellationToken cancellationToken = default)
    {
        // Thêm tường minh: khóa Guid đã có giá trị nên EF không tự coi là bản ghi mới.
        context.RoundParticipants.AddRange(participants);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveParticipantAsync(RoundParticipant participant, CancellationToken cancellationToken = default)
    {
        context.RoundParticipants.Remove(participant);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<User>> GetActiveUsersAsync(UserRole role, CancellationToken cancellationToken = default) =>
        await context.Users.AsNoTracking().Where(u => u.Role == role && u.IsActive)
            .OrderBy(u => u.UserCode).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<User>> GetActiveUsersByCodesOrEmailsAsync(UserRole role, IReadOnlyCollection<string> codes, CancellationToken cancellationToken = default)
    {
        var lowered = codes.Select(c => c.ToLowerInvariant()).ToList();
        return await context.Users.AsNoTracking()
            .Where(u => u.Role == role && u.IsActive && (lowered.Contains(u.UserCode.ToLower()) || lowered.Contains(u.Email.ToLower())))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<RoundConflict>> FindRunningRoundConflictsAsync(Guid exceptRoundId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken = default)
    {
        if (studentIds.Count == 0) return [];
        return await context.RoundParticipants.AsNoTracking()
            .Where(p => p.Kind == ParticipantKind.Student && studentIds.Contains(p.UserId)
                && p.RoundId != exceptRoundId && p.Round!.Status == RoundStatus.Running)
            .OrderBy(p => p.User!.UserCode)
            .Select(p => new RoundConflict(p.UserId, p.User!.UserCode, p.User.FullName, p.RoundId, p.Round!.Name))
            .ToListAsync(cancellationToken);
    }

    private static bool IsDuplicateName(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: { } name }
        && name.Contains("NormalizedName", StringComparison.Ordinal);
}
