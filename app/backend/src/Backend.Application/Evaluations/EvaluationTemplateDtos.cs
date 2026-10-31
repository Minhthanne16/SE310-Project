namespace Backend.Application.Evaluations;

// Trạng thái và vai trò đi qua API dưới dạng tên enum: Draft | Active | Closed,
// Supervisor | Reviewer | Committee.
public sealed class EvaluationTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MaxScore { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<EvaluationCriterionDto> Criteria { get; set; } = [];
    public List<EvaluationTemplateUsageDto> Assignments { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public sealed class EvaluationCriterionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MaxScore { get; set; }
    public List<EvaluationSubCriterionDto> SubCriteria { get; set; } = [];
}

public sealed class EvaluationSubCriterionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal MaxScore { get; set; }
}

public sealed class EvaluationTemplateUsageDto
{
    public string RoundId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public sealed class EvaluationTemplateInputDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MaxScore { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<EvaluationCriterionInputDto> Criteria { get; set; } = [];
}

public sealed class EvaluationCriterionInputDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MaxScore { get; set; }
    public List<EvaluationSubCriterionInputDto> SubCriteria { get; set; } = [];
}

public sealed class EvaluationSubCriterionInputDto
{
    public string Name { get; set; } = string.Empty;
    public decimal MaxScore { get; set; }
}

public sealed class EvaluationTemplateStatusDto
{
    public string Status { get; set; } = string.Empty;
}

public sealed class EvaluationAssignmentDto
{
    public string RoundId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public Guid TemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
}

public sealed class AssignEvaluationTemplateDto
{
    public Guid TemplateId { get; set; }
}
