using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Backend.Tests;

public sealed class ApiSmokeTests : IClassFixture<ApiSmokeTests.ApiFactory>
{
    private readonly ApiFactory _factory;

    public ApiSmokeTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task OpenApiDocumentIsAvailable()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/openapi/v1.json");
        response.EnsureSuccessStatusCode();
        var document = await response.Content.ReadAsStringAsync();
        Assert.Contains("/api/Products", document);
        Assert.Contains("/api/Auth/login", document);
        Assert.Contains("/api/Users/import", document);
    }

    [Fact]
    public void ApiRefusesToStartWithoutJwtSigningKey()
    {
        using var factory = new ApiFactory().WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Authentication:Jwt:SigningKey"] = "" })));

        var error = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        Assert.Contains("SigningKey", error.ToString());
    }

    public sealed class ApiFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(TestConfiguration.Values));
        }
    }
}
