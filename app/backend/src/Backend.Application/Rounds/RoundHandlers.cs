using Backend.Application.Common;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

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
    public static RoundDto ToDto(ThesisRound round) => new()
    {
        Id = round.Id,
        Name = round.Name,
        Program = round.Program,
        PeriodLabel = round.PeriodLabel,
        Status = RoundRules.Label(round.Status),
        Milestones = round.Milestones.OrderBy(m => (int)m.Key).Select(m => new RoundMilestoneDto
        {
            Key = RoundRules.KeyName(m.Key),
            Name = RoundRules.Name(m.Key),
            StartDate = RoundRules.FormatDate(m.StartDate),
            EndDate = RoundRules.FormatDate(m.EndDate),
            NotifyAudience = RoundRules.Label(m.NotifyAudience),
            AllowLate = m.AllowLate
        }).ToList(),
        LecturerIds = IdsOf(round, ParticipantKind.Lecturer),
        StudentIds = IdsOf(round, ParticipantKind.Student),
        LockedStudentIds = [],
        TopicSummary = new RoundTopicSummaryDto
        {
            ByStatus = RoundRules.TopicStatuses.ToDictionary(s => s, _ => 0)
        }
    };

    public static List<Guid> IdsOf(ThesisRound round, ParticipantKind kind) =>
        round.Participants.Where(p => p.Kind == kind).OrderBy(p => p.CreatedAt).Select(p => p.UserId).ToList();

    public static ParticipantDto ToParticipant(User user) => new()
    {
        Id = user.Id,
        Code = user.UserCode,
        Name = user.FullName,
        Unit = (user.Role == UserRole.Student ? user.ClassName : user.Department) ?? string.Empty
    };

    public static ThesisRound NewRound(string name, string program, string periodLabel, ThesisRound? source)
    {
        var round = new ThesisRound
        {
            Name = name,
            NormalizedName = ThesisRound.NormalizeName(name),
            Program = program,
            PeriodLabel = periodLabel,
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

public sealed class GetRoundsHandler(IRoundRepository repository)
    : IRequestHandler<GetRoundsQuery, ApiResponse<IReadOnlyList<RoundDto>>>
{
    public async Task<ApiResponse<IReadOnlyList<RoundDto>>> Handle(GetRoundsQuery request, CancellationToken cancellationToken)
    {
        RoundRules.TryParseStatusFilter(request.Status, out var status);
        var search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim().ToLowerInvariant();
        var rounds = await repository.ListAsync(status, request.Program?.Trim(), search, cancellationToken);
        return ApiResponse<IReadOnlyList<RoundDto>>.Ok(rounds.Select(RoundMapping.ToDto).ToList());
    }
}

public sealed class GetRoundHandler(IRoundRepository repository)
    : IRequestHandler<GetRoundQuery, RoundResult<RoundDto>>
{
    public async Task<RoundResult<RoundDto>> Handle(GetRoundQuery request, CancellationToken cancellationToken)
    {
        var round = await repository.GetByIdAsync(request.Id, cancellationToken);
        return round is null
            ? RoundResult<RoundDto>.Fail(RoundResultStatus.NotFound, RoundRules.NotFoundMessage)
            : RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round));
    }
}

public sealed class CreateRoundHandler(IRoundRepository repository)
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
        return new(RoundResultStatus.Created, ApiResponse<RoundDto>.Ok(RoundMapping.ToDto(round), "Đã tạo đợt"));
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
        round.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        try
        {
            await repository.SaveAsync(cancellationToken);
        }
        catch (DuplicateRoundNameException)
        {
            return RoundResult<RoundDto>.Fail(RoundResultStatus.Conflict, RoundRules.DuplicateNameMessage);
        }
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round), "Đã lưu thông tin đợt");
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
            milestone.AllowLate = ThesisRound.HasLateToggle(milestone.Key) ? next.AllowLate ?? milestone.AllowLate ?? true : null;
            milestone.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        }
        round.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        await repository.SaveAsync(cancellationToken);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round), "Đã lưu cấu hình mốc");
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
        await repository.SaveAsync(cancellationToken);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round), "Đã mở đợt");
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

        // PDR-031 (chỉ kết thúc khi mọi đề tài đã kết thúc) chưa kiểm tra được vì chưa có bảng đề tài;
        // khi có mô-đun đề tài phải chặn tại đây.
        var now = clock.GetUtcNow().UtcDateTime;
        round.Status = RoundStatus.Finished;
        round.FinishedAt = now;
        round.UpdatedAt = now;
        await repository.SaveAsync(cancellationToken);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round), "Đã kết thúc đợt");
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
        var users = (await repository.GetActiveUsersByCodesAsync(RoundRules.RoleOf(kind), codes, cancellationToken))
            .ToDictionary(u => u.UserCode, StringComparer.OrdinalIgnoreCase);
        var inRound = round.Participants.Where(p => p.Kind == kind).Select(p => p.UserId).ToHashSet();
        var conflicts = await ConflictsAsync(repository, round, kind, users.Values.Select(u => u.Id).ToList(), cancellationToken);

        return codes.Select(code =>
        {
            if (!users.TryGetValue(code, out var user))
                return new Entry(new ParticipantCheckDto
                {
                    Code = code,
                    Status = "notFound",
                    Message = $"Không tồn tại {RoundRules.KindLabel(kind)} có mã này."
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
        }).ToList();
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

public sealed class AddParticipantsHandler(IRoundRepository repository)
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
            Round = RoundMapping.ToDto(round),
            Results = entries.Select(e => e.Check).ToList(),
            Added = added.Count
        }, added.Count > 0 ? $"Đã thêm {added.Count} {RoundRules.KindLabel(kind)}" : "Không có mã hợp lệ để thêm");
    }
}

public sealed class RemoveParticipantHandler(IRoundRepository repository)
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

        // PDR-030: sinh viên đã có dữ liệu trong đợt (đề tài, điểm...) không được gỡ. Chưa có dữ liệu
        // nghiệp vụ nào trong hệ thống nên chưa khóa ai; khi có mô-đun đề tài phải chặn tại đây.
        await repository.RemoveParticipantAsync(participant, cancellationToken);
        return RoundResult<RoundDto>.Ok(RoundMapping.ToDto(round), $"Đã gỡ {RoundRules.KindLabel(kind)} khỏi đợt");
    }
}
