using System.Text;
using Backend.Application;
using Backend.Application.Common.Storage;
using Backend.Application.Rounds;
using Backend.Application.Submissions;
using Backend.Application.Topics;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Submissions;
using Backend.Infrastructure.Repositories.Topics;
using MediatR;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

public sealed class SubmissionReviewWorkflowTests : IDisposable
{
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset BeforeMidtermDeadline = new(2026, 9, 23, 3, 0, 0, TimeSpan.Zero);

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;
    private readonly ManualTimeProvider _clock = new(DuringSubmission);
    private readonly InMemoryDocumentStorage _storage = new();

    public SubmissionReviewWorkflowTests()
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
        services.AddSingleton<IDocumentStorage>(_storage);
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

    private async Task Db(Func<ApplicationDbContext, Task> action)
    {
        using var scope = _provider.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    private sealed record Person(Guid Id, string Code);
    private sealed record World(Guid RoundId, Person Lecturer, Person OtherLecturer, Person[] Students, Guid TopicId);

    private async Task<Person> Seed(UserRole role, string code)
    {
        using var scope = _provider.CreateScope();
        var id = await RoundWorkflowTests.SeedUser(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            role, code, $"Người {code}", role == UserRole.Student ? "KTPM2023" : "CNPM");
        return new Person(id, code);
    }

    private async Task<World> RunningTopic()
    {
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var lecturer = await Seed(UserRole.Lecturer, $"GV{s}");
        var other = await Seed(UserRole.Lecturer, $"GX{s}");
        var students = new[] { await Seed(UserRole.Student, $"SV{s}1"), await Seed(UserRole.Student, $"SV{s}2") };
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        Assert.Equal(RoundResultStatus.Ok, (await Send(new UpdateRoundMilestonesCommand(round.Id, SubmissionWorkflowTests.Dated()))).Status);
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [lecturer.Code, other.Code]));
        await Send(new AddParticipantsCommand(round.Id, "students", students.Select(x => x.Code).ToList()));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(round.Id))).Status);
        var topicId = (await Send(new CreateTopicCommand(lecturer.Id, new TopicInputDto
        {
            RoundId = round.Id, Title = "Đề tài thử nghiệm", Field = "CNPM", Description = "Mô tả"
        }))).Response.Data!.Id;
        _clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new PublishRoundTopicsCommand(round.Id))).Status);
        _clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(TopicResultStatus.Ok, (await Send(new RegisterTopicCommand(students[0].Id, topicId, [students[1].Code]))).Status);
        await Db(async db =>
        {
            await db.ThesisTopics.Where(t => t.Id == topicId).ExecuteUpdateAsync(s => s
                .SetProperty(t => t.OutlineApprovedAt, DateTime.UtcNow).SetProperty(t => t.OutlineApprovedById, lecturer.Id));
        });
        _clock.Set(BeforeMidtermDeadline);
        return new World(round.Id, lecturer, other, students, topicId);
    }

    [Fact]
    public async Task SupervisorCanCommentOnReportAndStudentsCanViewComment()
    {
        var world = await RunningTopic();
        var submitRes = await Send(new SubmitReportCommand(world.Students[0].Id, ViewerRole.Student, world.TopicId,
            "midterm", "bc-giua-ky.pdf", SubmissionWorkflowTests.Pdf("midterm"), "Bản nộp 1"));
        Assert.Equal(TopicResultStatus.Created, submitRes.Status);
        var subId = submitRes.Response.Data!.Kinds.Single(k => k.Kind == "midterm").Versions[0].Id;

        // Sinh viên gọi handler mà không phải GVHD -> 404 (không lộ đề tài)
        var svComment = await Send(new CommentSubmissionCommand(world.Students[0].Id, world.TopicId, subId, "Không thể comment"));
        Assert.Equal(TopicResultStatus.NotFound, svComment.Status);

        // GV khác comment -> 404
        var otherComment = await Send(new CommentSubmissionCommand(world.OtherLecturer.Id, world.TopicId, subId, "Không thể comment"));
        Assert.Equal(TopicResultStatus.NotFound, otherComment.Status);

        // GVHD comment hợp lệ
        var commentRes = await Send(new CommentSubmissionCommand(world.Lecturer.Id, world.TopicId, subId, "Cần bổ sung phần thực nghiệm"));
        Assert.Equal(TopicResultStatus.Ok, commentRes.Status);
        var midterm = commentRes.Response.Data!.Kinds.Single(k => k.Kind == "midterm");
        Assert.Equal("Cần bổ sung phần thực nghiệm", midterm.Versions[0].ReviewComment);
        Assert.Equal($"Người {world.Lecturer.Code}", midterm.Versions[0].ReviewedBy);
        Assert.NotNull(midterm.Versions[0].ReviewedAt);

        await Db(async db =>
        {
            var notices = await db.Notifications.Where(n => n.Kind == NotificationKinds.Comment && n.Text.Contains("Cần bổ sung phần thực nghiệm")).ToListAsync();
            Assert.Equal(world.Students.Select(s => s.Id).Order(), notices.Select(n => n.RecipientUserId).Order());
        });

        // Sinh viên xem lại danh sách bài nộp cũng thấy comment
        var listRes = await Send(new ListSubmissionsQuery(world.Students[0].Id, ViewerRole.Student, world.TopicId));
        Assert.Equal(TopicResultStatus.Ok, listRes.Status);
        var svMidterm = listRes.Response.Data!.Kinds.Single(k => k.Kind == "midterm");
        Assert.Equal("Cần bổ sung phần thực nghiệm", svMidterm.Versions[0].ReviewComment);
        Assert.Equal($"Người {world.Lecturer.Code}", svMidterm.Versions[0].ReviewedBy);
    }

    [Fact]
    public async Task RevisionRequestWorkflow_Create_Resubmit_Resolve()
    {
        var world = await RunningTopic();

        // 1. Tạo yêu cầu khi chưa có bản nộp nào -> 409 Conflict
        var noSubRes = await Send(new CreateSubmissionRevisionRequestCommand(world.Lecturer.Id, world.TopicId, "midterm", "Yêu cầu sớm"));
        Assert.Equal(TopicResultStatus.Conflict, noSubRes.Status);

        // 2. Nhóm nộp bản 1 giữa kỳ
        var sub1 = await Send(new SubmitReportCommand(world.Students[0].Id, ViewerRole.Student, world.TopicId,
            "midterm", "bc1.pdf", SubmissionWorkflowTests.Pdf("v1"), "Bản 1"));
        Assert.Equal(TopicResultStatus.Created, sub1.Status);

        // 3. GVHD tạo yêu cầu chỉnh sửa cho giữa kỳ
        var reqRes = await Send(new CreateSubmissionRevisionRequestCommand(world.Lecturer.Id, world.TopicId, "midterm", "Sửa chương 2"));
        Assert.Equal(TopicResultStatus.Ok, reqRes.Status);
        var midterm = reqRes.Response.Data!.Kinds.Single(k => k.Kind == "midterm");
        Assert.Single(midterm.Requests);
        var req = midterm.Requests[0];
        Assert.Equal("Sửa chương 2", req.Content);
        Assert.Equal("open", req.Status);
        Assert.Equal(1, req.RaisedOnVersionNo);
        Assert.False(req.CanResolve); // Chưa nộp lại nên chưa resolve được

        // Kiểm tra notification đã được gửi cho nhóm
        await Db(async db =>
        {
            var notices = await db.Notifications.Where(n => n.RecipientUserId == world.Students[0].Id).ToListAsync();
            Assert.Contains(notices, n => n.Text.Contains("Sửa chương 2"));
        });

        // 4. Cố gắng resolve trước khi nộp lại -> 409 Conflict
        var earlyResolve = await Send(new ResolveSubmissionRevisionRequestCommand(world.Lecturer.Id, world.TopicId, req.Id));
        Assert.Equal(TopicResultStatus.Conflict, earlyResolve.Status);

        // 5. Nhóm nộp lại bản 2 giữa kỳ
        _clock.Advance(TimeSpan.FromHours(1));
        var sub2 = await Send(new SubmitReportCommand(world.Students[1].Id, ViewerRole.Student, world.TopicId,
            "midterm", "bc2.pdf", SubmissionWorkflowTests.Pdf("v2"), "Đã sửa theo yêu cầu"));
        Assert.Equal(TopicResultStatus.Created, sub2.Status);

        var listRes = await Send(new ListSubmissionsQuery(world.Lecturer.Id, ViewerRole.Lecturer, world.TopicId));
        midterm = listRes.Response.Data!.Kinds.Single(k => k.Kind == "midterm");
        Assert.Equal(2, midterm.Versions.Count);
        // Bản 2 liên kết với req.Id
        Assert.Contains(req.Id, midterm.Versions[0].AddressedRequestIds);
        // req phản ánh AddressedInVersions = [2] và CanResolve = true
        var updatedReq = midterm.Requests.Single(r => r.Id == req.Id);
        Assert.Equal([2], updatedReq.AddressedInVersions);
        Assert.True(updatedReq.CanResolve);

        // 6. GVHD xác nhận hoàn tất yêu cầu
        var resolveRes = await Send(new ResolveSubmissionRevisionRequestCommand(world.Lecturer.Id, world.TopicId, req.Id));
        Assert.Equal(TopicResultStatus.Ok, resolveRes.Status);
        var resolvedReq = resolveRes.Response.Data!.Kinds.Single(k => k.Kind == "midterm").Requests.Single(r => r.Id == req.Id);
        Assert.Equal("resolved", resolvedReq.Status);
        Assert.Equal($"Người {world.Lecturer.Code}", resolvedReq.ResolvedBy);
        Assert.NotNull(resolvedReq.ResolvedAt);
        Assert.False(resolvedReq.CanResolve);

        // 7. Xác nhận lần nữa -> 409 Conflict
        var secondResolve = await Send(new ResolveSubmissionRevisionRequestCommand(world.Lecturer.Id, world.TopicId, req.Id));
        Assert.Equal(TopicResultStatus.Conflict, secondResolve.Status);
    }

    [Fact]
    public async Task RequestsAreIsolatedBetweenKinds()
    {
        var world = await RunningTopic();

        // Nộp cả giữa kỳ và cuối kỳ
        await Send(new SubmitReportCommand(world.Students[0].Id, ViewerRole.Student, world.TopicId,
            "midterm", "gk.pdf", SubmissionWorkflowTests.Pdf("gk"), null));
        await Send(new SubmitReportCommand(world.Students[0].Id, ViewerRole.Student, world.TopicId,
            "final", "ck.pdf", SubmissionWorkflowTests.Pdf("ck"), "Bản cuối 1"));

        // Tạo yêu cầu cho giữa kỳ
        await Send(new CreateSubmissionRevisionRequestCommand(world.Lecturer.Id, world.TopicId, "midterm", "Yêu cầu giữa kỳ"));
        // Tạo yêu cầu cho cuối kỳ
        await Send(new CreateSubmissionRevisionRequestCommand(world.Lecturer.Id, world.TopicId, "final", "Yêu cầu cuối kỳ"));

        var list = (await Send(new ListSubmissionsQuery(world.Lecturer.Id, ViewerRole.Lecturer, world.TopicId))).Response.Data!;
        var midterm = list.Kinds.Single(k => k.Kind == "midterm");
        var final = list.Kinds.Single(k => k.Kind == "final");

        Assert.Single(midterm.Requests);
        Assert.Equal("Yêu cầu giữa kỳ", midterm.Requests[0].Content);

        Assert.Single(final.Requests);
        Assert.Equal("Yêu cầu cuối kỳ", final.Requests[0].Content);

        // Nộp lại giữa kỳ không liên kết yêu cầu cuối kỳ
        _clock.Advance(TimeSpan.FromHours(1));
        var subMid2 = await Send(new SubmitReportCommand(world.Students[0].Id, ViewerRole.Student, world.TopicId,
            "midterm", "gk2.pdf", SubmissionWorkflowTests.Pdf("gk2"), null));
        var v2Mid = subMid2.Response.Data!.Kinds.Single(k => k.Kind == "midterm").Versions[0];
        Assert.Contains(midterm.Requests[0].Id, v2Mid.AddressedRequestIds);
        Assert.DoesNotContain(final.Requests[0].Id, v2Mid.AddressedRequestIds);
    }

    [Fact]
    public async Task OpenFinalRequestBlocksThesisLockUntilSupervisorResolves()
    {
        var world = await RunningTopic();
        await Send(new SubmitReportCommand(world.Students[0].Id, ViewerRole.Student, world.TopicId,
            "final", "ck.pdf", SubmissionWorkflowTests.Pdf("ck"), "Bản 1"));
        var created = await Send(new CreateSubmissionRevisionRequestCommand(world.Lecturer.Id, world.TopicId, "final", "Sửa kết luận"));
        Assert.Equal(TopicResultStatus.Ok, created.Status);
        var requestId = created.Response.Data!.Kinds.Single(k => k.Kind == "final").Requests[0].Id;

        _clock.Set(new DateTimeOffset(2026, 10, 30, 3, 0, 0, TimeSpan.Zero));
        var thesis = await Send(new SubmitReportCommand(world.Students[0].Id, ViewerRole.Student, world.TopicId,
            "thesis", "kl.pdf", SubmissionWorkflowTests.Pdf("kl"), null));
        Assert.Equal(TopicResultStatus.Created, thesis.Status);
        var kind = thesis.Response.Data!.Kinds.Single(k => k.Kind == "thesis");
        Assert.False(kind.CanLock);
        Assert.Contains("1 yêu cầu", kind.LockBlockedReason);
        var versionId = kind.Versions[0].Id;

        // Nhóm không chốt được khi còn yêu cầu chỉnh sửa Cuối kỳ mở.
        Assert.Equal(TopicResultStatus.Conflict,
            (await Send(new LockThesisCommand(world.Students[0].Id, world.TopicId, versionId))).Status);

        // GVHD xác nhận hoàn tất thì chốt được.
        await Db(async db =>
        {
            await db.RevisionRequests.Where(r => r.Id == requestId).ExecuteUpdateAsync(set => set
                .SetProperty(r => r.ResolvedAt, DateTime.UtcNow).SetProperty(r => r.ResolvedById, world.Lecturer.Id));
        });
        var after = await Send(new ListSubmissionsQuery(world.Students[0].Id, ViewerRole.Student, world.TopicId));
        var unblocked = after.Response.Data!.Kinds.Single(k => k.Kind == "thesis");
        Assert.True(unblocked.CanLock);
        Assert.Null(unblocked.LockBlockedReason);
        Assert.Equal(TopicResultStatus.Ok,
            (await Send(new LockThesisCommand(world.Students[0].Id, world.TopicId, versionId))).Status);
    }
}
