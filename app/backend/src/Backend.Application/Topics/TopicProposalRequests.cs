using Backend.Application.Rounds;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Topics;

// P03-S03: đề xuất đề tài của nhóm sinh viên. Mọi thay đổi trạng thái ở repository
// đều có điều kiện PendingApproval để hủy/duyệt/từ chối cạnh tranh chỉ thắng đúng một lần.
public record CreateProposalCommand(Guid StudentId, ProposalInputDto Proposal) : IRequest<TopicResult<TopicDto>>;
public record UpdateProposalCommand(Guid StudentId, Guid ProposalId, ProposalUpdateDto Proposal) : IRequest<TopicResult<TopicDto>>;
public record CancelProposalCommand(Guid StudentId, Guid ProposalId) : IRequest<TopicResult<TopicDto>>;
public record AcceptProposalCommand(Guid LecturerId, Guid ProposalId) : IRequest<TopicResult<TopicDto>>;
public record RejectProposalCommand(Guid LecturerId, Guid ProposalId, string? Reason) : IRequest<TopicResult<TopicDto>>;
public record ListMyProposalsQuery(Guid StudentId, Guid RoundId) : IRequest<TopicResult<StudentProposalsDto>>;
public record ListLecturerProposalsQuery(Guid LecturerId, Guid RoundId) : IRequest<TopicResult<LecturerProposalsDto>>;
public record ListProposalSupervisorsQuery(Guid StudentId, Guid RoundId) : IRequest<TopicResult<IReadOnlyList<TopicPersonDto>>>;

internal static class ProposalValidation
{
    public static void Apply<T>(AbstractValidator<T> validator, Func<T, TopicInputDto> input)
    {
        validator.RuleFor(x => TopicRules.Clean(input(x).Title)).NotEmpty().WithMessage("Nhập tên đề tài.")
            .MaximumLength(TopicRules.MaxTitleLength).WithMessage($"Tên đề tài tối đa {TopicRules.MaxTitleLength} ký tự.");
        validator.RuleFor(x => TopicRules.Clean(input(x).Field)).NotEmpty().WithMessage("Chọn lĩnh vực.")
            .MaximumLength(TopicRules.MaxFieldLength).WithMessage($"Lĩnh vực tối đa {TopicRules.MaxFieldLength} ký tự.");
        validator.RuleFor(x => TopicRules.Clean(input(x).Description)).NotEmpty().WithMessage("Nhập mô tả đề tài.")
            .MaximumLength(TopicRules.MaxDescriptionLength).WithMessage($"Mô tả tối đa {TopicRules.MaxDescriptionLength} ký tự.");
        validator.RuleFor(x => TopicRules.CleanOptional(input(x).Requirements)).MaximumLength(TopicRules.MaxRequirementsLength)
            .WithMessage($"Yêu cầu tối đa {TopicRules.MaxRequirementsLength} ký tự.");
    }
}

public sealed class CreateProposalValidator : AbstractValidator<CreateProposalCommand>
{
    public CreateProposalValidator()
    {
        ProposalValidation.Apply(this, x => x.Proposal);
        RuleFor(x => x.Proposal.SupervisorId).NotEmpty().WithMessage("Chọn giảng viên hướng dẫn.");
        RuleFor(x => x.Proposal.MemberCodes).Must(codes => codes is null || codes.Count <= ThesisGroup.MaxMembers - 1)
            .WithMessage("Nhóm có tối đa 2 sinh viên; chỉ nhập một mã thành viên.");
    }
}

public sealed class UpdateProposalValidator : AbstractValidator<UpdateProposalCommand>
{
    public UpdateProposalValidator()
    {
        ProposalValidation.Apply(this, x => x.Proposal);
        RuleFor(x => x.Proposal.SupervisorId).NotEmpty().WithMessage("Chọn giảng viên hướng dẫn.");
    }
}

public sealed class RejectProposalValidator : AbstractValidator<RejectProposalCommand>
{
    public RejectProposalValidator()
    {
        RuleFor(x => TopicRules.Clean(x.Reason)).NotEmpty().WithMessage("Nhập lý do từ chối.")
            .MaximumLength(8000).WithMessage("Lý do từ chối tối đa 8000 ký tự.");
    }
}

