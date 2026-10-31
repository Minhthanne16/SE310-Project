using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Users;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.AcademicAffairs)]
public sealed class UsersController(ISender sender) : ControllerBase
{
    // Thêm phần đệm cho ranh giới multipart; giới hạn tệp thật nằm ở UserImportPolicy.
    private const long MaxRequestBytes = UserImportPolicy.MaxFileBytes + 64 * 1024;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<UserDto>>>> List(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListUsersQuery(), cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<UserDto>>> Create(CreateUserDto dto, CancellationToken cancellationToken) =>
        ToActionResult(await sender.Send(new CreateUserCommand(CurrentUserId, dto), cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> Update(Guid id, UpdateUserDto dto, CancellationToken cancellationToken) =>
        ToActionResult(await sender.Send(new UpdateUserCommand(CurrentUserId, id, dto), cancellationToken));

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<UserDto>>> SetStatus(Guid id, UserStatusDto dto, CancellationToken cancellationToken) =>
        ToActionResult(await sender.Send(new SetUserStatusCommand(CurrentUserId, id, dto.IsActive), cancellationToken));

    // Chưa có dữ liệu thì xóa hẳn, có dữ liệu thì vô hiệu hóa; Result cho biết đã làm gì.
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DeleteUserResultDto>>> Delete(Guid id, CancellationToken cancellationToken) =>
        ToActionResult(await sender.Send(new DeleteUserCommand(CurrentUserId, id), cancellationToken));

    [HttpPost("{id:guid}/reset-password")]
    public async Task<ActionResult<ApiResponse<UserDto>>> ResetPassword(Guid id, ResetUserPasswordDto dto, CancellationToken cancellationToken) =>
        ToActionResult(await sender.Send(new ResetUserPasswordCommand(CurrentUserId, id, dto.NewPassword), cancellationToken));

    [HttpPost("import/preview")]
    [RequestSizeLimit(MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestBytes)]
    public Task<ActionResult<ApiResponse<UserImportReportDto>>> PreviewImport(IFormFile? file, CancellationToken cancellationToken) =>
        Import(file, commit: false, cancellationToken);

    [HttpPost("import")]
    [RequestSizeLimit(MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestBytes)]
    public Task<ActionResult<ApiResponse<UserImportReportDto>>> CommitImport(IFormFile? file, CancellationToken cancellationToken) =>
        Import(file, commit: true, cancellationToken);

    private async Task<ActionResult<ApiResponse<UserImportReportDto>>> Import(IFormFile? file, bool commit, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse<UserImportReportDto>.Fail("Chọn tệp CSV để nhập (trường 'file')"));
        if (file.Length > UserImportPolicy.MaxFileBytes)
            return BadRequest(ApiResponse<UserImportReportDto>.Fail($"Tệp vượt quá {UserImportPolicy.MaxFileBytes / (1024 * 1024)} MB"));

        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, cancellationToken);
        var result = await sender.Send(new ImportUsersCommand(buffer.ToArray(), file.FileName, commit), cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    private ActionResult<ApiResponse<T>> ToActionResult<T>(UserCommandResult<T> result) => result.Status switch
    {
        UserCommandStatus.Ok => Ok(result.Response),
        UserCommandStatus.Created => StatusCode(StatusCodes.Status201Created, result.Response),
        UserCommandStatus.NotFound => NotFound(result.Response),
        // Data cho form biết ô bị trùng (userCode | email).
        UserCommandStatus.Duplicate => Conflict(new ApiResponse<DuplicateUserFieldDto>
        {
            Success = false,
            Message = result.Response.Message,
            Data = new DuplicateUserFieldDto { Field = result.DuplicateField! }
        }),
        _ => BadRequest(result.Response)
    };

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);
}
