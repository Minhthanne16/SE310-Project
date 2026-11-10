using Backend.Application.Common;
using Backend.Application.Rounds;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Topics;

// Đề tài của giảng viên và công bố danh sách (P03-S01, PDR-053). Giáo vụ xem mọi đề tài của đợt;
// GVHD thêm/sửa/xóa đề tài của mình; sinh viên chỉ xem danh sách đã công bố của đợt mình thuộc.
public enum ViewerRole { Student, Lecturer, AcademicAffairs }

public record ListMyTopicsQuery(Guid LecturerId, Guid RoundId) : IRequest<TopicResult<LecturerTopicsDto>>;
public record CreateTopicCommand(Guid LecturerId, TopicInputDto Topic) : IRequest<TopicResult<TopicDto>>;
public record UpdateTopicCommand(Guid LecturerId, Guid TopicId, TopicInputDto Topic) : IRequest<TopicResult<TopicDto>>;
public record DeleteTopicCommand(Guid LecturerId, Guid TopicId) : IRequest<TopicResult<bool>>;
public record ListRoundTopicsQuery(Guid RoundId) : IRequest<TopicResult<RoundTopicsDto>>;
public record ListPublishedTopicsQuery(Guid StudentId, Guid RoundId) : IRequest<TopicResult<RoundTopicsDto>>;
public record GetTopicQuery(Guid TopicId, Guid ViewerId, ViewerRole Role) : IRequest<TopicResult<TopicDetailDto>>;

public enum TopicResultStatus { Ok, Created, NotFound, Forbidden, Conflict, Invalid }

public sealed record TopicResult<T>(TopicResultStatus Status, ApiResponse<T> Response)
{
    public static TopicResult<T> Ok(T data, string message = "Thao tác thành công") => new(TopicResultStatus.Ok, ApiResponse<T>.Ok(data, message));
    public static TopicResult<T> Created(T data, string message) => new(TopicResultStatus.Created, ApiResponse<T>.Ok(data, message));
    public static TopicResult<T> Fail(TopicResultStatus status, string message) => new(status, ApiResponse<T>.Fail(message));
}

internal sealed class TopicInputValidator : AbstractValidator<TopicInputDto>
{
    public TopicInputValidator()
    {
        RuleFor(x => TopicRules.Clean(x.Title)).NotEmpty().WithMessage("Nhập tên đề tài.")
            .MaximumLength(TopicRules.MaxTitleLength).WithMessage($"Tên đề tài tối đa {TopicRules.MaxTitleLength} ký tự.")
            .OverridePropertyName("title");
        RuleFor(x => TopicRules.Clean(x.Field)).NotEmpty().WithMessage("Chọn lĩnh vực.")
            .MaximumLength(TopicRules.MaxFieldLength).WithMessage($"Lĩnh vực tối đa {TopicRules.MaxFieldLength} ký tự.")
            .OverridePropertyName("field");
        RuleFor(x => TopicRules.Clean(x.Description)).NotEmpty().WithMessage("Nhập mô tả đề tài.")
            .MaximumLength(TopicRules.MaxDescriptionLength).WithMessage($"Mô tả tối đa {TopicRules.MaxDescriptionLength} ký tự.")
            .OverridePropertyName("description");
        RuleFor(x => TopicRules.Clean(x.Requirements))
            .MaximumLength(TopicRules.MaxRequirementsLength).WithMessage($"Yêu cầu tối đa {TopicRules.MaxRequirementsLength} ký tự.")
            .OverridePropertyName("requirements");
    }
}

public sealed class CreateTopicValidator : AbstractValidator<CreateTopicCommand>
{
    public CreateTopicValidator() => RuleFor(x => x.Topic).SetValidator(new TopicInputValidator());
}

public sealed class UpdateTopicValidator : AbstractValidator<UpdateTopicCommand>
{
    public UpdateTopicValidator() => RuleFor(x => x.Topic).SetValidator(new TopicInputValidator());
}

