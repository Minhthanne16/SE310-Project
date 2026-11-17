using Backend.Application;
using Backend.Application.Common.Storage;
using Backend.Application.Reviewers;
using Backend.Application.Rounds;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Submissions;
using Backend.Infrastructure.Repositories.Topics;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace Backend.Tests;

// P05-S02 — đồng thời trên PostgreSQL thật (PDR-023, PDR-062): hai Giáo vụ cùng đổi GVPB, đổi chạy song song với
// phiếu đầu tiên, ràng buộc database. Chỉ chạy khi đặt QLKLTN_TEST_POSTGRES (xem RegistrationConcurrencyTests).
public sealed class ReviewerConcurrencyTests : IAsyncLifetime
{
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset DuringOutline = new(2026, 9, 16, 3, 0, 0, TimeSpan.Zero);

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
        services.AddSingleton<IDocumentStorage>(new InMemoryAvatarStorage());
        _provider = services.BuildServiceProvider();

        // Migration thật của ứng dụng, để kiểm đúng ràng buộc CK_ThesisTopics_ReviewerNotSupervisor.
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

    private sealed record World(Guid TopicId, Person Staff, Person Supervisor, Person X, Person Y, Person Z);

    private async Task<Person> Seed(UserRole role, string code) =>
        new(await Query(db => RoundWorkflowTests.SeedUser(db, role, code, $"Người {code}", "CNPM")), code);

