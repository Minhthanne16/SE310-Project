using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Reviewers;

// Phân công Giảng viên phản biện (P05-S02, PDR-021/022/023, PDR-062). Giáo vụ xem, gợi ý, gán từng đề tài hoặc
// theo lô; Giảng viên xem các đề tài mình phản biện.
public record ListReviewerAssignmentsQuery(Guid RoundId) : IRequest<TopicResult<ReviewerAssignmentsDto>>;
public record SuggestReviewersQuery(Guid RoundId) : IRequest<TopicResult<List<ReviewerSuggestionDto>>>;
public record AssignReviewerCommand(Guid ActorId, Guid TopicId, AssignReviewerInputDto Input) : IRequest<TopicResult<AssignReviewerResultDto>>;
public record AssignReviewersBatchCommand(Guid ActorId, ReviewerBatchInputDto Input) : IRequest<TopicResult<ReviewerBatchResultDto>>;
public record ListMyReviewTopicsQuery(Guid LecturerId, Guid? RoundId) : IRequest<TopicResult<MyReviewDto>>;

public sealed class AssignReviewerValidator : AbstractValidator<AssignReviewerCommand>
{
    public AssignReviewerValidator() =>
        RuleFor(x => x.Input.ReviewerId).NotEmpty().WithMessage("Chọn giảng viên phản biện.").OverridePropertyName("reviewerId");
}

public sealed class AssignReviewersBatchValidator : AbstractValidator<AssignReviewersBatchCommand>
{
    public AssignReviewersBatchValidator()
    {
        RuleFor(x => x.Input.RoundId).NotEmpty().WithMessage("Chọn đợt.").OverridePropertyName("roundId");
        RuleFor(x => x.Input.Items).NotNull().WithMessage("Chọn ít nhất một đề tài.")
            .Must(items => items is null || items.Count > 0).WithMessage("Chọn ít nhất một đề tài.")
            .Must(items => items is null || items.Count <= ReviewerRules.MaxBatchSize)
            .WithMessage($"Mỗi lô tối đa {ReviewerRules.MaxBatchSize} đề tài.").OverridePropertyName("items");
        RuleForEach(x => x.Input.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.TopicId).NotEmpty().WithMessage("Thiếu mã đề tài.").OverridePropertyName("topicId");
            item.RuleFor(i => i.ReviewerId).NotEmpty().WithMessage("Chọn giảng viên phản biện.").OverridePropertyName("reviewerId");
        });
    }
}

internal sealed record ReviewerAssignResult(TopicResultStatus Status, string Message, string? Warning = null, ReviewerTopicRowDto? Row = null);

// Dữ liệu một đợt nạp một lần để dựng bảng và xử lý từng lần gán (đơn lẻ hoặc theo lô).
internal sealed class ReviewerSession
{
    private readonly IReviewerRepository _reviewers;
    private readonly DateOnly _today;
    private readonly Dictionary<Guid, User> _lecturers;
    private readonly IReadOnlyDictionary<Guid, ThesisGroup> _groups;
    private readonly IReadOnlyDictionary<Guid, ReportPresence> _presence;

    public ThesisRound Round { get; }
    // Đề tài đang hiển thị trong phân công, không theo dõi thay đổi; được cập nhật trong bộ nhớ sau mỗi lần gán.
    public List<ThesisTopic> Topics { get; }
    public IReadOnlyCollection<ThesisTopic> AllTopics { get; }

    private ReviewerSession(IReviewerRepository reviewers, ThesisRound round, IReadOnlyList<ThesisTopic> all, DateOnly today,
        IEnumerable<User> lecturers, IReadOnlyDictionary<Guid, ThesisGroup> groups, IReadOnlyDictionary<Guid, ReportPresence> presence)
    {
        _reviewers = reviewers;
        Round = round;
        AllTopics = all.ToList();
        Topics = all.Where(ReviewerRules.Listed).ToList();
        _today = today;
        _lecturers = lecturers.ToDictionary(u => u.Id);
        _groups = groups;
        _presence = presence;
    }

