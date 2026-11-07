using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Infrastructure.Repositories.Users;

public class UserRepository : IUserRepository
{
    private readonly ApplicationDbContext _context;

    public UserRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Users.FindAsync([id], cancellationToken);
    }

    public async Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default)
    {
        return await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
    }

    public async Task<IReadOnlyList<User>> ListAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Users.AsNoTracking().OrderBy(u => u.UserCode).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlySet<Guid>> GetUserIdsWithRelatedDataAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default)
    {
        // Đề tài, phiếu điểm... chưa được xây; khi thêm bảng đó, bổ sung truy vấn tại đây.
        var recipients = await _context.Notifications
            .Where(n => userIds.Contains(n.RecipientUserId))
            .Select(n => n.RecipientUserId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var senders = await _context.Notifications
            .Where(n => n.SenderUserId != null && userIds.Contains(n.SenderUserId.Value))
            .Select(n => n.SenderUserId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);
        return recipients.Concat(senders).ToHashSet();
    }

    public async Task<IReadOnlySet<string>> GetExistingUserCodesAsync(IReadOnlyCollection<string> userCodes, CancellationToken cancellationToken = default)
    {
        if (userCodes.Count == 0) return new HashSet<string>();
        return (await _context.Users
            .Where(u => userCodes.Contains(u.UserCode))
            .Select(u => u.UserCode)
            .ToListAsync(cancellationToken)).ToHashSet();
    }

    public async Task<IReadOnlySet<string>> GetExistingEmailsAsync(IReadOnlyCollection<string> normalizedEmails, CancellationToken cancellationToken = default)
    {
        if (normalizedEmails.Count == 0) return new HashSet<string>();
        return (await _context.Users
            .Where(u => normalizedEmails.Contains(u.Email))
            .Select(u => u.Email)
            .ToListAsync(cancellationToken)).ToHashSet();
    }

    public async Task AddRangeAsync(IReadOnlyCollection<User> users, IReadOnlyCollection<UserAuditEntry> audits, CancellationToken cancellationToken = default)
    {
        await _context.Users.AddRangeAsync(users, cancellationToken);
        await _context.UserAuditEntries.AddRangeAsync(audits, cancellationToken);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Một yêu cầu khác vừa tạo trùng mã/email sau bước kiểm tra; không lưu dòng nào.
            _context.ChangeTracker.Clear();
            throw new DuplicateUserException(ex);
        }
    }

    public async Task UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        _context.Users.Update(user);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default)
    {
        _context.Users.Add(user);
        _context.UserAuditEntries.Add(audit);
        await SaveCheckingDuplicatesAsync(cancellationToken);
    }

    public async Task UpdateAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default)
    {
        _context.Users.Update(user);
        _context.UserAuditEntries.Add(audit);
        await SaveCheckingDuplicatesAsync(cancellationToken);
    }

    public async Task DeleteAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default)
    {
        _context.Users.Remove(user);
        _context.UserAuditEntries.Add(audit);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UserAuditEntry>> GetAuditAsync(Guid targetUserId, CancellationToken cancellationToken = default)
    {
        return await _context.UserAuditEntries.AsNoTracking()
            .Where(a => a.TargetUserId == targetUserId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, string>> GetFullNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default)
    {
        if (userIds.Count == 0) return new Dictionary<Guid, string>();
        var ids = userIds.Distinct().ToList();
        return await _context.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);
    }

    private async Task SaveCheckingDuplicatesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Một yêu cầu khác vừa dùng mã/email này sau bước kiểm tra; không lưu gì.
            _context.ChangeTracker.Clear();
            throw new DuplicateUserException(ex);
        }
    }
}
