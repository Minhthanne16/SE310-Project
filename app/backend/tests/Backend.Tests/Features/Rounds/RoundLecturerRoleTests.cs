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

public sealed class RoundLecturerRoleTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;

    public RoundLecturerRoleTests()
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

    private async Task<(ThesisRound round, User lecturer1, User lecturer2)> SeedRoundWithLecturersAsync()
    {
        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var l1 = new User
        {
            Id = Guid.NewGuid(),
            UserCode = "GV001",
            FullName = "Nguyen Van A",
            Email = "nva@test.edu.vn",
            Department = "HTTT",
            Role = UserRole.Lecturer,
            IsActive = true
        };
        var l2 = new User
        {
            Id = Guid.NewGuid(),
            UserCode = "GV002",
            FullName = "Tran Thi B",
            Email = "ttb@test.edu.vn",
            Department = "KTPM",
            Role = UserRole.Lecturer,
            IsActive = true
        };
        db.Users.AddRange(l1, l2);

        var round = new ThesisRound
        {
            Id = Guid.NewGuid(),
            Name = "Văn bằng 1 · HK1 2026-2027",
            NormalizedName = "van bang 1 · hk1 2026-2027",
            Program = "Văn bằng 1",
            PeriodLabel = "HK1 2026-2027",
            Status = RoundStatus.Running,
            MaxGroupSize = 2,
            GradingConfig = new RoundGradingConfig()
        };

        var p1 = new RoundParticipant
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
            UserId = l1.Id,
            Kind = ParticipantKind.Lecturer,
            IsSupervisor = true,
            IsReviewer = false,
            IsCommittee = false
        };
        var p2 = new RoundParticipant
        {
            Id = Guid.NewGuid(),
            RoundId = round.Id,
            UserId = l2.Id,
            Kind = ParticipantKind.Lecturer,
            IsSupervisor = true,
            IsReviewer = true,
            IsCommittee = true
        };

        db.ThesisRounds.Add(round);
        db.RoundParticipants.AddRange(p1, p2);
        await db.SaveChangesAsync();

        return (round, l1, l2);
    }

    [Fact]
    public async Task UpdateLecturerRoles_Success()
    {
        var (round, l1, _) = await SeedRoundWithLecturersAsync();

        var res = await Send(new UpdateLecturerRolesCommand(
            round.Id, l1.Id, IsSupervisor: true, IsReviewer: true, IsCommittee: true));

        Assert.Equal(RoundResultStatus.Ok, res.Status);
        Assert.True(res.Response.Success);
        var role = Assert.Single(res.Response.Data!.LecturerRoles, r => r.UserId == l1.Id);
        Assert.True(role.IsSupervisor);
        Assert.True(role.IsReviewer);
        Assert.True(role.IsCommittee);
    }

    [Fact]
    public async Task UpdateLecturerRoles_Fails_WhenNoRoleSelected()
    {
        var (round, l1, _) = await SeedRoundWithLecturersAsync();

        var res = await Send(new UpdateLecturerRolesCommand(
            round.Id, l1.Id, IsSupervisor: false, IsReviewer: false, IsCommittee: false));

        Assert.Equal(RoundResultStatus.Conflict, res.Status);
        Assert.False(res.Response.Success);
        Assert.Contains("Phải chọn ít nhất một vai trò", res.Response.Message);
    }

    [Fact]
    public async Task UpdateLecturerRoles_Fails_WhenSupervisorHasTopicInRound()
    {
        var (round, l1, _) = await SeedRoundWithLecturersAsync();

        using (var scope = _provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ThesisTopics.Add(new ThesisTopic
            {
                Id = Guid.NewGuid(),
                RoundId = round.Id,
                Title = "De tai 1",
                SupervisorId = l1.Id,
                Status = TopicStatus.NotRegistered
            });
            await db.SaveChangesAsync();
        }

        var res = await Send(new UpdateLecturerRolesCommand(
            round.Id, l1.Id, IsSupervisor: false, IsReviewer: true, IsCommittee: false));

        Assert.Equal(RoundResultStatus.Conflict, res.Status);
        Assert.Contains("đang hướng dẫn đề tài", res.Response.Message);
    }

    [Fact]
    public async Task UpdateLecturerRoles_Fails_WhenReviewerHasTopicInRound()
    {
        var (round, l1, l2) = await SeedRoundWithLecturersAsync();

        using (var scope = _provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ThesisTopics.Add(new ThesisTopic
            {
                Id = Guid.NewGuid(),
                RoundId = round.Id,
                Title = "De tai 2",
                SupervisorId = l1.Id,
                ReviewerId = l2.Id,
                Status = TopicStatus.InProgress
            });
            await db.SaveChangesAsync();
        }

        var res = await Send(new UpdateLecturerRolesCommand(
            round.Id, l2.Id, IsSupervisor: true, IsReviewer: false, IsCommittee: true));

        Assert.Equal(RoundResultStatus.Conflict, res.Status);
        Assert.Contains("đang phản biện đề tài", res.Response.Message);
    }

    [Fact]
    public async Task UpdateLecturerRoles_Fails_WhenCommitteeInCouncil()
    {
        var (round, l1, l2) = await SeedRoundWithLecturersAsync();

        using (var scope = _provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.DefenseCouncils.Add(new DefenseCouncil
            {
                Id = Guid.NewGuid(),
                RoundId = round.Id,
                Name = "Hoi dong 1",
                ChairId = l2.Id,
                SecretaryId = l1.Id,
                DefenseDate = new DateOnly(2026, 12, 1),
                Status = CouncilStatus.Published
            });
            await db.SaveChangesAsync();
        }

        var res = await Send(new UpdateLecturerRolesCommand(
            round.Id, l2.Id, IsSupervisor: true, IsReviewer: true, IsCommittee: false));

        Assert.Equal(RoundResultStatus.Conflict, res.Status);
        Assert.Contains("đang thuộc hội đồng", res.Response.Message);
    }

    [Fact]
    public async Task PreviewAndImportLecturerRoles_WorksCorrectly()
    {
        var (round, l1, l2) = await SeedRoundWithLecturersAsync();

        // Tạo thêm GV 3 trong hệ thống nhưng chưa vào đợt
        User l3;
        using (var scope = _provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            l3 = new User
            {
                Id = Guid.NewGuid(),
                UserCode = "GV003",
                FullName = "Le Van C",
                Email = "lvc@test.edu.vn",
                Department = "MMT",
                Role = UserRole.Lecturer,
                IsActive = true
            };
            db.Users.Add(l3);
            await db.SaveChangesAsync();
        }

        var rows = new List<LecturerRoleImportRowDto>
        {
            new() { Code = "GV001", IsSupervisor = true, IsReviewer = true, IsCommittee = false },
            new() { Code = "GV003", IsSupervisor = false, IsReviewer = true, IsCommittee = true },
            new() { Code = "GV999", IsSupervisor = true, IsReviewer = false, IsCommittee = false }, // Không tồn tại
            new() { Code = "GV002", IsSupervisor = false, IsReviewer = false, IsCommittee = false }, // Không chọn vai trò
        };

        var previewRes = await Send(new PreviewLecturerRolesCommand(round.Id, rows));
        Assert.Equal(RoundResultStatus.Ok, previewRes.Status);
        Assert.NotNull(previewRes.Response.Data);
        Assert.Equal(2, previewRes.Response.Data.Valid.Count);
        Assert.Equal(2, previewRes.Response.Data.Errors.Count);

        var validL1 = Assert.Single(previewRes.Response.Data.Valid, v => v.Code == "GV001");
        Assert.False(validL1.IsNew);
        Assert.True(validL1.IsReviewer);

        var validL3 = Assert.Single(previewRes.Response.Data.Valid, v => v.Code == "GV003");
        Assert.True(validL3.IsNew);
        Assert.False(validL3.IsSupervisor);
        Assert.True(validL3.IsReviewer);
        Assert.True(validL3.IsCommittee);

        // Import
        var importRes = await Send(new ImportLecturerRolesCommand(round.Id, rows));
        Assert.Equal(RoundResultStatus.Ok, importRes.Status);
        Assert.Equal(1, importRes.Response.Data!.UpdatedCount);
        Assert.Equal(1, importRes.Response.Data.AddedCount);
        Assert.Equal(3, importRes.Response.Data.Roles.Count);
    }
}
