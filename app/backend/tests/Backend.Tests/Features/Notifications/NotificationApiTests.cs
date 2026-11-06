using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Application.Notifications;
using Backend.Application.Rounds;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Notifications;
using Backend.Infrastructure.Repositories.Users;
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

// Hợp đồng HTTP của /api/notifications mà chuông ở thanh trên dùng (P01-S03).
public sealed class NotificationApiTests : IClassFixture<NotificationApiTests.Factory>
{
    private const string CookieName = "qlkltn_access";
    private const string Password = "matkhau123";
    private readonly Factory _factory;

    public NotificationApiTests(Factory factory) => _factory = factory;

    [Fact]
    public async Task EndpointsRequireSignIn()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().GetAsync("/api/notifications/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().PostAsJsonAsync("/api/notifications/read", new { ids = new[] { Guid.NewGuid() } })).StatusCode);
    }

    [Theory]
    [InlineData(UserRole.Student)]
    [InlineData(UserRole.Lecturer)]
    [InlineData(UserRole.AcademicAffairs)]
    public async Task EveryRoleReadsOnlyTheirOwnNewestFirst(UserRole role)
    {
        var (me, cookie) = await SignIn(role);
        var (other, _) = await SignIn(role);
        var sender = await _factory.SeedUser("Giáo vụ Khoa");
        var now = DateTime.UtcNow;
        await _factory.Seed(
            Row(me, "Cũ", now.AddHours(-2)),
            Row(me, "Mới", now, sender),
            Row(other, "Của người khác", now));

        var data = (await ReadJson(await Send(HttpMethod.Get, "/api/notifications/me", cookie))).GetProperty("data");

        Assert.Equal(2, data.GetArrayLength());
        var newest = data[0];
        Assert.Equal("Mới", newest.GetProperty("text").GetString());
        Assert.Equal("Giáo vụ Khoa", newest.GetProperty("from").GetString());
        Assert.Equal("post", newest.GetProperty("kind").GetString());
        Assert.Equal("/sv", newest.GetProperty("href").GetString());
        Assert.False(newest.GetProperty("isRead").GetBoolean());
        Assert.EndsWith("Z", newest.GetProperty("createdAt").GetString());
        Assert.Equal(NotificationPolicy.SystemSender, data[1].GetProperty("from").GetString());
    }