internal static class TopicMapping
{
    public static TopicDto Fill(TopicDto dto, ThesisTopic topic, ThesisRound round, DateOnly today, bool viewerIsSupervisor,
        IReadOnlyDictionary<Guid, ThesisGroup>? groups = null)
    {
        dto.Id = topic.Id;
        dto.RoundId = topic.RoundId;
        dto.Code = topic.Code;
        dto.Title = topic.Title;
        dto.Field = topic.Field;
        dto.Description = topic.Description;
        dto.Requirements = topic.Requirements;
        dto.Supervisor = new TopicPersonDto
        {
            Id = topic.SupervisorId,
            Code = topic.Supervisor?.UserCode ?? string.Empty,
            Name = topic.Supervisor?.FullName ?? string.Empty
        };
        dto.Source = TopicRules.SourceLabel(topic.Source);
        dto.Status = TopicRules.Label(TopicRules.Effective(topic, round, today));
        dto.CreatedAt = DateTime.SpecifyKind(topic.CreatedAt, DateTimeKind.Utc);
        dto.UpdatedAt = topic.UpdatedAt is { } updated ? DateTime.SpecifyKind(updated, DateTimeKind.Utc) : null;
        dto.CanEdit = viewerIsSupervisor ? TopicRules.EditScope(topic, round, today) : TopicEditScopes.None;
        dto.CanDelete = viewerIsSupervisor && TopicRules.CanDelete(round);
        dto.Group = topic.GroupId is { } groupId && groups?.GetValueOrDefault(groupId) is { } group
            ? Members(group.Members, group.RepresentativeId)
            : [];
        return dto;
    }

    public static List<GroupMemberDto> Members(IEnumerable<GroupMember> list, Guid representativeId) => list
        .OrderByDescending(m => m.StudentId == representativeId).ThenBy(m => m.Student?.UserCode)
        .Select(m => new GroupMemberDto
        {
            Id = m.StudentId,
            Code = m.Student?.UserCode ?? string.Empty,
            Name = m.Student?.FullName ?? string.Empty,
            ClassName = m.Student?.ClassName ?? string.Empty,
            Representative = m.StudentId == representativeId
        }).ToList();

    public static TopicDto ToDto(ThesisTopic topic, ThesisRound round, DateOnly today, bool viewerIsSupervisor,
        IReadOnlyDictionary<Guid, ThesisGroup>? groups = null) =>
        Fill(new TopicDto(), topic, round, today, viewerIsSupervisor, groups);

    public static Task<IReadOnlyDictionary<Guid, ThesisGroup>> MembersOf(
        this IGroupRepository groups, IEnumerable<ThesisTopic> topics, CancellationToken cancellationToken) =>
        groups.GetGroupsAsync(topics.Where(t => t.GroupId is not null).Select(t => t.GroupId!.Value).Distinct().ToList(), cancellationToken);

    public static TopicHistoryEntry History(ThesisTopic topic, Guid? actorId, string category, string action, DateTime now, string? detail = null) => new()
    {
        TopicId = topic.Id,
        ActorUserId = actorId,
        Category = category,
        Action = action,
        Detail = detail,
        CreatedAt = now
    };

    public static bool IsLecturerOf(ThesisRound round, Guid userId) =>
        round.Participants.Any(p => p.UserId == userId && p.Kind == ParticipantKind.Lecturer);

    public static bool IsStudentOf(ThesisRound round, Guid userId) =>
        round.Participants.Any(p => p.UserId == userId && p.Kind == ParticipantKind.Student);
}

