namespace Backend.Domain.Entities;

// Điểm khóa luận theo docs/requirements/BUSINESS_RULES.md:
// (CTHĐ + TKHĐ + 2 × CBHD + 2 × CBPB) / 6, thang 10, làm tròn hai chữ số (nửa lên).
public static class ThesisScore
{
    public const decimal Scale = 10m;

    public static decimal Calculate(decimal chair, decimal secretary, decimal supervisor, decimal reviewer) =>
        Math.Round((chair + secretary + 2 * supervisor + 2 * reviewer) / 6, 2, MidpointRounding.AwayFromZero);

    // Quy điểm của một phiếu có thang khác 10 về thang 10 trước khi đưa vào công thức.
    public static decimal ToScale10(decimal score, decimal templateMaxScore)
    {
        if (templateMaxScore <= 0) throw new ArgumentOutOfRangeException(nameof(templateMaxScore));
        return templateMaxScore == Scale ? score : score * Scale / templateMaxScore;
    }
}
