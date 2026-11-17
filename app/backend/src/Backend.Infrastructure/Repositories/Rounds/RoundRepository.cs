using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Infrastructure.Repositories.Rounds;

public class RoundRepository(ApplicationDbContext context) : IRoundRepository
{
    private IQueryable<ThesisRound> WithChildren() =>
        context.ThesisRounds.Include(r => r.Milestones).Include(r => r.Participants).ThenInclude(p => p.User).Include(r => r.Topics).Include(r => r.GroupMembers).AsSplitQuery();

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

    // shortcut: một khóa cho mọi đợt; chuyển sang khóa theo sinh viên nếu nhập danh sách gây nghẽn.
    private async Task LockParticipationAsync(CancellationToken cancellationToken)
    {
        if (context.Database.IsNpgsql())
            await context.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(73100029)", cancellationToken);
    }

    private void Audit(Guid roundId, Guid? actorId, string action, DateTime now, Guid? target = null, string? details = null) =>
        context.RoundAuditEntries.Add(new RoundAuditEntry
        {
            RoundId = roundId, ActorUserId = actorId, Action = action, TargetUserId = target, Details = details, CreatedAt = now
        });

    public void AuditMilestones(Guid roundId, Guid? actorId, DateTime now, string details) =>
        Audit(roundId, actorId, "MilestonesUpdated", now, details: details);

    public async Task<OpenRoundOutcome> OpenAsync(ThesisRound round, DateTime now, Guid? actorId,
        Func<IReadOnlyList<RoundParticipant>, IReadOnlyList<Notification>> notifications, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await LockParticipationAsync(cancellationToken);
        if (await context.ThesisRounds.AsNoTracking().Where(r => r.Id == round.Id)
            .Select(r => r.Status).SingleAsync(cancellationToken) != RoundStatus.Draft)
            return new(false, []);
        round.Participants = await context.RoundParticipants.Where(p => p.RoundId == round.Id).ToListAsync(cancellationToken);
        var conflicts = await FindRunningRoundConflictsAsync(round.Id,
            round.Participants.Where(p => p.Kind == ParticipantKind.Student).Select(p => p.UserId).ToList(), cancellationToken);
        if (conflicts.Count > 0) return new(false, conflicts);
        round.Status = RoundStatus.Running;
        round.OpenedAt = now;
        round.UpdatedAt = now;
        context.Notifications.AddRange(notifications(round.Participants));
        Audit(round.Id, actorId, "Opened", now);
        await SaveAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(true, []);
    }

    public async Task<FinishRoundOutcome> FinishAsync(Guid roundId, DateTime now, Guid? actorId,
        Func<ThesisRound, IReadOnlyList<string>> pendingTopics, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await LockParticipationAsync(cancellationToken);
        var current = await WithChildren().AsNoTracking().SingleAsync(r => r.Id == roundId, cancellationToken);
        if (current.Status != RoundStatus.Running) return new(false, []);
        var pending = pendingTopics(current);
        if (pending.Count > 0) return new(false, pending);
        var changed = await context.ThesisRounds.Where(r => r.Id == roundId && r.Status == RoundStatus.Running)
            .ExecuteUpdateAsync(setters => setters.SetProperty(r => r.Status, RoundStatus.Finished)
                .SetProperty(r => r.FinishedAt, now).SetProperty(r => r.UpdatedAt, now), cancellationToken);
        if (changed != 1) return new(false, []);
        Audit(roundId, actorId, "Finished", now);
        await SaveAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(true, []);
    }

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

    public async Task<AddParticipantsOutcome> AddParticipantsAsync(IReadOnlyList<RoundParticipant> participants, Guid? actorId, DateTime now, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await LockParticipationAsync(cancellationToken);
        var round = await context.ThesisRounds.AsNoTracking().SingleAsync(r => r.Id == participants[0].RoundId, cancellationToken);
        if (round.Status == RoundStatus.Finished) return new([], [], new HashSet<Guid>(), true);
        var conflicts = round.Status == RoundStatus.Running
            ? await FindRunningRoundConflictsAsync(round.Id,
                participants.Where(p => p.Kind == ParticipantKind.Student).Select(p => p.UserId).ToList(), cancellationToken)
            : [];
        var blocked = conflicts.Select(c => c.UserId).ToHashSet();
        var ids = participants.Select(p => p.UserId).ToList();
        var existing = (await context.RoundParticipants.Where(p => p.RoundId == round.Id && ids.Contains(p.UserId))
            .Select(p => p.UserId).ToListAsync(cancellationToken)).ToHashSet();
        var added = participants.Where(p => !blocked.Contains(p.UserId) && !existing.Contains(p.UserId)).ToList();
        context.RoundParticipants.AddRange(added);
        foreach (var participant in added) Audit(round.Id, actorId, "ParticipantAdded", now, participant.UserId);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(added, conflicts, existing, false);
    }

