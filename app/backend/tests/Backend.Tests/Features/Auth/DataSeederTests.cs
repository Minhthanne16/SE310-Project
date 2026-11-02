using Backend.Application.Common.Security;
using Backend.Domain.Entities;
using Backend.Infrastructure.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

public sealed class DataSeederTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly ServiceProvider _provider;

    public DataSeederTests()
    {
        _connection.Open();
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options => options.UseSqlite(_connection));
        services.AddSingleton<IPasswordHasher, TestPasswordHasher>();
        _provider = services.BuildServiceProvider();

        using var scope = _provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreated();
    }

    [Fact]
    public async Task ActivatesEveryDevelopmentSeedUserWithoutChangingTheirPassword()
    {
        using (var scope = _provider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Users.Add(new User
            {
                UserCode = "22520001",
                FullName = "Sinh viên có sẵn",
                Email = "sv.22520001@qlkltn.local",
                PasswordHash = "existing-password-hash",
                Role = UserRole.Student,
                MustChangePassword = true,
                ClassName = "KTPM2022",
                SecurityStamp = "old-student-security-stamp",
                ActivationCodeHash = "student-activation-code-hash",
                ActivationCodeSentAt = DateTime.UtcNow,
                ActivationCodeExpiresAt = DateTime.UtcNow.AddMinutes(10)
            });
            db.Users.Add(new User
            {
                UserCode = "GVU0001",
                FullName = "Giáo vụ seed cũ",
                Email = "giaovu.0001@qlkltn.local",
                PasswordHash = "existing-academic-affairs-password-hash",
                Role = UserRole.AcademicAffairs,
                MustChangePassword = true,
                SecurityStamp = "old-academic-affairs-security-stamp",
                ActivationCodeHash = "activation-code-hash",
                ActivationCodeSentAt = DateTime.UtcNow,
                ActivationCodeExpiresAt = DateTime.UtcNow.AddMinutes(10)
            });
            await db.SaveChangesAsync();
        }

        await DataSeeder.SeedDevelopmentUsersAsync(_provider);

        using var assertionScope = _provider.CreateScope();
        var users = await assertionScope.ServiceProvider.GetRequiredService<ApplicationDbContext>()
            .Users.OrderBy(user => user.UserCode).ToListAsync();

        Assert.Equal(3, users.Count);

        var existingStudent = Assert.Single(users, user => user.UserCode == "22520001");
        Assert.Equal("Sinh viên có sẵn", existingStudent.FullName);
        Assert.Equal("existing-password-hash", existingStudent.PasswordHash);
        Assert.False(existingStudent.MustChangePassword);
        Assert.NotEqual("old-student-security-stamp", existingStudent.SecurityStamp);
        Assert.Null(existingStudent.ActivationCodeHash);
        Assert.Null(existingStudent.ActivationCodeSentAt);
        Assert.Null(existingStudent.ActivationCodeExpiresAt);

        var lecturer = Assert.Single(users, user => user.Role == UserRole.Lecturer);
        Assert.Equal("GV0001", lecturer.UserCode);
        Assert.Equal("hash:GV0001", lecturer.PasswordHash);
        Assert.False(lecturer.MustChangePassword);

        var academicAffairs = Assert.Single(users, user => user.Role == UserRole.AcademicAffairs);
        Assert.Equal("GVU0001", academicAffairs.UserCode);
        Assert.Equal("existing-academic-affairs-password-hash", academicAffairs.PasswordHash);
        Assert.False(academicAffairs.MustChangePassword);
        Assert.NotEqual("old-academic-affairs-security-stamp", academicAffairs.SecurityStamp);
        Assert.Null(academicAffairs.ActivationCodeHash);
        Assert.Null(academicAffairs.ActivationCodeSentAt);
        Assert.Null(academicAffairs.ActivationCodeExpiresAt);
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }

    private sealed class TestPasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => $"hash:{password}";
        public string HashInitialPassword(string userCode) => $"hash:{userCode}";
        public bool Verify(string password, string hash) => hash == $"hash:{password}";
    }
}
