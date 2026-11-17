using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Lịch sử thay đổi của đợt. ActorUserId null = thao tác từ hệ thống.
public class RoundAuditEntry : BaseEntity
{
    public Guid RoundId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public Guid? TargetUserId { get; set; }
    public string? Details { get; set; }
}
