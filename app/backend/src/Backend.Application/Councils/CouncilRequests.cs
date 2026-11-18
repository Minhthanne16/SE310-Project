using Backend.Application.Common;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Councils;

// Hội đồng và lịch bảo vệ (P06-S01/S02/S03; PDR-014–020, PDR-063). Giáo vụ lập, sửa, công bố, hủy, đính chính;
// Giảng viên xem hội đồng mình là Chủ tịch/Thư ký sau khi công bố.
public record GetCouncilBoardQuery(Guid RoundId) : IRequest<TopicResult<CouncilBoardDto>>;
public record CheckCouncilQuery(CouncilCheckInputDto Input) : IRequest<TopicResult<CouncilCheckResultDto>>;
public record CreateCouncilCommand(Guid ActorId, CouncilInputDto Input) : IRequest<TopicResult<CouncilDto>>;
public record UpdateCouncilCommand(Guid ActorId, Guid CouncilId, CouncilInputDto Input) : IRequest<TopicResult<CouncilDto>>;
public record DeleteCouncilCommand(Guid CouncilId) : IRequest<TopicResult<bool>>;
public record PublishCouncilsCommand(Guid ActorId, CouncilPublishInputDto Input) : IRequest<TopicResult<CouncilPublishResultDto>>;
public record CancelCouncilCommand(Guid ActorId, Guid CouncilId, CouncilReasonInputDto Input) : IRequest<TopicResult<CouncilDto>>;
public record AddCouncilCorrectionCommand(Guid ActorId, Guid CouncilId, CouncilCorrectionInputDto Input) : IRequest<TopicResult<CouncilDto>>;
public record ListMyCouncilsQuery(Guid LecturerId, Guid? RoundId) : IRequest<TopicResult<MyCouncilsDto>>;

internal sealed class CouncilInputValidator : AbstractValidator<CouncilInputDto>
{
    public CouncilInputValidator()
    {
        RuleFor(x => CouncilRules.CleanText(x.Name)).NotEmpty().WithMessage("Nhập tên hội đồng.")
            .MaximumLength(CouncilRules.MaxNameLength).WithMessage($"Tên hội đồng tối đa {CouncilRules.MaxNameLength} ký tự.")
            .OverridePropertyName("name");
        RuleFor(x => x.ChairId).NotEmpty().WithMessage("Chọn Chủ tịch.").OverridePropertyName("chairId");
        RuleFor(x => x.SecretaryId).NotEmpty().WithMessage("Chọn Thư ký.").OverridePropertyName("secretaryId");
        RuleFor(x => x.Date).Must(d => RoundRules.TryParseDate(d, out _))
            .WithMessage("Chọn ngày bảo vệ (yyyy-MM-dd).").OverridePropertyName("date");
        RuleFor(x => CouncilRules.CleanText(x.Room)).NotEmpty().WithMessage("Nhập phòng bảo vệ.")
            .MaximumLength(CouncilRules.MaxRoomLength).WithMessage($"Phòng tối đa {CouncilRules.MaxRoomLength} ký tự.")
            .OverridePropertyName("room");
        RuleFor(x => x.Slots).Must(s => s is null || s.Count <= CouncilRules.MaxSlots)
            .WithMessage($"Mỗi hội đồng tối đa {CouncilRules.MaxSlots} đề tài.").OverridePropertyName("slots");
        RuleForEach(x => x.Slots).ChildRules(slot =>
        {
            slot.RuleFor(s => s.TopicId).NotEmpty().WithMessage("Thiếu mã đề tài.").OverridePropertyName("topicId");
            slot.RuleFor(s => s.Start).Must(v => CouncilRules.TryParseTime(v, out _))
                .WithMessage("Nhập giờ bắt đầu dạng HH:MM, ví dụ 07:30.").OverridePropertyName("start");
            slot.RuleFor(s => s.End).Must(v => CouncilRules.TryParseTime(v, out _))
                .WithMessage("Nhập giờ kết thúc dạng HH:MM, ví dụ 08:15.").OverridePropertyName("end");
        });
        RuleFor(x => x.Reason).Must(r => r is null || r.Trim().Length <= CouncilRules.MaxReasonLength)
            .WithMessage($"Lý do tối đa {CouncilRules.MaxReasonLength} ký tự.").OverridePropertyName("reason");
    }
}

public sealed class CreateCouncilValidator : AbstractValidator<CreateCouncilCommand>
{
    public CreateCouncilValidator()
    {
        RuleFor(x => x.Input.RoundId).NotEmpty().WithMessage("Chọn đợt.").OverridePropertyName("roundId");
        RuleFor(x => x.Input).SetValidator(new CouncilInputValidator());
    }
}

