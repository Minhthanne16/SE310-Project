using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Topics;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Topics;

// Đề tài của đợt (P03-S01, PDR-053): Giáo vụ xem cả đợt, GVHD quản lý đề tài của mình,
// sinh viên xem danh sách đã công bố. Công bố nằm ở POST /api/rounds/{id}/topics/publish.
[ApiController]
[Route("api/topics")]
[Authorize]
public sealed class TopicsController(ISender sender) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<RoundTopicsDto>>> ListRound([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListRoundTopicsQuery(roundId), cancellationToken));

    [HttpGet("mine")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<LecturerTopicsDto>>> ListMine([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListMyTopicsQuery(CurrentUserId, roundId), cancellationToken));

    [HttpGet("published")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<RoundTopicsDto>>> ListPublished([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListPublishedTopicsQuery(CurrentUserId, roundId), cancellationToken));

    // Tình trạng nhóm và ghi danh của sinh viên trong đợt (PDR-054).
    [HttpGet("my-registration")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<MyRegistrationDto>>> MyRegistration([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new GetMyRegistrationQuery(CurrentUserId, roundId), cancellationToken));

    [HttpGet("my-proposals")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<StudentProposalsDto>>> MyProposals([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListMyProposalsQuery(CurrentUserId, roundId), cancellationToken));

    [HttpGet("proposal-supervisors")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<TopicPersonDto>>>> ProposalSupervisors([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListProposalSupervisorsQuery(CurrentUserId, roundId), cancellationToken));

    [HttpGet("proposals")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<LecturerProposalsDto>>> Proposals([FromQuery] Guid roundId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ListLecturerProposalsQuery(CurrentUserId, roundId), cancellationToken));

    [HttpPost("proposals")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<TopicDto>>> CreateProposal(ProposalInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CreateProposalCommand(CurrentUserId, dto), cancellationToken));

    [HttpPut("proposals/{id:guid}")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<TopicDto>>> UpdateProposal(Guid id, ProposalUpdateDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new UpdateProposalCommand(CurrentUserId, id, dto), cancellationToken));

    [HttpDelete("proposals/{id:guid}")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<TopicDto>>> CancelProposal(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CancelProposalCommand(CurrentUserId, id), cancellationToken));

    [HttpPost("proposals/{id:guid}/accept")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<TopicDto>>> AcceptProposal(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new AcceptProposalCommand(CurrentUserId, id), cancellationToken));

    [HttpPost("proposals/{id:guid}/reject")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<TopicDto>>> RejectProposal(Guid id, RejectProposalDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new RejectProposalCommand(CurrentUserId, id, dto.Reason), cancellationToken));

    // Người gọi là đại diện; memberCodes là mã sinh viên thành viên thứ hai (nếu có).
    [HttpPost("{id:guid}/registration")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<MyRegistrationDto>>> Register(Guid id, RegisterTopicDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new RegisterTopicCommand(CurrentUserId, id, dto.MemberCodes), cancellationToken));

    // Bất kỳ thành viên nào hủy cho cả nhóm; nhóm giữ nguyên (PDR-047).
    [HttpDelete("{id:guid}/registration")]
    [Authorize(Roles = AppRoles.Student)]
    public async Task<ActionResult<ApiResponse<MyRegistrationDto>>> CancelRegistration(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CancelRegistrationCommand(CurrentUserId, id), cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Roles = $"{AppRoles.AcademicAffairs},{AppRoles.Lecturer},{AppRoles.Student}")]
    public async Task<ActionResult<ApiResponse<TopicDetailDto>>> Get(Guid id, CancellationToken cancellationToken)
    {
        var role = User.IsInRole(AppRoles.AcademicAffairs) ? ViewerRole.AcademicAffairs
            : User.IsInRole(AppRoles.Lecturer) ? ViewerRole.Lecturer : ViewerRole.Student;
        return ToAction(await sender.Send(new GetTopicQuery(id, CurrentUserId, role), cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<TopicDto>>> Create(TopicInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CreateTopicCommand(CurrentUserId, dto), cancellationToken));

    [HttpPut("{id:guid}")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<TopicDto>>> Update(Guid id, TopicInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new UpdateTopicCommand(CurrentUserId, id, dto), cancellationToken));

    // Trả 200 kèm ApiResponse<bool> vì frontend luôn đọc thân JSON.
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = AppRoles.Lecturer)]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new DeleteTopicCommand(CurrentUserId, id), cancellationToken));

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);

    private ActionResult<ApiResponse<T>> ToAction<T>(TopicResult<T> result) => result.Status switch
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
