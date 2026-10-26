namespace Backend.Application.Auth;

public class LoginDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class ChangeInitialPasswordDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
    public string ActivationCode { get; set; } = string.Empty;
}

public class ActivationCodeSentDto
{
    public DateTime ExpiresAt { get; set; }
    public DateTime ResendAvailableAt { get; set; }
}

public class CurrentUserDto
{
    public Guid Id { get; set; }
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    // Student | Lecturer | AcademicAffairs
    public string Role { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; }
}
