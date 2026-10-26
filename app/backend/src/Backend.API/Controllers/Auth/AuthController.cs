using Backend.API.Authentication;
using Backend.Application.Auth;
using Backend.Application.Common;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Auth;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(ISender sender) : ControllerBase
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
