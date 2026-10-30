using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Evaluations;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Evaluations;

// Mẫu phiếu đánh giá và việc gán mẫu cho vai trò chấm theo đợt (màn GiaoVu-PhieuDanhGia).
[ApiController]
[Route("api/evaluation-templates")]
[Authorize(Roles = AppRoles.AcademicAffairs)]
public sealed class EvaluationTemplatesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<EvaluationTemplateDto>>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetEvaluationTemplatesQuery(), cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<EvaluationTemplateDto>>> GetById(Guid id, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new GetEvaluationTemplateQuery(id), cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<EvaluationTemplateDto>>> Create(EvaluationTemplateInputDto dto, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new CreateEvaluationTemplateCommand(dto), cancellationToken);
        return result.Status == EvaluationResultStatus.Created
            ? CreatedAtAction(nameof(GetById), new { id = result.Response.Data!.Id }, result.Response)
            : ToAction(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<EvaluationTemplateDto>>> Update(Guid id, EvaluationTemplateInputDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new UpdateEvaluationTemplateCommand(id, dto), cancellationToken));

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<EvaluationTemplateDto>>> ChangeStatus(Guid id, EvaluationTemplateStatusDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new ChangeEvaluationTemplateStatusCommand(id, dto.Status), cancellationToken));

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, [FromQuery] bool removeAssignments, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new DeleteEvaluationTemplateCommand(id, removeAssignments), cancellationToken));

    [HttpGet("assignments")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<EvaluationAssignmentDto>>>> GetAssignments([FromQuery] string? roundId, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new GetEvaluationAssignmentsQuery(roundId), cancellationToken));

    [HttpPut("assignments/{roundId}/{role}")]
    public async Task<ActionResult<ApiResponse<EvaluationAssignmentDto>>> Assign(string roundId, string role, AssignEvaluationTemplateDto dto, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new AssignEvaluationTemplateCommand(roundId, role, dto.TemplateId), cancellationToken));

    [HttpDelete("assignments/{roundId}/{role}")]
    public async Task<ActionResult<ApiResponse<bool>>> Unassign(string roundId, string role, CancellationToken cancellationToken) =>
        ToAction(await sender.Send(new UnassignEvaluationTemplateCommand(roundId, role), cancellationToken));

    private ActionResult<ApiResponse<T>> ToAction<T>(EvaluationResult<T> result) => result.Status switch
    {
        EvaluationResultStatus.Ok => Ok(result.Response),
        EvaluationResultStatus.Created => StatusCode(StatusCodes.Status201Created, result.Response),
        EvaluationResultStatus.NotFound => NotFound(result.Response),
        EvaluationResultStatus.Conflict => Conflict(result.Response),
        _ => BadRequest(result.Response)
    };
}
