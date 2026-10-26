using System.Text;
using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Domain.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Backend.API.Authentication;

public static class AuthPolicies
{
    // Cho phép cả token của tài khoản còn mật khẩu ban đầu: chỉ dùng cho xem hồ sơ phiên và đổi mật khẩu lần đầu.
    public const string AllowPendingPasswordChange = nameof(AllowPendingPasswordChange);
}

public static class AuthenticationSetup
{
    public static IServiceCollection AddJwtCookieAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        // Thiếu khóa ký thì API dừng khi khởi động, không âm thầm chạy mà không có xác thực.
        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(o => Encoding.UTF8.GetByteCount(o.SigningKey) >= 32,
                "Authentication:Jwt:SigningKey is required and must be at least 32 bytes.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.Issuer) && !string.IsNullOrWhiteSpace(o.Audience),
                "Authentication:Jwt:Issuer and Authentication:Jwt:Audience are required.")
            .Validate(o => o.AccessTokenMinutes > 0, "Authentication:Jwt:AccessTokenMinutes must be positive.")
            .ValidateOnStart();
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<IAccessTokenIssuer, JwtAccessTokenIssuer>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme).Configure<IOptions<JwtOptions>>((options, jwtOptions) =>
        {
            var jwt = jwtOptions.Value;
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwt.Issuer,
                ValidateAudience = true,
                ValidAudience = jwt.Audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(1),
                NameClaimType = AppClaims.UserId,
                RoleClaimType = AppClaims.Role
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    // Header Authorization (ví dụ khi thử trên Scalar) được ưu tiên; mặc định đọc cookie HttpOnly.
                    if (string.IsNullOrEmpty(context.Request.Headers.Authorization))
                        context.Token = context.Request.Cookies[AuthCookie.Name];
                    return Task.CompletedTask;
                },
                OnTokenValidated = async context =>
                {
                    // Token hết hiệu lực ngay khi tài khoản bị vô hiệu hóa hoặc đã đổi mật khẩu.
                    var principal = context.Principal!;
                    var users = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
                    var user = Guid.TryParse(principal.FindFirst(AppClaims.UserId)?.Value, out var id)
                        ? await users.GetByIdAsync(id, context.HttpContext.RequestAborted)
                        : null;
                    if (user is not { IsActive: true } || user.SecurityStamp != principal.FindFirst(AppClaims.SecurityStamp)?.Value)
                        context.Fail("Session is no longer valid.");
                },
                OnChallenge = async context =>
                {
                    context.HandleResponse();
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("Bạn cần đăng nhập để tiếp tục"));
                },
                OnForbidden = async context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("Bạn không có quyền thực hiện thao tác này"));
                }
            };
        });

        services.AddAuthorizationBuilder()
            // [Authorize] không kèm vai trò: yêu cầu đăng nhập và đã đổi mật khẩu ban đầu.
            .SetDefaultPolicy(new AuthorizationPolicyBuilder(JwtBearerDefaults.AuthenticationScheme)
                .RequireAuthenticatedUser()
                .RequireAssertion(context => !context.User.HasClaim(c => c.Type == AppClaims.PasswordChangeRequired))
                .Build())
            .AddPolicy(AuthPolicies.AllowPendingPasswordChange, policy => policy
                .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
                .RequireAuthenticatedUser());

        return services;
    }
}
