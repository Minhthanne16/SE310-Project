using System.Text.RegularExpressions;
using Backend.Application.Common;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Evaluations;

public enum EvaluationResultStatus { Ok, Created, NotFound, Conflict, Invalid }

public sealed record EvaluationResult<T>(EvaluationResultStatus Status, ApiResponse<T> Response)
{
    public static EvaluationResult<T> Ok(T data, string message = "Thao tác thành công") =>
        new(EvaluationResultStatus.Ok, ApiResponse<T>.Ok(data, message));

    public static EvaluationResult<T> Fail(EvaluationResultStatus status, string message, List<string>? errors = null) =>
        new(status, ApiResponse<T>.Fail(message, errors));
}

public record GetEvaluationTemplatesQuery : IRequest<ApiResponse<IReadOnlyList<EvaluationTemplateDto>>>;
public record GetEvaluationTemplateQuery(Guid Id) : IRequest<EvaluationResult<EvaluationTemplateDto>>;
public record CreateEvaluationTemplateCommand(EvaluationTemplateInputDto Template) : IRequest<EvaluationResult<EvaluationTemplateDto>>;
public record UpdateEvaluationTemplateCommand(Guid Id, EvaluationTemplateInputDto Template) : IRequest<EvaluationResult<EvaluationTemplateDto>>;
public record ChangeEvaluationTemplateStatusCommand(Guid Id, string Status) : IRequest<EvaluationResult<EvaluationTemplateDto>>;
// RemoveAssignments=true: Giáo vụ đã xác nhận gỡ mọi lần gán rồi xóa mẫu.
public record DeleteEvaluationTemplateCommand(Guid Id, bool RemoveAssignments = false) : IRequest<EvaluationResult<bool>>;
public record GetEvaluationAssignmentsQuery(string? RoundId) : IRequest<ApiResponse<IReadOnlyList<EvaluationAssignmentDto>>>;
public record AssignEvaluationTemplateCommand(string RoundId, string Role, Guid TemplateId) : IRequest<EvaluationResult<EvaluationAssignmentDto>>;
public record UnassignEvaluationTemplateCommand(string RoundId, string Role) : IRequest<EvaluationResult<bool>>;

// Quy tắc cấu trúc phiếu (docs/DESIGN/03, nghiệp vụ mục Quản lý mẫu phiếu).
public static partial class EvaluationTemplateRules
{
    public const int MaxNameLength = 200;
    // Theo ô mô tả của design (maxlength 500); cột database rộng hơn để dư địa.
    public const int MaxDescriptionLength = 500;
    public const int MaxCriteria = 50;
    public const int MaxSubCriteria = 50;
    public const decimal MaxTemplateScore = 100m;

    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$")]
    public static partial Regex RoundIdPattern();

    // Chỉ nhận tên enum (không nhận số) để hợp đồng API rõ ràng.
    public static bool TryParseStatus(string? value, out EvaluationTemplateStatus status)
    {
        status = default;
        return IsName(value) && Enum.TryParse(value, ignoreCase: false, out status) && Enum.IsDefined(status);
    }

    public static bool TryParseRole(string? value, out GradingRole role)
    {
        role = default;
        return IsName(value) && Enum.TryParse(value, ignoreCase: false, out role) && Enum.IsDefined(role);
    }

    private static bool IsName(string? value) => !string.IsNullOrEmpty(value) && value.All(char.IsAsciiLetter);

    public static bool HasAtMostTwoDecimals(decimal value) => decimal.Round(value, 2) == value;