internal static class ProposalMapping
{
    public static async Task<List<TopicDetailDto>> DetailsAsync(IEnumerable<ThesisTopic> topics, ThesisRound round,
        DateOnly today, ITopicRepository repository, IGroupRepository groups, bool viewerIsSupervisor,
        CancellationToken cancellationToken)
    {
        var list = topics.ToList();
        var members = await groups.MembersOf(list, cancellationToken);
        var names = await repository.GetUserNamesAsync(list.SelectMany(t => t.History)
            .Where(h => h.ActorUserId is not null).Select(h => h.ActorUserId!.Value).Distinct().ToList(), cancellationToken);
        return list.Select(topic => Detail(topic, round, today, viewerIsSupervisor, members, names)).ToList();
    }

    public static TopicDetailDto Detail(ThesisTopic topic, ThesisRound round, DateOnly today, bool viewerIsSupervisor,
        IReadOnlyDictionary<Guid, ThesisGroup> groups, IReadOnlyDictionary<Guid, string> names)
    {
        var dto = (TopicDetailDto)TopicMapping.Fill(new TopicDetailDto(), topic, round, today, viewerIsSupervisor, groups);
        dto.History = History(topic, names);
        return dto;
    }

    public static List<TopicHistoryDto> History(ThesisTopic topic, IReadOnlyDictionary<Guid, string> names) => topic.History
        .OrderByDescending(h => h.CreatedAt).Select(h => new TopicHistoryDto
        {
            Id = h.Id,
            At = DateTime.SpecifyKind(h.CreatedAt, DateTimeKind.Utc),
            Actor = h.ActorUserId is { } actor ? names.GetValueOrDefault(actor, "Tài khoản đã xóa") : "Hệ thống",
            Category = h.Category,
            Action = h.Action,
            Detail = h.Detail
        }).ToList();
}