    [Fact]
    public async Task NewUserHasAnEmptyList()
    {
        var (_, cookie) = await SignIn(UserRole.Student);
        var response = await Send(HttpMethod.Get, "/api/notifications/me", cookie);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, (await ReadJson(response)).GetProperty("data").GetArrayLength());
    }

    [Fact]
    public async Task ListIsCappedAtTheLimit()
    {
        var (me, cookie) = await SignIn(UserRole.Student);
        var now = DateTime.UtcNow;
        await _factory.Seed(Enumerable.Range(0, NotificationPolicy.ListLimit + 5)
            .Select(i => Row(me, $"Thông báo {i}", now.AddMinutes(-i))).ToArray());

        var data = (await ReadJson(await Send(HttpMethod.Get, "/api/notifications/me", cookie))).GetProperty("data");

        Assert.Equal(NotificationPolicy.ListLimit, data.GetArrayLength());
        Assert.Equal("Thông báo 0", data[0].GetProperty("text").GetString());
    }

    [Fact]
    public async Task MarkingReadPersistsAndIsIdempotent()
    {
        var (me, cookie) = await SignIn(UserRole.Student);
        var first = Row(me, "Một", DateTime.UtcNow);
        var second = Row(me, "Hai", DateTime.UtcNow.AddMinutes(-1));
        await _factory.Seed(first, second);

        var response = await Send(HttpMethod.Post, "/api/notifications/read", cookie, new { ids = new[] { first.Id } });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, (await ReadJson(response)).GetProperty("data").GetInt32());
        var again = await Send(HttpMethod.Post, "/api/notifications/read", cookie, new { ids = new[] { first.Id } });
        Assert.Equal(0, (await ReadJson(again)).GetProperty("data").GetInt32());

        var data = (await ReadJson(await Send(HttpMethod.Get, "/api/notifications/me", cookie))).GetProperty("data");
        Assert.True(data[0].GetProperty("isRead").GetBoolean());
        Assert.False(data[1].GetProperty("isRead").GetBoolean());
    }

    [Fact]
    public async Task CannotMarkSomeoneElsesNotificationRead()
    {
        var (owner, ownerCookie) = await SignIn(UserRole.Student);
        var (_, attacker) = await SignIn(UserRole.AcademicAffairs);
        var row = Row(owner, "Riêng", DateTime.UtcNow);
        await _factory.Seed(row);

        var response = await Send(HttpMethod.Post, "/api/notifications/read", attacker, new { ids = new[] { row.Id } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, (await ReadJson(response)).GetProperty("data").GetInt32());
        var data = (await ReadJson(await Send(HttpMethod.Get, "/api/notifications/me", ownerCookie))).GetProperty("data");
        Assert.False(data[0].GetProperty("isRead").GetBoolean());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(NotificationPolicy.MaxMarkReadIds + 1)]
    public async Task MarkReadRejectsAnOutOfRangeIdCount(int count)
    {
        var (_, cookie) = await SignIn(UserRole.Student);
        var ids = Enumerable.Range(0, count).Select(_ => Guid.NewGuid()).ToArray();

        var response = await Send(HttpMethod.Post, "/api/notifications/read", cookie, new { ids });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False((await ReadJson(response)).GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task AccountWithNotificationsCountsAsHavingData()
    {
        var recipient = await _factory.SeedUser("Người nhận");
        var sender = await _factory.SeedUser("Người gửi");
        var bystander = await _factory.SeedUser("Không liên quan");
        await _factory.Seed(new Notification { BatchId = Guid.NewGuid(), RecipientUserId = recipient, SenderUserId = sender, Text = "x" });

        using var db = _factory.NewContext();
        var withData = await new UserRepository(db).GetUserIdsWithRelatedDataAsync([recipient, sender, bystander]);

        Assert.Contains(recipient, withData);
        Assert.Contains(sender, withData);
        Assert.DoesNotContain(bystander, withData);
    }

    private static Notification Row(Guid recipient, string text, DateTime createdAt, Guid? sender = null) => new()
    {
        BatchId = Guid.NewGuid(),
        RecipientUserId = recipient,
        SenderUserId = sender,
        Kind = NotificationKinds.Post,
        Text = text,
        Href = "/sv",
        CreatedAt = createdAt
    };

    private async Task<(Guid Id, string Cookie)> SignIn(UserRole role)
    {
        var email = _factory.Users.Add(role, Password, mustChange: false, code: null);
        var response = await Client().PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        response.EnsureSuccessStatusCode();
        var header = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith($"{CookieName}="));
        var user = _factory.Users.Find(email);
        await _factory.SeedExisting(user);
        return (user.Id, header[(CookieName.Length + 1)..header.IndexOf(';')]);
    }

    private HttpClient Client() => _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string cookie, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Add("Cookie", $"{CookieName}={cookie}");
        if (body is not null) request.Content = JsonContent.Create(body);
        return await Client().SendAsync(request);
    }

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

        public ApplicationDbContext NewContext() => new(_options);

        // Tài khoản đăng nhập nằm ở kho trong bộ nhớ; chép sang SQLite để thỏa khóa ngoại của thông báo.
        public async Task SeedExisting(User user)
        {
            using var db = NewContext();
            db.Users.Add(new User { Id = user.Id, UserCode = user.UserCode, FullName = user.FullName, Email = user.Email, PasswordHash = "x", Role = user.Role });
            await db.SaveChangesAsync();
        }

        public async Task<Guid> SeedUser(string name)
        {
            using var db = NewContext();
            var user = new User { UserCode = $"U{Guid.NewGuid():N}"[..12], FullName = name, Email = $"{Guid.NewGuid():N}@truong.edu.vn", PasswordHash = "x", Role = UserRole.AcademicAffairs };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return user.Id;
        }

        public async Task Seed(params Notification[] rows)
        {
            using var db = NewContext();
            db.Notifications.AddRange(rows);
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
                services.RemoveAll<INotificationRepository>();
                services.AddScoped<INotificationRepository>(_ => new NotificationRepository(NewContext()));
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) _connection.Dispose();
        }
    }
}