    // Trùng tên tiêu chí luôn bị chặn. Mẫu nháp cho điểm 0 và chưa khớp tổng. Mẫu không
    // phải nháp (đủ điều kiện sử dụng) phải đầy đủ: có tiêu chí, mỗi tiêu chí có hạng mục
    // con, điểm > 0 và các tổng điểm khớp nhau.
    public static List<string> Check(decimal maxScore, IReadOnlyList<EvaluationCriterionInputDto> criteria, bool requireComplete)
    {
        var errors = new List<string>();
        foreach (var name in Duplicates(criteria.Select(c => c.Name)))
            errors.Add($"Trùng tên tiêu chí chung \"{name}\".");
        foreach (var criterion in criteria)
            foreach (var name in Duplicates(criterion.SubCriteria.Select(s => s.Name)))
                errors.Add($"Trùng tên hạng mục con \"{name}\" trong tiêu chí \"{Clean(criterion.Name)}\".");

        if (!requireComplete) return errors;

        if (criteria.Count == 0)
        {
            errors.Add("Mẫu phải có ít nhất một tiêu chí chung.");
            return errors;
        }
        var total = criteria.Sum(c => c.MaxScore);
        if (total != maxScore)
            errors.Add($"Tổng điểm tiêu chí chung ({Format(total)}) phải bằng thang điểm phiếu ({Format(maxScore)}).");
        foreach (var criterion in criteria)
        {
            var name = Clean(criterion.Name);
            if (criterion.MaxScore <= 0)
                errors.Add($"Điểm tiêu chí \"{name}\" phải lớn hơn 0.");
            foreach (var sub in criterion.SubCriteria.Where(s => s.MaxScore <= 0))
                errors.Add($"Điểm hạng mục \"{Clean(sub.Name)}\" trong tiêu chí \"{name}\" phải lớn hơn 0.");
            if (criterion.SubCriteria.Count == 0)
            {
                errors.Add($"Tiêu chí \"{name}\" phải có ít nhất một hạng mục con.");
                continue;
            }
            var subTotal = criterion.SubCriteria.Sum(s => s.MaxScore);
            if (subTotal != criterion.MaxScore)
                errors.Add($"Tổng điểm hạng mục con của \"{name}\" ({Format(subTotal)}) phải bằng điểm tiêu chí ({Format(criterion.MaxScore)}).");
        }
        return errors;
    }

    public static List<string> Check(EvaluationTemplate template, bool requireComplete) =>
        Check(template.MaxScore, template.Criteria.OrderBy(c => c.SortOrder).Select(c => new EvaluationCriterionInputDto
        {
            Name = c.Name,
            MaxScore = c.MaxScore,
            SubCriteria = c.SubCriteria.OrderBy(s => s.SortOrder)
                .Select(s => new EvaluationSubCriterionInputDto { Name = s.Name, MaxScore = s.MaxScore }).ToList()
        }).ToList(), requireComplete);

    // Chuyển trạng thái hợp lệ: Nháp ⇄ Đủ điều kiện (Active), Active ⇄ Đã đóng. Closed không về Nháp.
    // Mẫu đang được gán không được về Nháp (kiểm ở handler).
    public static bool CanTransition(EvaluationTemplateStatus from, EvaluationTemplateStatus to) =>
        from == to || (from, to) switch
        {
            (EvaluationTemplateStatus.Draft, EvaluationTemplateStatus.Active) => true,
            (EvaluationTemplateStatus.Active, EvaluationTemplateStatus.Draft) => true,
            (EvaluationTemplateStatus.Active, EvaluationTemplateStatus.Closed) => true,
            (EvaluationTemplateStatus.Closed, EvaluationTemplateStatus.Active) => true,
            _ => false
        };

    private static IEnumerable<string> Duplicates(IEnumerable<string> names) =>
        names.Select(Clean).Where(n => n.Length > 0)
            .GroupBy(n => n.ToUpperInvariant())
            .Where(g => g.Count() > 1)
            .Select(g => g.First());

    private static string Clean(string? name) => (name ?? string.Empty).Trim();

    private static string Format(decimal value) => value.ToString("0.##", System.Globalization.CultureInfo.GetCultureInfo("vi-VN"));
}