    public async Task<string?> RemoveParticipantAsync(RoundParticipant participant, Guid? actorId, DateTime now, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await LockParticipationAsync(cancellationToken);
        var roundStatus = await context.ThesisRounds.AsNoTracking().Where(r => r.Id == participant.RoundId)
            .Select(r => r.Status).SingleAsync(cancellationToken);
        if (roundStatus == RoundStatus.Finished) return "Đợt đã kết thúc nên không sửa được nữa.";
        if (!await context.RoundParticipants.AnyAsync(p => p.Id == participant.Id, cancellationToken))
            return "Người này không còn trong đợt.";
        var blockers = await GetRemovalBlockersAsync(participant.RoundId, [participant], cancellationToken);
        if (blockers.TryGetValue(participant.UserId, out var blocker)) return blocker;
        context.RoundParticipants.Remove(participant);
        Audit(participant.RoundId, actorId, "ParticipantRemoved", now, participant.UserId);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    public async Task<Dictionary<Guid, string>> GetRemovalBlockersAsync(Guid roundId, IReadOnlyCollection<RoundParticipant> participants, CancellationToken ct = default)
    {
        var ids = participants.Select(p => p.UserId).ToHashSet();
        var studentIds = participants.Where(p => p.Kind == ParticipantKind.Student).Select(p => p.UserId).ToHashSet();
        var blockers = new Dictionary<Guid, string>();
        if (ids.Count == 0) return blockers;

        void Block(Guid? userId, string reason)
        {
            if (userId is { } id && ids.Contains(id)) blockers.TryAdd(id, reason);
        }

        const string groupReason = "Sinh viên đã có bản ghi nhóm trong đợt nên không gỡ được.";
        foreach (var id in await context.GroupMembers.AsNoTracking()
            .Where(m => m.RoundId == roundId && studentIds.Contains(m.StudentId))
            .Select(m => m.StudentId).Distinct().ToListAsync(ct)) Block(id, groupReason);
        foreach (var id in await context.ThesisGroups.AsNoTracking()
            .Where(g => g.RoundId == roundId && studentIds.Contains(g.RepresentativeId))
            .Select(g => g.RepresentativeId).Distinct().ToListAsync(ct)) Block(id, groupReason);

        var topics = await context.ThesisTopics.AsNoTracking().Where(t => t.RoundId == roundId)
            .Select(t => new { t.Title, t.SupervisorId, t.ReviewerId, t.OutlineApprovedById, t.ThesisExtensionGrantedById, t.FinalThesisLockedById, t.IneligibleById })
            .ToListAsync(ct);
        foreach (var topic in topics)
        {
            var reason = $"Người này có dữ liệu ở đề tài “{topic.Title}” nên không gỡ được.";
            Block(topic.SupervisorId, reason);
            Block(topic.ReviewerId, $"Giảng viên đang phản biện đề tài “{topic.Title}” nên không gỡ được khỏi đợt.");
            Block(topic.OutlineApprovedById, reason);
            Block(topic.ThesisExtensionGrantedById, reason);
            Block(topic.FinalThesisLockedById, reason);
            Block(topic.IneligibleById, reason);
        }

        var registrations = await (from r in context.TopicRegistrations.AsNoTracking()
            join t in context.ThesisTopics on r.TopicId equals t.Id
            where t.RoundId == roundId
            select new { t.Title, r.RegisteredById, r.CancelledById }).ToListAsync(ct);
        foreach (var registration in registrations)
        {
            var reason = $"Người này có bản ghi đăng ký đề tài “{registration.Title}” nên không gỡ được.";
            Block(registration.RegisteredById, reason);
            Block(registration.CancelledById, reason);
        }

        var submissions = await (from s in context.TopicSubmissions.AsNoTracking()
            join t in context.ThesisTopics on s.TopicId equals t.Id
            where t.RoundId == roundId
            select new { t.Title, s.SubmittedById, s.ReviewedById }).ToListAsync(ct);
        foreach (var submission in submissions)
        {
            var reason = $"Người này có bài nộp/nhận xét của đề tài “{submission.Title}” nên không gỡ được.";
            Block(submission.SubmittedById, reason);
            Block(submission.ReviewedById, reason);
        }

        var revisions = await (from r in context.RevisionRequests.AsNoTracking()
            join t in context.ThesisTopics on r.TopicId equals t.Id
            where t.RoundId == roundId
            select new { t.Title, r.CreatedById, r.ResolvedById }).ToListAsync(ct);
        foreach (var revision in revisions)
        {
            var reason = $"Người này có yêu cầu chỉnh sửa của đề tài “{revision.Title}” nên không gỡ được.";
            Block(revision.CreatedById, reason);
            Block(revision.ResolvedById, reason);
        }

        var histories = await (from h in context.TopicHistoryEntries.AsNoTracking()
            join t in context.ThesisTopics on h.TopicId equals t.Id
            where t.RoundId == roundId
            select new { t.Title, h.ActorUserId }).ToListAsync(ct);
        foreach (var history in histories)
            Block(history.ActorUserId, $"Người này có lịch sử thao tác đề tài “{history.Title}” nên không gỡ được.");

        return blockers;
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
