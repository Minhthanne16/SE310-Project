namespace Backend.Domain.Entities;

// PDR-065: Xếp loại so với Điểm KL đã làm tròn.
public static class ThesisGrade
{
    public const string Excellent = "Xuất sắc";
    public const string Good = "Giỏi";
    public const string Fair = "Khá";
    public const string Average = "Trung bình";
    public const string Failed = "Không đạt";

    public static string Classify(decimal score) => score switch
    {
        >= 9.00m => Excellent,
        >= 8.00m => Good,
        >= 7.00m => Fair,
        >= 5.00m => Average,
        _ => Failed
    };
}
