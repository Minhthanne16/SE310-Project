using Backend.Application.Common.Storage;
using Backend.Application.Rounds;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Backend.Application.Topics;

// Đề cương và yêu cầu chỉnh sửa (P04-S01, PDR-013, PDR-057). Nhóm nộp phiên bản PDF; GVHD nhận xét,
// tạo/đóng từng yêu cầu và duyệt khi không còn yêu cầu mở. Duyệt không đổi trạng thái đề tài (PDR-049).
public record GetOutlineQuery(Guid TopicId, Guid ViewerId, ViewerRole Role) : IRequest<TopicResult<OutlineDto>>;
public record SubmitOutlineCommand(Guid StudentId, Guid TopicId, byte[] Content, string FileName, string? Note) : IRequest<TopicResult<OutlineDto>>;
public record CommentOutlineCommand(Guid LecturerId, Guid TopicId, Guid SubmissionId, string? Comment) : IRequest<TopicResult<OutlineDto>>;
public record CreateRevisionRequestCommand(Guid LecturerId, Guid TopicId, string? Content) : IRequest<TopicResult<OutlineDto>>;
public record ResolveRevisionRequestCommand(Guid LecturerId, Guid TopicId, Guid RequestId) : IRequest<TopicResult<OutlineDto>>;
public record ApproveOutlineCommand(Guid LecturerId, Guid TopicId, Guid SubmissionId) : IRequest<TopicResult<OutlineDto>>;
public record DownloadSubmissionQuery(Guid TopicId, Guid SubmissionId, Guid ViewerId, ViewerRole Role) : IRequest<TopicResult<SubmissionFile>>;

public static class OutlineRules
{
    // PDR-040: tối đa 20 MB mỗi tệp PDF.
    public const int MaxFileBytes = 20 * 1024 * 1024;
    public const int MaxNoteLength = 2000;
    public const int MaxContentLength = 2000;
    public const int MaxFileNameLength = 200;

    public const string EmptyFileMessage = "Chọn tệp PDF để nộp.";
    public const string NotPdfMessage = "Tệp không phải PDF.";
    public const string TooLargeMessage = "Tệp vượt quá 20 MB.";
    public const string AlreadyApprovedMessage = "Đề cương đã được duyệt; không nộp hoặc yêu cầu chỉnh sửa thêm.";
    public const string NotWorkingMessage = "Đề tài chưa có nhóm thực hiện nên chưa nộp đề cương.";
    public const string RoundFinishedMessage = "Đợt đã kết thúc nên không nộp hoặc duyệt đề cương được.";
    public const string NoSubmissionMessage = "Nhóm chưa nộp phiên bản đề cương nào.";
    public const string NotAddressedMessage = "Nhóm chưa nộp lại phiên bản xử lý yêu cầu này.";
    public const string ResolvedMessage = "Yêu cầu đã được xác nhận hoàn tất.";
    public const string NotCurrentMessage = "Chỉ duyệt được phiên bản đề cương mới nhất.";
    public const string RequestNotFoundMessage = "Không tìm thấy yêu cầu chỉnh sửa.";
    public const string SubmissionNotFoundMessage = "Không tìm thấy phiên bản đề cương.";
    public const string StorageUnavailableMessage = "Kho lưu tệp đang không dùng được. Thử lại sau.";

    public static string OpenRequestsMessage(int count) => $"Còn {count} yêu cầu chỉnh sửa chưa hoàn tất.";

    // PDR-039: kiểm tra nội dung tệp (chữ ký %PDF-), không tin phần mở rộng hay Content-Type.
    public static bool IsPdf(byte[] content) =>
        content.Length >= 5 && content[0] == '%' && content[1] == 'P' && content[2] == 'D' && content[3] == 'F' && content[4] == '-';

    public static string? FileError(byte[] content)
    {
        if (content.Length == 0) return EmptyFileMessage;
        if (content.Length > MaxFileBytes) return TooLargeMessage;
        return IsPdf(content) ? null : NotPdfMessage;
    }

    public static string CleanFileName(string fileName)
    {
        var name = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/')).Trim();
        if (name.Length == 0) name = "de-cuong.pdf";
        if (!name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) name += ".pdf";
        return name.Length <= MaxFileNameLength ? name : name[^MaxFileNameLength..];
    }

