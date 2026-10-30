using Backend.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<User> Users => Set<User>();
    public DbSet<EvaluationTemplate> EvaluationTemplates => Set<EvaluationTemplate>();
    public DbSet<EvaluationCriterion> EvaluationCriteria => Set<EvaluationCriterion>();
    public DbSet<EvaluationSubCriterion> EvaluationSubCriteria => Set<EvaluationSubCriterion>();
    public DbSet<EvaluationTemplateAssignment> EvaluationTemplateAssignments => Set<EvaluationTemplateAssignment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Price).HasPrecision(18, 2);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserCode).IsRequired().HasMaxLength(50);
            entity.Property(e => e.FullName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(256);
            entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Role).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.SecurityStamp).IsRequired().HasMaxLength(64);
            entity.Property(e => e.ActivationCodeHash).HasMaxLength(100);
            entity.Property(e => e.ClassName).HasMaxLength(100);
            entity.Property(e => e.Department).HasMaxLength(100);
            entity.Property(e => e.AcademicTitle).HasMaxLength(100);
            entity.HasIndex(e => e.UserCode).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
        });

        modelBuilder.Entity<EvaluationTemplate>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.NormalizedName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.MaxScore).HasPrecision(5, 2);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(16);
            entity.HasIndex(e => e.NormalizedName).IsUnique();
            entity.HasMany(e => e.Criteria).WithOne().HasForeignKey(c => c.TemplateId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EvaluationCriterion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.MaxScore).HasPrecision(5, 2);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.HasIndex(e => new { e.TemplateId, e.SortOrder });
            entity.HasMany(e => e.SubCriteria).WithOne().HasForeignKey(s => s.CriterionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EvaluationSubCriterion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.MaxScore).HasPrecision(5, 2);
            entity.HasIndex(e => new { e.CriterionId, e.SortOrder });
        });

        modelBuilder.Entity<EvaluationTemplateAssignment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.RoundId).IsRequired().HasMaxLength(64);
            entity.Property(e => e.Role).HasConversion<string>().HasMaxLength(16);
            entity.HasIndex(e => new { e.RoundId, e.Role }).IsUnique();
            // Mẫu đang gán không được xóa (kiểm tra ở Application, chặn thêm ở database).
            entity.HasOne(e => e.Template).WithMany().HasForeignKey(e => e.TemplateId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
