using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Vòng đời hội đồng bảo vệ (P06, PDR-063): Nháp (chỉ Giáo vụ thấy, xóa được) → Đã công bố → Đã hủy (PDR-019).
// Hội đồng đã công bố không xóa vật lý.
public enum CouncilStatus
{
    Draft = 1,
    Published = 2,
    Cancelled = 3
}

// Lượt bảo vệ: Active là lượt có hiệu lực (tối đa một mỗi đề tài, PDR-016). Removed là lượt bị bỏ khỏi hội đồng đã
// công bố, Cancelled là lượt của hội đồng đã hủy; cả hai còn lại để tra cứu lịch sử.
public enum DefenseSlotStatus
{
    Active = 1,
    Removed = 2,
    Cancelled = 3
}

// Hội đồng bảo vệ của một đợt (PDR-014–020, PDR-063): đúng một Chủ tịch và một Thư ký, một ngày và một phòng.
public class DefenseCouncil : BaseEntity
{
    public Guid RoundId { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid ChairId { get; set; }
    public User? Chair { get; set; }
    public Guid SecretaryId { get; set; }
    public User? Secretary { get; set; }
    public DateOnly DefenseDate { get; set; }
    public string Room { get; set; } = string.Empty;
    // Phòng đã chuẩn hóa (bỏ khoảng trắng thừa, chữ thường) để so trùng phòng (PDR-014).
    public string NormalizedRoom { get; set; } = string.Empty;
    public CouncilStatus Status { get; set; } = CouncilStatus.Draft;
    // Tăng mỗi lần lưu; máy khách gửi lại giá trị đang thấy để hai Giáo vụ sửa cùng lúc chỉ một bên thắng.
    public int Version { get; set; } = 1;
    public DateTime? PublishedAt { get; set; }
    public Guid? PublishedById { get; set; }
    public DateTime? CancelledAt { get; set; }
    public Guid? CancelledById { get; set; }
    public string? CancelReason { get; set; }
    // Dấu khóa PDR-018/019/020: đặt cùng transaction với phiếu điểm hội đồng đầu tiên (P07). Khác null thì không
    // sửa giờ/phòng/thành viên, không hủy; chỉ ghi đính chính.
    public DateTime? FirstScoredAt { get; set; }
    public List<DefenseSlot> Slots { get; set; } = [];

    public static string NormalizeRoom(string room) =>
        string.Join(' ', (room ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();
}

// Một lượt bảo vệ của một đề tài trong hội đồng; Giáo vụ nhập giờ bắt đầu/kết thúc (PDR-017).
public class DefenseSlot : BaseEntity
{
    public Guid CouncilId { get; set; }
    public DefenseCouncil? Council { get; set; }
    public Guid TopicId { get; set; }
    public ThesisTopic? Topic { get; set; }
    // Thứ tự bảo vệ trong buổi, bắt đầu từ 1.
    public int Order { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public DefenseSlotStatus Status { get; set; } = DefenseSlotStatus.Active;
}

// Lịch sử hội đồng: tạo, sửa (kèm lý do khi đã công bố), công bố, hủy, đính chính. Detail giữ giá trị trước/sau để
// lịch cũ vẫn tra cứu được (PDR-016/018/019).
public class DefenseCouncilLog : BaseEntity
{
    public Guid CouncilId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? Detail { get; set; }
}

public static class DefenseCouncilActions
{
    public const string Created = "Tạo hội đồng";
    public const string Updated = "Sửa hội đồng";
    public const string Published = "Công bố lịch";
    public const string Cancelled = "Hủy lịch";
    // PDR-018: sau khi có điểm, giữ lịch gốc và ghi đính chính.
    public const string Correction = "Đính chính";
}
