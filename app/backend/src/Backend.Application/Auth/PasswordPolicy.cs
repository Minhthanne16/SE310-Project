using Backend.Domain.Entities;

namespace Backend.Application.Auth;

// Quy tắc mật khẩu tự đặt (PDR-002): 8–64 ký tự, có cả chữ và số, khác mã người dùng.
// Dùng cho mật khẩu Giáo vụ đặt khi tạo/nhập tài khoản giảng viên, giáo vụ (PDR-055).
public static class PasswordPolicy
{
    public const int MinLength = 8;
    public const int MaxLength = 64;

    public static bool HasLetterAndDigit(string password) =>
        password.Any(char.IsAsciiLetter) && password.Any(char.IsAsciiDigit);

    public static bool SameAsUserCode(string password, string userCode) =>
        string.Equals(password, userCode.Trim(), StringComparison.OrdinalIgnoreCase);

    // Chỉ sinh viên kích hoạt bằng OTP email; giảng viên, giáo vụ dùng mật khẩu Giáo vụ đặt (PDR-055).
    public static bool UsesActivationCode(UserRole role) => role == UserRole.Student;
}