public abstract class EvaluationTemplateInputValidator<T> : AbstractValidator<T>
{
    protected void RulesFor(Func<T, EvaluationTemplateInputDto> select, params EvaluationTemplateStatus[] allowedStatuses)
    {
        RuleFor(x => select(x).Name).Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Nhập tên mẫu phiếu.")
            .Must(n => (n ?? string.Empty).Trim().Length <= EvaluationTemplateRules.MaxNameLength)
            .WithMessage($"Tên mẫu phiếu tối đa {EvaluationTemplateRules.MaxNameLength} ký tự.");
        RuleFor(x => select(x).Description).Must(d => (d ?? string.Empty).Trim().Length <= EvaluationTemplateRules.MaxDescriptionLength)
            .WithMessage($"Mô tả tối đa {EvaluationTemplateRules.MaxDescriptionLength} ký tự.");
        RuleFor(x => select(x).MaxScore).GreaterThan(0).WithMessage("Thang điểm phiếu phải lớn hơn 0.")
            .LessThanOrEqualTo(EvaluationTemplateRules.MaxTemplateScore)
            .WithMessage($"Thang điểm phiếu tối đa {EvaluationTemplateRules.MaxTemplateScore:0}.")
            .Must(EvaluationTemplateRules.HasAtMostTwoDecimals).WithMessage("Thang điểm phiếu tối đa hai chữ số thập phân.");
        RuleFor(x => select(x).Status)
            .Must(s => EvaluationTemplateRules.TryParseStatus(s, out var status) && allowedStatuses.Contains(status))
            .WithMessage($"Trạng thái phải là một trong: {string.Join(", ", allowedStatuses)}.");
        RuleFor(x => select(x).Criteria).NotNull().WithMessage("Thiếu danh sách tiêu chí.")
            .Must(c => c is null || c.Count <= EvaluationTemplateRules.MaxCriteria)
            .WithMessage($"Mẫu có tối đa {EvaluationTemplateRules.MaxCriteria} tiêu chí chung.");
        RuleForEach(x => select(x).Criteria).NotNull().WithMessage("Tiêu chí không hợp lệ.").ChildRules(criterion =>
        {
            criterion.RuleFor(c => c.Name).Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Nhập tên tiêu chí chung.")
                .Must(n => (n ?? string.Empty).Trim().Length <= EvaluationTemplateRules.MaxNameLength)
                .WithMessage($"Tên tiêu chí tối đa {EvaluationTemplateRules.MaxNameLength} ký tự.");
            criterion.RuleFor(c => c.Description).Must(d => (d ?? string.Empty).Trim().Length <= EvaluationTemplateRules.MaxDescriptionLength)
                .WithMessage($"Mô tả tiêu chí tối đa {EvaluationTemplateRules.MaxDescriptionLength} ký tự.");
            criterion.RuleFor(c => c.MaxScore).GreaterThanOrEqualTo(0).WithMessage("Điểm tiêu chí chung không được âm.")
                .Must(EvaluationTemplateRules.HasAtMostTwoDecimals).WithMessage("Điểm tiêu chí tối đa hai chữ số thập phân.");
            criterion.RuleFor(c => c.SubCriteria).NotNull().WithMessage("Thiếu danh sách hạng mục con.")
                .Must(s => s is null || s.Count <= EvaluationTemplateRules.MaxSubCriteria)
                .WithMessage($"Mỗi tiêu chí có tối đa {EvaluationTemplateRules.MaxSubCriteria} hạng mục con.");
            criterion.RuleForEach(c => c.SubCriteria).NotNull().WithMessage("Hạng mục con không hợp lệ.").ChildRules(sub =>
            {
                sub.RuleFor(s => s.Name).Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Nhập tên hạng mục con.")
                    .Must(n => (n ?? string.Empty).Trim().Length <= EvaluationTemplateRules.MaxNameLength)
                    .WithMessage($"Tên hạng mục con tối đa {EvaluationTemplateRules.MaxNameLength} ký tự.");
                sub.RuleFor(s => s.MaxScore).GreaterThanOrEqualTo(0).WithMessage("Điểm hạng mục con không được âm.")
                    .Must(EvaluationTemplateRules.HasAtMostTwoDecimals).WithMessage("Điểm hạng mục con tối đa hai chữ số thập phân.");
            });
        });
        // Quy tắc tổng điểm chỉ chạy khi cấu trúc đã hợp lệ để tránh báo lỗi trùng lặp.
        RuleFor(x => select(x)).Custom((input, context) =>
        {
            if (input.Criteria is null || input.Criteria.Any(c => c?.SubCriteria is null || c.SubCriteria.Any(s => s is null))) return;
            var complete = !EvaluationTemplateRules.TryParseStatus(input.Status, out var status) || status != EvaluationTemplateStatus.Draft;
            foreach (var error in EvaluationTemplateRules.Check(input.MaxScore, input.Criteria, complete))
                context.AddFailure(error);
        });
    }
}

public sealed class CreateEvaluationTemplateValidator : EvaluationTemplateInputValidator<CreateEvaluationTemplateCommand>
{
    public CreateEvaluationTemplateValidator()
    {
        RuleFor(x => x.Template).NotNull();
        When(x => x.Template is not null, () =>
            RulesFor(x => x.Template, EvaluationTemplateStatus.Draft, EvaluationTemplateStatus.Active));
    }
}