    public static async Task<ReviewerSession> LoadAsync(IReviewerRepository reviewers, ITopicRepository topics, IGroupRepository groups,
        ThesisRound round, DateOnly today, CancellationToken cancellationToken)
    {
        var all = await topics.ListByRoundAsync(round.Id, cancellationToken: cancellationToken);
        var listed = all.Where(ReviewerRules.Listed).ToList();
        var lecturers = await reviewers.GetUsersAsync(RoundMapping.IdsOf(round, ParticipantKind.Lecturer), cancellationToken);
        var members = await groups.MembersOf(listed, cancellationToken);
        var presence = await reviewers.GetReportPresenceAsync(listed.Select(t => t.Id).ToList(), cancellationToken);
        return new ReviewerSession(reviewers, round, all, today, lecturers, members, presence);
    }

    public IReadOnlyCollection<User> Lecturers => _lecturers.Values;

    public ReviewerTopicRowDto Row(ThesisTopic topic)
    {
        var blocker = ReviewerRules.AssignBlocker(topic, Round, _today);
        var presence = _presence.GetValueOrDefault(topic.Id, new ReportPresence(false, false));
        var lockReason = ReviewerRules.LockReason(topic);
        var dto = new ReviewerTopicRowDto
        {
            TopicId = topic.Id,
            Code = topic.Code,
            Title = topic.Title,
            Field = topic.Field,
            Supervisor = Person(topic.SupervisorId, topic.Supervisor),
            Group = topic.GroupId is { } groupId && _groups.TryGetValue(groupId, out var group)
                ? TopicMapping.Members(group.Members, group.RepresentativeId) : [],
            OutlineApprovedAt = Utc(topic.OutlineApprovedAt),
            Reviewer = topic.ReviewerId is { } reviewerId ? Person(reviewerId, topic.Reviewer ?? _lecturers.GetValueOrDefault(reviewerId)) : null,
            AssignedAt = Utc(topic.ReviewerAssignedAt),
            Eligible = blocker is null,
            BlockedReason = blocker,
            Locked = lockReason is not null,
            LockReason = lockReason,
            HasMidterm = presence.HasMidterm,
            HasFinal = presence.HasFinal
        };
        return dto;
    }

    public List<ReviewerLecturerDto> LecturerLoads() => _lecturers.Values
        .Where(u => u.IsActive)
        .OrderBy(u => u.UserCode, StringComparer.Ordinal)
        .Select(u =>
        {
            var reviewCount = AllTopics.Count(t => t.ReviewerId == u.Id);
            return new ReviewerLecturerDto
            {
                Id = u.Id,
                Code = u.UserCode,
                Name = u.FullName,
                Department = u.Department,
                ReviewCount = reviewCount,
                SuperviseCount = AllTopics.Count(t => t.SupervisorId == u.Id && TopicRules.CountsTowardLoad(t)),
                Max = Round.LecturerLoadMax,
                Level = Round.LecturerLoadMax > 0 && reviewCount > Round.LecturerLoadMax ? "over" : "ok"
            };
        }).ToList();

    public List<ReviewerRules.SuggestLecturer> SuggestPool() => _lecturers.Values
        .Select(u => new ReviewerRules.SuggestLecturer(u.Id, u.UserCode, u.IsActive,
            AllTopics.Count(t => t.SupervisorId == u.Id && TopicRules.CountsTowardLoad(t)))).ToList();

