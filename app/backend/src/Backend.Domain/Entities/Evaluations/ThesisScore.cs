namespace Backend.Domain.Entities;

// Điểm khóa luận theo docs/decisions/PDR-065-cau-hinh-diem-theo-dot.md:
// Điểm KL = (hCT×CTHĐ + hTK×TKHĐ + hHD×CBHD + hPB×CBPB) / (hCT + hTK + hHD + hPB), thang 10,
// làm tròn hai chữ số (nửa lên).
public static class ThesisScore
{
    public const decimal Scale = 10m;

    public static decimal Calculate(decimal chair, decimal secretary, decimal supervisor, decimal reviewer) =>
        Calculate(chair, secretary, supervisor, reviewer, new RoundGradingConfig());

    public static decimal Calculate(decimal chair, decimal secretary, decimal supervisor, decimal reviewer, RoundGradingConfig cfg)
    {
        var totalWeight = cfg.WeightChair + cfg.WeightSecretary + cfg.WeightSupervisor + cfg.WeightReviewer;
        if (totalWeight <= 0) throw new InvalidOperationException("Tổng hệ số phải lớn hơn 0.");
        var weightedSum = cfg.WeightChair * chair + cfg.WeightSecretary * secretary + cfg.WeightSupervisor * supervisor + cfg.WeightReviewer * reviewer;
        return Math.Round(weightedSum / totalWeight, 2, MidpointRounding.AwayFromZero);
    }

    // Quy điểm của một phiếu có thang khác 10 về thang 10 trước khi đưa vào công thức.
    public static decimal ToScale10(decimal score, decimal templateMaxScore)
    {
        if (templateMaxScore <= 0) throw new ArgumentOutOfRangeException(nameof(templateMaxScore));
        return templateMaxScore == Scale ? score : score * Scale / templateMaxScore;
    }
}
