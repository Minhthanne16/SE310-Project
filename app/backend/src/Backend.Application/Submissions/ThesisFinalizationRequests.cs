using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;

namespace Backend.Application.Submissions;

public record GrantThesisExtensionCommand(Guid ActorId, Guid TopicId, string? EndDate, string? Reason)
    : IRequest<TopicResult<TopicSubmissionsDto>>;
public record LockThesisCommand(Guid ActorId, Guid TopicId, Guid SubmissionId)
    : IRequest<TopicResult<TopicSubmissionsDto>>;
public record MarkThesisIneligibleCommand(Guid ActorId, Guid TopicId, string? Reason)
    : IRequest<TopicResult<TopicSubmissionsDto>>;
public record FinalizeExpiredThesesCommand : IRequest<int>;

public sealed class ThesisFinalizationHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ISubmissionRepository submissions, TimeProvider clock) :
    IRequestHandler<GrantThesisExtensionCommand, TopicResult<TopicSubmissionsDto>>,
    IRequestHandler<LockThesisCommand, TopicResult<TopicSubmissionsDto>>,
    IRequestHandler<MarkThesisIneligibleCommand, TopicResult<TopicSubmissionsDto>>,
    IRequestHandler<FinalizeExpiredThesesCommand, int>
{
    private DateOnly Today => RoundRules.TodayVietnam(clock);
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    private async Task<SubmissionContext?> Context(Guid topicId, Guid actorId, ViewerRole role, CancellationToken ct) =>
        await SubmissionMapping.Load(topicId, actorId, role, topics, rounds, groups, ct);

    private async Task<TopicResult<TopicSubmissionsDto>> Result(Guid topicId, Guid actorId, ViewerRole role, CancellationToken ct)
    {
        var context = (await Context(topicId, actorId, role, ct))!;
        return TopicResult<TopicSubmissionsDto>.Ok(await SubmissionMapping.BuildAsync(context, submissions, topics, Today, ct));
    }

    public async Task<TopicResult<TopicSubmissionsDto>> Handle(GrantThesisExtensionCommand request, CancellationToken ct)
    {
        var context = await Context(request.TopicId, request.ActorId, ViewerRole.AcademicAffairs, ct);
        if (context is null) return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.NotFound, SubmissionRules.NotFoundMessage);
        var reason = TopicRules.CleanOptional(request.Reason);
        if (reason is null || reason.Length > 800) return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Invalid, "Nhập lý do (tối đa 800 ký tự).");
        if (!RoundRules.TryParseDate(request.EndDate, out var end) || end <= Today)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Invalid, "Hạn bổ sung phải là ngày tương lai.");
        var milestone = context.Round.Milestones.FirstOrDefault(m => m.Key == MilestoneKey.Finalize);
        if (milestone?.EndDate is not { } original || Today <= original || end <= original || context.Topic.GroupId is null ||
            context.Topic.ThesisExtensionEnd is not null || context.Topic.FinalThesisSubmissionId is not null ||
            context.Topic.Status is TopicStatus.Ineligible or TopicStatus.Completed ||
            (await submissions.ListReportsAsync(request.TopicId, ct)).Any(s => s.Kind == SubmissionKind.Thesis))
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, "Chỉ cấp hạn bổ sung một lần sau hạn gốc khi nhóm chưa có bản khóa luận.");
        var now = Now;
        var history = TopicMapping.History(context.Topic, request.ActorId, TopicHistoryCategories.Submission,
            "Cấp hạn bổ sung bản khóa luận", now, $"Hết ngày {end:dd/MM/yyyy} · Lý do: {reason}");
        if (!await submissions.GrantThesisExtensionAsync(request.TopicId, end, reason, request.ActorId, now, history, ct))
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, "Hạn bổ sung đã được cấp hoặc đề tài đã kết thúc.");
        context.Topic.ThesisExtensionEnd = end;
        context.Topic.ThesisExtensionReason = reason;
        return await Result(request.TopicId, request.ActorId, ViewerRole.AcademicAffairs, ct);
    }

    public async Task<TopicResult<TopicSubmissionsDto>> Handle(LockThesisCommand request, CancellationToken ct)
    {
        var context = await Context(request.TopicId, request.ActorId, ViewerRole.Student, ct);
        if (context is null || context.Access == SubmissionAccess.None)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.NotFound, SubmissionRules.NotFoundMessage);
        if (SubmissionRules.Blocker(context.Topic, context.Round, SubmissionKind.Thesis, Today) is { } blocker)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, blocker);
        var openFinalRequests = (await submissions.ListRequestsAsync(request.TopicId, ct))
            .Count(r => r.Kind == SubmissionKind.Final && r.ResolvedAt is null);
        if (openFinalRequests > 0)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, SubmissionRules.OpenFinalRequestsMessage(openFinalRequests));
        var version = await submissions.GetReportAsync(request.SubmissionId, ct);
        if (version is null || version.TopicId != request.TopicId || version.Kind != SubmissionKind.Thesis)
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Invalid, "Chọn một phiên bản khóa luận của nhóm.");
        var now = Now;
        var history = TopicMapping.History(context.Topic, request.ActorId, TopicHistoryCategories.Submission,
            "Chốt bản khóa luận cuối", now, $"Bản {version.VersionNo} · {version.FileName}");
        if (!await submissions.LockThesisAsync(request.TopicId, request.SubmissionId, request.ActorId, now, history, ct))
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, "Bản cuối đã được chốt hoặc đề tài đã kết thúc.");
        context.Topic.FinalThesisSubmissionId = request.SubmissionId;
        return await Result(request.TopicId, request.ActorId, ViewerRole.Student, ct);
    }

    public async Task<TopicResult<TopicSubmissionsDto>> Handle(MarkThesisIneligibleCommand request, CancellationToken ct)
    {
        var context = await Context(request.TopicId, request.ActorId, ViewerRole.AcademicAffairs, ct);
        if (context is null) return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.NotFound, SubmissionRules.NotFoundMessage);
        var reason = TopicRules.CleanOptional(request.Reason);
        if (reason is null || reason.Length > 800) return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Invalid, "Nhập lý do (tối đa 800 ký tự).");
        if (context.Topic.ThesisExtensionEnd is not { } end || Today <= end || context.Topic.FinalThesisSubmissionId is not null ||
            (await submissions.ListReportsAsync(request.TopicId, ct)).Any(s => s.Kind == SubmissionKind.Thesis))
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, "Chỉ kết thúc sau hạn bổ sung khi nhóm vẫn chưa có bản khóa luận.");
        var now = Now;
        var history = TopicMapping.History(context.Topic, request.ActorId, TopicHistoryCategories.Status,
            "Không đủ điều kiện công bố", now, $"Lý do: {reason}");
        if (!await submissions.MarkIneligibleAsync(request.TopicId, reason, request.ActorId, now, history, ct))
            return TopicResult<TopicSubmissionsDto>.Fail(TopicResultStatus.Conflict, "Đề tài đã thay đổi; tải lại để kiểm tra.");
        context.Topic.Status = TopicStatus.Ineligible;
        context.Topic.IneligibleReason = reason;
        return await Result(request.TopicId, request.ActorId, ViewerRole.AcademicAffairs, ct);
    }

    public async Task<int> Handle(FinalizeExpiredThesesCommand request, CancellationToken ct)
    {
        var count = 0;
        foreach (var topicId in await submissions.GetExpiredThesisTopicsAsync(Today, ct))
        {
            var versions = await submissions.ListReportsAsync(topicId, ct);
            var latest = versions.Where(s => s.Kind == SubmissionKind.Thesis).MaxBy(s => s.VersionNo);
            if (latest is null) continue;
            var topic = await topics.GetByIdAsync(topicId, ct);
            if (topic is null) continue;
            var now = Now;
            var history = TopicMapping.History(topic, null, TopicHistoryCategories.Submission,
                "Hệ thống chốt bản khóa luận cuối", now, $"Bản {latest.VersionNo} · {latest.FileName}");
            if (await submissions.LockThesisAsync(topicId, latest.Id, null, now, history, ct)) count++;
        }
        return count;
    }
}