    // Gán hoặc đổi GVPB của một đề tài (PDR-021, PDR-023, PDR-062). Không ném lỗi nghiệp vụ; trả kết quả theo từng đề tài.
    public async Task<ReviewerAssignResult> AssignAsync(Guid topicId, Guid reviewerId, Guid? expectedReviewerId, Guid actorId,
        DateTime now, CancellationToken cancellationToken)
    {
        var topic = Topics.FirstOrDefault(t => t.Id == topicId);
        if (topic is null) return new(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        // Gán lặp đúng người đang có là thành công, không ghi lịch sử hay thông báo.
        if (topic.ReviewerId == reviewerId) return new(TopicResultStatus.Ok, "Đề tài đã có phản biện này.", null, Row(topic));
        if (ReviewerRules.LockReason(topic) is { } locked) return Conflict(locked);
        if (ReviewerRules.AssignBlocker(topic, Round, _today) is { } blocker) return Conflict(blocker);
        _lecturers.TryGetValue(reviewerId, out var lecturer);
        if (ReviewerRules.CandidateBlocker(topic, Round, lecturer) is { } candidate) return Conflict(candidate);
        if (topic.ReviewerId != expectedReviewerId) return Conflict(ReviewerRules.ChangedMessage);

        var previous = topic.Reviewer;
        var changed = topic.ReviewerId is not null;
        var detail = $"{(previous is null ? "(chưa có)" : $"{previous.FullName} ({previous.UserCode})")} → {lecturer!.FullName} ({lecturer.UserCode})";
        var history = TopicMapping.History(topic, actorId, TopicHistoryCategories.Assignment,
            changed ? "Đổi phản biện" : "Phân công phản biện", now, detail);
        var batch = Guid.NewGuid();
        var notices = new List<Notification>
        {
            OutlineAccess.Notify(lecturer.Id, actorId, NotificationKinds.Assign, $"Bạn được phân công phản biện {topic.Code}", topic.Id, batch, now)
        };
        if (topic.ReviewerId is { } oldId)
            notices.Add(new Notification
            {
                BatchId = batch, RecipientUserId = oldId, SenderUserId = actorId, Kind = NotificationKinds.Assign,
                Text = $"Bạn không còn phản biện {topic.Code}", Href = "/gv/phan-bien", CreatedAt = now
            });

        var outcome = await _reviewers.AssignAsync(topic.Id, reviewerId, expectedReviewerId, actorId, now, history, notices, cancellationToken);
        switch (outcome)
        {
            case ReviewerAssignOutcome.Done:
                topic.ReviewerId = reviewerId;
                topic.Reviewer = lecturer;
                topic.ReviewerAssignedAt = now;
                topic.ReviewerAssignedById = actorId;
                return new(TopicResultStatus.Ok, changed ? "Đã đổi phản biện." : "Đã phân công phản biện.", Warning(lecturer), Row(topic));
            case ReviewerAssignOutcome.Unchanged:
                return new(TopicResultStatus.Ok, "Đề tài đã có phản biện này.", null, Row(topic));
            case ReviewerAssignOutcome.Locked:
                return Conflict(ReviewerRules.LockedMessage);
            case ReviewerAssignOutcome.SupervisorConflict:
                return Conflict(ReviewerRules.SupervisorMessage);
            case ReviewerAssignOutcome.NotFound:
                return new(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
            default:
                return Conflict(ReviewerRules.ChangedMessage);
        }
    }

    // Vượt mức tối đa chỉ cảnh báo, không chặn (PDR-062).
    private string? Warning(User lecturer)
    {
        var count = AllTopics.Count(t => t.ReviewerId == lecturer.Id);
        return Round.LecturerLoadMax > 0 && count > Round.LecturerLoadMax
            ? $"{lecturer.FullName} đang phản biện {count} đề tài, vượt mức tối đa {Round.LecturerLoadMax} đề tài của đợt."
            : null;
    }

    private static ReviewerAssignResult Conflict(string message) => new(TopicResultStatus.Conflict, message);

    private static TopicPersonDto Person(Guid id, User? user) => new()
    {
        Id = id, Code = user?.UserCode ?? string.Empty, Name = user?.FullName ?? string.Empty
    };

    private static DateTime? Utc(DateTime? value) => value is { } v ? DateTime.SpecifyKind(v, DateTimeKind.Utc) : null;
}

internal static class ReviewerRound
{
    // Giáo vụ chỉ làm việc với đợt đã mở hoặc đã kết thúc; đợt Nháp coi như không tồn tại.
    public static async Task<ThesisRound?> FindAsync(IRoundRepository rounds, Guid roundId, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(roundId, cancellationToken);
        return round is null || round.Status == RoundStatus.Draft ? null : round;
    }
}

public sealed class ListReviewerAssignmentsHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    IReviewerRepository reviewers, TimeProvider clock) : IRequestHandler<ListReviewerAssignmentsQuery, TopicResult<ReviewerAssignmentsDto>>
{
    public async Task<TopicResult<ReviewerAssignmentsDto>> Handle(ListReviewerAssignmentsQuery request, CancellationToken cancellationToken)
    {
        var round = await ReviewerRound.FindAsync(rounds, request.RoundId, cancellationToken);
        if (round is null) return TopicResult<ReviewerAssignmentsDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        var session = await ReviewerSession.LoadAsync(reviewers, topics, groups, round, RoundRules.TodayVietnam(clock), cancellationToken);
        return TopicResult<ReviewerAssignmentsDto>.Ok(new ReviewerAssignmentsDto
        {
            Round = new ReviewerRoundDto { Id = round.Id, Name = round.Name, Status = RoundRules.Label(round.Status), LoadMax = round.LecturerLoadMax },
            Topics = session.Topics.Select(session.Row).ToList(),
            Lecturers = session.LecturerLoads()
        });
    }
}

public sealed class SuggestReviewersHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    IReviewerRepository reviewers, TimeProvider clock) : IRequestHandler<SuggestReviewersQuery, TopicResult<List<ReviewerSuggestionDto>>>
{
    public async Task<TopicResult<List<ReviewerSuggestionDto>>> Handle(SuggestReviewersQuery request, CancellationToken cancellationToken)
    {
        var round = await ReviewerRound.FindAsync(rounds, request.RoundId, cancellationToken);
        if (round is null) return TopicResult<List<ReviewerSuggestionDto>>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        var today = RoundRules.TodayVietnam(clock);
        var session = await ReviewerSession.LoadAsync(reviewers, topics, groups, round, today, cancellationToken);
        var open = session.Topics.Where(t => t.ReviewerId is null && ReviewerRules.AssignBlocker(t, round, today) is null).ToList();
        return TopicResult<List<ReviewerSuggestionDto>>.Ok(
            ReviewerRules.Suggest(open, session.SuggestPool(), session.AllTopics, round.LecturerLoadMax),
            "Gợi ý chưa được lưu; xác nhận để lưu.");
    }
}

