using Backend.Application.Rounds;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;

namespace Backend.Application.Topics;

// Ghi danh nhóm vào đề tài công bố và hủy ghi danh (P03-S02, PDR-047, PDR-054).
// Người ghi danh là đại diện; thành viên thứ hai nhập bằng mã sinh viên được thêm ngay vào nhóm.
public record RegisterTopicCommand(Guid StudentId, Guid TopicId, IReadOnlyList<string>? MemberCodes) : IRequest<TopicResult<MyRegistrationDto>>;
public record CancelRegistrationCommand(Guid StudentId, Guid TopicId) : IRequest<TopicResult<MyRegistrationDto>>;
public record GetMyRegistrationQuery(Guid StudentId, Guid RoundId) : IRequest<TopicResult<MyRegistrationDto>>;

internal static class RegistrationMapping
{
    public static async Task<MyRegistrationDto> BuildAsync(IGroupRepository groups, ITopicRepository topics, ThesisRound round,
        Guid studentId, DateOnly today, CancellationToken cancellationToken)
    {
        var open = TopicRules.RegistrationOpen(round, today);
        var dto = new MyRegistrationDto { Round = TopicRules.RoundInfo(round, today, forLecturer: false), RegistrationOpen = open };
        var group = await groups.GetByStudentAsync(round.Id, studentId, cancellationToken);
        if (group is null) return dto;

        dto.Group = new GroupDto
        {
            Id = group.Id,
            RepresentativeId = group.RepresentativeId,
            Members = TopicMapping.Members(group.Members, group.RepresentativeId)
        };
        if (await groups.GetTopicOfGroupAsync(group.Id, cancellationToken) is { } topic)
        {
            dto.Topic = TopicMapping.ToDto(topic, round, today, viewerIsSupervisor: false,
                new Dictionary<Guid, ThesisGroup> { [group.Id] = group });
            dto.CanCancel = open && topic.Source == TopicSource.Lecturer && topic.Status == TopicStatus.Registered;
        }

        var registrations = await groups.ListRegistrationsAsync(group.Id, cancellationToken);
        var names = await topics.GetUserNamesAsync(registrations
            .SelectMany(r => new[] { (Guid?)r.Registration.RegisteredById, r.Registration.CancelledById })
            .Where(id => id is not null).Select(id => id!.Value).Distinct().ToList(), cancellationToken);
        dto.History = registrations.Select(r => new RegistrationHistoryDto
        {
            TopicId = r.Topic.Id,
            TopicCode = r.Topic.Code,
            TopicTitle = r.Topic.Title,
            RegisteredAt = DateTime.SpecifyKind(r.Registration.CreatedAt, DateTimeKind.Utc),
            RegisteredBy = names.GetValueOrDefault(r.Registration.RegisteredById, "Tài khoản đã xóa"),
            CancelledAt = r.Registration.CancelledAt is { } at ? DateTime.SpecifyKind(at, DateTimeKind.Utc) : null,
            CancelledBy = r.Registration.CancelledById is { } by ? names.GetValueOrDefault(by, "Tài khoản đã xóa") : null
        }).ToList();
        return dto;
    }
}

