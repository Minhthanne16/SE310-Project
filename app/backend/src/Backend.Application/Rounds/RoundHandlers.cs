using Backend.Application.Common;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

using Backend.Application.Topics;

namespace Backend.Application.Rounds;

public sealed class GetPeopleValidator : AbstractValidator<GetPeopleQuery>
{
    public GetPeopleValidator() =>
        RuleFor(x => x.Kind).Must(k => RoundRules.TryParseKind(k, out _)).WithMessage(RoundRules.InvalidKindMessage);
}

public sealed class GetCandidatesValidator : AbstractValidator<GetCandidatesQuery>
{
    public GetCandidatesValidator() =>
        RuleFor(x => x.Kind).Must(k => RoundRules.TryParseKind(k, out _)).WithMessage(RoundRules.InvalidKindMessage);
}

public sealed class RemoveParticipantValidator : AbstractValidator<RemoveParticipantCommand>
{
    public RemoveParticipantValidator() =>
        RuleFor(x => x.Kind).Must(k => RoundRules.TryParseKind(k, out _)).WithMessage(RoundRules.InvalidKindMessage);
}

public sealed class CheckParticipantsValidator : AbstractValidator<CheckParticipantsCommand>
{
    public CheckParticipantsValidator()
    {
        RuleFor(x => x.Kind).Must(k => RoundRules.TryParseKind(k, out _)).WithMessage(RoundRules.InvalidKindMessage);
        RuleFor(x => x.Codes).NotNull().WithMessage("Thiếu danh sách mã.")
            .Must(c => c is null || c.Count <= RoundRules.MaxCodesPerRequest)
            .WithMessage($"Mỗi lần chỉ nhập tối đa {RoundRules.MaxCodesPerRequest} mã.");
    }
}

public sealed class AddParticipantsValidator : AbstractValidator<AddParticipantsCommand>
{
    public AddParticipantsValidator()
    {
        RuleFor(x => x.Kind).Must(k => RoundRules.TryParseKind(k, out _)).WithMessage(RoundRules.InvalidKindMessage);
        RuleFor(x => x.Codes).NotNull().WithMessage("Thiếu danh sách mã.")
            .Must(c => c is null || c.Count <= RoundRules.MaxCodesPerRequest)
            .WithMessage($"Mỗi lần chỉ nhập tối đa {RoundRules.MaxCodesPerRequest} mã.");
    }
}

internal static class RoundMapping
{
    public static IReadOnlyList<Notification> OpenedNotifications(ThesisRound round,
        IReadOnlyList<RoundParticipant> participants, DateTime now)
    {
        var batch = Guid.NewGuid();
        return participants.Select(p => new Notification
        {
            BatchId = batch,
            RecipientUserId = p.UserId,
            Kind = NotificationKinds.Schedule,
            Text = $"Đợt khóa luận “{round.Name}” đã mở.",
            Href = p.Kind == ParticipantKind.Lecturer ? "/gv" : "/sv",
            CreatedAt = now
        }).ToList();
    }

    // Đợt Nháp chỉ Giáo vụ thấy (docs/DESIGN/03); GV/SV thấy đợt đã mở mà mình có tên.
    public static bool CanView(ThesisRound round, Guid? viewerId) =>
        viewerId is not { } id || (round.Status != RoundStatus.Draft && round.Participants.Any(p => p.UserId == id));

    public static RoundDto ToDto(ThesisRound round, DateOnly today) => new()
    {
        Id = round.Id,
        Name = round.Name,
        Program = round.Program,
        PeriodLabel = round.PeriodLabel,
        Status = RoundRules.Label(round.Status),
        LecturerLoadMin = round.LecturerLoadMin,
        LecturerLoadMax = round.LecturerLoadMax,
        MaxGroupSize = round.MaxGroupSize,
        Grading = new RoundGradingDto
        {
            WeightChair = round.GradingConfig.WeightChair,
            WeightSecretary = round.GradingConfig.WeightSecretary,
            WeightSupervisor = round.GradingConfig.WeightSupervisor,
            WeightReviewer = round.GradingConfig.WeightReviewer,
            DeviationThreshold = round.GradingConfig.DeviationThreshold
        },
        TopicsPublishedAt = round.TopicsPublishedAt is { } published
            ? DateTime.SpecifyKind(published, DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", System.Globalization.CultureInfo.InvariantCulture)
            : null,
        Milestones = round.Milestones.OrderBy(m => (int)m.Key).Select(m => new RoundMilestoneDto
        {
            Key = RoundRules.KeyName(m.Key),
            Name = RoundRules.Name(m.Key),
            StartDate = RoundRules.FormatDate(m.StartDate),
            EndDate = RoundRules.FormatDate(m.EndDate),
            NotifyAudience = RoundRules.Label(m.NotifyAudience),
            AllowLate = m.AllowLate,
            LateEndDate = RoundRules.FormatDate(m.LateEndDate)
        }).ToList(),
        LecturerIds = IdsOf(round, ParticipantKind.Lecturer),
        StudentIds = IdsOf(round, ParticipantKind.Student),
        LockedStudentIds = round.GroupMembers.Select(m => m.StudentId).Distinct().ToList(),
        LockedLecturerIds = round.Topics.Select(t => t.SupervisorId).Distinct().ToList(),
        LecturerRoles = round.Participants
            .Where(p => p.Kind == ParticipantKind.Lecturer)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new RoundLecturerRoleDto
            {
                UserId = p.UserId,
                Code = p.User?.UserCode ?? string.Empty,
                Name = p.User?.FullName ?? string.Empty,
                Email = p.User?.Email ?? string.Empty,
                Unit = p.User?.Department ?? string.Empty,
                IsSupervisor = p.IsSupervisor,
                IsReviewer = p.IsReviewer,
                IsCommittee = p.IsCommittee,
            }).ToList(),
        TopicSummary = TopicSummary(round, today)
    };

