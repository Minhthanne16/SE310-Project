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
}