public sealed class UpdateCouncilValidator : AbstractValidator<UpdateCouncilCommand>
{
    public UpdateCouncilValidator()
    {
        RuleFor(x => x.Input.ExpectedVersion).NotNull().WithMessage("Thiếu phiên bản hội đồng đang xem; tải lại trang.")
            .OverridePropertyName("expectedVersion");
        RuleFor(x => x.Input).SetValidator(new CouncilInputValidator());
    }
}

public sealed class CheckCouncilValidator : AbstractValidator<CheckCouncilQuery>
{
    public CheckCouncilValidator()
    {
        RuleFor(x => x.Input.RoundId).NotEmpty().WithMessage("Chọn đợt.").OverridePropertyName("roundId");
        RuleFor(x => x.Input).SetValidator(new CouncilInputValidator());
    }
}

public sealed class CancelCouncilValidator : AbstractValidator<CancelCouncilCommand>
{
    public CancelCouncilValidator() =>
        RuleFor(x => CouncilRules.CleanText(x.Input.Reason)).NotEmpty().WithMessage("Nhập lý do hủy lịch.")
            .MaximumLength(CouncilRules.MaxReasonLength).WithMessage($"Lý do tối đa {CouncilRules.MaxReasonLength} ký tự.")
            .OverridePropertyName("reason");
}

public sealed class AddCouncilCorrectionValidator : AbstractValidator<AddCouncilCorrectionCommand>
{
    public AddCouncilCorrectionValidator()
    {
        RuleFor(x => (x.Input.Content ?? string.Empty).Trim()).NotEmpty().WithMessage("Nhập nội dung đính chính.")
            .MaximumLength(CouncilRules.MaxCorrectionLength).WithMessage($"Nội dung đính chính tối đa {CouncilRules.MaxCorrectionLength} ký tự.")
            .OverridePropertyName("content");
        RuleFor(x => CouncilRules.CleanText(x.Input.Reason)).NotEmpty().WithMessage("Nhập lý do đính chính.")
            .MaximumLength(CouncilRules.MaxReasonLength).WithMessage($"Lý do tối đa {CouncilRules.MaxReasonLength} ký tự.")
            .OverridePropertyName("reason");
    }
}

public sealed class PublishCouncilsValidator : AbstractValidator<PublishCouncilsCommand>
{
    public PublishCouncilsValidator() =>
        RuleFor(x => x.Input.RoundId).NotEmpty().WithMessage("Chọn đợt.").OverridePropertyName("roundId");
}

internal static class CouncilFlow
{
    // Giáo vụ chỉ làm việc với đợt đã mở hoặc đã kết thúc; đợt Nháp coi như không tồn tại.
    public static async Task<ThesisRound?> FindRoundAsync(IRoundRepository rounds, Guid roundId, CancellationToken cancellationToken)
    {
        var round = await rounds.GetByIdAsync(roundId, cancellationToken);
        return round is null || round.Status == RoundStatus.Draft ? null : round;
    }

    public static CouncilPlan Plan(CouncilInputDto input, Guid? councilId, Guid roundId)
    {
        RoundRules.TryParseDate(input.Date, out var date);
        var slots = (input.Slots ?? []).Select(s =>
        {
            CouncilRules.TryParseTime(s.Start, out var start);
            CouncilRules.TryParseTime(s.End, out var end);
            return new PlannedSlot(s.TopicId, start, end);
        }).ToList();
        return new CouncilPlan(councilId, roundId, CouncilRules.CleanText(input.Name), input.ChairId, input.SecretaryId, date,
            CouncilRules.CleanText(input.Room), slots);
    }

    public static TopicResult<T> Problems<T>(List<string> problems) =>
        new(TopicResultStatus.Conflict, ApiResponse<T>.Fail(
            problems.Count == 1 ? problems[0] : $"Chưa lưu được: còn {problems.Count} vấn đề cần xử lý.", problems));

