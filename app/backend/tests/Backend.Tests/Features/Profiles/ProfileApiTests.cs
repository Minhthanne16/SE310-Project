using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Application.Profiles;
using Backend.Domain.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Backend.Tests;

// Hợp đồng HTTP của /api/profile và /api/auth/change-password mà frontend dùng (P01-S03).
public sealed class ProfileApiTests : IClassFixture<AuthApiTests.AuthApiFactory>
{
    private const string CookieName = "qlkltn_access";
    private const string Password = "matkhau123";
    private readonly AuthApiTests.AuthApiFactory _factory;

    public ProfileApiTests(AuthApiTests.AuthApiFactory factory) => _factory = factory;

    private static byte[] Png(int size = 64)
    {
        var bytes = new byte[size];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }.CopyTo(bytes, 0);
        return bytes;
    }

    private static byte[] Jpeg(int size = 64)
    {
        var bytes = new byte[size];
        new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }.CopyTo(bytes, 0);
        return bytes;
    }

    private static byte[] Webp(int size = 64)
    {
        var bytes = new byte[size];
        "RIFF"u8.CopyTo(bytes);
        "WEBP"u8.CopyTo(bytes.AsSpan(8));
        return bytes;
    }

    [Fact]
    public async Task EveryProfileEndpointRequiresSignIn()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().GetAsync("/api/profile")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().PutAsJsonAsync("/api/profile", new { fullName = "A" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().GetAsync("/api/profile/avatar")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().DeleteAsync("/api/profile/avatar")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().PostAsJsonAsync("/api/auth/change-password", new { currentPassword = "a", newPassword = "b" })).StatusCode);
    }

    [Fact]
    public async Task AccountWaitingForActivationCannotUseProfile()
    {
        var email = _factory.AddUser(UserRole.Student, "22520099", mustChange: true, code: $"SV{Guid.NewGuid():N}"[..12]);
        var cookie = await LoginCookie(email, "22520099");

        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/profile", cookie)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, "/api/auth/change-password", cookie,
            new { currentPassword = "22520099", newPassword = "matkhau456" })).StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Student)]
    [InlineData(UserRole.Lecturer)]
    [InlineData(UserRole.AcademicAffairs)]
    public async Task EveryRoleEditsTheirOwnProfileAndItPersists(UserRole role)
    {
        var (user, cookie) = await SignIn(role);

        var response = await Send(HttpMethod.Put, "/api/profile", cookie, new
        {
            fullName = "  Tên Mới  ",
            dateOfBirth = "2004-03-12",
            phone = "0912 345.678",
            secondaryEmail = "Phu@Gmail.com"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var read = (await ReadJson(await Send(HttpMethod.Get, "/api/profile", cookie))).GetProperty("data");
        Assert.Equal("Tên Mới", read.GetProperty("fullName").GetString());
        Assert.Equal("2004-03-12", read.GetProperty("dateOfBirth").GetString());
        Assert.Equal("0912345678", read.GetProperty("phone").GetString());
        Assert.Equal("phu@gmail.com", read.GetProperty("secondaryEmail").GetString());
        Assert.Equal("Tên Mới", (await ReadJson(await Send(HttpMethod.Get, "/api/auth/me", cookie))).GetProperty("data").GetProperty("fullName").GetString());

        // PDR-036: lịch sử ghi người thực hiện, tài khoản được sửa và giá trị trước/sau.
        var audit = _factory.Users.Repository.Audits.Last(a => a.TargetUserId == user.Id);
        Assert.Equal(user.Id, audit.ActorUserId);
        Assert.Equal(UserAuditActions.Updated, audit.Action);
        var fullName = JsonDocument.Parse(audit.Details!).RootElement.GetProperty("fullName");
        Assert.StartsWith("Người dùng", fullName.GetProperty("from").GetString());
        Assert.Equal("Tên Mới", fullName.GetProperty("to").GetString());
    }

    [Fact]
    public async Task ForbiddenFieldsInTheBodyAreIgnored()
    {
        var (user, cookie) = await SignIn(UserRole.Student);
        var (code, email, password) = (user.UserCode, user.Email, user.PasswordHash);
        user.ClassName = "KTPM2022";

        var response = await Send(HttpMethod.Put, "/api/profile", cookie, new
        {
            fullName = "Tên Mới",
            id = Guid.NewGuid(),
            userCode = "HACKED",
            email = "hacked@truong.edu.vn",
            role = "AcademicAffairs",
            className = "HACKED",
            department = "HACKED",
            isActive = false,
            passwordHash = "x"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(code, user.UserCode);
        Assert.Equal(email, user.Email);
        Assert.Equal(password, user.PasswordHash);
        Assert.Equal(UserRole.Student, user.Role);
        Assert.Equal("KTPM2022", user.ClassName);
        Assert.Null(user.Department);
        Assert.True(user.IsActive);
    }

    [Fact]
    public async Task EmptyOptionalFieldsAreClearedAndNoChangeWritesNoHistory()
    {
        var (user, cookie) = await SignIn(UserRole.Student);
        var name = user.FullName;
        await Send(HttpMethod.Put, "/api/profile", cookie, new { fullName = name, phone = "0912345678" });
        var cleared = await Send(HttpMethod.Put, "/api/profile", cookie, new { fullName = name, phone = "", secondaryEmail = "" });
        Assert.Equal(JsonValueKind.Null, (await ReadJson(cleared)).GetProperty("data").GetProperty("phone").ValueKind);

        var audits = _factory.Users.Repository.Audits.Count(a => a.TargetUserId == user.Id);
        var same = await Send(HttpMethod.Put, "/api/profile", cookie, new { fullName = name });
        Assert.Equal(HttpStatusCode.OK, same.StatusCode);
        Assert.Equal(audits, _factory.Users.Repository.Audits.Count(a => a.TargetUserId == user.Id));
    }

    [Theory]
    [InlineData("", null, null, "Nhập họ tên.")]
    [InlineData("A", "12345", null, "Số điện thoại không đúng định dạng")]
    [InlineData("A", null, "khong-hop-le", "Email phụ không đúng định dạng")]
    public async Task InvalidFieldsAreRejectedWithReadableErrors(string fullName, string? phone, string? secondaryEmail, string expected)
    {
        var (user, cookie) = await SignIn(UserRole.Student);
        var name = user.FullName;

        var response = await Send(HttpMethod.Put, "/api/profile", cookie, new { fullName, phone, secondaryEmail });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await ReadJson(response);
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Contains(body.GetProperty("errors").EnumerateArray(), e => e.GetString()!.Contains(expected));
        Assert.Equal(name, user.FullName);
    }

    [Fact]
    public async Task SecondaryEmailMustDifferFromLoginEmailAndBirthDateCannotBeInTheFuture()
    {
        var (user, cookie) = await SignIn(UserRole.Student);

        var sameEmail = await Send(HttpMethod.Put, "/api/profile", cookie, new { fullName = "A", secondaryEmail = user.Email.ToUpperInvariant() });
        Assert.Equal(HttpStatusCode.BadRequest, sameEmail.StatusCode);
        Assert.Contains("Email phụ phải khác email tài khoản.", await sameEmail.Content.ReadAsStringAsync());

        var future = DateTime.UtcNow.AddDays(3).ToString("yyyy-MM-dd");
        var dob = await Send(HttpMethod.Put, "/api/profile", cookie, new { fullName = "A", dateOfBirth = future });
        Assert.Equal(HttpStatusCode.BadRequest, dob.StatusCode);
        Assert.Contains("Ngày sinh không được ở tương lai.", await dob.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("jpeg")]
    [InlineData("png")]
    [InlineData("webp")]
    public async Task ValidImagesAreStoredAndServedToTheirOwner(string kind)
    {
        var (bytes, contentType) = kind switch
        {
            "jpeg" => (Jpeg(), "image/jpeg"),
            "png" => (Png(), "image/png"),
            _ => (Webp(), "image/webp")
        };
        var (_, cookie) = await SignIn(UserRole.Student);

        var upload = await Upload(cookie, bytes, "tệp.bin", "application/octet-stream");

        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var url = (await ReadJson(upload)).GetProperty("data").GetProperty("avatarUrl").GetString();
        Assert.StartsWith("/api/profile/avatar?v=", url);
        Assert.Equal(url, (await ReadJson(await Send(HttpMethod.Get, "/api/auth/me", cookie))).GetProperty("data").GetProperty("avatarUrl").GetString());

        var image = await Send(HttpMethod.Get, url!, cookie);
        Assert.Equal(HttpStatusCode.OK, image.StatusCode);
        Assert.Equal(contentType, image.Content.Headers.ContentType!.MediaType);
        Assert.Equal(bytes, await image.Content.ReadAsByteArrayAsync());
        Assert.Equal("nosniff", image.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [Fact]
    public async Task ImageExactlyAtTheLimitIsAcceptedAndOneByteOverIsRejected()
    {
        var (_, cookie) = await SignIn(UserRole.Student);

        Assert.Equal(HttpStatusCode.OK, (await Upload(cookie, Png((int)AvatarPolicy.MaxBytes))).StatusCode);

        var over = await Upload(cookie, Png((int)AvatarPolicy.MaxBytes + 1));
        Assert.Equal(HttpStatusCode.BadRequest, over.StatusCode);
        Assert.Equal(AvatarPolicy.TooLargeMessage, (await ReadJson(over)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task FakeImageIsRejectedAndKeepsThePreviousAvatar()
    {
        var (user, cookie) = await SignIn(UserRole.Student);
        var good = Png();
        Assert.Equal(HttpStatusCode.OK, (await Upload(cookie, good)).StatusCode);
        var key = user.AvatarObjectKey;

        // Khai báo là PNG nhưng nội dung không phải ảnh.
        var fake = await Upload(cookie, "<script>alert(1)</script>"u8.ToArray(), "a.png", "image/png");

        Assert.Equal(HttpStatusCode.BadRequest, fake.StatusCode);
        Assert.Equal(AvatarPolicy.InvalidFormatMessage, (await ReadJson(fake)).GetProperty("message").GetString());
        Assert.Equal(key, user.AvatarObjectKey);
        Assert.Equal(good, await (await Send(HttpMethod.Get, "/api/profile/avatar", cookie)).Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task ReplacingAndRemovingAvatarLeaveNoOrphanObjects()
    {
        var (user, cookie) = await SignIn(UserRole.Student);
        await Upload(cookie, Png());
        var first = user.AvatarObjectKey!;
        await Upload(cookie, Jpeg());
        var second = user.AvatarObjectKey!;
        Assert.NotEqual(first, second);
        Assert.Contains(user.Id.ToString("N"), second);
        Assert.False(_factory.Avatars.Contains(first));
        Assert.True(_factory.Avatars.Contains(second));

        var removed = await Send(HttpMethod.Delete, "/api/profile/avatar", cookie);
        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await ReadJson(removed)).GetProperty("data").GetProperty("avatarUrl").ValueKind);
        Assert.False(_factory.Avatars.Contains(second));
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, "/api/profile/avatar", cookie)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Delete, "/api/profile/avatar", cookie)).StatusCode);
    }

    [Fact]
    public async Task StorageFailureReturns503AndKeepsThePreviousAvatar()
    {
        var (user, cookie) = await SignIn(UserRole.Student);
        await Upload(cookie, Png());
        var key = user.AvatarObjectKey;

        _factory.Avatars.FailNextSave = true;
        var response = await Upload(cookie, Jpeg());

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
        Assert.Equal(key, user.AvatarObjectKey);
    }

    [Fact]
    public async Task EachUserOnlySeesTheirOwnAvatar()
    {
        var (_, owner) = await SignIn(UserRole.Student);
        var (_, other) = await SignIn(UserRole.Student);
        var url = (await ReadJson(await Upload(owner, Png()))).GetProperty("data").GetProperty("avatarUrl").GetString()!;

        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, url, other)).StatusCode);
    }

    [Fact]
    public async Task ChangingPasswordRevokesOldTokensAndKeepsTheCurrentSession()
    {
        var (user, oldCookie) = await SignIn(UserRole.Lecturer);

        var response = await Send(HttpMethod.Post, "/api/auth/change-password", oldCookie,
            new { currentPassword = Password, newPassword = "matkhau456" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False((await ReadJson(response)).GetProperty("data").GetProperty("mustChangePassword").GetBoolean());
        var newCookie = CookieValue(response);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/profile", oldCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/profile", newCookie)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = Password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Client().PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = "matkhau456" })).StatusCode);

        var audit = _factory.Users.Repository.Audits.Last(a => a.TargetUserId == user.Id);
        Assert.Equal(UserAuditActions.PasswordChanged, audit.Action);
        Assert.Null(audit.Details);
    }

    [Theory]
    [InlineData(Password + "x", "matkhau456", "Mật khẩu hiện tại không đúng.")]
    [InlineData(Password, Password, "Mật khẩu mới phải khác mật khẩu hiện tại.")]
    [InlineData(Password, "ngan1", "Mật khẩu mới tối thiểu 8 ký tự.")]
    [InlineData(Password, "chicochu", "Mật khẩu mới phải có số.")]
    public async Task ChangePasswordRejectsBadInputAndKeepsTheSession(string current, string next, string expected)
    {
        var (_, cookie) = await SignIn(UserRole.Student);

        var response = await Send(HttpMethod.Post, "/api/auth/change-password", cookie, new { currentPassword = current, newPassword = next });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(expected, await response.Content.ReadAsStringAsync());
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/profile", cookie)).StatusCode);
    }

    [Fact]
    public async Task ChangePasswordCannotBeTheUserCode()
    {
        var code = $"AB{Guid.NewGuid():N}"[..10] + "12";
        var email = _factory.AddUser(UserRole.Student, Password, mustChange: false, code: code);
        var cookie = await LoginCookie(email, Password);

        var response = await Send(HttpMethod.Post, "/api/auth/change-password", cookie, new { currentPassword = Password, newPassword = code });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Mật khẩu mới phải khác mã người dùng.", await response.Content.ReadAsStringAsync());
    }

    private async Task<(User User, string Cookie)> SignIn(UserRole role)
    {
        var email = _factory.AddUser(role, Password, mustChange: false);
        return (_factory.Users.Find(email), await LoginCookie(email, Password));
    }

    private HttpClient Client() => _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<string> LoginCookie(string email, string password)
    {
        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        return CookieValue(response);
    }

    private static string CookieValue(HttpResponseMessage response)
    {
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

    private async Task<HttpResponseMessage> Upload(string cookie, byte[] bytes, string fileName = "anh.png", string contentType = "image/png")
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        var request = new HttpRequestMessage(HttpMethod.Put, "/api/profile/avatar")
        {
            Content = new MultipartFormDataContent { { file, "file", fileName } }
        };
        request.Headers.Add("Cookie", $"{CookieName}={cookie}");
        return await Client().SendAsync(request);
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
}
