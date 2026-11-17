using Backend.Application.Common.Storage;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Backend.Application.Submissions;

// Báo cáo giữa kỳ/cuối kỳ (P04-S02, PDR-056, PDR-060). Thành viên nhóm nộp; nhóm, GVHD của đề tài và Giáo vụ
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
    public bool IsFinal { get; set; }
    // Đường dẫn API có kiểm tra quyền; không phải địa chỉ của object storage.
    public string DownloadUrl { get; set; } = string.Empty;
    public string? ReviewComment { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public List<Guid> AddressedRequestIds { get; set; } = [];
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
    public bool CanReview { get; set; }
    public bool CanLock { get; set; }
    // Lý do chưa chốt được bản cuối (còn yêu cầu chỉnh sửa Cuối kỳ mở); null nếu không bị chặn vì lý do này.
    public string? LockBlockedReason { get; set; }
    public string ExtensionDeadline { get; set; } = string.Empty;
    public string? ExtensionReason { get; set; }
    public bool WaitingException { get; set; }
    public bool CanGrantExtension { get; set; }
    public bool CanMarkIneligible { get; set; }
    public string? IneligibleReason { get; set; }
    // Mới nhất trước.
    public List<SubmissionVersionDto> Versions { get; set; } = [];
    // Yêu cầu mở trước, rồi theo thời điểm tạo mới nhất.
    public List<RevisionRequestDto> Requests { get; set; } = [];
}

public class TopicSubmissionsDto
{
    public Guid TopicId { get; set; }
    public long MaxBytes { get; set; } = SubmissionPolicy.MaxBytes;
    public List<SubmissionKindDto> Kinds { get; set; } = [];
}

public class SubmissionCommentInputDto
{
    public string? Comment { get; set; }
}

public class SubmissionRevisionRequestInputDto
{
    public string? Kind { get; set; }
    public string? Content { get; set; }
}

public record ListSubmissionsQuery(Guid ViewerId, ViewerRole Role, Guid TopicId) : IRequest<TopicResult<TopicSubmissionsDto>>;
public record SubmitReportCommand(Guid ViewerId, ViewerRole Role, Guid TopicId, string? Kind, string? FileName, byte[] Content, string? Note)
    : IRequest<TopicResult<TopicSubmissionsDto>>;
public record GetSubmissionFileQuery(Guid ViewerId, ViewerRole Role, Guid SubmissionId) : IRequest<TopicResult<SubmissionFile>>;

public record CommentSubmissionCommand(Guid LecturerId, Guid TopicId, Guid SubmissionId, string? Comment)
    : IRequest<TopicResult<TopicSubmissionsDto>>;
public record CreateSubmissionRevisionRequestCommand(Guid LecturerId, Guid TopicId, string? Kind, string? Content)
    : IRequest<TopicResult<TopicSubmissionsDto>>;
public record ResolveSubmissionRevisionRequestCommand(Guid LecturerId, Guid TopicId, Guid RequestId)
    : IRequest<TopicResult<TopicSubmissionsDto>>;

internal enum SubmissionAccess { None, Reader, Supervisor, Member }

internal sealed record SubmissionContext(ThesisTopic Topic, ThesisRound Round, SubmissionAccess Access, ViewerRole Role);

internal static class SubmissionMapping
{
    // Quyền theo vai trò và quan hệ với đề tài (ROLES · Nguyên tắc truy cập). GVPB hiện tại chỉ đọc
    // (PDR-062); Chủ tịch/Thư ký của hội đồng đã công bố cũng chỉ đọc (P06, PDR-063).
    public static async Task<SubmissionContext?> Load(Guid topicId, Guid viewerId, ViewerRole role,
        ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(topicId, cancellationToken);
        if (topic is null) return null;
        var round = (await rounds.GetByIdAsync(topic.RoundId, cancellationToken))!;
        var access = role switch
        {
            ViewerRole.AcademicAffairs => SubmissionAccess.Reader,
            ViewerRole.Lecturer => topic.SupervisorId == viewerId ? SubmissionAccess.Supervisor
                : topic.ReviewerId == viewerId ? SubmissionAccess.Reader
                : await Topics.OutlineAccess.IsCouncilMemberAsync(topics, topic.Id, viewerId, cancellationToken) ? SubmissionAccess.Reader
                : SubmissionAccess.None,
            _ => topic.GroupId is { } groupId && (await groups.GetGroupsAsync([groupId], cancellationToken))
                .GetValueOrDefault(groupId)?.Members.Any(m => m.StudentId == viewerId) == true
                ? SubmissionAccess.Member
                : SubmissionAccess.None
        };
        return new SubmissionContext(topic, round, access, role);
    }

