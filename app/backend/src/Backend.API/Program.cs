using Backend.API.Authentication;
using Backend.API.Middlewares;
using Backend.Application;
using Backend.Infrastructure;
using Backend.Infrastructure.Data;
using Scalar.AspNetCore;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddJwtCookieAuthentication(builder.Configuration);
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins(builder.Configuration["FrontendOrigin"] ?? "http://localhost:3000")
    .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

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
