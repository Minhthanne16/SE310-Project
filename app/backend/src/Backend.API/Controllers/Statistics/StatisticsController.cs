using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Statistics;
using Backend.Application.Topics;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Statistics;

[ApiController]
[Route("api/statistics")]
[Authorize(Roles = AppRoles.AcademicAffairs)]
public sealed class StatisticsController(ISender sender) : ControllerBase
{
    [HttpGet("{roundId:guid}")]
    public async Task<IActionResult> Get(Guid roundId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetRoundStatisticsQuery(roundId), cancellationToken);
        return result.Status == TopicResultStatus.Ok ? Ok(result.Response) : NotFound(result.Response);
    }

    [HttpGet("{roundId:guid}/topics.csv")]
    public async Task<IActionResult> Topics(Guid roundId, [FromQuery] string? status,
        [FromQuery] string? search, [FromQuery] Guid? supervisorId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetRoundStatisticsQuery(roundId), cancellationToken);
        if (result.Status != TopicResultStatus.Ok || result.Response.Data is null)
            return NotFound(result.Response);
        var rows = StatisticsExport.Filter(result.Response.Data, status, search, supervisorId)
            .Select(StatisticsExport.TopicRow);
        return Csv(StatisticsExport.Csv(StatisticsExport.TopicHeader, rows), "danh-sach-de-tai", roundId);
    }

    [HttpGet("{roundId:guid}/registrations.csv")]
    public async Task<IActionResult> Registrations(Guid roundId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetRoundStatisticsQuery(roundId), cancellationToken);
        if (result.Status != TopicResultStatus.Ok || result.Response.Data is null)
            return NotFound(result.Response);
        return Csv(StatisticsExport.Csv(StatisticsExport.RegistrationHeader,
            StatisticsExport.RegistrationRows(result.Response.Data)), "danh-sach-dang-ky", roundId);
    }

    [HttpGet("{roundId:guid}/grades.csv")]
    public async Task<IActionResult> Grades(Guid roundId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetRoundStatisticsQuery(roundId), cancellationToken);
        if (result.Status != TopicResultStatus.Ok) return NotFound(result.Response);
        // CP07 chưa lưu phiếu điểm đã xác nhận/công bố: từ chối xuất để không lộ điểm demo.
        return Conflict(ApiResponse<object>.Fail("Chưa thể xuất bảng điểm: cần hoàn tất CP07 và dữ liệu xác nhận/công bố."));
    }

    private FileContentResult Csv(byte[] bytes, string prefix, Guid roundId) =>
        File(bytes, "text/csv; charset=utf-8", $"{prefix}-{roundId:N}.csv");
}
