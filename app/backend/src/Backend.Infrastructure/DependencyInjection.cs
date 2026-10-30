using Backend.Application.Common.Email;
using Backend.Application.Common.Security;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Backend.Infrastructure.Repositories.Evaluations;
using Backend.Infrastructure.Repositories.Products;
using Backend.Infrastructure.Repositories.Users;
using Backend.Infrastructure.Integrations.Authentication;
using Backend.Infrastructure.Integrations.Email;
using Backend.Infrastructure.Integrations.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Minio;
using StackExchange.Redis;

namespace Backend.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<ApplicationDbContext>((provider, options) =>
        {
            var connectionString = provider.GetRequiredService<IConfiguration>().GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
            options.UseNpgsql(connectionString);
        });

        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IEvaluationTemplateRepository, EvaluationTemplateRepository>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IGoogleIdentityVerifier, GoogleIdentityVerifier>();
        services.Configure<EmailOptions>(configuration.GetSection("Email"));
        services.AddTransient<IEmailSender, SmtpEmailSender>();

        var redisConnection = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrWhiteSpace(redisConnection))
            services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConnection));

        var storage = configuration.GetSection("Storage").Get<StorageOptions>();
        if (storage is { Endpoint.Length: > 0, AccessKey.Length: > 0, SecretKey.Length: > 0 })
        {
            services.AddSingleton<IMinioClient>(_ => new MinioClient()
                .WithEndpoint(storage.Endpoint)
                .WithCredentials(storage.AccessKey, storage.SecretKey)
                .WithSSL(storage.UseSsl)
                .Build());
        }

        return services;
    }
}
