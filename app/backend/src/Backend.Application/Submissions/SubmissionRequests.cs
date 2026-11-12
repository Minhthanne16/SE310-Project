using Backend.Application.Common.Storage;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Backend.Application.Submissions;

// Báo cáo giữa kỳ/cuối kỳ (P04-S02, PDR-056). Thành viên nhóm nộp; nhóm, GVHD của đề tài và Giáo vụ
// xem/tải. Người không có quan hệ với đề tài nhận 404 để không lộ đề tài.
public class SubmissionVersionDto
{
    public Guid Id { get; set; }
    public int Version { get; set; }
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? Note { get; set; }
    public DateTime SubmittedAt { get; set; }
    public TopicPersonDto SubmittedBy { get; set; } = new();
    public bool IsLate { get; set; }
    public bool IsLatest { get; set; }
    // Đường dẫn API có kiểm tra quyền; không phải địa chỉ của object storage.
    public string DownloadUrl { get; set; } = string.Empty;
}

public class SubmissionKindDto
{
    // midterm | final
    public string Kind { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    // yyyy-MM-dd; chuỗi rỗng nếu mốc chưa đặt ngày.
    public string Deadline { get; set; } = string.Empty;
    public bool AllowLate { get; set; }
    // Hạn trễ đang có hiệu lực của mốc; chuỗi rỗng khi tắt nộp trễ.
    public string LateDeadline { get; set; } = string.Empty;
    // onTime | late | closed
    public string Window { get; set; } = string.Empty;
    public bool CanSubmit { get; set; }
    public string? BlockedReason { get; set; }
    public bool NoteRequired { get; set; }
    // Mới nhất trước.
    public List<SubmissionVersionDto> Versions { get; set; } = [];
}

public class TopicSubmissionsDto
{
    public Guid TopicId { get; set; }
    public long MaxBytes { get; set; } = SubmissionPolicy.MaxBytes;
    public List<SubmissionKindDto> Kinds { get; set; } = [];
}

public sealed record SubmissionFile(byte[] Content, string FileName);

public record ListSubmissionsQuery(Guid ViewerId, ViewerRole Role, Guid TopicId) : IRequest<TopicResult<TopicSubmissionsDto>>;
public record SubmitReportCommand(Guid ViewerId, ViewerRole Role, Guid TopicId, string? Kind, string? FileName, byte[] Content, string? Note)
    : IRequest<TopicResult<TopicSubmissionsDto>>;
public record GetSubmissionFileQuery(Guid ViewerId, ViewerRole Role, Guid SubmissionId) : IRequest<TopicResult<SubmissionFile>>;

internal enum SubmissionAccess { None, Reader, Member }

internal sealed record SubmissionContext(ThesisTopic Topic, ThesisRound Round, SubmissionAccess Access);

internal static class SubmissionMapping
{
    // Quyền theo vai trò và quan hệ với đề tài (ROLES · Nguyên tắc truy cập). Phản biện và hội đồng
    // được thêm ở đây khi có mô-đun phân công (P05/P06).
    public static async Task<SubmissionContext?> Load(Guid topicId, Guid viewerId, ViewerRole role,
        ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(topicId, cancellationToken);
        if (topic is null) return null;
        var round = (await rounds.GetByIdAsync(topic.RoundId, cancellationToken))!;
        var access = role switch
        {
            ViewerRole.AcademicAffairs => SubmissionAccess.Reader,
            ViewerRole.Lecturer => topic.SupervisorId == viewerId ? SubmissionAccess.Reader : SubmissionAccess.None,
            _ => topic.GroupId is { } groupId && (await groups.GetGroupsAsync([groupId], cancellationToken))
                .GetValueOrDefault(groupId)?.Members.Any(m => m.StudentId == viewerId) == true
                ? SubmissionAccess.Member
                : SubmissionAccess.None
        };
        return new SubmissionContext(topic, round, access);
    }

