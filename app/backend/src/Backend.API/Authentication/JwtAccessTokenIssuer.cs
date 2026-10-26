using System.Security.Claims;
using System.Text;
using Backend.Application.Auth;
using Backend.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Backend.API.Authentication;

public sealed class JwtAccessTokenIssuer(IOptions<JwtOptions> options, TimeProvider clock) : IAccessTokenIssuer
{
    private readonly JsonWebTokenHandler _handler = new();

    public IssuedAccessToken Issue(User user)
    {
        var settings = options.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var expiresAt = now.AddMinutes(settings.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(AppClaims.UserId, user.Id.ToString()),
            new(AppClaims.SecurityStamp, user.SecurityStamp),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };
        // Tài khoản còn mật khẩu ban đầu không nhận claim vai trò, nên mọi endpoint
        // phân quyền theo vai trò đều trả 403 cho đến khi đổi mật khẩu.
        if (user.MustChangePassword)
            claims.Add(new Claim(AppClaims.PasswordChangeRequired, "true"));
        else
            claims.Add(new Claim(AppClaims.Role, user.Role.ToString()));

        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = settings.Issuer,
            Audience = settings.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SigningKey)), SecurityAlgorithms.HmacSha256)
        });
        return new IssuedAccessToken(token, expiresAt);
    }
}
