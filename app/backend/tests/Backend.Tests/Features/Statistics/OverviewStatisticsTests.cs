using Backend.Application;
using Backend.Application.Common;
using Backend.Application.Rounds;
using Backend.Application.Statistics;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Councils;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Submissions;
using Backend.Infrastructure.Repositories.Topics;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

public sealed class OverviewStatisticsTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;
    private readonly ManualTimeProvider _clock = new(new DateTimeOffset(2026, 10, 15, 0, 0, 0, TimeSpan.FromHours(7)));

    public OverviewStatisticsTests()
    {
        _connection.Open();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationServices();
        services.AddDbContext<ApplicationDbContext>(o => o.UseSqlite(_connection));
        services.AddScoped<IRoundRepository, RoundRepository>();
        services.AddScoped<ITopicRepository, TopicRepository>();
        services.AddScoped<IGroupRepository, GroupRepository>();
        services.AddScoped<IReviewerRepository, ReviewerRepository>();
        services.AddScoped<ICouncilRepository, CouncilRepository>();
        services.AddScoped<ISubmissionRepository, SubmissionRepository>();
        services.AddSingleton<TimeProvider>(_clock);
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
    public async Task OverviewReturnsRoundsAndAlerts()
    {
        // 1. Tạo đợt 1 (Nháp)
        var createRound1 = await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = "Đợt 1 Nháp",
            Program = "Văn bằng 1",
            PeriodLabel = "HK1 2026-2027"
        }));
        Assert.Equal(RoundResultStatus.Created, createRound1.Status);
        var round1Id = createRound1.Response.Data!.Id;

        // 2. Tạo đợt 2 và mở đợt
        var createRound2 = await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = "Đợt 2 Đang chạy",
            Program = "Văn bằng 1",
            PeriodLabel = "HK2 2026-2027"
        }));
        var round2Id = createRound2.Response.Data!.Id;

        // Cấu hình 9 mốc cho đợt 2:
        // Đặt mốc 1 (GV gửi đề tài) từ 01/10 đến 05/10 (đã kết thúc so với 15/10)
        // Mốc 2 (SV đăng ký) từ 06/10 đến 10/10 (đã kết thúc so với 15/10)
        // Mốc 3 (Đề cương) từ 11/10 đến 20/10 (đang chạy so với 15/10, kết thúc 20/10 còn 5 ngày <= 7 ngày)
        // Các mốc sau chưa đặt ngày -> sẽ sinh MilestoneMissing cho mốc 4 (Báo cáo giữa kỳ)!
        var milestones = new RoundMilestonesInputDto
        {
            Milestones = RoundRules.OrderedKeys.Select((key, i) =>
            {
                var input = new RoundMilestoneInputDto
                {
                    Key = RoundRules.KeyName(key),
                    NotifyAudience = "Tất cả"
                };
                if (key == MilestoneKey.TopicSubmission)
                {
                    input.StartDate = "2026-10-01";
                    input.EndDate = "2026-10-05";
                }
                else if (key == MilestoneKey.TopicRegistration)
                {
                    input.StartDate = "2026-10-06";
                    input.EndDate = "2026-10-10";
                }
                else if (key == MilestoneKey.Outline)
                {
                    input.StartDate = "2026-10-11";
                    input.EndDate = "2026-10-20";
                    input.AllowLate = false;
                }
                return input;
            }).ToList()
        };
        await Send(new UpdateRoundMilestonesCommand(round2Id, milestones));

        // Thêm SV vào đợt 2
        using (var scope = _provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var student = new User { Id = Guid.NewGuid(), UserCode = "SV001", FullName = "Sinh Viên 1", Email = "sv1@test.com", Role = UserRole.Student, IsActive = true };
            db.Users.Add(student);
            await db.SaveChangesAsync();

            await Send(new AddParticipantsCommand(round2Id, "students", ["SV001"]));
        }

        // Mở đợt 2 (theo PDR-067, đủ 3 mốc đầu là mở được)
        var openResult = await Send(new OpenRoundCommand(round2Id));
        Assert.Equal(RoundResultStatus.Ok, openResult.Status);

        // 3. Lấy Overview
        var overviewResult = await Send(new GetOverviewStatisticsQuery());
        Assert.Equal(TopicResultStatus.Ok, overviewResult.Status);
        Assert.NotNull(overviewResult.Response.Data);

        var data = overviewResult.Response.Data;
        Assert.Equal(2, data.Rounds.Count);

        var r1Overview = data.Rounds.Single(r => r.RoundId == round1Id);
        Assert.Equal("Nháp", r1Overview.Status);
        Assert.Null(r1Overview.TopicsScored);
        Assert.Null(r1Overview.TopicsWithDeviation);

        var r2Overview = data.Rounds.Single(r => r.RoundId == round2Id);
        Assert.Equal("Đang diễn ra", r2Overview.Status);
        Assert.Equal("outline", r2Overview.CurrentMilestoneKey);
        Assert.Equal(1, r2Overview.StudentCount);
        Assert.Equal(0, r2Overview.StudentsWithGroup);

        // Kiểm tra Alerts:
        // - Sinh viên chưa có nhóm vì đã qua hạn mốc đăng ký 10/10:
        var studentAlert = data.Alerts.FirstOrDefault(a => a.Kind == AttentionAlertKinds.StudentsWithoutGroup && a.RoundId == round2Id);
        Assert.NotNull(studentAlert);
        Assert.Equal(1, studentAlert.Count);
        Assert.Equal($"/giao-vu/dot/{round2Id}?tab=sinh-vien", studentAlert.Target);

        // - Mốc kế tiếp (Báo cáo giữa kỳ) chưa được đặt ngày vì mốc Đề cương kết thúc 20/10 (còn 5 ngày):
        var milestoneAlert = data.Alerts.FirstOrDefault(a => a.Kind == AttentionAlertKinds.MilestoneMissing && a.RoundId == round2Id);
        Assert.NotNull(milestoneAlert);
        Assert.Contains("Báo cáo giữa kỳ", milestoneAlert.Message);
        Assert.Equal($"/giao-vu/dot/{round2Id}?tab=cau-hinh", milestoneAlert.Target);
    }
}
