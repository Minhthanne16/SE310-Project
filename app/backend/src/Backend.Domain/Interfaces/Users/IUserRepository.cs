using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<User>> ListAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlySet<string>> GetExistingUserCodesAsync(IReadOnlyCollection<string> userCodes, CancellationToken cancellationToken = default);
    Task<IReadOnlySet<string>> GetExistingEmailsAsync(IReadOnlyCollection<string> normalizedEmails, CancellationToken cancellationToken = default);
    // Tài khoản có bản ghi nghiệp vụ tham chiếu tới (đơn đăng ký, đề tài, phân công,
    // phiếu điểm, thông báo...) chỉ được vô hiệu hóa, không xóa (BUSINESS_RULES).
    Task<IReadOnlySet<Guid>> GetUserIdsWithRelatedDataAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
    // Thêm toàn bộ trong một lần lưu (một transaction). Ném DuplicateUserException khi vi phạm mã/email duy nhất.
    Task AddRangeAsync(IReadOnlyCollection<User> users, CancellationToken cancellationToken = default);
    Task UpdateAsync(User user, CancellationToken cancellationToken = default);
    // Các thao tác quản trị lưu thay đổi và lịch sử trong cùng một transaction.
    // Add/Update ném DuplicateUserException khi vi phạm mã/email duy nhất.
    Task AddAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default);
    Task UpdateAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default);
    Task DeleteAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default);
}

public sealed class DuplicateUserException(Exception? inner = null)
    : Exception("A user with the same code or email already exists.", inner);
