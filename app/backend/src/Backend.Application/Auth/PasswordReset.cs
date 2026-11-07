using System.Security.Cryptography;
using System.Text;
using Backend.Application.Common;
using Backend.Application.Common.Email;
using Backend.Application.Common.Security;
using Backend.Application.Users;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Backend.Application.Auth;

// Quên mật khẩu: PDR-037 (phản hồi trung tính), PDR-044 (giới hạn), PDR-045 (chỉ tài khoản
// đang hoạt động, đã kích hoạt). Hợp đồng API ở PDR-052.
public static class PasswordResetPolicy
{
    public static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);
    public static readonly PasswordResetLimits Limits = new(
        EmailCooldown: TimeSpan.FromSeconds(60), MaxPerEmail: 5, MaxPerSource: 20, Window: TimeSpan.FromHours(1));
    public const string NeutralMessage = "Nếu email thuộc hệ thống, bạn sẽ nhận liên kết đặt lại mật khẩu.";
    public const int MaxTokenLength = 128;

    internal static string Sha256(string value) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

public static class PasswordResetStatuses
{
    public const string Valid = "valid";
    public const string Expired = "expired";
    public const string Used = "used";
    public const string Invalid = "invalid";
    public const string Completed = "completed";
}

public class ResetPasswordWithTokenDto
{
    public string? Token { get; set; }
    public string? NewPassword { get; set; }
}

public class PasswordResetStatusDto
{
    // valid | expired | used | invalid | completed
    public string Status { get; set; } = string.Empty;
    public DateTime? ExpiresAt { get; set; }
}

// ResetPageUrl là trang Quên mật khẩu của frontend lấy từ cấu hình máy chủ, không từ request.
public record RequestPasswordResetCommand(string? Email, string Source, string ResetPageUrl) : IRequest<ApiResponse<bool>>;
public record CheckPasswordResetTokenQuery(string? Token) : IRequest<ApiResponse<PasswordResetStatusDto>>;
public record ResetPasswordWithTokenCommand(ResetPasswordWithTokenDto Reset) : IRequest<ApiResponse<PasswordResetStatusDto>>;

public sealed class RequestPasswordResetValidator : AbstractValidator<RequestPasswordResetCommand>
{
    public RequestPasswordResetValidator()
    {
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Nhập email.")
            .Must(e => UserFields.IsValidEmail(User.NormalizeEmail(e!))).WithMessage("Email không đúng định dạng.")
            .OverridePropertyName("email");
    }
}

public sealed class ResetPasswordWithTokenValidator : AbstractValidator<ResetPasswordWithTokenCommand>
{
    public ResetPasswordWithTokenValidator()
    {
        RuleFor(x => x.Reset.Token).NotEmpty().WithMessage("Thiếu mã liên kết.")
            .MaximumLength(PasswordResetPolicy.MaxTokenLength).OverridePropertyName("token");
        RuleFor(x => x.Reset.NewPassword)
            .NotEmpty().WithMessage("Nhập mật khẩu mới.")
            .MinimumLength(8).WithMessage("Mật khẩu mới tối thiểu 8 ký tự.")
            .MaximumLength(64).WithMessage("Mật khẩu mới tối đa 64 ký tự.")
            .Matches("[a-zA-Z]").WithMessage("Mật khẩu mới phải có chữ.")
            .Matches("[0-9]").WithMessage("Mật khẩu mới phải có số.")
            .OverridePropertyName("newPassword");
    }
}