public sealed class AssignReviewerHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    IReviewerRepository reviewers, TimeProvider clock) : IRequestHandler<AssignReviewerCommand, TopicResult<AssignReviewerResultDto>>
{
    public async Task<TopicResult<AssignReviewerResultDto>> Handle(AssignReviewerCommand request, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(request.TopicId, cancellationToken);
        var round = topic is null ? null : await ReviewerRound.FindAsync(rounds, topic.RoundId, cancellationToken);
        if (topic is null || round is null) return TopicResult<AssignReviewerResultDto>.Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        var session = await ReviewerSession.LoadAsync(reviewers, topics, groups, round, RoundRules.TodayVietnam(clock), cancellationToken);
        var result = await session.AssignAsync(topic.Id, request.Input.ReviewerId, request.Input.ExpectedReviewerId, request.ActorId,
            clock.GetUtcNow().UtcDateTime, cancellationToken);
        return result.Status == TopicResultStatus.Ok
            ? TopicResult<AssignReviewerResultDto>.Ok(new AssignReviewerResultDto { Row = result.Row!, Warning = result.Warning }, result.Message)
            : TopicResult<AssignReviewerResultDto>.Fail(result.Status, result.Message);
    }
}

public sealed class AssignReviewersBatchHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    IReviewerRepository reviewers, TimeProvider clock) : IRequestHandler<AssignReviewersBatchCommand, TopicResult<ReviewerBatchResultDto>>
{
    public async Task<TopicResult<ReviewerBatchResultDto>> Handle(AssignReviewersBatchCommand request, CancellationToken cancellationToken)
    {
        var round = await ReviewerRound.FindAsync(rounds, request.Input.RoundId, cancellationToken);
        if (round is null) return TopicResult<ReviewerBatchResultDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        var session = await ReviewerSession.LoadAsync(reviewers, topics, groups, round, RoundRules.TodayVietnam(clock), cancellationToken);
        var result = new ReviewerBatchResultDto();
        var seen = new HashSet<Guid>();
        foreach (var item in request.Input.Items!)
        {
            var code = session.Topics.FirstOrDefault(t => t.Id == item.TopicId)?.Code ?? string.Empty;
            ReviewerAssignResult outcome;
            if (!seen.Add(item.TopicId)) outcome = new(TopicResultStatus.Conflict, ReviewerRules.DuplicateInBatchMessage);
            else if (code.Length == 0) outcome = new(TopicResultStatus.Conflict, ReviewerRules.TopicNotInRoundMessage);
            else
            {
                // Mỗi dòng một transaction riêng: dòng lỗi không làm hỏng dòng hợp lệ.
                outcome = await session.AssignAsync(item.TopicId, item.ReviewerId, item.ExpectedReviewerId, request.ActorId,
                    clock.GetUtcNow().UtcDateTime, cancellationToken);
            }
            var ok = outcome.Status == TopicResultStatus.Ok;
            if (ok) result.Succeeded++; else result.Failed++;
            result.Results.Add(new ReviewerBatchResultItemDto
            {
                TopicId = item.TopicId, Code = code, Ok = ok, Message = outcome.Message, Warning = outcome.Warning, Row = outcome.Row
            });
        }
        return TopicResult<ReviewerBatchResultDto>.Ok(result,
            result.Failed == 0 ? $"Đã lưu {result.Succeeded} phân công." : $"Đã lưu {result.Succeeded} phân công, {result.Failed} dòng lỗi.");
    }
}