public sealed class CreateProposalHandler(
    IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<CreateProposalCommand, TopicResult<TopicDto>>
{
    public async Task<TopicResult<TopicDto>> Handle(CreateProposalCommand request, CancellationToken cancellationToken)
    {
        var input = request.Proposal;
        var round = await rounds.GetByIdAsync(input.RoundId, cancellationToken);
        if (round is null || round.Status == RoundStatus.Draft)
            return Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (!TopicMapping.IsStudentOf(round, request.StudentId))
            return Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundStudentMessage);
        var today = RoundRules.TodayVietnam(clock);
        if (!TopicRules.RegistrationOpen(round, today))
            return Fail(TopicResultStatus.Conflict, TopicRules.RegistrationClosedMessage);
        if (!TopicMapping.IsLecturerOf(round, input.SupervisorId))
            return Fail(TopicResultStatus.Invalid, "Giảng viên hướng dẫn không thuộc đợt này.");

        var codes = (input.MemberCodes ?? []).Select(c => c.Trim()).Where(c => c.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var now = clock.GetUtcNow().UtcDateTime;
        var group = await groups.GetByStudentAsync(round.Id, request.StudentId, cancellationToken);
        var newGroup = group is null;
        if (group is not null)
        {
            if (group.RepresentativeId != request.StudentId)
                return Fail(TopicResultStatus.Forbidden, TopicRules.OnlyProposalRepresentativeMessage);
            if (await groups.GetTopicOfGroupAsync(group.Id, cancellationToken) is not null)
                return Fail(TopicResultStatus.Conflict, TopicRules.GroupHasTopicMessage);
            var existingCodes = group.Members.Where(m => m.StudentId != request.StudentId)
                .Select(m => m.Student?.UserCode ?? string.Empty).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (codes.Count > 0 && !codes.ToHashSet(StringComparer.OrdinalIgnoreCase).SetEquals(existingCodes))
                return Fail(TopicResultStatus.Invalid, TopicRules.FixedMembersMessage);
        }
        else
        {
            if (codes.Count > ThesisGroup.MaxMembers - 1)
                return Fail(TopicResultStatus.Invalid, "Nhóm có tối đa 2 sinh viên; chỉ nhập một mã thành viên.");
            var found = await rounds.GetActiveUsersByCodesOrEmailsAsync(UserRole.Student, codes, cancellationToken);
            var partners = new List<User>();
            foreach (var code in codes)
            {
                var partner = found.FirstOrDefault(u => string.Equals(u.UserCode, code, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(u.Email, code, StringComparison.OrdinalIgnoreCase));
                if (partner is not null && partner.Id == request.StudentId)
                    return Fail(TopicResultStatus.Invalid, "Không nhập mã của chính bạn; người gửi là đại diện nhóm.");
                if (partner is null || !TopicMapping.IsStudentOf(round, partner.Id))
                    return Fail(TopicResultStatus.Invalid, $"Mã sinh viên {code} không tồn tại hoặc không thuộc đợt.");
                partners.Add(partner);
            }
            if (partners.Count > 0 && (await groups.GetGroupedStudentIdsAsync(round.Id, partners.Select(p => p.Id).ToList(), cancellationToken))
                is { Count: > 0 } grouped)
                return Fail(TopicResultStatus.Invalid,
                    $"Sinh viên {partners.First(p => grouped.Contains(p.Id)).UserCode} đã có nhóm trong đợt.");

            group = new ThesisGroup { RoundId = round.Id, RepresentativeId = request.StudentId, CreatedAt = now };
            foreach (var studentId in partners.Select(p => p.Id).Prepend(request.StudentId))
                group.Members.Add(new GroupMember { GroupId = group.Id, RoundId = round.Id, StudentId = studentId, CreatedAt = now });
        }

        var proposal = new ThesisTopic
        {
            RoundId = round.Id,
            Title = TopicRules.Clean(input.Title),
            Field = TopicRules.Clean(input.Field),
            Description = TopicRules.Clean(input.Description),
            Requirements = TopicRules.CleanOptional(input.Requirements),
            SupervisorId = input.SupervisorId,
            Source = TopicSource.StudentProposal,
            Status = TopicStatus.PendingApproval,
            GroupId = group.Id,
            CreatedAt = now
        };
        proposal.History.Add(TopicMapping.History(proposal, request.StudentId, TopicHistoryCategories.Status,
            "Gửi đề xuất", now, "Đề xuất đang chờ giảng viên hướng dẫn duyệt."));
        var created = await groups.CreateProposalAsync(group, newGroup, proposal, cancellationToken);
        if (created == ProposalCreateOutcome.MemberTaken)
            return Fail(TopicResultStatus.Conflict, "Bạn hoặc thành viên vừa vào một nhóm khác trong đợt. Tải lại trang rồi thử lại.");
        if (created != ProposalCreateOutcome.Created)
            return Fail(TopicResultStatus.Conflict, TopicRules.GroupHasTopicMessage);

        var saved = (await topics.GetByIdAsync(proposal.Id, cancellationToken))!;
        var memberMap = await groups.GetGroupsAsync([group.Id], cancellationToken);
        return TopicResult<TopicDto>.Created(TopicMapping.ToDto(saved, round, today, viewerIsSupervisor: false, memberMap), "Đã gửi đề xuất");
    }

    private static TopicResult<TopicDto> Fail(TopicResultStatus status, string message) => TopicResult<TopicDto>.Fail(status, message);
}

public sealed class UpdateProposalHandler(
    IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<UpdateProposalCommand, TopicResult<TopicDto>>
{
    public async Task<TopicResult<TopicDto>> Handle(UpdateProposalCommand request, CancellationToken cancellationToken)
    {
        var proposal = await topics.GetByIdAsync(request.ProposalId, cancellationToken);
        if (proposal is null) return Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        if (proposal.Source != TopicSource.StudentProposal || proposal.Status != TopicStatus.PendingApproval)
            return Fail(TopicResultStatus.Conflict, TopicRules.ProposalNotPendingMessage);
        var round = (await rounds.GetByIdAsync(proposal.RoundId, cancellationToken))!;
        if (!TopicRules.RegistrationOpen(round, RoundRules.TodayVietnam(clock)))
            return Fail(TopicResultStatus.Conflict, TopicRules.RegistrationClosedMessage);
        var group = proposal.GroupId is { } groupId ? await groups.GetByStudentAsync(round.Id, request.StudentId, cancellationToken) : null;
        if (group is null || group.Id != proposal.GroupId || group.RepresentativeId != request.StudentId)
            return Fail(TopicResultStatus.Forbidden, TopicRules.OnlyProposalRepresentativeMessage);
        if (!TopicMapping.IsLecturerOf(round, request.Proposal.SupervisorId))
            return Fail(TopicResultStatus.Invalid, "Giảng viên hướng dẫn không thuộc đợt này.");

        var title = TopicRules.Clean(request.Proposal.Title);
        var field = TopicRules.Clean(request.Proposal.Field);
        var description = TopicRules.Clean(request.Proposal.Description);
        var requirements = TopicRules.CleanOptional(request.Proposal.Requirements);
        var changed = proposal.SupervisorId != request.Proposal.SupervisorId || proposal.Title != title || proposal.Field != field
            || proposal.Description != description || proposal.Requirements != requirements;
        var memberMap = await groups.GetGroupsAsync([group.Id], cancellationToken);
        if (!changed)
            return TopicResult<TopicDto>.Ok(TopicMapping.ToDto(proposal, round, RoundRules.TodayVietnam(clock), false, memberMap), "Không có thay đổi");

        var people = await topics.GetUserNamesAsync([proposal.SupervisorId, request.Proposal.SupervisorId], cancellationToken);
        var detail = $"Tên đề tài: {proposal.Title} → {title}; Lĩnh vực: {proposal.Field} → {field}; "
            + $"GVHD: {people.GetValueOrDefault(proposal.SupervisorId, "") } → {people.GetValueOrDefault(request.Proposal.SupervisorId, "")}";
        var now = clock.GetUtcNow().UtcDateTime;
        var history = TopicMapping.History(proposal, request.StudentId, TopicHistoryCategories.Content, "Sửa đề xuất", now, detail);
        if (!await topics.UpdatePendingProposalAsync(proposal.Id, request.Proposal.SupervisorId, title, field, description, requirements,
            now, history, cancellationToken))
            return Fail(TopicResultStatus.Conflict, TopicRules.ProposalNotPendingMessage);

        proposal.SupervisorId = request.Proposal.SupervisorId;
        proposal.Title = title;
        proposal.Field = field;
        proposal.Description = description;
        proposal.Requirements = requirements;
        proposal.UpdatedAt = now;
        return TopicResult<TopicDto>.Ok(TopicMapping.ToDto(proposal, round, RoundRules.TodayVietnam(clock), false, memberMap), "Đã lưu đề xuất");
    }

    private static TopicResult<TopicDto> Fail(TopicResultStatus status, string message) => TopicResult<TopicDto>.Fail(status, message);
}

public sealed class CancelProposalHandler(
    IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<CancelProposalCommand, TopicResult<TopicDto>>
{
    public async Task<TopicResult<TopicDto>> Handle(CancelProposalCommand request, CancellationToken cancellationToken)
    {
        var proposal = await topics.GetByIdAsync(request.ProposalId, cancellationToken);
        if (proposal is null) return Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        if (proposal.Source != TopicSource.StudentProposal || proposal.Status != TopicStatus.PendingApproval)
            return Fail(TopicResultStatus.Conflict, TopicRules.ProposalNotPendingMessage);
        var round = (await rounds.GetByIdAsync(proposal.RoundId, cancellationToken))!;
        var today = RoundRules.TodayVietnam(clock);
        if (!TopicRules.RegistrationOpen(round, today)) return Fail(TopicResultStatus.Conflict, TopicRules.RegistrationClosedMessage);
        var group = await groups.GetByStudentAsync(round.Id, request.StudentId, cancellationToken);
        if (group is null || group.Id != proposal.GroupId) return Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundStudentMessage);

        var now = clock.GetUtcNow().UtcDateTime;
        var history = TopicMapping.History(proposal, request.StudentId, TopicHistoryCategories.Status, "Hủy đề xuất", now,
            "Hủy cho cả nhóm; nhóm giữ nguyên thành viên và đại diện.");
        if (!await topics.TransitionPendingProposalAsync(proposal.Id, TopicStatus.Cancelled, now, history, cancellationToken))
            return Fail(TopicResultStatus.Conflict, TopicRules.ProposalNotPendingMessage);

        proposal.Status = TopicStatus.Cancelled;
        proposal.UpdatedAt = now;
        var memberMap = await groups.GetGroupsAsync([group.Id], cancellationToken);
        return TopicResult<TopicDto>.Ok(TopicMapping.ToDto(proposal, round, today, false, memberMap), "Đã hủy đề xuất cho cả nhóm");
    }

    private static TopicResult<TopicDto> Fail(TopicResultStatus status, string message) => TopicResult<TopicDto>.Fail(status, message);
}

public sealed class AcceptProposalHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<AcceptProposalCommand, TopicResult<TopicDto>>
{
    public Task<TopicResult<TopicDto>> Handle(AcceptProposalCommand request, CancellationToken cancellationToken) =>
        ProposalDecision.Handle(rounds, topics, groups, clock, request.LecturerId, request.ProposalId, TopicStatus.Registered,
            "Chấp nhận đề xuất", null, cancellationToken);
}

public sealed class RejectProposalHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<RejectProposalCommand, TopicResult<TopicDto>>
{
    public Task<TopicResult<TopicDto>> Handle(RejectProposalCommand request, CancellationToken cancellationToken) =>
        ProposalDecision.Handle(rounds, topics, groups, clock, request.LecturerId, request.ProposalId, TopicStatus.Rejected,
            "Từ chối đề xuất", TopicRules.Clean(request.Reason), cancellationToken);
}

internal static class ProposalDecision
{
    public static async Task<TopicResult<TopicDto>> Handle(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
        TimeProvider clock, Guid lecturerId, Guid proposalId, TopicStatus nextStatus, string action, string? detail,
        CancellationToken cancellationToken)
    {
        var proposal = await topics.GetByIdAsync(proposalId, cancellationToken);
        if (proposal is null) return TopicResult<TopicDto>.Fail(TopicResultStatus.NotFound, TopicRules.NotFoundMessage);
        if (proposal.Source != TopicSource.StudentProposal || proposal.Status != TopicStatus.PendingApproval)
            return TopicResult<TopicDto>.Fail(TopicResultStatus.Conflict, TopicRules.ProposalNotPendingMessage);
        if (proposal.SupervisorId != lecturerId)
            return TopicResult<TopicDto>.Fail(TopicResultStatus.Forbidden, TopicRules.NotSupervisorMessage);

        var round = (await rounds.GetByIdAsync(proposal.RoundId, cancellationToken))!;
        var now = clock.GetUtcNow().UtcDateTime;
        var history = TopicMapping.History(proposal, lecturerId, TopicHistoryCategories.Status, action, now, detail);
        if (!await topics.TransitionPendingProposalAsync(proposal.Id, nextStatus, now, history, cancellationToken))
            return TopicResult<TopicDto>.Fail(TopicResultStatus.Conflict, TopicRules.ProposalNotPendingMessage);

        proposal.Status = nextStatus;
        proposal.UpdatedAt = now;
        var memberMap = proposal.GroupId is { } groupId ? await groups.GetGroupsAsync([groupId], cancellationToken)
            : new Dictionary<Guid, ThesisGroup>();
        return TopicResult<TopicDto>.Ok(TopicMapping.ToDto(proposal, round, RoundRules.TodayVietnam(clock), true, memberMap),
            nextStatus == TopicStatus.Registered ? "Đã chấp nhận đề xuất" : "Đã từ chối đề xuất");
    }
}

public sealed class ListMyProposalsHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<ListMyProposalsQuery, TopicResult<StudentProposalsDto>>
{
    public async Task<TopicResult<StudentProposalsDto>> Handle(ListMyProposalsQuery request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.RoundId, cancellationToken);
        if (round is null || round.Status == RoundStatus.Draft)
            return TopicResult<StudentProposalsDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (!TopicMapping.IsStudentOf(round, request.StudentId))
            return TopicResult<StudentProposalsDto>.Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundStudentMessage);
        var today = RoundRules.TodayVietnam(clock);
        var dto = new StudentProposalsDto { Round = TopicRules.RoundInfo(round, today, false), RegistrationOpen = TopicRules.RegistrationOpen(round, today) };
        var group = await groups.GetByStudentAsync(round.Id, request.StudentId, cancellationToken);
        if (group is null) return TopicResult<StudentProposalsDto>.Ok(dto);
        dto.Group = new GroupDto { Id = group.Id, RepresentativeId = group.RepresentativeId, Members = TopicMapping.Members(group.Members, group.RepresentativeId) };
        dto.Items = await ProposalMapping.DetailsAsync(await topics.ListByGroupAsync(group.Id, cancellationToken), round, today, topics, groups,
            viewerIsSupervisor: false, cancellationToken);
        return TopicResult<StudentProposalsDto>.Ok(dto);
    }
}

// Chỉ trả GV đang thuộc chính đợt của sinh viên gọi API. Không tái sử dụng endpoint
// /rounds/people/lecturers của Giáo vụ vì endpoint đó là danh mục toàn hệ thống.
public sealed class ListProposalSupervisorsHandler(IRoundRepository rounds)
    : IRequestHandler<ListProposalSupervisorsQuery, TopicResult<IReadOnlyList<TopicPersonDto>>>
{
    public async Task<TopicResult<IReadOnlyList<TopicPersonDto>>> Handle(
        ListProposalSupervisorsQuery request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.RoundId, cancellationToken);
        if (round is null || round.Status == RoundStatus.Draft)
            return TopicResult<IReadOnlyList<TopicPersonDto>>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (!TopicMapping.IsStudentOf(round, request.StudentId))
            return TopicResult<IReadOnlyList<TopicPersonDto>>.Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundStudentMessage);

        var ids = round.Participants.Where(p => p.Kind == ParticipantKind.Lecturer).Select(p => p.UserId).ToHashSet();
        var people = await rounds.GetActiveUsersAsync(UserRole.Lecturer, cancellationToken);
        var result = people.Where(person => ids.Contains(person.Id)).Select(person => new TopicPersonDto
        {
            Id = person.Id,
            Code = person.UserCode,
            Name = person.FullName
        }).ToList();
        return TopicResult<IReadOnlyList<TopicPersonDto>>.Ok(result);
    }
}

