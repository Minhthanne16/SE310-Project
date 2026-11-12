using System.Net.Mime;
using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Submissions;
using Backend.Application.Topics;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Submissions;

// Báo cáo giữa kỳ/cuối kỳ của đề tài (P04-S02, PDR-056). Tệp nằm trong object storage riêng tư và
// chỉ đi qua API này; quyền theo quan hệ với đề tài được kiểm tra trong handler.
[ApiController]
[Authorize(Roles = $"{AppRoles.AcademicAffairs},{AppRoles.Lecturer},{AppRoles.Student}")]
public sealed class SubmissionsController(ISender sender) : ControllerBase
{
    // Phần đệm cho ranh giới multipart và các trường chữ; giới hạn tệp thật nằm ở SubmissionPolicy.
    private const long MaxRequestBytes = SubmissionPolicy.MaxBytes + 256 * 1024;

    [HttpGet("api/topics/{topicId:guid}/submissions")]
    public async Task<ActionResult<ApiResponse<TopicSubmissionsDto>>> List(Guid topicId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListSubmissionsQuery(CurrentUserId, Role, topicId), cancellationToken));

    [HttpPost("api/topics/{topicId:guid}/submissions")]
    [RequestSizeLimit(MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestBytes)]
    public async Task<ActionResult<ApiResponse<TopicSubmissionsDto>>> Submit(Guid topicId, [FromForm] string? kind, [FromForm] string? note,
        IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse<TopicSubmissionsDto>.Fail(SubmissionPolicy.MissingFileMessage));
        // Từ chối trước khi đọc tệp vào bộ nhớ; handler kiểm tra lại cùng giới hạn.
        if (file.Length > SubmissionPolicy.MaxBytes)
            return BadRequest(ApiResponse<TopicSubmissionsDto>.Fail(SubmissionPolicy.TooLargeMessage));

        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, cancellationToken);
        return ToAction(await sender.Send(
            new SubmitReportCommand(CurrentUserId, Role, topicId, kind, file.FileName, buffer.ToArray(), note), cancellationToken));
    }

    [HttpGet("api/submissions/{id:guid}/file")]
    public async Task<IActionResult> Download(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetSubmissionFileQuery(CurrentUserId, Role, id), cancellationToken);
        if (result.Status != TopicResultStatus.Ok) return NotFound(result.Response);

        // Tệp riêng tư do người dùng tải lên: không lưu đệm dùng chung, không để trình duyệt đoán kiểu
        // hay chạy nội dung nhúng trong PDF cùng origin với ứng dụng.
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers.XContentTypeOptions = "nosniff";
        Response.Headers.ContentSecurityPolicy = "default-src 'none'; sandbox";
        return File(result.Response.Data!.Content, MediaTypeNames.Application.Pdf, result.Response.Data.FileName);
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);

    private ViewerRole Role => User.IsInRole(AppRoles.AcademicAffairs) ? ViewerRole.AcademicAffairs
        : User.IsInRole(AppRoles.Lecturer) ? ViewerRole.Lecturer : ViewerRole.Student;

    private ActionResult<ApiResponse<T>> ToAction<T>(TopicResult<T> result) => result.Status switch
    {
        TopicResultStatus.Ok => Ok(result.Response),
        TopicResultStatus.Created => StatusCode(StatusCodes.Status201Created, result.Response),
        TopicResultStatus.NotFound => NotFound(result.Response),
        TopicResultStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, result.Response),
        TopicResultStatus.Invalid => BadRequest(result.Response),
        _ => Conflict(result.Response)
    };
}
