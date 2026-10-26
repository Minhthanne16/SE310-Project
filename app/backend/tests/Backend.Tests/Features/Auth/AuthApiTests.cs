using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Application.Auth;
using Backend.Application.Common.Email;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Backend.Tests;

public sealed class AuthApiTests : IClassFixture<AuthApiTests.AuthApiFactory>
{
    private const string CookieName = "qlkltn_access";
    private readonly AuthApiFactory _factory;

    public AuthApiTests(AuthApiFactory factory) => _factory = factory;

    [Fact]
    public async Task LoginSetsHttpOnlyCookieAndReturnsUserWithoutToken()
    {
        var email = _factory.AddUser(UserRole.Student, "matkhau123", mustChange: false);

        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password = "matkhau123" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var setCookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith($"{CookieName}="));
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", setCookie, StringComparison.OrdinalIgnoreCase);
        var body = await ReadJson(response);
        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.Equal("Student", body.GetProperty("data").GetProperty("role").GetString());
        Assert.False(body.GetProperty("data").GetProperty("mustChangePassword").GetBoolean());
        Assert.DoesNotContain(CookieValue(response), await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task LoginWithWrongPasswordReturns401ApiResponse()
    {
        var email = _factory.AddUser(UserRole.Student, "matkhau123", mustChange: false);

        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password = "sai-mat-khau1" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        var body = await ReadJson(response);
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(LoginHandler.InvalidCredentialsMessage, body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task LoginWithUnknownEmailReturns401WithSameMessage()
    {
        var response = await Client().PostAsJsonAsync("/api/auth/login",
            new { email = $"khong.ton.tai.{Guid.NewGuid():N}@truong.edu.vn", password = "matkhau123" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(LoginHandler.InvalidCredentialsMessage, (await ReadJson(response)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task ProtectedEndpointWithoutCookieReturns401ApiResponse()
    {
        var response = await Client().GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
    }

    [Theory]
    [InlineData(UserRole.Student, "student", HttpStatusCode.OK)]
    [InlineData(UserRole.Student, "lecturer", HttpStatusCode.Forbidden)]
    [InlineData(UserRole.Student, "academic-affairs", HttpStatusCode.Forbidden)]
    [InlineData(UserRole.Lecturer, "lecturer", HttpStatusCode.OK)]
    [InlineData(UserRole.Lecturer, "academic-affairs", HttpStatusCode.Forbidden)]
    [InlineData(UserRole.AcademicAffairs, "academic-affairs", HttpStatusCode.OK)]
    [InlineData(UserRole.AcademicAffairs, "staff", HttpStatusCode.OK)]
    [InlineData(UserRole.Lecturer, "staff", HttpStatusCode.OK)]
    [InlineData(UserRole.Student, "staff", HttpStatusCode.Forbidden)]
    [InlineData(UserRole.Student, "any", HttpStatusCode.OK)]
    public async Task RoleBasedAuthorization(UserRole role, string endpoint, HttpStatusCode expected)
    {
        var cookie = await LoginCookie(_factory.AddUser(role, "matkhau123", mustChange: false), "matkhau123");

        var response = await Send(HttpMethod.Get, $"/api/test-rbac/{endpoint}", cookie);

        Assert.Equal(expected, response.StatusCode);
        if (expected == HttpStatusCode.Forbidden)
            Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task InitialPasswordTokenOnlyAllowsProfileAndPasswordChange()
    {
        var email = _factory.AddUser(UserRole.Student, "22520001", mustChange: true, code: "22520001");
        var initialCookie = await LoginCookie(email, "22520001");

        var me = await Send(HttpMethod.Get, "/api/auth/me", initialCookie);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.True((await ReadJson(me)).GetProperty("data").GetProperty("mustChangePassword").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/test-rbac/student", initialCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/test-rbac/any", initialCookie)).StatusCode);

        var sendCode = await Send(HttpMethod.Post, "/api/auth/activation-code", initialCookie);
        Assert.Equal(HttpStatusCode.OK, sendCode.StatusCode);
        Assert.Contains(_factory.Emails.Sent, m => m.To == email && m.Text.Contains(AuthApiFactory.Code));

        var change = await Send(HttpMethod.Post, "/api/auth/change-initial-password", initialCookie,
            new { currentPassword = "22520001", newPassword = "matkhau123", activationCode = AuthApiFactory.Code });
        Assert.Equal(HttpStatusCode.OK, change.StatusCode);
        var newCookie = CookieValue(change);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/test-rbac/student", newCookie)).StatusCode);
        // Đổi mật khẩu xoay SecurityStamp nên token cũ hết hiệu lực.
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/auth/me", initialCookie)).StatusCode);
    }

    [Fact]
    public async Task ChangeInitialPasswordWithWrongCurrentPasswordReturns400()
    {
        var email = _factory.AddUser(UserRole.Student, "22520001", mustChange: true, code: "22520001");
        var cookie = await LoginCookie(email, "22520001");

        await Send(HttpMethod.Post, "/api/auth/activation-code", cookie);

        var response = await Send(HttpMethod.Post, "/api/auth/change-initial-password", cookie,
            new { currentPassword = "sai12345", newPassword = "matkhau123", activationCode = AuthApiFactory.Code });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task ResendingActivationCodeTooSoonReturns429()
    {
        var cookie = await LoginCookie(_factory.AddUser(UserRole.Student, "22520001", mustChange: true, code: "22520001"), "22520001");

        var first = await Send(HttpMethod.Post, "/api/auth/activation-code", cookie);
        var second = await Send(HttpMethod.Post, "/api/auth/activation-code", cookie);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var data = (await ReadJson(first)).GetProperty("data");
        Assert.True(data.TryGetProperty("expiresAt", out _));
        Assert.True(data.TryGetProperty("resendAvailableAt", out _));
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
        Assert.False((await ReadJson(second)).GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task ActivationCodeForActivatedAccountReturns400()
    {
        var cookie = await LoginCookie(_factory.AddUser(UserRole.Student, "matkhau123", mustChange: false), "matkhau123");

        var response = await Send(HttpMethod.Post, "/api/auth/activation-code", cookie);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ActivationCodeEmailFailureReturns503()
    {
        var cookie = await LoginCookie(_factory.AddUser(UserRole.Student, "22520001", mustChange: true, code: "22520001"), "22520001");
        _factory.Emails.FailNext = true;

        var response = await Send(HttpMethod.Post, "/api/auth/activation-code", cookie);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task DeactivatedAccountTokenIsRejected()
    {
        var email = _factory.AddUser(UserRole.Lecturer, "matkhau123", mustChange: false);
        var cookie = await LoginCookie(email, "matkhau123");
        _factory.Users.Find(email).IsActive = false;

        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/test-rbac/lecturer", cookie)).StatusCode);
    }

    [Fact]
    public async Task LogoutExpiresCookie()
    {
        var response = await Client().PostAsync("/api/auth/logout", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var setCookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith($"{CookieName}="));
        Assert.Contains("expires=Thu, 01 Jan 1970", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    private const string ImportCsv = "user_code,full_name,email,role,class_name,department\n" +
                                     "{0},Nguyễn Văn An,{1},Student,KTPM2022,\n" +
                                     "{2},,thieu.ten@truong.edu.vn,Student,KTPM2022,\n";

    [Theory]
    [InlineData(UserRole.Student)]
    [InlineData(UserRole.Lecturer)]
    public async Task OnlyAcademicAffairsCanImportUsers(UserRole role)
    {
        var cookie = await LoginCookie(_factory.AddUser(role, "matkhau123", mustChange: false), "matkhau123");

        var response = await Upload("/api/users/import/preview", cookie, Csv(out _, out _), "ds.csv");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PreviewReturnsReportWithoutCreatingAccounts()
    {
        var cookie = await LoginCookie(_factory.AddUser(UserRole.AcademicAffairs, "matkhau123", mustChange: false), "matkhau123");

        var response = await Upload("/api/users/import/preview", cookie, Csv(out var code, out var email), "ds.csv");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var data = (await ReadJson(response)).GetProperty("data");
        Assert.Equal(2, data.GetProperty("totalRows").GetInt32());
        Assert.Equal(1, data.GetProperty("validRows").GetInt32());
        Assert.Equal(0, data.GetProperty("importedRows").GetInt32());
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().PostAsJsonAsync("/api/auth/login", new { email, password = code })).StatusCode);
    }

    [Fact]
    public async Task ImportedAccountCanLogInWithUserCodeAndMustActivate()
    {
        var cookie = await LoginCookie(_factory.AddUser(UserRole.AcademicAffairs, "matkhau123", mustChange: false), "matkhau123");

        var response = await Upload("/api/users/import", cookie, Csv(out var code, out var email), "ds.csv");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var data = (await ReadJson(response)).GetProperty("data");
        Assert.Equal(1, data.GetProperty("importedRows").GetInt32());
        Assert.Equal(1, data.GetProperty("errorRows").GetInt32());

        var login = await Client().PostAsJsonAsync("/api/auth/login", new { email, password = code });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.True((await ReadJson(login)).GetProperty("data").GetProperty("mustChangePassword").GetBoolean());
    }

    [Theory]
    [InlineData("ds.xlsx")]
    [InlineData(null)]
    public async Task ImportRejectsMissingOrNonCsvFile(string? fileName)
    {
        var cookie = await LoginCookie(_factory.AddUser(UserRole.AcademicAffairs, "matkhau123", mustChange: false), "matkhau123");

        var response = await Upload("/api/users/import/preview", cookie, Csv(out _, out _), fileName);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
    }

    private static string Csv(out string code, out string email)
    {
        var id = Guid.NewGuid().ToString("N")[..10];
        code = $"SV{id}";
        email = $"sv{id}@truong.edu.vn";
        return string.Format(ImportCsv, code, email, $"SX{id}");
    }

    private async Task<HttpResponseMessage> Upload(string url, string cookie, string csv, string? fileName)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Cookie", $"{CookieName}={cookie}");
        var form = new MultipartFormDataContent();
        if (fileName is not null)
            form.Add(new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes(csv)), "file", fileName);
        else
            form.Add(new StringContent("x"), "note");
        request.Content = form;
        return await Client().SendAsync(request);
    }

    private HttpClient Client() => _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<string> LoginCookie(string email, string password)
    {
        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        return CookieValue(response);
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string cookie, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Cookie", $"{CookieName}={cookie}");
        if (body is not null) request.Content = JsonContent.Create(body);
        return await Client().SendAsync(request);
    }

    private static string CookieValue(HttpResponseMessage response)
    {
        var header = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith($"{CookieName}="));
        return header[(CookieName.Length + 1)..header.IndexOf(';')];
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    public sealed class AuthApiFactory : WebApplicationFactory<Program>
    {
        public const string Code = "246810";
        public TestUserStore Users { get; } = new();
        internal CapturingEmailSender Emails { get; } = new();

        public string AddUser(UserRole role, string password, bool mustChange, string? code = null) =>
            Users.Add(role, password, mustChange, code);

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            // Test host không được ghi Windows Event Log; lỗi nghiệp vụ vẫn phải
            // được chuyển thành HTTP response để test xác nhận đúng hợp đồng API.
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(TestConfiguration.Values));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IUserRepository>();
                services.AddSingleton<IUserRepository>(Users.Repository);
                services.RemoveAll<IEmailSender>();
                services.AddSingleton<IEmailSender>(Emails);
                services.RemoveAll<IActivationCodeGenerator>();
                services.AddSingleton<IActivationCodeGenerator>(new FixedCodeGenerator(Code));
                services.AddControllers().AddApplicationPart(typeof(RbacProbeController).Assembly);
            });
        }
    }

    public sealed class TestUserStore
    {
        private int _sequence;
        private readonly Dictionary<string, User> _byEmail = [];
        internal InMemoryUserRepository Repository { get; } = new();

        public string Add(UserRole role, string password, bool mustChange, string? code)
        {
            var n = Interlocked.Increment(ref _sequence);
            var email = $"user{n}.{Guid.NewGuid():N}@truong.edu.vn";
            var user = Repository.Add(code ?? $"U{n:D5}", email, password, role, mustChange, p => BCrypt.Net.BCrypt.HashPassword(p, 4));
            lock (_byEmail) _byEmail[email] = user;
            return email;
        }

        public User Find(string email)
        {
            lock (_byEmail) return _byEmail[email];
        }
    }
}

internal static class TestConfiguration
{
    public static readonly Dictionary<string, string?> Values = new()
    {
        ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=se310_test;Username=test;Password=test",
        ["InitializeDatabase"] = "false",
        ["SeedSampleProducts"] = "false",
        ["Authentication:Jwt:SigningKey"] = "test-signing-key-that-is-at-least-32-bytes-long",
        ["Authentication:Jwt:Issuer"] = "se310-api",
        ["Authentication:Jwt:Audience"] = "se310-web"
    };
}

[ApiController]
[Route("api/test-rbac")]
public sealed class RbacProbeController : ControllerBase
{
    [HttpGet("student"), Authorize(Roles = AppRoles.Student)]
    public IActionResult Student() => Ok();

    [HttpGet("lecturer"), Authorize(Roles = AppRoles.Lecturer)]
    public IActionResult Lecturer() => Ok();

    [HttpGet("academic-affairs"), Authorize(Roles = AppRoles.AcademicAffairs)]
    public IActionResult AcademicAffairs() => Ok();

    [HttpGet("staff"), Authorize(Roles = $"{AppRoles.Lecturer},{AppRoles.AcademicAffairs}")]
    public IActionResult Staff() => Ok();

    [HttpGet("any"), Authorize]
    public IActionResult Any() => Ok();
}