public sealed class ListMyTopicsHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<ListMyTopicsQuery, TopicResult<LecturerTopicsDto>>
{
    public async Task<TopicResult<LecturerTopicsDto>> Handle(ListMyTopicsQuery request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.RoundId, cancellationToken);
        if (round is null || round.Status == RoundStatus.Draft)
            return TopicResult<LecturerTopicsDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (!TopicMapping.IsLecturerOf(round, request.LecturerId))
            return TopicResult<LecturerTopicsDto>.Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundLecturerMessage);

        var today = RoundRules.TodayVietnam(clock);
        var all = await topics.ListByRoundAsync(round.Id, cancellationToken: cancellationToken);
        var mine = all.Where(t => t.SupervisorId == request.LecturerId && t.Status != TopicStatus.Cancelled).ToList();
        var members = await groups.MembersOf(mine, cancellationToken);
        return TopicResult<LecturerTopicsDto>.Ok(new LecturerTopicsDto
        {
            Round = TopicRules.RoundInfo(round, today, forLecturer: true),
            Items = mine.Select(t => TopicMapping.ToDto(t, round, today, viewerIsSupervisor: true, members)).ToList(),
            Load = TopicRules.Load(request.LecturerId, all, round)
        });
    }
}

public sealed class CreateTopicHandler(IRoundRepository rounds, ITopicRepository topics, TimeProvider clock)
    : IRequestHandler<CreateTopicCommand, TopicResult<TopicDto>>
{
    public async Task<TopicResult<TopicDto>> Handle(CreateTopicCommand request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.Topic.RoundId, cancellationToken);
        if (round is null || round.Status == RoundStatus.Draft)
            return TopicResult<TopicDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (!TopicMapping.IsLecturerOf(round, request.LecturerId))
            return TopicResult<TopicDto>.Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundLecturerMessage);
        var today = RoundRules.TodayVietnam(clock);
        if (TopicRules.SubmitBlocker(round, today) is { } blocker)
            return TopicResult<TopicDto>.Fail(TopicResultStatus.Conflict, blocker);

        var now = clock.GetUtcNow().UtcDateTime;
        var topic = new ThesisTopic
        {
            RoundId = round.Id,
            Title = TopicRules.Clean(request.Topic.Title),
            Field = TopicRules.Clean(request.Topic.Field),
            Description = TopicRules.Clean(request.Topic.Description),
            Requirements = TopicRules.CleanOptional(request.Topic.Requirements),
            SupervisorId = request.LecturerId,
            Source = TopicSource.Lecturer,
            Status = TopicStatus.NotRegistered,
            CreatedAt = now
        };
        topic.History.Add(TopicMapping.History(topic, request.LecturerId, TopicHistoryCategories.Status, "Gửi đề tài", now));
        await topics.AddAsync(topic, cancellationToken);

        var saved = (await topics.GetByIdAsync(topic.Id, cancellationToken))!;
        var all = await topics.ListByRoundAsync(round.Id, cancellationToken: cancellationToken);
        var load = TopicRules.Load(request.LecturerId, all, round);
        // Vượt mức chỉ cảnh báo, không chặn (BUSINESS_RULES).
        var message = load.Level == "over"
            ? $"Đã gửi đề tài. Lưu ý: bạn đang có {load.Count} đề tài, vượt mức tối đa {load.Max} đề tài của đợt."
            : "Đã gửi đề tài";
        return TopicResult<TopicDto>.Created(TopicMapping.ToDto(saved, round, today, viewerIsSupervisor: true), message);
    }
}

