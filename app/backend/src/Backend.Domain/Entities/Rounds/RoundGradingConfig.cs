namespace Backend.Domain.Entities;

public class RoundGradingConfig
{
    public decimal WeightChair { get; set; } = 1;
    public decimal WeightSecretary { get; set; } = 1;
    public decimal WeightSupervisor { get; set; } = 2;
    public decimal WeightReviewer { get; set; } = 2;
    public decimal DeviationThreshold { get; set; } = 2;

    public RoundGradingConfig Clone() => new()
    {
        WeightChair = WeightChair,
        WeightSecretary = WeightSecretary,
        WeightSupervisor = WeightSupervisor,
        WeightReviewer = WeightReviewer,
        DeviationThreshold = DeviationThreshold
    };
}