    // Đề tài đang có nhóm thực hiện: Đã đăng ký, hoặc Đang thực hiện sau hạn đăng ký (PDR-049).
    public static bool HasWorkingGroup(ThesisTopic topic, ThesisRound round, DateOnly today) =>
        topic.GroupId is not null && TopicRules.Effective(topic, round, today) is TopicStatus.Registered or TopicStatus.InProgress;

    public static RoundMilestone? Milestone(ThesisRound round) => round.Milestones.FirstOrDefault(m => m.Key == MilestoneKey.Outline);

    // Hạn nộp: tới hết ngày kết thúc mốc Đề cương (giờ Việt Nam); sau đó, nếu mốc bật "Cho nộp trễ" và có
    // hạn trễ riêng thì nhận bài gắn nhãn Nộp trễ tới hết hạn đó (PDR-041, PDR-056). Còn lại là đóng.
    public static string? WindowBlocker(ThesisRound round, DateOnly today)
    {
        var milestone = Milestone(round);
        if (Submissions.SubmissionRules.Window(milestone, today) != Submissions.SubmissionWindow.Closed) return null;
        return Submissions.SubmissionRules.LateDeadline(milestone) is { } late
            ? $"Đã hết hạn nộp trễ đề cương ({late:dd/MM/yyyy})."
            : $"Đã hết hạn nộp đề cương ({milestone?.EndDate:dd/MM/yyyy}).";
    }

    public static bool IsLate(ThesisRound round, DateOnly today) =>
        Submissions.SubmissionRules.Window(Milestone(round), today) == Submissions.SubmissionWindow.Late;

    public static string? SubmitBlocker(ThesisTopic topic, ThesisRound round, DateOnly today)
    {
        if (round.Status != RoundStatus.Running) return RoundFinishedMessage;
        if (!HasWorkingGroup(topic, round, today)) return NotWorkingMessage;
        if (topic.OutlineApprovedAt is not null) return AlreadyApprovedMessage;
        return WindowBlocker(round, today);
    }
}

internal sealed record OutlineContext(ThesisTopic Topic, ThesisRound Round, string Role);

internal static class OutlineAccess
{
    public const string Member = "member";
    public const string Supervisor = "supervisor";
    public const string Staff = "staff";

    // Thành viên nhóm, GVHD và Giáo vụ; người khác nhận NotFound để không lộ đề tài.
    public static async Task<OutlineContext?> LoadAsync(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
        Guid topicId, Guid viewerId, ViewerRole role, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(topicId, cancellationToken);
        if (topic is null) return null;
        var round = await rounds.GetByIdAsync(topic.RoundId, cancellationToken);
        if (round is null) return null;
        string? relation = role switch
        {
            ViewerRole.AcademicAffairs => Staff,
            ViewerRole.Lecturer when topic.SupervisorId == viewerId => Supervisor,
            ViewerRole.Student when topic.GroupId is { } groupId &&
                (await groups.GetGroupsAsync([groupId], cancellationToken)).GetValueOrDefault(groupId) is { } group &&
                group.Members.Any(m => m.StudentId == viewerId) => Member,
            _ => null
        };
        return relation is null ? null : new OutlineContext(topic, round, relation);
    }