public sealed class UpdateTopicHandler(IRoundRepository rounds, ITopicRepository topics, TimeProvider clock)
    : IRequestHandler<UpdateTopicCommand, TopicResult<TopicDto>>
{
    private static readonly (string Label, Func<ThesisTopic, string?> Get)[] Fields =
    [
        ("Tên đề tài", t => t.Title),
        ("Lĩnh vực", t => t.Field),
        ("Mô tả", t => t.Description),
        ("Yêu cầu", t => t.Requirements)
    ];

    public async Task<TopicResult<TopicDto>> Handle(UpdateTopicCommand request, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(request.TopicId, cancellationToken);
        if (topic is null)
            return TopicResult<TopicDto>.Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        if (topic.SupervisorId != request.LecturerId)
            return TopicResult<TopicDto>.Fail(TopicResultStatus.Forbidden, TopicRules.NotSupervisorMessage);
        var round = (await rounds.GetByIdAsync(topic.RoundId, cancellationToken))!;
        var today = RoundRules.TodayVietnam(clock);

        var title = TopicRules.Clean(request.Topic.Title);
        var field = TopicRules.Clean(request.Topic.Field);
        switch (TopicRules.EditScope(topic, round, today))
        {
            case TopicEditScopes.None:
                return TopicResult<TopicDto>.Fail(TopicResultStatus.Conflict,
                    round.Status != RoundStatus.Running ? TopicRules.NotRunningMessage : TopicRules.HasGroupMessage);
            case TopicEditScopes.Content when title != topic.Title || field != topic.Field:
                return TopicResult<TopicDto>.Fail(TopicResultStatus.Conflict, TopicRules.PublishedContentOnlyMessage);
        }

        var before = Fields.Select(f => f.Get(topic)).ToArray();
        topic.Title = title;
        topic.Field = field;
        topic.Description = TopicRules.Clean(request.Topic.Description);
        topic.Requirements = TopicRules.CleanOptional(request.Topic.Requirements);
        var changes = Fields
            .Select((f, i) => (f.Label, Before: before[i], After: f.Get(topic)))
            .Where(c => c.Before != c.After)
            .Select(c => $"{c.Label}: {c.Before ?? "(trống)"} → {c.After ?? "(trống)"}")
            .ToList();
        if (changes.Count > 0)
        {
            var now = clock.GetUtcNow().UtcDateTime;
            topic.UpdatedAt = now;
            topic.History.Add(TopicMapping.History(topic, request.LecturerId, TopicHistoryCategories.Content, "Sửa đề tài", now,
                string.Join("; ", changes)));
            await topics.SaveAsync(cancellationToken);
        }
        return TopicResult<TopicDto>.Ok(TopicMapping.ToDto(topic, round, today, viewerIsSupervisor: true),
            changes.Count > 0 ? "Đã lưu đề tài" : "Không có thay đổi");
    }
}

public sealed class DeleteTopicHandler(IRoundRepository rounds, ITopicRepository topics)
    : IRequestHandler<DeleteTopicCommand, TopicResult<bool>>
{
    public async Task<TopicResult<bool>> Handle(DeleteTopicCommand request, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(request.TopicId, cancellationToken);
        if (topic is null)
            return TopicResult<bool>.Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        if (topic.SupervisorId != request.LecturerId)
            return TopicResult<bool>.Fail(TopicResultStatus.Forbidden, TopicRules.NotSupervisorMessage);
        var round = (await rounds.GetByIdAsync(topic.RoundId, cancellationToken))!;
        if (round.Status != RoundStatus.Running)
            return TopicResult<bool>.Fail(TopicResultStatus.Conflict, TopicRules.NotRunningMessage);
        if (!TopicRules.CanDelete(round))
            return TopicResult<bool>.Fail(TopicResultStatus.Conflict, TopicRules.PublishedNoDeleteMessage);

        // Trước công bố sinh viên chưa thấy và chưa có nhóm nên xóa hẳn cùng lịch sử của đề tài (PDR-053).
        await topics.DeleteAsync(topic, cancellationToken);
        return TopicResult<bool>.Ok(true, "Đã xóa đề tài");
    }
}

public sealed class ListRoundTopicsHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<ListRoundTopicsQuery, TopicResult<RoundTopicsDto>>
{
    public async Task<TopicResult<RoundTopicsDto>> Handle(ListRoundTopicsQuery request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.RoundId, cancellationToken);
        if (round is null)
            return TopicResult<RoundTopicsDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        var today = RoundRules.TodayVietnam(clock);
        var all = await topics.ListByRoundAsync(round.Id, cancellationToken: cancellationToken);
        var visible = all.Where(t => t.Status != TopicStatus.Cancelled).ToList();
        var members = await groups.MembersOf(visible, cancellationToken);
        return TopicResult<RoundTopicsDto>.Ok(new RoundTopicsDto
        {
            Round = TopicRules.RoundInfo(round, today, forLecturer: false),
            Items = visible.Select(t => TopicMapping.ToDto(t, round, today, viewerIsSupervisor: false, members)).ToList(),
            Loads = RoundMapping.IdsOf(round, ParticipantKind.Lecturer).Select(id => TopicRules.Load(id, all, round)).ToList()
        });
    }
}