    public static TopicResult<T> Outcome<T>(CouncilWriteOutcome outcome) => outcome switch
    {
        CouncilWriteOutcome.NotFound => TopicResult<T>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage),
        CouncilWriteOutcome.Scored => TopicResult<T>.Fail(TopicResultStatus.Conflict, CouncilRules.ScoredMessage),
        CouncilWriteOutcome.TopicTaken => TopicResult<T>.Fail(TopicResultStatus.Conflict, CouncilRules.TopicTakenMessage),
        CouncilWriteOutcome.Changed => TopicResult<T>.Fail(TopicResultStatus.Conflict, CouncilRules.ChangedMessage),
        _ => TopicResult<T>.Fail(TopicResultStatus.Conflict, CouncilRules.CancelledMessage)
    };

    public static TopicHistoryEntry History(Guid topicId, Guid? actorId, string action, DateTime now, string? detail) => new()
    {
        TopicId = topicId, ActorUserId = actorId, Category = TopicHistoryCategories.Defense, Action = action, Detail = detail, CreatedAt = now
    };

    public static DefenseCouncilLog Log(Guid councilId, Guid? actorId, string action, DateTime now, string? reason, string? detail) => new()
    {
        CouncilId = councilId, ActorUserId = actorId, Action = action, Reason = reason, Detail = detail, CreatedAt = now
    };

    // Thông báo không trùng (cùng người nhận, cùng nội dung) trong một lần gửi.
    public sealed class Notices(Guid senderId, DateTime now)
    {
        private readonly Guid _batch = Guid.NewGuid();
        private readonly List<Notification> _items = [];
        private readonly HashSet<(Guid, string)> _seen = [];

        public void Add(Guid recipient, string text, string href)
        {
            if (!_seen.Add((recipient, text))) return;
            _items.Add(new Notification
            {
                BatchId = _batch, RecipientUserId = recipient, SenderUserId = senderId, Kind = NotificationKinds.Schedule,
                Text = text, Href = href, CreatedAt = now
            });
        }

        public IReadOnlyList<Notification> Items => _items;
    }

    public static string When(DateOnly date, TimeOnly start, TimeOnly end, string room) =>
        $"{CouncilRules.FormatDay(date)} {CouncilRules.FormatTime(start)}–{CouncilRules.FormatTime(end)}, phòng {room}";

    public static string RoleText(DefenseCouncil council, Guid lecturerId) =>
        lecturerId == council.ChairId ? "Chủ tịch" : "Thư ký";

    public static async Task<TopicResult<CouncilDto>> DtoAsync(ICouncilRepository councils, ITopicRepository topics, IGroupRepository groups,
        ThesisRound round, Guid councilId, DateOnly today, string message, bool created, CancellationToken cancellationToken)
    {
        var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, round, today, [], [], cancellationToken);
        var council = workspace.Find(councilId);
        if (council is null) return TopicResult<CouncilDto>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage);
        var dto = workspace.ToDto(council);
        return created ? TopicResult<CouncilDto>.Created(dto, message) : TopicResult<CouncilDto>.Ok(dto, message);
    }
}

public sealed class GetCouncilBoardHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ICouncilRepository councils, TimeProvider clock) : IRequestHandler<GetCouncilBoardQuery, TopicResult<CouncilBoardDto>>
{
    public async Task<TopicResult<CouncilBoardDto>> Handle(GetCouncilBoardQuery request, CancellationToken cancellationToken)
    {
        var round = await CouncilFlow.FindRoundAsync(rounds, request.RoundId, cancellationToken);
        if (round is null) return TopicResult<CouncilBoardDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, round, RoundRules.TodayVietnam(clock), [], [], cancellationToken);
        return TopicResult<CouncilBoardDto>.Ok(workspace.Board());
    }
}

// Xem trước xung đột của bản nháp trên màn sửa; không ghi dữ liệu.
public sealed class CheckCouncilHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ICouncilRepository councils, TimeProvider clock) : IRequestHandler<CheckCouncilQuery, TopicResult<CouncilCheckResultDto>>
{
    public async Task<TopicResult<CouncilCheckResultDto>> Handle(CheckCouncilQuery request, CancellationToken cancellationToken)
    {
        var round = await CouncilFlow.FindRoundAsync(rounds, request.Input.RoundId, cancellationToken);
        if (round is null) return TopicResult<CouncilCheckResultDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        var plan = CouncilFlow.Plan(request.Input, request.Input.CouncilId, round.Id);
        var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, round, RoundRules.TodayVietnam(clock),
            [plan.Date], [plan.ChairId, plan.SecretaryId], cancellationToken);
        var problems = CouncilRules.Check(plan, workspace.Context());
        return TopicResult<CouncilCheckResultDto>.Ok(new CouncilCheckResultDto { Ok = problems.Count == 0, Problems = problems });
    }
}

public sealed class CreateCouncilHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ICouncilRepository councils, TimeProvider clock) : IRequestHandler<CreateCouncilCommand, TopicResult<CouncilDto>>
{
    public async Task<TopicResult<CouncilDto>> Handle(CreateCouncilCommand request, CancellationToken cancellationToken)
    {
        var round = await CouncilFlow.FindRoundAsync(rounds, request.Input.RoundId, cancellationToken);
        if (round is null) return TopicResult<CouncilDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        if (round.Status != RoundStatus.Running) return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.RoundNotRunningMessage);
        var today = RoundRules.TodayVietnam(clock);
        var now = clock.GetUtcNow().UtcDateTime;
        var councilId = Guid.NewGuid();
        var plan = CouncilFlow.Plan(request.Input, councilId, round.Id);