    public static async Task<TopicSubmissionsDto> BuildAsync(SubmissionContext context, ISubmissionRepository repository,
        ITopicRepository topics, DateOnly today, CancellationToken cancellationToken)
    {
        var list = await repository.ListReportsAsync(context.Topic.Id, cancellationToken);
        var requests = await repository.ListRequestsAsync(context.Topic.Id, cancellationToken);
        var links = await repository.ListLinksAsync(context.Topic.Id, cancellationToken);

        var allUserIds = list.Select(s => s.SubmittedById)
            .Concat(list.Where(s => s.ReviewedById != null).Select(s => s.ReviewedById!.Value))
            .Concat(requests.Select(r => r.CreatedById))
            .Concat(requests.Where(r => r.ResolvedById != null).Select(r => r.ResolvedById!.Value))
            .Distinct().ToList();
        var names = await topics.GetUserNamesAsync(allUserIds, cancellationToken);
        var submitters = await repository.GetSubmittersAsync(list.Select(s => s.SubmittedById).Distinct().ToList(), cancellationToken);

        return ToDto(context, list, requests, links, submitters, names, today);
    }

    private static DateTime? Utc(DateTime? value) => value is { } v ? DateTime.SpecifyKind(v, DateTimeKind.Utc) : null;

    private static TopicSubmissionsDto ToDto(SubmissionContext context, IReadOnlyList<TopicSubmission> submissions,
        IReadOnlyList<RevisionRequest> requests, IReadOnlyList<RevisionRequestLink> links,
        IReadOnlyDictionary<Guid, SubmitterInfo> submitters, IReadOnlyDictionary<Guid, string> names, DateOnly today) => new()
    {
        TopicId = context.Topic.Id,
        Kinds = SubmissionRules.Kinds.Select(kind =>
        {
            var milestone = context.Round.Milestones.FirstOrDefault(m => m.Key == SubmissionRules.MilestoneOf(kind));
            var blocker = SubmissionRules.Blocker(context.Topic, context.Round, kind, today);
            var window = SubmissionRules.Window(context.Topic, milestone, kind, today);
            var versions = submissions.Where(s => s.Kind == kind).OrderByDescending(s => s.VersionNo).ToList();
            var versionOf = versions.ToDictionary(s => s.Id, s => s.VersionNo);
            var canReview = context.Access == SubmissionAccess.Supervisor && context.Round.Status == RoundStatus.Running;

            var kindRequests = requests.Where(r => r.Kind == kind)
                .OrderBy(r => r.ResolvedAt is not null).ThenByDescending(r => r.CreatedAt)
                .Select(r =>
                {
                    var addressed = links.Where(l => l.RequestId == r.Id)
                        .Select(l => versionOf.GetValueOrDefault(l.SubmissionId)).Where(v => v > 0).Order().ToList();
                    return new RevisionRequestDto
                    {
                        Id = r.Id,
                        Content = r.Content,
                        CreatedBy = names.GetValueOrDefault(r.CreatedById, string.Empty),
                        CreatedAt = Utc(r.CreatedAt)!.Value,
                        RaisedOnVersionNo = versionOf.GetValueOrDefault(r.RaisedOnSubmissionId),
                        Status = r.ResolvedAt is null ? "open" : "resolved",
                        ResolvedBy = r.ResolvedById is null ? null : names.GetValueOrDefault(r.ResolvedById.Value),
                        ResolvedAt = Utc(r.ResolvedAt),
                        AddressedInVersions = addressed,
                        CanResolve = canReview && r.ResolvedAt is null && addressed.Count > 0
                    };
                }).ToList();

            var isThesis = kind == SubmissionKind.Thesis;
            var openFinalRequests = requests.Count(r => r.Kind == SubmissionKind.Final && r.ResolvedAt is null);
            var originalExpired = milestone?.EndDate is { } end && today > end;
            var waiting = isThesis && window == SubmissionWindow.Closed && versions.Count == 0 && context.Topic.FinalThesisSubmissionId is null &&
                context.Topic.Status != TopicStatus.Ineligible && context.Topic.Status != TopicStatus.Completed;
            return new SubmissionKindDto
            {
                Kind = SubmissionRules.KindName(kind),
                Name = SubmissionRules.KindLabel(kind),
                Deadline = RoundRules.FormatDate(milestone?.EndDate),
                AllowLate = milestone?.AllowLate == true || isThesis && context.Topic.ThesisExtensionEnd is not null,
                LateDeadline = RoundRules.FormatDate(isThesis && context.Topic.ThesisExtensionEnd is { } extension
                    ? extension : SubmissionRules.LateDeadline(milestone)),
                Window = window switch
                {
                    SubmissionWindow.OnTime => "onTime",
                    SubmissionWindow.Late => "late",
                    _ => "closed"
                },
                CanSubmit = context.Access == SubmissionAccess.Member && blocker is null,
                BlockedReason = blocker,
                NoteRequired = SubmissionRules.NoteRequired(kind),
                CanReview = canReview,
                CanLock = isThesis && context.Access == SubmissionAccess.Member && versions.Count > 0 &&
                    context.Topic.FinalThesisSubmissionId is null && blocker is null && openFinalRequests == 0,
                LockBlockedReason = isThesis && context.Access == SubmissionAccess.Member && versions.Count > 0 &&
                    context.Topic.FinalThesisSubmissionId is null && blocker is null && openFinalRequests > 0
                    ? SubmissionRules.OpenFinalRequestsMessage(openFinalRequests) : null,
                ExtensionDeadline = isThesis ? RoundRules.FormatDate(context.Topic.ThesisExtensionEnd) : string.Empty,
                ExtensionReason = isThesis ? context.Topic.ThesisExtensionReason : null,
                WaitingException = waiting,
                CanGrantExtension = isThesis && originalExpired && versions.Count == 0 &&
                    context.Role == ViewerRole.AcademicAffairs && context.Topic.ThesisExtensionEnd is null &&
                    context.Topic.Status is not (TopicStatus.Ineligible or TopicStatus.Completed),
                CanMarkIneligible = waiting && context.Role == ViewerRole.AcademicAffairs &&
                    context.Topic.ThesisExtensionEnd is { } expired && today > expired,
                IneligibleReason = isThesis ? context.Topic.IneligibleReason : null,
                Versions = versions.Select((s, index) => new SubmissionVersionDto
                {
                    Id = s.Id,
                    Version = s.VersionNo,
                    FileName = s.FileName,
                    SizeBytes = s.SizeBytes,
                    Note = s.Note,
                    SubmittedAt = DateTime.SpecifyKind(s.CreatedAt, DateTimeKind.Utc),
                    SubmittedBy = new TopicPersonDto
                    {
                        Id = s.SubmittedById,
                        Code = submitters.GetValueOrDefault(s.SubmittedById)?.Code ?? string.Empty,
                        Name = submitters.GetValueOrDefault(s.SubmittedById)?.Name ?? string.Empty
                    },
                    IsLate = s.Late,
                    IsLatest = index == 0,
                    IsFinal = isThesis && s.Id == context.Topic.FinalThesisSubmissionId,
                    DownloadUrl = $"/api/submissions/{s.Id}/file",
                    ReviewComment = s.ReviewComment,
                    ReviewedBy = s.ReviewedById is null ? null : names.GetValueOrDefault(s.ReviewedById.Value),
                    ReviewedAt = Utc(s.ReviewedAt),
                    AddressedRequestIds = links.Where(l => l.SubmissionId == s.Id).Select(l => l.RequestId).ToList()
                }).ToList(),
                Requests = kindRequests
            };
        }).ToList()
    };

