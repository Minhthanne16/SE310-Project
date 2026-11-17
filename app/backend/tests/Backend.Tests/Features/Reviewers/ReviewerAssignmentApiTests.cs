using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Domain.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Backend.Tests;

// Hợp đồng HTTP của /api/reviewer-assignments (P05-S02, PDR-062): vai trò, ApiResponse, mã lỗi,
// luồng Giáo vụ gán → Giảng viên phản biện xem.
public sealed class ReviewerAssignmentApiTests : IClassFixture<TopicApiTests.Factory>
{
    private const string CookieName = "qlkltn_access";
    private readonly TopicApiTests.Factory _factory;

    public ReviewerAssignmentApiTests(TopicApiTests.Factory factory) => _factory = factory;

    private sealed record Account(string Cookie, Guid Id, string Code, string Email);

    private sealed record Setup(Account Staff, Account Supervisor, Account Reviewer, Account Other, Account Rep, Guid RoundId, Guid TopicId);

    [Fact]
    public async Task EndpointsRequireLoginAndTheRightRole()
    {
        var s = await Prepare();
        var roundId = s.RoundId;
        var body = new { reviewerId = s.Reviewer.Id, expectedReviewerId = (Guid?)null };
        var batch = new { roundId, items = new[] { new { topicId = s.TopicId, reviewerId = s.Reviewer.Id } } };

        foreach (var (method, url, payload) in new (HttpMethod, string, object?)[]
        {
            (HttpMethod.Get, $"/api/reviewer-assignments?roundId={roundId}", null),
            (HttpMethod.Get, $"/api/reviewer-assignments/suggestions?roundId={roundId}", null),
            (HttpMethod.Put, $"/api/reviewer-assignments/{s.TopicId}", body),
            (HttpMethod.Post, "/api/reviewer-assignments/batch", batch),
            (HttpMethod.Get, "/api/reviewer-assignments/mine", null)
        })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await Send(method, url, null, payload)).StatusCode);
            var staffOnly = !url.EndsWith("/mine");
            var wrong = staffOnly ? s.Supervisor : s.Staff;
            var response = await Send(method, url, wrong, payload);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, $"/api/reviewer-assignments?roundId={roundId}", s.Rep)).StatusCode);
    }

    [Fact]
    public async Task StaffAssignsThenReviewerSeesAndOthersDoNot()
    {
        var s = await Prepare();

        var list = (await ReadJson(await Send(HttpMethod.Get, $"/api/reviewer-assignments?roundId={s.RoundId}", s.Staff))).GetProperty("data");
        var row = list.GetProperty("topics").EnumerateArray().Single();
        Assert.True(row.GetProperty("eligible").GetBoolean());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("reviewer").ValueKind);
        Assert.Contains(list.GetProperty("lecturers").EnumerateArray(), l => l.GetProperty("code").GetString() == s.Reviewer.Code);

        var suggestions = (await ReadJson(await Send(HttpMethod.Get, $"/api/reviewer-assignments/suggestions?roundId={s.RoundId}", s.Staff)))
            .GetProperty("data");
        Assert.Equal(1, suggestions.GetArrayLength());
        // Gợi ý không lưu: đề tài vẫn chưa có GVPB.
        Assert.Equal(JsonValueKind.Null, (await ReadJson(await Send(HttpMethod.Get, $"/api/reviewer-assignments?roundId={s.RoundId}", s.Staff)))
            .GetProperty("data").GetProperty("topics")[0].GetProperty("reviewer").ValueKind);

        var assigned = await Send(HttpMethod.Put, $"/api/reviewer-assignments/{s.TopicId}", s.Staff, new { reviewerId = s.Reviewer.Id, expectedReviewerId = (Guid?)null });
        Assert.Equal(HttpStatusCode.OK, assigned.StatusCode);
        Assert.Equal(s.Reviewer.Code, (await ReadJson(assigned)).GetProperty("data").GetProperty("row").GetProperty("reviewer").GetProperty("code").GetString());

        var mine = (await ReadJson(await Send(HttpMethod.Get, "/api/reviewer-assignments/mine", s.Reviewer))).GetProperty("data");
        var item = mine.GetProperty("items").EnumerateArray().Single();
        Assert.Equal(s.TopicId, item.GetProperty("topicId").GetGuid());
        Assert.False(item.GetProperty("canScore").GetBoolean());
        Assert.Equal("Nhóm chưa nộp báo cáo cuối kỳ", item.GetProperty("scoreBlockedReason").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}", s.Reviewer)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}/outline", s.Reviewer)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}", s.Other)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/topics/{s.TopicId}/outline", s.Other)).StatusCode);
        Assert.Empty((await ReadJson(await Send(HttpMethod.Get, "/api/reviewer-assignments/mine", s.Other)))
            .GetProperty("data").GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task ErrorsUseApiResponseWithTheRightStatus()
    {
        var s = await Prepare();

        var supervisor = await Send(HttpMethod.Put, $"/api/reviewer-assignments/{s.TopicId}", s.Staff, new { reviewerId = s.Supervisor.Id });
        Assert.Equal(HttpStatusCode.Conflict, supervisor.StatusCode);
        var json = await ReadJson(supervisor);
        Assert.False(json.GetProperty("success").GetBoolean());
        Assert.Equal("GVHD không phản biện đề tài mình hướng dẫn", json.GetProperty("message").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Put, $"/api/reviewer-assignments/{s.TopicId}", s.Staff, new { reviewerId = Guid.Empty })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Put, $"/api/reviewer-assignments/{Guid.NewGuid()}", s.Staff, new { reviewerId = s.Reviewer.Id })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/reviewer-assignments?roundId={Guid.NewGuid()}", s.Staff)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"/api/reviewer-assignments/{s.TopicId}", s.Staff, new { reviewerId = s.Reviewer.Id })).StatusCode);
        var stale = await Send(HttpMethod.Put, $"/api/reviewer-assignments/{s.TopicId}", s.Staff, new { reviewerId = s.Other.Id, expectedReviewerId = (Guid?)null });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal("Phân công vừa thay đổi, tải lại", (await ReadJson(stale)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task BatchReturnsOkWithPerRowResultsAndRejectsEmptyOrOversizedLots()
    {
        var s = await Prepare();

        var mixed = await Send(HttpMethod.Post, "/api/reviewer-assignments/batch", s.Staff, new
        {
            roundId = s.RoundId,
            items = new[]
            {
                new { topicId = s.TopicId, reviewerId = s.Reviewer.Id },
                new { topicId = s.TopicId, reviewerId = s.Other.Id },
                new { topicId = Guid.NewGuid(), reviewerId = s.Reviewer.Id }
            }
        });
        Assert.Equal(HttpStatusCode.OK, mixed.StatusCode);
        var data = (await ReadJson(mixed)).GetProperty("data");
        Assert.Equal(1, data.GetProperty("succeeded").GetInt32());
        Assert.Equal(2, data.GetProperty("failed").GetInt32());
        Assert.Equal("Trùng đề tài trong lô", data.GetProperty("results")[1].GetProperty("message").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, "/api/reviewer-assignments/batch", s.Staff,
            new { roundId = s.RoundId, items = Array.Empty<object>() })).StatusCode);
        var many = Enumerable.Range(0, 201).Select(_ => new { topicId = Guid.NewGuid(), reviewerId = s.Reviewer.Id }).ToArray();
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, "/api/reviewer-assignments/batch", s.Staff,
            new { roundId = s.RoundId, items = many })).StatusCode);
    }

    // Đợt đang diễn ra với một đề tài đã có nhóm và đề cương được duyệt (đặt trực tiếp trong database).
    private async Task<Setup> Prepare()
    {
        var staff = await Login(UserRole.AcademicAffairs);
        var supervisor = await Login(UserRole.Lecturer);
        var reviewer = await Login(UserRole.Lecturer);
        var other = await Login(UserRole.Lecturer);
        var rep = await Login(UserRole.Student);
        var partner = await Login(UserRole.Student);

        var created = await ReadJson(await Send(HttpMethod.Post, "/api/rounds", staff,
            new { name = $"Đợt phản biện {Guid.NewGuid():N}", program = "Văn bằng 1", periodLabel = "K1" }));
        var roundId = created.GetProperty("data").GetProperty("id").GetGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        string[] keys = ["topicSubmission", "topicRegistration", "outline", "midterm", "final", "reviewSchedule", "defenseSchedule", "grading", "finalize"];
        var milestones = keys.Select((key, i) => new
        {
            key,
            startDate = (i == 0 ? today.AddDays(-1) : today.AddDays(i * 3)).ToString("yyyy-MM-dd"),
            endDate = (i == 0 ? today.AddDays(1) : today.AddDays(i * 3 + 2)).ToString("yyyy-MM-dd"),
            notifyAudience = "Tất cả",
            allowLate = key is "outline" or "midterm" or "final" ? (bool?)true : null,
            lateEndDate = key is "outline" or "midterm" or "final" ? today.AddDays(i * 3 + 3).ToString("yyyy-MM-dd") : null
        }).ToList();
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Put, $"/api/rounds/{roundId}/milestones", staff, new { milestones })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{roundId}/lecturers", staff,
            new { codes = new[] { supervisor.Code, reviewer.Code, other.Code } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{roundId}/students", staff,
            new { codes = new[] { rep.Code, partner.Code } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/rounds/{roundId}/open", staff)).StatusCode);

        var topic = await ReadJson(await Send(HttpMethod.Post, "/api/topics", supervisor,
            new { roundId, title = "Hệ thống gợi ý", field = "CNPM", description = "Mô tả" }));
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
        return new Setup(staff, supervisor, reviewer, other, rep, roundId, topicId);
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