public sealed class ListLecturerProposalsHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups, TimeProvider clock)
    : IRequestHandler<ListLecturerProposalsQuery, TopicResult<LecturerProposalsDto>>
{
    public async Task<TopicResult<LecturerProposalsDto>> Handle(ListLecturerProposalsQuery request, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(request.RoundId, cancellationToken);
        if (round is null || round.Status == RoundStatus.Draft)
            return TopicResult<LecturerProposalsDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (!TopicMapping.IsLecturerOf(round, request.LecturerId))
            return TopicResult<LecturerProposalsDto>.Fail(TopicResultStatus.Forbidden, TopicRules.NotRoundLecturerMessage);
        var today = RoundRules.TodayVietnam(clock);
        var all = await topics.ListByRoundAsync(round.Id, cancellationToken: cancellationToken);
        var proposals = all.Where(t => t.Source == TopicSource.StudentProposal && t.SupervisorId == request.LecturerId)
            .OrderByDescending(t => t.CreatedAt).ToList();
        // Danh sách đợt không nạp lịch sử, nên đọc đầy đủ từng đề xuất để màn xử lý hiển thị lý do và người/thời điểm.
        var detailed = new List<ThesisTopic>();
        foreach (var proposal in proposals)
            detailed.Add((await topics.GetByIdAsync(proposal.Id, cancellationToken))!);
        return TopicResult<LecturerProposalsDto>.Ok(new LecturerProposalsDto
        {
            Round = TopicRules.RoundInfo(round, today, true),
            Items = await ProposalMapping.DetailsAsync(detailed, round, today, topics, groups, viewerIsSupervisor: true, cancellationToken),
            Load = TopicRules.Load(request.LecturerId, all, round)
        });
    }
}