    public static TopicSubmissionsDto ToDto(SubmissionContext context, IReadOnlyList<Submission> submissions, DateOnly today) => new()
    {
        TopicId = context.Topic.Id,
        Kinds = SubmissionRules.Kinds.Select(kind =>
        {
            var milestone = context.Round.Milestones.FirstOrDefault(m => m.Key == SubmissionRules.MilestoneOf(kind));
            var blocker = SubmissionRules.Blocker(context.Topic, context.Round, kind, today);
            var versions = submissions.Where(s => s.Kind == kind).OrderByDescending(s => s.Version).ToList();
            return new SubmissionKindDto
            {
                Kind = SubmissionRules.KindName(kind),
                Name = SubmissionRules.KindLabel(kind),
                Deadline = RoundRules.FormatDate(milestone?.EndDate),
                AllowLate = milestone?.AllowLate == true,
                LateDeadline = RoundRules.FormatDate(SubmissionRules.LateDeadline(milestone)),
                Window = SubmissionRules.Window(milestone, today) switch
                {
                    SubmissionWindow.OnTime => "onTime",
                    SubmissionWindow.Late => "late",
                    _ => "closed"
                },
                CanSubmit = context.Access == SubmissionAccess.Member && blocker is null,
                BlockedReason = blocker,
                NoteRequired = SubmissionRules.NoteRequired(kind),
                Versions = versions.Select((s, index) => new SubmissionVersionDto
                {
                    Id = s.Id,
                    Version = s.Version,
                    FileName = s.FileName,
                    SizeBytes = s.SizeBytes,
                    Note = s.Note,
                    SubmittedAt = DateTime.SpecifyKind(s.CreatedAt, DateTimeKind.Utc),
                    SubmittedBy = new TopicPersonDto
                    {
                        Id = s.SubmittedById,
                        Code = s.SubmittedBy?.UserCode ?? string.Empty,
                        Name = s.SubmittedBy?.FullName ?? string.Empty
                    },
                    IsLate = s.IsLate,
                    IsLatest = index == 0,
                    DownloadUrl = $"/api/submissions/{s.Id}/file"
                }).ToList()
            };
        }).ToList()
    };
}

public sealed class ListSubmissionsHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ISubmissionRepository submissions, TimeProvider clock)
    : IRequestHandler<ListSubmissionsQuery, TopicResult<TopicSubmissionsDto>>
{
    public async Task<TopicResult<TopicSubmissionsDto>> Handle(ListSubmissionsQuery request, CancellationToken cancellationToken)
    {
        var context = await SubmissionMapping.Load(request.TopicId, request.ViewerId, request.Role, topics, rounds, groups, cancellationToken);
        if (context is null || context.Access == SubmissionAccess.None)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.NotFound, SubmissionRules.NotFoundMessage);
        var list = await submissions.ListByTopicAsync(context.Topic.Id, cancellationToken);
        return TopicResult<TopicSubmissionsDto>.Ok(SubmissionMapping.ToDto(context, list, RoundRules.TodayVietnam(clock)));
    }
}