        var failure = await councils.RunExclusiveAsync<TopicResult<CouncilDto>?>(async ct =>
        {
            var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, round, today, [plan.Date], [plan.ChairId, plan.SecretaryId], ct);
            var problems = CouncilRules.Check(plan, workspace.Context());
            if (problems.Count > 0) return (false, CouncilFlow.Problems<CouncilDto>(problems));
            var council = new DefenseCouncil
            {
                Id = councilId, RoundId = round.Id, Name = plan.Name, ChairId = plan.ChairId, SecretaryId = plan.SecretaryId,
                DefenseDate = plan.Date, Room = plan.Room, NormalizedRoom = DefenseCouncil.NormalizeRoom(plan.Room), CreatedAt = now,
                Slots = plan.Slots.Select((s, i) => new DefenseSlot
                {
                    CouncilId = councilId, TopicId = s.TopicId, Order = i + 1, StartTime = s.Start, EndTime = s.End, CreatedAt = now
                }).ToList()
            };
            var log = CouncilFlow.Log(councilId, request.ActorId, DefenseCouncilActions.Created, now, null,
                CouncilRules.Describe(plan, workspace.Topics, workspace.Users));
            var outcome = await councils.AddAsync(council, log, ct);
            return outcome == CouncilWriteOutcome.Done ? (true, null) : (false, CouncilFlow.Outcome<CouncilDto>(outcome));
        }, cancellationToken);
        if (failure is not null) return failure;
        return await CouncilFlow.DtoAsync(councils, topics, groups, round, councilId, today,
            $"Đã lưu {plan.Name}. Lịch chỉ gửi đi khi bấm Công bố lịch bảo vệ.", created: true, cancellationToken);
    }
}

