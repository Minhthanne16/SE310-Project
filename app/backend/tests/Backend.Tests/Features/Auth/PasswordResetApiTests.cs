using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Backend.Application.Auth;
using Backend.Domain.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Backend.Tests;

// Hợp đồng HTTP quên mật khẩu (PDR-052) mà trang /quen-mat-khau dùng.
public sealed partial class PasswordResetApiTests : IClassFixture<AuthApiTests.AuthApiFactory>
{
    private const string CookieName = "qlkltn_access";
    private readonly AuthApiTests.AuthApiFactory _factory;

    public PasswordResetApiTests(AuthApiTests.AuthApiFactory factory) => _factory = factory;

    [GeneratedRegex("http://localhost:3000/quen-mat-khau#token=([A-Za-z0-9_-]+)")]
    private static partial Regex ResetLink();

    [Fact]
    public async Task KnownAndUnknownEmailsGetIdenticalResponses()
    {
        var email = _factory.AddUser(UserRole.Student, "matkhau123", mustChange: false);

        var known = await Client().PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var unknown = await Client().PostAsJsonAsync("/api/auth/forgot-password", new { email = $"x{email}" });

        Assert.Equal(HttpStatusCode.OK, known.StatusCode);
        Assert.Equal(HttpStatusCode.OK, unknown.StatusCode);
        var knownBody = await known.Content.ReadAsStringAsync();
        Assert.Equal(knownBody, await unknown.Content.ReadAsStringAsync());
        Assert.Contains(PasswordResetPolicy.NeutralMessage, knownBody);
        Assert.Single(SentTo(email));
        Assert.Empty(SentTo($"x{email}"));
    }

    [Fact]
    public async Task MalformedEmailIsA400WithFieldErrors()
    {
        var response = await Client().PostAsJsonAsync("/api/auth/forgot-password", new { email = "khong-phai-email" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await ReadJson(response);
        Assert.False(json.GetProperty("success").GetBoolean());
        Assert.Contains("Email không đúng định dạng.", json.GetProperty("errors").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public async Task LinkResetsThePasswordOnceAndRevokesOldSessions()
    {
        var email = _factory.AddUser(UserRole.Lecturer, "matkhau123", mustChange: false);
        var oldCookie = await LoginCookie(email, "matkhau123");
        await Client().PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var token = ResetLink().Match(SentTo(email).Single().Text).Groups[1].Value;

        var check = await ReadJson(await Client().PostAsJsonAsync("/api/auth/reset-password/check", new { token }));
        Assert.Equal("valid", check.GetProperty("data").GetProperty("status").GetString());

        var reset = await Client().PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword = "MatKhauMoi9" });
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        Assert.Equal("completed", (await ReadJson(reset)).GetProperty("data").GetProperty("status").GetString());

        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/auth/me", oldCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await Client().PostAsJsonAsync("/api/auth/login", new { email, password = "matkhau123" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await Client().PostAsJsonAsync("/api/auth/login", new { email, password = "MatKhauMoi9" })).StatusCode);

        var again = await Client().PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword = "KhacNua123" });
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Equal("used", (await ReadJson(again)).GetProperty("data").GetProperty("status").GetString());
    }

    [Fact]
    public async Task WeakNewPasswordIsA400WithFieldErrors()
    {
        var response = await Client().PostAsJsonAsync("/api/auth/reset-password", new { token = "bat-ky", newPassword = "ngan" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Mật khẩu mới tối thiểu 8 ký tự.",
            (await ReadJson(response)).GetProperty("errors").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public async Task UnknownTokenChecksAsInvalid()
    {
        var check = await ReadJson(await Client().PostAsJsonAsync("/api/auth/reset-password/check", new { token = "khong-co" }));
        Assert.True(check.GetProperty("success").GetBoolean());
        Assert.Equal("invalid", check.GetProperty("data").GetProperty("status").GetString());
    }

    private IEnumerable<CapturingEmailSender.Message> SentTo(string email)
    {
        lock (_factory.Emails.Sent)
            return _factory.Emails.Sent.Where(m => m.To == email && m.Subject.Contains("Đặt lại mật khẩu")).ToList();
    }

    private HttpClient Client() => _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<string> LoginCookie(string email, string password)
    {
        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var header = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith($"{CookieName}="));
        return header[(CookieName.Length + 1)..header.IndexOf(';')];
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string cookie)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Cookie", $"{CookieName}={cookie}");
        return await Client().SendAsync(request);
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
}
