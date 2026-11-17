using Backend.Application;
using Backend.Application.Common.Storage;
using Backend.Application.Councils;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Councils;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Submissions;
using Backend.Infrastructure.Repositories.Topics;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace Backend.Tests;

// P06 — đồng thời trên PostgreSQL thật: hai Giáo vụ lưu lịch trùng phòng/giảng viên/đề tài cùng lúc (PDR-014/015/016),
// sửa hội đồng chạy song song với phiếu điểm đầu tiên (PDR-020), ràng buộc database của migration AddDefenseCouncils.
// Chỉ chạy khi đặt QLKLTN_TEST_POSTGRES (xem RegistrationConcurrencyTests, app/scripts/test-ghi-danh.ps1).
public sealed class CouncilConcurrencyTests : IAsyncLifetime
{
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset DuringOutline = new(2026, 9, 16, 3, 0, 0, TimeSpan.Zero);
    private const string Day = "2026-10-14";

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
        services.AddScoped<IOutlineRepository, OutlineRepository>();
        services.AddScoped<ISubmissionRepository, SubmissionRepository>();
        services.AddScoped<IReviewerRepository, ReviewerRepository>();
        services.AddScoped<ICouncilRepository, CouncilRepository>();
        services.AddSingleton<IDocumentStorage>(new InMemoryAvatarStorage());
        _provider = services.BuildServiceProvider();

        // Migration thật của ứng dụng, để kiểm đúng ràng buộc và chỉ mục của AddDefenseCouncils.
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