public sealed class UpdateEvaluationTemplateValidator : EvaluationTemplateInputValidator<UpdateEvaluationTemplateCommand>
{
    public UpdateEvaluationTemplateValidator()
    {
        RuleFor(x => x.Template).NotNull();
        When(x => x.Template is not null, () =>
            RulesFor(x => x.Template, EvaluationTemplateStatus.Draft, EvaluationTemplateStatus.Active, EvaluationTemplateStatus.Closed));
    }
}

public sealed class ChangeEvaluationTemplateStatusValidator : AbstractValidator<ChangeEvaluationTemplateStatusCommand>
{
    public ChangeEvaluationTemplateStatusValidator()
    {
        RuleFor(x => x.Status).Must(s => EvaluationTemplateRules.TryParseStatus(s, out _))
            .WithMessage("Trạng thái phải là Draft, Active hoặc Closed.");
    }
}

public sealed class AssignEvaluationTemplateValidator : AbstractValidator<AssignEvaluationTemplateCommand>
{
    public AssignEvaluationTemplateValidator()
    {
        RuleFor(x => x.RoundId).Must(r => r is not null && EvaluationTemplateRules.RoundIdPattern().IsMatch(r))
            .WithMessage("Mã đợt không hợp lệ.");
        RuleFor(x => x.Role).Must(r => EvaluationTemplateRules.TryParseRole(r, out _))
            .WithMessage("Vai trò chấm phải là Supervisor, Reviewer hoặc Committee.");
        RuleFor(x => x.TemplateId).NotEmpty().WithMessage("Chọn mẫu phiếu.");
    }
}

public sealed class UnassignEvaluationTemplateValidator : AbstractValidator<UnassignEvaluationTemplateCommand>
{
    public UnassignEvaluationTemplateValidator()
    {
        RuleFor(x => x.RoundId).Must(r => r is not null && EvaluationTemplateRules.RoundIdPattern().IsMatch(r))
            .WithMessage("Mã đợt không hợp lệ.");
        RuleFor(x => x.Role).Must(r => EvaluationTemplateRules.TryParseRole(r, out _))
            .WithMessage("Vai trò chấm phải là Supervisor, Reviewer hoặc Committee.");
    }
}

public sealed class GetEvaluationAssignmentsValidator : AbstractValidator<GetEvaluationAssignmentsQuery>
{
    public GetEvaluationAssignmentsValidator()
    {
        RuleFor(x => x.RoundId).Must(r => r is null || EvaluationTemplateRules.RoundIdPattern().IsMatch(r))
            .WithMessage("Mã đợt không hợp lệ.");
    }
}

internal static class EvaluationMapping
{
    public const string NotFoundMessage = "Không tìm thấy mẫu phiếu.";
    public const string DuplicateNameMessage = "Tên mẫu phiếu đã tồn tại. Đặt tên khác.";
    public const string CannotTransitionMessage = "Mẫu đã đóng không chuyển về nháp.";
    public const string AssignedKeepValidMessage = "Mẫu đang được sử dụng nên phải giữ đủ điều kiện. Gỡ gán mẫu trước khi sửa về nháp.";

    public static EvaluationTemplateDto ToDto(EvaluationTemplate template, IEnumerable<EvaluationTemplateAssignment> assignments) => new()
    {
        Id = template.Id,
        Name = template.Name,
        Description = template.Description,
        MaxScore = template.MaxScore,
        Status = template.Status.ToString(),
        Criteria = template.Criteria.OrderBy(c => c.SortOrder).Select(c => new EvaluationCriterionDto
        {
            Id = c.Id,
            Name = c.Name,
            Description = c.Description,
            MaxScore = c.MaxScore,
            SubCriteria = c.SubCriteria.OrderBy(s => s.SortOrder)
                .Select(s => new EvaluationSubCriterionDto { Id = s.Id, Name = s.Name, MaxScore = s.MaxScore }).ToList()
        }).ToList(),
        Assignments = assignments.Where(a => a.TemplateId == template.Id)
            .OrderBy(a => a.RoundId, StringComparer.Ordinal).ThenBy(a => a.Role)
            .Select(a => new EvaluationTemplateUsageDto { RoundId = a.RoundId, Role = a.Role.ToString() }).ToList(),
        CreatedAt = template.CreatedAt,
        UpdatedAt = template.UpdatedAt
    };