public sealed class UpdateCouncilHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ICouncilRepository councils, TimeProvider clock) : IRequestHandler<UpdateCouncilCommand, TopicResult<CouncilDto>>
{
    public async Task<TopicResult<CouncilDto>> Handle(UpdateCouncilCommand request, CancellationToken cancellationToken)
    {
        var existing = await councils.GetAsync(request.CouncilId, cancellationToken);
        if (existing is null) return TopicResult<CouncilDto>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage);
        var round = await CouncilFlow.FindRoundAsync(rounds, existing.RoundId, cancellationToken);
        if (round is null) return TopicResult<CouncilDto>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage);
        if (existing.Status == CouncilStatus.Cancelled) return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.CancelledMessage);
        if (existing.FirstScoredAt is not null) return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.ScoredMessage);
        var reason = CouncilRules.CleanText(request.Input.Reason);
        if (existing.Status == CouncilStatus.Published && reason.Length == 0)
            return TopicResult<CouncilDto>.Fail(TopicResultStatus.Invalid, CouncilRules.ReasonRequiredMessage);

        var today = RoundRules.TodayVietnam(clock);
        var now = clock.GetUtcNow().UtcDateTime;
        var plan = CouncilFlow.Plan(request.Input, existing.Id, round.Id);
        var failure = await councils.RunExclusiveAsync<TopicResult<CouncilDto>?>(async ct =>
        {
            var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, round, today, [plan.Date],
                [plan.ChairId, plan.SecretaryId, existing.ChairId, existing.SecretaryId], ct);
            var current = workspace.Find(existing.Id);
            if (current is null) return (false, TopicResult<CouncilDto>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage));
            if (current.Version != request.Input.ExpectedVersion) return (false, CouncilFlow.Outcome<CouncilDto>(CouncilWriteOutcome.Changed));
            var problems = CouncilRules.Check(plan, workspace.Context());
            if (problems.Count > 0) return (false, CouncilFlow.Problems<CouncilDto>(problems));

            var before = CouncilRules.PlanOf(current);
            var published = current.Status == CouncilStatus.Published;
            var history = new List<TopicHistoryEntry>();
            var notices = new CouncilFlow.Notices(request.ActorId, now);
            if (published) Announce(workspace, current, before, plan, reason, request.ActorId, now, history, notices);
            var log = CouncilFlow.Log(current.Id, request.ActorId, DefenseCouncilActions.Updated, now, reason.Length > 0 ? reason : null,
                $"Trước: {CouncilRules.Describe(before, workspace.Topics, workspace.Users)}\nSau: {CouncilRules.Describe(plan, workspace.Topics, workspace.Users)}");
            var change = new CouncilChange(current.Id, request.Input.ExpectedVersion!.Value, plan.Name, plan.ChairId, plan.SecretaryId,
                plan.Date, plan.Room, plan.Slots.Select((s, i) => new CouncilSlotPlan(s.TopicId, i + 1, s.Start, s.End)).ToList(),
                now, log, history, notices.Items);
            var outcome = await councils.UpdateAsync(change, keepRemovedSlots: published, ct);
            return outcome == CouncilWriteOutcome.Done ? (true, null) : (false, CouncilFlow.Outcome<CouncilDto>(outcome));
        }, cancellationToken);
        if (failure is not null) return failure;
        return await CouncilFlow.DtoAsync(councils, topics, groups, round, existing.Id, today,
            existing.Status == CouncilStatus.Published
                ? $"Đã lưu {plan.Name} và gửi thông báo thay đổi lịch cho người bị ảnh hưởng."
                : $"Đã lưu {plan.Name}. Lịch chỉ gửi đi khi bấm Công bố lịch bảo vệ.", created: false, cancellationToken);
    }

    // PDR-018: sửa lịch đã công bố trước điểm phải có lịch sử và thông báo người bị ảnh hưởng.
    private static void Announce(CouncilWorkspace workspace, DefenseCouncil council, CouncilPlan before, CouncilPlan after, string reason,
        Guid actorId, DateTime now, List<TopicHistoryEntry> history, CouncilFlow.Notices notices)
    {
        var oldSlots = before.Slots.ToDictionary(s => s.TopicId);
        var newSlots = after.Slots.ToDictionary(s => s.TopicId);
        var sameDayRoom = before.Date == after.Date && DefenseCouncil.NormalizeRoom(before.Room) == DefenseCouncil.NormalizeRoom(after.Room);
        foreach (var topicId in oldSlots.Keys.Union(newSlots.Keys))
        {
            var code = workspace.Code(topicId);
            string? action = null, detail = null, text = null;
            if (!newSlots.TryGetValue(topicId, out var next))
            {
                var old = oldSlots[topicId];
                action = "Bỏ khỏi lịch bảo vệ";
                detail = $"{before.Name}: {CouncilFlow.When(before.Date, old.Start, old.End, before.Room)}. Lý do: {reason}";
                text = $"{code} không còn trong lịch bảo vệ của {before.Name}. Lý do: {reason}";
            }
            else if (!oldSlots.TryGetValue(topicId, out var previous))
            {
                action = "Xếp lịch bảo vệ";
                detail = $"{after.Name}: {CouncilFlow.When(after.Date, next.Start, next.End, after.Room)}";
                text = $"Lịch bảo vệ {code}: {CouncilFlow.When(after.Date, next.Start, next.End, after.Room)} ({after.Name}).";
            }
            else if (!sameDayRoom || previous.Start != next.Start || previous.End != next.End)
            {
                action = "Đổi lịch bảo vệ";
                detail = $"{CouncilFlow.When(before.Date, previous.Start, previous.End, before.Room)} → {CouncilFlow.When(after.Date, next.Start, next.End, after.Room)}. Lý do: {reason}";
                text = $"Lịch bảo vệ {code} đổi thành {CouncilFlow.When(after.Date, next.Start, next.End, after.Room)} ({after.Name}). Lý do: {reason}";
            }
            if (action is null) continue;
            history.Add(CouncilFlow.History(topicId, actorId, action, now, detail));
            foreach (var person in workspace.Stakeholders(topicId)) notices.Add(person, text!, $"/de-tai/{topicId}");
        }
        // Thành viên cũ và mới của hội đồng (gồm người bị thay, PDR-020).
        if (before.ChairId != after.ChairId || before.SecretaryId != after.SecretaryId)
            foreach (var topicId in newSlots.Keys.Where(oldSlots.ContainsKey))
            {
                history.Add(CouncilFlow.History(topicId, actorId, "Đổi thành viên hội đồng", now,
                    $"Chủ tịch {workspace.Name(before.ChairId)} → {workspace.Name(after.ChairId)}; Thư ký {workspace.Name(before.SecretaryId)} → {workspace.Name(after.SecretaryId)}. Lý do: {reason}"));
                foreach (var person in workspace.Stakeholders(topicId))
                    notices.Add(person, $"Thành viên hội đồng bảo vệ {workspace.Code(topicId)} đã thay đổi ({after.Name}). Lý do: {reason}", $"/de-tai/{topicId}");
            }
        var summary = $"Lịch {after.Name} đã thay đổi: {CouncilFlow.When(after.Date, after.Slots.FirstOrDefault()?.Start ?? default, after.Slots.LastOrDefault()?.End ?? default, after.Room)}. Lý do: {reason}";
        foreach (var member in new[] { before.ChairId, before.SecretaryId }.Where(m => m != after.ChairId && m != after.SecretaryId))
            notices.Add(member, $"Bạn không còn thuộc {before.Name}. Lý do: {reason}", "/gv/hoi-dong");
        foreach (var member in new[] { after.ChairId, after.SecretaryId })
            notices.Add(member, summary, "/gv/hoi-dong");
    }
}

