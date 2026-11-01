using Backend.Application.Common.Security;
using Backend.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Infrastructure.Data;

public static class DataSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        if (!context.Products.Any())
        {
            var sampleProducts = new List<Product>
            {
                new()
                {
                    Name = "Laptop Dell XPS 15",
                    Description = "Laptop cao cấp màn hình OLED 3.5K, Intel Core i7 thế hệ mới, RAM 16GB, SSD 512GB",
                    Price = 35990000m,
                    Stock = 10,
                    IsActive = true
                },
                new()
                {
                    Name = "Bàn phím cơ Keychron K2 Pro",
                    Description = "Bàn phím không dây Bluetooth/Type-C, Switch Red, Keycap PBT OSA, Hotswap",
                    Price = 2490000m,
                    Stock = 25,
                    IsActive = true
                },
                new()
                {
                    Name = "Chuột Logitech MX Master 3S",
                    Description = "Chuột công thái học cao cấp, cảm biến 8000 DPI, cuộn vô cực MagSpeed, click êm ái",
                    Price = 1990000m,
                    Stock = 40,
                    IsActive = true
                }
            };

            await context.Products.AddRangeAsync(sampleProducts);
            await context.SaveChangesAsync();
        }
    }

    // Chỉ dùng cho database phát triển local. Sinh viên và giảng viên dùng mật khẩu
    // ban đầu là mã người dùng và phải đổi ở lần đăng nhập đầu. Tài khoản Giáo vụ
    // mẫu đã được kích hoạt sẵn để có thể quản trị dữ liệu phát triển ngay.
    public static async Task SeedDevelopmentUsersAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        User Create(string code, string fullName, string email, UserRole role, bool mustChangePassword = true) => new()
        {
            UserCode = code,
            FullName = fullName,
            Email = User.NormalizeEmail(email),
            PasswordHash = hasher.Hash(code),
            Role = role,
            MustChangePassword = mustChangePassword
        };

        var student = Create("22520001", "Nguyễn Văn An", "sv.22520001@qlkltn.local", UserRole.Student);
        student.ClassName = "KTPM2022";
        var lecturer = Create("GV0001", "Trần Thị Bình", "gv.0001@qlkltn.local", UserRole.Lecturer);
        lecturer.Department = "Công nghệ phần mềm";
        var developmentUsers = new[]
        {
            student,
            lecturer,
            Create("GVU0001", "Lê Văn Cường", "giaovu.0001@qlkltn.local", UserRole.AcademicAffairs, mustChangePassword: false)
        };

        var seededAcademicAffairs = await context.Users.SingleOrDefaultAsync(user =>
            user.UserCode == "GVU0001" &&
            user.Email == "giaovu.0001@qlkltn.local" &&
            user.Role == UserRole.AcademicAffairs);

        if (seededAcademicAffairs is not null)
        {
            if (seededAcademicAffairs.MustChangePassword)
                seededAcademicAffairs.SecurityStamp = Guid.NewGuid().ToString("N");

            seededAcademicAffairs.MustChangePassword = false;
            seededAcademicAffairs.ClearActivationCode();
        }

        var existingUsers = await context.Users
            .AsNoTracking()
            .Select(user => new { user.UserCode, user.Email })
            .ToListAsync();
        var userCodes = existingUsers.Select(user => user.UserCode).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var emails = existingUsers.Select(user => User.NormalizeEmail(user.Email)).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var user in developmentUsers)
        {
            if (userCodes.Contains(user.UserCode) || emails.Contains(user.Email)) continue;

            context.Users.Add(user);
            userCodes.Add(user.UserCode);
            emails.Add(user.Email);
        }

        if (context.ChangeTracker.HasChanges()) await context.SaveChangesAsync();
    }
}
