using Backend.Application;
using Backend.Application.Common.Storage;
using Backend.Application.Councils;
using Backend.Application.Reviewers;
using Backend.Application.Rounds;
using Backend.Application.Submissions;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Councils;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Submissions;
using Backend.Infrastructure.Repositories.Topics;
using Backend.Infrastructure.Repositories.Users;
using FluentValidation;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

// P06: hội đồng và lịch bảo vệ (PDR-014–020, PDR-063), chạy handler thật trên repository EF Core thật (SQLite).
public sealed class CouncilWorkflowTests : IDisposable
{
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset DuringOutline = new(2026, 9, 16, 3, 0, 0, TimeSpan.Zero);
    private const string Day = "2026-10-14";

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;
    private readonly ManualTimeProvider _clock = new(DuringSubmission);

    public CouncilWorkflowTests()
    {
        _connection.Open();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<TimeProvider>(_clock);
        services.AddApplicationServices();
        services.AddDbContext<ApplicationDbContext>(o => o.UseSqlite(_connection));
        services.AddScoped<IRoundRepository, RoundRepository>();
        services.AddScoped<ITopicRepository, TopicRepository>();
        services.AddScoped<IGroupRepository, GroupRepository>();
        services.AddScoped<IOutlineRepository, OutlineRepository>();
        services.AddScoped<ISubmissionRepository, SubmissionRepository>();
        services.AddScoped<IReviewerRepository, ReviewerRepository>();
        services.AddScoped<ICouncilRepository, CouncilRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddSingleton<IDocumentStorage>(new InMemoryAvatarStorage());
        _provider = services.BuildServiceProvider();
        using var scope = _provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreated();
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }

    private async Task<T> Send<T>(IRequest<T> request)
    {
        _clock.Advance(TimeSpan.FromMinutes(1));
        using var scope = _provider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    private async Task Db(Func<ApplicationDbContext, Task> action)
    {
        using var scope = _provider.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    private async Task<T> Read<T>(Func<ApplicationDbContext, Task<T>> read)
    {
        using var scope = _provider.CreateScope();
        return await read(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    private sealed record Person(Guid Id, string Code, string Name);

    // Đợt đang diễn ra: Giáo vụ, GV A (hướng dẫn T0, T1, T3), B (hướng dẫn T2), C (hướng dẫn T4), D, E; một GV ngoài đợt.
    // T0–T2 có nhóm và đã duyệt đề cương; T3 có nhóm, chưa duyệt; T4 không có nhóm.
    private sealed class World
    {
        public Guid RoundId;
        public Person Staff = null!, A = null!, B = null!, C = null!, D = null!, E = null!, Outside = null!;
        public List<Guid> T = [];
        public Dictionary<Guid, List<Guid>> Members = [];
        public string Suffix = string.Empty;
    }

    private async Task<Person> Seed(UserRole role, string code)
    {
        Guid id = default;
        await Db(async db => id = await RoundWorkflowTests.SeedUser(db, role, code, $"Người {code}", role == UserRole.Student ? "KTPM2023" : "CNPM"));
        return new Person(id, code, $"Người {code}");
    }

    private static RoundMilestonesInputDto Dated() => new()
    {
        Milestones = RoundRules.OrderedKeys.Select((key, i) => new RoundMilestoneInputDto
        {
            Key = RoundRules.KeyName(key),
            StartDate = new DateOnly(2026, 9, 1).AddDays(i * 7).ToString("yyyy-MM-dd"),
            EndDate = new DateOnly(2026, 9, 1).AddDays(i * 7 + 5).ToString("yyyy-MM-dd"),
            NotifyAudience = "Tất cả",
            AllowLate = ThesisRound.HasLateToggle(key) ? false : null
        }).ToList()
    };

    private async Task<World> NewWorld()
    {
        _clock.Set(DuringSubmission);
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var w = new World
        {
            Suffix = s,
            Staff = await Seed(UserRole.AcademicAffairs, $"GVU{s}"),
            A = await Seed(UserRole.Lecturer, $"GV{s}A"),
            B = await Seed(UserRole.Lecturer, $"GV{s}B"),
            C = await Seed(UserRole.Lecturer, $"GV{s}C"),
            D = await Seed(UserRole.Lecturer, $"GV{s}D"),
            E = await Seed(UserRole.Lecturer, $"GV{s}E"),
            Outside = await Seed(UserRole.Lecturer, $"GV{s}X")
        };
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        w.RoundId = round.Id;
        await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [w.A.Code, w.B.Code, w.C.Code, w.D.Code, w.E.Code]));
        var students = new List<string>();
        for (var i = 0; i < 8; i++) students.Add((await Seed(UserRole.Student, $"SV{s}{i}")).Code);
        await Send(new AddParticipantsCommand(round.Id, "students", students));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(round.Id))).Status);

