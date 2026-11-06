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
    // Thêm phần đệm cho ranh giới multipart; giới hạn tệp thật nằm ở AvatarPolicy.
    private const long MaxAvatarRequestBytes = AvatarPolicy.MaxBytes + 64 * 1024;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> Get(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetMyProfileQuery(CurrentUserId), cancellationToken);
        return result.Success ? Ok(result) : Unauthorized(result);
    }

    [HttpPut]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> Update(UpdateProfileDto dto, CancellationToken cancellationToken) =>
        ToActionResult(await sender.Send(new UpdateMyProfileCommand(CurrentUserId, dto), cancellationToken));

    [HttpPut("avatar")]
    [RequestSizeLimit(MaxAvatarRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxAvatarRequestBytes)]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> UploadAvatar(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse<ProfileDto>.Fail("Chọn ảnh để tải lên (trường 'file')"));
        if (file.Length > AvatarPolicy.MaxBytes)
            return BadRequest(ApiResponse<ProfileDto>.Fail(AvatarPolicy.TooLargeMessage));

        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, cancellationToken);
        return ToActionResult(await sender.Send(new UploadMyAvatarCommand(CurrentUserId, buffer.ToArray()), cancellationToken));
    }

    [HttpDelete("avatar")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> RemoveAvatar(CancellationToken cancellationToken) =>
        ToActionResult(await sender.Send(new RemoveMyAvatarCommand(CurrentUserId), cancellationToken));

    [HttpGet("avatar")]
    public async Task<IActionResult> GetAvatar(CancellationToken cancellationToken)
    {
        var avatar = await sender.Send(new GetMyAvatarQuery(CurrentUserId), cancellationToken);
        if (avatar is null) return NotFound(ApiResponse<object>.Fail("Chưa có ảnh đại diện"));

        // Ảnh riêng tư; không để trình duyệt đoán kiểu hay chạy nội dung lẫn trong tệp.
        Response.Headers.CacheControl = "private, no-cache";
        Response.Headers.XContentTypeOptions = "nosniff";
        Response.Headers.ContentSecurityPolicy = "default-src 'none'; sandbox";
        return File(avatar.Content, avatar.ContentType);
    }

    private ActionResult<ApiResponse<ProfileDto>> ToActionResult(ProfileCommandResult result) => result.Status switch
    {
        ProfileCommandStatus.Ok => Ok(result.Response),
        ProfileCommandStatus.AccountUnavailable => Unauthorized(result.Response),
        _ => BadRequest(result.Response)
    };

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);
}