public sealed class RegisterTopicHandler(
    IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<RegisterTopicCommand, TopicResult<MyRegistrationDto>>
{
    public async Task<TopicResult<MyRegistrationDto>> Handle(RegisterTopicCommand request, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(request.TopicId, cancellationToken);
        if (topic is null) return Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        var round = (await rounds.GetByIdAsync(topic.RoundId, cancellationToken))!;
        var me = request.StudentId;
        if (!TopicMapping.IsStudentOf(round, me)) return Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundStudentMessage);
        // Sinh viên không thấy đề tài trước công bố nên trả như không tồn tại.
        if (round.TopicsPublishedAt is null) return Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        if (topic.Source != TopicSource.Lecturer) return Fail(TopicResultStatus.Conflict, TopicRules.NotPublicTopicMessage);
        var today = RoundRules.TodayVietnam(clock);
        if (!TopicRules.RegistrationOpen(round, today)) return Fail(TopicResultStatus.Conflict, TopicRules.RegistrationClosedMessage);

        var codes = (request.MemberCodes ?? [])
            .Select(c => c.Trim()).Where(c => c.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var now = clock.GetUtcNow().UtcDateTime;
        var group = await groups.GetByStudentAsync(round.Id, me, cancellationToken);
        var newGroup = group is null;
        if (group is not null)
        {
            // Nhóm giữ nguyên sau khi hủy ghi danh (PDR-047): chỉ đại diện ghi danh lại, không đổi thành viên.
            if (group.RepresentativeId != me) return Fail(TopicResultStatus.Forbidden, TopicRules.OnlyRepresentativeMessage);
            var others = group.Members.Where(m => m.StudentId != me).Select(m => m.Student?.UserCode ?? string.Empty);
            if (codes.Count > 0 && !codes.ToHashSet(StringComparer.OrdinalIgnoreCase).SetEquals(others))
                return Fail(TopicResultStatus.Invalid, TopicRules.FixedMembersMessage);
            if (await groups.GetTopicOfGroupAsync(group.Id, cancellationToken) is not null)
                return Fail(TopicResultStatus.Conflict, TopicRules.GroupHasTopicMessage);
        }
        else
        {
            if (codes.Count > ThesisGroup.MaxMembers - 1)
                return Fail(TopicResultStatus.Invalid, $"Nhóm có tối đa {ThesisGroup.MaxMembers} sinh viên; chỉ nhập mã của một thành viên.");
            var found = await rounds.GetActiveUsersByCodesOrEmailsAsync(UserRole.Student, codes, cancellationToken);
            var partners = new List<User>();
            foreach (var code in codes)
            {
                var user = found.FirstOrDefault(u => string.Equals(u.UserCode, code, StringComparison.OrdinalIgnoreCase)
                                                     || string.Equals(u.Email, code, StringComparison.OrdinalIgnoreCase));
                if (user is not null && user.Id == me)
                    return Fail(TopicResultStatus.Invalid, "Không nhập mã của chính bạn; người ghi danh là đại diện nhóm.");
                if (user is null || !TopicMapping.IsStudentOf(round, user.Id))
                    return Fail(TopicResultStatus.Invalid, $"Mã sinh viên {code} không tồn tại hoặc không thuộc đợt.");
                partners.Add(user);
            }
            if (partners.Count > 0 &&
                (await groups.GetGroupedStudentIdsAsync(round.Id, partners.Select(p => p.Id).ToList(), cancellationToken)) is { Count: > 0 } grouped)
                return Fail(TopicResultStatus.Invalid,
                    $"Sinh viên {partners.First(p => grouped.Contains(p.Id)).UserCode} đã có nhóm trong đợt.");

            group = new ThesisGroup { RoundId = round.Id, RepresentativeId = me, CreatedAt = now };
            foreach (var studentId in partners.Select(p => p.Id).Prepend(me))
                group.Members.Add(new GroupMember { GroupId = group.Id, RoundId = round.Id, StudentId = studentId, CreatedAt = now });
        }

        if (topic.GroupId is not null || TopicRules.Effective(topic, round, today) != TopicStatus.NotRegistered)
            return Fail(TopicResultStatus.Conflict, TopicRules.TopicTakenMessage);

        var names = await topics.GetUserNamesAsync(group.Members.Select(m => m.StudentId).ToList(), cancellationToken);
        var memberText = string.Join(", ", group.Members
            .OrderByDescending(m => m.StudentId == group.RepresentativeId)
            .Select(m => names.GetValueOrDefault(m.StudentId, "") + (m.StudentId == group.RepresentativeId ? " (đại diện)" : "")));
        var history = TopicMapping.History(topic, me, TopicHistoryCategories.Group, "Ghi danh", now, $"Nhóm: {memberText}");
        var batch = Guid.NewGuid();
        var myName = names.GetValueOrDefault(me, "Đại diện nhóm");
        var notifications = group.Members.Where(m => m.StudentId != me).Select(m => new Notification
        {
            BatchId = batch,
            RecipientUserId = m.StudentId,
            SenderUserId = me,
            Kind = NotificationKinds.Assign,
            Text = newGroup
                ? $"{myName} đã thêm bạn vào nhóm và ghi danh đề tài {topic.Code} “{topic.Title}”."
                : $"{myName} đã ghi danh lại cho nhóm đề tài {topic.Code} “{topic.Title}”.",
            Href = "/sv/dang-ky",
            CreatedAt = now
        }).ToList();
        var registration = new TopicRegistration { TopicId = topic.Id, GroupId = group.Id, RegisteredById = me, CreatedAt = now };

        var outcome = await groups.RegisterAsync(group, newGroup, topic.Id, registration, history, notifications, cancellationToken);
        return outcome switch
        {
            RegisterOutcome.Registered => TopicResult<MyRegistrationDto>.Ok(
                await RegistrationMapping.BuildAsync(groups, topics, round, me, today, cancellationToken), "Đã ghi danh đề tài"),
            RegisterOutcome.TopicTaken => Fail(TopicResultStatus.Conflict, TopicRules.TopicTakenMessage),
            RegisterOutcome.GroupHasTopic => Fail(TopicResultStatus.Conflict, TopicRules.GroupHasTopicMessage),
            _ => Fail(TopicResultStatus.Conflict, "Bạn hoặc thành viên vừa vào một nhóm khác trong đợt. Tải lại trang rồi thử lại.")
        };
    }

    private static TopicResult<MyRegistrationDto> Fail(TopicResultStatus status, string message) =>
        TopicResult<MyRegistrationDto>.Fail(status, message);
}

public sealed class CancelRegistrationHandler(
    IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, IOutlineRepository outlines, TimeProvider clock)
    : IRequestHandler<CancelRegistrationCommand, TopicResult<MyRegistrationDto>>
{
    public async Task<TopicResult<MyRegistrationDto>> Handle(CancelRegistrationCommand request, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(request.TopicId, cancellationToken);
        if (topic is null) return Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        if (topic.Source != TopicSource.Lecturer || topic.Status != TopicStatus.Registered)
            return Fail(TopicResultStatus.Conflict, TopicRules.NotRegisteredMessage);
        var round = (await rounds.GetByIdAsync(topic.RoundId, cancellationToken))!;
        var me = request.StudentId;
        if (!TopicMapping.IsStudentOf(round, me)) return Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundStudentMessage);

        var group = await groups.GetByStudentAsync(round.Id, me, cancellationToken);
        if (group is null || topic.GroupId != group.Id) return Fail(TopicResultStatus.Conflict, TopicRules.NotRegisteredMessage);
        var today = RoundRules.TodayVietnam(clock);
        if (!TopicRules.RegistrationOpen(round, today)) return Fail(TopicResultStatus.Conflict, TopicRules.RegistrationClosedMessage);
        // PDR-047: chỉ hủy khi nhóm chưa nộp đề cương.
        if (await outlines.HasOutlineAsync(topic.Id, cancellationToken))
            return Fail(TopicResultStatus.Conflict, TopicRules.OutlineSubmittedMessage);

        var now = clock.GetUtcNow().UtcDateTime;
        var history = TopicMapping.History(topic, me, TopicHistoryCategories.Group, "Hủy ghi danh", now, "Hủy cho cả nhóm; nhóm giữ nguyên thành viên.");
        if (!await groups.CancelAsync(topic.Id, group.Id, me, now, history, cancellationToken))
            return Fail(TopicResultStatus.Conflict, TopicRules.NotRegisteredMessage);
        return TopicResult<MyRegistrationDto>.Ok(
            await RegistrationMapping.BuildAsync(groups, topics, round, me, today, cancellationToken), "Đã hủy ghi danh cho cả nhóm");
    }

    private static TopicResult<MyRegistrationDto> Fail(TopicResultStatus status, string message) =>
        TopicResult<MyRegistrationDto>.Fail(status, message);
}

public sealed class GetMyRegistrationHandler(
    IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<GetMyRegistrationQuery, TopicResult<MyRegistrationDto>>
{
    public async Task<TopicResult<MyRegistrationDto>> Handle(GetMyRegistrationQuery request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.RoundId, cancellationToken);
        if (round is null || round.Status == RoundStatus.Draft)
            return TopicResult<MyRegistrationDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (!TopicMapping.IsStudentOf(round, request.StudentId))
            return TopicResult<MyRegistrationDto>.Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundStudentMessage);
        return TopicResult<MyRegistrationDto>.Ok(await RegistrationMapping.BuildAsync(groups, topics, round, request.StudentId,
            RoundRules.TodayVietnam(clock), cancellationToken));
    }
}
