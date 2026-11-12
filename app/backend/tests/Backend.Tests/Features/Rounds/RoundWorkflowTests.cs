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

namespace Backend.Tests;

// Chạy handler thật trên repository EF Core thật (SQLite trong bộ nhớ) để kiểm tra
// quy tắc đợt khóa luận (PDR-029…PDR-034).
public sealed class RoundWorkflowTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;

    public RoundWorkflowTests()
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

    // Mỗi lần gửi dùng một scope riêng, giống một HTTP request.
    private async Task<T> Send<T>(IRequest<T> request)
    {
        using var scope = _provider.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ISender>().Send(request);
    }

    [Fact]
    public async Task OpeningARoundNotifiesItsParticipantsOnce()
    {
        var student = await Seed(UserRole.Student, "SVTB1", "Sinh viên", "KTPM");
        var lecturer = await Seed(UserRole.Lecturer, "GVTB1", "Giảng viên", "CNPM");
        var outsider = await Seed(UserRole.Student, "SVTB2", "Người ngoài", "KTPM");
        var round = await Create("Đợt thông báo");
        await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        await Send(new AddParticipantsCommand(round.Id, "students", ["SVTB1"]));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", ["GVTB1"]));
        var roundId = round.Id;

        await Send(new OpenRoundCommand(roundId));
        await Send(new OpenRoundCommand(roundId)); // Lần lặp bị từ chối, không gửi thêm.

        using var check = _provider.CreateScope();
        var rows = await check.ServiceProvider.GetRequiredService<ApplicationDbContext>().Notifications.ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.Single(rows.Select(n => n.BatchId).Distinct());
        Assert.All(rows, n => Assert.Null(n.SenderUserId));
        Assert.All(rows, n => Assert.Contains("Đợt thông báo", n.Text));
        Assert.Equal("/sv", rows.Single(n => n.RecipientUserId == student).Href);
        Assert.Equal("/gv", rows.Single(n => n.RecipientUserId == lecturer).Href);
        Assert.DoesNotContain(rows, n => n.RecipientUserId == outsider);
    }

    // Người tham gia phải có trong bảng Users của SQLite.
    internal static async Task<Guid> SeedUser(ApplicationDbContext db, UserRole role, string code, string name = "Người dùng", string? unit = null)
    {
        var user = new User
        {
            UserCode = code,
            FullName = name,
            Email = $"{code.ToLowerInvariant()}@example.com",
            PasswordHash = "x",
            Role = role,
            ClassName = role == UserRole.Student ? unit : null,
            Department = role == UserRole.Lecturer ? unit : null
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user.Id;
    }

    private async Task<Guid> Seed(UserRole role, string code, string name = "Người dùng", string? unit = null)
    {
        using var scope = _provider.CreateScope();
        return await SeedUser(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(), role, code, name, unit);
    }

    private static RoundInputDto Input(string name = "Đợt 1/2026", string? copyFromId = null) =>
        new() { Name = name, Program = "Văn bằng 1", PeriodLabel = "HK1 2026–2027", CopyFromId = copyFromId };

    private async Task<RoundDto> Create(string name = "Đợt 1/2026", string? copyFromId = null)
    {
        var result = await Send(new CreateRoundCommand(Input(name, copyFromId)));
        Assert.Equal(RoundResultStatus.Created, result.Status);
        return result.Response.Data!;
    }

    private static RoundMilestonesInputDto Dated(Action<List<RoundMilestoneInputDto>>? tweak = null)
    {
        // Chín mốc nối tiếp nhau, mỗi mốc 5 ngày từ 2026-09-01.
        var start = new DateOnly(2026, 9, 1);
        var list = RoundRules.OrderedKeys.Select((key, i) => new RoundMilestoneInputDto
        {
            Key = RoundRules.KeyName(key),
            StartDate = start.AddDays(i * 7).ToString("yyyy-MM-dd"),
            EndDate = start.AddDays(i * 7 + 5).ToString("yyyy-MM-dd"),
            NotifyAudience = "Tất cả",
            AllowLate = ThesisRound.HasLateToggle(key) ? true : null,
            // PDR-041: mốc bật nộp trễ phải có hạn trễ sau hạn thường.
            LateEndDate = ThesisRound.HasLateToggle(key) ? start.AddDays(i * 7 + 6).ToString("yyyy-MM-dd") : null
        }).ToList();
        tweak?.Invoke(list);
        return new RoundMilestonesInputDto { Milestones = list };
    }

    private async Task<RoundDto> CreateConfigured(string name)
    {
        var round = await Create(name);
        var saved = await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        Assert.Equal(RoundResultStatus.Ok, saved.Status);
        return saved.Response.Data!;
    }

    private async Task<RoundDto> Open(string name, params string[] studentCodes)
    {
        var round = await CreateConfigured(name);
        if (studentCodes.Length > 0)
            Assert.Equal(studentCodes.Length, (await Send(new AddParticipantsCommand(round.Id, "students", studentCodes))).Response.Data!.Added);
        var opened = await Send(new OpenRoundCommand(round.Id));
        Assert.Equal(RoundResultStatus.Ok, opened.Status);
        return opened.Response.Data!;
    }

    [Fact]
    public async Task LecturersAndStudentsSeeOnlyOpenedRoundsTheyBelongTo()
    {
        var student = await Seed(UserRole.Student, "SV1");
        var outsider = await Seed(UserRole.Student, "SV2");
        var opened = await Open("Đợt đang mở", "SV1");
        var draft = await Create("Đợt nháp");
        await Send(new AddParticipantsCommand(draft.Id, "students", ["SV1"]));

        var mine = (await Send(new GetRoundsQuery(null, null, null, student))).Data!;
        Assert.Equal([opened.Id], mine.Select(r => r.Id));
        Assert.Empty((await Send(new GetRoundsQuery(null, null, null, outsider))).Data!);
        Assert.Equal(2, (await Send(new GetRoundsQuery(null, null, null))).Data!.Count);
        Assert.Equal(RoundResultStatus.NotFound, (await Send(new GetRoundQuery(draft.Id, student))).Status);
        Assert.Equal(RoundResultStatus.NotFound, (await Send(new GetRoundQuery(opened.Id, outsider))).Status);
        Assert.Equal(RoundResultStatus.Ok, (await Send(new GetRoundQuery(opened.Id, student))).Status);
    }

    [Fact]
    public async Task CreatesDraftRoundWithNineOrderedMilestones()
    {
        var round = await Create("  Đợt   1/2026  ");

        Assert.Equal("Đợt 1/2026", round.Name);
        Assert.Equal("Nháp", round.Status);
        Assert.Equal(RoundRules.OrderedKeys.Select(RoundRules.KeyName), round.Milestones.Select(m => m.Key));
        Assert.All(round.Milestones, m =>
        {
            Assert.Equal("", m.StartDate);
            Assert.Equal("", m.EndDate);
            Assert.Equal("Tất cả", m.NotifyAudience);
        });
        Assert.Equal([null, null, true, true, true, null, null, null, null], round.Milestones.Select(m => m.AllowLate));
        Assert.Equal("Đề cương", round.Milestones[2].Name);
        Assert.Empty(round.LecturerIds);
        Assert.Equal(12, round.TopicSummary.ByStatus.Count);
        Assert.All(round.TopicSummary.ByStatus.Values, v => Assert.Equal(0, v));
    }

    [Fact]
    public async Task RejectsDuplicateNameIgnoringCase()
    {
        await Create("Đợt A");

        var duplicate = await Send(new CreateRoundCommand(Input("  đỢT   a ")));

        Assert.Equal(RoundResultStatus.Conflict, duplicate.Status);
        Assert.Equal("Tên đợt đã tồn tại. Đặt tên khác.", duplicate.Response.Message);
    }

    [Fact]
    public async Task CreateValidatesRequiredFields()
    {
        var validator = _provider.GetRequiredService<IEnumerable<FluentValidation.IValidator<CreateRoundCommand>>>().Single();
        var result = validator.Validate(new CreateRoundCommand(new RoundInputDto { Name = "  ", Program = "", PeriodLabel = " " }));

        Assert.Equal(["Nhập tên đợt.", "Chọn chương trình.", "Nhập học kỳ hoặc khóa."], result.Errors.Select(e => e.ErrorMessage));
    }

    [Fact]
    public async Task CopyKeepsAudienceAndLateTogglesButNoDatesOrPeople()
    {
        await Seed(UserRole.Lecturer, "CB1");
        await Seed(UserRole.Student, "SV1");
        var source = await CreateConfigured("Đợt nguồn");
        await Send(new AddParticipantsCommand(source.Id, "lecturers", ["CB1"]));
        await Send(new AddParticipantsCommand(source.Id, "students", ["SV1"]));
        var config = Dated(l =>
        {
            l[0].NotifyAudience = "Giảng viên";
            l[3].AllowLate = false;
        });
        await Send(new UpdateRoundMilestonesCommand(source.Id, config));

        var copy = await Create("Đợt sao chép", source.Id.ToString());

        Assert.Equal("Giảng viên", copy.Milestones[0].NotifyAudience);
        Assert.False(copy.Milestones[3].AllowLate);
        Assert.True(copy.Milestones[2].AllowLate);
        Assert.Null(copy.Milestones[0].AllowLate);
        Assert.All(copy.Milestones, m => Assert.Equal("", m.StartDate));
        Assert.Empty(copy.LecturerIds);
        Assert.Empty(copy.StudentIds);
        Assert.Equal("Nháp", copy.Status);

        // Dấu vết nguồn nằm trong database (PDR-034).
        using var scope = _provider.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().ThesisRounds.SingleAsync(r => r.Id == copy.Id);
        Assert.Equal(source.Id, stored.CopiedFromId);
    }

    [Fact]
    public async Task CopyFromMissingRoundIsNotFound()
    {
        var result = await Send(new CreateRoundCommand(Input("Đợt X", Guid.NewGuid().ToString())));

        Assert.Equal(RoundResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task UpdatesInfoOnlyInDraft()
    {
        var a = await Create("Đợt A");
        await Create("Đợt B");

        var renamed = await Send(new UpdateRoundCommand(a.Id, new RoundInfoDto { Name = "Đợt A2", Program = "Thạc sĩ", PeriodLabel = "K2" }));
        Assert.Equal(RoundResultStatus.Ok, renamed.Status);
        Assert.Equal(("Đợt A2", "Thạc sĩ", "K2"), (renamed.Response.Data!.Name, renamed.Response.Data.Program, renamed.Response.Data.PeriodLabel));

        // Giữ nguyên tên của chính mình thì không tính trùng; trùng đợt khác thì 409.
        Assert.Equal(RoundResultStatus.Ok,
            (await Send(new UpdateRoundCommand(a.Id, new RoundInfoDto { Name = "ĐỢT A2", Program = "Thạc sĩ", PeriodLabel = "K2" }))).Status);
        Assert.Equal(RoundResultStatus.Conflict,
            (await Send(new UpdateRoundCommand(a.Id, new RoundInfoDto { Name = "đợt b", Program = "Thạc sĩ", PeriodLabel = "K2" }))).Status);

        var round = await CreateConfigured("Đợt C");
        await Send(new OpenRoundCommand(round.Id));
        var locked = await Send(new UpdateRoundCommand(round.Id, new RoundInfoDto { Name = "Đợt C2", Program = "Thạc sĩ", PeriodLabel = "K2" }));
        Assert.Equal(RoundResultStatus.Conflict, locked.Status);
        Assert.Equal("Đợt đã mở nên không sửa thông tin đợt được nữa.", locked.Response.Message);
        Assert.Equal(RoundResultStatus.NotFound,
            (await Send(new UpdateRoundCommand(Guid.NewGuid(), new RoundInfoDto { Name = "x", Program = "Thạc sĩ", PeriodLabel = "k" }))).Status);
    }

    [Fact]
    public async Task SavesMilestoneConfigAndKeepsNamesAndOrder()
    {
        var round = await Create();
        var input = Dated(l =>
        {
            l[0].NotifyAudience = "Sinh viên";
            l[4].AllowLate = false;
            // Mốc không có công tắc nộp trễ bỏ qua giá trị gửi lên.
            l[1].AllowLate = true;
        });
        // Đảo thứ tự đầu vào: server vẫn giữ thứ tự cố định.
        input.Milestones.Reverse();

        var saved = (await Send(new UpdateRoundMilestonesCommand(round.Id, input))).Response.Data!;

        Assert.Equal("topicSubmission", saved.Milestones[0].Key);
        Assert.Equal("GV gửi đề tài", saved.Milestones[0].Name);
        Assert.Equal("2026-09-01", saved.Milestones[0].StartDate);
        Assert.Equal("Sinh viên", saved.Milestones[0].NotifyAudience);
        Assert.False(saved.Milestones[4].AllowLate);
        Assert.Null(saved.Milestones[1].AllowLate);
    }

    [Fact]
    public async Task EmptyMilestoneDatesAreAllowedOnSave()
    {
        var round = await Create();
        var input = Dated(l =>
        {
            foreach (var m in l) { m.StartDate = ""; m.EndDate = null; m.LateEndDate = null; }
        });

        Assert.Equal(RoundResultStatus.Ok, (await Send(new UpdateRoundMilestonesCommand(round.Id, input))).Status);
    }

    [Fact]
    public async Task MilestoneValidationReportsPerMilestoneErrors()
    {
        var round = await Create();
        var input = Dated(l =>
        {
            l[0].EndDate = "";                        // thiếu ngày kết thúc
            l[1].StartDate = "2026-10-10";           // bắt đầu sau kết thúc
            l[1].EndDate = "2026-10-01";
            l[3].StartDate = "2026-01-01";           // bắt đầu trước mốc Đề cương
            l[3].EndDate = "2026-01-02";
            l[4].StartDate = "không phải ngày";
        });

        var result = await Send(new UpdateRoundMilestonesCommand(round.Id, input));

        Assert.Equal(RoundResultStatus.Invalid, result.Status);
        Assert.Equal(
        [
            "GV gửi đề tài: Nhập đủ ngày bắt đầu và ngày kết thúc.",
            "Công bố đề tài · SV đăng ký: Ngày kết thúc phải sau hoặc cùng ngày bắt đầu.",
            "Báo cáo giữa kỳ: Mốc này bắt đầu trước mốc “Đề cương”. Các mốc phải theo thứ tự thời gian.",
            "Báo cáo cuối kỳ: Nhập đủ ngày bắt đầu và ngày kết thúc."
        ], result.Response.Errors);
    }

    [Fact]
    public void MilestoneInputRequiresAllKnownKeys()
    {
        var validator = _provider.GetRequiredService<IEnumerable<FluentValidation.IValidator<UpdateRoundMilestonesCommand>>>().Single();

        Assert.True(validator.Validate(new UpdateRoundMilestonesCommand(Guid.NewGuid(), Dated())).IsValid);
        Assert.False(validator.Validate(new UpdateRoundMilestonesCommand(Guid.NewGuid(),
            Dated(l => l[0].Key = "unknown"))).IsValid);
        Assert.False(validator.Validate(new UpdateRoundMilestonesCommand(Guid.NewGuid(),
            Dated(l => l[0].NotifyAudience = "Ai đó"))).IsValid);
        Assert.False(validator.Validate(new UpdateRoundMilestonesCommand(Guid.NewGuid(),
            Dated(l => l.RemoveAt(0)))).IsValid);
        Assert.False(validator.Validate(new UpdateRoundMilestonesCommand(Guid.NewGuid(),
            Dated(l => l[1].Key = l[0].Key))).IsValid);
    }

    [Fact]
    public async Task OpenIsBlockedByMissingMilestoneDates()
    {
        var round = await Create();

        var result = await Send(new OpenRoundCommand(round.Id));

        Assert.Equal(RoundResultStatus.Conflict, result.Status);
        Assert.Equal("Chưa mở được đợt: các mốc thời gian chưa đầy đủ hoặc chưa hợp lệ.", result.Response.Message);
        Assert.Equal(9, result.Response.Errors!.Count);
        Assert.Equal("GV gửi đề tài: Chưa đặt ngày bắt đầu và kết thúc.", result.Response.Errors[0]);
        Assert.Equal("Draft", await StatusOf(round.Id));
    }

    [Fact]
    public async Task OpenWorksWithoutParticipants()
    {
        var round = await CreateConfigured("Đợt trống");

        var result = await Send(new OpenRoundCommand(round.Id));

        Assert.Equal(RoundResultStatus.Ok, result.Status);
        Assert.Equal("Đang diễn ra", result.Response.Data!.Status);
        using var scope = _provider.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().ThesisRounds.SingleAsync(r => r.Id == round.Id);
        Assert.NotNull(stored.OpenedAt);
        Assert.Equal(RoundStatus.Running, stored.Status);

        var again = await Send(new OpenRoundCommand(round.Id));
        Assert.Equal(RoundResultStatus.Conflict, again.Status);
        Assert.Equal("Chỉ mở được đợt Nháp.", again.Response.Message);
    }

    [Fact]
    public async Task OpenIsBlockedByStudentInAnotherRunningRound()
    {
        await Seed(UserRole.Student, "SV1", "Nguyễn Văn An");
        await Seed(UserRole.Student, "SV2");
        await Open("Đợt đang chạy", "SV1");
        var draft = await CreateConfigured("Đợt mới");
        await Send(new AddParticipantsCommand(draft.Id, "students", ["SV1", "SV2"]));

        var result = await Send(new OpenRoundCommand(draft.Id));

        Assert.Equal(RoundResultStatus.Conflict, result.Status);
        Assert.Contains("SV1 (Nguyễn Văn An)", result.Response.Message);
        Assert.DoesNotContain("SV2", result.Response.Message);
        Assert.Contains("Đợt đang chạy", result.Response.Errors!.Single());
        Assert.Equal("Draft", await StatusOf(draft.Id));
    }

    [Fact]
    public async Task AddToRunningRoundIsBlockedByOtherRunningRoundButDraftAllows()
    {
        await Seed(UserRole.Student, "SV1");
        await Open("Đợt chạy 1", "SV1");
        var running2 = await Open("Đợt chạy 2");
        var draft = await CreateConfigured("Đợt nháp");

        var check = await Send(new CheckParticipantsCommand(running2.Id, "students", ["SV1"]));
        var entry = check.Response.Data!.Single();
        Assert.Equal("inOtherRound", entry.Status);
        Assert.Contains("Đang thuộc đợt “Đợt chạy 1”", entry.Message);

        var blocked = (await Send(new AddParticipantsCommand(running2.Id, "students", ["SV1"]))).Response.Data!;
        Assert.Equal(0, blocked.Added);
        Assert.Empty(blocked.Round.StudentIds);

        // Đợt Nháp chỉ kiểm lúc mở đợt (PDR-029) nên thêm được.
        var allowed = (await Send(new AddParticipantsCommand(draft.Id, "students", ["SV1"]))).Response.Data!;
        Assert.Equal(1, allowed.Added);
        Assert.Single(allowed.Round.StudentIds);
    }

    [Fact]
    public async Task CheckDedupesAndClassifiesCodes()
    {
        var sv1 = await Seed(UserRole.Student, "SV1", "An", "KTPM2022");
        await Seed(UserRole.Student, "SV2");
        await Seed(UserRole.Lecturer, "CB1");
        var round = await Create();
        await Send(new AddParticipantsCommand(round.Id, "students", ["SV2"]));

        var result = (await Send(new CheckParticipantsCommand(round.Id, "students", [" sv1", "SV1", "", "  ", "sv2", "KHONGCO", "CB1"]))).Response.Data!;

        Assert.Equal(["sv1", "sv2", "KHONGCO", "CB1"], result.Select(r => r.Code));
        Assert.Equal(["valid", "alreadyInRound", "notFound", "notFound"], result.Select(r => r.Status));
        Assert.Equal("Hợp lệ.", result[0].Message);
        Assert.Equal((sv1, "SV1", "An", "KTPM2022"), (result[0].Participant!.Id, result[0].Participant!.Code, result[0].Participant!.Name, result[0].Participant!.Unit));
        Assert.Equal("Đã có trong đợt này.", result[1].Message);
        Assert.Equal("Không tồn tại sinh viên có mã hoặc email này.", result[2].Message);
        Assert.Null(result[2].Participant);
        // Chỉ kiểm tra, không ghi.
        Assert.Single((await Send(new GetRoundQuery(round.Id))).Response.Data!.StudentIds);
    }

    [Fact]
    public async Task CheckAcceptsEmailsCaseInsensitivelyAndEchoesInput()
    {
        var sv1 = await Seed(UserRole.Student, "SV1", "An", "KTPM2022");
        var round = await Create();

        // SeedUser đặt email = mã viết thường + @example.com.
        var result = (await Send(new CheckParticipantsCommand(round.Id, "students", ["  Sv1@Example.COM ", "khong@example.com"]))).Response.Data!;

        Assert.Equal(["Sv1@Example.COM", "khong@example.com"], result.Select(r => r.Code));
        Assert.Equal(["valid", "notFound"], result.Select(r => r.Status));
        var participant = result[0].Participant!;
        Assert.Equal((sv1, "SV1", "sv1@example.com", "Chưa đăng nhập"), (participant.Id, participant.Code, participant.Email, participant.AccountStatus));
    }

    [Fact]
    public async Task MixedCodeAndEmailForSameUserCountsOnce()
    {
        var sv1 = await Seed(UserRole.Student, "SV1");
        await Seed(UserRole.Student, "SV2");
        var round = await Create();

        var check = (await Send(new CheckParticipantsCommand(round.Id, "students", ["SV1", "sv2@example.com", "sv1@example.com", "SV2"]))).Response.Data!;
        Assert.Equal(["SV1", "sv2@example.com"], check.Select(r => r.Code));

        var added = (await Send(new AddParticipantsCommand(round.Id, "students", ["SV1", "sv2@example.com", "sv1@example.com", "SV2"]))).Response.Data!;
        Assert.Equal(2, added.Added);
        Assert.Contains(sv1, added.Round.StudentIds);
        Assert.Equal(2, added.Round.StudentIds.Count);
    }

    [Fact]
    public async Task AddsOnlyValidCodesAndListsCandidates()
    {
        await Seed(UserRole.Student, "SV1");
        await Seed(UserRole.Student, "SV2");
        await Seed(UserRole.Lecturer, "CB1", "Cô Hương", "Công nghệ phần mềm");
        var round = await Create();

        var added = (await Send(new AddParticipantsCommand(round.Id, "students", ["SV1", "SV1", "NOPE"]))).Response.Data!;
        Assert.Equal(1, added.Added);
        Assert.Equal(2, added.Results.Count);
        Assert.Single(added.Round.StudentIds);

        var lecturers = (await Send(new AddParticipantsCommand(round.Id, "lecturers", ["cb1"]))).Response.Data!;
        Assert.Single(lecturers.Round.LecturerIds);

        var candidates = (await Send(new GetCandidatesQuery(round.Id, "students"))).Response.Data!;
        Assert.Equal(["SV2"], candidates.Select(c => c.Code));
        Assert.Null(candidates[0].BlockedReason);

        var people = (await Send(new GetPeopleQuery("lecturers"))).Data!;
        Assert.Equal("Công nghệ phần mềm", Assert.Single(people).Unit);
    }

    [Fact]
    public async Task CandidatesOfRunningRoundShowBlockedStudents()
    {
        await Seed(UserRole.Student, "SV1");
        await Seed(UserRole.Student, "SV2");
        await Open("Đợt chạy 1", "SV1");
        var running = await Open("Đợt chạy 2");
        var draft = await CreateConfigured("Đợt nháp");

        var inRunning = (await Send(new GetCandidatesQuery(running.Id, "students"))).Response.Data!;
        Assert.Equal("Đang ở đợt “Đợt chạy 1”", inRunning.Single(c => c.Code == "SV1").BlockedReason);
        Assert.Null(inRunning.Single(c => c.Code == "SV2").BlockedReason);

        var inDraft = (await Send(new GetCandidatesQuery(draft.Id, "students"))).Response.Data!;
        Assert.All(inDraft, c => Assert.Null(c.BlockedReason));
    }

    [Fact]
    public async Task RemovesParticipantOnlyWhenInRound()
    {
        var sv1 = await Seed(UserRole.Student, "SV1");
        var cb1 = await Seed(UserRole.Lecturer, "CB1");
        var round = await Create();
        await Send(new AddParticipantsCommand(round.Id, "students", ["SV1"]));
        await Send(new AddParticipantsCommand(round.Id, "lecturers", ["CB1"]));

        var wrongKind = await Send(new RemoveParticipantCommand(round.Id, "lecturers", sv1));
        Assert.Equal(RoundResultStatus.Conflict, wrongKind.Status);
        Assert.Equal("Không có giảng viên này trong đợt.", wrongKind.Response.Message);

        var removed = (await Send(new RemoveParticipantCommand(round.Id, "students", sv1))).Response.Data!;
        Assert.Empty(removed.StudentIds);
        Assert.Equal([cb1], removed.LecturerIds);
        Assert.Equal("Không có sinh viên này trong đợt.", (await Send(new RemoveParticipantCommand(round.Id, "students", sv1))).Response.Message);
        Assert.Empty((await Send(new GetRoundQuery(round.Id))).Response.Data!.StudentIds);
    }

    [Fact]
    public async Task FinishOnlyFromRunning()
    {
        var draft = await CreateConfigured("Đợt nháp");
        var early = await Send(new FinishRoundCommand(draft.Id));
        Assert.Equal(RoundResultStatus.Conflict, early.Status);
        Assert.Equal("Chỉ kết thúc được đợt đang diễn ra.", early.Response.Message);

        await Send(new OpenRoundCommand(draft.Id));
        var finished = await Send(new FinishRoundCommand(draft.Id));
        Assert.Equal("Đã kết thúc", finished.Response.Data!.Status);
        Assert.Equal(RoundResultStatus.Conflict, (await Send(new FinishRoundCommand(draft.Id))).Status);
    }

    [Fact]
    public async Task DeleteOnlyDraftAndCascadesChildren()
    {
        await Seed(UserRole.Student, "SV1");
        var draft = await Create("Đợt nháp");
        await Send(new AddParticipantsCommand(draft.Id, "students", ["SV1"]));
        var running = await Open("Đợt chạy");

        var blocked = await Send(new DeleteRoundCommand(running.Id));
        Assert.Equal(RoundResultStatus.Conflict, blocked.Status);
        Assert.Equal("Chỉ xóa được đợt Nháp.", blocked.Response.Message);

        Assert.Equal(RoundResultStatus.Ok, (await Send(new DeleteRoundCommand(draft.Id))).Status);
        Assert.Equal(RoundResultStatus.NotFound, (await Send(new GetRoundQuery(draft.Id))).Status);
        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.DoesNotContain(db.RoundMilestones, m => m.RoundId == draft.Id);
        Assert.DoesNotContain(db.RoundParticipants, p => p.RoundId == draft.Id);
        Assert.Equal(1, await db.Users.CountAsync());
    }

    [Fact]
    public async Task FinishedRoundRejectsEdits()
    {
        var sv1 = await Seed(UserRole.Student, "SV1");
        var round = await Open("Đợt kết thúc", "SV1");
        await Send(new FinishRoundCommand(round.Id));
        const string message = "Đợt đã kết thúc nên không sửa được nữa.";

        var milestones = await Send(new UpdateRoundMilestonesCommand(round.Id, Dated()));
        var check = await Send(new CheckParticipantsCommand(round.Id, "students", ["SV1"]));
        var add = await Send(new AddParticipantsCommand(round.Id, "students", ["SV1"]));
        var remove = await Send(new RemoveParticipantCommand(round.Id, "students", sv1));

        Assert.All(new[] { milestones.Status, check.Status, add.Status, remove.Status }, s => Assert.Equal(RoundResultStatus.Conflict, s));
        Assert.All(new[] { milestones.Response.Message, check.Response.Message, add.Response.Message, remove.Response.Message }, m => Assert.Equal(message, m));
        Assert.Equal(RoundResultStatus.Conflict,
            (await Send(new UpdateRoundCommand(round.Id, new RoundInfoDto { Name = "Mới", Program = "Thạc sĩ", PeriodLabel = "k" }))).Status);
    }

    [Fact]
    public async Task ListFiltersByStatusProgramAndSearchNewestFirst()
    {
        await Create("Đợt Alpha");
        var beta = await CreateConfigured("Đợt Beta");
        await Send(new OpenRoundCommand(beta.Id));
        await Send(new CreateRoundCommand(new RoundInputDto { Name = "Đợt Gamma", Program = "Thạc sĩ", PeriodLabel = "K1" }));

        var all = (await Send(new GetRoundsQuery(null, null, null))).Data!;
        Assert.Equal(["Đợt Gamma", "Đợt Beta", "Đợt Alpha"], all.Select(r => r.Name));
        Assert.Equal(["Đợt Beta"], (await Send(new GetRoundsQuery("Đang diễn ra", null, null))).Data!.Select(r => r.Name));
        Assert.Equal(3, (await Send(new GetRoundsQuery("Tất cả", "", ""))).Data!.Count);
        Assert.Equal(["Đợt Gamma"], (await Send(new GetRoundsQuery(null, "Thạc sĩ", null))).Data!.Select(r => r.Name));
        Assert.Equal(["Đợt Alpha"], (await Send(new GetRoundsQuery(null, null, "  ALPHA "))).Data!.Select(r => r.Name));
    }

    private async Task<string> StatusOf(Guid id)
    {
        using var scope = _provider.CreateScope();
        return (await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().ThesisRounds.SingleAsync(r => r.Id == id)).Status.ToString();
    }
}