public sealed class ListMyReviewTopicsHandler(IRoundRepository rounds, IGroupRepository groups, IReviewerRepository reviewers)
    : IRequestHandler<ListMyReviewTopicsQuery, TopicResult<MyReviewDto>>
{
    public async Task<TopicResult<MyReviewDto>> Handle(ListMyReviewTopicsQuery request, CancellationToken cancellationToken)
    {
        var mine = await reviewers.ListByReviewerAsync(request.LecturerId, cancellationToken);
        var dto = new MyReviewDto();
        foreach (var roundId in mine.Select(t => t.RoundId).Distinct())
            if (await rounds.GetByIdAsync(roundId, cancellationToken) is { } round)
                dto.Rounds.Add(new ReviewerRoundDto { Id = round.Id, Name = round.Name, Status = RoundRules.Label(round.Status), LoadMax = round.LecturerLoadMax });
        dto.RoundId = request.RoundId ?? dto.Rounds.FirstOrDefault()?.Id;
        var selected = mine.Where(t => t.RoundId == dto.RoundId).OrderBy(t => t.Number).ToList();
        var members = await groups.MembersOf(selected, cancellationToken);
        var presence = await reviewers.GetReportPresenceAsync(selected.Select(t => t.Id).ToList(), cancellationToken);
        dto.Items = selected.Select(t =>
        {
            var hasFinal = presence.GetValueOrDefault(t.Id, new ReportPresence(false, false)).HasFinal;
            var blocker = ReviewerRules.ScoreBlocker(t, request.LecturerId, hasFinal);
            return new MyReviewItemDto
            {
                TopicId = t.Id,
                Code = t.Code,
                Title = t.Title,
                Group = t.GroupId is { } groupId && members.TryGetValue(groupId, out var group)
                    ? TopicMapping.Members(group.Members, group.RepresentativeId) : [],
                Supervisor = new TopicPersonDto { Id = t.SupervisorId, Code = t.Supervisor?.UserCode ?? string.Empty, Name = t.Supervisor?.FullName ?? string.Empty },
                AssignedAt = t.ReviewerAssignedAt is { } at ? DateTime.SpecifyKind(at, DateTimeKind.Utc) : null,
                HasFinal = hasFinal,
                CanScore = blocker is null,
                ScoreBlockedReason = blocker,
                Scored = false
            };
        }).ToList();
        return TopicResult<MyReviewDto>.Ok(dto);
    }
}
