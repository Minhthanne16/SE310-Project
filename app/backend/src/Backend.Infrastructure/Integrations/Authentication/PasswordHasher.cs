using Backend.Application.Common.Security;

namespace Backend.Infrastructure.Integrations.Authentication;

public sealed class PasswordHasher : IPasswordHasher
{
    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
    public string HashInitialPassword(string userCode) => BCrypt.Net.BCrypt.HashPassword(userCode, workFactor: 10);
    public bool Verify(string password, string hash) => BCrypt.Net.BCrypt.Verify(password, hash);
}