    public static EvaluationAssignmentDto ToDto(EvaluationTemplateAssignment assignment, string templateName) => new()
    {
        RoundId = assignment.RoundId,
        Role = assignment.Role.ToString(),
        TemplateId = assignment.TemplateId,
        TemplateName = templateName
    };

    public static List<EvaluationCriterion> ToCriteria(Guid templateId, IEnumerable<EvaluationCriterionInputDto> input) =>
        input.Select((c, i) =>
        {
            var criterion = new EvaluationCriterion
            {
                TemplateId = templateId,
                Name = c.Name.Trim(),
                Description = TrimToNull(c.Description),
                MaxScore = c.MaxScore,
                SortOrder = i
            };
            criterion.SubCriteria = c.SubCriteria.Select((s, j) => new EvaluationSubCriterion
            {
                CriterionId = criterion.Id,
                Name = s.Name.Trim(),
                MaxScore = s.MaxScore,
                SortOrder = j
            }).ToList();
            return criterion;
        }).ToList();

    public static string? TrimToNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class GetEvaluationTemplatesHandler(IEvaluationTemplateRepository repository)
    : IRequestHandler<GetEvaluationTemplatesQuery, ApiResponse<IReadOnlyList<EvaluationTemplateDto>>>
{
    public async Task<ApiResponse<IReadOnlyList<EvaluationTemplateDto>>> Handle(GetEvaluationTemplatesQuery request, CancellationToken cancellationToken)
    {
        var templates = await repository.GetAllAsync(cancellationToken);
        var assignments = await repository.GetAssignmentsAsync(null, cancellationToken);
        return ApiResponse<IReadOnlyList<EvaluationTemplateDto>>.Ok(templates.Select(t => EvaluationMapping.ToDto(t, assignments)).ToList());
    }
}

public sealed class GetEvaluationTemplateHandler(IEvaluationTemplateRepository repository)
    : IRequestHandler<GetEvaluationTemplateQuery, EvaluationResult<EvaluationTemplateDto>>
{
    public async Task<EvaluationResult<EvaluationTemplateDto>> Handle(GetEvaluationTemplateQuery request, CancellationToken cancellationToken)
    {
        var template = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (template is null)
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.NotFound, EvaluationMapping.NotFoundMessage);
        var assignments = await repository.GetAssignmentsOfTemplateAsync(template.Id, cancellationToken);
        return EvaluationResult<EvaluationTemplateDto>.Ok(EvaluationMapping.ToDto(template, assignments));
    }
}

public sealed class CreateEvaluationTemplateHandler(IEvaluationTemplateRepository repository)
    : IRequestHandler<CreateEvaluationTemplateCommand, EvaluationResult<EvaluationTemplateDto>>
{
    public async Task<EvaluationResult<EvaluationTemplateDto>> Handle(CreateEvaluationTemplateCommand request, CancellationToken cancellationToken)
    {
        var input = request.Template;
        var name = input.Name.Trim();
        var normalized = EvaluationTemplate.NormalizeName(name);
        if (await repository.NameExistsAsync(normalized, null, cancellationToken))
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Conflict, EvaluationMapping.DuplicateNameMessage);

        EvaluationTemplateRules.TryParseStatus(input.Status, out var status);
        var template = new EvaluationTemplate
        {
            Name = name,
            NormalizedName = normalized,
            Description = EvaluationMapping.TrimToNull(input.Description),
            MaxScore = input.MaxScore,
            Status = status
        };
        template.Criteria = EvaluationMapping.ToCriteria(template.Id, input.Criteria);

        try
        {
            await repository.AddAsync(template, cancellationToken);
        }
        catch (DuplicateEvaluationTemplateNameException)
        {
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Conflict, EvaluationMapping.DuplicateNameMessage);
        }
        return new(EvaluationResultStatus.Created,
            ApiResponse<EvaluationTemplateDto>.Ok(EvaluationMapping.ToDto(template, []), "Đã tạo mẫu phiếu"));
    }
}