    public static async Task<OutlineDto> BuildAsync(OutlineContext context, IOutlineRepository outlines, ITopicRepository topics,
        DateOnly today, CancellationToken cancellationToken)
    {
        var (topic, round, role) = context;
        var submissions = await outlines.ListSubmissionsAsync(topic.Id, cancellationToken);
        var requests = await outlines.ListRequestsAsync(topic.Id, cancellationToken);
        var links = await outlines.ListLinksAsync(topic.Id, cancellationToken);
        var people = submissions.SelectMany(s => new[] { (Guid?)s.SubmittedById, s.ReviewedById })
            .Concat(requests.SelectMany(r => new[] { (Guid?)r.CreatedById, r.ResolvedById }))
            .Append(topic.OutlineApprovedById)
            .Where(id => id is not null).Select(id => id!.Value).Distinct().ToList();
        var names = await topics.GetUserNamesAsync(people, cancellationToken);
        string Name(Guid? id) => id is { } value ? names.GetValueOrDefault(value, "Tài khoản đã xóa") : string.Empty;
        var versionOf = submissions.ToDictionary(s => s.Id, s => s.VersionNo);

        var current = submissions.FirstOrDefault();
        var openCount = requests.Count(r => r.ResolvedAt is null);
        var reviewBlocker = round.Status != RoundStatus.Running ? OutlineRules.RoundFinishedMessage
            : topic.OutlineApprovedAt is not null ? OutlineRules.AlreadyApprovedMessage
            : null;
        var approveBlocker = reviewBlocker
            ?? (current is null ? OutlineRules.NoSubmissionMessage
                : openCount > 0 ? OutlineRules.OpenRequestsMessage(openCount) : null);
        var submitBlocker = role == OutlineAccess.Member ? OutlineRules.SubmitBlocker(topic, round, today) : null;

        return new OutlineDto
        {
            TopicId = topic.Id,
            TopicCode = topic.Code,
            TopicTitle = topic.Title,
            ViewerRole = role,
            Deadline = RoundRules.FormatDate(TopicRules.MilestoneEnd(round, MilestoneKey.Outline)),
            LateDeadline = RoundRules.FormatDate(Submissions.SubmissionRules.LateDeadline(OutlineRules.Milestone(round))),
            ApprovedAt = Utc(topic.OutlineApprovedAt),
            ApprovedBy = topic.OutlineApprovedById is null ? null : Name(topic.OutlineApprovedById),
            ApprovedVersionNo = topic.OutlineApprovedSubmissionId is { } approvedId ? versionOf.GetValueOrDefault(approvedId) : null,
            CurrentSubmissionId = current?.Id,
            CanSubmit = role == OutlineAccess.Member && submitBlocker is null,
            SubmitBlockedReason = submitBlocker,
            CanReview = role == OutlineAccess.Supervisor && round.Status == RoundStatus.Running,
            CanApprove = role == OutlineAccess.Supervisor && approveBlocker is null,
            ApproveBlockedReason = role == OutlineAccess.Supervisor ? approveBlocker : null,
            Submissions = submissions.Select(s => new OutlineSubmissionDto
            {
                Id = s.Id,
                VersionNo = s.VersionNo,
                FileName = s.FileName,
                SizeBytes = s.SizeBytes,
                Note = s.Note,
                SubmittedBy = Name(s.SubmittedById),
                SubmittedAt = Utc(s.CreatedAt)!.Value,
                Late = s.Late,
                ReviewComment = s.ReviewComment,
                ReviewedBy = s.ReviewedById is null ? null : Name(s.ReviewedById),
                ReviewedAt = Utc(s.ReviewedAt),
                AddressedRequestIds = links.Where(l => l.SubmissionId == s.Id).Select(l => l.RequestId).ToList()
            }).ToList(),
            Requests = requests
                .OrderBy(r => r.ResolvedAt is not null).ThenByDescending(r => r.CreatedAt)
                .Select(r =>
                {
                    var addressed = links.Where(l => l.RequestId == r.Id)
                        .Select(l => versionOf.GetValueOrDefault(l.SubmissionId)).Order().ToList();
                    return new RevisionRequestDto
                    {
                        Id = r.Id,
                        Content = r.Content,
                        CreatedBy = Name(r.CreatedById),
                        CreatedAt = Utc(r.CreatedAt)!.Value,
                        RaisedOnVersionNo = versionOf.GetValueOrDefault(r.RaisedOnSubmissionId),
                        Status = r.ResolvedAt is null ? "open" : "resolved",
                        ResolvedBy = r.ResolvedById is null ? null : Name(r.ResolvedById),
                        ResolvedAt = Utc(r.ResolvedAt),
                        AddressedInVersions = addressed,
                        CanResolve = role == OutlineAccess.Supervisor && reviewBlocker is null && r.ResolvedAt is null && addressed.Count > 0
                    };
                }).ToList()
        };
    }

