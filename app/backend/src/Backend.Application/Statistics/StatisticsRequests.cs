using Backend.Application.Common;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;
using System.Text;

namespace Backend.Application.Statistics;

public sealed record GetRoundStatisticsQuery(Guid RoundId) : IRequest<TopicResult<RoundStatisticsDto>>;

public sealed class TopicStatisticsRowDto
{
    public TopicDto Topic { get; set; } = new();
    // Mỗi ô phản ánh bằng chứng đã lưu, không suy diễn chặng từ lịch mốc.
    public bool[] Stages { get; set; } = new bool[6];
    public string Progress { get; set; } = string.Empty;
}

public sealed class StatisticsLoadDto : LecturerLoadDto
{
    public string LecturerCode { get; set; } = string.Empty;
    public string LecturerName { get; set; } = string.Empty;
}

public sealed class RoundStatisticsDto
{
    public Guid RoundId { get; set; }
    public string RoundName { get; set; } = string.Empty;
    public string RoundStatus { get; set; } = string.Empty;
    public DateTime SnapshotAt { get; set; }
    public List<TopicStatisticsRowDto> Items { get; set; } = [];
    public List<StatisticsLoadDto> Loads { get; set; } = [];
    public List<ParticipantDto> Students { get; set; } = [];
    // CP07 chưa có các phiếu điểm/biên bản xác nhận trong CSDL.
    public bool GradesAvailable => false;
}

public sealed class GetRoundStatisticsHandler(
    ISender sender, IRoundRepository rounds, ISubmissionRepository submissions, TimeProvider clock)
    : IRequestHandler<GetRoundStatisticsQuery, TopicResult<RoundStatisticsDto>>
{
    public async Task<TopicResult<RoundStatisticsDto>> Handle(GetRoundStatisticsQuery request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.RoundId, cancellationToken);
        if (round is null)
            return TopicResult<RoundStatisticsDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);

        var result = await sender.Send(new ListRoundTopicsQuery(request.RoundId), cancellationToken);
        if (result.Status != TopicResultStatus.Ok || result.Response.Data is null)
            return TopicResult<RoundStatisticsDto>.Fail(result.Status, result.Response.Message);

        var list = result.Response.Data;
        var rows = new List<TopicStatisticsRowDto>(list.Items.Count);
        foreach (var topic in list.Items)
        {
            var reports = topic.Group.Count == 0
                ? []
                : await submissions.ListReportsAsync(topic.Id, cancellationToken);
            var hasGroup = topic.Group.Count > 0 && topic.Status is not
                ("Chờ GV duyệt" or "Bị từ chối" or "Đã hủy");
            var midterm = hasGroup && reports.Any(s => s.Kind == SubmissionKind.Midterm);
            var final = hasGroup && reports.Any(s => s.Kind == SubmissionKind.Final);
            var graded = topic.Status is "Đã cho điểm" or "Có lệch điểm" or "Đã xác nhận" or "Đã hoàn tất";
            var completed = topic.Status == "Đã hoàn tất";
            var stages = new[] { hasGroup, hasGroup && topic.OutlineApprovedAt is not null,
                midterm, final, graded, completed };
            var progress = topic.FinalLockedVersionNo is { } version ? $"Đã chốt Bản {version}"
                : topic.ThesisVersionCount > 0 ? $"{topic.ThesisVersionCount} bản khóa luận · chưa chốt"
                : final ? "Đã nộp báo cáo cuối kỳ"
                : midterm ? "Đã nộp báo cáo giữa kỳ"
                : stages[1] ? "Đã duyệt đề cương"
                : hasGroup ? "Chờ duyệt đề cương" : "—";
            rows.Add(new TopicStatisticsRowDto { Topic = topic, Stages = stages, Progress = progress });
        }

        var students = round.Participants.Where(p => p.Kind == ParticipantKind.Student && p.User is not null)
            .Select(p => RoundMapping.ToParticipant(p.User!)).OrderBy(p => p.Code).ToList();
        var lecturers = round.Participants.Where(p => p.Kind == ParticipantKind.Lecturer && p.User is not null)
            .ToDictionary(p => p.UserId, p => p.User!);
        var loads = list.Loads.Select(load => new StatisticsLoadDto
        {
            LecturerId = load.LecturerId, Count = load.Count, Min = load.Min, Max = load.Max,
            Level = load.Level,
            LecturerCode = lecturers.GetValueOrDefault(load.LecturerId)?.UserCode ?? string.Empty,
            LecturerName = lecturers.GetValueOrDefault(load.LecturerId)?.FullName ?? string.Empty
        }).OrderBy(l => l.LecturerName).ToList();

        return TopicResult<RoundStatisticsDto>.Ok(new RoundStatisticsDto
        {
            RoundId = request.RoundId, RoundName = round.Name, RoundStatus = list.Round.RoundStatus,
            SnapshotAt = clock.GetUtcNow().UtcDateTime, Items = rows, Loads = loads, Students = students
        });
    }
}

