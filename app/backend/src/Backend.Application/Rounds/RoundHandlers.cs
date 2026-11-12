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
    // Mở đợt gửi thông báo tới người tham gia hiện có (DESIGN · Danh sách đợt). Thông báo tự động, không có người gửi.
    public static IReadOnlyList<Notification> OpenedNotifications(ThesisRound round, DateTime now)
    {
        var batchId = Guid.NewGuid();
        return round.Participants.Select(p => new Notification
        {
            BatchId = batchId,
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
        // PDR-030: sinh viên đã có nhóm trong đợt không gỡ được.
        LockedStudentIds = round.GroupMembers.Select(m => m.StudentId).Distinct().ToList(),
        TopicSummary = TopicSummary(round, today)
    };

    // Đếm theo trạng thái hiển thị (PDR-049); đề tài chưa ở trạng thái kết thúc chặn kết thúc đợt (PDR-031).
    public static RoundTopicSummaryDto TopicSummary(ThesisRound round, DateOnly today)
    {
        // Đề xuất Đã hủy là lịch sử PDR-012, không nằm trong vòng đời/trạng thái tổng hợp của đề tài.
        var statuses = round.Topics.Where(t => t.Status != TopicStatus.Cancelled)
            .Select(t => TopicRules.Effective(t, round, today)).ToList();
        var byStatus = RoundRules.TopicStatuses.ToDictionary(s => s, _ => 0);
        foreach (var status in statuses) byStatus[TopicRules.Label(status)] = byStatus.GetValueOrDefault(TopicRules.Label(status)) + 1;
        return new RoundTopicSummaryDto
        {
            Total = statuses.Count,
            PendingResultCount = statuses.Count(s => !TopicRules.IsSettled(s)),
            ByStatus = byStatus
        };
    }

    public static List<Guid> IdsOf(ThesisRound round, ParticipantKind kind) =>
        round.Participants.Where(p => p.Kind == kind).OrderBy(p => p.CreatedAt).Select(p => p.UserId).ToList();

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

    public static ThesisRound NewRound(string name, string program, string periodLabel, ThesisRound? source)
    {
        var round = new ThesisRound
        {
            Name = name,
            NormalizedName = ThesisRound.NormalizeName(name),
            Program = program,
            PeriodLabel = periodLabel,
            LecturerLoadMin = source?.LecturerLoadMin ?? 0,
            LecturerLoadMax = source?.LecturerLoadMax ?? 0,
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
                AllowLate = ThesisRound.HasLateToggle(key) ? old?.AllowLate ?? true : null
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
        return round is null || !RoundMapping.CanView(round, request.ViewerId)
            ? RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage)
            : RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)));
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

        var round = RoundMapping.NewRound(name, input.Program.Trim(), RoundRules.NormalizeText(input.PeriodLabel), source);
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
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.NotDraftInfoMessage);

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
            ? input[key].AllowLate ?? round.Milestones.FirstOrDefault(m => m.Key == key)?.AllowLate ?? true
            : null;
        errors.AddRange(RoundRules.ValidateLateDeadlines(
            RoundRules.OrderedKeys.Select(k => (k, input[k].EndDate, LateSwitch(k), input[k].LateEndDate)),
            requireWhenEnabled: round.Status == RoundStatus.Running));
        if (errors.Count > 0)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Invalid, "Có mốc chưa hợp lệ", errors);

        // Tên và thứ tự mốc cố định; chỉ nhận phần cấu hình.
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
        round.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        await repository.SaveAsync(cancellationToken);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)), "Đã lưu cấu hình mốc");
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

        // PDR-032: đủ 9 mốc, có đủ ngày và đúng thứ tự thời gian mới được mở.
        var errors = RoundRules.ValidateMilestones(
            round.Milestones.OrderBy(m => (int)m.Key)
                .Select(m => (m.Key, (string?)RoundRules.FormatDate(m.StartDate), (string?)RoundRules.FormatDate(m.EndDate))),
            requireAll: true);
        // PDR-041: mốc bật "Cho nộp trễ" phải có hạn trễ hợp lệ trước khi mở đợt.
        errors.AddRange(RoundRules.ValidateLateDeadlines(
            round.Milestones.OrderBy(m => (int)m.Key).Select(m =>
                (m.Key, (string?)RoundRules.FormatDate(m.EndDate), m.AllowLate, (string?)RoundRules.FormatDate(m.LateEndDate))),
            requireWhenEnabled: true));
        if (errors.Count > 0)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.MilestonesIncompleteMessage, errors);

        // PDR-029: mỗi sinh viên chỉ ở một đợt Đang diễn ra. Thiếu giảng viên/sinh viên không chặn (PDR-033).
        var studentIds = RoundMapping.IdsOf(round, ParticipantKind.Student);
        var conflicts = await repository.FindRunningRoundConflictsAsync(round.Id, studentIds, cancellationToken);
        if (conflicts.Count > 0)
        {
            var people = string.Join(", ", conflicts.Select(c => $"{c.UserCode} ({c.UserName})").Distinct());
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict,
                $"Không mở được đợt: sinh viên {people} đang thuộc đợt đang diễn ra khác.",
                conflicts.Select(c => $"{c.UserCode} ({c.UserName}): đang thuộc đợt “{c.RoundName}”.").ToList());
        }

        // Kiểm tra xung đột và đổi trạng thái nằm trong một lần SaveChanges. Hai yêu cầu mở đồng thời
        // hai đợt vẫn có thể cùng lọt qua bước kiểm tra: TODO chặn ở mức database (khóa/ràng buộc) khi cần.
        var now = clock.GetUtcNow().UtcDateTime;
        round.Status = RoundStatus.Running;
        round.OpenedAt = now;
        round.UpdatedAt = now;
        repository.AddNotifications(RoundMapping.OpenedNotifications(round, now));
        await repository.SaveAsync(cancellationToken);
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

        // PDR-031/048: chỉ kết thúc khi mọi đề tài đã ở trạng thái kết thúc; Không có nhóm không tính.
        var pending = RoundMapping.TopicSummary(round, RoundRules.TodayVietnam(clock)).PendingResultCount;
        if (pending > 0)
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.PendingTopicsMessage(pending));
        var now = clock.GetUtcNow().UtcDateTime;
        round.Status = RoundStatus.Finished;
        round.FinishedAt = now;
        round.UpdatedAt = now;
        await repository.SaveAsync(cancellationToken);
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
        // Chỉ thêm mã hợp lệ; mã còn lại trả lý do trong results.
        var added = entries.Where(e => e.Check.Status == "valid")
            .Select(e => new RoundParticipant { RoundId = round.Id, UserId = e.User!.Id, Kind = kind }).ToList();
        if (added.Count > 0) await repository.AddParticipantsAsync(added, cancellationToken);

        return RoundResult<AddParticipantsResultDto>.Ok(new AddParticipantsResultDto
        {
            Round = RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)),
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

        // PDR-030: người đã có dữ liệu nghiệp vụ trong đợt không được gỡ: GV có đề tài, SV đã có nhóm.
        if (kind == ParticipantKind.Lecturer && round.Topics.Any(t => t.SupervisorId == request.UserId))
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict,
                "Giảng viên đã có đề tài trong đợt nên không gỡ được khỏi đợt.");
        if (kind == ParticipantKind.Student && round.GroupMembers.Any(m => m.StudentId == request.UserId))
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict,
                "Sinh viên đã có nhóm trong đợt nên không gỡ được khỏi đợt.");
        await repository.RemoveParticipantAsync(participant, cancellationToken);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round, RoundRules.TodayVietnam(clock)), $"Đã gỡ {RoundRules.KindLabel(kind)} khỏi đợt");
    }
}