public sealed class DeleteCouncilHandler(ICouncilRepository councils) : IRequestHandler<DeleteCouncilCommand, TopicResult<bool>>
{
    public async Task<TopicResult<bool>> Handle(DeleteCouncilCommand request, CancellationToken cancellationToken)
    {
        var council = await councils.GetAsync(request.CouncilId, cancellationToken);
        if (council is null) return TopicResult<bool>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage);
        var outcome = await councils.RunExclusiveAsync(async ct =>
        {
            var result = await councils.DeleteDraftAsync(request.CouncilId, ct);
            return (result == CouncilWriteOutcome.Done, result);
        }, cancellationToken);
        return outcome switch
        {
            CouncilWriteOutcome.Done => TopicResult<bool>.Ok(true, $"Đã xóa {council.Name}."),
            CouncilWriteOutcome.NotFound => TopicResult<bool>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage),
            _ => TopicResult<bool>.Fail(TopicResultStatus.Conflict,
                council.Status == CouncilStatus.Cancelled ? CouncilRules.CancelledNoDeleteMessage : CouncilRules.PublishedNoDeleteMessage)
        };
    }
}

public sealed class PublishCouncilsHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ICouncilRepository councils, TimeProvider clock) : IRequestHandler<PublishCouncilsCommand, TopicResult<CouncilPublishResultDto>>
{
    public async Task<TopicResult<CouncilPublishResultDto>> Handle(PublishCouncilsCommand request, CancellationToken cancellationToken)
    {
        var round = await CouncilFlow.FindRoundAsync(rounds, request.Input.RoundId, cancellationToken);
        if (round is null) return TopicResult<CouncilPublishResultDto>.Fail(TopicResultStatus.NotFound, RoundRules.NotFoundMessage);
        var today = RoundRules.TodayVietnam(clock);
        var list = await councils.ListByRoundAsync(round.Id, cancellationToken);
        var explicitIds = request.Input.CouncilIds is { Count: > 0 } ids ? ids.Distinct().ToList() : null;
        var targets = explicitIds ?? list.Where(c => c.Status == CouncilStatus.Draft).Select(c => c.Id).ToList();
        var result = new CouncilPublishResultDto();
        if (targets.Count == 0) return TopicResult<CouncilPublishResultDto>.Ok(result, CouncilRules.NoDraftsMessage);

        foreach (var councilId in targets)
        {
            var name = list.FirstOrDefault(c => c.Id == councilId)?.Name ?? string.Empty;
            // Mỗi hội đồng một transaction: hội đồng còn xung đột không chặn hội đồng hợp lệ khác.
            var item = await councils.RunExclusiveAsync(async ct =>
            {
                var now = clock.GetUtcNow().UtcDateTime;
                var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, round, today, [], [], ct);
                var council = workspace.Find(councilId);
                if (council is null) return (false, Item(councilId, name, false, CouncilRules.NotFoundMessage));
                if (council.Status == CouncilStatus.Published) return (false, Item(councilId, council.Name, true, CouncilRules.AlreadyPublishedMessage));
                if (council.Status == CouncilStatus.Cancelled) return (false, Item(councilId, council.Name, false, CouncilRules.CancelledMessage));
                var slots = CouncilWorkspace.ShownSlots(council).ToList();
                if (slots.Count == 0) return (false, Item(councilId, council.Name, false, CouncilRules.NoSlotsMessage));
                // PDR-014/015/016/017: kiểm tra lại toàn bộ trên dữ liệu có hiệu lực lúc công bố.
                var problems = workspace.Conflicts(council);
                if (problems.Count > 0) return (false, Item(councilId, council.Name, false, string.Join(" ", problems)));

                var history = new List<TopicHistoryEntry>();
                var notices = new CouncilFlow.Notices(request.ActorId, now);
                foreach (var member in new[] { council.ChairId, council.SecretaryId })
                    notices.Add(member, $"Bạn là {CouncilFlow.RoleText(council, member)} {council.Name}: {CouncilRules.FormatDay(council.DefenseDate)}, phòng {council.Room}, {slots.Count} đề tài.", "/gv/hoi-dong");
                foreach (var slot in slots)
                {
                    var when = CouncilFlow.When(council.DefenseDate, slot.StartTime, slot.EndTime, council.Room);
                    history.Add(CouncilFlow.History(slot.TopicId, request.ActorId, "Công bố lịch bảo vệ", now, $"{council.Name}: {when}"));
                    foreach (var person in workspace.Stakeholders(slot.TopicId))
                        notices.Add(person, $"Lịch bảo vệ {workspace.Code(slot.TopicId)}: {when} ({council.Name}).", $"/de-tai/{slot.TopicId}");
                }
                var log = CouncilFlow.Log(council.Id, request.ActorId, DefenseCouncilActions.Published, now, null,
                    CouncilRules.Describe(CouncilRules.PlanOf(council), workspace.Topics, workspace.Users));
                var outcome = await councils.PublishAsync(council.Id, request.ActorId, now, log, history, notices.Items, ct);
                return outcome switch
                {
                    CouncilWriteOutcome.Done => (true, Item(councilId, council.Name, true, "Đã công bố.", published: true)),
                    CouncilWriteOutcome.Unchanged => (false, Item(councilId, council.Name, true, CouncilRules.AlreadyPublishedMessage)),
                    _ => (false, Item(councilId, council.Name, false, CouncilFlow.Outcome<bool>(outcome).Response.Message))
                };
            }, cancellationToken);
            result.Results.Add(item.Dto);
            if (item.Published) result.Published++;
            else if (!item.Dto.Ok) result.Skipped++;
        }
        var message = result.Skipped == 0
            ? result.Published > 0 ? $"Đã công bố lịch của {result.Published} hội đồng và gửi thông báo." : CouncilRules.AlreadyPublishedMessage
            : $"Đã công bố {result.Published} hội đồng; {result.Skipped} hội đồng chưa công bố được.";
        return TopicResult<CouncilPublishResultDto>.Ok(result, message);
    }

    private sealed record PublishItem(CouncilPublishItemDto Dto, bool Published);

    private static PublishItem Item(Guid id, string name, bool ok, string message, bool published = false) =>
        new(new CouncilPublishItemDto { CouncilId = id, Name = name, Ok = ok, Message = message }, published);
}

