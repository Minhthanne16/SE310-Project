using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

// Kết quả một thao tác ghi hội đồng; các trường hợp thua tranh chấp được phân loại sau câu cập nhật có điều kiện.
public enum CouncilWriteOutcome
{
    Done,
    // Đã ở trạng thái đích (công bố lặp): không ghi gì, không thông báo.
    Unchanged,
    // Version khác giá trị máy khách đang thấy: người khác vừa sửa.
    Changed,
    // Hội đồng đã có phiếu điểm (PDR-018/019/020).
    Scored,
    // Trạng thái hiện tại không cho thao tác (ví dụ sửa hội đồng đã hủy, xóa hội đồng đã công bố).
    WrongStatus,
    // Một đề tài vừa được xếp vào hội đồng khác (chỉ mục duy nhất lượt có hiệu lực, PDR-016).
    TopicTaken,
    NotFound
}

public sealed record CouncilSlotPlan(Guid TopicId, int Order, TimeOnly Start, TimeOnly End);

// Giá trị mới của hội đồng khi sửa; ghi cùng một transaction với lịch sử và thông báo.
public sealed record CouncilChange(
    Guid CouncilId,
    int ExpectedVersion,
    string Name,
    Guid ChairId,
    Guid SecretaryId,
    DateOnly Date,
    string Room,
    IReadOnlyList<CouncilSlotPlan> Slots,
    DateTime Now,
    DefenseCouncilLog Log,
    IReadOnlyList<TopicHistoryEntry> History,
    IReadOnlyList<Notification> Notifications);

public interface ICouncilRepository
{
    // Chạy work trong một transaction. Trên PostgreSQL giữ khóa advisory chung cho mọi thao tác ghi lịch bảo vệ nên
    // kiểm tra trùng phòng/giảng viên (PDR-014/015) và ghi diễn ra tuần tự khi nhiều Giáo vụ thao tác cùng lúc.
    // Commit chỉ khi work trả Commit = true.
    Task<T> RunExclusiveAsync<T>(Func<CancellationToken, Task<(bool Commit, T Result)>> work, CancellationToken cancellationToken = default);

    // Hội đồng của đợt kèm Chủ tịch, Thư ký và mọi lượt (kể cả đã bỏ/hủy), không theo dõi thay đổi.
    Task<IReadOnlyList<DefenseCouncil>> ListByRoundAsync(Guid roundId, CancellationToken cancellationToken = default);
    Task<DefenseCouncil?> GetAsync(Guid id, CancellationToken cancellationToken = default);
    // Hội đồng chưa hủy của mọi đợt có ngày bảo vệ trong danh sách, chỉ kèm lượt có hiệu lực (để kiểm trùng).
    Task<IReadOnlyList<DefenseCouncil>> ListActiveOnDatesAsync(IReadOnlyCollection<DateOnly> dates, CancellationToken cancellationToken = default);
    // Hội đồng đã công bố hoặc đã hủy mà giảng viên là Chủ tịch/Thư ký (hội đồng Nháp chỉ Giáo vụ thấy).
    Task<IReadOnlyList<DefenseCouncil>> ListVisibleByMemberAsync(Guid lecturerId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DefenseCouncilLog>> ListLogsAsync(IReadOnlyCollection<Guid> councilIds, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<User>> GetUsersAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);
    // Số phiên bản bản khóa luận theo đề tài và đề tài đã chốt bản cuối.
    Task<IReadOnlyDictionary<Guid, int>> GetThesisCountsAsync(IReadOnlyCollection<Guid> topicIds, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<Guid, string>> GetRoundNamesAsync(IReadOnlyCollection<Guid> roundIds, CancellationToken cancellationToken = default);

    // Các thao tác ghi dưới đây phải chạy trong RunExclusiveAsync.
    Task<CouncilWriteOutcome> AddAsync(DefenseCouncil council, DefenseCouncilLog log, CancellationToken cancellationToken = default);
    // Cập nhật có điều kiện (Version đúng, chưa có điểm, chưa hủy). keepRemovedSlots = true với hội đồng đã công bố:
    // lượt bị bỏ chuyển Removed thay vì xóa để còn tra cứu.
    Task<CouncilWriteOutcome> UpdateAsync(CouncilChange change, bool keepRemovedSlots, CancellationToken cancellationToken = default);
    Task<CouncilWriteOutcome> DeleteDraftAsync(Guid councilId, CancellationToken cancellationToken = default);
    Task<CouncilWriteOutcome> PublishAsync(Guid councilId, Guid actorId, DateTime now, DefenseCouncilLog log,
        IReadOnlyList<TopicHistoryEntry> history, IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default);
    Task<CouncilWriteOutcome> CancelAsync(Guid councilId, Guid actorId, DateTime now, string reason, DefenseCouncilLog log,
        IReadOnlyList<TopicHistoryEntry> history, IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default);
    // Đính chính: chỉ thêm lịch sử và thông báo, không đổi lịch gốc (PDR-018).
    Task AddCorrectionAsync(DefenseCouncilLog log, IReadOnlyList<TopicHistoryEntry> history, IReadOnlyList<Notification> notifications,
        CancellationToken cancellationToken = default);
}
