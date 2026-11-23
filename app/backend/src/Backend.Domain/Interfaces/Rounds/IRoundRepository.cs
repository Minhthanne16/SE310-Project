using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

// Sinh viên đang thuộc một đợt Đang diễn ra khác (PDR-029).
public sealed record RoundConflict(Guid UserId, string UserCode, string UserName, Guid RoundId, string RoundName);
public sealed record OpenRoundOutcome(bool Opened, IReadOnlyList<RoundConflict> Conflicts);
public sealed record FinishRoundOutcome(bool Finished, IReadOnlyList<string> PendingTopics);
public sealed record AddParticipantsOutcome(IReadOnlyList<RoundParticipant> Added, IReadOnlyList<RoundConflict> Conflicts,
    IReadOnlySet<Guid> ExistingIds, bool Finished);

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
    Task SaveAsync(CancellationToken cancellationToken = default);
    void AuditMilestones(Guid roundId, Guid? actorId, DateTime now, string details);
    Task<OpenRoundOutcome> OpenAsync(ThesisRound round, DateTime now, Guid? actorId,
        Func<IReadOnlyList<RoundParticipant>, IReadOnlyList<Notification>> notifications,
        CancellationToken cancellationToken = default);
    Task<FinishRoundOutcome> FinishAsync(Guid roundId, DateTime now, Guid? actorId,
        Func<ThesisRound, IReadOnlyList<string>> pendingTopics, CancellationToken cancellationToken = default);
    // Xóa đợt cùng mốc và người tham gia.
    Task DeleteAsync(ThesisRound round, CancellationToken cancellationToken = default);

    Task<AddParticipantsOutcome> AddParticipantsAsync(IReadOnlyList<RoundParticipant> participants, Guid? actorId, DateTime now, CancellationToken cancellationToken = default);
    // null = đã gỡ; chuỗi = lý do từ chối, kể cả khi dữ liệu vừa thay đổi.
    Task<string?> RemoveParticipantAsync(RoundParticipant participant, Guid? actorId, DateTime now, CancellationToken cancellationToken = default);
    Task<Dictionary<Guid, string>> GetRemovalBlockersAsync(Guid roundId, IReadOnlyCollection<RoundParticipant> participants, CancellationToken cancellationToken = default);

    // Người dùng đang hoạt động của vai trò, sắp theo mã.
    Task<IReadOnlyList<User>> GetActiveUsersAsync(UserRole role, CancellationToken cancellationToken = default);
    // Người dùng đang hoạt động khớp mã người dùng hoặc email (không phân biệt hoa thường).
    Task<IReadOnlyList<User>> GetActiveUsersByCodesOrEmailsAsync(UserRole role, IReadOnlyCollection<string> codes, CancellationToken cancellationToken = default);
    // Trong các sinh viên đã cho, những ai đang ở đợt Đang diễn ra khác đợt exceptRoundId.
    Task<IReadOnlyList<RoundConflict>> FindRunningRoundConflictsAsync(Guid exceptRoundId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken = default);

    // PDR-065, PDR-069, OQ-033(e): Mặc định cấu hình theo chương trình.
    Task<ProgramRoundDefaults?> GetProgramDefaultsAsync(string program, CancellationToken cancellationToken = default);
    Task SaveProgramDefaultsAsync(ProgramRoundDefaults defaults, CancellationToken cancellationToken = default);
}

public sealed class DuplicateRoundNameException(Exception? inner = null)
    : Exception("A thesis round with the same name already exists.", inner);
