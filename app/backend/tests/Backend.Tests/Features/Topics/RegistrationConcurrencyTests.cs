using Backend.Application;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Topics;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace Backend.Tests;

// Chỉ chạy khi có PostgreSQL thật: biến QLKLTN_TEST_POSTGRES là chuỗi kết nối tới một máy chủ
// dùng riêng cho test (ví dụ container tạm do scripts/test-ghi-danh.ps1 dựng). Không trỏ vào
// database dùng chung: mỗi lớp test tạo một database mới tên qlkltn_test_* rồi xóa.
public sealed class PostgresFactAttribute : FactAttribute
{
    public const string Variable = "QLKLTN_TEST_POSTGRES";

    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(Variable)))
            Skip = $"Đặt {Variable} để chạy test đồng thời trên PostgreSQL.";
    }
}

// P03-S02 — verification "test tích hợp đồng thời" (PDR-047, PDR-054): nhiều request thật song song
// trên PostgreSQL, mỗi request một DbContext/kết nối riêng, áp dụng đúng migration của ứng dụng.
public sealed class RegistrationConcurrencyTests : IAsyncLifetime
{
    // Trong cửa sổ đăng ký của lịch mốc Dated(): "SV đăng ký" 2026-09-08..13.
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);

    private readonly ManualTimeProvider _clock = new(DuringSubmission);
    private string _database = string.Empty;
    private string _adminConnection = string.Empty;
    private ServiceProvider? _provider;

    public async Task InitializeAsync()
    {
        var server = Environment.GetEnvironmentVariable(PostgresFactAttribute.Variable);
        if (string.IsNullOrWhiteSpace(server)) return;

        _database = $"qlkltn_test_{Guid.NewGuid():N}"[..30];
        _adminConnection = new NpgsqlConnectionStringBuilder(server) { Database = "postgres", Pooling = false }.ConnectionString;
        var testConnection = new NpgsqlConnectionStringBuilder(server) { Database = _database, MaxPoolSize = 50 }.ConnectionString;

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<TimeProvider>(_clock);
        services.AddApplicationServices();
        services.AddDbContext<ApplicationDbContext>(o => o.UseNpgsql(testConnection));
        services.AddScoped<IRoundRepository, RoundRepository>();
        services.AddScoped<ITopicRepository, TopicRepository>();
        services.AddScoped<IGroupRepository, GroupRepository>();
        _provider = services.BuildServiceProvider();

        // Migration thật của ứng dụng (tạo database rồi áp dụng), để kiểm đúng tên chỉ mục duy nhất.
        using var scope = _provider.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (_provider is null) return;
        await _provider.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await using var admin = new NpgsqlConnection(_adminConnection);
        await admin.OpenAsync();
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_database}\" WITH (FORCE)", admin);
        await drop.ExecuteNonQueryAsync();
    }

    private ServiceProvider Provider => _provider!;

    private async Task<T> Send<T>(IRequest<T> request)
    {
        using var scope = Provider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    private async Task<T> Query<T>(Func<ApplicationDbContext, Task<T>> read)
    {
        using var scope = Provider.CreateScope();
        return await read(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    // Mọi request chờ cùng một tín hiệu rồi chạy song song trên kết nối riêng.
    private static async Task<T[]> Race<T>(params Func<Task<T>>[] actions)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = actions.Select(async action => { await gate.Task; return await action(); }).ToArray();
        gate.SetResult();
        return await Task.WhenAll(tasks);
    }

    private sealed record Person(Guid Id, string Code);

    private sealed record World(Guid RoundId, Person[] Students, Guid[] Topics);

    private async Task<Person> Seed(UserRole role, string code)
    {
        using var scope = Provider.CreateScope();
        var id = await RoundWorkflowTests.SeedUser(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            role, code, $"Người {code}", role == UserRole.Student ? "KTPM2023" : "CNPM");
        return new Person(id, code);
    }

    private async Task<World> PublishedRound(int students, int topics)
    {
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var lecturer = await Seed(UserRole.Lecturer, $"GV{s}");
        var people = new List<Person>();
        for (var i = 0; i < students; i++) people.Add(await Seed(UserRole.Student, $"SV{s}{i:D2}"));
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [lecturer.Code]));
        await Send(new AddParticipantsCommand(round.Id, "students", people.Select(x => x.Code).ToList()));
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
        return new World(round.Id, people.ToArray(), ids.ToArray());
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
                AllowLate = ThesisRound.HasLateToggle(key) ? true : null
            }).ToList()
        };
    }

    private Func<Task<TopicResult<MyRegistrationDto>>> Register(Person student, Guid topicId, params string[] members) =>
        () => Send(new RegisterTopicCommand(student.Id, topicId, members));

    private Func<Task<TopicResult<MyRegistrationDto>>> Cancel(Person student, Guid topicId) =>
        () => Send(new CancelRegistrationCommand(student.Id, topicId));

    // Bất biến của PDR-054 sau mọi cuộc đua: một đề tài tối đa một nhóm và một lần ghi danh đang hiệu lực,
    // một sinh viên tối đa một nhóm trong đợt, một nhóm tối đa một đề tài.
    private async Task AssertInvariants(Guid roundId)
    {
        var activePerTopic = await Query(db => db.TopicRegistrations.Where(r => r.CancelledAt == null)
            .GroupBy(r => r.TopicId).Select(g => g.Count()).ToListAsync());
        Assert.All(activePerTopic, c => Assert.Equal(1, c));
        var groupsPerStudent = await Query(db => db.GroupMembers.Where(m => m.RoundId == roundId)
            .GroupBy(m => m.StudentId).Select(g => g.Count()).ToListAsync());
        Assert.All(groupsPerStudent, c => Assert.Equal(1, c));
        var topicsPerGroup = await Query(db => db.ThesisTopics.Where(t => t.GroupId != null)
            .GroupBy(t => t.GroupId).Select(g => g.Count()).ToListAsync());
        Assert.All(topicsPerGroup, c => Assert.Equal(1, c));
        // Đề tài có nhóm thì đúng là Đã đăng ký và khớp lần ghi danh đang hiệu lực.
        var mismatched = await Query(db => db.ThesisTopics.CountAsync(t =>
            (t.GroupId != null) != (t.Status == TopicStatus.Registered) ||
            (t.GroupId != null && !db.TopicRegistrations.Any(r => r.TopicId == t.Id && r.GroupId == t.GroupId && r.CancelledAt == null))));
        Assert.Equal(0, mismatched);
    }

    [PostgresFact]
    public async Task OfManyGroupsRacingForOneTopicExactlyOneWinsAndLosersSaveNothing()
    {
        var w = await PublishedRound(students: 8, topics: 1);

        var results = await Race(w.Students.Select(s => Register(s, w.Topics[0])).ToArray());

        Assert.Single(results, r => r.Status == TopicResultStatus.Ok);
        var losers = results.Where(r => r.Status != TopicResultStatus.Ok).ToList();
        Assert.Equal(7, losers.Count);
        Assert.All(losers, r =>
        {
            Assert.Equal(TopicResultStatus.Conflict, r.Status);
            Assert.Equal(TopicRules.TopicTakenMessage, r.Response.Message);
        });
        Assert.Equal(1, await Query(db => db.ThesisGroups.CountAsync(g => g.RoundId == w.RoundId)));
        Assert.Equal(1, await Query(db => db.TopicRegistrations.CountAsync()));
        Assert.Equal(1, await Query(db => db.TopicHistoryEntries.CountAsync(h => h.TopicId == w.Topics[0] && h.Action == "Ghi danh")));
        await AssertInvariants(w.RoundId);

        // Nhóm thua làm mới danh sách thì thấy đề tài đã có nhóm và vẫn ghi danh được đề tài khác.
        var loserIndex = Array.FindIndex(results, r => r.Status != TopicResultStatus.Ok);
        var loserView = (await Send(new GetMyRegistrationQuery(w.Students[loserIndex].Id, w.RoundId))).Response.Data!;
        Assert.Null(loserView.Group);
        Assert.True(loserView.RegistrationOpen);
    }

    [PostgresFact]
    public async Task TwoRepresentativesPullingTheSameStudentLeaveThatStudentInExactlyOneGroup()
    {
        var w = await PublishedRound(students: 3, topics: 2);
        var (a, b, shared) = (w.Students[0], w.Students[1], w.Students[2]);

        var results = await Race(Register(a, w.Topics[0], shared.Code), Register(b, w.Topics[1], shared.Code));

        var winner = Assert.Single(results, r => r.Status == TopicResultStatus.Ok);
        var loser = Assert.Single(results, r => r.Status != TopicResultStatus.Ok);
        Assert.Contains(loser.Status, new[] { TopicResultStatus.Conflict, TopicResultStatus.Invalid });
        Assert.Equal(1, await Query(db => db.GroupMembers.CountAsync(m => m.StudentId == shared.Id)));
        Assert.Equal(1, await Query(db => db.ThesisTopics.CountAsync(t => t.GroupId != null)));
        await AssertInvariants(w.RoundId);

        // Sau tải lại, đại diện và thành viên của nhóm thắng không đổi.
        var reloaded = (await Send(new GetMyRegistrationQuery(shared.Id, w.RoundId))).Response.Data!;
        Assert.Equal(winner.Response.Data!.Group!.Id, reloaded.Group!.Id);
        Assert.Equal(winner.Response.Data.Group.RepresentativeId, reloaded.Group.RepresentativeId);
        Assert.Equal(2, reloaded.Group.Members.Count);
    }

    [PostgresFact]
    public async Task ADoubleSubmitForTwoTopicsCreatesOneGroupHoldingOneTopic()
    {
        var w = await PublishedRound(students: 2, topics: 2);
        var (rep, partner) = (w.Students[0], w.Students[1]);

        var results = await Race(Register(rep, w.Topics[0], partner.Code), Register(rep, w.Topics[1], partner.Code));

        Assert.Single(results, r => r.Status == TopicResultStatus.Ok);
        Assert.Single(results, r => r.Status == TopicResultStatus.Conflict);
        Assert.Equal(1, await Query(db => db.ThesisGroups.CountAsync(g => g.RoundId == w.RoundId)));
        Assert.Equal(1, await Query(db => db.TopicRegistrations.CountAsync()));
        await AssertInvariants(w.RoundId);
    }

    [PostgresFact]
    public async Task TwoMembersCancellingAtOnceTakeEffectOnce()
    {
        var w = await PublishedRound(students: 2, topics: 1);
        var (rep, partner) = (w.Students[0], w.Students[1]);
        var group = (await Register(rep, w.Topics[0], partner.Code)()).Response.Data!.Group!;
        _clock.Advance(TimeSpan.FromMinutes(1));

        var results = await Race(Cancel(rep, w.Topics[0]), Cancel(partner, w.Topics[0]), Cancel(partner, w.Topics[0]));

        Assert.Single(results, r => r.Status == TopicResultStatus.Ok);
        Assert.All(results.Where(r => r.Status != TopicResultStatus.Ok), r =>
        {
            Assert.Equal(TopicResultStatus.Conflict, r.Status);
            Assert.Equal(TopicRules.NotRegisteredMessage, r.Response.Message);
        });
        Assert.Equal(1, await Query(db => db.TopicHistoryEntries.CountAsync(h => h.TopicId == w.Topics[0] && h.Action == "Hủy ghi danh")));
        var registration = await Query(db => db.TopicRegistrations.SingleAsync());
        Assert.NotNull(registration.CancelledAt);
        var topic = await Query(db => db.ThesisTopics.AsNoTracking().SingleAsync(t => t.Id == w.Topics[0]));
        Assert.Null(topic.GroupId);
        Assert.Equal(TopicStatus.NotRegistered, topic.Status);

        // Nhóm giữ nguyên thành viên/đại diện; cả hai thành viên tra cứu được lần ghi danh cũ.
        foreach (var member in new[] { rep, partner })
        {
            var view = (await Send(new GetMyRegistrationQuery(member.Id, w.RoundId))).Response.Data!;
            Assert.Equal(group.Id, view.Group!.Id);
            Assert.Equal(rep.Id, view.Group.RepresentativeId);
            Assert.Equal(2, view.Group.Members.Count);
            Assert.Null(view.Topic);
            Assert.NotNull(Assert.Single(view.History).CancelledAt);
        }
        await AssertInvariants(w.RoundId);
    }

    [PostgresFact]
    public async Task CancellingWhileAnotherGroupRegistersNeverGivesTheTopicTwoGroups()
    {
        var w = await PublishedRound(students: 3, topics: 1);
        var (rep, partner, other) = (w.Students[0], w.Students[1], w.Students[2]);
        await Register(rep, w.Topics[0], partner.Code)();
        _clock.Advance(TimeSpan.FromMinutes(1));

        var results = await Race(Cancel(partner, w.Topics[0]), Register(other, w.Topics[0]));

        Assert.Equal(TopicResultStatus.Ok, results[0].Status);
        // Ghi danh của nhóm khác thắng hoặc thua tùy thứ tự, nhưng bất biến luôn giữ.
        Assert.Contains(results[1].Status, new[] { TopicResultStatus.Ok, TopicResultStatus.Conflict });
        await AssertInvariants(w.RoundId);
    }
}
