using Backend.Domain.Entities;

namespace Backend.Application.Auth;

public static class AppRoles
{
    public const string Student = nameof(UserRole.Student);
    public const string Lecturer = nameof(UserRole.Lecturer);
    public const string AcademicAffairs = nameof(UserRole.AcademicAffairs);
}

public static class AppClaims
{
    public const string UserId = "sub";
    public const string Role = "role";
    public const string SecurityStamp = "stamp";
    // Có mặt khi tài khoản còn dùng mật khẩu ban đầu; token đó không mang claim vai trò.
    public const string PasswordChangeRequired = "pwd_change_required";
}

public sealed record IssuedAccessToken(string Value, DateTime ExpiresAt);

public interface IAccessTokenIssuer
{
    IssuedAccessToken Issue(User user);
}

public sealed record AuthenticatedSession(CurrentUserDto User, IssuedAccessToken AccessToken);
