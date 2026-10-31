using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// Trạng thái mẫu phiếu theo docs/DESIGN/03 (Mẫu phiếu đánh giá): nháp, đang dùng, đã đóng.
public enum EvaluationTemplateStatus
{
    Draft = 1,
    Active = 2,
    Closed = 3
}

// Vai trò chấm được gán mẫu trong một đợt. Chủ tịch và thư ký dùng chung mẫu Hội đồng.
public enum GradingRole
{
    Supervisor = 1,
    Reviewer = 2,
    Committee = 3
}

// Mẫu phiếu gồm các tiêu chí chung; mỗi tiêu chí chung gồm các hạng mục con.
// Tổng điểm tiêu chí chung = thang điểm phiếu, tổng hạng mục con = điểm tiêu chí chung.
public class EvaluationTemplate : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    // Tên đã chuẩn hóa để chặn trùng tên mẫu không phân biệt hoa thường.
    public string NormalizedName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MaxScore { get; set; }
    public EvaluationTemplateStatus Status { get; set; } = EvaluationTemplateStatus.Draft;
    public List<EvaluationCriterion> Criteria { get; set; } = [];

    public static string NormalizeName(string name) => name.Trim().ToUpperInvariant();
}

public class EvaluationCriterion : BaseEntity
{
    public Guid TemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    // Mô tả, hướng dẫn chấm của tiêu chí (không bắt buộc).
    public string? Description { get; set; }
    public decimal MaxScore { get; set; }
    public int SortOrder { get; set; }
    public List<EvaluationSubCriterion> SubCriteria { get; set; } = [];
}

public class EvaluationSubCriterion : BaseEntity
{
    public Guid CriterionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal MaxScore { get; set; }
    public int SortOrder { get; set; }
}

// Mẫu được gán cho một vai trò chấm trong một đợt; mỗi (đợt, vai trò) có tối đa một mẫu.
// RoundId là mã đợt dạng chuỗi vì backend chưa có mô-đun Đợt khóa luận; khi có thì
// chuyển thành khóa ngoại.
public class EvaluationTemplateAssignment : BaseEntity
{
    public string RoundId { get; set; } = string.Empty;
    public GradingRole Role { get; set; }
    public Guid TemplateId { get; set; }
    public EvaluationTemplate? Template { get; set; }
}