    public static async Task<RoundDto> ToDtoWithRemovalBlockersAsync(ThesisRound round, DateOnly today,
        IRoundRepository repository, CancellationToken cancellationToken)
    {
        var dto = ToDto(round, today);
        dto.RemovalBlockers = await repository.GetRemovalBlockersAsync(round.Id, round.Participants, cancellationToken);
        dto.LockedStudentIds = round.Participants.Where(p => p.Kind == ParticipantKind.Student && dto.RemovalBlockers.ContainsKey(p.UserId))
            .Select(p => p.UserId).Distinct().ToList();
        dto.LockedLecturerIds = round.Participants.Where(p => p.Kind == ParticipantKind.Lecturer && dto.RemovalBlockers.ContainsKey(p.UserId))
            .Select(p => p.UserId).Distinct().ToList();
        return dto;
    }

    // Đếm theo trạng thái hiển thị (PDR-049); đề tài chưa ở trạng thái kết thúc chặn kết thúc đợt (PDR-031).
    public static RoundTopicSummaryDto TopicSummary(ThesisRound round, DateOnly today)
    {
        // Đề xuất Đã hủy là lịch sử PDR-012, không nằm trong vòng đời/trạng thái tổng hợp của đề tài.
        var topics = round.Topics.Where(t => t.Status != TopicStatus.Cancelled)
            .Select(t => new { Topic = t, Status = TopicRules.Effective(t, round, today) }).ToList();
        var byStatus = RoundRules.TopicStatuses.ToDictionary(s => s, _ => 0);
        foreach (var item in topics) byStatus[TopicRules.Label(item.Status)] = byStatus.GetValueOrDefault(TopicRules.Label(item.Status)) + 1;
        return new RoundTopicSummaryDto
        {
            Total = topics.Count,
            PendingTopics = topics.Where(t => !TopicRules.IsSettled(t.Status))
                .Select(t => new PendingRoundTopicDto(t.Topic.Id, t.Topic.Title, TopicRules.Label(t.Status))).ToList(),
            PendingResultCount = topics.Count(t => !TopicRules.IsSettled(t.Status)),
            ByStatus = byStatus
        };
    }

    public static List<Guid> IdsOf(ThesisRound round, ParticipantKind kind) =>
        round.Participants.Where(p => p.Kind == kind).OrderBy(p => p.CreatedAt).Select(p => p.UserId).ToList();

    public static List<Guid> LecturerIdsForSupervisor(ThesisRound round) =>
        round.Participants.Where(p => p.Kind == ParticipantKind.Lecturer && p.IsSupervisor).OrderBy(p => p.CreatedAt).Select(p => p.UserId).ToList();

    public static List<Guid> LecturerIdsForReviewer(ThesisRound round) =>
        round.Participants.Where(p => p.Kind == ParticipantKind.Lecturer && p.IsReviewer).OrderBy(p => p.CreatedAt).Select(p => p.UserId).ToList();

    public static List<Guid> LecturerIdsForCommittee(ThesisRound round) =>
        round.Participants.Where(p => p.Kind == ParticipantKind.Lecturer && p.IsCommittee).OrderBy(p => p.CreatedAt).Select(p => p.UserId).ToList();

    public static ParticipantDto ToParticipant(User user) => new()
    {
        Id = user.Id,
        Code = user.UserCode,
        Name = user.FullName,
        Unit = (user.Role == UserRole.Student ? user.ClassName : user.Department) ?? string.Empty,
        Email = user.Email,
        AccountStatus = AccountStatus(user)
    };

    // Cùng quy tắc getUserStatus phía frontend (types/user.ts).
    public static string AccountStatus(User user) =>
        !user.IsActive ? "Vô hiệu hóa" : user.MustChangePassword ? "Chưa đăng nhập" : "Đang hoạt động";

    public static ThesisRound NewRound(string name, string program, string periodLabel, ThesisRound? source, ProgramRoundDefaults? defaults = null)
    {
        var round = new ThesisRound
        {
            Name = name,
            NormalizedName = ThesisRound.NormalizeName(name),
            Program = program,
            PeriodLabel = periodLabel,
            LecturerLoadMin = source?.LecturerLoadMin ?? 0,
            LecturerLoadMax = source?.LecturerLoadMax ?? 0,
            MaxGroupSize = source?.MaxGroupSize ?? defaults?.MaxGroupSize ?? 2,
            GradingConfig = source?.GradingConfig.Clone() ?? (defaults is not null ? new RoundGradingConfig
            {
                WeightChair = defaults.WeightChair,
                WeightSecretary = defaults.WeightSecretary,
                WeightSupervisor = defaults.WeightSupervisor,
                WeightReviewer = defaults.WeightReviewer,
                DeviationThreshold = defaults.DeviationThreshold
            } : new RoundGradingConfig()),
            CopiedFromId = source?.Id
        };
        // Đủ 9 mốc theo thứ tự cố định. Sao chép (PDR-034) chỉ lấy đối tượng thông báo và công tắc nộp trễ.
        round.Milestones = RoundRules.OrderedKeys.Select(key =>
        {
            var old = source?.Milestones.FirstOrDefault(m => m.Key == key);
            return new RoundMilestone
            {
                RoundId = round.Id,
                Key = key,
                NotifyAudience = old?.NotifyAudience ?? NotifyAudience.All,
                AllowLate = ThesisRound.HasLateToggle(key) ? old?.AllowLate ?? (key != MilestoneKey.Finalize) : null
            };
        }).ToList();
        return round;
    }
}

