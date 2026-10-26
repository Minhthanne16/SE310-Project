using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Ba vai trò tài khoản theo PDR-001. Hướng dẫn, phản biện, chủ tịch, thư ký là
// vai trò theo đề tài/hội đồng của Giảng viên, không phải vai trò tài khoản.
public enum UserRole
{
    Student = 1,
    Lecturer = 2,
    AcademicAffairs = 3
}

public class User : BaseEntity
{
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    // Sinh viên: lớp. Giảng viên: bộ môn và học hàm/học vị.
    public string? ClassName { get; set; }
    public string? Department { get; set; }
    public string? AcademicTitle { get; set; }
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; } = true;
    // Đổi giá trị khi đổi mật khẩu để vô hiệu hóa các token đã cấp trước đó.
    public string SecurityStamp { get; set; } = Guid.NewGuid().ToString("N");
    public DateTime? LastLoginAt { get; set; }

    // OTP kích hoạt gửi qua email ở lần đăng nhập đầu; chỉ lưu bản băm.
    public string? ActivationCodeHash { get; set; }
    public DateTime? ActivationCodeExpiresAt { get; set; }
    public DateTime? ActivationCodeSentAt { get; set; }
    public int ActivationCodeFailedAttempts { get; set; }

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public void ClearActivationCode()
    {
        ActivationCodeHash = null;
        ActivationCodeExpiresAt = null;
        ActivationCodeSentAt = null;
        ActivationCodeFailedAttempts = 0;
    }
}
