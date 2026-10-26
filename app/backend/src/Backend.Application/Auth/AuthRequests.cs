using System.Collections.Concurrent;
using Backend.Application.Common;
using Backend.Application.Common.Email;
using Backend.Application.Common.Security;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Backend.Application.Auth;

public record LoginCommand(LoginDto Credentials) : IRequest<ApiResponse<AuthenticatedSession>>;
public record ChangeInitialPasswordCommand(Guid UserId, ChangeInitialPasswordDto Passwords) : IRequest<ApiResponse<AuthenticatedSession>>;
public record GetCurrentUserQuery(Guid UserId) : IRequest<ApiResponse<CurrentUserDto>>;
public record SendActivationCodeCommand(Guid UserId) : IRequest<SendActivationCodeResult>;

public enum SendActivationCodeStatus { Sent, NotRequired, TooSoon, DeliveryFailed }
public sealed record SendActivationCodeResult(SendActivationCodeStatus Status, ApiResponse<ActivationCodeSentDto> Response);

public sealed class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x => x.Credentials.Email).NotEmpty().WithMessage("Nhập email để đăng nhập.").MaximumLength(256);
        RuleFor(x => x.Credentials.Password).NotEmpty().WithMessage("Nhập mật khẩu để đăng nhập.").MaximumLength(128);
    }
}

public sealed class ChangeInitialPasswordValidator : AbstractValidator<ChangeInitialPasswordCommand>
{
    public ChangeInitialPasswordValidator()
    {
        RuleFor(x => x.Passwords.CurrentPassword).NotEmpty().WithMessage("Nhập mật khẩu hiện tại.");
        RuleFor(x => x.Passwords.NewPassword)
            .MinimumLength(8).WithMessage("Mật khẩu mới tối thiểu 8 ký tự.")
            .MaximumLength(64).WithMessage("Mật khẩu mới tối đa 64 ký tự.")
            .Matches("[a-zA-Z]").WithMessage("Mật khẩu mới phải có chữ.")
            .Matches("[0-9]").WithMessage("Mật khẩu mới phải có số.")
            .NotEqual(x => x.Passwords.CurrentPassword).WithMessage("Mật khẩu mới phải khác mật khẩu hiện tại.");
        RuleFor(x => x.Passwords.ActivationCode)
            .Matches("^[0-9]{6}$").WithMessage("Mã xác thực gồm 6 chữ số.");
    }
}

internal static class UserMapping
{
    public static CurrentUserDto ToCurrentUserDto(this User user) => new()
    {
        Id = user.Id,
        UserCode = user.UserCode,
        FullName = user.FullName,
        Email = user.Email,
        Role = user.Role.ToString(),
        MustChangePassword = user.MustChangePassword
    };
}

public sealed class LoginHandler(IUserRepository users, IPasswordHasher hasher, IAccessTokenIssuer tokens, TimeProvider clock)
    : IRequestHandler<LoginCommand, ApiResponse<AuthenticatedSession>>
{
    // Thiết kế màn Đăng nhập: một dòng lỗi chung, không nói ô nào sai.
    public const string InvalidCredentialsMessage = "Email hoặc mật khẩu không đúng. Kiểm tra lại hoặc dùng Quên mật khẩu.";

    // Hash giả theo từng loại hasher: hash của BCrypt không verify được bằng hasher khác.
    private static readonly ConcurrentDictionary<Type, string> s_dummyHashes = new();

    public async Task<ApiResponse<AuthenticatedSession>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByEmailAsync(User.NormalizeEmail(request.Credentials.Email), cancellationToken);
        if (user is null)
        {
            // Vẫn băm để thời gian phản hồi không tiết lộ email có tồn tại hay không.
            var dummyHash = s_dummyHashes.GetOrAdd(hasher.GetType(), _ => hasher.Hash(Guid.NewGuid().ToString()));
            hasher.Verify(request.Credentials.Password, dummyHash);
            return ApiResponse<AuthenticatedSession>.Fail(InvalidCredentialsMessage);
        }

        if (!hasher.Verify(request.Credentials.Password, user.PasswordHash) || !user.IsActive)
            return ApiResponse<AuthenticatedSession>.Fail(InvalidCredentialsMessage);

        user.LastLoginAt = clock.GetUtcNow().UtcDateTime;
        await users.UpdateAsync(user, cancellationToken);

        var message = user.MustChangePassword ? "Cần đổi mật khẩu trước khi vào hệ thống" : "Đăng nhập thành công";
        return ApiResponse<AuthenticatedSession>.Ok(new AuthenticatedSession(user.ToCurrentUserDto(), tokens.Issue(user)), message);
    }
}