public sealed class CancelCouncilHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ICouncilRepository councils, TimeProvider clock) : IRequestHandler<CancelCouncilCommand, TopicResult<CouncilDto>>
{
    public async Task<TopicResult<CouncilDto>> Handle(CancelCouncilCommand request, CancellationToken cancellationToken)
    {
        var existing = await councils.GetAsync(request.CouncilId, cancellationToken);
        var round = existing is null ? null : await CouncilFlow.FindRoundAsync(rounds, existing.RoundId, cancellationToken);
        if (existing is null || round is null) return TopicResult<CouncilDto>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage);
        if (existing.Status == CouncilStatus.Draft) return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.NotPublishedMessage);
        if (round.Status != RoundStatus.Running) return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.RoundNotRunningMessage);
        if (existing.Status == CouncilStatus.Cancelled) return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.CancelledMessage);
        if (existing.FirstScoredAt is not null) return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.ScoredMessage);

        var today = RoundRules.TodayVietnam(clock);
        var now = clock.GetUtcNow().UtcDateTime;
        var reason = CouncilRules.CleanText(request.Input.Reason);
        var failure = await councils.RunExclusiveAsync<TopicResult<CouncilDto>?>(async ct =>
        {
            var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, round, today, [], [], ct);
            var council = workspace.Find(existing.Id)!;
            var slots = CouncilWorkspace.ShownSlots(council).ToList();
            var history = new List<TopicHistoryEntry>();
            var notices = new CouncilFlow.Notices(request.ActorId, now);
            foreach (var member in new[] { council.ChairId, council.SecretaryId })
                notices.Add(member, $"Lịch bảo vệ của {council.Name} ({CouncilRules.FormatDay(council.DefenseDate)}) đã bị hủy. Lý do: {reason}", "/gv/hoi-dong");
            foreach (var slot in slots)
            {
                var when = CouncilFlow.When(council.DefenseDate, slot.StartTime, slot.EndTime, council.Room);
                history.Add(CouncilFlow.History(slot.TopicId, request.ActorId, "Hủy lịch bảo vệ", now, $"{council.Name}: {when}. Lý do: {reason}"));
                foreach (var person in workspace.Stakeholders(slot.TopicId))
                    notices.Add(person, $"Lịch bảo vệ {workspace.Code(slot.TopicId)} ({council.Name}, {when}) đã bị hủy. Lý do: {reason}", $"/de-tai/{slot.TopicId}");
            }
            var log = CouncilFlow.Log(council.Id, request.ActorId, DefenseCouncilActions.Cancelled, now, reason,
                CouncilRules.Describe(CouncilRules.PlanOf(council), workspace.Topics, workspace.Users));
            var outcome = await councils.CancelAsync(council.Id, request.ActorId, now, reason, log, history, notices.Items, ct);
            return outcome == CouncilWriteOutcome.Done ? (true, null) : (false, CouncilFlow.Outcome<CouncilDto>(outcome));
        }, cancellationToken);
        if (failure is not null) return failure;
        return await CouncilFlow.DtoAsync(councils, topics, groups, round, existing.Id, today,
            $"Đã hủy lịch {existing.Name} và thông báo cho người bị ảnh hưởng.", created: false, cancellationToken);
    }
}