public sealed class GetRoundsHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<GetRoundsQuery, ApiResponse<IReadOnlyList<RoundDto>>>
{
    public async Task<ApiResponse<IReadOnlyList<RoundDto>>> Handle(GetRoundsQuery request, CancellationToken cancellationToken)
    {
        RoundRules.TryParseStatusFilter(request.Status, out var status);
        var search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim().ToLowerInvariant();
        var rounds = await repository.ListAsync(status, request.Program?.Trim(), search, cancellationToken);
        return ApiResponse<IReadOnlyList<RoundDto>>.Ok(rounds
            .Where(r => RoundMapping.CanView(r, request.ViewerId)).Select(r => RoundMapping.ToDto(r, RoundRules.TodayVietnam(clock))).ToList());
    }
}

public sealed class GetRoundHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<GetRoundQuery, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(GetRoundQuery request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null || !RoundMapping.CanView(round, request.ViewerId))
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        var today = RoundRules.TodayVietnam(clock);
        var dto = request.ViewerId is null
            ? await RoundMapping.ToDtoWithRemovalBlockersAsync(round, today, repository, cancellationToken)
            : RoundMapping.ToDto(round, today);
        return RoundResult<RoundDto>.Ok(dto);
    }
}

public sealed class CreateRoundHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<CreateRoundCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(CreateRoundCommand request, CancellationToken cancellationToken)
    {
        var input = request.Round;
        var name = RoundRules.NormalizeText(input.Name);
        if (await repository.NameExistsAsync(ThesisRound.NormalizeName(name), null, cancellationToken))
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.DuplicateNameMessage);

        ThesisRound? source = null;
        if (!string.IsNullOrWhiteSpace(input.CopyFromId))
        {
            source = await repository.GetByIdAsync(Guid.Parse(input.CopyFromId), cancellationToken);
            if (source is null)
                return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, "Không tìm thấy đợt nguồn để sao chép.");
        }

        var defaults = await repository.GetProgramDefaultsAsync(input.Program.Trim(), cancellationToken);
        var round = RoundMapping.NewRound(name, input.Program.Trim(), RoundRules.NormalizeText(input.PeriodLabel), source, defaults);
        try
        {
            await repository.AddAsync(round, cancellationToken);
        }
        catch (DuplicateRoundNameException)
        {
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.DuplicateNameMessage);
        }
        return new(RoundResultStatus.Created, ApiResponse<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)), "Đã tạo đợt"));
    }
}

public sealed class UpdateRoundHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<UpdateRoundCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(UpdateRoundCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status != RoundStatus.Draft)
        {
            if (request.Round.MaxGroupSize is { } newMax && newMax != round.MaxGroupSize)
                return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, "Đợt đã mở, không sửa số sinh viên tối đa.");
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.NotDraftInfoMessage);
        }

        var name = RoundRules.NormalizeText(request.Round.Name);
        var normalized = ThesisRound.NormalizeName(name);
        if (await repository.NameExistsAsync(normalized, round.Id, cancellationToken))
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.DuplicateNameMessage);

        round.Name = name;
        round.NormalizedName = normalized;
        round.Program = request.Round.Program.Trim();
        round.PeriodLabel = RoundRules.NormalizeText(request.Round.PeriodLabel);
        round.LecturerLoadMin = request.Round.LecturerLoadMin ?? round.LecturerLoadMin;
        round.LecturerLoadMax = request.Round.LecturerLoadMax ?? round.LecturerLoadMax;
        round.MaxGroupSize = request.Round.MaxGroupSize ?? round.MaxGroupSize;
        round.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        try
        {
            await repository.SaveAsync(cancellationToken);
        }
        catch (DuplicateRoundNameException)
        {
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.DuplicateNameMessage);
        }
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)), "Đã lưu thông tin đợt");
    }
}

public sealed class UpdateRoundMilestonesHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<UpdateRoundMilestonesCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(UpdateRoundMilestonesCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status == RoundStatus.Finished)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.FinishedMessage);

        // Validator đã bảo đảm đủ 9 khóa hợp lệ, không trùng; xử lý theo thứ tự cố định của mốc.
        var input = request.Input.Milestones.ToDictionary(m =>
        {
            RoundRules.TryParseKey(m.Key, out var key);
            return key;
        });
        var errors = RoundRules.ValidateMilestones(
            RoundRules.OrderedKeys.Select(k => (k, input[k].StartDate, input[k].EndDate)), requireAll: false);
        // Công tắc không gửi lên thì giữ giá trị đang lưu (mặc định bật), nên kiểm tra theo giá trị sẽ lưu.
        bool? LateSwitch(MilestoneKey key) => ThesisRound.HasLateToggle(key)
            ? input[key].AllowLate ?? round.Milestones.FirstOrDefault(m => m.Key == key)?.AllowLate ?? (key != MilestoneKey.Finalize)
            : null;
        errors.AddRange(RoundRules.ValidateLateDeadlines(
            RoundRules.OrderedKeys.Select(k => (k, input[k].EndDate, LateSwitch(k), input[k].LateEndDate)),
            requireWhenEnabled: round.Status == RoundStatus.Running));
        if (errors.Count > 0)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Invalid, "Có mốc chưa hợp lệ", errors);

        // Tên và thứ tự mốc cố định; chỉ nhận phần cấu hình.
        var today = RoundRules.TodayVietnam(clock);
        var previous = RoundMapping.ToDto(round, today).Milestones;
        var before = System.Text.Json.JsonSerializer.Serialize(previous);
        foreach (var milestone in round.Milestones)
        {
            var next = input[milestone.Key];
            RoundRules.TryParseAudience(next.NotifyAudience, out var audience);
            milestone.StartDate = RoundRules.TryParseDate(next.StartDate, out var start) ? start : null;
            milestone.EndDate = RoundRules.TryParseDate(next.EndDate, out var end) ? end : null;
            milestone.NotifyAudience = audience;
            milestone.AllowLate = LateSwitch(milestone.Key);
            milestone.LateEndDate = ThesisRound.HasLateToggle(milestone.Key) && RoundRules.TryParseDate(next.LateEndDate, out var lateEnd)
                ? lateEnd
                : null;
            milestone.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        }
        var updated = RoundMapping.ToDto(round, today);
        var after = System.Text.Json.JsonSerializer.Serialize(updated.Milestones);
        if (before != after)
            repository.AuditMilestones(round.Id, request.ActorId, clock.GetUtcNow().UtcDateTime,
                System.Text.Json.JsonSerializer.Serialize(new { Before = previous, After = updated.Milestones }));
        round.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        await repository.SaveAsync(cancellationToken);
        return RoundResult<RoundDto>.Ok(updated, "Đã lưu cấu hình mốc");
    }
}

public sealed class OpenRoundHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<OpenRoundCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(OpenRoundCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status != RoundStatus.Draft)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.OnlyDraftOpenMessage);

        // PDR-067: đợt Nháp được mở khi ba mốc đầu có đủ ngày hợp lệ; mốc 4-9 có thể để trống.
        var firstThreeKeys = new[] { MilestoneKey.TopicSubmission, MilestoneKey.TopicRegistration, MilestoneKey.Outline };
        var missingFirstThree = firstThreeKeys
            .Where(k => !round.Milestones.Any(m => m.Key == k && m.StartDate.HasValue && m.EndDate.HasValue))
            .Select(k => $"{RoundRules.Name(k)}: chưa đặt ngày.")
            .ToList();
        if (missingFirstThree.Count > 0)
        {
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict,
                "Cần nhập đủ 3 mốc đầu (Gửi đề tài, Đăng ký, Đề cương) trước khi mở đợt.", missingFirstThree);
        }

        var errors = RoundRules.ValidateMilestones(
            round.Milestones.OrderBy(m => (int)m.Key)
                .Select(m => (m.Key, (string?)RoundRules.FormatDate(m.StartDate), (string?)RoundRules.FormatDate(m.EndDate))),
            requireAll: false);
        // PDR-041: mốc bật "Cho nộp trễ" phải có hạn trễ hợp lệ trước khi mở đợt.
        errors.AddRange(RoundRules.ValidateLateDeadlines(
            round.Milestones.OrderBy(m => (int)m.Key).Select(m =>
                (m.Key, (string?)RoundRules.FormatDate(m.EndDate), m.AllowLate, (string?)RoundRules.FormatDate(m.LateEndDate))),
            requireWhenEnabled: true));
        if (errors.Count > 0)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.MilestonesIncompleteMessage, errors);

        // PDR-029: mỗi sinh viên chỉ ở một đợt Đang diễn ra. Thiếu giảng viên/sinh viên không chặn (PDR-033).
        var now = clock.GetUtcNow().UtcDateTime;
        var outcome = await repository.OpenAsync(round, now, request.ActorId,
            participants => RoundMapping.OpenedNotifications(round, participants, now), cancellationToken);
        var conflicts = outcome.Conflicts;
        if (conflicts.Count > 0)
        {
            var people = string.Join(", ", conflicts.Select(c => $"{c.UserCode} ({c.UserName})").Distinct());
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict,
                $"Không mở được đợt: sinh viên {people} đang thuộc đợt đang diễn ra khác.",
                conflicts.Select(c => $"{c.UserCode} ({c.UserName}): đang thuộc đợt “{c.RoundName}”.").ToList());
        }

        if (!outcome.Opened)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.OnlyDraftOpenMessage);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)), "Đã mở đợt");
    }
}

public sealed class FinishRoundHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<FinishRoundCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(FinishRoundCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status != RoundStatus.Running)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.OnlyRunningFinishMessage);

        var now = clock.GetUtcNow().UtcDateTime;
        var outcome = await repository.FinishAsync(round.Id, now, request.ActorId,
            current => RoundMapping.TopicSummary(current, RoundRules.TodayVietnam(clock)).PendingTopics
                .Select(t => $"{t.Title} ({t.Status})").ToList(), cancellationToken);
        if (outcome.PendingTopics.Count > 0)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict,
                RoundRules.PendingTopicsMessage(outcome.PendingTopics.Count), outcome.PendingTopics.ToList());
        if (!outcome.Finished)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.OnlyRunningFinishMessage);
        round.Status = RoundStatus.Finished;
        round.FinishedAt = now;
        round.UpdatedAt = now;
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)), "Đã kết thúc đợt");
    }
}

