using Backend.Domain.Common;

namespace Backend.Domain.Entities;

// PDR-065, PDR-069, OQ-033(e): Mặc định cấu hình đợt và điểm theo chương trình đào tạo.
public class ProgramRoundDefaults : BaseEntity
{
    public string Program { get; set; } = string.Empty;
    public int MaxGroupSize { get; set; } = 2;
    public decimal WeightChair { get; set; } = 1;
    public decimal WeightSecretary { get; set; } = 1;
    public decimal WeightSupervisor { get; set; } = 2;
    public decimal WeightReviewer { get; set; } = 2;
    public decimal DeviationThreshold { get; set; } = 2;
    public Guid? UpdatedById { get; set; }
    public User? UpdatedBy { get; set; }
}