public sealed class ListPublishedTopicsHandler(IRoundRepository rounds, ITopicRepository topics, TimeProvider clock)
    : IRequestHandler<ListPublishedTopicsQuery, TopicResult<RoundTopicsDto>>
{
    public async Task<TopicResult<RoundTopicsDto>> Handle(ListPublishedTopicsQuery request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.RoundId, cancellationToken);
        if (round is null || round.Status == RoundStatus.Draft)
            return TopicResult<RoundTopicsDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (!TopicMapping.IsStudentOf(round, request.StudentId))
            return TopicResult<RoundTopicsDto>.Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundStudentMessage);
        if (round.TopicsPublishedAt is null)
            return TopicResult<RoundTopicsDto>.Fail(TopicResultStatus.Conflict, TopicRules.NotPublishedMessage);

        var today = RoundRules.TodayVietnam(clock);
        var all = await topics.ListByRoundAsync(round.Id, cancellationToken: cancellationToken);
        return TopicResult<RoundTopicsDto>.Ok(new RoundTopicsDto
        {
            Round = TopicRules.RoundInfo(round, today, forLecturer: false),
            // Đề xuất của sinh viên khác (chờ duyệt, bị từ chối) không thuộc danh sách công bố.
            Items = all.Where(t => t.Source == TopicSource.Lecturer)
                .Select(t => TopicMapping.ToDto(t, round, today, viewerIsSupervisor: false)).ToList()
        });
    }
}

public sealed class GetTopicHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<GetTopicQuery, TopicResult<TopicDetailDto>>
{
    public async Task<TopicResult<TopicDetailDto>> Handle(GetTopicQuery request, CancellationToken cancellationToken)
    {
        var topic = await topics.GetByIdAsync(request.TopicId, cancellationToken);
        if (topic is null)
            return TopicResult<TopicDetailDto>.Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        var round = (await rounds.GetByIdAsync(topic.RoundId, cancellationToken))!;

        var isSupervisor = request.Role == ViewerRole.Lecturer && topic.SupervisorId == request.ViewerId;
        var members = await groups.MembersOf([topic], cancellationToken);
        var ownGroup = members.Values.Any(g => g.Members.Any(m => m.StudentId == request.ViewerId));
        var allowed = request.Role switch
        {
            ViewerRole.AcademicAffairs => true,
            ViewerRole.Lecturer => isSupervisor,
            _ => round.TopicsPublishedAt is not null && TopicMapping.IsStudentOf(round, request.ViewerId)
                && (topic.Source == TopicSource.Lecturer || ownGroup)
        };
        // Không tiết lộ đề tài người xem không có quyền: trả như không tồn tại.
        if (!allowed)
            return TopicResult<TopicDetailDto>.Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);

        var today = RoundRules.TodayVietnam(clock);
        // Sinh viên chỉ thấy thành viên khi đề tài là của nhóm mình.
        var detail = (TopicDetailDto)TopicMapping.Fill(new TopicDetailDto(), topic, round, today, isSupervisor,
            request.Role != ViewerRole.Student || ownGroup ? members : null);
        if (request.Role != ViewerRole.Student || (topic.Source == TopicSource.StudentProposal && ownGroup))
        {
            var names = await topics.GetUserNamesAsync(
                topic.History.Where(h => h.ActorUserId is not null).Select(h => h.ActorUserId!.Value).Distinct().ToList(), cancellationToken);
            detail.History = topic.History
                .OrderByDescending(h => h.CreatedAt)
                .Select(h => new TopicHistoryDto
                {
                    Id = h.Id,
                    At = DateTime.SpecifyKind(h.CreatedAt, DateTimeKind.Utc),
                    Actor = h.ActorUserId is { } actor ? names.GetValueOrDefault(actor, "Tài khoản đã xóa") : "Hệ thống",
                    Category = h.Category,
                    Action = h.Action,
                    Detail = h.Detail
                }).ToList();
        }
        return TopicResult<TopicDetailDto>.Ok(detail);
    }
}
