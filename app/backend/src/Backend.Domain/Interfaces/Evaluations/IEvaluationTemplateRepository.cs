using Backend.Domain.Entities;

namespace Backend.Domain.Interfaces;

public interface IEvaluationTemplateRepository
{
    // Mẫu kèm tiêu chí chung và hạng mục con, đã sắp theo thứ tự.
    Task<IReadOnlyList<EvaluationTemplate>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<EvaluationTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> NameExistsAsync(string normalizedName, Guid? exceptId, CancellationToken cancellationToken = default);
    // Ném DuplicateEvaluationTemplateNameException khi vi phạm tên mẫu duy nhất.
    Task AddAsync(EvaluationTemplate template, CancellationToken cancellationToken = default);
    // Thay toàn bộ tiêu chí của mẫu bằng danh sách mới trong một lần lưu.
    Task UpdateAsync(EvaluationTemplate template, IReadOnlyList<EvaluationCriterion>? criteria, CancellationToken cancellationToken = default);
    // Xóa mẫu cùng mọi lần gán của mẫu trong một lần lưu.
    Task DeleteAsync(EvaluationTemplate template, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EvaluationTemplateAssignment>> GetAssignmentsAsync(string? roundId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EvaluationTemplateAssignment>> GetAssignmentsOfTemplateAsync(Guid templateId, CancellationToken cancellationToken = default);
    Task<EvaluationTemplateAssignment?> GetAssignmentAsync(string roundId, GradingRole role, CancellationToken cancellationToken = default);
    Task SaveAssignmentAsync(EvaluationTemplateAssignment assignment, CancellationToken cancellationToken = default);
    Task DeleteAssignmentAsync(EvaluationTemplateAssignment assignment, CancellationToken cancellationToken = default);
}

public sealed class DuplicateEvaluationTemplateNameException(Exception? inner = null)
    : Exception("An evaluation template with the same name already exists.", inner);