    private static DateTime? Utc(DateTime? value) => value is { } v ? DateTime.SpecifyKind(v, DateTimeKind.Utc) : null;

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

public sealed class SubmitOutlineValidator : AbstractValidator<SubmitOutlineCommand>
{
    public SubmitOutlineValidator() =>
        RuleFor(x => x.Note).MaximumLength(OutlineRules.MaxNoteLength)
            .WithMessage($"Ghi chú tối đa {OutlineRules.MaxNoteLength} ký tự.").OverridePropertyName("note");
}

public sealed class CreateRevisionRequestValidator : AbstractValidator<CreateRevisionRequestCommand>
{
    public CreateRevisionRequestValidator() =>
        RuleFor(x => TopicRules.Clean(x.Content)).NotEmpty().WithMessage("Nhập nội dung yêu cầu chỉnh sửa.")
            .MaximumLength(OutlineRules.MaxContentLength).WithMessage($"Nội dung tối đa {OutlineRules.MaxContentLength} ký tự.")
            .OverridePropertyName("content");
}

public sealed class CommentOutlineValidator : AbstractValidator<CommentOutlineCommand>
{
    public CommentOutlineValidator() =>
        RuleFor(x => x.Comment).MaximumLength(OutlineRules.MaxContentLength)
            .WithMessage($"Nhận xét tối đa {OutlineRules.MaxContentLength} ký tự.").OverridePropertyName("comment");
}

public sealed class GetOutlineHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    IOutlineRepository outlines, TimeProvider clock) : IRequestHandler<GetOutlineQuery, TopicResult<OutlineDto>>
{
    public async Task<TopicResult<OutlineDto>> Handle(GetOutlineQuery request, CancellationToken cancellationToken)
    {
        var context = await OutlineAccess.LoadAsync(topics, rounds, groups, request.TopicId, request.ViewerId, request.Role, cancellationToken);
        if (context is null) return TopicResult<OutlineDto>.Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        return TopicResult<OutlineDto>.Ok(await OutlineAccess.BuildAsync(context, outlines, topics, RoundRules.TodayVietnam(clock), cancellationToken));
    }
}

public sealed class SubmitOutlineHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    IOutlineRepository outlines, IDocumentStorage storage, TimeProvider clock, ILogger<SubmitOutlineHandler> logger)
    : IRequestHandler<SubmitOutlineCommand, TopicResult<OutlineDto>>
{
    public async Task<TopicResult<OutlineDto>> Handle(SubmitOutlineCommand request, CancellationToken cancellationToken)
    {
        var context = await OutlineAccess.LoadAsync(topics, rounds, groups, request.TopicId, request.StudentId, ViewerRole.Student, cancellationToken);
        if (context is null) return Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        var today = RoundRules.TodayVietnam(clock);
        if (OutlineRules.SubmitBlocker(context.Topic, context.Round, today) is { } blocker) return Fail(TopicResultStatus.Conflict, blocker);
        if (OutlineRules.FileError(request.Content) is { } fileError) return Fail(TopicResultStatus.Invalid, fileError);

        var now = clock.GetUtcNow().UtcDateTime;
        var topic = context.Topic;
        // Khóa object ngẫu nhiên, không đoán được; DB chỉ lưu khóa (giống ảnh đại diện, PDR-051).
        var objectKey = $"submissions/{topic.Id}/{Guid.NewGuid():N}.pdf";
        try
        {
            await storage.SaveAsync(objectKey, request.Content, "application/pdf", cancellationToken);
        }
        catch (StorageUnavailableException ex)
        {
            logger.LogError(ex, "Failed to store outline for topic {TopicId}", topic.Id);
            return Fail(TopicResultStatus.Unavailable, OutlineRules.StorageUnavailableMessage);
        }

        var submission = new TopicSubmission
        {
            TopicId = topic.Id,
            Kind = SubmissionKind.Outline,
            ObjectKey = objectKey,
            FileName = OutlineRules.CleanFileName(request.FileName),
            SizeBytes = request.Content.Length,
            Note = TopicRules.CleanOptional(request.Note),
            SubmittedById = request.StudentId,
            Late = OutlineRules.IsLate(context.Round, today),
            CreatedAt = now
        };
        var names = await topics.GetUserNamesAsync([request.StudentId], cancellationToken);
        var notice = OutlineAccess.Notify(topic.SupervisorId, request.StudentId, NotificationKinds.Inbox,
            $"{names.GetValueOrDefault(request.StudentId, "Nhóm")} đã nộp đề cương cho đề tài {topic.Code} “{topic.Title}”.",
            topic.Id, Guid.NewGuid(), now);
        var history = TopicMapping.History(topic, request.StudentId, TopicHistoryCategories.Submission, "Nộp đề cương", now);

        (OutlineWriteOutcome Outcome, TopicSubmission Submission, int LinkedRequests) saved;
        try
        {
            saved = await outlines.AddSubmissionAsync(submission, history, [notice], cancellationToken);
        }
        catch
        {
            await DeleteQuietly(objectKey);
            throw;
        }
        if (saved.Outcome != OutlineWriteOutcome.Done)
        {
            await DeleteQuietly(objectKey);
            return Fail(TopicResultStatus.Conflict, OutlineRules.AlreadyApprovedMessage);
        }

        var dto = await OutlineAccess.BuildAsync(context, outlines, topics, today, cancellationToken);
        var message = saved.LinkedRequests > 0
            ? $"Đã nộp đề cương lần {saved.Submission.VersionNo}, kèm {saved.LinkedRequests} yêu cầu chỉnh sửa đang mở."
            : $"Đã nộp đề cương lần {saved.Submission.VersionNo}.";
        return TopicResult<OutlineDto>.Ok(dto, message);
    }

    // Dọn object vừa ghi khi DB không lưu được; lỗi dọn chỉ ghi log.
    private async Task DeleteQuietly(string objectKey)
    {
        try
        {
            await storage.DeleteAsync(objectKey, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to remove orphan object {ObjectKey}", objectKey);
        }
    }

    private static TopicResult<OutlineDto> Fail(TopicResultStatus status, string message) => TopicResult<OutlineDto>.Fail(status, message);
}

// Các thao tác của GVHD dùng chung bước nạp và kiểm tra quyền.
public abstract class SupervisorOutlineHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    IOutlineRepository outlines, TimeProvider clock)
{
    protected ITopicRepository Topics => topics;
    protected IOutlineRepository Outlines => outlines;
    protected TimeProvider Clock => clock;

