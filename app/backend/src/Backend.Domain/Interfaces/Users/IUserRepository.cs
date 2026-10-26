using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);
    Task<IReadOnlySet<string>> GetExistingUserCodesAsync(IReadOnlyCollection<string> userCodes, CancellationToken cancellationToken = default);
    Task<IReadOnlySet<string>> GetExistingEmailsAsync(IReadOnlyCollection<string> normalizedEmails, CancellationToken cancellationToken = default);
    // Thêm toàn bộ trong một lần lưu (một transaction). Ném DuplicateUserException khi vi phạm mã/email duy nhất.
    Task AddRangeAsync(IReadOnlyCollection<User> users, CancellationToken cancellationToken = default);
    Task UpdateAsync(User user, CancellationToken cancellationToken = default);
}

public sealed class DuplicateUserException(Exception? inner = null)
    : Exception("A user with the same code or email already exists.", inner);
