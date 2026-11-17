using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Reviewers;
using Backend.Application.Topics;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Topics;

// Phân công Giảng viên phản biện (P05-S02, PDR-021/022/023, PDR-062). Giáo vụ gán; Giảng viên xem đề tài mình phản biện.
[ApiController]
[Route("api/reviewer-assignments")]
[Authorize]
public sealed class ReviewerAssignmentsController(ISender sender) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<ReviewerAssignmentsDto>>> List([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListReviewerAssignmentsQuery(roundId), cancellationToken));

    // Chỉ gợi ý để điền sẵn bản nháp; không ghi dữ liệu.
    [HttpGet("suggestions")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<List<ReviewerSuggestionDto>>>> Suggestions([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new SuggestReviewersQuery(roundId), cancellationToken));

    [HttpPut("{topicId:guid}")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<AssignReviewerResultDto>>> Assign(Guid topicId, AssignReviewerInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new AssignReviewerCommand(CurrentUserId, topicId, dto), cancellationToken));

    // Trả 200 kể cả khi có dòng lỗi; từng dòng có kết quả riêng.
    [HttpPost("batch")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<ReviewerBatchResultDto>>> Batch(ReviewerBatchInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new AssignReviewersBatchCommand(CurrentUserId, dto), cancellationToken));

    [HttpGet("mine")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<MyReviewDto>>> Mine([FromQuery] Guid? roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListMyReviewTopicsQuery(CurrentUserId, roundId), cancellationToken));

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);

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