public sealed class RequestPasswordResetHandler(
    IUserRepository users,
    IPasswordResetRepository resets,
    IEmailSender email,
    TimeProvider clock,
    ILogger<RequestPasswordResetHandler> logger)
    : IRequestHandler<RequestPasswordResetCommand, ApiResponse<bool>>
{
    public async Task<ApiResponse<bool>> Handle(RequestPasswordResetCommand request, CancellationToken cancellationToken)
    {
        var address = User.NormalizeEmail(request.Email!);
        var now = clock.GetUtcNow().UtcDateTime;

        // Giới hạn áp dụng cho mọi email đúng định dạng, có hay không có tài khoản (PDR-044).
        var accepted = await resets.TryRecordRequestAsync(new PasswordResetRequest
        {
            EmailHash = PasswordResetPolicy.Sha256(address),
            Source = request.Source,
            CreatedAt = now
        }, PasswordResetPolicy.Limits, cancellationToken);

        if (accepted && await users.GetByEmailAsync(address, cancellationToken) is { IsActive: true, MustChangePassword: false } user)
        {
            var token = Base64Url(RandomNumberGenerator.GetBytes(32));
            await resets.AddTokenAsync(new PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = PasswordResetPolicy.Sha256(token),
                SecurityStamp = user.SecurityStamp,
                ExpiresAt = now + PasswordResetPolicy.TokenLifetime,
                CreatedAt = now
            }, cancellationToken);

            // Không chờ SMTP: thời gian phản hồi không được để lộ email có tài khoản hay không.
            _ = SendLinkAsync(user, $"{request.ResetPageUrl}#token={token}");
        }

        return ApiResponse<bool>.Ok(true, PasswordResetPolicy.NeutralMessage);
    }

    private async Task SendLinkAsync(User user, string link)
    {
        try
        {
            await email.SendAsync(user.Email, "[QLKLTN] Đặt lại mật khẩu",
                $"""
                Xin chào {user.FullName},

                Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản QLKLTN của bạn.
                Mở liên kết sau để đặt mật khẩu mới:

                {link}

                Liên kết có hiệu lực {PasswordResetPolicy.TokenLifetime.TotalMinutes:0} phút và chỉ dùng được một lần.
                Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại vẫn giữ nguyên.
                """, CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Không ghi liên kết/token ra log.
            logger.LogError(ex, "Failed to send password reset link to user {UserId}", user.Id);
        }
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

internal static class PasswordResetTokens
{
    // Trạng thái liên kết lúc dùng; kiểm tra lại tài khoản theo PDR-045 và SecurityStamp lúc phát hành.
    public static async Task<(string Status, PasswordResetToken? Token, User? User)> ResolveAsync(
        this IPasswordResetRepository resets, IUserRepository users, string? rawToken, DateTime now, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawToken) || rawToken.Length > PasswordResetPolicy.MaxTokenLength)
            return (PasswordResetStatuses.Invalid, null, null);
        var token = await resets.GetTokenAsync(PasswordResetPolicy.Sha256(rawToken), cancellationToken);
        if (token is null) return (PasswordResetStatuses.Invalid, null, null);
        if (token.UsedAt is not null) return (PasswordResetStatuses.Used, token, null);
        if (now >= token.ExpiresAt) return (PasswordResetStatuses.Expired, token, null);

        var user = await users.GetByIdAsync(token.UserId, cancellationToken);
        if (user is not { IsActive: true, MustChangePassword: false } || user.SecurityStamp != token.SecurityStamp)
            return (PasswordResetStatuses.Invalid, token, null);
        return (PasswordResetStatuses.Valid, token, user);
    }
}

public sealed class CheckPasswordResetTokenHandler(IPasswordResetRepository resets, IUserRepository users, TimeProvider clock)
    : IRequestHandler<CheckPasswordResetTokenQuery, ApiResponse<PasswordResetStatusDto>>
{
    public async Task<ApiResponse<PasswordResetStatusDto>> Handle(CheckPasswordResetTokenQuery request, CancellationToken cancellationToken)
    {
        var (status, token, _) = await resets.ResolveAsync(users, request.Token, clock.GetUtcNow().UtcDateTime, cancellationToken);
        return ApiResponse<PasswordResetStatusDto>.Ok(new PasswordResetStatusDto
        {
            Status = status,
            ExpiresAt = status == PasswordResetStatuses.Valid ? token!.ExpiresAt : null
        });
    }
}

public sealed class ResetPasswordWithTokenHandler(IPasswordResetRepository resets, IUserRepository users, IPasswordHasher hasher, TimeProvider clock)
    : IRequestHandler<ResetPasswordWithTokenCommand, ApiResponse<PasswordResetStatusDto>>
{
    public async Task<ApiResponse<PasswordResetStatusDto>> Handle(ResetPasswordWithTokenCommand request, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var (status, token, user) = await resets.ResolveAsync(users, request.Reset.Token, now, cancellationToken);
        if (status != PasswordResetStatuses.Valid) return Fail(status);

        var newPassword = request.Reset.NewPassword!;
        if (newPassword == user!.UserCode)
            return Fail(PasswordResetStatuses.Valid, "Mật khẩu mới phải khác mã người dùng.");

        user.PasswordHash = hasher.Hash(newPassword);
        // Thu hồi mọi phiên đang mở; người dùng đăng nhập lại bằng mật khẩu mới.
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        user.UpdatedAt = now;
        if (!await resets.CompleteResetAsync(user, token!, user.Audit(user.Id, UserAuditActions.PasswordResetByLink, now), now, cancellationToken))
            return Fail(PasswordResetStatuses.Used);

        return ApiResponse<PasswordResetStatusDto>.Ok(new PasswordResetStatusDto { Status = PasswordResetStatuses.Completed },
            "Đã đặt lại mật khẩu. Đăng nhập bằng mật khẩu mới.");
    }

    private static ApiResponse<PasswordResetStatusDto> Fail(string status, string? message = null) => new()
    {
        Success = false,
        Message = message ?? status switch
        {
            PasswordResetStatuses.Expired => "Liên kết đặt lại mật khẩu đã hết hạn.",
            PasswordResetStatuses.Used => "Liên kết đặt lại mật khẩu đã được dùng.",
            _ => "Liên kết đặt lại mật khẩu không hợp lệ."
        },
        Data = new PasswordResetStatusDto { Status = status }
    };
}

public class ForgotPasswordDto
{
    public string? Email { get; set; }
}

public class PasswordResetTokenDto
{
    public string? Token { get; set; }
}