        // (GVHD, có nhóm, đã duyệt)
        var specs = new (Person Supervisor, bool Group, bool Approved)[] { (w.A, true, true), (w.A, true, true), (w.B, true, true), (w.A, true, false), (w.C, false, false) };
        foreach (var spec in specs)
        {
            var created = await Send(new CreateTopicCommand(spec.Supervisor.Id, new TopicInputDto
            {
                RoundId = w.RoundId, Title = $"Đề tài {w.T.Count + 1}", Field = "CNPM", Description = "Mô tả"
            }));
            w.T.Add(created.Response.Data!.Id);
        }
        Assert.Equal(RoundResultStatus.Ok, (await Send(new PublishRoundTopicsCommand(w.RoundId))).Status);
        var cursor = 0;
        for (var i = 0; i < specs.Length; i++)
        {
            if (!specs[i].Group) continue;
            var rep = students[cursor++];
            var partner = students[cursor++];
            var ids = await Read(db => db.Users.Where(u => u.UserCode == rep || u.UserCode == partner).Select(u => u.Id).ToListAsync());
            var repId = await Read(db => db.Users.Where(u => u.UserCode == rep).Select(u => u.Id).SingleAsync());
            Assert.Equal(TopicResultStatus.Ok, (await Send(new RegisterTopicCommand(repId, w.T[i], [partner]))).Status);
            w.Members[w.T[i]] = ids;
        }
        _clock.Set(DuringOutline);
        for (var i = 0; i < specs.Length; i++)
            if (specs[i].Approved)
            {
                var topicId = w.T[i];
                var supervisor = specs[i].Supervisor.Id;
                await Db(async db =>
                {
                    var topic = await db.ThesisTopics.SingleAsync(t => t.Id == topicId);
                    topic.OutlineApprovedAt = _clock.GetUtcNow().UtcDateTime;
                    topic.OutlineApprovedById = supervisor;
                    await db.SaveChangesAsync();
                });
            }
        return w;
    }

    private static CouncilInputDto Input(World w, string name, Person chair, Person secretary, string room,
        params (Guid Topic, string Start, string End)[] slots) => new()
    {
        RoundId = w.RoundId,
        Name = name,
        ChairId = chair.Id,
        SecretaryId = secretary.Id,
        Date = Day,
        Room = room,
        Slots = slots.Select(s => new CouncilSlotInputDto { TopicId = s.Topic, Start = s.Start, End = s.End }).ToList()
    };

    private Task<TopicResult<CouncilDto>> Create(World w, CouncilInputDto input) => Send(new CreateCouncilCommand(w.Staff.Id, input));

    private async Task<CouncilDto> Created(World w, CouncilInputDto input)
    {
        var result = await Create(w, input);
        Assert.True(result.Status == TopicResultStatus.Created, string.Join(" | ", result.Response.Errors ?? [result.Response.Message]));
        return result.Response.Data!;
    }

    private static CouncilInputDto Edit(CouncilDto council, Action<CouncilInputDto> change)
    {
        var input = new CouncilInputDto
        {
            Name = council.Name, ChairId = council.Chair.Id, SecretaryId = council.Secretary.Id, Date = council.Date, Room = council.Room,
            ExpectedVersion = council.Version,
            Slots = council.Slots.Select(s => new CouncilSlotInputDto { TopicId = s.TopicId, Start = s.Start, End = s.End }).ToList()
        };
        change(input);
        return input;
    }

    private async Task<CouncilBoardDto> Board(World w) => (await Send(new GetCouncilBoardQuery(w.RoundId))).Response.Data!;

    private async Task<CouncilPublishResultDto> Publish(World w, params Guid[] ids) =>
        (await Send(new PublishCouncilsCommand(w.Staff.Id, new CouncilPublishInputDto { RoundId = w.RoundId, CouncilIds = ids.Length == 0 ? null : ids.ToList() })))
        .Response.Data!;

    // Thông báo lịch bảo vệ (bỏ thông báo "đợt đã mở" cùng loại schedule).
    private Task<int> Notices(Guid recipient) => Read(db => db.Notifications.CountAsync(n => n.RecipientUserId == recipient
        && n.Kind == NotificationKinds.Schedule && !n.Text.StartsWith("Đợt khóa luận")));

    private Task MarkScored(Guid councilId) => Db(async db =>
    {
        var council = await db.DefenseCouncils.SingleAsync(c => c.Id == councilId);
        council.FirstScoredAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    });

    // ---------- P06-S01: hội đồng và thành viên ----------

    [Fact]
    public async Task CreatesDraftCouncilWithOrderedSlotsAndHistory()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15"), (w.T[1], "08:15", "09:00")));

        Assert.Equal("Nháp", council.Status);
        Assert.Equal(1, council.Version);
        Assert.Equal(new[] { 1, 2 }, council.Slots.Select(s => s.Order));
        Assert.Equal("08:15", council.Slots[1].Start);
        Assert.Empty(council.Conflicts);
        Assert.True(council.CanPublish);
        Assert.True(council.CanDelete);
        var log = Assert.Single(council.History);
        Assert.Equal(DefenseCouncilActions.Created, log.Action);
        Assert.Contains("DT-001 07:30–08:15", log.Detail);

        var board = await Board(w);
        Assert.DoesNotContain(board.Pool, p => p.TopicId == w.T[0] || p.TopicId == w.T[1]);
        Assert.Equal(2, board.Stats.Scheduled);
        Assert.Equal(1, board.Stats.Unscheduled);
        // Lịch Nháp không gửi thông báo.
        Assert.Equal(0, await Notices(w.B.Id));
    }

    [Fact]
    public async Task ChairAndSecretaryMustBeTwoActiveLecturersOfTheRound()
    {
        var w = await NewWorld();
        var same = await Create(w, Input(w, "Hội đồng 1", w.B, w.B, "B4.12"));
        Assert.Equal(TopicResultStatus.Conflict, same.Status);
        Assert.Contains(CouncilRules.SameMemberMessage, same.Response.Errors!);

        var outside = await Create(w, Input(w, "Hội đồng 1", w.Outside, w.C, "B4.12"));
        Assert.Contains("Chủ tịch không thuộc danh sách giảng viên của đợt.", outside.Response.Errors!);

        await Db(async db => { (await db.Users.SingleAsync(u => u.Id == w.C.Id)).IsActive = false; await db.SaveChangesAsync(); });
        var inactive = await Create(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12"));
        Assert.Contains(inactive.Response.Errors!, e => e.StartsWith("Tài khoản thư ký", StringComparison.Ordinal));
        Assert.Equal(0, await Read(db => db.DefenseCouncils.CountAsync()));
    }

    [Fact]
    public async Task SupervisorCannotSitOnTheCouncilOfTheirOwnTopic()
    {
        var w = await NewWorld();
        var result = await Create(w, Input(w, "Hội đồng 1", w.A, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        Assert.Equal(TopicResultStatus.Conflict, result.Status);
        Assert.Contains($"DT-001: {w.A.Name} là GVHD nhưng đang ngồi hội đồng chấm đề tài này.", result.Response.Errors!);

        // Thư ký cũng vậy.
        var secretary = await Create(w, Input(w, "Hội đồng 1", w.C, w.B, "B4.12", (w.T[2], "07:30", "08:15")));
        Assert.Contains(secretary.Response.Errors!, e => e.Contains("là GVHD", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ReviewerMayChairTheCouncilOfTheTopicTheyReview()
    {
        // OQ-032 chốt ngày 2026-11-17: cho phép GVPB ngồi hội đồng chấm cùng đề tài.
        var w = await NewWorld();
        Assert.Equal(TopicResultStatus.Ok, (await Send(new AssignReviewerCommand(w.Staff.Id, w.T[0],
            new AssignReviewerInputDto { ReviewerId = w.D.Id }))).Status);
        var council = await Created(w, Input(w, "Hội đồng 1", w.D, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        Assert.Equal(w.D.Code, council.Slots[0].Reviewer!.Code);
        Assert.Empty(council.Conflicts);
    }

    [Fact]
    public async Task OnlyTopicsWithAGroupAndAnApprovedOutlineAreScheduled()
    {
        var w = await NewWorld();
        var result = await Create(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[3], "07:30", "08:15"), (w.T[4], "08:15", "09:00")));
        Assert.Contains("DT-004: Chưa duyệt đề cương.", result.Response.Errors!);
        Assert.Contains("DT-005: Đề tài không có nhóm.", result.Response.Errors!);

        var board = await Board(w);
        Assert.False(board.Pool.Single(p => p.TopicId == w.T[3]).Eligible);
        Assert.Equal("Chưa duyệt đề cương", board.Pool.Single(p => p.TopicId == w.T[3]).BlockedReason);
        Assert.True(board.Pool.Single(p => p.TopicId == w.T[0]).Eligible);
    }

    [Fact]
    public async Task ATopicHasAtMostOneActiveSlot()
    {
        var w = await NewWorld();
        await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        var second = await Create(w, Input(w, "Hội đồng 2", w.D, w.E, "B4.14", (w.T[0], "13:00", "13:45")));
        Assert.Contains("DT-001 đã thuộc Hội đồng 1.", second.Response.Errors!);

        var twice = await Create(w, Input(w, "Hội đồng 2", w.D, w.E, "B4.14", (w.T[1], "07:30", "08:15"), (w.T[1], "08:15", "09:00")));
        Assert.Contains("DT-002 xuất hiện hai lần trong hội đồng.", twice.Response.Errors!);
    }

    [Fact]
    public async Task CouncilNamesAreUniqueInTheRound()
    {
        var w = await NewWorld();
        await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12"));
        var duplicate = await Create(w, Input(w, "  hội   đồng 1 ", w.D, w.E, "B4.14"));
        Assert.Contains(CouncilRules.DuplicateNameMessage, duplicate.Response.Errors!);
    }

    [Fact]
    public async Task ValidatorRejectsMissingOrMalformedFields()
    {
        var w = await NewWorld();
        var bad = Input(w, " ", w.B, w.C, "", (w.T[0], "7h30", "25:00"));
        bad.Date = "14/10/2026";
        var ex = await Assert.ThrowsAsync<ValidationException>(() => Create(w, bad));
        // Validator lồng (SetValidator) thêm tiền tố "Input.".
        var properties = ex.Errors.Select(e => e.PropertyName.Split('.').Last()).ToList();
        Assert.Contains("name", properties);
        Assert.Contains("room", properties);
        Assert.Contains("date", properties);
        Assert.Contains(ex.Errors, e => e.ErrorMessage.Contains("HH:MM", StringComparison.Ordinal));

        var tooMany = Input(w, "Hội đồng 1", w.B, w.C, "B4.12");
        tooMany.Slots = Enumerable.Range(0, CouncilRules.MaxSlots + 1).Select(_ => new CouncilSlotInputDto { TopicId = w.T[0], Start = "07:00", End = "07:10" }).ToList();
        await Assert.ThrowsAsync<ValidationException>(() => Create(w, tooMany));
    }

    // ---------- P06-S02: giờ từng lượt và xung đột ----------

    [Fact]
    public async Task EachSlotEndsAfterItStartsAndSlotsOfACouncilDoNotOverlap()
    {
        var w = await NewWorld();
        var reversed = await Create(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "08:15", "08:15")));
        Assert.Contains("DT-001: giờ kết thúc phải sau giờ bắt đầu.", reversed.Response.Errors!);

        var overlap = await Create(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15"), (w.T[1], "08:00", "08:45")));
        Assert.Contains("DT-002 bắt đầu trước khi DT-001 kết thúc.", overlap.Response.Errors!);

        // Liền kề (kết thúc = bắt đầu) không chồng lấn; giờ không theo một thời lượng chung (PDR-017).
        var adjacent = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15"), (w.T[1], "08:15", "09:30")));
        Assert.Equal("09:30", adjacent.Slots[1].End);
    }

    [Fact]
    public async Task SameRoomOverlapIsBlockedButTouchingSlotsAreAllowed()
    {
        var w = await NewWorld();
        await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15"), (w.T[1], "08:15", "09:00")));

        // Phòng so khớp không phân biệt hoa thường và khoảng trắng thừa (PDR-014).
        var partial = await Create(w, Input(w, "Hội đồng 2", w.D, w.E, " b4.12 ", (w.T[2], "08:30", "09:15")));
        Assert.Equal(TopicResultStatus.Conflict, partial.Status);
        Assert.Contains("Phòng b4.12 trùng giờ với Hội đồng 1 (07:30–09:00).", partial.Response.Errors!);

        var covering = await Create(w, Input(w, "Hội đồng 2", w.D, w.E, "B4.12", (w.T[2], "07:00", "10:00")));
        Assert.Contains(covering.Response.Errors!, e => e.StartsWith("Phòng B4.12 trùng giờ", StringComparison.Ordinal));

        var touching = await Created(w, Input(w, "Hội đồng 2", w.D, w.E, "B4.12", (w.T[2], "09:00", "09:45")));
        Assert.Empty(touching.Conflicts);
    }

    [Fact]
    public async Task ALecturerInTwoOverlappingCouncilsIsBlockedWhateverTheRole()
    {
        var w = await NewWorld();
        await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));

        // C là Thư ký ở hội đồng 1, Chủ tịch ở hội đồng 2 (PDR-015).
        var clash = await Create(w, Input(w, "Hội đồng 2", w.C, w.D, "C2.03", (w.T[2], "08:00", "08:45")));
        Assert.Contains($"{w.C.Name} trùng giờ với Hội đồng 1 (07:30–08:15).", clash.Response.Errors!);

        var later = await Created(w, Input(w, "Hội đồng 2", w.C, w.D, "C2.03", (w.T[2], "08:15", "09:00")));
        Assert.Empty(later.Conflicts);
    }

    [Fact]
    public async Task ConflictsAreCheckedAcrossRoundsOnTheSameDayOnly()
    {
        var w = await NewWorld();
        await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        var other = await NewWorld();
        await Send(new AddParticipantsCommand(other.RoundId, "lecturers", [w.B.Code]));

        var clash = await Create(other, Input(other, "Hội đồng A", w.B, other.D, "B4.12", (other.T[0], "07:00", "08:00")));
        Assert.Contains(clash.Response.Errors!, e => e.Contains($"trùng giờ với Hội đồng 1 · Đợt {w.Suffix}", StringComparison.Ordinal));
        Assert.Equal(2, clash.Response.Errors!.Count(e => e.Contains("trùng giờ", StringComparison.Ordinal)));

        var otherDay = Input(other, "Hội đồng A", w.B, other.D, "B4.12", (other.T[0], "07:00", "08:00"));
        otherDay.Date = "2026-10-15";
        await Created(other, otherDay);
    }

    [Fact]
    public async Task CheckPreviewsConflictsWithoutSaving()
    {
        var w = await NewWorld();
        await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        var input = Input(w, "Hội đồng 2", w.C, w.D, "B4.12", (w.T[1], "08:00", "08:30"));
        var check = new CouncilCheckInputDto
        {
            RoundId = input.RoundId, Name = input.Name, ChairId = input.ChairId, SecretaryId = input.SecretaryId, Date = input.Date,
            Room = input.Room, Slots = input.Slots
        };
        var result = (await Send(new CheckCouncilQuery(check))).Response.Data!;
        Assert.False(result.Ok);
        Assert.Equal(2, result.Problems.Count);
        Assert.Equal(1, await Read(db => db.DefenseCouncils.CountAsync()));
    }

    [Fact]
    public async Task UpdatingADraftReordersRemovesAndUsesOptimisticVersion()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15"), (w.T[1], "08:15", "09:00")));

        var updated = await Send(new UpdateCouncilCommand(w.Staff.Id, council.Id, Edit(council, i =>
        {
            i.Slots = [new CouncilSlotInputDto { TopicId = w.T[1], Start = "07:30", End = "08:10" }];
            i.Room = "B4.14";
        })));
        Assert.Equal(TopicResultStatus.Ok, updated.Status);
        var dto = updated.Response.Data!;
        Assert.Equal(2, dto.Version);
        Assert.Equal(w.T[1], Assert.Single(dto.Slots).TopicId);
        // Hội đồng Nháp: lượt bị bỏ được xóa hẳn, đề tài quay lại kho chưa xếp.
        Assert.Equal(1, await Read(db => db.DefenseSlots.CountAsync(s => s.CouncilId == council.Id)));
        Assert.Contains((await Board(w)).Pool, p => p.TopicId == w.T[0] && p.Eligible);
        Assert.Contains(dto.History, h => h.Action == DefenseCouncilActions.Updated && h.Detail!.Contains("Trước:", StringComparison.Ordinal));

        // Bản cũ (Version 1) bị từ chối: người khác vừa sửa.
        var stale = await Send(new UpdateCouncilCommand(w.Staff.Id, council.Id, Edit(council, i => i.Room = "C1.01")));
        Assert.Equal(TopicResultStatus.Conflict, stale.Status);
        Assert.Equal(CouncilRules.ChangedMessage, stale.Response.Message);
    }

    [Fact]
    public async Task OnlyDraftCouncilsAreDeleted()
    {
        var w = await NewWorld();
        var draft = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        Assert.Equal(TopicResultStatus.Ok, (await Send(new DeleteCouncilCommand(draft.Id))).Status);
        Assert.Equal(0, await Read(db => db.DefenseSlots.CountAsync()));
        Assert.Equal(0, await Read(db => db.DefenseCouncilLogs.CountAsync()));

        var published = await Created(w, Input(w, "Hội đồng 2", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        await Publish(w, published.Id);
        var delete = await Send(new DeleteCouncilCommand(published.Id));
        Assert.Equal(TopicResultStatus.Conflict, delete.Status);
        Assert.Equal(CouncilRules.PublishedNoDeleteMessage, delete.Response.Message);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new DeleteCouncilCommand(Guid.NewGuid()))).Status);
    }

    // ---------- P06-S03: công bố, quyền xem ----------

    [Fact]
    public async Task PublishingNotifiesCouncilSupervisorReviewerAndGroupOnceEvenWhenRepeated()
    {
        var w = await NewWorld();
        await Send(new AssignReviewerCommand(w.Staff.Id, w.T[0], new AssignReviewerInputDto { ReviewerId = w.E.Id }));
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        var reviewerBefore = await Notices(w.E.Id);

        var result = await Publish(w);
        Assert.Equal(1, result.Published);
        Assert.Equal(0, result.Skipped);
        Assert.Equal(1, await Notices(w.B.Id));
        Assert.Equal(1, await Notices(w.C.Id));
        Assert.Equal(1, await Notices(w.A.Id));
        Assert.Equal(reviewerBefore + 1, await Notices(w.E.Id));
        foreach (var student in w.Members[w.T[0]])
            Assert.Equal(1, await Notices(student));
        var text = await Read(db => db.Notifications.Where(n => n.RecipientUserId == w.A.Id && n.Href.StartsWith("/de-tai/")).Select(n => n.Text).SingleAsync());
        Assert.Equal("Lịch bảo vệ DT-001: 14/10/2026 07:30–08:15, phòng B4.12 (Hội đồng 1).", text);
        Assert.Equal(1, await Read(db => db.TopicHistoryEntries.CountAsync(h => h.TopicId == w.T[0] && h.Category == TopicHistoryCategories.Defense)));

        // Công bố lặp không tạo lịch hay thông báo nhân đôi.
        var again = await Publish(w, council.Id);
        Assert.True(again.Results.Single().Ok);
        Assert.Equal(CouncilRules.AlreadyPublishedMessage, again.Results.Single().Message);
        Assert.Equal(0, again.Published);
        Assert.Equal(1, await Notices(w.B.Id));
        Assert.Equal(CouncilRules.NoDraftsMessage, (await Send(new PublishCouncilsCommand(w.Staff.Id, new CouncilPublishInputDto { RoundId = w.RoundId }))).Response.Message);
        Assert.Equal("Đã công bố", (await Board(w)).Councils.Single().Status);
    }

    [Fact]
    public async Task PublishingIsCheckedAgainAndMixedLotsReportEachCouncil()
    {
        var w = await NewWorld();
        var ok = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        var empty = await Created(w, Input(w, "Hội đồng 2", w.D, w.E, "B4.14"));
        var drifted = await Created(w, Input(w, "Hội đồng 3", w.D, w.E, "C2.03", (w.T[2], "07:30", "08:15")));
        // Đề tài hết điều kiện sau khi lưu (Giáo vụ kết thúc Không đủ điều kiện công bố): kiểm tra lại lúc công bố.
        await Db(async db => { (await db.ThesisTopics.SingleAsync(t => t.Id == w.T[2])).Status = TopicStatus.Ineligible; await db.SaveChangesAsync(); });

        var result = await Publish(w);
        Assert.Equal(1, result.Published);
        Assert.Equal(2, result.Skipped);
        Assert.Equal(CouncilRules.NoSlotsMessage, result.Results.Single(r => r.CouncilId == empty.Id).Message);
        Assert.Contains("DT-003: Đề tài đã kết thúc.", result.Results.Single(r => r.CouncilId == drifted.Id).Message);
        Assert.True(result.Results.Single(r => r.CouncilId == ok.Id).Ok);

        var board = await Board(w);
        Assert.False(board.Councils.Single(c => c.Id == drifted.Id).CanPublish);
        Assert.StartsWith("Còn 1 xung đột", board.Councils.Single(c => c.Id == drifted.Id).PublishBlockedReason);
    }

    [Fact]
    public async Task DraftScheduleIsOnlyVisibleToStaffAndPublishedIsVisibleToThePeopleConcerned()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        var student = w.Members[w.T[0]][0];

        Assert.Null((await Send(new GetTopicQuery(w.T[0], student, ViewerRole.Student))).Response.Data!.Defense);
        Assert.Null((await Send(new GetTopicQuery(w.T[0], w.A.Id, ViewerRole.Lecturer))).Response.Data!.Defense);
        var staffView = (await Send(new GetTopicQuery(w.T[0], w.Staff.Id, ViewerRole.AcademicAffairs))).Response.Data!.Defense!;
        Assert.False(staffView.CouncilPublished);
        // Chủ tịch chưa xem được đề tài khi lịch còn Nháp.
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetTopicQuery(w.T[0], w.B.Id, ViewerRole.Lecturer))).Status);
        Assert.Empty((await Send(new ListMyCouncilsQuery(w.B.Id, null))).Response.Data!.Councils);

        await Publish(w, council.Id);
        var defense = (await Send(new GetTopicQuery(w.T[0], student, ViewerRole.Student))).Response.Data!.Defense!;
        Assert.True(defense.CouncilPublished);
        Assert.Equal("2026-10-14T07:30:00", defense.Start);
        Assert.Equal("2026-10-14T08:15:00", defense.End);
        Assert.Equal("B4.12", defense.Room);
        Assert.Equal(1, defense.Order);
        Assert.Equal(w.B.Name, defense.Chair);

        // Hội đồng chỉ xem: chi tiết đề tài, đề cương, bài nộp; GV khác vẫn 404 (ROLES).
        Assert.Equal(TopicResultStatus.Ok, (await Send(new GetTopicQuery(w.T[0], w.B.Id, ViewerRole.Lecturer))).Status);
        var outline = await Send(new GetOutlineQuery(w.T[0], w.C.Id, ViewerRole.Lecturer));
        Assert.Equal("council", outline.Response.Data!.ViewerRole);
        Assert.False(outline.Response.Data.CanReview);
        Assert.Equal(TopicResultStatus.Ok, (await Send(new ListSubmissionsQuery(w.C.Id, ViewerRole.Lecturer, w.T[0]))).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetTopicQuery(w.T[0], w.D.Id, ViewerRole.Lecturer))).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetOutlineQuery(w.T[0], w.D.Id, ViewerRole.Lecturer))).Status);

        var mine = (await Send(new ListMyCouncilsQuery(w.C.Id, null))).Response.Data!;
        var mineCouncil = Assert.Single(mine.Councils);
        Assert.Equal("secretary", mineCouncil.MyRole);
        Assert.Equal(w.RoundId, mine.RoundId);
        Assert.Equal("DT-001", Assert.Single(mineCouncil.Slots).Code);
        Assert.Empty((await Send(new ListMyCouncilsQuery(w.D.Id, null))).Response.Data!.Councils);
    }

    // ---------- PDR-018: sửa lịch đã công bố trước điểm ----------

    [Fact]
    public async Task EditingAPublishedScheduleNeedsAReasonKeepsHistoryAndNotifiesTheAffected()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15"), (w.T[1], "08:15", "09:00")));
        await Publish(w, council.Id);
        council = (await Board(w)).Councils.Single();

        var noReason = await Send(new UpdateCouncilCommand(w.Staff.Id, council.Id, Edit(council, i => i.Room = "B4.14")));
        Assert.Equal(TopicResultStatus.Invalid, noReason.Status);
        Assert.Equal(CouncilRules.ReasonRequiredMessage, noReason.Response.Message);

        var supervisorBefore = await Notices(w.A.Id);
        var moved = await Send(new UpdateCouncilCommand(w.Staff.Id, council.Id, Edit(council, i =>
        {
            i.Reason = "Phòng B4.12 sửa chữa";
            i.Slots = [new CouncilSlotInputDto { TopicId = w.T[0], Start = "09:00", End = "09:45" }];
        })));
        Assert.Equal(TopicResultStatus.Ok, moved.Status);
        // Lượt bị bỏ khỏi lịch đã công bố không xóa vật lý mà chuyển Removed.
        Assert.Equal(DefenseSlotStatus.Removed, await Read(db => db.DefenseSlots.Where(s => s.TopicId == w.T[1]).Select(s => s.Status).SingleAsync()));
        Assert.Contains((await Board(w)).Pool, p => p.TopicId == w.T[1]);
        var histories = await Read(db => db.TopicHistoryEntries.Where(h => h.Category == TopicHistoryCategories.Defense).Select(h => new { h.TopicId, h.Action, h.Detail }).ToListAsync());
        Assert.Contains(histories, h => h.TopicId == w.T[0] && h.Action == "Đổi lịch bảo vệ" && h.Detail!.Contains("07:30–08:15", StringComparison.Ordinal));
        Assert.Contains(histories, h => h.TopicId == w.T[1] && h.Action == "Bỏ khỏi lịch bảo vệ");
        // GVHD của cả hai đề tài (A) nhận hai thông báo; thành viên hội đồng nhận thông báo thay đổi.
        Assert.Equal(supervisorBefore + 2, await Notices(w.A.Id));
        Assert.Contains("Phòng B4.12 sửa chữa", await Read(db => db.Notifications.Where(n => n.RecipientUserId == w.B.Id).OrderByDescending(n => n.CreatedAt).Select(n => n.Text).FirstAsync()));
        var log = moved.Response.Data!.History.First();
        Assert.Equal("Phòng B4.12 sửa chữa", log.Reason);
        Assert.Contains("Trước:", log.Detail);
        Assert.Contains("07:30–08:15", log.Detail);

        // Sửa gây xung đột bị từ chối, kiểm tra lại cả với hội đồng khác.
        await Created(w, Input(w, "Hội đồng 2", w.D, w.E, "C2.03", (w.T[2], "09:00", "09:45")));
        var current = (await Board(w)).Councils.Single(c => c.Id == council.Id);
        var conflict = await Send(new UpdateCouncilCommand(w.Staff.Id, council.Id, Edit(current, i => { i.Room = "C2.03"; i.Reason = "Đổi phòng"; })));
        Assert.Equal(TopicResultStatus.Conflict, conflict.Status);
        Assert.Contains(conflict.Response.Errors!, e => e.StartsWith("Phòng C2.03 trùng giờ với Hội đồng 2", StringComparison.Ordinal));
    }

    [Fact]
    public async Task MembersCanBeReplacedBeforeAnyScoreButNotAfter()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        await Publish(w, council.Id);
        council = (await Board(w)).Councils.Single();

        var replaced = await Send(new UpdateCouncilCommand(w.Staff.Id, council.Id, Edit(council, i => { i.SecretaryId = w.D.Id; i.Reason = "TS. C đi công tác"; })));
        Assert.Equal(TopicResultStatus.Ok, replaced.Status);
        Assert.Equal(w.D.Id, replaced.Response.Data!.Secretary.Id);
        Assert.Contains(await Read(db => db.Notifications.Where(n => n.RecipientUserId == w.C.Id).Select(n => n.Text).ToListAsync()),
            t => t.StartsWith("Bạn không còn thuộc Hội đồng 1", StringComparison.Ordinal));
        Assert.Contains(await Read(db => db.TopicHistoryEntries.Where(h => h.TopicId == w.T[0]).Select(h => h.Action).ToListAsync()), a => a == "Đổi thành viên hội đồng");

        // PDR-020: từ phiếu điểm đầu tiên của hội đồng, không thay Chủ tịch/Thư ký (kể cả khi chỉ một SV có phiếu).
        await MarkScored(council.Id);
        var board = await Board(w);
        var scored = board.Councils.Single();
        Assert.True(scored.Scored);
        Assert.False(scored.CanEdit);
        Assert.Equal(CouncilRules.ScoredMessage, scored.EditBlockedReason);
        var locked = await Send(new UpdateCouncilCommand(w.Staff.Id, council.Id, Edit(scored, i => { i.ChairId = w.E.Id; i.Reason = "Thay chủ tịch"; })));
        Assert.Equal(TopicResultStatus.Conflict, locked.Status);
        Assert.Equal(CouncilRules.ScoredMessage, locked.Response.Message);
        Assert.Equal(w.B.Id, await Read(db => db.DefenseCouncils.Where(c => c.Id == council.Id).Select(c => c.ChairId).SingleAsync()));
    }

    // ---------- PDR-019: hủy lịch đã công bố ----------

    [Fact]
    public async Task CancellingBeforeScoresKeepsTheScheduleInHistoryAndFreesTheTopic()
    {
        var w = await NewWorld();
        var draft = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        Assert.Equal(CouncilRules.NotPublishedMessage, (await Send(new CancelCouncilCommand(w.Staff.Id, draft.Id, new CouncilReasonInputDto { Reason = "x" }))).Response.Message);
        await Publish(w, draft.Id);
        await Assert.ThrowsAsync<ValidationException>(() => Send(new CancelCouncilCommand(w.Staff.Id, draft.Id, new CouncilReasonInputDto { Reason = " " })));

        var supervisorBefore = await Notices(w.A.Id);
        var cancelled = await Send(new CancelCouncilCommand(w.Staff.Id, draft.Id, new CouncilReasonInputDto { Reason = "Hội đồng không đủ người" }));
        Assert.Equal(TopicResultStatus.Ok, cancelled.Status);
        var dto = cancelled.Response.Data!;
        Assert.Equal("Đã hủy", dto.Status);
        Assert.Equal("Hội đồng không đủ người", dto.CancelReason);
        Assert.False(dto.CanDelete);
        Assert.Equal("cancelled", Assert.Single(dto.Slots).Status);
        Assert.Equal(supervisorBefore + 1, await Notices(w.A.Id));
        Assert.Equal(1, await Read(db => db.DefenseCouncils.CountAsync()));
        // Lịch hủy không còn hiệu lực: sinh viên không còn thấy lịch, giảng viên hội đồng vẫn tra cứu được.
        Assert.Null((await Send(new GetTopicQuery(w.T[0], w.Members[w.T[0]][0], ViewerRole.Student))).Response.Data!.Defense);
        Assert.Equal("Đã hủy", (await Send(new ListMyCouncilsQuery(w.B.Id, null))).Response.Data!.Councils.Single().Status);

        // Hủy lặp bị từ chối; đề tài được xếp lại vào hội đồng mới (chỉ một lượt có hiệu lực, PDR-016).
        Assert.Equal(TopicResultStatus.Conflict, (await Send(new CancelCouncilCommand(w.Staff.Id, draft.Id, new CouncilReasonInputDto { Reason = "lặp" }))).Status);
        Assert.Equal(TopicResultStatus.Conflict, (await Send(new DeleteCouncilCommand(draft.Id))).Status);
        await Created(w, Input(w, "Hội đồng 2", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        Assert.Equal(1, await Read(db => db.DefenseSlots.CountAsync(s => s.TopicId == w.T[0] && s.Status == DefenseSlotStatus.Active)));
        Assert.Equal(2, await Read(db => db.DefenseSlots.CountAsync(s => s.TopicId == w.T[0])));
    }

    [Fact]
    public async Task CancellingAfterAScoreIsBlocked()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        await Publish(w, council.Id);
        await MarkScored(council.Id);
        var result = await Send(new CancelCouncilCommand(w.Staff.Id, council.Id, new CouncilReasonInputDto { Reason = "Đổi ý" }));
        Assert.Equal(TopicResultStatus.Conflict, result.Status);
        Assert.Equal(CouncilRules.ScoredMessage, result.Response.Message);
        Assert.Equal(CouncilStatus.Published, await Read(db => db.DefenseCouncils.Select(c => c.Status).SingleAsync()));
    }

    // ---------- PDR-018: đính chính sau điểm ----------

    [Fact]
    public async Task CorrectionsAreOnlyForScoredSchedulesAndKeepTheOriginal()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        var input = new CouncilCorrectionInputDto { Content = "Phòng thực tế là B4.12A", Reason = "Ghi nhầm phòng" };
        Assert.Equal(CouncilRules.CorrectionNotPublishedMessage, (await Send(new AddCouncilCorrectionCommand(w.Staff.Id, council.Id, input))).Response.Message);
        await Publish(w, council.Id);
        Assert.Equal(CouncilRules.CorrectionBeforeScoreMessage, (await Send(new AddCouncilCorrectionCommand(w.Staff.Id, council.Id, input))).Response.Message);

        await MarkScored(council.Id);
        var corrected = await Send(new AddCouncilCorrectionCommand(w.Staff.Id, council.Id, input));
        Assert.Equal(TopicResultStatus.Ok, corrected.Status);
        Assert.Equal("Phòng thực tế là B4.12A", Assert.Single(corrected.Response.Data!.Corrections).Content);
        Assert.Equal("B4.12", corrected.Response.Data.Room);
        Assert.True(corrected.Response.Data.CanCorrect);

        var defense = (await Send(new GetTopicQuery(w.T[0], w.Members[w.T[0]][1], ViewerRole.Student))).Response.Data!.Defense!;
        Assert.Equal("B4.12", defense.Room);
        Assert.Equal("Ghi nhầm phòng", Assert.Single(defense.Corrections).Reason);
        Assert.Contains("Đính chính lịch Hội đồng 1", await Read(db => db.Notifications.Where(n => n.RecipientUserId == w.A.Id).OrderByDescending(n => n.CreatedAt).Select(n => n.Text).FirstAsync()));
        await Assert.ThrowsAsync<ValidationException>(() => Send(new AddCouncilCorrectionCommand(w.Staff.Id, council.Id, new CouncilCorrectionInputDto { Content = "x" })));
    }

    // ---------- PDR-030 và tài khoản ----------

    [Fact]
    public async Task CouncilMembersCannotBeRemovedFromTheRoundAndAreTreatedAsHavingData()
    {
        var w = await NewWorld();
        await Created(w, Input(w, "Hội đồng 1", w.D, w.E, "B4.12"));
        var removal = await Send(new RemoveParticipantCommand(w.RoundId, "lecturers", w.E.Id));
        Assert.Equal(RoundResultStatus.Conflict, removal.Status);
        Assert.Equal("Giảng viên đang thuộc hội đồng bảo vệ trong đợt nên không gỡ được khỏi đợt.", removal.Response.Message);

        var withData = await Read(async db => await new UserRepository(db).GetUserIdsWithRelatedDataAsync([w.D.Id, w.E.Id, w.Outside.Id]));
        Assert.Contains(w.D.Id, withData);
        Assert.Contains(w.E.Id, withData);
        Assert.DoesNotContain(w.Outside.Id, withData);
    }

    [Fact]
    public async Task WritesAreRejectedWhenTheRoundIsNoLongerRunning()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        await Db(async db => { (await db.ThesisRounds.SingleAsync(r => r.Id == w.RoundId)).Status = RoundStatus.Finished; await db.SaveChangesAsync(); });
        Assert.Equal(CouncilRules.RoundNotRunningMessage, (await Create(w, Input(w, "Hội đồng 2", w.D, w.E, "B4.14"))).Response.Message);
        var board = await Board(w);
        Assert.False(board.Councils.Single().CanEdit);
        Assert.False(board.Councils.Single().CanPublish);
        var publish = await Publish(w, council.Id);
        Assert.False(publish.Results.Single().Ok);
    }

    [Fact]
    public async Task APublishedScheduleCannotBeCancelledAfterTheRoundEnds()
    {
        var w = await NewWorld();
        var council = await Created(w, Input(w, "Hội đồng 1", w.B, w.C, "B4.12", (w.T[0], "07:30", "08:15")));
        await Publish(w, council.Id);
        await Db(async db => { (await db.ThesisRounds.SingleAsync(r => r.Id == w.RoundId)).Status = RoundStatus.Finished; await db.SaveChangesAsync(); });
        var result = await Send(new CancelCouncilCommand(w.Staff.Id, council.Id, new CouncilReasonInputDto { Reason = "Muộn" }));
        Assert.Equal(TopicResultStatus.Conflict, result.Status);
        Assert.Equal(CouncilRules.RoundNotRunningMessage, result.Response.Message);
        Assert.False((await Board(w)).Councils.Single().CanCancel);
    }
}