public sealed class UpdateEvaluationTemplateHandler(IEvaluationTemplateRepository repository, TimeProvider clock)
    : IRequestHandler<UpdateEvaluationTemplateCommand, EvaluationResult<EvaluationTemplateDto>>
{
    public async Task<EvaluationResult<EvaluationTemplateDto>> Handle(UpdateEvaluationTemplateCommand request, CancellationToken cancellationToken)
    {
        var input = request.Template;
        var template = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (template is null)
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.NotFound, EvaluationMapping.NotFoundMessage);

        EvaluationTemplateRules.TryParseStatus(input.Status, out var status);
        if (!EvaluationTemplateRules.CanTransition(template.Status, status))
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Invalid, EvaluationMapping.CannotTransitionMessage);
        if (status == EvaluationTemplateStatus.Draft && template.Status != status
            && (await repository.GetAssignmentsOfTemplateAsync(template.Id, cancellationToken)).Count > 0)
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Invalid, EvaluationMapping.AssignedKeepValidMessage);

        var name = input.Name.Trim();
        var normalized = EvaluationTemplate.NormalizeName(name);
        if (await repository.NameExistsAsync(normalized, template.Id, cancellationToken))
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Conflict, EvaluationMapping.DuplicateNameMessage);

        template.Name = name;
        template.NormalizedName = normalized;
        template.Description = EvaluationMapping.TrimToNull(input.Description);
        template.MaxScore = input.MaxScore;
        template.Status = status;
        template.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        var criteria = EvaluationMapping.ToCriteria(template.Id, input.Criteria);

        try
        {
            await repository.UpdateAsync(template, criteria, cancellationToken);
        }
        catch (DuplicateEvaluationTemplateNameException)
        {
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Conflict, EvaluationMapping.DuplicateNameMessage);
        }
        var assignments = await repository.GetAssignmentsOfTemplateAsync(template.Id, cancellationToken);
        return EvaluationResult<EvaluationTemplateDto>.Ok(EvaluationMapping.ToDto(template, assignments), "Đã lưu mẫu phiếu");
    }
}

public sealed class ChangeEvaluationTemplateStatusHandler(IEvaluationTemplateRepository repository, TimeProvider clock)
    : IRequestHandler<ChangeEvaluationTemplateStatusCommand, EvaluationResult<EvaluationTemplateDto>>
{
    public async Task<EvaluationResult<EvaluationTemplateDto>> Handle(ChangeEvaluationTemplateStatusCommand request, CancellationToken cancellationToken)
    {
        var template = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (template is null)
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.NotFound, EvaluationMapping.NotFoundMessage);

        EvaluationTemplateRules.TryParseStatus(request.Status, out var status);
        if (!EvaluationTemplateRules.CanTransition(template.Status, status))
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Invalid, EvaluationMapping.CannotTransitionMessage);
        if (status == EvaluationTemplateStatus.Draft && template.Status != status
            && (await repository.GetAssignmentsOfTemplateAsync(template.Id, cancellationToken)).Count > 0)
            return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Invalid, EvaluationMapping.AssignedKeepValidMessage);
        if (status != EvaluationTemplateStatus.Draft)
        {
            var errors = EvaluationTemplateRules.Check(template, requireComplete: true);
            if (errors.Count > 0)
                return EvaluationResult<EvaluationTemplateDto>.Fail(EvaluationResultStatus.Invalid, "Mẫu phiếu chưa hợp lệ", errors);
        }

        if (template.Status != status)
        {
            template.Status = status;
            template.UpdatedAt = clock.GetUtcNow().UtcDateTime;
            await repository.UpdateAsync(template, null, cancellationToken);
        }
        var assignments = await repository.GetAssignmentsOfTemplateAsync(template.Id, cancellationToken);
        return EvaluationResult<EvaluationTemplateDto>.Ok(EvaluationMapping.ToDto(template, assignments), "Đã đổi trạng thái mẫu phiếu");
    }
}