public sealed class AddCouncilCorrectionHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ICouncilRepository councils, TimeProvider clock) : IRequestHandler<AddCouncilCorrectionCommand, TopicResult<CouncilDto>>
{
    public async Task<TopicResult<CouncilDto>> Handle(AddCouncilCorrectionCommand request, CancellationToken cancellationToken)
    {
        var existing = await councils.GetAsync(request.CouncilId, cancellationToken);
        var round = existing is null ? null : await CouncilFlow.FindRoundAsync(rounds, existing.RoundId, cancellationToken);
        if (existing is null || round is null) return TopicResult<CouncilDto>.Fail(TopicResultStatus.NotFound, CouncilRules.NotFoundMessage);
        if (existing.Status != CouncilStatus.Published)
            return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.CorrectionNotPublishedMessage);
        if (existing.FirstScoredAt is null)
            return TopicResult<CouncilDto>.Fail(TopicResultStatus.Conflict, CouncilRules.CorrectionBeforeScoreMessage);

        var today = RoundRules.TodayVietnam(clock);
        var now = clock.GetUtcNow().UtcDateTime;
        var content = request.Input.Content!.Trim();
        var reason = CouncilRules.CleanText(request.Input.Reason);
        await councils.RunExclusiveAsync(async ct =>
        {
            var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, round, today, [], [], ct);
            var council = workspace.Find(existing.Id)!;
            var history = new List<TopicHistoryEntry>();
            var notices = new CouncilFlow.Notices(request.ActorId, now);
            var text = $"Đính chính lịch {council.Name}: {content}";
            foreach (var member in new[] { council.ChairId, council.SecretaryId }) notices.Add(member, text, "/gv/hoi-dong");
            foreach (var slot in CouncilWorkspace.ShownSlots(council))
            {
                history.Add(CouncilFlow.History(slot.TopicId, request.ActorId, "Đính chính lịch bảo vệ", now, $"{content}. Lý do: {reason}"));
                foreach (var person in workspace.Stakeholders(slot.TopicId)) notices.Add(person, text, $"/de-tai/{slot.TopicId}");
            }
            await councils.AddCorrectionAsync(CouncilFlow.Log(council.Id, request.ActorId, DefenseCouncilActions.Correction, now, reason, content),
                history, notices.Items, ct);
            return (true, true);
        }, cancellationToken);
        return await CouncilFlow.DtoAsync(councils, topics, groups, round, existing.Id, today,
            "Đã ghi đính chính; lịch gốc được giữ nguyên.", created: false, cancellationToken);
    }
}

public sealed class ListMyCouncilsHandler(IRoundRepository rounds, ITopicRepository topics, IGroupRepository groups,
    ICouncilRepository councils, TimeProvider clock) : IRequestHandler<ListMyCouncilsQuery, TopicResult<MyCouncilsDto>>
{
    public async Task<TopicResult<MyCouncilsDto>> Handle(ListMyCouncilsQuery request, CancellationToken cancellationToken)
    {
        var mine = await councils.ListVisibleByMemberAsync(request.LecturerId, cancellationToken);
        var dto = new MyCouncilsDto();
        var roundsById = new Dictionary<Guid, ThesisRound>();
        foreach (var roundId in mine.Select(c => c.RoundId).Distinct())
            if (await rounds.GetByIdAsync(roundId, cancellationToken) is { } round)
            {
                roundsById[round.Id] = round;
                dto.Rounds.Add(CouncilWorkspace.RoundInfo(round));
            }
        dto.RoundId = request.RoundId is { } wanted && roundsById.ContainsKey(wanted) ? wanted
            : roundsById.Values.Where(r => r.Status == RoundStatus.Running).Select(r => (Guid?)r.Id).FirstOrDefault()
              ?? dto.Rounds.FirstOrDefault()?.Id;
        if (dto.RoundId is not { } selected) return TopicResult<MyCouncilsDto>.Ok(dto);

        var workspace = await CouncilWorkspace.LoadAsync(councils, topics, groups, roundsById[selected], RoundRules.TodayVietnam(clock), [], [], cancellationToken);
        dto.Councils = workspace.Councils
            .Where(c => c.Status != CouncilStatus.Draft && (c.ChairId == request.LecturerId || c.SecretaryId == request.LecturerId))
            .OrderBy(c => c.Status == CouncilStatus.Cancelled).ThenBy(c => c.DefenseDate)
            .Select(c => new MyCouncilDto
            {
                Id = c.Id,
                RoundId = c.RoundId,
                Name = c.Name,
                Status = CouncilRules.Label(c.Status),
                MyRole = c.ChairId == request.LecturerId ? "chair" : "secretary",
                Chair = workspace.Person(c.ChairId),
                Secretary = workspace.Person(c.SecretaryId),
                Date = RoundRules.FormatDate(c.DefenseDate),
                Room = c.Room,
                CancelReason = c.CancelReason,
                Slots = CouncilWorkspace.ShownSlots(c).Select(workspace.Slot).ToList(),
                Corrections = workspace.Corrections(c.Id)
            }).ToList();
        return TopicResult<MyCouncilsDto>.Ok(dto);
    }
}
