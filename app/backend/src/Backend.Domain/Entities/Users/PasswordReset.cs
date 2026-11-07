using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Liên kết tự đặt lại mật khẩu (PDR-037/045): chỉ lưu bản băm của token, dùng một lần.
// SecurityStamp chụp lúc phát hành: đổi mật khẩu, bị Giáo vụ đặt lại hay vô hiệu hóa
// đều xoay stamp nên liên kết đã phát tự hết hiệu lực.
public class PasswordResetToken : BaseEntity
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public string SecurityStamp { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}

// Một yêu cầu quên mật khẩu đã được chấp nhận, dùng để đếm giới hạn PDR-044.
// Ghi cho cả email không có tài khoản; lưu bản băm email thay vì email thật.
public class PasswordResetRequest : BaseEntity
{
    public string EmailHash { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
}

public sealed record PasswordResetLimits(TimeSpan EmailCooldown, int MaxPerEmail, int MaxPerSource, TimeSpan Window);