    private async Task<T> Send<T>(IRequest<T> request)
    {
        using var scope = _provider!.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    private async Task<T> Query<T>(Func<ApplicationDbContext, Task<T>> read)
    {
        using var scope = _provider!.CreateScope();
        return await read(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    private static async Task<T[]> Race<T>(params Func<Task<T>>[] actions)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = actions.Select(async action => { await gate.Task; return await action(); }).ToArray();
        gate.SetResult();
        return await Task.WhenAll(tasks);
    }

    private sealed record Person(Guid Id, string Code);

    // Đợt đang diễn ra với hai đề tài (GVHD A) có nhóm, đã duyệt đề cương; GV B, C, D, E ngoài vai trò hướng dẫn.
    private sealed record World(Guid RoundId, Guid T1, Guid T2, Person Staff, Person A, Person B, Person C, Person D, Person E);

    private async Task<Person> Seed(UserRole role, string code) =>
        new(await Query(db => RoundWorkflowTests.SeedUser(db, role, code, $"Người {code}", "CNPM")), code);

    private async Task<World> NewWorld()
    {
        _clock.Set(DuringSubmission);
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var staff = await Seed(UserRole.AcademicAffairs, $"GVU{s}");
        var a = await Seed(UserRole.Lecturer, $"GV{s}A");
        var b = await Seed(UserRole.Lecturer, $"GV{s}B");
        var c = await Seed(UserRole.Lecturer, $"GV{s}C");
        var d = await Seed(UserRole.Lecturer, $"GV{s}D");
        var e = await Seed(UserRole.Lecturer, $"GV{s}E");
        var students = new List<Person>();
        for (var i = 0; i < 4; i++) students.Add(await Seed(UserRole.Student, $"SV{s}{i}"));
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        await Send(new UpdateRoundMilestonesCommand(round.Id, new RoundMilestonesInputDto
        {
            Milestones = RoundRules.OrderedKeys.Select((key, i) => new RoundMilestoneInputDto
            {
                Key = RoundRules.KeyName(key),
                StartDate = new DateOnly(2026, 9, 1).AddDays(i * 7).ToString("yyyy-MM-dd"),
                EndDate = new DateOnly(2026, 9, 1).AddDays(i * 7 + 5).ToString("yyyy-MM-dd"),
                NotifyAudience = "Tất cả",
                AllowLate = ThesisRound.HasLateToggle(key) ? false : null
            }).ToList()
        }));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [a.Code, b.Code, c.Code, d.Code, e.Code]));
        await Send(new AddParticipantsCommand(round.Id, "students", students.Select(x => x.Code).ToList()));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(round.Id))).Status);
        var topics = new List<Guid>();
        for (var i = 0; i < 2; i++)
            topics.Add((await Send(new CreateTopicCommand(a.Id, new TopicInputDto
            {
                RoundId = round.Id, Title = $"Đề tài {i}", Field = "CNPM", Description = "Mô tả"
            }))).Response.Data!.Id);
        Assert.Equal(RoundResultStatus.Ok, (await Send(new PublishRoundTopicsCommand(round.Id))).Status);
        for (var i = 0; i < 2; i++)
            Assert.Equal(TopicResultStatus.Ok, (await Send(new RegisterTopicCommand(students[i * 2].Id, topics[i], [students[i * 2 + 1].Code]))).Status);
        _clock.Set(DuringOutline);
        await Query(async db =>
        {
            foreach (var topic in await db.ThesisTopics.Where(t => topics.Contains(t.Id)).ToListAsync())
            {
                topic.OutlineApprovedAt = DateTime.UtcNow;
                topic.OutlineApprovedById = a.Id;
            }
            return await db.SaveChangesAsync();
        });
        return new World(round.Id, topics[0], topics[1], staff, a, b, c, d, e);
    }

    private Func<Task<TopicResult<CouncilDto>>> Create(World w, string name, Person chair, Person secretary, string room, Guid topic,
        string start, string end) => () => Send(new CreateCouncilCommand(w.Staff.Id, new CouncilInputDto
    {
        RoundId = w.RoundId, Name = name, ChairId = chair.Id, SecretaryId = secretary.Id, Date = Day, Room = room,
        Slots = [new CouncilSlotInputDto { TopicId = topic, Start = start, End = end }]
    }));

    [PostgresFact]
    public async Task TwoStaffSavingOverlappingCouncilsInTheSameRoomOnlyOneWins()
    {
        var w = await NewWorld();
        var results = await Race(
            Create(w, "Hội đồng 1", w.B, w.C, "B4.12", w.T1, "07:30", "08:15"),
            Create(w, "Hội đồng 2", w.D, w.E, "B4.12", w.T2, "08:00", "08:45"));

        Assert.Single(results, r => r.Status == TopicResultStatus.Created);
        Assert.Single(results, r => r.Status == TopicResultStatus.Conflict
            && r.Response.Errors!.Any(e => e.StartsWith("Phòng B4.12 trùng giờ", StringComparison.Ordinal)));
        Assert.Equal(1, await Query(db => db.DefenseCouncils.CountAsync(c => c.RoundId == w.RoundId)));
    }

    [PostgresFact]
    public async Task TwoStaffPuttingTheSameLecturerInOverlappingCouncilsOnlyOneWins()
    {
        var w = await NewWorld();
        var results = await Race(
            Create(w, "Hội đồng 1", w.B, w.C, "B4.12", w.T1, "07:30", "08:15"),
            Create(w, "Hội đồng 2", w.D, w.B, "C2.03", w.T2, "07:45", "08:30"));

        Assert.Single(results, r => r.Status == TopicResultStatus.Created);
        Assert.Equal(1, await Query(db => db.DefenseCouncils.CountAsync(c => c.RoundId == w.RoundId)));
    }

    [PostgresFact]
    public async Task TwoCouncilsClaimingTheSameTopicLeaveOneActiveSlot()
    {
        var w = await NewWorld();
        var results = await Race(
            Create(w, "Hội đồng 1", w.B, w.C, "B4.12", w.T1, "07:30", "08:15"),
            Create(w, "Hội đồng 2", w.D, w.E, "C2.03", w.T1, "13:00", "13:45"));

        Assert.Single(results, r => r.Status == TopicResultStatus.Created);
        Assert.Equal(1, await Query(db => db.DefenseSlots.CountAsync(s => s.TopicId == w.T1 && s.Status == DefenseSlotStatus.Active)));
    }

    [PostgresFact]
    public async Task ReplacingAMemberRacingWithTheFirstScoreEitherLocksOrReplaces()
    {
        var w = await NewWorld();
        var council = (await Create(w, "Hội đồng 1", w.B, w.C, "B4.12", w.T1, "07:30", "08:15")()).Response.Data!;
        await Send(new PublishCouncilsCommand(w.Staff.Id, new CouncilPublishInputDto { RoundId = w.RoundId }));
        var version = await Query(db => db.DefenseCouncils.Where(c => c.Id == council.Id).Select(c => c.Version).SingleAsync());

        // Phiếu hội đồng đầu tiên (P07): đặt dấu khóa bằng UPDATE có điều kiện, cùng cách repository sẽ làm.
        Func<Task<object>> score = async () => await Query(db => db.DefenseCouncils
            .Where(c => c.Id == council.Id && c.FirstScoredAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.FirstScoredAt, DateTime.UtcNow)));
        Func<Task<object>> replace = async () => await Send(new UpdateCouncilCommand(w.Staff.Id, council.Id, new CouncilInputDto
        {
            Name = council.Name, ChairId = w.D.Id, SecretaryId = w.C.Id, Date = Day, Room = "B4.12", ExpectedVersion = version,
            Reason = "Thay chủ tịch", Slots = [new CouncilSlotInputDto { TopicId = w.T1, Start = "07:30", End = "08:15" }]
        }));
        var raced = await Race(replace, score);

        var result = (TopicResult<CouncilDto>)raced[0];
        var stored = await Query(db => db.DefenseCouncils.AsNoTracking().SingleAsync(c => c.Id == council.Id));
        Assert.NotNull(stored.FirstScoredAt);
        if (result.Status == TopicResultStatus.Ok) Assert.Equal(w.D.Id, stored.ChairId);
        else
        {
            Assert.Equal(CouncilRules.ScoredMessage, result.Response.Message);
            Assert.Equal(w.B.Id, stored.ChairId);
        }
    }

    [PostgresFact]
    public async Task MigrationCreatesTheConstraintsAndIndexes()
    {
        var w = await NewWorld();
        var council = (await Create(w, "Hội đồng 1", w.B, w.C, "B4.12", w.T1, "07:30", "08:15")()).Response.Data!;
        var names = await Query(async db =>
        {
            var conn = db.Database.GetDbConnection();
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT string_agg(name, ',') FROM (SELECT conname AS name FROM pg_constraint UNION SELECT indexname FROM pg_indexes) x " +
                "WHERE name IN ('CK_DefenseCouncils_ChairNotSecretary', 'CK_DefenseSlots_EndAfterStart', 'IX_DefenseSlots_ActiveTopic')";
            return (string?)await cmd.ExecuteScalarAsync() ?? string.Empty;
        });
        Assert.Contains("CK_DefenseCouncils_ChairNotSecretary", names);
        Assert.Contains("CK_DefenseSlots_EndAfterStart", names);
        Assert.Contains("IX_DefenseSlots_ActiveTopic", names);

        await Assert.ThrowsAnyAsync<Exception>(() => Query(db => db.DefenseCouncils.Where(c => c.Id == council.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.SecretaryId, c => c.ChairId))));
        await Assert.ThrowsAnyAsync<Exception>(() => Query(db => db.DefenseSlots.Where(s => s.CouncilId == council.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.EndTime, x => x.StartTime))));
        await Assert.ThrowsAnyAsync<Exception>(() => Query(async db =>
        {
            db.DefenseSlots.Add(new DefenseSlot { CouncilId = council.Id, TopicId = w.T1, Order = 2, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(9, 30) });
            return await db.SaveChangesAsync();
        }));
    }
}
