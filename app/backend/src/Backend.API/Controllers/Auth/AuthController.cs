using Backend.API.Authentication;
using Backend.Application.Auth;
using Backend.Application.Common;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Auth;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(ISender sender, IConfiguration configuration) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<CurrentUserDto>>> Login(LoginDto dto, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new LoginCommand(dto), cancellationToken);
        if (!result.Success) return Unauthorized(ApiResponse<CurrentUserDto>.Fail(result.Message));

        AuthCookie.Append(HttpContext, result.Data!.AccessToken);
        return Ok(ApiResponse<CurrentUserDto>.Ok(result.Data.User, result.Message));
    }

    [HttpPost("activation-code")]
    [Authorize(Policy = AuthPolicies.AllowPendingPasswordChange)]
    public async Task<ActionResult<ApiResponse<ActivationCodeSentDto>>> SendActivationCode(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new SendActivationCodeCommand(CurrentUserId), cancellationToken);
        return result.Status switch
        {
            SendActivationCodeStatus.Sent => Ok(result.Response),
            SendActivationCodeStatus.TooSoon => StatusCode(StatusCodes.Status429TooManyRequests, result.Response),
            SendActivationCodeStatus.DeliveryFailed => StatusCode(StatusCodes.Status503ServiceUnavailable, result.Response),
            _ => BadRequest(result.Response)
        };
    }

    [HttpPost("change-initial-password")]
    [Authorize(Policy = AuthPolicies.AllowPendingPasswordChange)]
    public async Task<ActionResult<ApiResponse<CurrentUserDto>>> ChangeInitialPassword(ChangeInitialPasswordDto dto, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new ChangeInitialPasswordCommand(CurrentUserId, dto), cancellationToken);
        if (!result.Success) return BadRequest(ApiResponse<CurrentUserDto>.Fail(result.Message));

        AuthCookie.Append(HttpContext, result.Data!.AccessToken);
        return Ok(ApiResponse<CurrentUserDto>.Ok(result.Data.User, result.Message));
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CurrentUserDto>>> ChangePassword(ChangePasswordDto dto, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new ChangePasswordCommand(CurrentUserId, dto), cancellationToken);
        if (!result.Success) return BadRequest(ApiResponse<CurrentUserDto>.Fail(result.Message));

        AuthCookie.Append(HttpContext, result.Data!.AccessToken);
        return Ok(ApiResponse<CurrentUserDto>.Ok(result.Data.User, result.Message));
    }

    // Phản hồi trung tính cho mọi email đúng định dạng (PDR-037/044/045); chỉ lỗi định dạng trả 400.
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<bool>>> ForgotPassword(ForgotPasswordDto dto, CancellationToken cancellationToken)
    {
        // Nguồn là IP kết nối; chỉ lấy từ X-Forwarded-For khi proxy được cấu hình tin cậy (Program.cs).
        var source = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var resetPage = $"{(configuration["FrontendOrigin"] ?? "http://localhost:3000").TrimEnd('/')}/quen-mat-khau";
        return Ok(await sender.Send(new RequestPasswordResetCommand(dto.Email, source, resetPage), cancellationToken));
    }

    [HttpPost("reset-password/check")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<PasswordResetStatusDto>>> CheckPasswordResetToken(PasswordResetTokenDto dto, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new CheckPasswordResetTokenQuery(dto.Token), cancellationToken));

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<PasswordResetStatusDto>>> ResetPassword(ResetPasswordWithTokenDto dto, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new ResetPasswordWithTokenCommand(dto), cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpGet("me")]
    [Authorize(Policy = AuthPolicies.AllowPendingPasswordChange)]
    public async Task<ActionResult<ApiResponse<CurrentUserDto>>> Me(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetCurrentUserQuery(CurrentUserId), cancellationToken);
        return result.Success ? Ok(result) : Unauthorized(result);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public ActionResult<ApiResponse<bool>> Logout()
    {
        AuthCookie.Delete(HttpContext);
        return Ok(ApiResponse<bool>.Ok(true, "Đã đăng xuất"));
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);
}