    internal async Task<(OutlineContext? Context, TopicResult<OutlineDto>? Error)> LoadSupervisorAsync(
        Guid topicId, Guid lecturerId, bool forWrite, CancellationToken cancellationToken)
    {
        var context = await OutlineAccess.LoadAsync(topics, rounds, groups, topicId, lecturerId, ViewerRole.Lecturer, cancellationToken);
        if (context is null || context.Role != OutlineAccess.Supervisor)
            return (null, TopicResult<OutlineDto>.Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage));
        if (context.Round.Status != RoundStatus.Running)
            return (null, TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.RoundFinishedMessage));
        if (forWrite && context.Topic.OutlineApprovedAt is not null)
            return (null, TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.AlreadyApprovedMessage));
        return (context, null);
    }

    internal async Task<TopicResult<OutlineDto>> OkAsync(OutlineContext context, string message, CancellationToken cancellationToken)
    {
        // Nạp lại đề tài để thấy dấu duyệt vừa ghi bằng cập nhật có điều kiện.
        var topic = await topics.GetByIdAsync(context.Topic.Id, cancellationToken) ?? context.Topic;
        return TopicResult<OutlineDto>.Ok(await OutlineAccess.BuildAsync(context with { Topic = topic }, outlines, topics,
            RoundRules.TodayVietnam(clock), cancellationToken), message);
    }

    internal static IReadOnlyList<Notification> ToGroup(ThesisGroup? group, Guid sender, string text, Guid topicId, DateTime now)
    {
        var batch = Guid.NewGuid();
        return (group?.Members ?? []).Select(m => OutlineAccess.Notify(m.StudentId, sender, NotificationKinds.Comment, text, topicId, batch, now)).ToList();
    }
}

public sealed class CommentOutlineHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    IOutlineRepository outlines, TimeProvider clock)
    : SupervisorOutlineHandler(topics, rounds, groups, outlines, clock), IRequestHandler<CommentOutlineCommand, TopicResult<OutlineDto>>
{
    public async Task<TopicResult<OutlineDto>> Handle(CommentOutlineCommand request, CancellationToken cancellationToken)
    {
        var (context, error) = await LoadSupervisorAsync(request.TopicId, request.LecturerId, forWrite: false, cancellationToken);
        if (context is null) return error!;
        var submission = await Outlines.GetSubmissionAsync(request.SubmissionId, cancellationToken);
        if (submission is null || submission.TopicId != context.Topic.Id || submission.Kind != SubmissionKind.Outline)
            return TopicResult<OutlineDto>.Fail(TopicResultStatus.NotFound, OutlineRules.SubmissionNotFoundMessage);

        var now = Clock.GetUtcNow().UtcDateTime;
        var comment = TopicRules.CleanOptional(request.Comment);
        var history = TopicMapping.History(context.Topic, request.LecturerId, TopicHistoryCategories.Submission,
            $"Nhận xét đề cương lần {submission.VersionNo}", now, comment);
        await Outlines.SaveCommentAsync(submission.Id, comment, request.LecturerId, now, history, cancellationToken);
        return await OkAsync(context, "Đã lưu nhận xét", cancellationToken);
    }
}

