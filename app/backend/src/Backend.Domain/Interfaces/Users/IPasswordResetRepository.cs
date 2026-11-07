using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface IPasswordResetRepository
{
    // Kiểm tra giới hạn rồi ghi yêu cầu như một thao tác nguyên tử: các yêu cầu đồng thời
    // không được cùng lọt qua ngưỡng. Trả false (và không ghi) khi vượt giới hạn.
    Task<bool> TryRecordRequestAsync(PasswordResetRequest request, PasswordResetLimits limits, CancellationToken cancellationToken = default);
    Task AddTokenAsync(PasswordResetToken token, CancellationToken cancellationToken = default);
    Task<PasswordResetToken?> GetTokenAsync(string tokenHash, CancellationToken cancellationToken = default);
    // Đánh dấu token đã dùng (chỉ khi chưa dùng), hủy mọi token còn lại của người dùng,
    // lưu mật khẩu mới và lịch sử trong cùng một transaction. Trả false nếu token vừa được dùng.
    Task<bool> CompleteResetAsync(User user, PasswordResetToken token, UserAuditEntry audit, DateTime now, CancellationToken cancellationToken = default);
}