    private async Task<World> EligibleTopic()
    {
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var staff = await Seed(UserRole.AcademicAffairs, $"GVU{s}");
        var supervisor = await Seed(UserRole.Lecturer, $"GV{s}A");
        var x = await Seed(UserRole.Lecturer, $"GV{s}X");
        var y = await Seed(UserRole.Lecturer, $"GV{s}Y");
        var z = await Seed(UserRole.Lecturer, $"GV{s}Z");
        var rep = await Seed(UserRole.Student, $"SV{s}1");
        var partner = await Seed(UserRole.Student, $"SV{s}2");
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        var start = new DateOnly(2026, 9, 1);
        await Send(new UpdateRoundMilestonesCommand(round.Id, new RoundMilestonesInputDto
        {
            Milestones = RoundRules.OrderedKeys.Select((key, i) => new RoundMilestoneInputDto
            {
                Key = RoundRules.KeyName(key),
                StartDate = start.AddDays(i * 7).ToString("yyyy-MM-dd"),
                EndDate = start.AddDays(i * 7 + 5).ToString("yyyy-MM-dd"),
                NotifyAudience = "Tất cả",
                AllowLate = ThesisRound.HasLateToggle(key) ? true : null,
                LateEndDate = ThesisRound.HasLateToggle(key) ? start.AddDays(i * 7 + 6).ToString("yyyy-MM-dd") : null
            }).ToList()
        }));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [supervisor.Code, x.Code, y.Code, z.Code]));
        await Send(new AddParticipantsCommand(round.Id, "students", [rep.Code, partner.Code]));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(round.Id))).Status);
        var topicId = (await Send(new CreateTopicCommand(supervisor.Id, new TopicInputDto
        {
            RoundId = round.Id, Title = "Đề tài", Field = "CNPM", Description = "Mô tả"
        }))).Response.Data!.Id;
        Assert.Equal(RoundResultStatus.Ok, (await Send(new PublishRoundTopicsCommand(round.Id))).Status);
        Assert.Equal(TopicResultStatus.Ok, (await Send(new RegisterTopicCommand(rep.Id, topicId, [partner.Code]))).Status);
        _clock.Set(DuringOutline);
        await Query(async db =>
        {
            var topic = await db.ThesisTopics.SingleAsync(t => t.Id == topicId);
            topic.OutlineApprovedAt = DateTime.UtcNow;
            topic.OutlineApprovedById = supervisor.Id;
            await db.SaveChangesAsync();
            return 0;
        });
        return new World(topicId, staff, supervisor, x, y, z);
    }

    private Func<Task<TopicResult<AssignReviewerResultDto>>> Assign(World w, Person to, Person? expected) =>
        () => Send(new AssignReviewerCommand(w.Staff.Id, w.TopicId,
            new AssignReviewerInputDto { ReviewerId = to.Id, ExpectedReviewerId = expected?.Id }));

    [PostgresFact]
    public async Task TwoStaffAssigningTheSameTopicWithTheSameExpectationOnlyOneWins()
    {
        var w = await EligibleTopic();
        Assert.Equal(TopicResultStatus.Ok, (await Assign(w, w.X, null)()).Status);

        var results = await Race(Assign(w, w.Y, w.X), Assign(w, w.Z, w.X));

        Assert.Single(results, r => r.Status == TopicResultStatus.Ok);
        Assert.Single(results, r => r.Status == TopicResultStatus.Conflict);
        var topic = await Query(db => db.ThesisTopics.AsNoTracking().SingleAsync(t => t.Id == w.TopicId));
        Assert.Contains(topic.ReviewerId, new Guid?[] { w.Y.Id, w.Z.Id });
        // Một lần gán đầu và đúng một lần đổi.
        Assert.Equal(2, await Query(db => db.TopicHistoryEntries.CountAsync(h => h.TopicId == w.TopicId && h.Category == "Phân công")));
    }

    [PostgresFact]
    public async Task ChangeRacingWithFirstScoreEitherLocksTheChangeOrKeepsTheScorer()
    {
        var w = await EligibleTopic();
        Assert.Equal(TopicResultStatus.Ok, (await Assign(w, w.X, null)()).Status);

        // Phiếu đầu tiên của X: đặt dấu khóa bằng UPDATE có điều kiện ReviewerId = X (như P07 sẽ làm).
        Func<Task<int>> score = () => Query(db => db.ThesisTopics
            .Where(t => t.Id == w.TopicId && t.ReviewerId == w.X.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ReviewerFirstScoredAt, DateTime.UtcNow)));
        var raced = await Race<object>(async () => await Assign(w, w.Y, w.X)(), async () => await score());

        var topic = await Query(db => db.ThesisTopics.AsNoTracking().SingleAsync(t => t.Id == w.TopicId));
        var change = (TopicResult<AssignReviewerResultDto>)raced[0];
        var scored = (int)raced[1];
        if (change.Status == TopicResultStatus.Ok)
        {
            // Đổi thắng trước: phiếu của X không còn khớp ReviewerId nên không đặt được dấu khóa.
            Assert.Equal(0, scored);
            Assert.Equal(w.Y.Id, topic.ReviewerId);
            Assert.Null(topic.ReviewerFirstScoredAt);
        }
        else
        {
            Assert.Equal(1, scored);
            Assert.Equal(w.X.Id, topic.ReviewerId);
            Assert.NotNull(topic.ReviewerFirstScoredAt);
            Assert.Equal(ReviewerRules.LockedMessage, change.Response.Message);
        }
        // Sau khi đã khóa, mọi lần đổi đều bị từ chối.
        var after = await Query(db => db.ThesisTopics.AsNoTracking().SingleAsync(t => t.Id == w.TopicId));
        if (after.ReviewerFirstScoredAt is not null)
            Assert.Equal(TopicResultStatus.Conflict, (await Assign(w, w.Z, after.ReviewerId == w.X.Id ? w.X : w.Y)()).Status);
    }

    [PostgresFact]
    public async Task DatabaseRejectsSupervisorAsReviewerAndMigrationCreatesTheConstraint()
    {
        var w = await EligibleTopic();

        var exists = await Query(async db =>
        {
            var conn = db.Database.GetDbConnection();
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT count(*) FROM pg_constraint WHERE conname = 'CK_ThesisTopics_ReviewerNotSupervisor'";
            return Convert.ToInt32(await cmd.ExecuteScalarAsync());
        });
        Assert.Equal(1, exists);
        await Assert.ThrowsAnyAsync<Exception>(() => Query(db => db.ThesisTopics.Where(t => t.Id == w.TopicId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ReviewerId, t => t.SupervisorId))));
    }
}
