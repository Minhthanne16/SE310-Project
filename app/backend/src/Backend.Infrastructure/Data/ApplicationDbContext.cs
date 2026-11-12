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
    public DbSet<ThesisRound> ThesisRounds => Set<ThesisRound>();
    public DbSet<RoundMilestone> RoundMilestones => Set<RoundMilestone>();
    public DbSet<RoundParticipant> RoundParticipants => Set<RoundParticipant>();
    public DbSet<UserAuditEntry> UserAuditEntries => Set<UserAuditEntry>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<ThesisTopic> ThesisTopics => Set<ThesisTopic>();
    public DbSet<TopicHistoryEntry> TopicHistoryEntries => Set<TopicHistoryEntry>();
    public DbSet<ThesisGroup> ThesisGroups => Set<ThesisGroup>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<TopicRegistration> TopicRegistrations => Set<TopicRegistration>();
    public DbSet<TopicSubmission> TopicSubmissions => Set<TopicSubmission>();
    public DbSet<RevisionRequest> RevisionRequests => Set<RevisionRequest>();
    public DbSet<RevisionRequestLink> RevisionRequestLinks => Set<RevisionRequestLink>();
    public DbSet<PasswordResetRequest> PasswordResetRequests => Set<PasswordResetRequest>();
    public DbSet<Notification> Notifications => Set<Notification>();

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
            entity.Property(e => e.Phone).HasMaxLength(32);
            entity.Property(e => e.SecondaryEmail).HasMaxLength(256);
            entity.Property(e => e.AvatarObjectKey).HasMaxLength(512);
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

        modelBuilder.Entity<ThesisRound>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.NormalizedName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Program).IsRequired().HasMaxLength(32);
            entity.Property(e => e.PeriodLabel).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(16);
            entity.HasIndex(e => e.NormalizedName).IsUnique();
            entity.HasIndex(e => e.Status);
            // Đợt nguồn bị xóa thì chỉ mất dấu truy vết, không xóa đợt sao chép.
            entity.HasOne<ThesisRound>().WithMany().HasForeignKey(e => e.CopiedFromId).OnDelete(DeleteBehavior.SetNull);
            entity.HasMany(e => e.Milestones).WithOne().HasForeignKey(m => m.RoundId).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(e => e.Participants).WithOne(p => p.Round).HasForeignKey(p => p.RoundId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RoundMilestone>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Key).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.NotifyAudience).HasConversion<string>().HasMaxLength(16);
            entity.HasIndex(e => new { e.RoundId, e.Key }).IsUnique();
        });

        modelBuilder.Entity<RoundParticipant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(16);
            entity.HasIndex(e => new { e.RoundId, e.UserId }).IsUnique();
            entity.HasIndex(e => e.UserId);
            // Không xóa được người dùng đang thuộc đợt.
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Kind).IsRequired().HasMaxLength(16);
            entity.Property(e => e.Text).IsRequired().HasMaxLength(2000);
            entity.Property(e => e.Href).IsRequired().HasMaxLength(512);
            entity.HasIndex(e => new { e.RecipientUserId, e.CreatedAt });
            entity.HasIndex(e => e.BatchId);
            entity.HasIndex(e => e.SenderUserId);
            // Tài khoản đã có thông báo là "đã có dữ liệu": chỉ vô hiệu hóa, không xóa (BUSINESS_RULES).
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.RecipientUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Sender).WithMany().HasForeignKey(e => e.SenderUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ThesisTopic>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Ignore(e => e.Code);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(300);
            entity.Property(e => e.Field).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).IsRequired().HasMaxLength(4000);
            entity.Property(e => e.Requirements).HasMaxLength(2000);
            entity.Property(e => e.Source).HasConversion<string>().HasMaxLength(32);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(32);
            entity.HasIndex(e => new { e.RoundId, e.Number }).IsUnique();
            entity.HasIndex(e => e.SupervisorId);
            // Một nhóm chỉ có một đơn/đề tài đang hoạt động. Đề xuất Đã hủy vẫn giữ GroupId để truy vết
            // nhưng không được chặn đề xuất lại bằng chính nhóm đó (PDR-012).
            entity.HasIndex(e => e.GroupId).HasDatabaseName("IX_ThesisTopics_ActiveGroupId")
                .HasFilter("\"GroupId\" IS NOT NULL AND \"Status\" IN ('PendingApproval', 'Registered', 'Rejected')").IsUnique();
            entity.HasOne<ThesisGroup>().WithMany().HasForeignKey(e => e.GroupId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<ThesisRound>().WithMany(r => r.Topics).HasForeignKey(e => e.RoundId).OnDelete(DeleteBehavior.Cascade);
            // Tài khoản có đề tài chỉ được vô hiệu hóa, không xóa (BUSINESS_RULES); chặn thêm ở database.
            entity.HasOne(e => e.Supervisor).WithMany().HasForeignKey(e => e.SupervisorId).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(e => e.History).WithOne().HasForeignKey(h => h.TopicId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ThesisGroup>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.HasIndex(e => e.RoundId);
            entity.HasOne<ThesisRound>().WithMany().HasForeignKey(e => e.RoundId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.RepresentativeId).OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(e => e.Members).WithOne().HasForeignKey(m => m.GroupId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            // Mỗi sinh viên chỉ thuộc một nhóm trong cùng đợt (BUSINESS_RULES), kể cả khi tạo đồng thời.
            entity.HasIndex(e => new { e.RoundId, e.StudentId }).IsUnique();
            entity.HasOne(e => e.Student).WithMany().HasForeignKey(e => e.StudentId).OnDelete(DeleteBehavior.Restrict);
            // Xóa đợt xóa luôn thành viên nhóm (PostgreSQL kiểm NO ACTION trước khi cascade từ nhóm chạy xong).
            entity.HasOne<ThesisRound>().WithMany(r => r.GroupMembers).HasForeignKey(e => e.RoundId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TopicRegistration>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.GroupId, e.CreatedAt });
            entity.HasIndex(e => e.TopicId);
            entity.HasOne<ThesisTopic>().WithMany().HasForeignKey(e => e.TopicId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ThesisGroup>().WithMany().HasForeignKey(e => e.GroupId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TopicSubmission>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.ObjectKey).IsRequired().HasMaxLength(200);
            entity.Property(e => e.FileName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Note).HasMaxLength(2000);
            entity.Property(e => e.ReviewComment).HasMaxLength(2000);
            // Số phiên bản duy nhất trong đề tài và loại bài nộp; chặn hai lần nộp đồng thời cùng số.
            entity.HasIndex(e => new { e.TopicId, e.Kind, e.VersionNo }).IsUnique();
            entity.HasOne<ThesisTopic>().WithMany().HasForeignKey(e => e.TopicId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.SubmittedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RevisionRequest>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Content).IsRequired().HasMaxLength(2000);
            entity.HasIndex(e => new { e.TopicId, e.ResolvedAt });
            entity.HasOne<ThesisTopic>().WithMany().HasForeignKey(e => e.TopicId).OnDelete(DeleteBehavior.Cascade);
            // NO ACTION (kiểm cuối câu lệnh): xóa đề tài cascade cả bài nộp lẫn yêu cầu mà không vướng thứ tự.
            entity.HasOne<TopicSubmission>().WithMany().HasForeignKey(e => e.RaisedOnSubmissionId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.CreatedById).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RevisionRequestLink>(entity =>
        {
            entity.HasKey(e => new { e.SubmissionId, e.RequestId });
            entity.HasIndex(e => e.RequestId);
            entity.HasOne<TopicSubmission>().WithMany().HasForeignKey(e => e.SubmissionId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<RevisionRequest>().WithMany().HasForeignKey(e => e.RequestId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TopicHistoryEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            // Id sinh ở ứng dụng: mục mới thêm qua navigation History được chèn (không hiểu nhầm là UPDATE).
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Category).IsRequired().HasMaxLength(32);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Detail).HasMaxLength(8000);
            entity.HasIndex(e => new { e.TopicId, e.CreatedAt });
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TokenHash).IsRequired().HasMaxLength(64);
            entity.Property(e => e.SecurityStamp).IsRequired().HasMaxLength(64);
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PasswordResetRequest>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EmailHash).IsRequired().HasMaxLength(64);
            entity.Property(e => e.Source).IsRequired().HasMaxLength(64);
            entity.HasIndex(e => new { e.EmailHash, e.CreatedAt });
            entity.HasIndex(e => new { e.Source, e.CreatedAt });
            entity.HasIndex(e => e.CreatedAt);
        });

        modelBuilder.Entity<UserAuditEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TargetUserCode).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(32);
            entity.Property(e => e.Details).HasColumnType("jsonb");
            entity.HasIndex(e => new { e.TargetUserId, e.CreatedAt });
        });
    }
}