public sealed class CouncilRulesTests
{
    private static TimeOnly T(string value) => TimeOnly.Parse(value);

    [Theory]
    [InlineData("07:30", "08:15", "08:15", "09:00", false)] // liền kề
    [InlineData("07:30", "08:15", "08:14", "09:00", true)] // giao nhau 1 phút
    [InlineData("07:30", "09:00", "08:00", "08:30", true)] // bao trùm
    [InlineData("08:00", "08:30", "07:30", "09:00", true)] // nằm trong
    [InlineData("07:30", "08:15", "07:30", "08:15", true)] // trùng hoàn toàn
    [InlineData("09:00", "09:45", "07:30", "09:00", false)] // liền kề phía trước
    public void OverlapIsStrictAtBoundaries(string a1, string a2, string b1, string b2, bool expected) =>
        Assert.Equal(expected, CouncilRules.Overlaps(T(a1), T(a2), T(b1), T(b2)));

    [Theory]
    [InlineData("07:30", true)]
    [InlineData("23:59", true)]
    [InlineData("00:00", true)]
    [InlineData("7:30", false)]
    [InlineData("24:00", false)]
    [InlineData("07:60", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void TimesAreHoursAndMinutes(string? value, bool ok) => Assert.Equal(ok, CouncilRules.TryParseTime(value, out _));

    [Fact]
    public void RoomsAreComparedIgnoringCaseAndExtraSpaces() =>
        Assert.Equal(DefenseCouncil.NormalizeRoom(" B4.12 "), DefenseCouncil.NormalizeRoom("b4.12"));
}
