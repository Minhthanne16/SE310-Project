using Backend.API.Authentication;
using Backend.API.Middlewares;
using Backend.Application;
using Backend.Infrastructure;
using Backend.Infrastructure.Data;
using Microsoft.AspNetCore.HttpOverrides;
using Scalar.AspNetCore;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddJwtCookieAuthentication(builder.Configuration);
// Chỉ đọc X-Forwarded-For khi request đến từ proxy được khai báo tin cậy (PDR-044: nguồn
// không lấy từ giá trị khách tự khai). Mặc định không tin ai: nguồn là IP kết nối trực tiếp.
// Next.js dev server giữ nguyên X-Forwarded-For của trình duyệt nên không được khai ở đây.
var trustedProxies = (builder.Configuration["ForwardedHeaders:TrustedProxies"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
    options.KnownProxies.Clear();
    options.KnownIPNetworks.Clear();
    foreach (var entry in trustedProxies)
    {
        if (entry.Contains('/')) options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(entry));
        else options.KnownProxies.Add(System.Net.IPAddress.Parse(entry));
    }
});
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins(builder.Configuration["FrontendOrigin"] ?? "http://localhost:3000")
    .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (trustedProxies.Length > 0) app.UseForwardedHeaders();
app.UseMiddleware<GlobalExceptionMiddleware>();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

if (app.Configuration.GetValue<bool>("InitializeDatabase"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
}
if (app.Configuration.GetValue<bool>("SeedSampleProducts"))
{
    await DataSeeder.SeedAsync(app.Services);
}
if (app.Configuration.GetValue<bool>("SeedDevelopmentUsers"))
{
    await DataSeeder.SeedDevelopmentUsersAsync(app.Services);
}

app.Run();

public partial class Program { }
