using Backend.API.Authentication;
using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Profiles;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Profiles;

[ApiController]
[Route("api/profile")]
[Authorize]
public sealed class ProfileController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> Get(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetMyProfileQuery(CurrentUserId), cancellationToken);
        return result.Success ? Ok(result) : Unauthorized(result);
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);
}
