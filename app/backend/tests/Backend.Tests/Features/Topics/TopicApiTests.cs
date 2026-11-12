using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Application.Common.Storage;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
using Backend.Infrastructure.Repositories.Topics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Backend.Tests;

// Hợp đồng HTTP của /api/topics (PDR-053) và luồng kiểm chứng của P03-S01:
// GV gửi → Giáo vụ công bố → SV xem.
public sealed class TopicApiTests : IClassFixture<TopicApiTests.Factory>
{
    private const string CookieName = "qlkltn_access";
    private readonly Factory _factory;

    public TopicApiTests(Factory factory) => _factory = factory;

    private sealed record Account(string Cookie, Guid Id, string Code, string Email);

    [Fact]
    public async Task LecturerSubmitsStaffPublishesStudentSees()
    {
        var staff = await Login(UserRole.AcademicAffairs);
        var lecturer = await Login(UserRole.Lecturer);
        var otherLecturer = await Login(UserRole.Lecturer);
        var student = await Login(UserRole.Student);
        var roundId = await RunningRound(staff, [lecturer.Code, otherLecturer.Code], [student.Code]);

        var mine = await ReadJson(await Send(HttpMethod.Get, $"/api/topics/mine?roundId={roundId}", lecturer));
        Assert.True(mine.GetProperty("data").GetProperty("round").GetProperty("canSubmit").GetBoolean());

        var created = await Send(HttpMethod.Post, "/api/topics", lecturer, NewTopic(roundId));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var topic = (await ReadJson(created)).GetProperty("data");
        var id = topic.GetProperty("id").GetGuid();
        Assert.Equal("DT-001", topic.GetProperty("code").GetString());
        Assert.Equal("Chưa đăng ký", topic.GetProperty("status").GetString());
        Assert.Equal("all", topic.GetProperty("canEdit").GetString());

        var hidden = await Send(HttpMethod.Get, $"/api/topics/published?roundId={roundId}", student);
        Assert.Equal(HttpStatusCode.Conflict, hidden.StatusCode);
        Assert.Equal("Giáo vụ chưa công bố danh sách đề tài của đợt.", (await ReadJson(hidden)).GetProperty("message").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/topics/{id}", student)).StatusCode);

        var staffList = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics?roundId={roundId}", staff))).GetProperty("data");
        Assert.Equal(1, staffList.GetProperty("items").GetArrayLength());
        Assert.Equal(2, staffList.GetProperty("loads").GetArrayLength());

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{roundId}/topics/publish", staff)).StatusCode);

        var published = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/published?roundId={roundId}", student))).GetProperty("data");
        Assert.Equal("Hệ thống gợi ý khóa học", published.GetProperty("items")[0].GetProperty("title").GetString());
        var studentDetail = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/{id}", student))).GetProperty("data");
        Assert.Equal(0, studentDetail.GetProperty("history").GetArrayLength());

        var retitle = await Send(HttpMethod.Put, $"/api/topics/{id}", lecturer, NewTopic(roundId, title: "Tên khác"));
        Assert.Equal(HttpStatusCode.Conflict, retitle.StatusCode);
        var content = await Send(HttpMethod.Put, $"/api/topics/{id}", lecturer, NewTopic(roundId, description: "Mô tả mới"));
        Assert.Equal(HttpStatusCode.OK, content.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/topics/{id}", lecturer)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, "/api/topics", lecturer, NewTopic(roundId))).StatusCode);

        var staffDetail = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/{id}", staff))).GetProperty("data");
        Assert.Equal(
            ["Sửa đề tài", "Công bố danh sách đề tài", "Gửi đề tài"],
            staffDetail.GetProperty("history").EnumerateArray().Select(h => h.GetProperty("action").GetString()));
        // Lịch sử công bố ghi đúng Giáo vụ đã công bố, không phải "Hệ thống".
        var publishEntry = staffDetail.GetProperty("history").EnumerateArray()
            .Single(h => h.GetProperty("action").GetString() == "Công bố danh sách đề tài");
        Assert.Equal(_factory.Users.Find(staff.Email).FullName, publishEntry.GetProperty("actor").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/topics/{id}", otherLecturer)).StatusCode);
    }

    [Fact]
    public async Task EachEndpointIsLimitedToItsRole()
    {
        var staff = await Login(UserRole.AcademicAffairs);
        var lecturer = await Login(UserRole.Lecturer);
        var student = await Login(UserRole.Student);
        var roundId = await RunningRound(staff, [lecturer.Code], [student.Code]);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, $"/api/topics?roundId={roundId}", null)).StatusCode);
        foreach (var (who, method, url) in new (Account, HttpMethod, string)[]
        {
            (lecturer, HttpMethod.Get, $"/api/topics?roundId={roundId}"),
            (student, HttpMethod.Get, $"/api/topics?roundId={roundId}"),
            (staff, HttpMethod.Get, $"/api/topics/mine?roundId={roundId}"),
            (lecturer, HttpMethod.Get, $"/api/topics/published?roundId={roundId}"),
            (staff, HttpMethod.Post, "/api/topics"),
            (student, HttpMethod.Post, "/api/topics")
        })
        {
            var response = await Send(method, url, who, method == HttpMethod.Post ? NewTopic(roundId) : null);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
        }

        // GV/SV không thuộc đợt bị chặn dù đúng vai trò.
        var outsider = await Login(UserRole.Lecturer);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, "/api/topics", outsider, NewTopic(roundId))).StatusCode);
        var otherStudent = await Login(UserRole.Student);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, $"/api/topics/published?roundId={roundId}", otherStudent)).StatusCode);
    }

    [Fact]
    public async Task StudentsRegisterAsAGroupAndAnyMemberCancels()
    {
        var staff = await Login(UserRole.AcademicAffairs);
        var lecturer = await Login(UserRole.Lecturer);
        var rep = await Login(UserRole.Student);
        var partner = await Login(UserRole.Student);
        var other = await Login(UserRole.Student);
        var roundId = await RunningRound(staff, [lecturer.Code], [rep.Code, partner.Code, other.Code]);
        var topicId = (await ReadJson(await Send(HttpMethod.Post, "/api/topics", lecturer, NewTopic(roundId))))
            .GetProperty("data").GetProperty("id").GetGuid();
        await Send(HttpMethod.Post, $"/api/rounds/{roundId}/topics/publish", staff);

        var badMember = await Send(HttpMethod.Post, $"/api/topics/{topicId}/registration", rep, new { memberCodes = new[] { "khong-co" } });
        Assert.Equal(HttpStatusCode.BadRequest, badMember.StatusCode);
        Assert.Equal("Mã sinh viên khong-co không tồn tại hoặc không thuộc đợt.", (await ReadJson(badMember)).GetProperty("message").GetString());

        var registered = await Send(HttpMethod.Post, $"/api/topics/{topicId}/registration", rep, new { memberCodes = new[] { partner.Code } });
        Assert.Equal(HttpStatusCode.OK, registered.StatusCode);
        var data = (await ReadJson(registered)).GetProperty("data");
        Assert.Equal(rep.Id, data.GetProperty("group").GetProperty("representativeId").GetGuid());
        Assert.Equal(2, data.GetProperty("group").GetProperty("members").GetArrayLength());
        Assert.Equal("Đã đăng ký", data.GetProperty("topic").GetProperty("status").GetString());
        Assert.True(data.GetProperty("canCancel").GetBoolean());

        var taken = await Send(HttpMethod.Post, $"/api/topics/{topicId}/registration", other, new { memberCodes = Array.Empty<string>() });
        Assert.Equal(HttpStatusCode.Conflict, taken.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"/api/topics/{topicId}/registration", lecturer, new { })).StatusCode);

        var partnerView = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/my-registration?roundId={roundId}", partner))).GetProperty("data");
        Assert.Equal(topicId, partnerView.GetProperty("topic").GetProperty("id").GetGuid());

        var cancelled = await Send(HttpMethod.Delete, $"/api/topics/{topicId}/registration", partner);
        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        var after = (await ReadJson(cancelled)).GetProperty("data");
        Assert.Equal(JsonValueKind.Null, after.GetProperty("topic").ValueKind);
        Assert.Equal(2, after.GetProperty("group").GetProperty("members").GetArrayLength());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/topics/{topicId}/registration", rep)).StatusCode);

        var staffTopic = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/{topicId}", staff))).GetProperty("data");
        Assert.Equal("Chưa đăng ký", staffTopic.GetProperty("status").GetString());
        Assert.Equal(0, staffTopic.GetProperty("group").GetArrayLength());
    }

    [Fact]
    public async Task MissingFieldsAre400WithMessagesPerField()
    {
        var staff = await Login(UserRole.AcademicAffairs);
        var lecturer = await Login(UserRole.Lecturer);
        var roundId = await RunningRound(staff, [lecturer.Code], []);

        var response = await Send(HttpMethod.Post, "/api/topics", lecturer, new { roundId, title = "", field = "", description = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJson(response)).GetProperty("errors").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("Nhập tên đề tài.", errors);
        Assert.Contains("Chọn lĩnh vực.", errors);
        Assert.Contains("Nhập mô tả đề tài.", errors);
    }

    // P04-S01 qua HTTP: multipart, tải PDF, phân quyền theo vai trò và mã lỗi (PDR-013, PDR-057).
    [Fact]
    public async Task OutlineEndpointsOverHttp()
    {
        var staff = await Login(UserRole.AcademicAffairs);
        var lecturer = await Login(UserRole.Lecturer);
        var otherLecturer = await Login(UserRole.Lecturer);
        var rep = await Login(UserRole.Student);
        var outsider = await Login(UserRole.Student);
        var roundId = await RunningRound(staff, [lecturer.Code, otherLecturer.Code], [rep.Code, outsider.Code]);
        var topicId = (await ReadJson(await Send(HttpMethod.Post, "/api/topics", lecturer, NewTopic(roundId))))
            .GetProperty("data").GetProperty("id").GetGuid();
        await Send(HttpMethod.Post, $"/api/rounds/{roundId}/topics/publish", staff);
        await Send(HttpMethod.Post, $"/api/topics/{topicId}/registration", rep, new { memberCodes = Array.Empty<string>() });
        var url = $"/api/topics/{topicId}/outline";
        var pdf = System.Text.Encoding.UTF8.GetBytes("%PDF-1.7\nđề cương\n%%EOF");

        var empty = await ReadJson(await Send(HttpMethod.Get, url, rep));
        Assert.Equal("member", empty.GetProperty("data").GetProperty("viewerRole").GetString());
        Assert.True(empty.GetProperty("data").GetProperty("canSubmit").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, url, outsider)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, url, otherLecturer)).StatusCode);
        Assert.Equal("staff", (await ReadJson(await Send(HttpMethod.Get, url, staff))).GetProperty("data").GetProperty("viewerRole").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(url, rep, null, "a.pdf")).StatusCode);
        var notPdf = await Upload(url, rep, System.Text.Encoding.UTF8.GetBytes("hello"), "a.pdf");
        Assert.Equal(HttpStatusCode.BadRequest, notPdf.StatusCode);
        Assert.Equal("Tệp không phải PDF.", (await ReadJson(notPdf)).GetProperty("message").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await Upload(url, lecturer, pdf, "a.pdf")).StatusCode);

        var submitted = await Upload(url, rep, pdf, "De cuong nhom.pdf", "Bản đầu");
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        var v1 = (await ReadJson(submitted)).GetProperty("data").GetProperty("submissions")[0];
        Assert.Equal(1, v1.GetProperty("versionNo").GetInt32());
        Assert.Equal("Bản đầu", v1.GetProperty("note").GetString());
        var v1Id = v1.GetProperty("id").GetGuid();

        var file = await Send(HttpMethod.Get, $"{url}/submissions/{v1Id}/file", lecturer);
        Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        Assert.Equal("application/pdf", file.Content.Headers.ContentType!.MediaType);
        Assert.Equal("nosniff", file.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("attachment", file.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Equal(pdf, await file.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"{url}/submissions/{v1Id}/file", outsider)).StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"{url}/requests", rep, new { content = "x" })).StatusCode);
        var blank = await Send(HttpMethod.Post, $"{url}/requests", lecturer, new { content = "  " });
        Assert.Equal(HttpStatusCode.BadRequest, blank.StatusCode);
        var created = await Send(HttpMethod.Post, $"{url}/requests", lecturer, new { content = "Bổ sung phạm vi" });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var requestId = (await ReadJson(created)).GetProperty("data").GetProperty("requests")[0].GetProperty("id").GetGuid();

        var studentView = (await ReadJson(await Send(HttpMethod.Get, url, rep))).GetProperty("data");
        Assert.Equal("open", studentView.GetProperty("requests")[0].GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"{url}/requests/{requestId}/resolve", rep)).StatusCode);

        var blocked = await Send(HttpMethod.Post, $"{url}/approve", lecturer, new { submissionId = v1Id });
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        Assert.Equal("Còn 1 yêu cầu chỉnh sửa chưa hoàn tất.", (await ReadJson(blocked)).GetProperty("message").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"{url}/requests/{requestId}/resolve", lecturer)).StatusCode);

        var v2Id = (await ReadJson(await Upload(url, rep, pdf, "v2.pdf", "Đã bổ sung phạm vi")))
            .GetProperty("data").GetProperty("submissions")[0].GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"{url}/submissions/{v2Id}/comment", lecturer, new { comment = "Ổn" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"{url}/requests/{requestId}/resolve", lecturer)).StatusCode);
        var approved = await Send(HttpMethod.Post, $"{url}/approve", lecturer, new { submissionId = v2Id });
        Assert.Equal(HttpStatusCode.OK, approved.StatusCode);
        Assert.Equal(2, (await ReadJson(approved)).GetProperty("data").GetProperty("approvedVersionNo").GetInt32());

        var detail = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/{topicId}", rep))).GetProperty("data");
        Assert.Equal(JsonValueKind.String, detail.GetProperty("outlineApprovedAt").ValueKind);
        Assert.Equal(2, detail.GetProperty("submissions").GetArrayLength());
        var mine = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/mine?roundId={roundId}", lecturer))).GetProperty("data");
        Assert.Equal(2, mine.GetProperty("items")[0].GetProperty("outline").GetProperty("versions").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await Upload(url, rep, pdf, "v3.pdf")).StatusCode);
    }

    private async Task<HttpResponseMessage> Upload(string url, Account who, byte[]? content, string fileName, string? note = null)
    {
        var form = new MultipartFormDataContent();
        if (content is not null)
        {
            var part = new ByteArrayContent(content);
            part.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
            form.Add(part, "file", fileName);
        }
        if (note is not null) form.Add(new StringContent(note), "note");
        var request = new HttpRequestMessage(HttpMethod.Post, $"{url}/submissions") { Content = form };
        request.Headers.Add("Cookie", $"{CookieName}={who.Cookie}");
        return await Client().SendAsync(request);
    }

    private static object NewTopic(Guid roundId, string title = "Hệ thống gợi ý khóa học", string description = "Gợi ý theo lịch sử học tập.") => new
    {
        roundId, title, field = "Trí tuệ nhân tạo", description, requirements = "Biết Python"
    };

    // Đợt Đang diễn ra: đang trong mốc gửi đề tài, đăng ký còn hạn vài ngày (theo giờ thật vì API dùng đồng hồ hệ thống).
    private async Task<Guid> RunningRound(Account staff, string[] lecturers, string[] students)
    {
        var created = await ReadJson(await Send(HttpMethod.Post, "/api/rounds", staff,
            new { name = $"Đợt đề tài {Guid.NewGuid():N}", program = "Văn bằng 1", periodLabel = "K1" }));
        var id = created.GetProperty("data").GetProperty("id").GetGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        string[] keys = ["topicSubmission", "topicRegistration", "outline", "midterm", "final", "reviewSchedule", "defenseSchedule", "grading", "finalize"];
        var milestones = keys.Select((key, i) => new
        {
            key,
            startDate = (i == 0 ? today.AddDays(-1) : today.AddDays(i * 3)).ToString("yyyy-MM-dd"),
            endDate = (i == 0 ? today.AddDays(1) : today.AddDays(i * 3 + 2)).ToString("yyyy-MM-dd"),
            notifyAudience = "Tất cả",
            allowLate = key is "outline" or "midterm" or "final" ? (bool?)true : null
        }).ToList();
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"/api/rounds/{id}/milestones", staff, new { milestones })).StatusCode);
        if (lecturers.Length > 0)
            Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{id}/lecturers", staff, new { codes = lecturers })).StatusCode);
        if (students.Length > 0)
            Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{id}/students", staff, new { codes = students })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{id}/open", staff)).StatusCode);
        return id;
    }

    // Đăng nhập qua kho người dùng trong bộ nhớ; cùng tài khoản (cùng Id, mã) được chép vào SQLite để làm người tham gia đợt.
    private async Task<Account> Login(UserRole role)
    {
        var code = $"{role.ToString()[..2].ToUpperInvariant()}{Guid.NewGuid().ToString("N")[..8]}";
        var email = _factory.Users.Add(role, "matkhau123", mustChange: false, code: code);
        var user = _factory.Users.Find(email);
        await _factory.CopyUser(user);
        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password = "matkhau123" });
        response.EnsureSuccessStatusCode();
        var header = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith($"{CookieName}="));
        return new Account(header[(CookieName.Length + 1)..header.IndexOf(';')], user.Id, code, email);
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, Account? who, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (who is not null) request.Headers.Add("Cookie", $"{CookieName}={who.Cookie}");
        if (body is not null) request.Content = JsonContent.Create(body);
        return await Client().SendAsync(request);
    }

    private HttpClient Client() => _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    public sealed class Factory : WebApplicationFactory<Program>
    {
        private readonly SqliteConnection _connection = new("Data Source=:memory:");
        private readonly DbContextOptions<ApplicationDbContext> _options;
        public AuthApiTests.TestUserStore Users { get; } = new();
        public InMemoryAvatarStorage Files { get; } = new();

        public Factory()
        {
            _connection.Open();
            _options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
            using var db = new ApplicationDbContext(_options);
            db.Database.EnsureCreated();
        }

        public async Task CopyUser(User user)
        {
            using var db = new ApplicationDbContext(_options);
            db.Users.Add(new User
            {
                Id = user.Id, UserCode = user.UserCode, FullName = user.FullName, Email = user.Email, PasswordHash = "x",
                Role = user.Role, MustChangePassword = false,
                ClassName = user.Role == UserRole.Student ? "KTPM2023" : null,
                Department = user.Role == UserRole.Lecturer ? "CNPM" : null
            });
            await db.SaveChangesAsync();
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(TestConfiguration.Values));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IUserRepository>();
                services.AddSingleton<IUserRepository>(Users.Repository);
                // Đợt và đề tài dùng chung một DbContext mỗi request, như khi chạy thật.
                services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
                services.RemoveAll<ApplicationDbContext>();
                services.AddScoped(_ => new ApplicationDbContext(_options));
                services.RemoveAll<IRoundRepository>();
                services.AddScoped<IRoundRepository, RoundRepository>();
                services.RemoveAll<ITopicRepository>();
                services.AddScoped<ITopicRepository, TopicRepository>();
                services.RemoveAll<IGroupRepository>();
                services.AddScoped<IGroupRepository, GroupRepository>();
                services.RemoveAll<IDocumentStorage>();
                services.AddSingleton<IDocumentStorage>(Files);
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) _connection.Dispose();
        }
    }
}
