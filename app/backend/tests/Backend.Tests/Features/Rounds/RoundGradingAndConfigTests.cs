using Backend.Application;
using Backend.Application.Rounds;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests.Features.Rounds;

public sealed class RoundGradingAndConfigTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;

    public RoundGradingAndConfigTests()
    {
        _connection.Open();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationServices();
        services.AddDbContext<ApplicationDbContext>(o => o.UseSqlite(_connection));
        services.AddScoped<IRoundRepository, RoundRepository>();
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

    [Fact]
    public void ThesisScore_CalculatesWeightedScoreAndRoundsCorrectly()
    {
        // Ví dụ trong plan: 8, 7, 9, 6 với hệ số 1, 1, 2, 2 -> 7.50
        var cfg = new RoundGradingConfig
        {
            WeightChair = 1,
            WeightSecretary = 1,
            WeightSupervisor = 2,
            WeightReviewer = 2
        };
        var score = ThesisScore.Calculate(8m, 7m, 9m, 6m, cfg);
        Assert.Equal(7.50m, score);

        // Mặc định (1, 1, 2, 2)
        var defaultScore = ThesisScore.Calculate(8m, 7m, 9m, 6m);
        Assert.Equal(7.50m, defaultScore);

        // Làm tròn nửa lên: ví dụ 1, 1, 1, 1 chia 4
        // (8 + 7 + 8 + 6) / 4 = 29 / 4 = 7.25
        var equalCfg = new RoundGradingConfig { WeightChair = 1, WeightSecretary = 1, WeightSupervisor = 1, WeightReviewer = 1 };
        Assert.Equal(7.25m, ThesisScore.Calculate(8m, 7m, 8m, 6m, equalCfg));
    }

    [Theory]
    [InlineData(10.00, ThesisGrade.Excellent)]
    [InlineData(9.00, ThesisGrade.Excellent)]
    [InlineData(8.99, ThesisGrade.Good)]
    [InlineData(8.00, ThesisGrade.Good)]
    [InlineData(7.99, ThesisGrade.Fair)]
    [InlineData(7.00, ThesisGrade.Fair)]
    [InlineData(6.95, ThesisGrade.Average)]
    [InlineData(5.00, ThesisGrade.Average)]
    [InlineData(4.99, ThesisGrade.Failed)]
    [InlineData(0.00, ThesisGrade.Failed)]
    public void ThesisGrade_ClassifiesCorrectlyAtBoundaries(decimal score, string expectedGrade)
    {
        Assert.Equal(expectedGrade, ThesisGrade.Classify(score));
    }

    [Fact]
    public async Task UpdatingMaxGroupSizeOrGradingWhenRunningIsBlocked()
    {
        var created = await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = "Đợt kiểm tra khóa cấu hình",
            Program = "Văn bằng 1",
            PeriodLabel = "HK1 2026-2027"
        }));
        var roundId = created.Response.Data!.Id;

        // Điền mốc và mở đợt
        var datedMilestones = RoundWorkflowTests.Dated();
        await Send(new UpdateRoundMilestonesCommand(roundId, datedMilestones));
        var openResult = await Send(new OpenRoundCommand(roundId));
        Assert.Equal(RoundResultStatus.Ok, openResult.Status);

        // 1. Sửa MaxGroupSize khi Running -> bị chặn
        var updateInfoResult = await Send(new UpdateRoundCommand(roundId, new RoundInfoDto
        {
            Name = "Đợt kiểm tra khóa cấu hình",
            Program = "Văn bằng 1",
            PeriodLabel = "HK1 2026-2027",
            MaxGroupSize = 3
        }));
        Assert.Equal(RoundResultStatus.Conflict, updateInfoResult.Status);
        Assert.Equal("Đợt đã mở, không sửa số sinh viên tối đa.", updateInfoResult.Response.Message);

        // 2. Sửa Cấu hình điểm khi Running -> bị chặn
        var updateGradingResult = await Send(new UpdateRoundGradingCommand(roundId, new UpdateRoundGradingDto
        {
            WeightChair = 2,
            WeightSecretary = 2,
            WeightSupervisor = 3,
            WeightReviewer = 3,
            DeviationThreshold = 1.5m
        }));
        Assert.Equal(RoundResultStatus.Conflict, updateGradingResult.Status);
        Assert.Equal("Đợt đã mở nên không sửa cấu hình điểm được nữa.", updateGradingResult.Response.Message);
    }

    [Fact]
    public async Task CreateRound_UsesProgramDefaults_WhenAvailable()
    {
        // Lưu cấu hình mặc định cho Thạc sĩ
        using (var scope = _provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ProgramRoundDefaults.Add(new ProgramRoundDefaults
            {
                Program = "Thạc sĩ",
                MaxGroupSize = 1,
                WeightChair = 2,
                WeightSecretary = 2,
                WeightSupervisor = 3,
                WeightReviewer = 3,
                DeviationThreshold = 1.5m
            });
            await db.SaveChangesAsync();
        }

        var created = await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = "Đợt Thạc sĩ K2026",
            Program = "Thạc sĩ",
            PeriodLabel = "K2026"
        }));
        Assert.Equal(RoundResultStatus.Created, created.Status);
        var round = created.Response.Data!;
        Assert.Equal(1, round.MaxGroupSize);
        Assert.Equal(2m, round.Grading.WeightChair);
        Assert.Equal(2m, round.Grading.WeightSecretary);
        Assert.Equal(3m, round.Grading.WeightSupervisor);
        Assert.Equal(3m, round.Grading.WeightReviewer);
        Assert.Equal(1.5m, round.Grading.DeviationThreshold);
    }

    [Fact]
    public async Task UpdatingGrading_WithSaveAsProgramDefault_SavesProgramDefaults()
    {
        var created = await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = "Đợt VB2 K2026",
            Program = "Văn bằng 2",
            PeriodLabel = "K2026"
        }));
        var roundId = created.Response.Data!.Id;

        var updateResult = await Send(new UpdateRoundGradingCommand(roundId, new UpdateRoundGradingDto
        {
            WeightChair = 1.5m,
            WeightSecretary = 1.5m,
            WeightSupervisor = 2.5m,
            WeightReviewer = 2.5m,
            DeviationThreshold = 1.8m,
            SaveAsProgramDefault = true
        }));
        Assert.Equal(RoundResultStatus.Ok, updateResult.Status);

        // Lấy lại defaults của Văn bằng 2
        var defaults = await Send(new GetProgramDefaultsQuery("Văn bằng 2"));
        Assert.True(defaults.Success);
        Assert.Equal(1.5m, defaults.Data!.WeightChair);
        Assert.Equal(1.5m, defaults.Data.WeightSecretary);
        Assert.Equal(2.5m, defaults.Data.WeightSupervisor);
        Assert.Equal(2.5m, defaults.Data.WeightReviewer);
        Assert.Equal(1.8m, defaults.Data.DeviationThreshold);
    }
}
