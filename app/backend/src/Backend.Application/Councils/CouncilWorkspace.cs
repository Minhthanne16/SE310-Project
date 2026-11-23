using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;

namespace Backend.Application.Councils;

// Dữ liệu một đợt nạp một lần để dựng màn Hội đồng, kiểm tra kế hoạch và dựng thông báo/lịch sử.
internal sealed class CouncilWorkspace
{
    public required ThesisRound Round { get; init; }
    public required DateOnly Today { get; init; }
    public required Dictionary<Guid, ThesisTopic> Topics { get; init; }
    // Mọi hội đồng của đợt (kể cả đã hủy) kèm mọi lượt.
    public required IReadOnlyList<DefenseCouncil> Councils { get; init; }
    public required IReadOnlyList<DefenseCouncil> SameDay { get; init; }
    public required IReadOnlyList<DefenseCouncilLog> Logs { get; init; }
    public required Dictionary<Guid, User> Users { get; init; }
    public required IReadOnlyDictionary<Guid, ThesisGroup> Groups { get; init; }
    public required IReadOnlyDictionary<Guid, int> ThesisCounts { get; init; }
    public required IReadOnlyDictionary<Guid, string> RoundNames { get; init; }

    public static async Task<CouncilWorkspace> LoadAsync(ICouncilRepository councils, ITopicRepository topics, IGroupRepository groups,
        ThesisRound round, DateOnly today, IReadOnlyCollection<DateOnly> extraDates, IReadOnlyCollection<Guid> extraUsers,
        CancellationToken cancellationToken)
    {
        var roundTopics = await topics.ListByRoundAsync(round.Id, cancellationToken: cancellationToken);
        var roundCouncils = await councils.ListByRoundAsync(round.Id, cancellationToken);
        var dates = roundCouncils.Where(c => c.Status != CouncilStatus.Cancelled).Select(c => c.DefenseDate)
            .Concat(extraDates).Distinct().ToList();
        var sameDay = await councils.ListActiveOnDatesAsync(dates, cancellationToken);
        var logs = await councils.ListLogsAsync(roundCouncils.Select(c => c.Id).ToList(), cancellationToken);
        var userIds = RoundMapping.IdsOf(round, ParticipantKind.Lecturer)
            .Concat(roundCouncils.SelectMany(c => new[] { c.ChairId, c.SecretaryId }))
            .Concat(sameDay.SelectMany(c => new[] { c.ChairId, c.SecretaryId }))
            .Concat(logs.Where(l => l.ActorUserId is not null).Select(l => l.ActorUserId!.Value))
            .Concat(extraUsers)
            .Where(id => id != Guid.Empty).Distinct().ToList();
        var users = (await councils.GetUsersAsync(userIds, cancellationToken)).ToDictionary(u => u.Id);
        var listed = roundTopics.Where(CouncilRules.Listed).ToList();
        var members = await groups.MembersOf(listed, cancellationToken);
        var thesis = await councils.GetThesisCountsAsync(listed.Select(t => t.Id).ToList(), cancellationToken);
        var roundNames = await councils.GetRoundNamesAsync(sameDay.Select(c => c.RoundId).Distinct().ToList(), cancellationToken);
        return new CouncilWorkspace
        {
            Round = round,
            Today = today,
            Topics = roundTopics.ToDictionary(t => t.Id),
            Councils = roundCouncils,
            SameDay = sameDay,
            Logs = logs,
            Users = users,
            Groups = members,
            ThesisCounts = thesis,
            RoundNames = roundNames
        };
    }

    public CouncilCheckContext Context() => new()
    {
        Round = Round,
        Today = Today,
        Topics = Topics,
        Users = Users,
        RoundCouncils = Councils.Where(c => c.Status != CouncilStatus.Cancelled).ToList(),
        SameDayCouncils = SameDay,
        RoundNames = RoundNames
    };

    public DefenseCouncil? Find(Guid councilId) => Councils.FirstOrDefault(c => c.Id == councilId);

    // Xung đột hiện tại chỉ tính cho hội đồng còn sửa được (Nháp, hoặc đã công bố chưa có điểm).
    public List<string> Conflicts(DefenseCouncil council) =>
        council.Status == CouncilStatus.Cancelled || council.FirstScoredAt is not null
            ? []
            : CouncilRules.Check(CouncilRules.PlanOf(council), Context());