public sealed class PublishRoundTopicsHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<PublishRoundTopicsCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(PublishRoundTopicsCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status != RoundStatus.Running)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.OnlyRunningPublishMessage);
        if (round.TopicsPublishedAt is not null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.AlreadyPublishedMessage);

        // Công bố không bị chặn bởi hạn "GV gửi đề tài", nhưng phải còn thời gian cho sinh viên đăng ký:
        // đăng ký tự đóng cuối ngày kết thúc mốc "Công bố đề tài · SV đăng ký".
        var registrationEnd = round.Milestones.FirstOrDefault(m => m.Key == MilestoneKey.TopicRegistration)?.EndDate;
        if (registrationEnd is { } end && end < RoundRules.TodayVietnam(clock))
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.RegistrationEndedMessage(end));

        if (round.Topics.Count == 0)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, TopicRules.NoTopicsToPublishMessage);

        // Đề tài GV gửi đã ở Chưa đăng ký nên sinh viên ghi danh được ngay; chỉ ghi lịch sử công bố.
        var now = clock.GetUtcNow().UtcDateTime;
        round.TopicsPublishedAt = now;
        round.UpdatedAt = now;
        foreach (var topic in round.Topics)
            topic.History.Add(TopicMapping.History(topic, request.ActorId, TopicHistoryCategories.Status, "Công bố danh sách đề tài", now));
        await repository.SaveAsync(cancellationToken);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)), "Đã công bố danh sách đề tài");
    }
}

public sealed class DeleteRoundHandler(IRoundRepository repository)
    : IRequestHandler<DeleteRoundCommand, RoundResult<bool>>
{
    public async Task<RoundResult<bool>> Handle(DeleteRoundCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<bool>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status != RoundStatus.Draft)
            return RoundResult<bool>.Fail(RoundResultStatus.Conflict, RoundRules.OnlyDraftDeleteMessage);
        await repository.DeleteAsync(round, cancellationToken);
        return RoundResult<bool>.Ok(true, "Đã xóa đợt");
    }
}

public sealed class GetPeopleHandler(IRoundRepository repository)
    : IRequestHandler<GetPeopleQuery, ApiResponse<IReadOnlyList<ParticipantDto>>>
{
    public async Task<ApiResponse<IReadOnlyList<ParticipantDto>>> Handle(GetPeopleQuery request, CancellationToken cancellationToken)
    {
        RoundRules.TryParseKind(request.Kind, out var kind);
        var users = await repository.GetActiveUsersAsync(RoundRules.RoleOf(kind), cancellationToken);
        return ApiResponse<IReadOnlyList<ParticipantDto>>.Ok(users.Select(RoundMapping.ToParticipant).ToList());
    }
}

public sealed class GetCandidatesHandler(IRoundRepository repository)
    : IRequestHandler<GetCandidatesQuery, RoundResult<IReadOnlyList<CandidateDto>>>
{
    public async Task<RoundResult<IReadOnlyList<CandidateDto>>> Handle(GetCandidatesQuery request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<IReadOnlyList<CandidateDto>>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);

        RoundParticipantRules.TryGetKind(request.Kind, out var kind);
        var inRound = round.Participants.Where(p => p.Kind == kind).Select(p => p.UserId).ToHashSet();
        var users = (await repository.GetActiveUsersAsync(RoundRules.RoleOf(kind), cancellationToken))
            .Where(u => !inRound.Contains(u.Id)).ToList();
        var conflicts = await RoundParticipantRules.ConflictsAsync(repository, round, kind, users.Select(u => u.Id).ToList(), cancellationToken);

        var candidates = users.Select(u =>
        {
            var participant = RoundMapping.ToParticipant(u);
            return new CandidateDto
            {
                Id = participant.Id,
                Code = participant.Code,
                Name = participant.Name,
                Unit = participant.Unit,
                Email = participant.Email,
                AccountStatus = participant.AccountStatus,
                BlockedReason = conflicts.TryGetValue(u.Id, out var other) ? $"Đang ở đợt “{other.RoundName}”" : null
            };
        }).ToList();
        return RoundResult<IReadOnlyList<CandidateDto>>.Ok(candidates);
    }
}

// Kiểm tra mã người tham gia dùng chung cho check và add.
internal static class RoundParticipantRules
{
    public sealed record Entry(ParticipantCheckDto Check, User? User);

    public static void TryGetKind(string kind, out ParticipantKind result) => RoundRules.TryParseKind(kind, out result);

    // PDR-029 chỉ áp dụng cho sinh viên và khi đợt đích đang diễn ra; với đợt Nháp chỉ kiểm lúc mở đợt.
    public static async Task<Dictionary<Guid, RoundConflict>> ConflictsAsync(
        IRoundRepository repository, ThesisRound round, ParticipantKind kind, IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        if (kind != ParticipantKind.Student || round.Status != RoundStatus.Running) return [];
        var conflicts = await repository.FindRunningRoundConflictsAsync(round.Id, userIds, cancellationToken);
        return conflicts.GroupBy(c => c.UserId).ToDictionary(g => g.Key, g => g.First());
    }

