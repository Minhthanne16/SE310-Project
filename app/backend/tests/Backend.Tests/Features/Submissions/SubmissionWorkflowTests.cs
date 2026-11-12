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

// P04-S02: nộp và đọc báo cáo giữa kỳ/cuối kỳ (PDR-039–042, PDR-056). Handler thật trên
// repository EF Core thật (SQLite trong bộ nhớ); object storage là bản giả trong bộ nhớ.
public sealed class SubmissionWorkflowTests : IDisposable
{
    // Mốc: SV đăng ký 2026-09-08..13, Giữa kỳ 09-22..27 (hạn trễ 09-30), Cuối kỳ 09-29..10-04 (tắt nộp trễ).
    private static readonly DateTimeOffset DuringSubmission = new(2026, 9, 2, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset BeforeMidtermDeadline = new(2026, 9, 23, 3, 0, 0, TimeSpan.Zero);
    // 23:00 ngày 27/09 giờ Việt Nam: vẫn đúng hạn.
    private static readonly DateTimeOffset MidtermLastMinute = new(2026, 9, 27, 16, 0, 0, TimeSpan.Zero);
    // 00:30 ngày 28/09 giờ Việt Nam: đã qua hạn thường, còn trong hạn trễ.
    private static readonly DateTimeOffset MidtermLateWindow = new(2026, 9, 27, 17, 30, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset MidtermLastLateMinute = new(2026, 9, 30, 16, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset AfterMidtermLate = new(2026, 9, 30, 17, 30, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset FinalLastMinute = new(2026, 10, 4, 16, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset AfterFinal = new(2026, 10, 4, 17, 30, 0, TimeSpan.Zero);

    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;
    private readonly ManualTimeProvider _clock = new(DuringSubmission);
    private readonly InMemoryDocumentStorage _storage = new();
    private bool _failDatabase;

    public SubmissionWorkflowTests()
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
        services.AddScoped<ISubmissionRepository>(p =>
            new FailingRepository(new SubmissionRepository(p.GetRequiredService<ApplicationDbContext>()), () => _failDatabase));
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

    internal static byte[] Pdf(string marker = "x", int padTo = 0)
    {
        var body = $"%PDF-1.7\n1 0 obj\n<< /Marker ({marker}) >>\nendobj\n";
        var tail = "\ntrailer\n<< >>\n%%EOF\n";
        var pad = Math.Max(0, padTo - body.Length - tail.Length);
        return Encoding.ASCII.GetBytes(body + new string(' ', pad) + tail);
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
    private sealed record World(Guid RoundId, Person Lecturer, Person OtherLecturer, Person[] Students, Guid TopicId, Guid OtherTopicId);

    private async Task<Person> Seed(UserRole role, string code)
    {
        using var scope = _provider.CreateScope();
        var id = await RoundWorkflowTests.SeedUser(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(),
            role, code, $"Người {code}", role == UserRole.Student ? "KTPM2023" : "CNPM");
        return new Person(id, code);
    }

    internal static RoundMilestonesInputDto Dated()
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
                // Cuối kỳ tắt nộp trễ; Đề cương và Giữa kỳ có hạn trễ 3 ngày sau hạn thường.
                AllowLate = ThesisRound.HasLateToggle(key) ? key != MilestoneKey.Final : null,
                LateEndDate = key is MilestoneKey.Outline or MilestoneKey.Midterm ? start.AddDays(i * 7 + 8).ToString("yyyy-MM-dd") : null
            }).ToList()
        };
    }

    // Đợt đang diễn ra: nhóm [SV1, SV2] nhận đề tài 1, nhóm [SV3] nhận đề tài 2, SV4 chưa có nhóm.
    // Trả về khi đồng hồ ở trước hạn giữa kỳ (đăng ký đã đóng, đề tài Đang thực hiện).
    private async Task<World> RunningTopic()
    {
        var s = Guid.NewGuid().ToString("N")[..5].ToUpperInvariant();
        var lecturer = await Seed(UserRole.Lecturer, $"GV{s}");
        var other = await Seed(UserRole.Lecturer, $"GX{s}");
        var students = new[] { await Seed(UserRole.Student, $"SV{s}1"), await Seed(UserRole.Student, $"SV{s}2"),
            await Seed(UserRole.Student, $"SV{s}3"), await Seed(UserRole.Student, $"SV{s}4") };
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = $"Đợt {s}", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;
        Assert.Equal(RoundResultStatus.Ok, (await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()))).Status);
        await Send(new AddParticipantsCommand(round.Id, "lecturers", [lecturer.Code, other.Code]));
        await Send(new AddParticipantsCommand(round.Id, "students", students.Select(x => x.Code).ToList()));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(round.Id))).Status);
        var ids = new List<Guid>();
        for (var i = 1; i <= 2; i++)
            ids.Add((await Send(new CreateTopicCommand(lecturer.Id, new TopicInputDto
            {
                RoundId = round.Id, Title = $"Đề tài {i}", Field = "CNPM", Description = "Mô tả"
            }))).Response.Data!.Id);
        _clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(RoundResultStatus.Ok, (await Send(new PublishRoundTopicsCommand(round.Id))).Status);
        _clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(TopicResultStatus.Ok, (await Send(new RegisterTopicCommand(students[0].Id, ids[0], [students[1].Code]))).Status);
        Assert.Equal(TopicResultStatus.Ok, (await Send(new RegisterTopicCommand(students[2].Id, ids[1], []))).Status);
        _clock.Set(BeforeMidtermDeadline);
        return new World(round.Id, lecturer, other, students, ids[0], ids[1]);
    }

    private Task<TopicResult<TopicSubmissionsDto>> Submit(Person who, Guid topicId, string kind, byte[] content,
        string fileName = "bao-cao.pdf", string? note = null, ViewerRole role = ViewerRole.Student)
    {
        _clock.Advance(TimeSpan.FromSeconds(1));
        return Send(new SubmitReportCommand(who.Id, role, topicId, kind, fileName, content, note));
    }

    private Task<TopicResult<TopicSubmissionsDto>> List(Person who, Guid topicId, ViewerRole role = ViewerRole.Student) =>
        Send(new ListSubmissionsQuery(who.Id, role, topicId));

    private Task<TopicResult<SubmissionFile>> Download(Person who, Guid submissionId, ViewerRole role = ViewerRole.Student) =>
        Send(new GetSubmissionFileQuery(who.Id, role, submissionId));

    private static SubmissionKindDto Kind(TopicSubmissionsDto dto, string kind) => dto.Kinds.Single(k => k.Kind == kind);

    private async Task<int> RecordCount()
    {
        var count = 0;
        await Db(async db => count = await db.Submissions.CountAsync());
        return count;
    }

    [Fact]
    public async Task AValidPdfIsStoredWithSubmitterTimeAndVersion()
    {
        var w = await RunningTopic();
        var pdf = Pdf("v1");

        var result = await Submit(w.Students[1], w.TopicId, "midterm", pdf, "Báo cáo giữa kỳ.pdf", "  Bản đầu  ");

        Assert.Equal(TopicResultStatus.Created, result.Status);
        var version = Assert.Single(Kind(result.Response.Data!, "midterm").Versions);
        Assert.Equal(1, version.Version);
        Assert.Equal("Báo cáo giữa kỳ.pdf", version.FileName);
        Assert.Equal(pdf.Length, version.SizeBytes);
        Assert.Equal("Bản đầu", version.Note);
        Assert.Equal(w.Students[1].Code, version.SubmittedBy.Code);
        Assert.Equal(_clock.GetUtcNow().UtcDateTime, version.SubmittedAt);
        Assert.False(version.IsLate);
        Assert.True(version.IsLatest);
        Assert.Empty(Kind(result.Response.Data!, "final").Versions);

        var file = await Download(w.Students[0], version.Id);
        Assert.Equal(TopicResultStatus.Ok, file.Status);
        Assert.Equal(pdf, file.Response.Data!.Content);
        Assert.Equal("Báo cáo giữa kỳ.pdf", file.Response.Data.FileName);

        // Lịch sử đề tài ghi lần nộp (BUSINESS_RULES · Truy vết).
        var detail = (await Send(new GetTopicQuery(w.TopicId, w.Lecturer.Id, ViewerRole.Lecturer))).Response.Data!;
        var entry = detail.History.First();
        Assert.Equal("Bài nộp", entry.Category);
        Assert.Equal("Nộp báo cáo giữa kỳ", entry.Action);
        Assert.Contains("Bản 1", entry.Detail);
    }

    [Theory]
    [InlineData("khong-phai-pdf.docx")]
    [InlineData("gia-pdf.pdf")]
    public async Task ContentThatIsNotPdfIsRejectedWhateverTheFileName(string fileName)
    {
        var w = await RunningTopic();
        // Nội dung ZIP/DOCX: tên tệp hay phần mở rộng không được tin (PDR-039).
        var content = new byte[] { 0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x25, 0x25, 0x45, 0x4F, 0x46 };

        var result = await Submit(w.Students[0], w.TopicId, "midterm", content, fileName);

        Assert.Equal(TopicResultStatus.Invalid, result.Status);
        Assert.Equal(SubmissionPolicy.NotPdfMessage, result.Response.Message);
        Assert.Equal(0, await RecordCount());
        Assert.Empty(_storage.Objects);
    }

    [Fact]
    public async Task APdfHeaderWithoutPdfStructureIsRejected()
    {
        var w = await RunningTopic();

        var result = await Submit(w.Students[0], w.TopicId, "midterm", Encoding.ASCII.GetBytes("%PDF-1.7 chỉ có phần đầu, không có kết thúc tệp"));

        Assert.Equal(TopicResultStatus.Invalid, result.Status);
        Assert.Equal(SubmissionPolicy.NotPdfMessage, result.Response.Message);
        Assert.Empty(_storage.Objects);
    }

    [Fact]
    public async Task SizeLimitIsExactlyTwentyMegabytes()
    {
        var w = await RunningTopic();

        var atLimit = await Submit(w.Students[0], w.TopicId, "midterm", Pdf("max", (int)SubmissionPolicy.MaxBytes));
        var overLimit = await Submit(w.Students[0], w.TopicId, "midterm", Pdf("over", (int)SubmissionPolicy.MaxBytes + 1));
        var empty = await Submit(w.Students[0], w.TopicId, "midterm", []);

        Assert.Equal(TopicResultStatus.Created, atLimit.Status);
        Assert.Equal(TopicResultStatus.Invalid, overLimit.Status);
        Assert.Equal(SubmissionPolicy.TooLargeMessage, overLimit.Response.Message);
        Assert.Equal(TopicResultStatus.Invalid, empty.Status);
        Assert.Equal(1, await RecordCount());
        Assert.Single(_storage.Objects);
    }

    [Fact]
    public async Task OnlyGroupMembersSubmit()
    {
        var w = await RunningTopic();
        var pdf = Pdf();

        // Nhóm khác, sinh viên chưa có nhóm: không lộ đề tài.
        Assert.Equal(TopicResultStatus.NotFound, (await Submit(w.Students[2], w.TopicId, "midterm", pdf)).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Submit(w.Students[3], w.TopicId, "midterm", pdf)).Status);
        // GVHD và Giáo vụ xem được nhưng không nộp thay nhóm.
        Assert.Equal(TopicResultStatus.Forbidden, (await Submit(w.Lecturer, w.TopicId, "midterm", pdf, role: ViewerRole.Lecturer)).Status);
        Assert.Equal(TopicResultStatus.Forbidden, (await Submit(w.Lecturer, w.TopicId, "midterm", pdf, role: ViewerRole.AcademicAffairs)).Status);
        Assert.Equal(TopicResultStatus.NotFound, (await Submit(w.OtherLecturer, w.TopicId, "midterm", pdf, role: ViewerRole.Lecturer)).Status);
        Assert.Equal(0, await RecordCount());
        Assert.Empty(_storage.Objects);

        // Cả đại diện lẫn thành viên còn lại đều nộp được (WORKFLOWS §2.1).
        Assert.Equal(TopicResultStatus.Created, (await Submit(w.Students[0], w.TopicId, "midterm", pdf)).Status);
        Assert.Equal(TopicResultStatus.Created, (await Submit(w.Students[1], w.TopicId, "midterm", pdf)).Status);
    }

    [Fact]
    public async Task ReadingFollowsRoleAndRelationToTheTopic()
    {
        var w = await RunningTopic();
        var id = Kind((await Submit(w.Students[0], w.TopicId, "midterm", Pdf())).Response.Data!, "midterm").Versions[0].Id;

        foreach (var (who, role) in new[] { (w.Students[0], ViewerRole.Student), (w.Students[1], ViewerRole.Student),
                     (w.Lecturer, ViewerRole.Lecturer), (w.OtherLecturer, ViewerRole.AcademicAffairs) })
        {
            Assert.Equal(TopicResultStatus.Ok, (await List(who, w.TopicId, role)).Status);
            Assert.Equal(TopicResultStatus.Ok, (await Download(who, id, role)).Status);
        }
        foreach (var (who, role) in new[] { (w.Students[2], ViewerRole.Student), (w.Students[3], ViewerRole.Student),
                     (w.OtherLecturer, ViewerRole.Lecturer) })
        {
            Assert.Equal(TopicResultStatus.NotFound, (await List(who, w.TopicId, role)).Status);
            Assert.Equal(TopicResultStatus.NotFound, (await Download(who, id, role)).Status);
        }
        Assert.Equal(TopicResultStatus.NotFound, (await Download(w.Students[0], Guid.NewGuid())).Status);

        // Chỉ thành viên nhóm thấy quyền nộp.
        Assert.True(Kind((await List(w.Students[1], w.TopicId)).Response.Data!, "midterm").CanSubmit);
        Assert.False(Kind((await List(w.Lecturer, w.TopicId, ViewerRole.Lecturer)).Response.Data!, "midterm").CanSubmit);
    }

    [Fact]
    public async Task OnTimeLateAndClosedFollowTheMilestoneOfEachKind()
    {
        var w = await RunningTopic();

        _clock.Set(MidtermLastMinute);
        var onTime = await Submit(w.Students[0], w.TopicId, "midterm", Pdf("dung-han"));
        Assert.Equal(TopicResultStatus.Created, onTime.Status);
        Assert.Equal("onTime", Kind(onTime.Response.Data!, "midterm").Window);
        Assert.False(Kind(onTime.Response.Data!, "midterm").Versions[0].IsLate);

        _clock.Set(MidtermLateWindow);
        var late = await Submit(w.Students[0], w.TopicId, "midterm", Pdf("tre"));
        Assert.Equal(TopicResultStatus.Created, late.Status);
        var midterm = Kind(late.Response.Data!, "midterm");
        Assert.Equal("late", midterm.Window);
        Assert.Equal("2026-09-27", midterm.Deadline);
        Assert.Equal("2026-09-30", midterm.LateDeadline);
        Assert.Equal([true, false], midterm.Versions.Select(v => v.IsLate));

        _clock.Set(MidtermLastLateMinute);
        Assert.Equal(TopicResultStatus.Created, (await Submit(w.Students[0], w.TopicId, "midterm", Pdf("tre-phut-chot"))).Status);

        _clock.Set(AfterMidtermLate);
        var closed = await Submit(w.Students[0], w.TopicId, "midterm", Pdf("qua-han"));
        Assert.Equal(TopicResultStatus.Conflict, closed.Status);
        Assert.Contains("30/09/2026", closed.Response.Message);
        var view = Kind((await List(w.Students[0], w.TopicId)).Response.Data!, "midterm");
        Assert.Equal("closed", view.Window);
        Assert.False(view.CanSubmit);
        Assert.Equal(3, view.Versions.Count);

        // Hạn trễ của Giữa kỳ không mở quyền nộp cho Cuối kỳ: mốc Cuối kỳ tắt nộp trễ.
        _clock.Set(FinalLastMinute);
        Assert.Equal(TopicResultStatus.Created, (await Submit(w.Students[0], w.TopicId, "final", Pdf("ck"), note: "Bản đầu")).Status);
        _clock.Set(AfterFinal);
        var finalClosed = await Submit(w.Students[0], w.TopicId, "final", Pdf("ck2"), note: "Sửa chương 3");
        Assert.Equal(TopicResultStatus.Conflict, finalClosed.Status);
        Assert.Contains("04/10/2026", finalClosed.Response.Message);
        Assert.Equal(4, await RecordCount());
        Assert.Equal(4, _storage.Objects.Count);
    }

    [Fact]
    public async Task ALateDeadlineDoesNotOpenSubmissionWhenLateIsSwitchedOff()
    {
        var w = await RunningTopic();
        var input = Dated();
        var midterm = input.Milestones.Single(m => m.Key == "midterm");
        midterm.AllowLate = false;
        Assert.Equal(RoundResultStatus.Ok, (await Send(new UpdateRoundMilestonesCommand(w.RoundId, input))).Status);

        _clock.Set(MidtermLateWindow);
        var result = await Submit(w.Students[0], w.TopicId, "midterm", Pdf());

        Assert.Equal(TopicResultStatus.Conflict, result.Status);
        Assert.Contains("27/09/2026", result.Response.Message);
    }

    [Fact]
    public async Task SubmissionOpensOnlyWhenTheTopicIsInProgress()
    {
        var w = await RunningTopic();

        // Còn trong thời gian đăng ký: đề tài mới Đã đăng ký, nhóm còn hủy ghi danh được.
        _clock.Set(new DateTimeOffset(2026, 9, 12, 3, 0, 0, TimeSpan.Zero));
        var early = await Submit(w.Students[0], w.TopicId, "midterm", Pdf());
        Assert.Equal(TopicResultStatus.Conflict, early.Status);
        Assert.Equal(SubmissionRules.NotInProgressMessage, early.Response.Message);

        _clock.Set(BeforeMidtermDeadline);
        var unknown = await Submit(w.Students[0], w.TopicId, "outline", Pdf());
        Assert.Equal(TopicResultStatus.Invalid, unknown.Status);
        Assert.Empty(_storage.Objects);
    }

    [Fact]
    public async Task FinalReportNeedsAChangeNoteAndMidtermDoesNot()
    {
        var w = await RunningTopic();

        var missing = await Submit(w.Students[0], w.TopicId, "final", Pdf(), note: "   ");
        var tooLong = await Submit(w.Students[0], w.TopicId, "final", Pdf(), note: new string('a', SubmissionPolicy.MaxNoteLength + 1));
        var ok = await Submit(w.Students[0], w.TopicId, "final", Pdf(), note: "Bổ sung chương 4");
        var midterm = await Submit(w.Students[0], w.TopicId, "midterm", Pdf());

        Assert.Equal(TopicResultStatus.Invalid, missing.Status);
        Assert.Equal(SubmissionPolicy.NoteRequiredMessage, missing.Response.Message);
        Assert.Equal(TopicResultStatus.Invalid, tooLong.Status);
        Assert.Equal(TopicResultStatus.Created, ok.Status);
        Assert.Equal(TopicResultStatus.Created, midterm.Status);
        Assert.True(Kind(ok.Response.Data!, "final").NoteRequired);
        Assert.Null(Kind(midterm.Response.Data!, "midterm").Versions[0].Note);
    }

    [Fact]
    public async Task EveryVersionSurvivesNewUploadsAndTheEndOfTheRound()
    {
        var w = await RunningTopic();
        var contents = new[] { Pdf("ban-1"), Pdf("ban-2"), Pdf("ban-3") };
        foreach (var content in contents)
            Assert.Equal(TopicResultStatus.Created, (await Submit(w.Students[0], w.TopicId, "final", content, note: "Cập nhật")).Status);

        // Kết thúc đợt không xóa tệp hay metadata (PDR-042).
        await Db(async db =>
        {
            var round = await db.ThesisRounds.SingleAsync(r => r.Id == w.RoundId);
            round.Status = RoundStatus.Finished;
            await db.SaveChangesAsync();
        });

        var versions = Kind((await List(w.Students[1], w.TopicId)).Response.Data!, "final").Versions;
        Assert.Equal([3, 2, 1], versions.Select(v => v.Version));
        Assert.Equal([true, false, false], versions.Select(v => v.IsLatest));
        for (var i = 0; i < 3; i++)
        {
            var id = versions.Single(v => v.Version == i + 1).Id;
            Assert.Equal(contents[i], (await Download(w.Lecturer, id, ViewerRole.Lecturer)).Response.Data!.Content);
            Assert.Equal(contents[i], (await Download(w.Students[0], id)).Response.Data!.Content);
        }

        // Đợt đã kết thúc thì chỉ đọc.
        var closed = await Submit(w.Students[0], w.TopicId, "final", Pdf("ban-4"), note: "Muộn");
        Assert.Equal(TopicResultStatus.Conflict, closed.Status);
        Assert.Equal(3, _storage.Objects.Count);
    }

    [Fact]
    public async Task AStorageFailureLeavesNoRecord()
    {
        var w = await RunningTopic();
        _storage.FailSave = true;

        await Assert.ThrowsAsync<StorageUnavailableException>(() => Submit(w.Students[0], w.TopicId, "midterm", Pdf()));

        Assert.Equal(0, await RecordCount());
        Assert.Empty(_storage.Objects);
        _storage.FailSave = false;
        var retry = await Submit(w.Students[0], w.TopicId, "midterm", Pdf());
        Assert.Equal(1, Kind(retry.Response.Data!, "midterm").Versions.Single().Version);
    }

    [Fact]
    public async Task ADatabaseFailureLeavesNoOrphanFile()
    {
        var w = await RunningTopic();
        _failDatabase = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() => Submit(w.Students[0], w.TopicId, "midterm", Pdf()));

        Assert.Equal(1, _storage.SaveCount);
        Assert.Empty(_storage.Objects);
        Assert.Equal(0, await RecordCount());
    }

    [Fact]
    public async Task AMissingObjectIsReportedInsteadOfAnEmptyFile()
    {
        var w = await RunningTopic();
        var id = Kind((await Submit(w.Students[0], w.TopicId, "midterm", Pdf())).Response.Data!, "midterm").Versions[0].Id;
        _storage.Objects.Clear();

        var result = await Download(w.Students[0], id);

        Assert.Equal(TopicResultStatus.NotFound, result.Status);
        Assert.Equal(SubmissionRules.FileMissingMessage, result.Response.Message);
    }

    [Fact]
    public async Task FileNamesAreReducedToASafeBaseName()
    {
        var w = await RunningTopic();

        var result = await Submit(w.Students[0], w.TopicId, "midterm", Pdf(), "..\\..\\etc/pass\"wd\r\n.PDF");

        var name = Kind(result.Response.Data!, "midterm").Versions[0].FileName;
        Assert.Equal("passwd.pdf", name);
        Assert.All(_storage.Objects.Keys, key => Assert.Matches("^submissions/[0-9a-f]{32}/midterm/[0-9a-f]{32}\\.pdf$", key));
    }

    // PDR-041: bật "Cho nộp trễ" thì phải có hạn trễ sau hạn thường; kiểm khi lưu và khi mở đợt.
    [Fact]
    public async Task LateSubmissionNeedsItsOwnDeadlineAfterTheNormalOne()
    {
        var round = (await Send(new CreateRoundCommand(new RoundInputDto { Name = "Đợt hạn trễ", Program = "Văn bằng 1", PeriodLabel = "K1" }))).Response.Data!;

        var notAfter = Dated();
        notAfter.Milestones.Single(m => m.Key == "midterm").LateEndDate = "2026-09-27";
        var rejected = await Send(new UpdateRoundMilestonesCommand(round.Id, notAfter));
        Assert.Equal(RoundResultStatus.Invalid, rejected.Status);
        Assert.Contains(rejected.Response.Errors!, e => e.StartsWith("Báo cáo giữa kỳ:"));

        // Nháp được lưu khi chưa đặt hạn trễ, nhưng không mở được.
        var missing = Dated();
        missing.Milestones.Single(m => m.Key == "outline").LateEndDate = null;
        Assert.Equal(RoundResultStatus.Ok, (await Send(new UpdateRoundMilestonesCommand(round.Id, missing))).Status);
        var blocked = await Send(new OpenRoundCommand(round.Id));
        Assert.Equal(RoundResultStatus.Conflict, blocked.Status);
        Assert.Contains(blocked.Response.Errors!, e => e.StartsWith("Đề cương:") && e.Contains("hạn nộp trễ"));

        var saved = await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        Assert.Equal("2026-09-30", saved.Response.Data!.Milestones.Single(m => m.Key == "midterm").LateEndDate);
        Assert.Equal(string.Empty, saved.Response.Data.Milestones.Single(m => m.Key == "final").LateEndDate);
        Assert.Equal(RoundResultStatus.Ok, (await Send(new OpenRoundCommand(round.Id))).Status);

        // Đợt đang diễn ra: không lưu được cấu hình bật nộp trễ mà thiếu hạn trễ.
        var running = await Send(new UpdateRoundMilestonesCommand(round.Id, missing));
        Assert.Equal(RoundResultStatus.Invalid, running.Status);

        // Sao chép đợt chỉ mang công tắc, không mang hạn trễ (PDR-034).
        var copy = (await Send(new CreateRoundCommand(new RoundInputDto
        {
            Name = "Đợt sao chép", Program = "Văn bằng 1", PeriodLabel = "K2", CopyFromId = round.Id.ToString()
        }))).Response.Data!;
        Assert.True(copy.Milestones.Single(m => m.Key == "midterm").AllowLate);
        Assert.All(copy.Milestones, m => Assert.Equal(string.Empty, m.LateEndDate));
    }

    private sealed class FailingRepository(ISubmissionRepository inner, Func<bool> fail) : ISubmissionRepository
    {
        public Task<IReadOnlyList<Submission>> ListByTopicAsync(Guid topicId, CancellationToken cancellationToken = default) =>
            inner.ListByTopicAsync(topicId, cancellationToken);
        public Task<Submission?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => inner.GetByIdAsync(id, cancellationToken);
        public Task AddAsync(Submission submission, TopicHistoryEntry history, CancellationToken cancellationToken = default) =>
            fail() ? throw new InvalidOperationException("database down") : inner.AddAsync(submission, history, cancellationToken);
    }
}

// Object storage giả trong bộ nhớ, dùng chung cho test handler và test HTTP.
public sealed class InMemoryDocumentStorage : IDocumentStorage
{
    public Dictionary<string, byte[]> Objects { get; } = [];
    public bool FailSave { get; set; }
    public int SaveCount { get; private set; }

    public Task SaveAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken = default)
    {
        if (FailSave) throw new StorageUnavailableException("down");
        SaveCount++;
        Objects[objectKey] = content;
        return Task.CompletedTask;
    }

    public Task<byte[]?> ReadAsync(string objectKey, CancellationToken cancellationToken = default) =>
        Task.FromResult(Objects.GetValueOrDefault(objectKey));

    public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        Objects.Remove(objectKey);
        return Task.CompletedTask;
    }
}