    public TopicPersonDto Person(Guid id) => Users.TryGetValue(id, out var user)
        ? new TopicPersonDto { Id = id, Code = user.UserCode, Name = user.FullName }
        : new TopicPersonDto { Id = id };

    public string Name(Guid? id) => id is { } value && Users.TryGetValue(value, out var user) ? user.FullName : "Hệ thống";

    public List<GroupMemberDto> GroupOf(ThesisTopic topic) =>
        topic.GroupId is { } groupId && Groups.TryGetValue(groupId, out var group)
            ? TopicMapping.Members(group.Members, group.RepresentativeId) : [];

    public CouncilSlotDto Slot(DefenseSlot slot)
    {
        Topics.TryGetValue(slot.TopicId, out var topic);
        return new CouncilSlotDto
        {
            Id = slot.Id,
            Order = slot.Order,
            TopicId = slot.TopicId,
            Code = topic?.Code ?? string.Empty,
            Title = topic?.Title ?? string.Empty,
            Group = topic is null ? [] : GroupOf(topic),
            Supervisor = topic is null ? new TopicPersonDto() : TopicPerson(topic.SupervisorId, topic.Supervisor),
            Reviewer = topic?.ReviewerId is { } reviewerId ? TopicPerson(reviewerId, topic.Reviewer) : null,
            Start = CouncilRules.FormatTime(slot.StartTime),
            End = CouncilRules.FormatTime(slot.EndTime),
            ThesisVersionCount = ThesisCounts.GetValueOrDefault(slot.TopicId),
            FinalLocked = topic?.FinalThesisSubmissionId is not null,
            Status = CouncilRules.SlotLabel(slot.Status)
        };
    }

    // Lượt hiển thị: lượt có hiệu lực; với lịch đã hủy là các lượt bị hủy cùng lịch.
    public static IEnumerable<DefenseSlot> ShownSlots(DefenseCouncil council) => council.Slots
        .Where(s => council.Status == CouncilStatus.Cancelled ? s.Status == DefenseSlotStatus.Cancelled : s.Status == DefenseSlotStatus.Active)
        .OrderBy(s => s.Order);

    public List<CouncilCorrectionDto> Corrections(Guid councilId) => Logs
        .Where(l => l.CouncilId == councilId && l.Action == DefenseCouncilActions.Correction)
        .Select(l => new CouncilCorrectionDto { At = Utc(l.CreatedAt), By = Name(l.ActorUserId), Content = l.Detail ?? string.Empty, Reason = l.Reason })
        .ToList();

    public CouncilDto ToDto(DefenseCouncil council)
    {
        var conflicts = Conflicts(council);
        var running = Round.Status == RoundStatus.Running;
        var scored = council.FirstScoredAt is not null;
        var slots = ShownSlots(council).ToList();
        string? editBlocker = council.Status == CouncilStatus.Cancelled ? CouncilRules.CancelledMessage
            : scored ? CouncilRules.ScoredMessage
            : !running ? CouncilRules.RoundNotRunningMessage
            : null;
        string? publishBlocker = council.Status != CouncilStatus.Draft ? null
            : !running ? CouncilRules.RoundNotRunningMessage
            : slots.Count == 0 ? CouncilRules.NoSlotsMessage
            : conflicts.Count > 0 ? $"Còn {conflicts.Count} xung đột; xử lý hết rồi mới công bố."
            : null;
        return new CouncilDto
        {
            Id = council.Id,
            RoundId = council.RoundId,
            Name = council.Name,
            Status = CouncilRules.Label(council.Status),
            Version = council.Version,
            Chair = Person(council.ChairId),
            Secretary = Person(council.SecretaryId),
            Date = RoundRules.FormatDate(council.DefenseDate),
            Room = council.Room,
            PublishedAt = council.PublishedAt is { } published ? Utc(published) : null,
            CancelledAt = council.CancelledAt is { } cancelled ? Utc(cancelled) : null,
            CancelReason = council.CancelReason,
            Scored = scored,
            Slots = slots.Select(Slot).ToList(),
            Conflicts = conflicts,
            Corrections = Corrections(council.Id),
            History = Logs.Where(l => l.CouncilId == council.Id).Select(l => new CouncilLogDto
            {
                Id = l.Id, At = Utc(l.CreatedAt), Actor = Name(l.ActorUserId), Action = l.Action, Reason = l.Reason, Detail = l.Detail
            }).ToList(),
            CanEdit = editBlocker is null,
            EditBlockedReason = editBlocker,
            CanDelete = council.Status == CouncilStatus.Draft,
            CanPublish = council.Status == CouncilStatus.Draft && publishBlocker is null,
            PublishBlockedReason = publishBlocker,
            CanCancel = council.Status == CouncilStatus.Published && !scored && running,
            CanCorrect = council.Status == CouncilStatus.Published && scored
        };
    }