public sealed class SubmitReportHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ISubmissionRepository submissions, IDocumentStorage storage, TimeProvider clock, ILogger<SubmitReportHandler> logger)
    : IRequestHandler<SubmitReportCommand, TopicResult<TopicSubmissionsDto>>
{
    public async Task<TopicResult<TopicSubmissionsDto>> Handle(SubmitReportCommand request, CancellationToken cancellationToken)
    {
        static TopicResult<TopicSubmissionsDto> Fail(TopicResultStatus status, string message) =>
            TopicResult<TopicSubmissionsDto>.Fail(status, message);

        // Quyền trước, rồi mới tới nội dung: người ngoài không dò được quy tắc hay hạn của đề tài.
        var context = await SubmissionMapping.Load(request.TopicId, request.ViewerId, request.Role, topics, rounds, groups, cancellationToken);
        if (context is null || context.Access == SubmissionAccess.None) return Fail(TopicResultStatus.NotFound, SubmissionRules.NotFoundMessage);
        if (context.Access != SubmissionAccess.Member) return Fail(TopicResultStatus.Forbidden, SubmissionRules.OnlyMembersMessage);

        if (!SubmissionRules.TryParseKind(request.Kind, out var kind)) return Fail(TopicResultStatus.Invalid, SubmissionPolicy.InvalidKindMessage);
        if (request.Content.Length == 0) return Fail(TopicResultStatus.Invalid, SubmissionPolicy.MissingFileMessage);
        if (request.Content.LongLength > SubmissionPolicy.MaxBytes) return Fail(TopicResultStatus.Invalid, SubmissionPolicy.TooLargeMessage);
        if (!SubmissionPolicy.IsPdf(request.Content)) return Fail(TopicResultStatus.Invalid, SubmissionPolicy.NotPdfMessage);
        var note = TopicRules.CleanOptional(request.Note);
        if (note is null && SubmissionRules.NoteRequired(kind)) return Fail(TopicResultStatus.Invalid, SubmissionPolicy.NoteRequiredMessage);
        if (note is { Length: > SubmissionPolicy.MaxNoteLength }) return Fail(TopicResultStatus.Invalid, SubmissionPolicy.NoteTooLongMessage);

        var now = clock.GetUtcNow().UtcDateTime;
        var today = RoundRules.TodayVietnam(clock);
        if (SubmissionRules.Blocker(context.Topic, context.Round, kind, today) is { } blocker) return Fail(TopicResultStatus.Conflict, blocker);
        var milestone = context.Round.Milestones.FirstOrDefault(m => m.Key == SubmissionRules.MilestoneOf(kind));
        var late = SubmissionRules.Window(milestone, today) == SubmissionWindow.Late;

        var submission = new Submission
        {
            TopicId = context.Topic.Id,
            Kind = kind,
            FileName = SubmissionPolicy.CleanFileName(request.FileName),
            ObjectKey = SubmissionPolicy.NewObjectKey(context.Topic.Id, kind),
            SizeBytes = request.Content.LongLength,
            Note = note,
            SubmittedById = request.ViewerId,
            IsLate = late,
            CreatedAt = now
        };
        var history = TopicMapping.History(context.Topic, request.ViewerId, TopicHistoryCategories.Submission,
            $"Nộp {SubmissionRules.KindLabel(kind).ToLowerInvariant()}", now);

        // Ghi tệp trước, bản ghi sau: storage lỗi thì chưa có bản ghi nào (ngoại lệ thành 503);
        // database lỗi thì xóa tệp vừa ghi để không còn tệp mồ côi.
        await storage.SaveAsync(submission.ObjectKey, request.Content, SubmissionPolicy.ContentType, cancellationToken);
        try
        {
            // Số phiên bản chỉ có sau khi lưu; mục lịch sử lấy số đó trong repository.
            await submissions.AddAsync(submission, history, cancellationToken);
        }
        catch
        {
            try
            {
                await storage.DeleteAsync(submission.ObjectKey, CancellationToken.None);
            }
            catch (Exception cleanup)
            {
                logger.LogError(cleanup, "Could not remove orphan submission object {ObjectKey}", submission.ObjectKey);
            }
            throw;
        }

        var list = await submissions.ListByTopicAsync(context.Topic.Id, cancellationToken);
        var message = late ? $"Đã nộp bản {submission.Version} (nộp trễ)." : $"Đã nộp bản {submission.Version}.";
        return TopicResult<TopicSubmissionsDto>.Created(SubmissionMapping.ToDto(context, list, today), message);
    }
}

public sealed class GetSubmissionFileHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ISubmissionRepository submissions, IDocumentStorage storage)
    : IRequestHandler<GetSubmissionFileQuery, TopicResult<SubmissionFile>>
{
    public async Task<TopicResult<SubmissionFile>> Handle(GetSubmissionFileQuery request, CancellationToken cancellationToken)
    {
        var submission = await submissions.GetByIdAsync(request.SubmissionId, cancellationToken);
        var context = submission is null ? null
            : await SubmissionMapping.Load(submission.TopicId, request.ViewerId, request.Role, topics, rounds, groups, cancellationToken);
        if (submission is null || context is null || context.Access == SubmissionAccess.None)
            return TopicResult<SubmissionFile>.Fail(TopicResultStatus.NotFound, SubmissionRules.SubmissionNotFoundMessage);

        var content = await storage.ReadAsync(submission.ObjectKey, cancellationToken);
        return content is null
            ? TopicResult<SubmissionFile>.Fail(TopicResultStatus.NotFound, SubmissionRules.FileMissingMessage)
            : TopicResult<SubmissionFile>.Ok(new SubmissionFile(content, submission.FileName));
    }
}
