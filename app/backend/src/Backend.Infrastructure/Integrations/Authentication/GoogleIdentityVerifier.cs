using Google.Apis.Auth;
using Microsoft.Extensions.Configuration;

namespace Backend.Infrastructure.Integrations.Authentication;

public sealed record GoogleIdentity(string Subject, string Email, bool EmailVerified);

public interface IGoogleIdentityVerifier
{
    Task<GoogleIdentity> VerifyAsync(string idToken);
}

public sealed class GoogleIdentityVerifier(IConfiguration configuration) : IGoogleIdentityVerifier
{
    public async Task<GoogleIdentity> VerifyAsync(string idToken)
    {
        var clientId = configuration["Authentication:Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
            throw new InvalidOperationException("Google client ID is required.");

        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
            new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });
        return new GoogleIdentity(payload.Subject, payload.Email, payload.EmailVerified);
    }
}
