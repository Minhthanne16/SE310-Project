using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Domain.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Backend.Tests;

// Hợp đồng HTTP của /api/users mà frontend (userService.ts) dùng.
public sealed class UserManagementApiTests : IClassFixture<AuthApiTests.AuthApiFactory>
{
    private const string CookieName = "qlkltn_access";
    private readonly AuthApiTests.AuthApiFactory _factory;

    public UserManagementApiTests(AuthApiTests.AuthApiFactory factory) => _factory = factory;

    [Fact]
    public async Task UserManagementRequiresSignInAndTheAcademicAffairsRole()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().GetAsync("/api/users")).StatusCode);

        foreach (var role in new[] { UserRole.Student, UserRole.Lecturer })
        {
            var cookie = await LoginCookie(_factory.AddUser(role, "matkhau123", mustChange: false), "matkhau123");
            var response = await Send(HttpMethod.Get, "/api/users", cookie);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
            Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, "/api/users", cookie, NewUser())).StatusCode);
        }
    }

    [Fact]
    public async Task StaffManagesAnAccountFromCreationToDeletion()
    {
        var cookie = await StaffCookie();
        var body = NewUser();

        var created = await Send(HttpMethod.Post, "/api/users", cookie, body);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var user = (await ReadJson(created)).GetProperty("data");
        var id = user.GetProperty("id").GetString();
        Assert.Equal("Student", user.GetProperty("role").GetString());
        Assert.Equal("2004-03-12", user.GetProperty("dateOfBirth").GetString());
        Assert.True(user.GetProperty("mustChangePassword").GetBoolean());
        Assert.False(user.GetProperty("hasData").GetBoolean());
        Assert.Equal(JsonValueKind.Null, user.GetProperty("department").ValueKind);

        var list = (await ReadJson(await Send(HttpMethod.Get, "/api/users", cookie))).GetProperty("data");
        Assert.Contains(list.EnumerateArray(), u => u.GetProperty("id").GetString() == id);

        var updated = await Send(HttpMethod.Put, $"/api/users/{id}", cookie, new
        {
            fullName = "Tên Đã Sửa", email = body.email, dateOfBirth = (string?)null, className = "KTPM2023",
            department = (string?)null, academicTitle = (string?)null
        });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var updatedData = (await ReadJson(updated)).GetProperty("data");
        Assert.Equal("Tên Đã Sửa", updatedData.GetProperty("fullName").GetString());
        Assert.Equal(body.userCode, updatedData.GetProperty("userCode").GetString());
        Assert.Equal(JsonValueKind.Null, updatedData.GetProperty("dateOfBirth").ValueKind);

        var disabled = await Send(HttpMethod.Patch, $"/api/users/{id}/status", cookie, new { isActive = false });
        Assert.False((await ReadJson(disabled)).GetProperty("data").GetProperty("isActive").GetBoolean());
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await Client().PostAsJsonAsync("/api/auth/login", new { body.email, password = body.userCode })).StatusCode);
        var reactivated = await Send(HttpMethod.Patch, $"/api/users/{id}/status", cookie, new { isActive = true });
        Assert.True((await ReadJson(reactivated)).GetProperty("data").GetProperty("isActive").GetBoolean());

        var deleted = await Send(HttpMethod.Delete, $"/api/users/{id}", cookie);
        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
        Assert.Equal("deleted", (await ReadJson(deleted)).GetProperty("data").GetProperty("result").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Delete, $"/api/users/{id}", cookie)).StatusCode);
    }

    [Fact]
    public async Task DuplicateCodeOrEmailReturns409NamingTheField()
    {
        var cookie = await StaffCookie();
        var body = NewUser();
        await Send(HttpMethod.Post, "/api/users", cookie, body);

        var sameCode = await Send(HttpMethod.Post, "/api/users", cookie, body with { email = $"x{body.email}" });
        var sameEmail = await Send(HttpMethod.Post, "/api/users", cookie, body with { userCode = $"{body.userCode}X" });

        Assert.Equal(HttpStatusCode.Conflict, sameCode.StatusCode);
        var codeJson = await ReadJson(sameCode);
        Assert.False(codeJson.GetProperty("success").GetBoolean());
        Assert.Equal("userCode", codeJson.GetProperty("data").GetProperty("field").GetString());
        Assert.Equal("email", (await ReadJson(sameEmail)).GetProperty("data").GetProperty("field").GetString());
    }

    [Fact]
    public async Task InvalidInputReturns400WithReadableErrors()
    {
        var cookie = await StaffCookie();

        var response = await Send(HttpMethod.Post, "/api/users", cookie, NewUser() with { fullName = "", email = "sai" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJson(response)).GetProperty("errors").EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("Nhập họ tên.", errors);
        Assert.Contains("Email không hợp lệ.", errors);
    }

    [Fact]
    public async Task StaffCannotDeleteOrDisableThemselves()
    {
        var email = _factory.AddUser(UserRole.AcademicAffairs, "matkhau123", mustChange: false);
        var cookie = await LoginCookie(email, "matkhau123");
        var id = _factory.Users.Find(email).Id;

        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Delete, $"/api/users/{id}", cookie)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Send(HttpMethod.Patch, $"/api/users/{id}/status", cookie, new { isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/users", cookie)).StatusCode);
    }

    [Fact]
    public async Task ResetPasswordEndsTheUsersSessionAndRequiresAChangeOnNextLogin()
    {
        var staff = await StaffCookie();
        var email = _factory.AddUser(UserRole.Lecturer, "matkhau123", mustChange: false, code: $"GV{Guid.NewGuid():N}"[..12]);
        var target = _factory.Users.Find(email);
        var targetCookie = await LoginCookie(email, "matkhau123");

        var reset = await Send(HttpMethod.Post, $"/api/users/{target.Id}/reset-password", staff, new { newPassword = (string?)null });

        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/auth/me", targetCookie)).StatusCode);
        var login = await Client().PostAsJsonAsync("/api/auth/login", new { email, password = target.UserCode });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.True((await ReadJson(login)).GetProperty("data").GetProperty("mustChangePassword").GetBoolean());

        var weak = await Send(HttpMethod.Post, $"/api/users/{target.Id}/reset-password", staff, new { newPassword = "ngan1" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
    }

    private sealed record NewUserBody(string userCode, string fullName, string email, string role,
        string? dateOfBirth, string? className, string? department, string? academicTitle);

    private static NewUserBody NewUser()
    {
        var id = Guid.NewGuid().ToString("N")[..10];
        return new NewUserBody($"SV{id}", "Nguyễn Văn An", $"sv{id}@truong.edu.vn", "Student", "2004-03-12", "KTPM2022", "Bỏ qua", null);
    }

    private Task<string> StaffCookie() =>
        LoginCookie(_factory.AddUser(UserRole.AcademicAffairs, "matkhau123", mustChange: false), "matkhau123");

    private HttpClient Client() => _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<string> LoginCookie(string email, string password)
    {
        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var header = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith($"{CookieName}="));
        return header[(CookieName.Length + 1)..header.IndexOf(';')];
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string cookie, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Cookie", $"{CookieName}={cookie}");
        if (body is not null) request.Content = JsonContent.Create(body);
        return await Client().SendAsync(request);
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
}