public sealed class CreateRevisionRequestHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    IOutlineRepository outlines, TimeProvider clock)
    : SupervisorOutlineHandler(topics, rounds, groups, outlines, clock), IRequestHandler<CreateRevisionRequestCommand, TopicResult<OutlineDto>>
{
    private readonly IGroupRepository _groups = groups;

    public async Task<TopicResult<OutlineDto>> Handle(CreateRevisionRequestCommand request, CancellationToken cancellationToken)
    {
        var (context, error) = await LoadSupervisorAsync(request.TopicId, request.LecturerId, forWrite: true, cancellationToken);
        if (context is null) return error!;
        var current = (await Outlines.ListSubmissionsAsync(context.Topic.Id, cancellationToken)).FirstOrDefault();
        if (current is null) return TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.NoSubmissionMessage);

        var now = Clock.GetUtcNow().UtcDateTime;
        var content = TopicRules.Clean(request.Content);
        var revision = new RevisionRequest
        {
            TopicId = context.Topic.Id,
            Content = content,
            CreatedById = request.LecturerId,
            RaisedOnSubmissionId = current.Id,
            CreatedAt = now
        };
        var history = TopicMapping.History(context.Topic, request.LecturerId, TopicHistoryCategories.Submission,
            $"Yêu cầu chỉnh sửa đề cương lần {current.VersionNo}", now, content);
        var group = context.Topic.GroupId is { } groupId ? (await _groups.GetGroupsAsync([groupId], cancellationToken)).GetValueOrDefault(groupId) : null;
        var notices = ToGroup(group, request.LecturerId,
            $"GVHD yêu cầu chỉnh sửa đề cương đề tài {context.Topic.Code}: {Shorten(content)}", context.Topic.Id, now);
        if (await Outlines.AddRequestAsync(revision, history, notices, cancellationToken) != OutlineWriteOutcome.Done)
            return TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.AlreadyApprovedMessage);
        return await OkAsync(context, "Đã gửi yêu cầu chỉnh sửa cho nhóm", cancellationToken);
    }

    private static string Shorten(string text) => text.Length <= 120 ? text : text[..117] + "...";
}

public sealed class ResolveRevisionRequestHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    IOutlineRepository outlines, TimeProvider clock)
    : SupervisorOutlineHandler(topics, rounds, groups, outlines, clock), IRequestHandler<ResolveRevisionRequestCommand, TopicResult<OutlineDto>>
{
    public async Task<TopicResult<OutlineDto>> Handle(ResolveRevisionRequestCommand request, CancellationToken cancellationToken)
    {
        var (context, error) = await LoadSupervisorAsync(request.TopicId, request.LecturerId, forWrite: true, cancellationToken);
        if (context is null) return error!;
        var revision = (await Outlines.ListRequestsAsync(context.Topic.Id, cancellationToken)).FirstOrDefault(r => r.Id == request.RequestId);
        if (revision is null) return TopicResult<OutlineDto>.Fail(TopicResultStatus.NotFound, OutlineRules.RequestNotFoundMessage);
        if (revision.ResolvedAt is not null) return TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.ResolvedMessage);
        // GVHD kiểm tra trên phiên bản nộp lại (PDR-013): yêu cầu phải đã được một lần nộp lại xử lý.
        var links = await Outlines.ListLinksAsync(context.Topic.Id, cancellationToken);
        if (!links.Any(l => l.RequestId == revision.Id))
            return TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.NotAddressedMessage);

        var now = Clock.GetUtcNow().UtcDateTime;
        var history = TopicMapping.History(context.Topic, request.LecturerId, TopicHistoryCategories.Submission,
            "Xác nhận hoàn tất yêu cầu chỉnh sửa", now, revision.Content);
        if (!await Outlines.ResolveRequestAsync(revision.Id, request.LecturerId, now, history, cancellationToken))
            return TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.ResolvedMessage);
        return await OkAsync(context, "Đã xác nhận hoàn tất yêu cầu", cancellationToken);
    }
}

