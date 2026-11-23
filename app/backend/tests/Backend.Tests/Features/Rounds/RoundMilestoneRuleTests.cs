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

public sealed class RoundMilestoneRuleTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;

    public RoundMilestoneRuleTests()
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
    public void TwoMilestones_WithSameStartDate_IsValid()
    {
        var milestones = new List<(MilestoneKey Key, string? Start, string? End)>
        {
            (MilestoneKey.TopicSubmission, "2026-09-01", "2026-09-14"),
            (MilestoneKey.TopicRegistration, "2026-09-01", "2026-09-20")
        };
        var errors = RoundRules.ValidateMilestones(milestones, requireAll: false);
        Assert.Empty(errors);
    }

    [Fact]
    public void LaterMilestone_StartingBeforePreviousMilestone_IsBlocked()
    {
        var milestones = new List<(MilestoneKey Key, string? Start, string? End)>
        {
            (MilestoneKey.TopicSubmission, "2026-09-05", "2026-09-14"),
            (MilestoneKey.TopicRegistration, "2026-09-01", "2026-09-20")
        };
        var errors = RoundRules.ValidateMilestones(milestones, requireAll: false);
        Assert.Single(errors);
        Assert.Contains("bắt đầu trước mốc", errors[0]);
    }

    [Fact]
    public void Milestone8_StartingAtSameTimeAsMilestone6_IsValidEvenIfAfterMilestone7StartsEarlierOrLater()
    {
        // Mốc 6: 2026-11-01
        // Mốc 7: 2026-11-15
        // Mốc 8 (Grading): 2026-11-01 (bắt đầu cùng mốc 6, trước mốc 7 -> hợp lệ theo PDR-067)
        var milestones = new List<(MilestoneKey Key, string? Start, string? End)>
        {
            (MilestoneKey.TopicSubmission, "2026-09-01", "2026-09-14"),
            (MilestoneKey.TopicRegistration, "2026-09-15", "2026-09-28"),
            (MilestoneKey.Outline, "2026-09-29", "2026-10-12"),
            (MilestoneKey.ReviewSchedule, "2026-11-01", "2026-11-14"), // mốc 6
            (MilestoneKey.DefenseSchedule, "2026-11-15", "2026-11-28"), // mốc 7
            (MilestoneKey.Grading, "2026-11-01", "2026-11-28")         // mốc 8: bắt đầu cùng mốc 6
        };
        var errors = RoundRules.ValidateMilestones(milestones, requireAll: false);
        Assert.Empty(errors);
    }

    [Fact]
    public async Task OpenRound_SucceedsWithOnlyFirstThreeMilestones()
    {
        var created = await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = "Đợt mở 3 mốc đầu",
            Program = "Văn bằng 1",
            PeriodLabel = "HK1 2026-2027"
        }));
        var roundId = created.Response.Data!.Id;

        // Chỉ điền 3 mốc đầu
        var input = new RoundMilestonesInputDto
        {
            Milestones = RoundRules.OrderedKeys.Select(k => new RoundMilestoneInputDto
            {
                Key = RoundRules.KeyName(k),
                StartDate = k switch
                {
                    MilestoneKey.TopicSubmission => "2026-09-01",
                    MilestoneKey.TopicRegistration => "2026-09-15",
                    MilestoneKey.Outline => "2026-09-29",
                    _ => null
                },
                EndDate = k switch
                {
                    MilestoneKey.TopicSubmission => "2026-09-14",
                    MilestoneKey.TopicRegistration => "2026-09-28",
                    MilestoneKey.Outline => "2026-10-12",
                    _ => null
                },
                NotifyAudience = "Tất cả",
                AllowLate = k == MilestoneKey.Outline ? true : null,
                LateEndDate = k == MilestoneKey.Outline ? "2026-10-15" : null
            }).ToList()
        };
        await Send(new UpdateRoundMilestonesCommand(roundId, input));

        var openResult = await Send(new OpenRoundCommand(roundId));
        Assert.Equal(RoundResultStatus.Ok, openResult.Status);
        Assert.Equal("Đang diễn ra", openResult.Response.Data!.Status);
    }

    [Fact]
    public async Task OpenRound_FailsWhenMissingThirdMilestone()
    {
        var created = await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = "Đợt thiếu mốc 3",
            Program = "Văn bằng 1",
            PeriodLabel = "HK1 2026-2027"
        }));
        var roundId = created.Response.Data!.Id;

        // Chỉ điền mốc 1 và 2, thiếu mốc 3 (Đề cương)
        var input = new RoundMilestonesInputDto
        {
            Milestones = RoundRules.OrderedKeys.Select(k => new RoundMilestoneInputDto
            {
                Key = RoundRules.KeyName(k),
                StartDate = k switch
                {
                    MilestoneKey.TopicSubmission => "2026-09-01",
                    MilestoneKey.TopicRegistration => "2026-09-15",
                    _ => null
                },
                EndDate = k switch
                {
                    MilestoneKey.TopicSubmission => "2026-09-14",
                    MilestoneKey.TopicRegistration => "2026-09-28",
                    _ => null
                },
                NotifyAudience = "Tất cả"
            }).ToList()
        };
        await Send(new UpdateRoundMilestonesCommand(roundId, input));

        var openResult = await Send(new OpenRoundCommand(roundId));
        Assert.Equal(RoundResultStatus.Conflict, openResult.Status);
        Assert.Equal("Cần nhập đủ 3 mốc đầu (Gửi đề tài, Đăng ký, Đề cương) trước khi mở đợt.", openResult.Response.Message);
    }
}