public sealed class DeleteEvaluationTemplateHandler(IEvaluationTemplateRepository repository)
    : IRequestHandler<DeleteEvaluationTemplateCommand, EvaluationResult<bool>>
{
    public const string AssignedMessage = "Mẫu phiếu đang được gán cho đợt khóa luận. Xác nhận gỡ gán để xóa.";

    public async Task<EvaluationResult<bool>> Handle(DeleteEvaluationTemplateCommand request, CancellationToken cancellationToken)
    {
        var template = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (template is null) return EvaluationResult<bool>.Fail(EvaluationResultStatus.NotFound, EvaluationMapping.NotFoundMessage);

        var assignments = await repository.GetAssignmentsOfTemplateAsync(template.Id, cancellationToken);
        if (assignments.Count > 0 && !request.RemoveAssignments)
            return EvaluationResult<bool>.Fail(EvaluationResultStatus.Conflict, AssignedMessage);

        await repository.DeleteAsync(template, cancellationToken);
        return EvaluationResult<bool>.Ok(true, assignments.Count > 0 ? "Đã gỡ gán và xóa mẫu phiếu" : "Đã xóa mẫu phiếu");
    }
}

public sealed class GetEvaluationAssignmentsHandler(IEvaluationTemplateRepository repository)
    : IRequestHandler<GetEvaluationAssignmentsQuery, ApiResponse<IReadOnlyList<EvaluationAssignmentDto>>>
{
    public async Task<ApiResponse<IReadOnlyList<EvaluationAssignmentDto>>> Handle(GetEvaluationAssignmentsQuery request, CancellationToken cancellationToken)
    {
        var assignments = await repository.GetAssignmentsAsync(request.RoundId, cancellationToken);
        return ApiResponse<IReadOnlyList<EvaluationAssignmentDto>>.Ok(assignments
            .OrderBy(a => a.RoundId, StringComparer.Ordinal).ThenBy(a => a.Role)
            .Select(a => EvaluationMapping.ToDto(a, a.Template?.Name ?? string.Empty)).ToList());
    }
}

public sealed class AssignEvaluationTemplateHandler(IEvaluationTemplateRepository repository, TimeProvider clock)
    : IRequestHandler<AssignEvaluationTemplateCommand, EvaluationResult<EvaluationAssignmentDto>>
{
    public async Task<EvaluationResult<EvaluationAssignmentDto>> Handle(AssignEvaluationTemplateCommand request, CancellationToken cancellationToken)
    {
        EvaluationTemplateRules.TryParseRole(request.Role, out var role);
        var template = await repository.GetByIdAsync(request.TemplateId, cancellationToken);
        if (template is null)
            return EvaluationResult<EvaluationAssignmentDto>.Fail(EvaluationResultStatus.NotFound, EvaluationMapping.NotFoundMessage);
        if (template.Status != EvaluationTemplateStatus.Active)
            return EvaluationResult<EvaluationAssignmentDto>.Fail(EvaluationResultStatus.Invalid, "Chỉ gán được mẫu phiếu đang dùng.");

        // Chưa có phiếu điểm trong hệ thống nên chưa chặn đổi mẫu đã có điểm nhập;
        // khi có mô-đun chấm điểm phải kiểm tra tại đây.
        var assignment = await repository.GetAssignmentAsync(request.RoundId, role, cancellationToken);
        if (assignment is null)
        {
            assignment = new EvaluationTemplateAssignment { RoundId = request.RoundId, Role = role, TemplateId = template.Id };
        }
        else
        {
            assignment.TemplateId = template.Id;
            assignment.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        }
        await repository.SaveAssignmentAsync(assignment, cancellationToken);
        return EvaluationResult<EvaluationAssignmentDto>.Ok(EvaluationMapping.ToDto(assignment, template.Name), "Đã gán mẫu phiếu");
    }
}

public sealed class UnassignEvaluationTemplateHandler(IEvaluationTemplateRepository repository)
    : IRequestHandler<UnassignEvaluationTemplateCommand, EvaluationResult<bool>>
{
    public async Task<EvaluationResult<bool>> Handle(UnassignEvaluationTemplateCommand request, CancellationToken cancellationToken)
    {
        EvaluationTemplateRules.TryParseRole(request.Role, out var role);
        var assignment = await repository.GetAssignmentAsync(request.RoundId, role, cancellationToken);
        if (assignment is null)
            return EvaluationResult<bool>.Fail(EvaluationResultStatus.NotFound, "Vai trò này chưa được gán mẫu phiếu.");
        await repository.DeleteAssignmentAsync(assignment, cancellationToken);
        return EvaluationResult<bool>.Ok(true, "Đã gỡ gán mẫu phiếu");
    }
}