    public static Notification Notify(Guid recipient, Guid sender, string kind, string text, Guid topicId, Guid batch, DateTime now) => new()
    {
        BatchId = batch,
        RecipientUserId = recipient,
        SenderUserId = sender,
        Kind = kind,
        Text = text,
        Href = $"/de-tai/{topicId}",
        CreatedAt = now
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
        return TopicResult<TopicSubmissionsDto>.Ok(await SubmissionMapping.BuildAsync(context, submissions, topics, RoundRules.TodayVietnam(clock), cancellationToken));
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
        var late = SubmissionRules.Window(context.Topic, milestone, kind, today) == SubmissionWindow.Late;

        var submission = new TopicSubmission
        {
            TopicId = context.Topic.Id,
            Kind = kind,
            FileName = SubmissionPolicy.CleanFileName(request.FileName),
            ObjectKey = SubmissionPolicy.NewObjectKey(context.Topic.Id, kind),
            SizeBytes = request.Content.LongLength,
            Note = note,
            SubmittedById = request.ViewerId,
            Late = late,
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
            await submissions.AddReportAsync(submission, history, cancellationToken);
        }
        catch (Exception error)
        {
            try
            {
                await storage.DeleteAsync(submission.ObjectKey, CancellationToken.None);
            }
            catch (Exception cleanup)
            {
                logger.LogError(cleanup, "Could not remove orphan submission object {ObjectKey}", submission.ObjectKey);
            }
            if (error is ThesisSubmissionClosedException)
                return Fail(TopicResultStatus.Conflict, "Bản khóa luận cuối đã chốt hoặc đề tài đã kết thúc.");
            throw;
        }

        var message = late ? $"Đã nộp bản {submission.VersionNo} (nộp trễ)." : $"Đã nộp bản {submission.VersionNo}.";
        return TopicResult<TopicSubmissionsDto>.Created(await SubmissionMapping.BuildAsync(context, submissions, topics, today, cancellationToken), message);
    }
}

