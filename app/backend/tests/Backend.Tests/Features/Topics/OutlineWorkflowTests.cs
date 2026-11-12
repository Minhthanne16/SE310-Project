using System.Text;
using Backend.Application;
using Backend.Application.Common.Storage;
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

// P04-S01: đề cương và yêu cầu chỉnh sửa theo PDR-013 (cùng PDR-039/040/042/047/049),
// chạy handler thật trên repository EF Core thật (SQLite trong bộ nhớ).
public sealed class OutlineWorkflowTests : IDisposable
{
    // Mốc 2026: "GV gửi đề tài" 09-01..06, "SV đăng ký" 09-08..13, "Đề cương" 09-15..20.
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset DuringOutline = new(2026, 9, 16, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset LastOutlineDay = new(2026, 9, 20, 16, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset AfterOutline = new(2026, 9, 21, 3, 0, 0, TimeSpan.Zero);

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;
    private readonly ManualTimeProvider _clock = new(DuringSubmission);
    private readonly InMemoryAvatarStorage _files = new();

    public OutlineWorkflowTests()
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
        services.AddSingleton<IDocumentStorage>(_files);
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
        // Mỗi thao tác cách nhau một phút để lịch sử có thứ tự rõ.
        _clock.Advance(TimeSpan.FromMinutes(1));
        using var scope = _provider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    private sealed record Person(Guid Id, string Code);

    private sealed record World(Guid RoundId, Guid TopicId, Person Supervisor, Person OtherLecturer,
        Person Rep, Person Partner, Person OtherStudent);

    private async Task<Person> Seed(UserRole role, string code)
    {
        using var scope = _provider.CreateScope();
        var id = await RoundWorkflowTests.SeedUser(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            role, code, $"Người {code}", role == UserRole.Student ? "KTPM2023" : "CNPM");
        return new Person(id, code);
    }

    // Đợt đang diễn ra, một đề tài đã công bố và được nhóm 2 SV ghi danh; thời điểm đang trong mốc Đề cương.
    private async Task<World> RegisteredTopic()
    {
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var supervisor = await Seed(UserRole.Lecturer, $"GV{s}1");
        var other = await Seed(UserRole.Lecturer, $"GV{s}2");
        var rep = await Seed(UserRole.Student, $"SV{s}1");
        var partner = await Seed(UserRole.Student, $"SV{s}2");
        var otherStudent = await Seed(UserRole.Student, $"SV{s}3");
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [supervisor.Code, other.Code]));
        await Send(new AddParticipantsCommand(round.Id, "students", [rep.Code, partner.Code, otherStudent.Code]));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(round.Id))).Status);
        var topicId = (await Send(new CreateTopicCommand(supervisor.Id, new TopicInputDto
        {
            RoundId = round.Id, Title = "Hệ thống gợi ý", Field = "CNPM", Description = "Mô tả"
        }))).Response.Data!.Id;
        Assert.Equal(RoundResultStatus.Ok, (await Send(new PublishRoundTopicsCommand(round.Id))).Status);
        Assert.Equal(TopicResultStatus.Ok, (await Send(new RegisterTopicCommand(rep.Id, topicId, [partner.Code]))).Status);
        _clock.Set(DuringOutline);
        return new World(round.Id, topicId, supervisor, other, rep, partner, otherStudent);
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

    private static byte[] Pdf(string text = "đề cương") => Encoding.UTF8.GetBytes($"%PDF-1.7\n{text}\n%%EOF");

    private Task<TopicResult<OutlineDto>> Submit(World w, Person who, string note = "", string file = "de-cuong.pdf", byte[]? content = null) =>
        Send(new SubmitOutlineCommand(who.Id, w.TopicId, content ?? Pdf(note), file, note));

    private async Task<OutlineDto> View(World w, Person who, ViewerRole role) =>
        (await Send(new GetOutlineQuery(w.TopicId, who.Id, role))).Response.Data!;

    private Task<TopicResult<OutlineDto>> Request(World w, Person who, string content) =>
        Send(new CreateRevisionRequestCommand(who.Id, w.TopicId, content));

    private Task<TopicResult<OutlineDto>> Resolve(World w, Person who, Guid requestId) =>
        Send(new ResolveRevisionRequestCommand(who.Id, w.TopicId, requestId));

    private Task<TopicResult<OutlineDto>> Approve(World w, Person who, Guid submissionId) =>
        Send(new ApproveOutlineCommand(who.Id, w.TopicId, submissionId));

    [Fact]
    public async Task EachSubmissionIsANewVersionAndOldVersionsAreKept()
    {
        var w = await RegisteredTopic();

        var first = await Submit(w, w.Rep, "Bản đầu");
        var second = await Submit(w, w.Partner, "Bổ sung phạm vi");

        Assert.Equal(TopicResultStatus.Ok, first.Status);
        Assert.Equal(TopicResultStatus.Ok, second.Status);
        var outline = second.Response.Data!;
        Assert.Equal([2, 1], outline.Submissions.Select(s => s.VersionNo));
        Assert.Equal("Bổ sung phạm vi", outline.Submissions[0].Note);
        Assert.Equal($"Người {w.Partner.Code}", outline.Submissions[0].SubmittedBy);
        Assert.Equal(outline.Submissions[0].Id, outline.CurrentSubmissionId);
        Assert.False(outline.Submissions[0].Late);
        // Cả hai tệp còn nguyên trong storage, bản mới không ghi đè bản cũ.
        foreach (var version in outline.Submissions)
        {
            var file = await Send(new DownloadSubmissionQuery(w.TopicId, version.Id, w.Rep.Id, ViewerRole.Student));
            Assert.Equal(TopicResultStatus.Ok, file.Status);
            Assert.StartsWith("%PDF-", Encoding.UTF8.GetString(file.Response.Data!.Content));
        }
        var history = (await Send(new GetTopicQuery(w.TopicId, Guid.Empty, ViewerRole.AcademicAffairs))).Response.Data!.History;
        Assert.Equal("Nộp đề cương lần 2", history[0].Action);
        Assert.Equal("Bài nộp", history[0].Category);
    }

    [Theory]
    [InlineData("de-cuong.pdf", false, "Tệp không phải PDF.")]
    [InlineData("de-cuong.docx", false, "Tệp không phải PDF.")]
    [InlineData("de-cuong.pdf", true, "Tệp vượt quá 20 MB.")]
    public async Task OnlyRealPdfFilesUpTo20MbAreAccepted(string fileName, bool tooLarge, string message)
    {
        var w = await RegisteredTopic();
        var content = tooLarge
            ? Pdf().Concat(new byte[OutlineRules.MaxFileBytes]).ToArray()
            : Encoding.UTF8.GetBytes("PK\u0003\u0004 không phải pdf");

        var result = await Submit(w, w.Rep, file: fileName, content: content);

        Assert.Equal(TopicResultStatus.Invalid, result.Status);
        Assert.Equal(message, result.Response.Message);
        Assert.Empty((await View(w, w.Rep, ViewerRole.Student)).Submissions);
    }

    [Fact]
    public async Task ExactlyTwentyMegabytesIsAccepted()
    {
        var w = await RegisteredTopic();
        var content = Pdf().Concat(new byte[OutlineRules.MaxFileBytes - Pdf().Length]).ToArray();

        Assert.Equal(TopicResultStatus.Ok, (await Submit(w, w.Rep, content: content)).Status);
    }

    [Fact]
    public async Task OnlyMembersOfTheGroupSubmitAndOnlyRelatedPeopleSeeTheOutline()
    {
        var w = await RegisteredTopic();
        await Submit(w, w.Rep);

        Assert.Equal(TopicResultStatus.NotFound, (await Submit(w, w.OtherStudent)).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetOutlineQuery(w.TopicId, w.OtherStudent.Id, ViewerRole.Student))).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Send(new GetOutlineQuery(w.TopicId, w.OtherLecturer.Id, ViewerRole.Lecturer))).Status);
        var submission = (await View(w, w.Rep, ViewerRole.Student)).Submissions[0];
        Assert.Equal(TopicResultStatus.NotFound,
            (await Send(new DownloadSubmissionQuery(w.TopicId, submission.Id, w.OtherStudent.Id, ViewerRole.Student))).Status);

        var staff = await View(w, new Person(Guid.Empty, ""), ViewerRole.AcademicAffairs);
        Assert.Single(staff.Submissions);
        Assert.False(staff.CanSubmit);
        Assert.False(staff.CanReview);
        var supervisor = await View(w, w.Supervisor, ViewerRole.Lecturer);
        Assert.True(supervisor.CanReview);
        Assert.False(supervisor.CanSubmit);
    }

    [Fact]
    public async Task RevisionLoopWithSeveralRequestsUntilApproval()
    {
        var w = await RegisteredTopic();
        await Submit(w, w.Rep, "Bản 1");

        await Request(w, w.Supervisor, "Bổ sung mục tiêu");
        var two = (await Request(w, w.Supervisor, "Sửa phương pháp")).Response.Data!;
        Assert.Equal(2, two.Requests.Count(r => r.Status == "open"));
        Assert.All(two.Requests, r => Assert.Equal(1, r.RaisedOnVersionNo));

        // Sinh viên thấy yêu cầu cần xử lý; GVHD chưa đóng được khi nhóm chưa nộp lại.
        var student = await View(w, w.Rep, ViewerRole.Student);
        Assert.Equal(2, student.Requests.Count(r => r.Status == "open"));
        var early = await Resolve(w, w.Supervisor, two.Requests[0].Id);
        Assert.Equal(TopicResultStatus.Conflict, early.Status);
        Assert.Equal(OutlineRules.NotAddressedMessage, early.Response.Message);

        // Một lần nộp lại liên kết cả hai yêu cầu đang mở.
        var v2 = (await Submit(w, w.Partner, "Đã sửa cả hai")).Response.Data!;
        Assert.Equal(2, v2.Submissions[0].AddressedRequestIds.Count);
        Assert.All(v2.Requests, r => Assert.Equal([2], r.AddressedInVersions));

        var goal = v2.Requests.Single(r => r.Content == "Bổ sung mục tiêu");
        var method = v2.Requests.Single(r => r.Content == "Sửa phương pháp");
        var afterOne = (await Resolve(w, w.Supervisor, goal.Id)).Response.Data!;
        Assert.Equal("resolved", afterOne.Requests.Single(r => r.Id == goal.Id).Status);

        // Còn một yêu cầu mở thì không duyệt được.
        var blocked = await Approve(w, w.Supervisor, afterOne.CurrentSubmissionId!.Value);
        Assert.Equal(TopicResultStatus.Conflict, blocked.Status);
        Assert.Equal(OutlineRules.OpenRequestsMessage(1), blocked.Response.Message);
        Assert.False(afterOne.CanApprove);

        // Yêu cầu chưa đạt vẫn mở cho lần nộp sau; bản 3 chỉ liên kết yêu cầu còn mở.
        var v3 = (await Submit(w, w.Rep, "Sửa phương pháp lần 2")).Response.Data!;
        Assert.Equal([method.Id], v3.Submissions[0].AddressedRequestIds);
        await Resolve(w, w.Supervisor, method.Id);

        var approved = await Approve(w, w.Supervisor, v3.Submissions[0].Id);
        Assert.Equal(TopicResultStatus.Ok, approved.Status);
        var outline = approved.Response.Data!;
        Assert.NotNull(outline.ApprovedAt);
        Assert.Equal(3, outline.ApprovedVersionNo);
        Assert.Equal($"Người {w.Supervisor.Code}", outline.ApprovedBy);
        // Duyệt đề cương không đổi trạng thái đề tài (PDR-049).
        var topic = (await Send(new GetTopicQuery(w.TopicId, Guid.Empty, ViewerRole.AcademicAffairs))).Response.Data!;
        Assert.Equal("Đang thực hiện", topic.Status);
        Assert.NotNull(topic.OutlineApprovedAt);
        Assert.Contains(topic.History, h => h.Action == "Duyệt đề cương lần 3");
    }

    [Fact]
    public async Task GroupMembersCannotResolveRequestsAndOtherLecturersCannotReview()
    {
        var w = await RegisteredTopic();
        await Submit(w, w.Rep);
        var request = (await Request(w, w.Supervisor, "Sửa")).Response.Data!.Requests[0];
        await Submit(w, w.Rep, "Đã sửa");

        Assert.Equal(TopicResultStatus.NotFound, (await Resolve(w, w.Rep, request.Id)).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Resolve(w, w.OtherLecturer, request.Id)).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Request(w, w.OtherLecturer, "Không được")).Status);
        var current = (await View(w, w.Rep, ViewerRole.Student)).CurrentSubmissionId!.Value;
        Assert.Equal(TopicResultStatus.NotFound, (await Approve(w, w.OtherLecturer, current)).Status);
        Assert.False((await View(w, w.Rep, ViewerRole.Student)).Requests[0].CanResolve);

        // Đóng lặp không đổi gì.
        Assert.Equal(TopicResultStatus.Ok, (await Resolve(w, w.Supervisor, request.Id)).Status);
        Assert.Equal(TopicResultStatus.Conflict, (await Resolve(w, w.Supervisor, request.Id)).Status);
    }

    [Fact]
    public async Task OnlyTheCurrentVersionCanBeApproved()
    {
        var w = await RegisteredTopic();
        var v1 = (await Submit(w, w.Rep)).Response.Data!.Submissions[0];
        await Submit(w, w.Rep, "Bản mới hơn");

        var stale = await Approve(w, w.Supervisor, v1.Id);

        Assert.Equal(TopicResultStatus.Conflict, stale.Status);
        Assert.Equal(OutlineRules.NotCurrentMessage, stale.Response.Message);
    }

    [Fact]
    public async Task NothingCanBeSubmittedOrRequestedAfterApproval()
    {
        var w = await RegisteredTopic();
        var v1 = (await Submit(w, w.Rep)).Response.Data!.Submissions[0];
        Assert.Equal(TopicResultStatus.Ok, (await Approve(w, w.Supervisor, v1.Id)).Status);

        var submit = await Submit(w, w.Rep);
        Assert.Equal(TopicResultStatus.Conflict, submit.Status);
        Assert.Equal(OutlineRules.AlreadyApprovedMessage, submit.Response.Message);
        Assert.Equal(TopicResultStatus.Conflict, (await Request(w, w.Supervisor, "Muộn")).Status);
        Assert.Equal(TopicResultStatus.Conflict, (await Approve(w, w.Supervisor, v1.Id)).Status);
        var outline = await View(w, w.Rep, ViewerRole.Student);
        Assert.False(outline.CanSubmit);
        Assert.Equal(OutlineRules.AlreadyApprovedMessage, outline.SubmitBlockedReason);
    }

    [Fact]
    public async Task SubmissionsCloseAfterTheOutlineMilestoneWhenNoLateDeadlineIsSet()
    {
        var w = await RegisteredTopic();
        await Submit(w, w.Rep);
        await Request(w, w.Supervisor, "Sửa");

        _clock.Set(LastOutlineDay);
        Assert.Equal(TopicResultStatus.Ok, (await Submit(w, w.Rep, "Ngày cuối")).Status);

        _clock.Set(AfterOutline);
        var late = await Submit(w, w.Rep, "Quá hạn");
        Assert.Equal(TopicResultStatus.Conflict, late.Status);
        Assert.Equal("Đã hết hạn nộp đề cương (20/09/2026).", late.Response.Message);
        // Yêu cầu chỉnh sửa không mở thêm hạn (PDR-013); GVHD vẫn xử lý được.
        var outline = await View(w, w.Supervisor, ViewerRole.Lecturer);
        Assert.False((await View(w, w.Rep, ViewerRole.Student)).CanSubmit);
        Assert.True(outline.CanReview);
    }

    [Fact]
    public async Task TheSupervisorCommentsOnAVersion()
    {
        var w = await RegisteredTopic();
        var v1 = (await Submit(w, w.Rep)).Response.Data!.Submissions[0];

        var commented = await Send(new CommentOutlineCommand(w.Supervisor.Id, w.TopicId, v1.Id, "  Phạm vi còn rộng.  "));

        Assert.Equal(TopicResultStatus.Ok, commented.Status);
        var version = commented.Response.Data!.Submissions[0];
        Assert.Equal("Phạm vi còn rộng.", version.ReviewComment);
        Assert.Equal($"Người {w.Supervisor.Code}", version.ReviewedBy);
        Assert.Equal(TopicResultStatus.NotFound,
            (await Send(new CommentOutlineCommand(w.Rep.Id, w.TopicId, v1.Id, "SV không nhận xét"))).Status);
    }

    [Fact]
    public async Task ARequestNeedsASubmittedVersion()
    {
        var w = await RegisteredTopic();

        var result = await Request(w, w.Supervisor, "Chưa có bản");

        Assert.Equal(TopicResultStatus.Conflict, result.Status);
        Assert.Equal(OutlineRules.NoSubmissionMessage, result.Response.Message);
    }

    [Fact]
    public async Task RegistrationCannotBeCancelledAfterTheOutlineIsSubmitted()
    {
        var w = await RegisteredTopic();
        // Nộp đề cương trong lúc đăng ký còn mở, rồi thử hủy ghi danh (PDR-047).
        _clock.Set(new DateTimeOffset(2026, 9, 9, 3, 0, 0, TimeSpan.Zero));
        await Submit(w, w.Rep);

        var cancel = await Send(new CancelRegistrationCommand(w.Partner.Id, w.TopicId));

        Assert.Equal(TopicResultStatus.Conflict, cancel.Status);
        Assert.Equal(TopicRules.OutlineSubmittedMessage, cancel.Response.Message);
    }
    // Kiểm tra trong handler có thể lỗi thời khi hai thao tác chạy song song; câu cập nhật
    // duyệt phải tự kiểm lại "không còn yêu cầu mở" và "không có phiên bản mới hơn".
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ApprovalWriteRechecksOpenRequestsAndNewerVersions(bool openRequest)
    {
        var w = await RegisteredTopic();
        var v1 = (await Submit(w, w.Rep)).Response.Data!.Submissions[0];
        if (openRequest) await Request(w, w.Supervisor, "Bổ sung phạm vi");
        else await Submit(w, w.Rep, "Bản mới hơn");

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var repo = scope.ServiceProvider.GetRequiredService<IOutlineRepository>();
        var topic = await db.ThesisTopics.SingleAsync(t => t.Id == w.TopicId);
        var submission = (await repo.GetSubmissionAsync(v1.Id))!;
        var now = _clock.GetUtcNow().UtcDateTime;

        var outcome = await repo.ApproveAsync(w.TopicId, submission, w.Supervisor.Id, now,
            new TopicHistoryEntry
            {
                TopicId = topic.Id, ActorUserId = w.Supervisor.Id, Category = TopicHistoryCategories.Submission,
                Action = "Duyệt đề cương lần 1", CreatedAt = now
            }, []);

        Assert.Equal(OutlineWriteOutcome.Stale, outcome);
        Assert.Null((await db.ThesisTopics.AsNoTracking().SingleAsync(t => t.Id == w.TopicId)).OutlineApprovedAt);
    }
    // Danh sách nhóm hướng dẫn: lượt tiếp theo thuộc GVHD khi có phiên bản mới hơn mọi yêu cầu mở.
    [Fact]
    public async Task SupervisorListShowsWhoseTurnItIs()
    {
        var w = await RegisteredTopic();
        async Task<OutlineSummaryDto?> Summary() =>
            (await Send(new ListMyTopicsQuery(w.Supervisor.Id, w.RoundId))).Response.Data!.Items.Single().Outline;

        Assert.Equal((0, 0, false), Tuple(await Summary()));
        var v1 = (await Submit(w, w.Rep)).Response.Data!.Submissions[0];
        Assert.Equal((1, 0, true), Tuple(await Summary()));
        var request = (await Request(w, w.Supervisor, "Bổ sung phạm vi")).Response.Data!.Requests[0];
        Assert.Equal((1, 1, false), Tuple(await Summary()));
        var v2 = (await Submit(w, w.Partner, "Đã bổ sung")).Response.Data!.Submissions[0];
        Assert.Equal((2, 1, true), Tuple(await Summary()));
        await Resolve(w, w.Supervisor, request.Id);
        Assert.Equal(TopicResultStatus.Ok, (await Approve(w, w.Supervisor, v2.Id)).Status);
        Assert.Equal((2, 0, false), Tuple(await Summary()));
        Assert.NotEqual(v1.Id, v2.Id);
    }

    private static (int, int, bool) Tuple(OutlineSummaryDto? s) =>
        s is null ? (-1, -1, false) : (s.Versions, s.OpenRequests, s.AwaitingReview);
}
