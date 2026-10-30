using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Evaluations;
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

// Hợp đồng HTTP của /api/evaluation-templates: quyền, mã trạng thái và dạng JSON
// mà frontend (features/evaluations/services) đang dùng.
public sealed class EvaluationTemplateApiTests : IClassFixture<EvaluationTemplateApiTests.Factory>
{
    private const string CookieName = "qlkltn_access";
    private readonly Factory _factory;

    public EvaluationTemplateApiTests(Factory factory) => _factory = factory;

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(UserRole.Student, HttpStatusCode.Forbidden)]
    [InlineData(UserRole.Lecturer, HttpStatusCode.Forbidden)]
    [InlineData(UserRole.AcademicAffairs, HttpStatusCode.OK)]
    public async Task OnlyAcademicAffairsCanAccess(UserRole? role, HttpStatusCode expected)
    {
        var cookie = role is { } r ? await LoginAs(r) : null;

        var response = await Send(HttpMethod.Get, "/api/evaluation-templates", cookie);

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal(expected == HttpStatusCode.OK, (await ReadJson(response)).GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task CrudAndAssignmentFollowTheContract()
    {
        var cookie = await LoginAs(UserRole.AcademicAffairs);
        var name = $"Phiếu {Guid.NewGuid():N}";

        var created = await Send(HttpMethod.Post, "/api/evaluation-templates", cookie,
            EvaluationTemplateWorkflowTests.CommitteeTemplate(name));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var data = (await ReadJson(created)).GetProperty("data");
        var id = data.GetProperty("id").GetString();
        Assert.Equal("Active", data.GetProperty("status").GetString());
        Assert.Equal(10m, data.GetProperty("maxScore").GetDecimal());
        Assert.Equal(1.5m, data.GetProperty("criteria")[0].GetProperty("subCriteria")[0].GetProperty("maxScore").GetDecimal());
        Assert.Equal(0, data.GetProperty("assignments").GetArrayLength());

        var duplicate = await Send(HttpMethod.Post, "/api/evaluation-templates", cookie,
            EvaluationTemplateWorkflowTests.CommitteeTemplate(name.ToUpperInvariant()));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var invalid = EvaluationTemplateWorkflowTests.CommitteeTemplate($"{name} 2");
        invalid.MaxScore = 9;
        var badRequest = await Send(HttpMethod.Post, "/api/evaluation-templates", cookie, invalid);
        Assert.Equal(HttpStatusCode.BadRequest, badRequest.StatusCode);
        Assert.Contains((await ReadJson(badRequest)).GetProperty("errors").EnumerateArray(),
            e => e.GetString()!.StartsWith("Tổng điểm tiêu chí chung"));

        var assign = await Send(HttpMethod.Put, "/api/evaluation-templates/assignments/r-vb1-hk1/Reviewer", cookie, new { templateId = id });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);
        Assert.Equal("Reviewer", (await ReadJson(assign)).GetProperty("data").GetProperty("role").GetString());

        var list = await Send(HttpMethod.Get, "/api/evaluation-templates/assignments?roundId=r-vb1-hk1", cookie);
        Assert.Contains((await ReadJson(list)).GetProperty("data").EnumerateArray(), a => a.GetProperty("templateId").GetString() == id);

        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/evaluation-templates/{id}", cookie)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Delete, "/api/evaluation-templates/assignments/r-vb1-hk1/Reviewer", cookie)).StatusCode);

        var assigned = (await ReadJson(await Send(HttpMethod.Post, "/api/evaluation-templates", cookie,
            EvaluationTemplateWorkflowTests.CommitteeTemplate($"{name} gán")))).GetProperty("data").GetProperty("id").GetString();
        await Send(HttpMethod.Put, "/api/evaluation-templates/assignments/r-vb2-hk1/Committee", cookie, new { templateId = assigned });
        Assert.Equal(HttpStatusCode.OK,
            (await Send(HttpMethod.Delete, $"/api/evaluation-templates/{assigned}?removeAssignments=true", cookie)).StatusCode);

        var closed = await Send(HttpMethod.Put, $"/api/evaluation-templates/{id}/status", cookie, new { status = "Closed" });
        Assert.Equal("Closed", (await ReadJson(closed)).GetProperty("data").GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Delete, $"/api/evaluation-templates/{id}", cookie)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/evaluation-templates/{id}", cookie)).StatusCode);
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

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(TestConfiguration.Values));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IUserRepository>();
                services.AddSingleton<IUserRepository>(Users.Repository);
                services.RemoveAll<IEvaluationTemplateRepository>();
                services.AddScoped<IEvaluationTemplateRepository>(_ => new EvaluationTemplateRepository(new ApplicationDbContext(_options)));
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) _connection.Dispose();
        }
    }
}
