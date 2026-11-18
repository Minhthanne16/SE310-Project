using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Domain.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Backend.Tests;

// Hợp đồng HTTP của /api/councils (P06, PDR-063): vai trò, ApiResponse, mã lỗi, luồng Giáo vụ lập → công bố →
// Chủ tịch/Thư ký và nhóm xem lịch.
public sealed class CouncilApiTests : IClassFixture<TopicApiTests.Factory>
{
    private const string CookieName = "qlkltn_access";
    private readonly TopicApiTests.Factory _factory;

    public CouncilApiTests(TopicApiTests.Factory factory) => _factory = factory;

    private sealed record Account(string Cookie, Guid Id, string Code, string Email);

    private sealed record Setup(Account Staff, Account Supervisor, Account Chair, Account Secretary, Account Other, Account Rep,
        Guid RoundId, Guid TopicId, string Day);

    private static object Body(Setup s, string start = "07:30", string end = "08:15", Guid? chair = null, string room = "B4.12") => new
    {
        roundId = s.RoundId,
        name = $"Hội đồng {Guid.NewGuid():N}"[..20],
        chairId = chair ?? s.Chair.Id,
        secretaryId = s.Secretary.Id,
        date = s.Day,
        room,
        slots = new[] { new { topicId = s.TopicId, start, end } }
    };