public sealed class ApproveOutlineHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    IOutlineRepository outlines, TimeProvider clock)
    : SupervisorOutlineHandler(topics, rounds, groups, outlines, clock), IRequestHandler<ApproveOutlineCommand, TopicResult<OutlineDto>>
{
    private readonly IGroupRepository _groups = groups;

    public async Task<TopicResult<OutlineDto>> Handle(ApproveOutlineCommand request, CancellationToken cancellationToken)
    {
        var (context, error) = await LoadSupervisorAsync(request.TopicId, request.LecturerId, forWrite: true, cancellationToken);
        if (context is null) return error!;
        var submissions = await Outlines.ListSubmissionsAsync(context.Topic.Id, cancellationToken);
        var submission = submissions.FirstOrDefault(s => s.Id == request.SubmissionId);
        if (submission is null) return TopicResult<OutlineDto>.Fail(TopicResultStatus.NotFound, OutlineRules.SubmissionNotFoundMessage);
        if (submissions[0].Id != submission.Id) return TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.NotCurrentMessage);
        var open = (await Outlines.ListRequestsAsync(context.Topic.Id, cancellationToken)).Count(r => r.ResolvedAt is null);
        if (open > 0) return TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.OpenRequestsMessage(open));

        var now = Clock.GetUtcNow().UtcDateTime;
        var history = TopicMapping.History(context.Topic, request.LecturerId, TopicHistoryCategories.Submission,
            $"Duyệt đề cương lần {submission.VersionNo}", now);
        var group = context.Topic.GroupId is { } groupId ? (await _groups.GetGroupsAsync([groupId], cancellationToken)).GetValueOrDefault(groupId) : null;
        var notices = ToGroup(group, request.LecturerId, $"GVHD đã duyệt đề cương đề tài {context.Topic.Code}.", context.Topic.Id, now);
        return await Outlines.ApproveAsync(context.Topic.Id, submission, request.LecturerId, now, history, notices, cancellationToken) switch
        {
            OutlineWriteOutcome.Done => await OkAsync(context, "Đã duyệt đề cương", cancellationToken),
            OutlineWriteOutcome.AlreadyApproved => TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.AlreadyApprovedMessage),
            // Nhóm vừa nộp bản mới hoặc vừa có yêu cầu mới trong lúc duyệt.
            _ => TopicResult<OutlineDto>.Fail(TopicResultStatus.Conflict, OutlineRules.NotCurrentMessage)
        };
    }
}

public sealed class DownloadSubmissionHandler(ITopicRepository topics, IRoundRepository rounds, IGroupRepository groups,
    IOutlineRepository outlines, IDocumentStorage storage) : IRequestHandler<DownloadSubmissionQuery, TopicResult<SubmissionFile>>
{
    public async Task<TopicResult<SubmissionFile>> Handle(DownloadSubmissionQuery request, CancellationToken cancellationToken)
    {
        var context = await OutlineAccess.LoadAsync(topics, rounds, groups, request.TopicId, request.ViewerId, request.Role, cancellationToken);
        var submission = context is null ? null : await outlines.GetSubmissionAsync(request.SubmissionId, cancellationToken);
        if (submission is null || submission.TopicId != request.TopicId)
            return TopicResult<SubmissionFile>.Fail(TopicResultStatus.NotFound, OutlineRules.SubmissionNotFoundMessage);
        byte[]? content;
        try
        {
            content = await storage.ReadAsync(submission.ObjectKey, cancellationToken);
        }
        catch (StorageUnavailableException)
        {
            return TopicResult<SubmissionFile>.Fail(TopicResultStatus.Unavailable, OutlineRules.StorageUnavailableMessage);
        }
        return content is null
            ? TopicResult<SubmissionFile>.Fail(TopicResultStatus.NotFound, OutlineRules.SubmissionNotFoundMessage)
            : TopicResult<SubmissionFile>.Ok(new SubmissionFile(content, submission.FileName));
    }
}