    public CouncilBoardDto Board()
    {
        var councils = Councils.Select(ToDto).ToList();
        var placed = Councils.Where(c => c.Status != CouncilStatus.Cancelled)
            .SelectMany(c => c.Slots.Where(s => s.Status == DefenseSlotStatus.Active)).Select(s => s.TopicId).ToHashSet();
        var pool = Topics.Values.Where(CouncilRules.Listed).Where(t => !placed.Contains(t.Id)).OrderBy(t => t.Number)
            .Select(t =>
            {
                var blocker = CouncilRules.TopicBlocker(t, Round, Today);
                return new CouncilPoolTopicDto
                {
                    TopicId = t.Id,
                    Code = t.Code,
                    Title = t.Title,
                    Group = GroupOf(t),
                    Supervisor = TopicPerson(t.SupervisorId, t.Supervisor),
                    Reviewer = t.ReviewerId is { } reviewerId ? TopicPerson(reviewerId, t.Reviewer) : null,
                    ThesisVersionCount = ThesisCounts.GetValueOrDefault(t.Id),
                    Eligible = blocker is null,
                    BlockedReason = blocker
                };
            }).ToList();
        var eligiblePool = pool.Count(p => p.Eligible);
        return new CouncilBoardDto
        {
            Round = RoundInfo(Round),
            Councils = councils,
            Pool = pool,
            Lecturers = RoundMapping.LecturerIdsForCommittee(Round)
                .Where(id => Users.TryGetValue(id, out var u) && u.IsActive)
                .Select(id => Users[id]).OrderBy(u => u.UserCode, StringComparer.Ordinal)
                .Select(u => new CouncilLecturerDto { Id = u.Id, Code = u.UserCode, Name = u.FullName }).ToList(),
            Stats = new CouncilStatsDto
            {
                Councils = Councils.Count(c => c.Status != CouncilStatus.Cancelled),
                Scheduled = placed.Count,
                Unscheduled = eligiblePool,
                Total = placed.Count + eligiblePool,
                Conflicts = councils.Sum(c => c.Conflicts.Count)
            }
        };
    }

    public static CouncilRoundDto RoundInfo(ThesisRound round) => new()
    {
        Id = round.Id,
        Name = round.Name,
        Status = RoundRules.Label(round.Status),
        DefenseStart = RoundRules.FormatDate(TopicRules.MilestoneStart(round, MilestoneKey.DefenseSchedule)),
        DefenseEnd = RoundRules.FormatDate(TopicRules.MilestoneEnd(round, MilestoneKey.DefenseSchedule))
    };

    // Người liên quan một đề tài: nhóm, GVHD, GVPB (nhận lịch bảo vệ của đề tài, DESIGN · Hội đồng).
    public IEnumerable<Guid> Stakeholders(Guid topicId)
    {
        if (!Topics.TryGetValue(topicId, out var topic)) yield break;
        if (topic.GroupId is { } groupId && Groups.TryGetValue(groupId, out var group))
            foreach (var member in group.Members) yield return member.StudentId;
        yield return topic.SupervisorId;
        if (topic.ReviewerId is { } reviewerId) yield return reviewerId;
    }

    public string Code(Guid topicId) => Topics.TryGetValue(topicId, out var topic) ? topic.Code : "?";

    private static TopicPersonDto TopicPerson(Guid id, User? user) => new()
    {
        Id = id, Code = user?.UserCode ?? string.Empty, Name = user?.FullName ?? string.Empty
    };

    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
