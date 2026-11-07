using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Repositories.Users;

public class PasswordResetRepository(ApplicationDbContext context) : IPasswordResetRepository
{
    // Khóa advisory dùng chung cho mọi yêu cầu quên mật khẩu: đếm và ghi được tuần tự hóa
    // nên các yêu cầu đồng thời không cùng lọt qua ngưỡng PDR-044. Lưu lượng nhỏ nên một khóa là đủ.
    private const long RequestLockKey = 0x51_4C_4B_4C_54_4E_50_52; // "QLKLTNPR"

    public async Task<bool> TryRecordRequestAsync(PasswordResetRequest request, PasswordResetLimits limits, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        if (context.Database.IsNpgsql())
            await context.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({RequestLockKey})", cancellationToken);

        var since = request.CreatedAt - limits.Window;
        // Bản ghi ngoài cửa sổ không còn tác dụng đếm.
        await context.PasswordResetRequests.Where(r => r.CreatedAt <= since).ExecuteDeleteAsync(cancellationToken);

        var byEmail = await context.PasswordResetRequests.AsNoTracking()
            .Where(r => r.EmailHash == request.EmailHash && r.CreatedAt > since)
            .Select(r => r.CreatedAt)
            .ToListAsync(cancellationToken);
        if (byEmail.Count >= limits.MaxPerEmail || byEmail.Any(at => request.CreatedAt - at < limits.EmailCooldown))
            return false;
        var bySource = await context.PasswordResetRequests
            .CountAsync(r => r.Source == request.Source && r.CreatedAt > since, cancellationToken);
        if (bySource >= limits.MaxPerSource)
            return false;

        context.PasswordResetRequests.Add(request);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task AddTokenAsync(PasswordResetToken token, CancellationToken cancellationToken = default)
    {
        context.PasswordResetTokens.Add(token);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<PasswordResetToken?> GetTokenAsync(string tokenHash, CancellationToken cancellationToken = default)
    {
        return await context.PasswordResetTokens.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);
    }

    public async Task<bool> CompleteResetAsync(User user, PasswordResetToken token, UserAuditEntry audit, DateTime now, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        // Cập nhật có điều kiện: request thứ hai dùng cùng liên kết chờ khóa dòng rồi thấy 0 dòng.
        var claimed = await context.PasswordResetTokens
            .Where(t => t.Id == token.Id && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), cancellationToken);
        if (claimed == 0) return false;

        // Liên kết khác còn hạn của cùng tài khoản cũng không dùng được nữa.
        await context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), cancellationToken);

        context.Users.Update(user);
        context.UserAuditEntries.Add(audit);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }
}
