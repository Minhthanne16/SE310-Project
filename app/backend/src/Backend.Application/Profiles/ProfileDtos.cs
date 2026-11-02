namespace Backend.Application.Profiles;

public sealed class ProfileDto
{
    public Guid Id { get; set; }
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? Phone { get; set; }
    public string? SecondaryEmail { get; set; }
    public string? AvatarUrl { get; set; }
    public string? ClassName { get; set; }
    public string? Department { get; set; }
    public string? AcademicTitle { get; set; }
    public IReadOnlyList<DateTime> LastLogins { get; set; } = [];
}