public sealed class SendActivationCodeHandler(
    IUserRepository users,
    IPasswordHasher hasher,
    IActivationCodeGenerator generator,
    IEmailSender email,
    TimeProvider clock,
    ILogger<SendActivationCodeHandler> logger)
    : IRequestHandler<SendActivationCodeCommand, SendActivationCodeResult>
{
    public async Task<SendActivationCodeResult> Handle(SendActivationCodeCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is not { IsActive: true, MustChangePassword: true })
            return Fail(SendActivationCodeStatus.NotRequired, "Tài khoản không cần kích hoạt");

        var now = clock.GetUtcNow().UtcDateTime;
        if (user.ActivationCodeSentAt is { } sentAt && now < sentAt + ActivationCodePolicy.ResendCooldown)
        {
            var wait = (int)Math.Ceiling((sentAt + ActivationCodePolicy.ResendCooldown - now).TotalSeconds);
            return Fail(SendActivationCodeStatus.TooSoon, $"Vui lòng đợi {wait} giây trước khi gửi lại mã");
        }

        var code = generator.NewCode();
        user.ActivationCodeHash = hasher.Hash(code);
        user.ActivationCodeExpiresAt = now + ActivationCodePolicy.Lifetime;
        user.ActivationCodeSentAt = now;
        user.ActivationCodeFailedAttempts = 0;
        await users.UpdateAsync(user, cancellationToken);

        try
        {
            await email.SendAsync(user.Email, "[QLKLTN] Mã xác thực kích hoạt tài khoản",
                $"""
                Xin chào {user.FullName},

                Mã xác thực kích hoạt tài khoản QLKLTN của bạn là: {code}

                Mã có hiệu lực {ActivationCodePolicy.Lifetime.TotalMinutes:0} phút và chỉ dùng một lần. Nhập mã này cùng mật khẩu mới ở màn hình đổi mật khẩu lần đầu.
                Nếu bạn không thực hiện đăng nhập, hãy bỏ qua email này và báo cho Giáo vụ.
                """, cancellationToken);
        }
        catch (Exception ex)
        {
            // Không ghi mã ra log. Hủy mã để người dùng có thể gửi lại ngay.
            logger.LogError(ex, "Failed to send activation code to user {UserId}", user.Id);
            user.ClearActivationCode();
            await users.UpdateAsync(user, CancellationToken.None);
            return Fail(SendActivationCodeStatus.DeliveryFailed, "Không gửi được email. Thử lại sau hoặc liên hệ Giáo vụ.");
        }

        return new SendActivationCodeResult(SendActivationCodeStatus.Sent, ApiResponse<ActivationCodeSentDto>.Ok(
            new ActivationCodeSentDto
            {
                ExpiresAt = user.ActivationCodeExpiresAt.Value,
                ResendAvailableAt = now + ActivationCodePolicy.ResendCooldown
            },
            $"Đã gửi mã xác thực tới {user.Email}"));
    }

    private static SendActivationCodeResult Fail(SendActivationCodeStatus status, string message) =>
        new(status, ApiResponse<ActivationCodeSentDto>.Fail(message));
}

public sealed class ChangeInitialPasswordHandler(IUserRepository users, IPasswordHasher hasher, IAccessTokenIssuer tokens, TimeProvider clock)
    : IRequestHandler<ChangeInitialPasswordCommand, ApiResponse<AuthenticatedSession>>
{
    public async Task<ApiResponse<AuthenticatedSession>> Handle(ChangeInitialPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null || !user.IsActive)
            return ApiResponse<AuthenticatedSession>.Fail("Tài khoản không tồn tại hoặc đã bị vô hiệu hóa");
        if (!user.MustChangePassword)
            return ApiResponse<AuthenticatedSession>.Fail("Tài khoản không cần đổi mật khẩu lần đầu");
        if (!hasher.Verify(request.Passwords.CurrentPassword, user.PasswordHash))
            return ApiResponse<AuthenticatedSession>.Fail("Mật khẩu hiện tại không đúng");
        if (request.Passwords.NewPassword == user.UserCode)
            return ApiResponse<AuthenticatedSession>.Fail("Mật khẩu mới phải khác mật khẩu ban đầu (mã người dùng)");

        var now = clock.GetUtcNow().UtcDateTime;
        if (user.ActivationCodeHash is null || user.ActivationCodeExpiresAt is not { } expiresAt || now > expiresAt)
            return ApiResponse<AuthenticatedSession>.Fail("Mã xác thực đã hết hạn hoặc chưa được gửi. Hãy bấm Gửi lại mã.");
        if (!hasher.Verify(request.Passwords.ActivationCode, user.ActivationCodeHash))
        {
            user.ActivationCodeFailedAttempts++;
            var exhausted = user.ActivationCodeFailedAttempts >= ActivationCodePolicy.MaxFailedAttempts;
            if (exhausted) user.ClearActivationCode();
            await users.UpdateAsync(user, cancellationToken);
            return ApiResponse<AuthenticatedSession>.Fail(exhausted
                ? "Nhập sai mã quá số lần cho phép. Hãy bấm Gửi lại mã để nhận mã mới."
                : "Mã xác thực không đúng");
        }

        user.PasswordHash = hasher.Hash(request.Passwords.NewPassword);
        user.MustChangePassword = false;
        user.ClearActivationCode();
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        user.UpdatedAt = now;
        await users.UpdateAsync(user, cancellationToken);

        return ApiResponse<AuthenticatedSession>.Ok(new AuthenticatedSession(user.ToCurrentUserDto(), tokens.Issue(user)), "Đã đổi mật khẩu");
    }
}

public sealed class GetCurrentUserHandler(IUserRepository users)
    : IRequestHandler<GetCurrentUserQuery, ApiResponse<CurrentUserDto>>
{
    public async Task<ApiResponse<CurrentUserDto>> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        return user is { IsActive: true }
            ? ApiResponse<CurrentUserDto>.Ok(user.ToCurrentUserDto())
            : ApiResponse<CurrentUserDto>.Fail("Tài khoản không tồn tại hoặc đã bị vô hiệu hóa");
    }
}
