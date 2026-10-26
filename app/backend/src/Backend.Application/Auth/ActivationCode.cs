using System.Security.Cryptography;

namespace Backend.Application.Auth;

// Thông số OTP kích hoạt đã chốt trong PDR-003.
public static class ActivationCodePolicy
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
    public const int MaxFailedAttempts = 5;
}

public interface IActivationCodeGenerator
{
    string NewCode();
}

public sealed class RandomActivationCodeGenerator : IActivationCodeGenerator
{
    public string NewCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
}
