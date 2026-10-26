namespace Backend.Application.Common.Security;

public interface IPasswordHasher
{
    string Hash(string password);
    // Mật khẩu ban đầu là mã người dùng (không bí mật); bảo vệ thật nằm ở OTP và
    // bắt buộc đổi mật khẩu, nên dùng chi phí băm thấp hơn để nhập CSV hàng loạt kịp thời.
    string HashInitialPassword(string userCode);
    bool Verify(string password, string hash);
}