    public static async Task<List<Entry>> CheckAsync(
        IRoundRepository repository, ThesisRound round, ParticipantKind kind, IEnumerable<string?> rawCodes, CancellationToken cancellationToken)
    {
        // Bỏ mã trống, gộp mã trùng không phân biệt hoa thường, giữ thứ tự nhập.
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var codes = rawCodes.Select(c => c?.Trim() ?? string.Empty).Where(c => c.Length > 0 && seen.Add(c)).ToList();
        var found = await repository.GetActiveUsersByCodesOrEmailsAsync(RoundRules.RoleOf(kind), codes, cancellationToken);
        // Mỗi mục nhập là mã người dùng hoặc email. Mã được ưu tiên khi trùng chuỗi với email của người khác.
        var byCode = found.ToDictionary(u => u.UserCode, StringComparer.OrdinalIgnoreCase);
        var byEmail = found.GroupBy(u => u.Email, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var users = codes.Select(c => byCode.TryGetValue(c, out var u) ? u : byEmail.GetValueOrDefault(c))
            .Where(u => u is not null).Select(u => u!).DistinctBy(u => u.Id).ToDictionary(u => u.Id);
        var inRound = round.Participants.Where(p => p.Kind == kind).Select(p => p.UserId).ToHashSet();
        var conflicts = await ConflictsAsync(repository, round, kind, users.Values.Select(u => u.Id).ToList(), cancellationToken);

        // Cùng một người nhập bằng mã rồi bằng email chỉ tính một lần (mục đầu tiên).
        var counted = new HashSet<Guid>();
        return codes.Select<string, Entry?>(code =>
        {
            var user = byCode.TryGetValue(code, out var byCodeUser) ? byCodeUser : byEmail.GetValueOrDefault(code);
            if (user is not null && !counted.Add(user.Id)) return null;
            if (user is null)
                return new Entry(new ParticipantCheckDto
                {
                    Code = code,
                    Status = "notFound",
                    Message = $"Không tồn tại {RoundRules.KindLabel(kind)} có mã hoặc email này."
                }, null);

            var participant = RoundMapping.ToParticipant(user);
            if (inRound.Contains(user.Id))
                return new Entry(new ParticipantCheckDto { Code = code, Status = "alreadyInRound", Message = "Đã có trong đợt này.", Participant = participant }, user);
            if (conflicts.TryGetValue(user.Id, out var other))
                return new Entry(new ParticipantCheckDto
                {
                    Code = code,
                    Status = "inOtherRound",
                    Message = $"Đang thuộc đợt “{other.RoundName}”. Một sinh viên chỉ ở một đợt đang diễn ra.",
                    Participant = participant
                }, user);
            return new Entry(new ParticipantCheckDto { Code = code, Status = "valid", Message = "Hợp lệ.", Participant = participant }, user);
        }).OfType<Entry>().ToList();
    }
}

public sealed class CheckParticipantsHandler(IRoundRepository repository)
    : IRequestHandler<CheckParticipantsCommand, RoundResult<IReadOnlyList<ParticipantCheckDto>>>
{
    public async Task<RoundResult<IReadOnlyList<ParticipantCheckDto>>> Handle(CheckParticipantsCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<IReadOnlyList<ParticipantCheckDto>>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status == RoundStatus.Finished)
            return RoundResult<IReadOnlyList<ParticipantCheckDto>>.Fail(RoundResultStatus.Conflict, RoundRules.FinishedMessage);

        RoundRules.TryParseKind(request.Kind, out var kind);
        var entries = await RoundParticipantRules.CheckAsync(repository, round, kind, request.Codes, cancellationToken);
        return RoundResult<IReadOnlyList<ParticipantCheckDto>>.Ok(entries.Select(e => e.Check).ToList());
    }
}

public sealed class AddParticipantsHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<AddParticipantsCommand, RoundResult<AddParticipantsResultDto>>
{
    public async Task<RoundResult<AddParticipantsResultDto>> Handle(AddParticipantsCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<AddParticipantsResultDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status == RoundStatus.Finished)
            return RoundResult<AddParticipantsResultDto>.Fail(RoundResultStatus.Conflict, RoundRules.FinishedMessage);

        RoundRules.TryParseKind(request.Kind, out var kind);
        var entries = await RoundParticipantRules.CheckAsync(repository, round, kind, request.Codes, cancellationToken);
        var isSupervisor = kind == ParticipantKind.Lecturer ? (request.IsSupervisor ?? true) : true;
        var isReviewer = kind == ParticipantKind.Lecturer ? (request.IsReviewer ?? true) : false;
        var isCommittee = kind == ParticipantKind.Lecturer ? (request.IsCommittee ?? true) : false;

        // Chỉ thêm mã hợp lệ; mã còn lại trả lý do trong results.
        var candidates = entries.Where(e => e.Check.Status == "valid")
            .Select(e => new RoundParticipant
            {
                RoundId = round.Id,
                UserId = e.User!.Id,
                Kind = kind,
                IsSupervisor = isSupervisor,
                IsReviewer = isReviewer,
                IsCommittee = isCommittee,
            }).ToList();
        var outcome = candidates.Count > 0 ? await repository.AddParticipantsAsync(candidates, request.ActorId, clock.GetUtcNow().UtcDateTime, cancellationToken)
            : new AddParticipantsOutcome([], [], new HashSet<Guid>(), false);
        if (outcome.Finished)
            return RoundResult<AddParticipantsResultDto>.Fail(RoundResultStatus.Conflict, RoundRules.FinishedMessage);
        var newConflicts = outcome.Conflicts.ToDictionary(c => c.UserId);
        foreach (var entry in entries.Where(e => e.User is not null && newConflicts.ContainsKey(e.User.Id)))
        {
            var other = newConflicts[entry.User!.Id];
            entry.Check.Status = "inOtherRound";
            entry.Check.Message = $"Đang thuộc đợt “{other.RoundName}”. Một sinh viên chỉ ở một đợt đang diễn ra.";
        }
        foreach (var entry in entries.Where(e => e.User is not null && outcome.ExistingIds.Contains(e.User.Id)))
        {
            entry.Check.Status = "alreadyInRound";
            entry.Check.Message = "Đã có trong đợt này.";
        }
        var added = outcome.Added;

