namespace Backend.Infrastructure.Integrations.Email;

public sealed class EmailOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string From { get; set; } = string.Empty;
    public bool UseStartTls { get; set; } = true;

    // SMTP không xác thực (Mailpit) nhận thư gửi tới tài khoản mẫu *.local, để vẫn
    // mô phỏng được OTP khi đã cấu hình SMTP thật. Để trống thì gửi mọi thư qua Host.
    public string LocalDomainHost { get; set; } = string.Empty;
    public int LocalDomainPort { get; set; } = 1025;
}
