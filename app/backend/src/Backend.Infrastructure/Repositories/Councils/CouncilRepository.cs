using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Infrastructure.Repositories.Councils;

public class CouncilRepository(ApplicationDbContext context) : ICouncilRepository
{
    // Khóa advisory chung cho mọi thao tác ghi lịch bảo vệ: trùng phòng/giảng viên xét trên mọi hội đồng cùng ngày nên
    // kiểm tra rồi ghi phải tuần tự (PDR-014/015/018). Lưu lượng thao tác của Giáo vụ nhỏ nên một khóa là đủ.
    private const long ScheduleLockKey = 0x51_4C_4B_4C_44_45_46_53; // "QLKLDEFS"

    public async Task<T> RunExclusiveAsync<T>(Func<CancellationToken, Task<(bool Commit, T Result)>> work,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        if (context.Database.IsNpgsql())
            await context.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({ScheduleLockKey})", cancellationToken);
        var (commit, result) = await work(cancellationToken);
        if (commit) await transaction.CommitAsync(cancellationToken);
        else await transaction.RollbackAsync(CancellationToken.None);
        return result;
    }

    private IQueryable<DefenseCouncil> WithPeople() =>
        context.DefenseCouncils.AsNoTracking().Include(c => c.Chair).Include(c => c.Secretary).Include(c => c.Slots).AsSplitQuery();

    public async Task<IReadOnlyList<DefenseCouncil>> ListByRoundAsync(Guid roundId, CancellationToken cancellationToken = default) =>
        await WithPeople().Where(c => c.RoundId == roundId).OrderBy(c => c.DefenseDate).ThenBy(c => c.CreatedAt).ToListAsync(cancellationToken);

    public Task<DefenseCouncil?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        WithPeople().FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<IReadOnlyList<DefenseCouncil>> ListActiveOnDatesAsync(IReadOnlyCollection<DateOnly> dates,
        CancellationToken cancellationToken = default)
    {
        if (dates.Count == 0) return [];
        var councils = await context.DefenseCouncils.AsNoTracking().Include(c => c.Chair).Include(c => c.Secretary)
            .Include(c => c.Slots.Where(s => s.Status == DefenseSlotStatus.Active)).AsSplitQuery()
            .Where(c => dates.Contains(c.DefenseDate) && c.Status != CouncilStatus.Cancelled)
            .ToListAsync(cancellationToken);
        return councils;
    }