        return RoundResult<AddParticipantsResultDto>.Ok(new AddParticipantsResultDto
        {
            Round = await RoundMapping.ToDtoWithRemovalBlockersAsync(round, RoundRules.TodayVietnam(clock), repository, cancellationToken),
            Results = entries.Select(e => e.Check).ToList(),
            Added = added.Count
        }, added.Count > 0 ? $"Đã thêm {added.Count} {RoundRules.KindLabel(kind)}" : "Không có mã hợp lệ để thêm");
    }
}

public sealed class RemoveParticipantHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<RemoveParticipantCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(RemoveParticipantCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status == RoundStatus.Finished)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.FinishedMessage);

        RoundRules.TryParseKind(request.Kind, out var kind);
        var participant = round.Participants.FirstOrDefault(p => p.UserId == request.UserId && p.Kind == kind);
        if (participant is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, $"Không có {RoundRules.KindLabel(kind)} này trong đợt.");

        var blocker = await repository.RemoveParticipantAsync(participant, request.ActorId, clock.GetUtcNow().UtcDateTime, cancellationToken);
        if (blocker is not null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, blocker);
        round.Participants.Remove(participant);
        return RoundResult<RoundDto>.Ok(await RoundMapping.ToDtoWithRemovalBlockersAsync(round, RoundRules.TodayVietnam(clock), repository, cancellationToken),
            $"Đã gỡ {RoundRules.KindLabel(kind)} khỏi đợt");
    }
}

public sealed class UpdateRoundGradingHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<UpdateRoundGradingCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(UpdateRoundGradingCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status != RoundStatus.Draft)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, "Đợt đã mở nên không sửa cấu hình điểm được nữa.");

        var input = request.Input;
        round.GradingConfig.WeightChair = input.WeightChair;
        round.GradingConfig.WeightSecretary = input.WeightSecretary;
        round.GradingConfig.WeightSupervisor = input.WeightSupervisor;
        round.GradingConfig.WeightReviewer = input.WeightReviewer;
        round.GradingConfig.DeviationThreshold = input.DeviationThreshold;
        round.UpdatedAt = clock.GetUtcNow().UtcDateTime;

        if (input.SaveAsProgramDefault)
        {
            // OQ-033(e): Giáo vụ lưu làm mặc định chương trình
            await repository.SaveProgramDefaultsAsync(new ProgramRoundDefaults
            {
                Program = round.Program,
                MaxGroupSize = round.MaxGroupSize,
                WeightChair = input.WeightChair,
                WeightSecretary = input.WeightSecretary,
                WeightSupervisor = input.WeightSupervisor,
                WeightReviewer = input.WeightReviewer,
                DeviationThreshold = input.DeviationThreshold,
                UpdatedAt = clock.GetUtcNow().UtcDateTime,
                UpdatedById = request.ActorId
            }, cancellationToken);
        }

        await repository.SaveAsync(cancellationToken);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)), "Đã lưu cấu hình điểm");
    }
}

public sealed class GetProgramDefaultsHandler(IRoundRepository repository)
    : IRequestHandler<GetProgramDefaultsQuery, ApiResponse<ProgramRoundDefaultsDto>>
{
    public async Task<ApiResponse<ProgramRoundDefaultsDto>> Handle(GetProgramDefaultsQuery request, CancellationToken cancellationToken)
    {
        var d = await repository.GetProgramDefaultsAsync(request.Program.Trim(), cancellationToken);
        var dto = new ProgramRoundDefaultsDto
        {
            Program = request.Program.Trim(),
            MaxGroupSize = d?.MaxGroupSize ?? 2,
            WeightChair = d?.WeightChair ?? 1,
            WeightSecretary = d?.WeightSecretary ?? 1,
            WeightSupervisor = d?.WeightSupervisor ?? 2,
            WeightReviewer = d?.WeightReviewer ?? 2,
            DeviationThreshold = d?.DeviationThreshold ?? 2
        };
        return ApiResponse<ProgramRoundDefaultsDto>.Ok(dto);
    }
}

public sealed class UpdateLecturerRolesHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<UpdateLecturerRolesCommand, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(UpdateLecturerRolesCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status == RoundStatus.Finished)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.FinishedMessage);

        if (!request.IsSupervisor && !request.IsReviewer && !request.IsCommittee)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, "Phải chọn ít nhất một vai trò cho giảng viên.");

        var err = await repository.UpdateLecturerRolesAsync(
            round.Id, request.UserId, request.IsSupervisor, request.IsReviewer, request.IsCommittee,
            clock.GetUtcNow().UtcDateTime, request.ActorId, cancellationToken);

        if (err is not null)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, err);

        var updated = await repository.GetByIdAsync(round.Id, cancellationToken);
        var dto = await RoundMapping.ToDtoWithRemovalBlockersAsync(updated ?? round, RoundRules.TodayVietnam(clock), repository, cancellationToken);
        return RoundResult<RoundDto>.Ok(dto, "Đã cập nhật vai trò giảng viên.");
    }
}

