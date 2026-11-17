using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Councils;
using Backend.Application.Topics;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Councils;

// Hội đồng và lịch bảo vệ (P06, PDR-014–020, PDR-063). Giáo vụ lập/sửa/công bố/hủy/đính chính; Giảng viên xem hội
// đồng mình là Chủ tịch/Thư ký sau khi công bố. Sinh viên xem lịch của đề tài mình qua GET /api/topics/{id}.
[ApiController]
[Route("api/councils")]
[Authorize]
public sealed class CouncilsController(ISender sender) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<CouncilBoardDto>>> Board([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new GetCouncilBoardQuery(roundId), cancellationToken));

    // Xem trước xung đột của bản đang sửa; không ghi dữ liệu.
    [HttpPost("check")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<CouncilCheckResultDto>>> Check(CouncilCheckInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CheckCouncilQuery(dto), cancellationToken));

    [HttpPost]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<CouncilDto>>> Create(CouncilInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CreateCouncilCommand(CurrentUserId, dto), cancellationToken));

    [HttpPut("{id:guid}")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<CouncilDto>>> Update(Guid id, CouncilInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new UpdateCouncilCommand(CurrentUserId, id, dto), cancellationToken));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new DeleteCouncilCommand(id), cancellationToken));

    // Trả 200 kể cả khi có hội đồng chưa công bố được; từng hội đồng có kết quả riêng.
    [HttpPost("publish")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<CouncilPublishResultDto>>> Publish(CouncilPublishInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new PublishCouncilsCommand(CurrentUserId, dto), cancellationToken));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<CouncilDto>>> Cancel(Guid id, CouncilReasonInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CancelCouncilCommand(CurrentUserId, id, dto), cancellationToken));

    [HttpPost("{id:guid}/corrections")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<CouncilDto>>> Correct(Guid id, CouncilCorrectionInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new AddCouncilCorrectionCommand(CurrentUserId, id, dto), cancellationToken));

    [HttpGet("mine")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<MyCouncilsDto>>> Mine([FromQuery] Guid? roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListMyCouncilsQuery(CurrentUserId, roundId), cancellationToken));

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
