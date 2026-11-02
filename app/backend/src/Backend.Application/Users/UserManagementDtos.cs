namespace Backend.Application.Users;

// Một dòng trong màn Quản lý người dùng của Giáo vụ.
public class UserDto
{
    public Guid Id { get; set; }
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    // Student | Lecturer | AcademicAffairs
    public string Role { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? ClassName { get; set; }
    public string? Department { get; set; }
    public string? AcademicTitle { get; set; }
    public bool IsActive { get; set; }
    public bool MustChangePassword { get; set; }
    // Có bản ghi nghiệp vụ tham chiếu: chỉ được vô hiệu hóa, không xóa.
    public bool HasData { get; set; }
}

public class CreateUserDto : IUserProfileInput
{
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? ClassName { get; set; }
    public string? Department { get; set; }
    public string? AcademicTitle { get; set; }
}

// Mã người dùng và vai trò không đổi sau khi tạo (BUSINESS_RULES), nên không có ở đây.
public class UpdateUserDto : IUserProfileInput
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? ClassName { get; set; }
    public string? Department { get; set; }
    public string? AcademicTitle { get; set; }
}

public class UserStatusDto
{
    public bool IsActive { get; set; }
}

public class ResetUserPasswordDto
{
    // null: đặt về mật khẩu ban đầu là mã người dùng.
    public string? NewPassword { get; set; }
}

public class DeleteUserResultDto
{
    // deleted | disabled
    public string Result { get; set; } = string.Empty;
}

// Data của phản hồi 409 để form biết ô nào bị trùng.
public class DuplicateUserFieldDto
{
    // userCode | email
    public string Field { get; set; } = string.Empty;
}
