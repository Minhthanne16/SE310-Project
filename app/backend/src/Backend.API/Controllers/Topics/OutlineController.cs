using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Topics;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Topics;

// Đề cương và yêu cầu chỉnh sửa của một đề tài (P04-S01, PDR-013, PDR-057). Người xem ngoài
// nhóm/GVHD/Giáo vụ nhận 404 để không lộ đề tài.
[ApiController]
[Route("api/topics/{topicId:guid}/outline")]
[Authorize(Roles = $"{AppRoles.AcademicAffairs},{AppRoles.Lecturer},{AppRoles.Student}")]
public sealed class OutlineController(ISender sender) : ControllerBase
{
    // 20 MB tệp (PDR-040) + phần đầu multipart.
    private const long MaxRequestBytes = OutlineRules.MaxFileBytes + 1024 * 1024;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<OutlineDto>>> Get(Guid topicId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new GetOutlineQuery(topicId, CurrentUserId, ViewerRole), cancellationToken));

    // multipart/form-data: file (PDF ≤ 20 MB), note (không bắt buộc).
    [HttpPost("submissions")]
    [Authorize(Roles = AppRoles.Student)]
    [RequestSizeLimit(MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestBytes)]
    public async Task<ActionResult<ApiResponse<OutlineDto>>> Submit(Guid topicId, IFormFile? file, [FromForm] string? note,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse<OutlineDto>.Fail(OutlineRules.EmptyFileMessage));
        if (file.Length > OutlineRules.MaxFileBytes)
            return BadRequest(ApiResponse<OutlineDto>.Fail(OutlineRules.TooLargeMessage));
        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, cancellationToken);
        return ToAction(await sender.Send(new SubmitOutlineCommand(CurrentUserId, topicId, buffer.ToArray(), file.FileName, note), cancellationToken));
    }

    // Tải PDF: chỉ người có quyền xem đề cương; không cho trình duyệt đoán kiểu nội dung.
    [HttpGet("submissions/{submissionId:guid}/file")]
    public async Task<IActionResult> Download(Guid topicId, Guid submissionId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new DownloadSubmissionQuery(topicId, submissionId, CurrentUserId, ViewerRole), cancellationToken);
        if (result.Status != TopicResultStatus.Ok) return ToAction(result);
        Response.Headers.XContentTypeOptions = "nosniff";
        Response.Headers.CacheControl = "private, no-cache";
        return File(result.Response.Data!.Content, "application/pdf", result.Response.Data.FileName);
    }

    [HttpPut("submissions/{submissionId:guid}/comment")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<OutlineDto>>> Comment(Guid topicId, Guid submissionId, OutlineCommentDto dto,
        CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CommentOutlineCommand(CurrentUserId, topicId, submissionId, dto.Comment), cancellationToken));

    [HttpPost("requests")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<OutlineDto>>> CreateRequest(Guid topicId, RevisionRequestInputDto dto,
        CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CreateRevisionRequestCommand(CurrentUserId, topicId, dto.Content), cancellationToken));

    [HttpPost("requests/{requestId:guid}/resolve")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<OutlineDto>>> Resolve(Guid topicId, Guid requestId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ResolveRevisionRequestCommand(CurrentUserId, topicId, requestId), cancellationToken));

    [HttpPost("approve")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<OutlineDto>>> Approve(Guid topicId, OutlineApproveDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ApproveOutlineCommand(CurrentUserId, topicId, dto.SubmissionId), cancellationToken));

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);

    private ViewerRole ViewerRole => User.IsInRole(AppRoles.AcademicAffairs) ? ViewerRole.AcademicAffairs
        : User.IsInRole(AppRoles.Lecturer) ? ViewerRole.Lecturer : ViewerRole.Student;

    private ActionResult ToAction<T>(TopicResult<T> result) => result.Status switch
    {
        TopicResultStatus.Ok => Ok(result.Response),
        TopicResultStatus.Created => StatusCode(StatusCodes.Status201Created, result.Response),
        TopicResultStatus.NotFound => NotFound(result.Response),
        TopicResultStatus.Forbidden => StatusCode(StatusCodes.Status403Forbidden, result.Response),
        TopicResultStatus.Invalid => BadRequest(result.Response),
        TopicResultStatus.Unavailable => StatusCode(StatusCodes.Status503ServiceUnavailable, result.Response),
        _ => Conflict(result.Response)
    };
}