public sealed class PreviewLecturerRolesHandler(IRoundRepository repository)
    : IRequestHandler<PreviewLecturerRolesCommand, RoundResult<LecturerRolesPreviewResultDto>>
{
    public async Task<RoundResult<LecturerRolesPreviewResultDto>> Handle(PreviewLecturerRolesCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<LecturerRolesPreviewResultDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status == RoundStatus.Finished)
            return RoundResult<LecturerRolesPreviewResultDto>.Fail(RoundResultStatus.Conflict, RoundRules.FinishedMessage);

        var codes = request.Rows.Select(r => r.Code.Trim()).Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
        var users = await repository.GetActiveUsersByCodesOrEmailsAsync(UserRole.Lecturer, codes, cancellationToken);

        var userMap = new Dictionary<string, User>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in users)
        {
            userMap[u.UserCode] = u;
            userMap[u.Email] = u;
        }

        var blockers = await repository.GetLecturerRoleBlockersAsync(round.Id, cancellationToken);
        var existingParticipants = round.Participants
            .Where(p => p.Kind == ParticipantKind.Lecturer)
            .ToDictionary(p => p.UserId);

        var valid = new List<LecturerRolePreviewItemDto>();
        var errors = new List<LecturerRolePreviewErrorDto>();

        foreach (var row in request.Rows)
        {
            var cleanCode = row.Code.Trim();
            if (string.IsNullOrEmpty(cleanCode)) continue;

            if (!userMap.TryGetValue(cleanCode, out var user))
            {
                errors.Add(new LecturerRolePreviewErrorDto { Code = cleanCode, Reason = "Không tìm thấy giảng viên trong hệ thống." });
                continue;
            }

            if (!row.IsSupervisor && !row.IsReviewer && !row.IsCommittee)
            {
                errors.Add(new LecturerRolePreviewErrorDto { Code = cleanCode, Reason = "Không có vai trò nào được chọn." });
                continue;
            }

            var isExisting = existingParticipants.ContainsKey(user.Id);

            if (isExisting)
            {
                if (!row.IsSupervisor && blockers.SupervisorIds.Contains(user.Id))
                {
                    errors.Add(new LecturerRolePreviewErrorDto { Code = cleanCode, Reason = "Đang hướng dẫn đề tài, không thể bỏ vai trò Hướng dẫn." });
                    continue;
                }
                if (!row.IsReviewer && blockers.ReviewerIds.Contains(user.Id))
                {
                    errors.Add(new LecturerRolePreviewErrorDto { Code = cleanCode, Reason = "Đang phản biện đề tài, không thể bỏ vai trò Phản biện." });
                    continue;
                }
                if (!row.IsCommittee && blockers.CommitteeIds.Contains(user.Id))
                {
                    errors.Add(new LecturerRolePreviewErrorDto { Code = cleanCode, Reason = "Đang trong hội đồng, không thể bỏ vai trò Hội đồng." });
                    continue;
                }
            }

            valid.Add(new LecturerRolePreviewItemDto
            {
                UserId = user.Id,
                Code = user.UserCode,
                Name = user.FullName,
                Email = user.Email,
                Unit = user.Department ?? string.Empty,
                IsSupervisor = row.IsSupervisor,
                IsReviewer = row.IsReviewer,
                IsCommittee = row.IsCommittee,
                IsNew = !isExisting
            });
        }

        return RoundResult<LecturerRolesPreviewResultDto>.Ok(new LecturerRolesPreviewResultDto
        {
            Valid = valid,
            Errors = errors
        });
    }
}

public sealed class ImportLecturerRolesHandler(IRoundRepository repository, TimeProvider clock)
    : IRequestHandler<ImportLecturerRolesCommand, RoundResult<LecturerRolesImportResultDto>>
{
    public async Task<RoundResult<LecturerRolesImportResultDto>> Handle(ImportLecturerRolesCommand request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (round is null)
            return RoundResult<LecturerRolesImportResultDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status == RoundStatus.Finished)
            return RoundResult<LecturerRolesImportResultDto>.Fail(RoundResultStatus.Conflict, RoundRules.FinishedMessage);

        var previewHandler = new PreviewLecturerRolesHandler(repository);
        var preview = await previewHandler.Handle(new PreviewLecturerRolesCommand(request.Id, request.Rows), cancellationToken);
        if (!preview.Response.Success || preview.Response.Data is null)
            return RoundResult<LecturerRolesImportResultDto>.Fail(preview.Status, preview.Response.Message);

        var now = clock.GetUtcNow().UtcDateTime;
        var updates = preview.Response.Data.Valid.Where(v => !v.IsNew)
            .Select(v => (v.UserId, v.IsSupervisor, v.IsReviewer, v.IsCommittee)).ToList();
        var adds = preview.Response.Data.Valid.Where(v => v.IsNew)
            .Select(v => (v.UserId, v.IsSupervisor, v.IsReviewer, v.IsCommittee)).ToList();

        await repository.SaveLecturerRolesBatchAsync(round.Id, updates, adds, now, request.ActorId, cancellationToken);

        var updated = await repository.GetByIdAsync(round.Id, cancellationToken);
        var roles = RoundMapping.ToDto(updated ?? round, RoundRules.TodayVietnam(clock)).LecturerRoles;

        return RoundResult<LecturerRolesImportResultDto>.Ok(new LecturerRolesImportResultDto
        {
            UpdatedCount = updates.Count,
            AddedCount = adds.Count,
            Roles = roles
        }, $"Đã cập nhật {updates.Count} và thêm mới {adds.Count} giảng viên.");
    }
}