    [Fact]
    public async Task EndpointsRequireLoginAndTheRightRole()
    {
        var s = await Prepare();
        var id = Guid.NewGuid();
        foreach (var (method, url, payload) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, $"/api/councils?roundId={s.RoundId}", null),
            (HttpMethod.Post, "/api/councils/check", Body(s)),
            (HttpMethod.Post, "/api/councils", Body(s)),
            (HttpMethod.Put, $"/api/councils/{id}", Body(s)),
            (HttpMethod.Delete, $"/api/councils/{id}", null),
            (HttpMethod.Post, "/api/councils/publish", new { roundId = s.RoundId }),
            (HttpMethod.Post, $"/api/councils/{id}/cancel", new { reason = "x" }),
            (HttpMethod.Post, $"/api/councils/{id}/corrections", new { content = "x", reason = "y" }),
            (HttpMethod.Get, "/api/councils/mine", null)
        })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await Send(method, url, null, payload)).StatusCode);
            var lecturerOnly = url.EndsWith("/mine", StringComparison.Ordinal);
            var wrong = lecturerOnly ? s.Staff : s.Chair;
            var response = await Send(method, url, wrong, payload);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
            Assert.Equal(HttpStatusCode.Forbidden, (await Send(method, url, s.Rep, payload)).StatusCode);
        }
    }

    [Fact]
    public async Task StaffCreatesAndPublishesThenTheCouncilAndGroupSeeTheSchedule()
    {
        var s = await Prepare();

        var check = (await ReadJson(await Send(HttpMethod.Post, "/api/councils/check", s.Staff, Body(s)))).GetProperty("data");
        Assert.True(check.GetProperty("ok").GetBoolean());

        var created = await Send(HttpMethod.Post, "/api/councils", s.Staff, Body(s));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var council = (await ReadJson(created)).GetProperty("data");
        Assert.Equal("Nháp", council.GetProperty("status").GetString());
        Assert.Equal(1, council.GetProperty("version").GetInt32());
        Assert.Equal("07:30", council.GetProperty("slots")[0].GetProperty("start").GetString());
        var councilId = council.GetProperty("id").GetGuid();

        // Nháp: nhóm chưa thấy lịch, Chủ tịch chưa mở được đề tài.
        Assert.Equal(JsonValueKind.Null, (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}", s.Rep)))
            .GetProperty("data").GetProperty("defense").ValueKind);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}", s.Chair)).StatusCode);

        var board = (await ReadJson(await Send(HttpMethod.Get, $"/api/councils?roundId={s.RoundId}", s.Staff))).GetProperty("data");
        Assert.Equal(1, board.GetProperty("stats").GetProperty("scheduled").GetInt32());
        Assert.Contains(board.GetProperty("lecturers").EnumerateArray(), l => l.GetProperty("code").GetString() == s.Chair.Code);

        var published = await Send(HttpMethod.Post, "/api/councils/publish", s.Staff, new { roundId = s.RoundId });
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        Assert.Equal(1, (await ReadJson(published)).GetProperty("data").GetProperty("published").GetInt32());

        var defense = (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}", s.Rep))).GetProperty("data").GetProperty("defense");
        Assert.True(defense.GetProperty("councilPublished").GetBoolean());
        Assert.Equal($"{s.Day}T07:30:00", defense.GetProperty("start").GetString());
        Assert.Equal($"{s.Day}T08:15:00", defense.GetProperty("end").GetString());
        Assert.Equal("B4.12", defense.GetProperty("room").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}", s.Chair)).StatusCode);
        Assert.Equal("council", (await ReadJson(await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}/outline", s.Secretary)))
            .GetProperty("data").GetProperty("viewerRole").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}", s.Other)).StatusCode);

        var mine = (await ReadJson(await Send(HttpMethod.Get, "/api/councils/mine", s.Chair))).GetProperty("data");
        var mineCouncil = mine.GetProperty("councils").EnumerateArray().Single();
        Assert.Equal(councilId, mineCouncil.GetProperty("id").GetGuid());
        Assert.Equal("chair", mineCouncil.GetProperty("myRole").GetString());
        Assert.Empty((await ReadJson(await Send(HttpMethod.Get, "/api/councils/mine", s.Other))).GetProperty("data").GetProperty("councils").EnumerateArray());
    }

    [Fact]
    public async Task ErrorsUseApiResponseWithTheRightStatus()
    {
        var s = await Prepare();

        var supervisor = await Send(HttpMethod.Post, "/api/councils", s.Staff, Body(s, chair: s.Supervisor.Id));
        Assert.Equal(HttpStatusCode.Conflict, supervisor.StatusCode);
        var json = await ReadJson(supervisor);
        Assert.False(json.GetProperty("success").GetBoolean());
        Assert.Contains(json.GetProperty("errors").EnumerateArray(), e => e.GetString()!.Contains("là GVHD", StringComparison.Ordinal));

        var badTime = await Send(HttpMethod.Post, "/api/councils", s.Staff, Body(s, start: "7h30"));
        Assert.Equal(HttpStatusCode.BadRequest, badTime.StatusCode);
        Assert.Contains((await ReadJson(badTime)).GetProperty("errors").EnumerateArray(), e => e.GetString()!.Contains("HH:MM", StringComparison.Ordinal));
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/councils?roundId={Guid.NewGuid()}", s.Staff)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Delete, $"/api/councils/{Guid.NewGuid()}", s.Staff)).StatusCode);

        var created = (await ReadJson(await Send(HttpMethod.Post, "/api/councils", s.Staff, Body(s)))).GetProperty("data");
        var id = created.GetProperty("id").GetGuid();
        var update = new
        {
            name = created.GetProperty("name").GetString(), chairId = s.Chair.Id, secretaryId = s.Secretary.Id, date = s.Day, room = "B4.14",
            expectedVersion = 1, slots = new[] { new { topicId = s.TopicId, start = "08:00", end = "08:45" } }
        };
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"/api/councils/{id}", s.Staff, update)).StatusCode);
        var stale = await Send(HttpMethod.Put, $"/api/councils/{id}", s.Staff, update);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal("Hội đồng vừa được người khác sửa. Tải lại rồi thử lại.", (await ReadJson(stale)).GetProperty("message").GetString());

        await Send(HttpMethod.Post, "/api/councils/publish", s.Staff, new { roundId = s.RoundId, councilIds = new[] { id } });
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/councils/{id}", s.Staff)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, $"/api/councils/{id}/cancel", s.Staff, new { reason = "" })).StatusCode);
        // Lịch đã công bố: sửa mà thiếu lý do là 400 (PDR-018).
        var noReason = await Send(HttpMethod.Put, $"/api/councils/{id}", s.Staff, update);
        Assert.Equal(HttpStatusCode.BadRequest, noReason.StatusCode);
        Assert.Equal("Nhập lý do sửa lịch đã công bố.", (await ReadJson(noReason)).GetProperty("message").GetString());
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/councils/{id}/cancel", s.Staff, new { reason = "Không đủ người" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/api/councils/{id}/cancel", s.Staff, new { reason = "Lặp" })).StatusCode);
    }

    // Đợt đang diễn ra với một đề tài đã có nhóm và đề cương được duyệt (đặt trực tiếp trong database).
    private async Task<Setup> Prepare()
    {
        var staff = await Login(UserRole.AcademicAffairs);
        var supervisor = await Login(UserRole.Lecturer);
        var chair = await Login(UserRole.Lecturer);
        var secretary = await Login(UserRole.Lecturer);
        var other = await Login(UserRole.Lecturer);
        var rep = await Login(UserRole.Student);
        var partner = await Login(UserRole.Student);

        var created = await ReadJson(await Send(HttpMethod.Post, "/api/rounds", staff,
            new { name = $"Đợt hội đồng {Guid.NewGuid():N}", program = "Văn bằng 1", periodLabel = "K1" }));
        var roundId = created.GetProperty("data").GetProperty("id").GetGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        string[] keys = ["topicSubmission", "topicRegistration", "outline", "midterm", "final", "reviewSchedule", "defenseSchedule", "grading", "finalize"];
        var milestones = keys.Select((key, i) => new
        {
            key,
            startDate = (i == 0 ? today.AddDays(-1) : today.AddDays(i * 3)).ToString("yyyy-MM-dd"),
            endDate = (i == 0 ? today.AddDays(1) : today.AddDays(i * 3 + 2)).ToString("yyyy-MM-dd"),
            notifyAudience = "Tất cả",
            allowLate = key is "outline" or "midterm" or "final" or "finalize" ? (bool?)false : null
        }).ToList();
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"/api/rounds/{roundId}/milestones", staff, new { milestones })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{roundId}/lecturers", staff,
            new { codes = new[] { supervisor.Code, chair.Code, secretary.Code, other.Code } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{roundId}/students", staff,
            new { codes = new[] { rep.Code, partner.Code } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{roundId}/open", staff)).StatusCode);

        var topic = await ReadJson(await Send(HttpMethod.Post, "/api/topics", supervisor,
            new { roundId, title = "Hệ thống lịch bảo vệ", field = "CNPM", description = "Mô tả" }));
        var topicId = topic.GetProperty("data").GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{roundId}/topics/publish", staff)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/topics/{topicId}/registration", rep,
            new { memberCodes = new[] { partner.Code } })).StatusCode);
        await _factory.Db(async db =>
        {
            var row = await db.ThesisTopics.SingleAsync(t => t.Id == topicId);
            row.OutlineApprovedAt = DateTime.UtcNow;
            row.OutlineApprovedById = supervisor.Id;
            await db.SaveChangesAsync();
        });
        // Ngày riêng cho mỗi lần chạy để các test dùng chung database không trùng phòng/giảng viên với nhau.
        var day = new DateOnly(2027, 1, 1).AddDays(Random.Shared.Next(0, 3000)).ToString("yyyy-MM-dd");
        return new Setup(staff, supervisor, chair, secretary, other, rep, roundId, topicId, day);
    }

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
}
