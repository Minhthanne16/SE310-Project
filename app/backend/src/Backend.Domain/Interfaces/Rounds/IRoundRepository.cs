using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

// Sinh viên đang thuộc một đợt Đang diễn ra khác (PDR-029).
public sealed record RoundConflict(Guid UserId, string UserCode, string UserName, Guid RoundId, string RoundName);

public interface IRoundRepository
{
    // Đợt kèm mốc và người tham gia, mới nhất trước. Không theo dõi thay đổi.
    Task<IReadOnlyList<ThesisRound>> ListAsync(RoundStatus? status, string? program, string? normalizedSearch, CancellationToken cancellationToken = default);
    // Đợt kèm mốc và người tham gia, có theo dõi thay đổi để sửa rồi gọi SaveAsync.
    Task<ThesisRound?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> NameExistsAsync(string normalizedName, Guid? exceptId, CancellationToken cancellationToken = default);
    // Ném DuplicateRoundNameException khi vi phạm tên đợt duy nhất.
    Task AddAsync(ThesisRound round, CancellationToken cancellationToken = default);
    // Lưu thay đổi của đợt đã nạp bằng GetByIdAsync (một lần lưu). Ném DuplicateRoundNameException khi trùng tên.
    // Ghi cùng lần SaveAsync tiếp theo để thông báo và thay đổi của đợt nằm chung một transaction.
    void AddNotifications(IEnumerable<Notification> notifications);
    Task SaveAsync(CancellationToken cancellationToken = default);
    // Xóa đợt cùng mốc và người tham gia.
    Task DeleteAsync(ThesisRound round, CancellationToken cancellationToken = default);

    Task AddParticipantsAsync(IReadOnlyList<RoundParticipant> participants, CancellationToken cancellationToken = default);
    Task RemoveParticipantAsync(RoundParticipant participant, CancellationToken cancellationToken = default);

    // Người dùng đang hoạt động của vai trò, sắp theo mã.
    Task<IReadOnlyList<User>> GetActiveUsersAsync(UserRole role, CancellationToken cancellationToken = default);
    // Người dùng đang hoạt động khớp mã người dùng hoặc email (không phân biệt hoa thường).
    Task<IReadOnlyList<User>> GetActiveUsersByCodesOrEmailsAsync(UserRole role, IReadOnlyCollection<string> codes, CancellationToken cancellationToken = default);
    // Trong các sinh viên đã cho, những ai đang ở đợt Đang diễn ra khác đợt exceptRoundId.
    Task<IReadOnlyList<RoundConflict>> FindRunningRoundConflictsAsync(Guid exceptRoundId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken = default);
}

public sealed class DuplicateRoundNameException(Exception? inner = null)
    : Exception("A thesis round with the same name already exists.", inner);
