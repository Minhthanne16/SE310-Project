using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using Backend.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Infrastructure.Repositories.Evaluations;

public class EvaluationTemplateRepository(ApplicationDbContext context) : IEvaluationTemplateRepository
{
    private IQueryable<EvaluationTemplate> WithCriteria() =>
        context.EvaluationTemplates
            .Include(t => t.Criteria.OrderBy(c => c.SortOrder))
            .ThenInclude(c => c.SubCriteria.OrderBy(s => s.SortOrder))
            .AsSplitQuery();

    public async Task<IReadOnlyList<EvaluationTemplate>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await WithCriteria().AsNoTracking().OrderBy(t => t.CreatedAt).ToListAsync(cancellationToken);

    public Task<EvaluationTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        WithCriteria().FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    public Task<bool> NameExistsAsync(string normalizedName, Guid? exceptId, CancellationToken cancellationToken = default)
    {
        var query = context.EvaluationTemplates.Where(t => t.NormalizedName == normalizedName);
        if (exceptId is { } id) query = query.Where(t => t.Id != id);
        return query.AnyAsync(cancellationToken);
    }

    public async Task AddAsync(EvaluationTemplate template, CancellationToken cancellationToken = default)
    {
        context.EvaluationTemplates.Add(template);
        await SaveAsync(cancellationToken);
    }

    public async Task UpdateAsync(EvaluationTemplate template, IReadOnlyList<EvaluationCriterion>? criteria, CancellationToken cancellationToken = default)
    {
        if (criteria is not null)
        {
            // Đánh dấu rõ Added/Deleted: khóa Guid đã có giá trị nên EF không tự coi là bản ghi mới.
            context.EvaluationCriteria.RemoveRange(template.Criteria);
            context.EvaluationCriteria.AddRange(criteria);
            template.Criteria = criteria.ToList();
        }
        await SaveAsync(cancellationToken);
    }

    public async Task DeleteAsync(EvaluationTemplate template, CancellationToken cancellationToken = default)
    {
        context.EvaluationTemplateAssignments.RemoveRange(
            await context.EvaluationTemplateAssignments.Where(a => a.TemplateId == template.Id).ToListAsync(cancellationToken));
        context.EvaluationTemplates.Remove(template);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EvaluationTemplateAssignment>> GetAssignmentsAsync(string? roundId, CancellationToken cancellationToken = default)
    {
        var query = context.EvaluationTemplateAssignments.AsNoTracking().Include(a => a.Template).AsQueryable();
        if (roundId is not null) query = query.Where(a => a.RoundId == roundId);
        return await query.ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EvaluationTemplateAssignment>> GetAssignmentsOfTemplateAsync(Guid templateId, CancellationToken cancellationToken = default) =>
        await context.EvaluationTemplateAssignments.AsNoTracking().Where(a => a.TemplateId == templateId).ToListAsync(cancellationToken);

    public Task<EvaluationTemplateAssignment?> GetAssignmentAsync(string roundId, GradingRole role, CancellationToken cancellationToken = default) =>
        context.EvaluationTemplateAssignments.FirstOrDefaultAsync(a => a.RoundId == roundId && a.Role == role, cancellationToken);

    public async Task SaveAssignmentAsync(EvaluationTemplateAssignment assignment, CancellationToken cancellationToken = default)
    {
        if (context.Entry(assignment).State == EntityState.Detached) context.EvaluationTemplateAssignments.Add(assignment);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAssignmentAsync(EvaluationTemplateAssignment assignment, CancellationToken cancellationToken = default)
    {
        context.EvaluationTemplateAssignments.Remove(assignment);
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Một yêu cầu khác vừa tạo trùng tên mẫu sau bước kiểm tra.
            context.ChangeTracker.Clear();
            throw new DuplicateEvaluationTemplateNameException(ex);
        }
    }
}