public sealed class GetSubmissionFileHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ISubmissionRepository submissions, IDocumentStorage storage)
    : IRequestHandler<GetSubmissionFileQuery, TopicResult<SubmissionFile>>
{
    public async Task<TopicResult<SubmissionFile>> Handle(GetSubmissionFileQuery request, CancellationToken cancellationToken)
    {
        var submission = await submissions.GetReportAsync(request.SubmissionId, cancellationToken);
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

public abstract class SupervisorSubmissionHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    ISubmissionRepository submissions, TimeProvider clock)
{
    protected ITopicRepository Topics => topics;
    protected IRoundRepository Rounds => rounds;
    protected IGroupRepository Groups => groups;
    protected ISubmissionRepository Submissions => submissions;
    protected TimeProvider Clock => clock;

    internal async Task<(SubmissionContext? Context, TopicResult<TopicSubmissionsDto>? Error)> LoadSupervisorAsync(
        Guid topicId, Guid lecturerId, CancellationToken cancellationToken)
    {
        var context = await SubmissionMapping.Load(topicId, lecturerId, ViewerRole.Lecturer, topics, rounds, groups, cancellationToken);
        if (context is null || context.Access == SubmissionAccess.None)
            return (null, TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.NotFound, SubmissionRules.NotFoundMessage));
        if (context.Access != SubmissionAccess.Supervisor)
            return (null, TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Forbidden, SubmissionRules.OnlySupervisorMessage));
        if (context.Round.Status != RoundStatus.Running)
            return (null, TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, SubmissionRules.RoundFinishedMessage));
        return (context, null);
    }

    internal async Task<TopicResult<TopicSubmissionsDto>> OkAsync(SubmissionContext context, string message, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(context.Topic.Id, cancellationToken) ?? context.Topic;
        return TopicResult<TopicSubmissionsDto>.Ok(await SubmissionMapping.BuildAsync(context with { Topic = topic }, submissions, topics,
            RoundRules.TodayVietnam(clock), cancellationToken), message);
    }
}

public sealed class CommentSubmissionHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    ISubmissionRepository submissions, TimeProvider clock)
    : SupervisorSubmissionHandler(topics, rounds, groups, submissions, clock),
      IRequestHandler<CommentSubmissionCommand, TopicResult<TopicSubmissionsDto>>
{
    public async Task<TopicResult<TopicSubmissionsDto>> Handle(CommentSubmissionCommand request, CancellationToken cancellationToken)
    {
        var (context, error) = await LoadSupervisorAsync(request.TopicId, request.LecturerId, cancellationToken);
        if (context is null) return error!;

        var submission = await Submissions.GetReportAsync(request.SubmissionId, cancellationToken);
        if (submission is null || submission.TopicId != context.Topic.Id)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.NotFound, SubmissionRules.SubmissionNotFoundMessage);

        var now = Clock.GetUtcNow().UtcDateTime;
        var comment = TopicRules.CleanOptional(request.Comment);
        var label = SubmissionRules.KindLabel(submission.Kind).ToLowerInvariant();
        var history = TopicMapping.History(context.Topic, request.LecturerId, TopicHistoryCategories.Submission,
            $"Nhận xét {label} lần {submission.VersionNo}", now, comment);
        await Submissions.SaveCommentAsync(submission.Id, comment, request.LecturerId, now, history, cancellationToken);
        return await OkAsync(context, "Đã lưu nhận xét", cancellationToken);
    }
}

public sealed class CreateSubmissionRevisionRequestHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    ISubmissionRepository submissions, TimeProvider clock)
    : SupervisorSubmissionHandler(topics, rounds, groups, submissions, clock),
      IRequestHandler<CreateSubmissionRevisionRequestCommand, TopicResult<TopicSubmissionsDto>>
{
    public async Task<TopicResult<TopicSubmissionsDto>> Handle(CreateSubmissionRevisionRequestCommand request, CancellationToken cancellationToken)
    {
        var (context, error) = await LoadSupervisorAsync(request.TopicId, request.LecturerId, cancellationToken);
        if (context is null) return error!;

        if (!SubmissionRules.TryParseKind(request.Kind, out var kind))
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Invalid, SubmissionPolicy.InvalidKindMessage);

        var current = (await Submissions.ListReportsAsync(context.Topic.Id, cancellationToken)).FirstOrDefault(s => s.Kind == kind);
        if (current is null)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, SubmissionRules.NoSubmissionOfKindMessage(kind));

        var now = Clock.GetUtcNow().UtcDateTime;
        var content = TopicRules.Clean(request.Content);
        var revision = new RevisionRequest
        {
            TopicId = context.Topic.Id,
            Kind = kind,
            Content = content,
            CreatedById = request.LecturerId,
            RaisedOnSubmissionId = current.Id,
            CreatedAt = now
        };
        var label = SubmissionRules.KindLabel(kind).ToLowerInvariant();
        var history = TopicMapping.History(context.Topic, request.LecturerId, TopicHistoryCategories.Submission,
            $"Yêu cầu chỉnh sửa {label} lần {current.VersionNo}", now, content);

        var group = context.Topic.GroupId is { } groupId ? (await Groups.GetGroupsAsync([groupId], cancellationToken)).GetValueOrDefault(groupId) : null;
        var batch = Guid.NewGuid();
        var notices = (group?.Members ?? []).Select(m => SubmissionMapping.Notify(m.StudentId, request.LecturerId, NotificationKinds.Comment,
            $"GVHD yêu cầu chỉnh sửa {label} đề tài {context.Topic.Code}: {Shorten(content)}", context.Topic.Id, batch, now)).ToList();

        await Submissions.AddRequestAsync(revision, history, notices, cancellationToken);
        return await OkAsync(context, "Đã gửi yêu cầu chỉnh sửa cho nhóm", cancellationToken);
    }

    private static string Shorten(string text) => text.Length <= 120 ? text : text[..117] + "...";
}

public sealed class ResolveSubmissionRevisionRequestHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    ISubmissionRepository submissions, TimeProvider clock)
    : SupervisorSubmissionHandler(topics, rounds, groups, submissions, clock),
      IRequestHandler<ResolveSubmissionRevisionRequestCommand, TopicResult<TopicSubmissionsDto>>
{
    public async Task<TopicResult<TopicSubmissionsDto>> Handle(ResolveSubmissionRevisionRequestCommand request, CancellationToken cancellationToken)
    {
        var (context, error) = await LoadSupervisorAsync(request.TopicId, request.LecturerId, cancellationToken);
        if (context is null) return error!;

        var revision = await Submissions.GetRequestAsync(request.RequestId, cancellationToken);
        if (revision is null || revision.TopicId != context.Topic.Id)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.NotFound, SubmissionRules.RequestNotFoundMessage);
        if (revision.ResolvedAt is not null)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, SubmissionRules.ResolvedMessage);

        var links = await Submissions.ListLinksAsync(context.Topic.Id, cancellationToken);
        if (!links.Any(l => l.RequestId == revision.Id))
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, SubmissionRules.NotAddressedMessage);

        var now = Clock.GetUtcNow().UtcDateTime;
        var history = TopicMapping.History(context.Topic, request.LecturerId, TopicHistoryCategories.Submission,
            "Xác nhận hoàn tất yêu cầu chỉnh sửa", now, revision.Content);

        if (!await Submissions.ResolveRequestAsync(revision.Id, request.LecturerId, now, history, cancellationToken))
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, SubmissionRules.ResolvedMessage);

        return await OkAsync(context, "Đã xác nhận hoàn tất yêu cầu", cancellationToken);
    }
}

public sealed class CommentSubmissionValidator : AbstractValidator<CommentSubmissionCommand>
{
    public CommentSubmissionValidator() =>
        RuleFor(x => x.Comment).MaximumLength(2000).WithMessage(SubmissionRules.CommentTooLongMessage).OverridePropertyName("comment");
}

public sealed class CreateSubmissionRevisionRequestValidator : AbstractValidator<CreateSubmissionRevisionRequestCommand>
{
    public CreateSubmissionRevisionRequestValidator()
    {
        RuleFor(x => x.Content).NotEmpty().WithMessage(SubmissionRules.EmptyContentMessage)
            .MaximumLength(2000).WithMessage(SubmissionRules.ContentTooLongMessage).OverridePropertyName("content");
    }
}