    public async Task<IReadOnlyList<DefenseCouncil>> ListVisibleByMemberAsync(Guid lecturerId, CancellationToken cancellationToken = default) =>
        await WithPeople()
            .Where(c => c.Status != CouncilStatus.Draft && (c.ChairId == lecturerId || c.SecretaryId == lecturerId))
            .OrderBy(c => c.DefenseDate).ThenBy(c => c.CreatedAt).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<DefenseCouncilLog>> ListLogsAsync(IReadOnlyCollection<Guid> councilIds,
        CancellationToken cancellationToken = default) =>
        councilIds.Count == 0 ? [] : await context.DefenseCouncilLogs.AsNoTracking()
            .Where(l => councilIds.Contains(l.CouncilId)).OrderByDescending(l => l.CreatedAt).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<User>> GetUsersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default) =>
        userIds.Count == 0 ? [] : await context.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, int>> GetThesisCountsAsync(IReadOnlyCollection<Guid> topicIds,
        CancellationToken cancellationToken = default)
    {
        if (topicIds.Count == 0) return new Dictionary<Guid, int>();
        var counts = await context.TopicSubmissions.AsNoTracking()
            .Where(s => topicIds.Contains(s.TopicId) && s.Kind == SubmissionKind.Thesis)
            .GroupBy(s => s.TopicId).Select(g => new { TopicId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        return counts.ToDictionary(c => c.TopicId, c => c.Count);
    }

    public async Task<IReadOnlyDictionary<Guid, string>> GetRoundNamesAsync(IReadOnlyCollection<Guid> roundIds,
        CancellationToken cancellationToken = default) =>
        roundIds.Count == 0 ? new Dictionary<Guid, string>() : await context.ThesisRounds.AsNoTracking()
            .Where(r => roundIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Name, cancellationToken);

    public async Task<CouncilWriteOutcome> AddAsync(DefenseCouncil council, DefenseCouncilLog log, CancellationToken cancellationToken = default)
    {
        context.DefenseCouncils.Add(council);
        context.DefenseCouncilLogs.Add(log);
        return await SaveAsync(cancellationToken);
    }

    public async Task<CouncilWriteOutcome> UpdateAsync(CouncilChange change, bool keepRemovedSlots, CancellationToken cancellationToken = default)
    {
        var normalizedRoom = DefenseCouncil.NormalizeRoom(change.Room);
        // Mọi điều kiện kiểm lại ngay trong câu cập nhật một dòng: phiếu điểm đầu tiên (P07) chạy song song chỉ một bên thắng.
        var updated = await context.DefenseCouncils
            .Where(c => c.Id == change.CouncilId && c.Version == change.ExpectedVersion
                && c.FirstScoredAt == null && c.Status != CouncilStatus.Cancelled)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Name, change.Name)
                .SetProperty(c => c.ChairId, change.ChairId)
                .SetProperty(c => c.SecretaryId, change.SecretaryId)
                .SetProperty(c => c.DefenseDate, change.Date)
                .SetProperty(c => c.Room, change.Room)
                .SetProperty(c => c.NormalizedRoom, normalizedRoom)
                .SetProperty(c => c.Version, c => c.Version + 1)
                .SetProperty(c => c.UpdatedAt, change.Now), cancellationToken);
        if (updated == 0) return await ClassifyAsync(change.CouncilId, change.ExpectedVersion, cancellationToken);

        var existing = await context.DefenseSlots
            .Where(s => s.CouncilId == change.CouncilId && s.Status == DefenseSlotStatus.Active).ToListAsync(cancellationToken);
        var planned = change.Slots.ToDictionary(p => p.TopicId);
        foreach (var slot in existing.Where(s => !planned.ContainsKey(s.TopicId)))
        {
            if (keepRemovedSlots)
            {
                slot.Status = DefenseSlotStatus.Removed;
                slot.UpdatedAt = change.Now;
            }
            else context.DefenseSlots.Remove(slot);
        }
        var byTopic = existing.ToDictionary(s => s.TopicId);
        foreach (var plan in change.Slots)
        {
            if (byTopic.TryGetValue(plan.TopicId, out var slot))
            {
                if (slot.Order == plan.Order && slot.StartTime == plan.Start && slot.EndTime == plan.End) continue;
                slot.Order = plan.Order;
                slot.StartTime = plan.Start;
                slot.EndTime = plan.End;
                slot.UpdatedAt = change.Now;
            }
            else
            {
                context.DefenseSlots.Add(new DefenseSlot
                {
                    CouncilId = change.CouncilId, TopicId = plan.TopicId, Order = plan.Order,
                    StartTime = plan.Start, EndTime = plan.End, CreatedAt = change.Now
                });
            }
        }
        context.DefenseCouncilLogs.Add(change.Log);
        context.TopicHistoryEntries.AddRange(change.History);
        context.Notifications.AddRange(change.Notifications);
        return await SaveAsync(cancellationToken);
    }

    public async Task<CouncilWriteOutcome> DeleteDraftAsync(Guid councilId, CancellationToken cancellationToken = default)
    {
        // Lượt và lịch sử của hội đồng Nháp bị xóa theo (cascade). Hội đồng đã công bố không xóa vật lý (PDR-019).
        var deleted = await context.DefenseCouncils.Where(c => c.Id == councilId && c.Status == CouncilStatus.Draft)
            .ExecuteDeleteAsync(cancellationToken);
        if (deleted > 0) return CouncilWriteOutcome.Done;
        return await context.DefenseCouncils.AnyAsync(c => c.Id == councilId, cancellationToken)
            ? CouncilWriteOutcome.WrongStatus : CouncilWriteOutcome.NotFound;
    }

    public async Task<CouncilWriteOutcome> PublishAsync(Guid councilId, Guid actorId, DateTime now, DefenseCouncilLog log,
        IReadOnlyList<TopicHistoryEntry> history, IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default)
    {
        var updated = await context.DefenseCouncils
            .Where(c => c.Id == councilId && c.Status == CouncilStatus.Draft)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, CouncilStatus.Published)
                .SetProperty(c => c.PublishedAt, now)
                .SetProperty(c => c.PublishedById, actorId)
                .SetProperty(c => c.Version, c => c.Version + 1)
                .SetProperty(c => c.UpdatedAt, now), cancellationToken);
        if (updated == 0)
        {
            var status = await context.DefenseCouncils.Where(c => c.Id == councilId).Select(c => (CouncilStatus?)c.Status)
                .FirstOrDefaultAsync(cancellationToken);
            // Công bố lặp: không tạo thêm lịch sử hay thông báo.
            return status switch
            {
                null => CouncilWriteOutcome.NotFound,
                CouncilStatus.Published => CouncilWriteOutcome.Unchanged,
                _ => CouncilWriteOutcome.WrongStatus
            };
        }
        context.DefenseCouncilLogs.Add(log);
        context.TopicHistoryEntries.AddRange(history);
        context.Notifications.AddRange(notifications);
        return await SaveAsync(cancellationToken);
    }

    public async Task<CouncilWriteOutcome> CancelAsync(Guid councilId, Guid actorId, DateTime now, string reason, DefenseCouncilLog log,
        IReadOnlyList<TopicHistoryEntry> history, IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default)
    {
        var updated = await context.DefenseCouncils
            .Where(c => c.Id == councilId && c.Status == CouncilStatus.Published && c.FirstScoredAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, CouncilStatus.Cancelled)
                .SetProperty(c => c.CancelledAt, now)
                .SetProperty(c => c.CancelledById, actorId)
                .SetProperty(c => c.CancelReason, reason)
                .SetProperty(c => c.Version, c => c.Version + 1)
                .SetProperty(c => c.UpdatedAt, now), cancellationToken);
        if (updated == 0)
        {
            var council = await context.DefenseCouncils.AsNoTracking().Where(c => c.Id == councilId)
                .Select(c => new { c.Status, c.FirstScoredAt }).FirstOrDefaultAsync(cancellationToken);
            if (council is null) return CouncilWriteOutcome.NotFound;
            return council.FirstScoredAt is not null && council.Status == CouncilStatus.Published
                ? CouncilWriteOutcome.Scored : CouncilWriteOutcome.WrongStatus;
        }
        // Lượt của lịch đã hủy không còn hiệu lực nhưng vẫn giữ để tra cứu (PDR-019).
        await context.DefenseSlots.Where(s => s.CouncilId == councilId && s.Status == DefenseSlotStatus.Active)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, DefenseSlotStatus.Cancelled).SetProperty(x => x.UpdatedAt, now),
                cancellationToken);
        context.DefenseCouncilLogs.Add(log);
        context.TopicHistoryEntries.AddRange(history);
        context.Notifications.AddRange(notifications);
        return await SaveAsync(cancellationToken);
    }

    public async Task AddCorrectionAsync(DefenseCouncilLog log, IReadOnlyList<TopicHistoryEntry> history,
        IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default)
    {
        context.DefenseCouncilLogs.Add(log);
        context.TopicHistoryEntries.AddRange(history);
        context.Notifications.AddRange(notifications);
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task<CouncilWriteOutcome> ClassifyAsync(Guid councilId, int expectedVersion, CancellationToken cancellationToken)
    {
        var council = await context.DefenseCouncils.AsNoTracking().Where(c => c.Id == councilId)
            .Select(c => new { c.Version, c.FirstScoredAt, c.Status }).FirstOrDefaultAsync(cancellationToken);
        if (council is null) return CouncilWriteOutcome.NotFound;
        if (council.Status == CouncilStatus.Cancelled) return CouncilWriteOutcome.WrongStatus;
        if (council.FirstScoredAt is not null) return CouncilWriteOutcome.Scored;
        return council.Version != expectedVersion ? CouncilWriteOutcome.Changed : CouncilWriteOutcome.WrongStatus;
    }

    private async Task<CouncilWriteOutcome> SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken);
            return CouncilWriteOutcome.Done;
        }
        catch (DbUpdateException ex) when (IsActiveTopicViolation(ex))
        {
            context.ChangeTracker.Clear();
            return CouncilWriteOutcome.TopicTaken;
        }
    }

    // Chỉ mục duy nhất lượt có hiệu lực (PDR-016). SQLite dùng trong test không có tên ràng buộc trong lỗi.
    private static bool IsActiveTopicViolation(DbUpdateException ex) => ex.InnerException switch
    {
        PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg => pg.ConstraintName == "IX_DefenseSlots_ActiveTopic",
        { } inner => inner.Message.Contains("UNIQUE constraint failed: DefenseSlots.TopicId", StringComparison.Ordinal),
        _ => false
    };
}