public static class StatisticsExport
{
    public static readonly string[] TopicHeader =
        ["Mã", "Tên đề tài", "Lĩnh vực", "GV hướng dẫn", "Nhóm", "Nguồn", "Trạng thái", "Tiến độ khóa luận"];
    public static readonly string[] RegistrationHeader =
        ["MSSV", "Họ tên", "Lớp", "Mã đề tài", "Tên đề tài", "GV hướng dẫn", "Trạng thái đăng ký"];

    public static List<TopicStatisticsRowDto> Filter(RoundStatisticsDto statistics, string? status, string? search, Guid? supervisorId) =>
        statistics.Items.Where(row =>
            (string.IsNullOrWhiteSpace(status) || row.Topic.Status == status) &&
            (supervisorId is null || row.Topic.Supervisor.Id == supervisorId) &&
            (string.IsNullOrWhiteSpace(search) ||
             new[] { row.Topic.Code, row.Topic.Title, row.Topic.Supervisor.Code, row.Topic.Supervisor.Name }
                .Concat(row.Topic.Group.SelectMany(m => new[] { m.Code, m.Name }))
                .Any(text => text.Contains(search.Trim(), StringComparison.CurrentCultureIgnoreCase))))
            .OrderBy(row => row.Topic.Code).ToList();

    public static string[] TopicRow(TopicStatisticsRowDto row)
    {
        var t = row.Topic;
        return [t.Code, t.Title, t.Field, t.Supervisor.Name,
            string.Join("; ", t.Group.Select(m => $"{m.Code} {m.Name}")), t.Source, t.Status, row.Progress];
    }

    public static IEnumerable<string[]> RegistrationRows(RoundStatisticsDto statistics)
    {
        foreach (var student in statistics.Students.OrderBy(s => s.Code))
        {
            var matching = statistics.Items.Where(r => r.Topic.Group.Any(m => m.Id == student.Id))
                .OrderByDescending(r => RegistrationRank(r.Topic.Status)).ThenBy(r => r.Topic.Code).FirstOrDefault();
            var topic = matching?.Topic;
            yield return [student.Code, student.Name, student.Unit,
                topic?.Code ?? "", topic?.Title ?? "", topic?.Supervisor.Name ?? "",
                topic is null ? "Chưa có đề tài" : RegistrationStatus(topic.Status)];
        }
    }

    private static string RegistrationStatus(string status) => status switch
    {
        "Chờ GV duyệt" => "Chờ GV duyệt",
        "Bị từ chối" => "Bị từ chối",
        _ => "Đã đăng ký"
    };

    private static int RegistrationRank(string status) => status switch
    {
        "Chờ GV duyệt" => 2,
        "Bị từ chối" => 1,
        _ => 3
    };

    public static string Escape(string? value)
    {
        var text = value ?? string.Empty;
        // Excel có thể bỏ qua khoảng trắng/control đầu chuỗi khi tìm công thức.
        if (text.AsSpan().TrimStart().StartsWith('=') || text.AsSpan().TrimStart().StartsWith('+') ||
            text.AsSpan().TrimStart().StartsWith('-') || text.AsSpan().TrimStart().StartsWith('@') ||
            text.StartsWith('\t') || text.StartsWith('\r') || text.StartsWith('\n'))
            text = "'" + text;
        return text.IndexOfAny([',', '"', '\r', '\n']) < 0 ? text : $"\"{text.Replace("\"", "\"\"")}\"";
    }

    public static byte[] Csv(string[] header, IEnumerable<string[]> rows)
    {
        var csv = new StringBuilder();
        csv.AppendLine(string.Join(',', header.Select(Escape)));
        foreach (var row in rows) csv.AppendLine(string.Join(',', row.Select(Escape)));
        return new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetPreamble()
            .Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
    }
}
