using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Lịch sử thao tác quản trị trên một tài khoản (PDR-036, P01-S02). Không khóa
// ngoại tới Users: bản ghi phải còn sau khi tài khoản bị xóa, nên lưu kèm mã
// người dùng. Lịch sử quản trị không tính là "dữ liệu nghiệp vụ" chặn xóa.
public class UserAuditEntry : BaseEntity
{
    public Guid TargetUserId { get; set; }
    public string TargetUserCode { get; set; } = string.Empty;
    public Guid ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    // JSON mô tả thay đổi, ví dụ {"fullName":{"from":"A","to":"B"}}. Không chứa mật khẩu.
    public string? Details { get; set; }
}

public static class UserAuditActions
{
    public const string Created = "Created";
    public const string Updated = "Updated";
    public const string Disabled = "Disabled";
    public const string Reactivated = "Reactivated";
    public const string PasswordReset = "PasswordReset";
    public const string Deleted = "Deleted";
}
