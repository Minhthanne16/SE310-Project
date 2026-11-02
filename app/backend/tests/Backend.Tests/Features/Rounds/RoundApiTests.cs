using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Rounds;
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

// Hợp đồng HTTP của /api/rounds: quyền, mã trạng thái và dạng JSON mà frontend
// (types/round.ts, features/rounds/services/roundService.ts) đang dùng.
public sealed class RoundApiTests : IClassFixture<RoundApiTests.Factory>
{
    private const string CookieName = "qlkltn_access";
    private readonly Factory _factory;

    public RoundApiTests(Factory factory) => _factory = factory;

    // Xem danh sách mở cho cả ba vai trò (GV/SV chỉ thấy đợt mình tham gia); thao tác ghi chỉ Giáo vụ.
    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized)]
    [InlineData(UserRole.Student, HttpStatusCode.OK, HttpStatusCode.Forbidden)]
    [InlineData(UserRole.Lecturer, HttpStatusCode.OK, HttpStatusCode.Forbidden)]
    [InlineData(UserRole.AcademicAffairs, HttpStatusCode.OK, HttpStatusCode.BadRequest)]
    public async Task ReadIsOpenToAllRolesWritesOnlyToAcademicAffairs(UserRole? role, HttpStatusCode read, HttpStatusCode write)
    {
        var cookie = role is { } r ? await LoginAs(r) : null;

        var list = await Send(HttpMethod.Get, "/api/rounds", cookie);
        var create = await Send(HttpMethod.Post, "/api/rounds", cookie, new { name = "", program = "", periodLabel = "" });

        Assert.Equal(read, list.StatusCode);
        Assert.Equal(read == HttpStatusCode.OK, (await ReadJson(list)).GetProperty("success").GetBoolean());
        Assert.Equal(write, create.StatusCode);
    }

    [Fact]
    public async Task LecturerLoadIsSavedPerDraftRoundAndValidated()
    {
        var cookie = await LoginAs(UserRole.AcademicAffairs);
        var name = $"Đợt tải {Guid.NewGuid().ToString("N")[..8]}";
        var created = await ReadJson(await Send(HttpMethod.Post, "/api/rounds", cookie, new { name, program = "Văn bằng 1", periodLabel = "K1" }));
        var id = created.GetProperty("data").GetProperty("id").GetGuid();
        Assert.Equal(0, created.GetProperty("data").GetProperty("lecturerLoadMax").GetInt32());

        var saved = await Send(HttpMethod.Put, $"/api/rounds/{id}", cookie,
            new { name, program = "Văn bằng 1", periodLabel = "K1", lecturerLoadMin = 2, lecturerLoadMax = 5 });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var data = (await ReadJson(saved)).GetProperty("data");
        Assert.Equal(2, data.GetProperty("lecturerLoadMin").GetInt32());
        Assert.Equal(5, data.GetProperty("lecturerLoadMax").GetInt32());

        // Không gửi hai trường thì giữ nguyên mức.
        var kept = (await ReadJson(await Send(HttpMethod.Put, $"/api/rounds/{id}", cookie, new { name, program = "Văn bằng 1", periodLabel = "K2" }))).GetProperty("data");
        Assert.Equal(5, kept.GetProperty("lecturerLoadMax").GetInt32());

        var swapped = await Send(HttpMethod.Put, $"/api/rounds/{id}", cookie,
            new { name, program = "Văn bằng 1", periodLabel = "K1", lecturerLoadMin = 6, lecturerLoadMax = 5 });
        Assert.Equal(HttpStatusCode.BadRequest, swapped.StatusCode);
        Assert.Contains("Số đề tài tối thiểu không được lớn hơn tối đa.",
            (await ReadJson(swapped)).GetProperty("errors").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Put, $"/api/rounds/{id}", cookie,
            new { name, program = "Văn bằng 1", periodLabel = "K1", lecturerLoadMin = -1, lecturerLoadMax = 0 })).StatusCode);

        // Sao chép đợt lấy luôn mức đề tài.
        var copy = await ReadJson(await Send(HttpMethod.Post, "/api/rounds", cookie,
            new { name = $"{name} sao chép", program = "Văn bằng 1", periodLabel = "K3", copyFromId = id }));
        Assert.Equal(2, copy.GetProperty("data").GetProperty("lecturerLoadMin").GetInt32());
    }

    [Fact]
    public async Task RoundLifecycleFollowsTheContract()
    {
        var cookie = await LoginAs(UserRole.AcademicAffairs);
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var name = $"Đợt {suffix}";
        var lecturerCode = $"CB{suffix}";
        var studentCode = $"SV{suffix}";
        await _factory.SeedUser(UserRole.Lecturer, lecturerCode, "Nguyễn Thị Hương", "Công nghệ phần mềm");
        var studentId = await _factory.SeedUser(UserRole.Student, studentCode, "Nguyễn Văn An", "KTPM2022");

        // Tạo đợt: 201 và JSON đúng tên trường của frontend.
        var created = await Send(HttpMethod.Post, "/api/rounds", cookie, new { name = $"  {name}  ", program = "Văn bằng 1", periodLabel = "HK1 2026–2027" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var data = (await ReadJson(created)).GetProperty("data");
        var id = data.GetProperty("id").GetGuid();
        Assert.Equal(name, data.GetProperty("name").GetString());
        Assert.Equal("Nháp", data.GetProperty("status").GetString());
        Assert.Equal("Văn bằng 1", data.GetProperty("program").GetString());
        Assert.Equal("HK1 2026–2027", data.GetProperty("periodLabel").GetString());
        var milestones = data.GetProperty("milestones");
        Assert.Equal(9, milestones.GetArrayLength());
        Assert.Equal("topicSubmission", milestones[0].GetProperty("key").GetString());
        Assert.Equal("GV gửi đề tài", milestones[0].GetProperty("name").GetString());
        Assert.Equal("", milestones[0].GetProperty("startDate").GetString());
        Assert.Equal("", milestones[0].GetProperty("endDate").GetString());
        Assert.Equal("Tất cả", milestones[0].GetProperty("notifyAudience").GetString());
        Assert.Equal(JsonValueKind.Null, milestones[0].GetProperty("allowLate").ValueKind);
        Assert.True(milestones[2].GetProperty("allowLate").GetBoolean());
        Assert.Equal("finalize", milestones[8].GetProperty("key").GetString());
        Assert.Equal(0, data.GetProperty("lecturerIds").GetArrayLength());
        Assert.Equal(0, data.GetProperty("lockedStudentIds").GetArrayLength());
        var summary = data.GetProperty("topicSummary");
        Assert.Equal(0, summary.GetProperty("total").GetInt32());
        Assert.Equal(0, summary.GetProperty("unpublishedCount").GetInt32());
        Assert.Equal(0, summary.GetProperty("byStatus").GetProperty("Chưa đăng ký").GetInt32());
        Assert.Equal(7, summary.GetProperty("byStatus").EnumerateObject().Count());

        // Lỗi: 400 thiếu thông tin, 409 trùng tên, 404 thiếu đợt nguồn / đợt không có.
        var invalid = await Send(HttpMethod.Post, "/api/rounds", cookie, new { name = " ", program = "", periodLabel = "" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal(["Nhập tên đợt.", "Chọn chương trình.", "Nhập học kỳ hoặc khóa."],
            (await ReadJson(invalid)).GetProperty("errors").EnumerateArray().Select(e => e.GetString()));
        var duplicate = await Send(HttpMethod.Post, "/api/rounds", cookie, new { name = name.ToUpperInvariant(), program = "Thạc sĩ", periodLabel = "K1" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("Tên đợt đã tồn tại. Đặt tên khác.", (await ReadJson(duplicate)).GetProperty("message").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, "/api/rounds", cookie,
            new { name = $"{name} sao chép", program = "Thạc sĩ", periodLabel = "K1", copyFromId = Guid.NewGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/rounds/{Guid.NewGuid()}", cookie)).StatusCode);

        // Danh sách có lọc.
        var list = await Send(HttpMethod.Get, $"/api/rounds?status={Uri.EscapeDataString("Nháp")}&program={Uri.EscapeDataString("Văn bằng 1")}&search={suffix}", cookie);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal(id, Assert.Single((await ReadJson(list)).GetProperty("data").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, "/api/rounds?status=abc", cookie)).StatusCode);

        // Mốc: 400 khi sai thứ tự, 200 khi hợp lệ; mở đợt trước đó thiếu ngày thì 409.
        var open = await Send(HttpMethod.Post, $"/api/rounds/{id}/open", cookie);
        Assert.Equal(HttpStatusCode.Conflict, open.StatusCode);
        var openJson = await ReadJson(open);
        Assert.Equal("Chưa mở được đợt: các mốc thời gian chưa đầy đủ hoặc chưa hợp lệ.", openJson.GetProperty("message").GetString());
        Assert.Equal(9, openJson.GetProperty("errors").GetArrayLength());

        var badMilestones = await Send(HttpMethod.Put, $"/api/rounds/{id}/milestones", cookie, new { milestones = Milestones(m => m[1].endDate = "2000-01-01") });
        Assert.Equal(HttpStatusCode.BadRequest, badMilestones.StatusCode);
        Assert.Contains((await ReadJson(badMilestones)).GetProperty("errors").EnumerateArray().Select(e => e.GetString()),
            e => e!.StartsWith("Công bố đề tài · SV đăng ký: Ngày kết thúc phải sau"));
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Put, $"/api/rounds/{id}/milestones", cookie, new { milestones = Milestones(m => m[0].key = "khac") })).StatusCode);

        var saved = await Send(HttpMethod.Put, $"/api/rounds/{id}/milestones", cookie, new { milestones = Milestones(m => m[0].notifyAudience = "Giảng viên") });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var savedMilestones = (await ReadJson(saved)).GetProperty("data").GetProperty("milestones");
        Assert.Equal("2026-09-01", savedMilestones[0].GetProperty("startDate").GetString());
        Assert.Equal("Giảng viên", savedMilestones[0].GetProperty("notifyAudience").GetString());

        // Người tham gia: danh sách chung, ứng viên, kiểm tra, thêm.
        var people = await Send(HttpMethod.Get, "/api/rounds/people/students", cookie);
        Assert.Contains((await ReadJson(people)).GetProperty("data").EnumerateArray(),
            p => p.GetProperty("code").GetString() == studentCode && p.GetProperty("unit").GetString() == "KTPM2022");
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Get, "/api/rounds/people/teachers", cookie)).StatusCode);
        var candidates = await Send(HttpMethod.Get, $"/api/rounds/{id}/students/candidates", cookie);
        var candidate = (await ReadJson(candidates)).GetProperty("data").EnumerateArray().Single(c => c.GetProperty("code").GetString() == studentCode);
        Assert.False(candidate.TryGetProperty("blockedReason", out _));

        var check = await Send(HttpMethod.Post, $"/api/rounds/{id}/students/check", cookie, new { codes = new[] { studentCode, studentCode.ToLowerInvariant(), "KHONGCO" } });
        Assert.Equal(HttpStatusCode.OK, check.StatusCode);
        var checks = (await ReadJson(check)).GetProperty("data");
        Assert.Equal(2, checks.GetArrayLength());
        Assert.Equal("valid", checks[0].GetProperty("status").GetString());
        Assert.Equal(studentId, checks[0].GetProperty("participant").GetProperty("id").GetGuid());
        Assert.Equal("notFound", checks[1].GetProperty("status").GetString());
        Assert.False(checks[1].TryGetProperty("participant", out _));
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, $"/api/rounds/{id}/students/check", cookie,
            new { codes = Enumerable.Range(0, 501).Select(i => $"C{i}").ToArray() })).StatusCode);

        var add = await Send(HttpMethod.Post, $"/api/rounds/{id}/students", cookie, new { codes = new[] { studentCode } });
        Assert.Equal(HttpStatusCode.OK, add.StatusCode);
        var addData = (await ReadJson(add)).GetProperty("data");
        Assert.Equal(1, addData.GetProperty("added").GetInt32());
        Assert.Equal(studentId, addData.GetProperty("round").GetProperty("studentIds")[0].GetGuid());
        Assert.Equal("valid", addData.GetProperty("results")[0].GetProperty("status").GetString());
        var addLecturer = await Send(HttpMethod.Post, $"/api/rounds/{id}/lecturers", cookie, new { codes = new[] { lecturerCode } });
        Assert.Equal(1, (await ReadJson(addLecturer)).GetProperty("data").GetProperty("round").GetProperty("lecturerIds").GetArrayLength());

        // Sửa thông tin khi Nháp, rồi mở đợt.
        var update = await Send(HttpMethod.Put, $"/api/rounds/{id}", cookie, new { name = $"{name} sửa", program = "Thạc sĩ", periodLabel = "K2" });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal("Thạc sĩ", (await ReadJson(update)).GetProperty("data").GetProperty("program").GetString());

        var opened = await Send(HttpMethod.Post, $"/api/rounds/{id}/open", cookie);
        Assert.Equal(HttpStatusCode.OK, opened.StatusCode);
        Assert.Equal("Đang diễn ra", (await ReadJson(opened)).GetProperty("data").GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/api/rounds/{id}/open", cookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Put, $"/api/rounds/{id}", cookie, new { name = name, program = "Thạc sĩ", periodLabel = "K2" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/rounds/{id}", cookie)).StatusCode);

        // Gỡ người tham gia, kết thúc đợt, sau đó đợt không còn sửa được.
        var removed = await Send(HttpMethod.Delete, $"/api/rounds/{id}/students/{studentId}", cookie);
        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);
        Assert.Equal(0, (await ReadJson(removed)).GetProperty("data").GetProperty("studentIds").GetArrayLength());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/rounds/{id}/students/{studentId}", cookie)).StatusCode);

        var finished = await Send(HttpMethod.Post, $"/api/rounds/{id}/finish", cookie);
        Assert.Equal("Đã kết thúc", (await ReadJson(finished)).GetProperty("data").GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/api/rounds/{id}/finish", cookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Put, $"/api/rounds/{id}/milestones", cookie, new { milestones = Milestones() })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/api/rounds/{id}/students", cookie, new { codes = new[] { studentCode } })).StatusCode);

        // Xóa: đợt Nháp mới xóa được và trả 200 kèm JSON.
        var draftId = (await ReadJson(await Send(HttpMethod.Post, "/api/rounds", cookie,
            new { name = $"{name} nháp", program = "Văn bằng 2", periodLabel = "K3" }))).GetProperty("data").GetProperty("id").GetGuid();
        var deleted = await Send(HttpMethod.Delete, $"/api/rounds/{draftId}", cookie);
        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
        Assert.True((await ReadJson(deleted)).GetProperty("data").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/rounds/{draftId}", cookie)).StatusCode);
    }

    // Chín mốc nối tiếp, mỗi mốc 5 ngày, cách nhau 7 ngày từ 2026-09-01.
    private static List<MilestoneBody> Milestones(Action<List<MilestoneBody>>? tweak = null)
    {
        string[] keys = ["topicSubmission", "topicRegistration", "outline", "midterm", "final", "reviewSchedule", "defenseSchedule", "grading", "finalize"];
        var start = new DateOnly(2026, 9, 1);
        var list = keys.Select((key, i) => new MilestoneBody
        {
            key = key,
            startDate = start.AddDays(i * 7).ToString("yyyy-MM-dd"),
            endDate = start.AddDays(i * 7 + 5).ToString("yyyy-MM-dd"),
            notifyAudience = "Tất cả",
            allowLate = key is "outline" or "midterm" or "final" ? true : null
        }).ToList();
        tweak?.Invoke(list);
        return list;
    }

    private sealed class MilestoneBody
    {
        public string key { get; set; } = "";
        public string startDate { get; set; } = "";
        public string endDate { get; set; } = "";
        public string notifyAudience { get; set; } = "";
        public bool? allowLate { get; set; }
    }

    private async Task<string> LoginAs(UserRole role)
    {
        var email = _factory.Users.Add(role, "matkhau123", mustChange: false, code: null);
        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password = "matkhau123" });
        response.EnsureSuccessStatusCode();
        var header = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith($"{CookieName}="));
        return header[(CookieName.Length + 1)..header.IndexOf(';')];
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string? cookie, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (cookie is not null) request.Headers.Add("Cookie", $"{CookieName}={cookie}");
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

        public Factory()
        {
            _connection.Open();
            _options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
            using var db = new ApplicationDbContext(_options);
            db.Database.EnsureCreated();
        }

        // Người tham gia đợt phải có trong bảng Users của SQLite (tài khoản đăng nhập nằm ở kho trong bộ nhớ).
        public async Task<Guid> SeedUser(UserRole role, string code, string name, string unit)
        {
            using var db = new ApplicationDbContext(_options);
            return await RoundWorkflowTests.SeedUser(db, role, code, name, unit);
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
                services.RemoveAll<IRoundRepository>();
                services.AddScoped<IRoundRepository>(_ => new RoundRepository(new ApplicationDbContext(_options)));
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) _connection.Dispose();
        }
    }
}
