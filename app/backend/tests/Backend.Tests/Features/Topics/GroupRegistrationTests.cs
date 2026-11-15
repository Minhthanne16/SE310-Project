using Backend.Application;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Topics;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

// P03-S02: ghi danh nhóm vào đề tài công bố và hủy ghi danh (BUSINESS_RULES, PDR-047, PDR-054),
// chạy handler thật trên repository EF Core thật (SQLite trong bộ nhớ).
public sealed class GroupRegistrationTests : IDisposable
{
    // Mốc "GV gửi đề tài" 2026-09-01..06, "SV đăng ký" 2026-09-08..13.
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset LastRegistrationDay = new(2026, 9, 13, 16, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset AfterRegistration = new(2026, 9, 14, 3, 0, 0, TimeSpan.Zero);

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;
    private readonly ManualTimeProvider _clock = new(DuringSubmission);

    public GroupRegistrationTests()
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
        using var scope = _provider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    private sealed record Person(Guid Id, string Code);

    private sealed record World(Guid RoundId, Person Lecturer, Person[] Students, Person Outsider, Guid[] Topics);

    private async Task<Person> Seed(UserRole role, string code)
    {
        using var scope = _provider.CreateScope();
        var id = await RoundWorkflowTests.SeedUser(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            role, code, $"Người {code}", role == UserRole.Student ? "KTPM2023" : "CNPM");
        return new Person(id, code);
    }

    // Đợt đang diễn ra có 1 GV, 4 SV và 2 đề tài đã công bố; thêm 1 SV ngoài đợt.
    private async Task<World> PublishedRound(int topics = 2)
    {
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var lecturer = await Seed(UserRole.Lecturer, $"GV{s}");
        var students = new[] { await Seed(UserRole.Student, $"SV{s}1"), await Seed(UserRole.Student, $"SV{s}2"),
            await Seed(UserRole.Student, $"SV{s}3"), await Seed(UserRole.Student, $"SV{s}4") };
        var outsider = await Seed(UserRole.Student, $"SV{s}9");
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [lecturer.Code]));
        await Send(new AddParticipantsCommand(round.Id, "students", students.Select(x => x.Code).ToList()));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(round.Id))).Status);
        var ids = new List<Guid>();
        for (var i = 1; i <= topics; i++)
            ids.Add((await Send(new CreateTopicCommand(lecturer.Id, new TopicInputDto
            {
                RoundId = round.Id, Title = $"Đề tài {i}", Field = "CNPM", Description = "Mô tả"
            }))).Response.Data!.Id);
        _clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new PublishRoundTopicsCommand(round.Id))).Status);
        _clock.Advance(TimeSpan.FromMinutes(1));
        return new World(round.Id, lecturer, students, outsider, ids.ToArray());
    }

    private static RoundMilestonesInputDto Dated()
    {
        var start = new DateOnly(2026, 9, 1);
        return new RoundMilestonesInputDto
        {
            Milestones = RoundRules.OrderedKeys.Select((key, i) => new RoundMilestoneInputDto
            {
                Key = RoundRules.KeyName(key),
                StartDate = start.AddDays(i * 7).ToString("yyyy-MM-dd"),
                EndDate = start.AddDays(i * 7 + 5).ToString("yyyy-MM-dd"),
                NotifyAudience = "Tất cả",
                AllowLate = ThesisRound.HasLateToggle(key) ? true : null,
                // PDR-041: mốc bật nộp trễ phải có hạn trễ sau hạn thường.
                LateEndDate = ThesisRound.HasLateToggle(key) ? start.AddDays(i * 7 + 6).ToString("yyyy-MM-dd") : null
            }).ToList()
        };
    }

    private Task<TopicResult<MyRegistrationDto>> Register(Person student, Guid topicId, params string[] members) =>
        Send(new RegisterTopicCommand(student.Id, topicId, members));

    // Đồng hồ chạy thêm một phút để lịch sử hủy đứng sau lịch sử ghi danh.
    private Task<TopicResult<MyRegistrationDto>> Cancel(Person student, Guid topicId)
    {
        _clock.Advance(TimeSpan.FromMinutes(1));
        return Send(new CancelRegistrationCommand(student.Id, topicId));
    }

    private async Task<MyRegistrationDto> Mine(Person student, Guid roundId) =>
        (await Send(new GetMyRegistrationQuery(student.Id, roundId))).Response.Data!;

    [Fact]
    public async Task AStudentRegistersAloneAndBecomesTheRepresentative()
    {
        var w = await PublishedRound();
        var me = w.Students[0];

        var result = await Register(me, w.Topics[0]);

        Assert.Equal(TopicResultStatus.Ok, result.Status);
        var data = result.Response.Data!;
        var member = Assert.Single(data.Group!.Members);
        Assert.Equal(me.Id, member.Id);
        Assert.True(member.Representative);
        Assert.Equal("Đã đăng ký", data.Topic!.Status);
        Assert.True(data.CanCancel);

        var staff = (await Send(new ListRoundTopicsQuery(w.RoundId))).Response.Data!;
        var topic = staff.Items.Single(t => t.Id == w.Topics[0]);
        Assert.Equal("Đã đăng ký", topic.Status);
        Assert.Equal(me.Code, Assert.Single(topic.Group).Code);
        // Sinh viên xem danh sách công bố thấy đề tài đã có nhóm nhưng không thấy thành viên nhóm khác.
        var published = (await Send(new ListPublishedTopicsQuery(w.Students[1].Id, w.RoundId))).Response.Data!;
        Assert.Empty(published.Items.Single(t => t.Id == w.Topics[0]).Group);
    }

    [Fact]
    public async Task TheRepresentativeAddsASecondMemberByStudentCodeWhoIsNotified()
    {
        var w = await PublishedRound();
        var (rep, partner) = (w.Students[0], w.Students[1]);

        var result = await Register(rep, w.Topics[0], $" {partner.Code.ToLowerInvariant()} ");

        Assert.Equal(TopicResultStatus.Ok, result.Status);
        var partnerView = await Mine(partner, w.RoundId);
        Assert.Equal(result.Response.Data!.Group!.Id, partnerView.Group!.Id);
        Assert.Equal(rep.Id, partnerView.Group.RepresentativeId);
        Assert.Equal(w.Topics[0], partnerView.Topic!.Id);

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var note = await db.Notifications.SingleAsync(n => n.RecipientUserId == partner.Id && n.Text.Contains("đã thêm bạn vào nhóm"));
        Assert.Equal(rep.Id, note.SenderUserId);
    }

    [Theory]
    [InlineData("khong-ton-tai", "Mã sinh viên khong-ton-tai không tồn tại hoặc không thuộc đợt.")]
    [InlineData("outsider", "không tồn tại hoặc không thuộc đợt")]
    [InlineData("lecturer", "không tồn tại hoặc không thuộc đợt")]
    [InlineData("self", "Không nhập mã của chính bạn")]
    [InlineData("grouped", "đã có nhóm trong đợt")]
    [InlineData("two", "Nhóm có tối đa 2 sinh viên")]
    public async Task InvalidMembersAreRejectedWithoutCreatingAnything(string kind, string message)
    {
        var w = await PublishedRound();
        var me = w.Students[0];
        if (kind == "grouped") await Register(w.Students[2], w.Topics[1], w.Students[1].Code);
        string[] codes = kind switch
        {
            "outsider" => [w.Outsider.Code],
            "lecturer" => [w.Lecturer.Code],
            "self" => [me.Code],
            "grouped" => [w.Students[1].Code],
            "two" => [w.Students[1].Code, w.Students[3].Code],
            _ => [kind]
        };

        var result = await Register(me, w.Topics[0], codes);

        Assert.Equal(TopicResultStatus.Invalid, result.Status);
        Assert.Contains(message, result.Response.Message);
        Assert.Null((await Mine(me, w.RoundId)).Group);
        Assert.Equal("Chưa đăng ký", (await Send(new ListRoundTopicsQuery(w.RoundId))).Response.Data!.Items.Single(t => t.Id == w.Topics[0]).Status);
    }

    [Fact]
    public async Task ATopicTakenByAnotherGroupCannotBeRegisteredAgain()
    {
        var w = await PublishedRound();
        await Register(w.Students[0], w.Topics[0]);

        var late = await Register(w.Students[1], w.Topics[0]);

        Assert.Equal(TopicResultStatus.Conflict, late.Status);
        Assert.Equal(TopicRules.TopicTakenMessage, late.Response.Message);
        Assert.Null((await Mine(w.Students[1], w.RoundId)).Group);
    }

    [Fact]
    public async Task TheLoserOfARaceSavesNothing()
    {
        var w = await PublishedRound();
        await Register(w.Students[0], w.Topics[0]);

        // Mô phỏng request thua cuộc: đã qua bước kiểm tra nhưng đề tài vừa bị nhóm khác nhận.
        using var scope = _provider.CreateScope();
        var groups = scope.ServiceProvider.GetRequiredService<IGroupRepository>();
        var loser = w.Students[1];
        var group = new ThesisGroup { RoundId = w.RoundId, RepresentativeId = loser.Id };
        group.Members.Add(new GroupMember { GroupId = group.Id, RoundId = w.RoundId, StudentId = loser.Id });
        var outcome = await groups.RegisterAsync(group, true, w.Topics[0],
            new TopicRegistration { TopicId = w.Topics[0], GroupId = group.Id, RegisteredById = loser.Id },
            new TopicHistoryEntry { TopicId = w.Topics[0], Category = "Nhóm", Action = "Ghi danh" }, []);

        Assert.Equal(RegisterOutcome.TopicTaken, outcome);
        Assert.Null(await groups.GetByStudentAsync(w.RoundId, loser.Id));
    }

    [Fact]
    public async Task AGroupHoldsOnlyOneTopic()
    {
        var w = await PublishedRound();
        await Register(w.Students[0], w.Topics[0]);

        var second = await Register(w.Students[0], w.Topics[1]);

        Assert.Equal(TopicResultStatus.Conflict, second.Status);
        Assert.Equal(TopicRules.GroupHasTopicMessage, second.Response.Message);
    }

    [Fact]
    public async Task AnyMemberCancelsForTheWholeGroupWhichStaysTheSame()
    {
        var w = await PublishedRound();
        var (rep, partner) = (w.Students[0], w.Students[1]);
        var group = (await Register(rep, w.Topics[0], partner.Code)).Response.Data!.Group!;

        var cancelled = await Cancel(partner, w.Topics[0]);

        Assert.Equal(TopicResultStatus.Ok, cancelled.Status);
        var after = cancelled.Response.Data!;
        Assert.Null(after.Topic);
        Assert.Equal(group.Id, after.Group!.Id);
        Assert.Equal(rep.Id, after.Group.RepresentativeId);
        Assert.Equal(2, after.Group.Members.Count);
        Assert.Equal("Chưa đăng ký", (await Send(new ListRoundTopicsQuery(w.RoundId))).Response.Data!.Items.Single(t => t.Id == w.Topics[0]).Status);

        var history = Assert.Single(after.History);
        Assert.Equal(w.Topics[0], history.TopicId);
        Assert.Equal($"Người {partner.Code}", history.CancelledBy);
        Assert.NotNull(history.CancelledAt);

        // Hủy lặp không đổi gì.
        var again = await Cancel(rep, w.Topics[0]);
        Assert.Equal(TopicResultStatus.Conflict, again.Status);
        Assert.Single((await Mine(rep, w.RoundId)).History);
    }

    [Fact]
    public async Task OnlyTheRepresentativeRegistersAgainWithTheSameMembers()
    {
        var w = await PublishedRound();
        var (rep, partner) = (w.Students[0], w.Students[1]);
        await Register(rep, w.Topics[0], partner.Code);
        await Cancel(rep, w.Topics[0]);

        var byPartner = await Register(partner, w.Topics[1]);
        Assert.Equal(TopicResultStatus.Forbidden, byPartner.Status);
        Assert.Equal(TopicRules.OnlyRepresentativeMessage, byPartner.Response.Message);

        var changeMembers = await Register(rep, w.Topics[1], w.Students[2].Code);
        Assert.Equal(TopicResultStatus.Invalid, changeMembers.Status);

        _clock.Advance(TimeSpan.FromMinutes(1));
        var again = await Register(rep, w.Topics[1], partner.Code);
        Assert.Equal(TopicResultStatus.Ok, again.Status);
        Assert.Equal(w.Topics[1], again.Response.Data!.Topic!.Id);
        Assert.Equal(2, again.Response.Data.History.Count);
        Assert.Null(again.Response.Data.History[0].CancelledAt);

        var topicHistory = (await Send(new GetTopicQuery(w.Topics[0], Guid.Empty, ViewerRole.AcademicAffairs))).Response.Data!.History;
        Assert.Equal(["Hủy ghi danh", "Ghi danh"], topicHistory.Take(2).Select(h => h.Action));
        Assert.All(topicHistory.Take(2), h => Assert.Equal("Nhóm", h.Category));
    }

    [Fact]
    public async Task RegistrationIsOpenFromPublishingToTheEndOfTheRegistrationMilestone()
    {
        var w = await PublishedRound();

        _clock.Set(LastRegistrationDay);
        Assert.Equal(TopicResultStatus.Ok, (await Register(w.Students[0], w.Topics[0])).Status);
        Assert.True((await Mine(w.Students[0], w.RoundId)).RegistrationOpen);

        _clock.Set(AfterRegistration);
        var late = await Register(w.Students[1], w.Topics[1]);
        Assert.Equal(TopicResultStatus.Conflict, late.Status);
        Assert.Equal(TopicRules.RegistrationClosedMessage, late.Response.Message);
        var cancel = await Cancel(w.Students[0], w.Topics[0]);
        Assert.Equal(TopicResultStatus.Conflict, cancel.Status);
        var mine = await Mine(w.Students[0], w.RoundId);
        Assert.False(mine.CanCancel);
        // Hết hạn đăng ký: đề tài có nhóm thành Đang thực hiện (PDR-049).
        Assert.Equal("Đang thực hiện", mine.Topic!.Status);
    }

    [Fact]
    public async Task RegistrationNeedsAPublishedListAndAStudentOfTheRound()
    {
        var w = await PublishedRound();

        Assert.Equal(TopicResultStatus.Forbidden, (await Register(w.Outsider, w.Topics[0])).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Register(w.Students[0], Guid.NewGuid())).Status);
        Assert.Equal(TopicResultStatus.Forbidden, (await Send(new GetMyRegistrationQuery(w.Outsider.Id, w.RoundId))).Status);
    }

    [Fact]
    public async Task StudentsInAGroupCannotBeRemovedFromTheRound()
    {
        var w = await PublishedRound();
        await Register(w.Students[0], w.Topics[0], w.Students[1].Code);

        var round = (await Send(new GetRoundQuery(w.RoundId))).Response.Data!;
        Assert.Equal(new[] { w.Students[0].Id, w.Students[1].Id }.Order(), round.LockedStudentIds.Order());

        var removed = await Send(new RemoveParticipantCommand(w.RoundId, "students", w.Students[1].Id));
        Assert.Equal(RoundResultStatus.Conflict, removed.Status);
        Assert.Equal(RoundResultStatus.Ok, (await Send(new RemoveParticipantCommand(w.RoundId, "students", w.Students[3].Id))).Status);
    }

    [Fact]
    public async Task TheSupervisorCannotEditARegisteredTopic()
    {
        var w = await PublishedRound();
        await Register(w.Students[0], w.Topics[0]);

        var mine = (await Send(new ListMyTopicsQuery(w.Lecturer.Id, w.RoundId))).Response.Data!;
        var topic = mine.Items.Single(t => t.Id == w.Topics[0]);
        Assert.Equal("none", topic.CanEdit);
        Assert.Equal(w.Students[0].Code, Assert.Single(topic.Group).Code);
    }

    [Fact]
    public async Task DeletingARoundRemovesItsGroupsAndRegistrations()
    {
        var w = await PublishedRound();
        await Register(w.Students[0], w.Topics[0], w.Students[1].Code);

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.ThesisRounds.Where(r => r.Id == w.RoundId).ExecuteDeleteAsync();

        Assert.Equal(0, await db.ThesisGroups.CountAsync(g => g.RoundId == w.RoundId));
        Assert.Equal(0, await db.GroupMembers.CountAsync(m => m.RoundId == w.RoundId));
        Assert.Equal(0, await db.TopicRegistrations.CountAsync());
    }
}
