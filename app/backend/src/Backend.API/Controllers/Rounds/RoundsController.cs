using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Rounds;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Rounds;

// Đợt khóa luận, mốc thời gian và người tham gia (màn GiaoVu-DotKhoaLuan).
// {kind} là "lecturers" hoặc "students"; giá trị khác trả 400 kèm ApiResponse (validator),
// không dùng ràng buộc route để frontend luôn nhận được thông báo lỗi.
[ApiController]
[Route("api/rounds")]
[Authorize]
public sealed class RoundsController(ISender sender) : ControllerBase
{
    // Xem đợt mở cho cả ba vai trò (Trang chủ GV/SV); thao tác còn lại chỉ Giáo vụ.
    [HttpGet]
    [Authorize(Roles = $"{AppRoles.AcademicAffairs},{AppRoles.Lecturer},{AppRoles.Student}")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<RoundDto>>>> GetAll(
        [FromQuery] string? status, [FromQuery] string? program, [FromQuery] string? search, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetRoundsQuery(status, program, search, ViewerId), cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Roles = $"{AppRoles.AcademicAffairs},{AppRoles.Lecturer},{AppRoles.Student}")]
    public async Task<ActionResult<ApiResponse<RoundDto>>> GetById(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new GetRoundQuery(id, ViewerId), cancellationToken));

    // Giáo vụ: null (thấy mọi đợt). GV/SV: mã tài khoản để lọc đợt mình tham gia.
    private Guid? ViewerId => User.IsInRole(AppRoles.AcademicAffairs)
        ? null
        : Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);

    [HttpPost]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<RoundDto>>> Create(RoundInputDto dto, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new CreateRoundCommand(dto), cancellationToken);
        return result.Status == RoundResultStatus.Created
            ? CreatedAtAction(nameof(GetById), new { id = result.Response.Data!.Id }, result.Response)
            : ToAction(result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<RoundDto>>> Update(Guid id, RoundInfoDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new UpdateRoundCommand(id, dto), cancellationToken));

    [HttpPut("{id:guid}/milestones")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<RoundDto>>> UpdateMilestones(Guid id, RoundMilestonesInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new UpdateRoundMilestonesCommand(id, dto), cancellationToken));

    [HttpPost("{id:guid}/open")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<RoundDto>>> Open(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new OpenRoundCommand(id), cancellationToken));

    [HttpPost("{id:guid}/finish")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<RoundDto>>> Finish(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new FinishRoundCommand(id), cancellationToken));

    // Trả 200 kèm ApiResponse<bool> (không phải 204) vì frontend luôn đọc thân JSON.
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new DeleteRoundCommand(id), cancellationToken));

    [HttpGet("people/{kind}")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ParticipantDto>>>> GetPeople(string kind, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetPeopleQuery(kind), cancellationToken));

    [HttpGet("{id:guid}/{kind}/candidates")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<CandidateDto>>>> GetCandidates(Guid id, string kind, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new GetCandidatesQuery(id, kind), cancellationToken));

    [HttpPost("{id:guid}/{kind}/check")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ParticipantCheckDto>>>> Check(Guid id, string kind, ParticipantCodesDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new CheckParticipantsCommand(id, kind, dto.Codes), cancellationToken));

    [HttpPost("{id:guid}/{kind}")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<AddParticipantsResultDto>>> AddParticipants(Guid id, string kind, ParticipantCodesDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new AddParticipantsCommand(id, kind, dto.Codes), cancellationToken));

    [HttpDelete("{id:guid}/{kind}/{userId:guid}")]
    [Authorize(Roles = AppRoles.AcademicAffairs)]
    public async Task<ActionResult<ApiResponse<RoundDto>>> RemoveParticipant(Guid id, string kind, Guid userId, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new RemoveParticipantCommand(id, kind, userId), cancellationToken));

    private ActionResult<ApiResponse<T>> ToAction<T>(RoundResult<T> result) => result.Status switch
    {
        RoundResultStatus.Ok => Ok(result.Response),
        RoundResultStatus.Created => StatusCode(StatusCodes.Status201Created, result.Response),
        RoundResultStatus.NotFound => NotFound(result.Response),
        RoundResultStatus.Conflict => Conflict(result.Response),
        _ => BadRequest(result.Response)
    };
}
