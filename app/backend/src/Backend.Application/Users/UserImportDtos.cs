namespace Backend.Application.Users;

public class UserImportReportDto
{
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int ErrorRows { get; set; }
    // 0 khi chỉ xem trước.
    public int ImportedRows { get; set; }
    public List<UserImportRowDto> Rows { get; set; } = [];
}

public class UserImportRowDto
{
    // Số dòng trong tệp, tính cả dòng tiêu đề (dòng dữ liệu đầu tiên là 2).
    public int RowNumber { get; set; }
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    // Student | Lecturer | AcademicAffairs, hoặc giá trị gốc nếu không hợp lệ.
    public string Role { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? ClassName { get; set; }
    public string? Department { get; set; }
    public string? AcademicTitle { get; set; }
    public List<string> Errors { get; set; } = [];
}
