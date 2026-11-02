using System.Net.Mail;
using System.Text.Json;
using System.Text.RegularExpressions;
using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Common.Security;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Users;

// Quản lý người dùng của Giáo vụ (DESIGN 03 · Quản lý người dùng, PDR-004/036,
// BUSINESS_RULES · Truy vết và tài khoản). ActorId là Giáo vụ đang thao tác.
public record ListUsersQuery : IRequest<ApiResponse<IReadOnlyList<UserDto>>>;
public record CreateUserCommand(Guid ActorId, CreateUserDto User) : IRequest<UserCommandResult<UserDto>>;
public record UpdateUserCommand(Guid ActorId, Guid UserId, UpdateUserDto User) : IRequest<UserCommandResult<UserDto>>;
public record SetUserStatusCommand(Guid ActorId, Guid UserId, bool IsActive) : IRequest<UserCommandResult<UserDto>>;
public record DeleteUserCommand(Guid ActorId, Guid UserId) : IRequest<UserCommandResult<DeleteUserResultDto>>;
public record ResetUserPasswordCommand(Guid ActorId, Guid UserId, string? NewPassword) : IRequest<UserCommandResult<UserDto>>;

public enum UserCommandStatus { Ok, Created, NotFound, Duplicate, Rejected }

// DuplicateField (userCode | email) có giá trị khi Status = Duplicate.
public sealed record UserCommandResult<T>(UserCommandStatus Status, ApiResponse<T> Response, string? DuplicateField = null)
{
    public static UserCommandResult<T> Ok(T data, string message) => new(UserCommandStatus.Ok, ApiResponse<T>.Ok(data, message));
    public static UserCommandResult<T> Created(T data, string message) => new(UserCommandStatus.Created, ApiResponse<T>.Ok(data, message));
    public static UserCommandResult<T> NotFound() => new(UserCommandStatus.NotFound, ApiResponse<T>.Fail("Không tìm thấy người dùng"));
    public static UserCommandResult<T> Rejected(string message, List<string>? errors = null) =>
        new(UserCommandStatus.Rejected, ApiResponse<T>.Fail(message, errors));
    public static UserCommandResult<T> Duplicate(string field) => new(UserCommandStatus.Duplicate,
        ApiResponse<T>.Fail(field == UserFields.UserCode ? "Mã người dùng đã tồn tại." : "Email đã được dùng cho tài khoản khác."),
        field);
}

public static partial class UserFields
{
    public const string UserCode = "userCode";
    public const string Email = "email";

    [GeneratedRegex("^[A-Za-z0-9._-]+$")]
    public static partial Regex UserCodePattern();

    // Cùng quy tắc với nhập CSV (UserImport.cs).
    public static bool IsValidEmail(string email) =>
        email.Length <= 256 && MailAddress.TryCreate(email, out var address) && address.Address == email;

    // Chỉ nhận đúng tên vai trò (không nhận số hay bí danh như ở CSV).
    public static bool TryParseRole(string? value, out UserRole role)
    {
        role = default;
        return value is AppRoles.Student or AppRoles.Lecturer or AppRoles.AcademicAffairs
               && Enum.TryParse(value, out role);
    }

    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // Lớp bắt buộc với Sinh viên, bộ môn bắt buộc với Giảng viên (PDR-004).
    public static List<string> RoleFieldErrors(UserRole role, string? className, string? department)
    {
        var errors = new List<string>();
        if (role == UserRole.Student && className is null) errors.Add("Nhập lớp của sinh viên.");
        if (role == UserRole.Lecturer && department is null) errors.Add("Nhập bộ môn của giảng viên.");
        return errors;
    }
}

public sealed class CreateUserValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserValidator()
    {
        RuleFor(x => (x.User.UserCode ?? string.Empty).Trim())
            .NotEmpty().WithMessage("Nhập mã người dùng.")
            .MaximumLength(50).WithMessage("Mã người dùng tối đa 50 ký tự.")
            .Matches(UserFields.UserCodePattern()).WithMessage("Mã người dùng chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới.")
            .OverridePropertyName("userCode");
        RuleFor(x => x.User.Role)
            .Must(r => UserFields.TryParseRole(r, out _)).WithMessage("Vai trò phải là Student, Lecturer hoặc AcademicAffairs.");
        RuleFor(x => x.User).SetValidator(new UserProfileValidator());
    }
}

public sealed class UpdateUserValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserValidator()
    {
        RuleFor(x => x.User).SetValidator(new UserProfileValidator());
    }
}

// Trường chung của form thêm và sửa; kiểm tra trên giá trị đã cắt khoảng trắng
// giống cách handler lưu.
public interface IUserProfileInput
{
    string FullName { get; }
    string Email { get; }
    string? ClassName { get; }
    string? Department { get; }
    string? AcademicTitle { get; }
}

internal sealed class UserProfileValidator : AbstractValidator<IUserProfileInput>
{
    public UserProfileValidator()
    {
        RuleFor(x => (x.FullName ?? string.Empty).Trim())
            .NotEmpty().WithMessage("Nhập họ tên.")
            .MaximumLength(200).WithMessage("Họ tên tối đa 200 ký tự.")
            .OverridePropertyName("fullName");
        RuleFor(x => User.NormalizeEmail(x.Email ?? string.Empty))
            .NotEmpty().WithMessage("Nhập email.")
            .Must(UserFields.IsValidEmail).WithMessage("Email không hợp lệ.").When(x => !string.IsNullOrWhiteSpace(x.Email))
            .OverridePropertyName("email");
        RuleFor(x => new[] { x.ClassName, x.Department, x.AcademicTitle }.Select(UserFields.Clean))
            .Must(values => values.All(v => v is null || v.Length <= 100))
            .WithMessage("Lớp, bộ môn, học hàm tối đa 100 ký tự.")
            .OverridePropertyName("roleFields");
    }
}

public sealed class ResetUserPasswordValidator : AbstractValidator<ResetUserPasswordCommand>
{
    // Cùng quy tắc mật khẩu với đổi mật khẩu lần đầu (PDR-002, passwordRules ở frontend).
    public ResetUserPasswordValidator()
    {
        RuleFor(x => x.NewPassword!)
            .MinimumLength(8).WithMessage("Mật khẩu mới tối thiểu 8 ký tự.")
            .MaximumLength(64).WithMessage("Mật khẩu mới tối đa 64 ký tự.")
            .Matches("[a-zA-Z]").WithMessage("Mật khẩu mới phải có chữ.")
            .Matches("[0-9]").WithMessage("Mật khẩu mới phải có số.")
            .When(x => x.NewPassword is not null);
    }
}

internal static class UserManagementMapping
{
    public static UserDto ToUserDto(this User user, bool hasData) => new()
    {
        Id = user.Id,
        UserCode = user.UserCode,
        FullName = user.FullName,
        Email = user.Email,
        Role = user.Role.ToString(),
        DateOfBirth = user.DateOfBirth,
        ClassName = user.ClassName,
        Department = user.Department,
        AcademicTitle = user.AcademicTitle,
        IsActive = user.IsActive,
        MustChangePassword = user.MustChangePassword,
        HasData = hasData
    };

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static UserAuditEntry Audit(this User user, Guid actorId, string action, DateTime now, object? details = null) => new()
    {
        TargetUserId = user.Id,
        TargetUserCode = user.UserCode,
        ActorUserId = actorId,
        Action = action,
        Details = details is null ? null : JsonSerializer.Serialize(details, JsonOptions),
        CreatedAt = now
    };

    public static async Task<bool> HasDataAsync(this IUserRepository users, Guid id, CancellationToken cancellationToken) =>
        (await users.GetUserIdsWithRelatedDataAsync([id], cancellationToken)).Contains(id);

    // Sau lỗi trùng do tranh chấp, xác định lại ô bị trùng để báo đúng cho form.
    public static async Task<string> DuplicateFieldAsync(this IUserRepository users, string userCode, string email, Guid? exceptId, CancellationToken cancellationToken)
    {
        var byEmail = await users.GetByEmailAsync(email, cancellationToken);
        if (byEmail is not null && byEmail.Id != exceptId) return UserFields.Email;
        return exceptId is null && (await users.GetExistingUserCodesAsync([userCode], cancellationToken)).Count > 0
            ? UserFields.UserCode
            : UserFields.Email;
    }
}

public sealed class ListUsersHandler(IUserRepository users)
    : IRequestHandler<ListUsersQuery, ApiResponse<IReadOnlyList<UserDto>>>
{
    public async Task<ApiResponse<IReadOnlyList<UserDto>>> Handle(ListUsersQuery request, CancellationToken cancellationToken)
    {
        var all = await users.ListAsync(cancellationToken);
        var withData = await users.GetUserIdsWithRelatedDataAsync(all.Select(u => u.Id).ToList(), cancellationToken);
        return ApiResponse<IReadOnlyList<UserDto>>.Ok(all.Select(u => u.ToUserDto(withData.Contains(u.Id))).ToList());
    }
}

public sealed class CreateUserHandler(IUserRepository users, IPasswordHasher hasher, TimeProvider clock)
    : IRequestHandler<CreateUserCommand, UserCommandResult<UserDto>>
{
    public async Task<UserCommandResult<UserDto>> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        var input = request.User;
        UserFields.TryParseRole(input.Role, out var role);
        var user = new User
        {
            UserCode = input.UserCode.Trim(),
            FullName = input.FullName.Trim(),
            Email = User.NormalizeEmail(input.Email),
            Role = role,
            DateOfBirth = input.DateOfBirth,
            ClassName = role == UserRole.Student ? UserFields.Clean(input.ClassName) : null,
            Department = role == UserRole.Lecturer ? UserFields.Clean(input.Department) : null,
            AcademicTitle = role == UserRole.Lecturer ? UserFields.Clean(input.AcademicTitle) : null,
            // Như tài khoản nhập CSV (PDR-004): mật khẩu ban đầu là mã, bắt đổi khi đăng nhập lần đầu.
            IsActive = true,
            MustChangePassword = true,
            CreatedAt = clock.GetUtcNow().UtcDateTime
        };

        var roleErrors = UserFields.RoleFieldErrors(role, user.ClassName, user.Department);
        if (roleErrors.Count > 0) return UserCommandResult<UserDto>.Rejected("Validation failed", roleErrors);
        if ((await users.GetExistingUserCodesAsync([user.UserCode], cancellationToken)).Count > 0)
            return UserCommandResult<UserDto>.Duplicate(UserFields.UserCode);
        if (await users.GetByEmailAsync(user.Email, cancellationToken) is not null)
            return UserCommandResult<UserDto>.Duplicate(UserFields.Email);

        user.PasswordHash = hasher.HashInitialPassword(user.UserCode);
        try
        {
            await users.AddAsync(user, user.Audit(request.ActorId, UserAuditActions.Created, user.CreatedAt,
                new { role = user.Role.ToString() }), cancellationToken);
        }
        catch (DuplicateUserException)
        {
            return UserCommandResult<UserDto>.Duplicate(
                await users.DuplicateFieldAsync(user.UserCode, user.Email, null, cancellationToken));
        }
        return UserCommandResult<UserDto>.Created(user.ToUserDto(hasData: false), "Đã thêm người dùng");
    }
}

public sealed class UpdateUserHandler(IUserRepository users, TimeProvider clock)
    : IRequestHandler<UpdateUserCommand, UserCommandResult<UserDto>>
{
    public async Task<UserCommandResult<UserDto>> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null) return UserCommandResult<UserDto>.NotFound();

        var input = request.User;
        var next = new
        {
            FullName = input.FullName.Trim(),
            Email = User.NormalizeEmail(input.Email),
            input.DateOfBirth,
            ClassName = user.Role == UserRole.Student ? UserFields.Clean(input.ClassName) : null,
            Department = user.Role == UserRole.Lecturer ? UserFields.Clean(input.Department) : null,
            AcademicTitle = user.Role == UserRole.Lecturer ? UserFields.Clean(input.AcademicTitle) : null
        };
        var roleErrors = UserFields.RoleFieldErrors(user.Role, next.ClassName, next.Department);
        if (roleErrors.Count > 0) return UserCommandResult<UserDto>.Rejected("Validation failed", roleErrors);
        if (next.Email != user.Email && await users.GetByEmailAsync(next.Email, cancellationToken) is not null)
            return UserCommandResult<UserDto>.Duplicate(UserFields.Email);

        // Ghi lại giá trị trước/sau của từng trường đổi (PDR-036).
        var changes = new Dictionary<string, object?>();
        void Track<TValue>(string field, TValue before, TValue after)
        {
            if (!EqualityComparer<TValue>.Default.Equals(before, after))
                changes[field] = new { from = before, to = after };
        }
        Track("fullName", user.FullName, next.FullName);
        Track("email", user.Email, next.Email);
        Track("dateOfBirth", user.DateOfBirth, next.DateOfBirth);
        Track("className", user.ClassName, next.ClassName);
        Track("department", user.Department, next.Department);
        Track("academicTitle", user.AcademicTitle, next.AcademicTitle);

        var hasData = await users.HasDataAsync(user.Id, cancellationToken);
        if (changes.Count == 0) return UserCommandResult<UserDto>.Ok(user.ToUserDto(hasData), "Không có thay đổi");

        var now = clock.GetUtcNow().UtcDateTime;
        user.FullName = next.FullName;
        user.Email = next.Email;
        user.DateOfBirth = next.DateOfBirth;
        user.ClassName = next.ClassName;
        user.Department = next.Department;
        user.AcademicTitle = next.AcademicTitle;
        user.UpdatedAt = now;
        try
        {
            await users.UpdateAsync(user, user.Audit(request.ActorId, UserAuditActions.Updated, now, changes), cancellationToken);
        }
        catch (DuplicateUserException)
        {
            return UserCommandResult<UserDto>.Duplicate(UserFields.Email);
        }
        return UserCommandResult<UserDto>.Ok(user.ToUserDto(hasData), "Đã lưu thay đổi");
    }
}

public sealed class SetUserStatusHandler(IUserRepository users, TimeProvider clock)
    : IRequestHandler<SetUserStatusCommand, UserCommandResult<UserDto>>
{
    public async Task<UserCommandResult<UserDto>> Handle(SetUserStatusCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null) return UserCommandResult<UserDto>.NotFound();
        if (!request.IsActive && user.Id == request.ActorId)
            return UserCommandResult<UserDto>.Rejected("Không thể vô hiệu hóa chính tài khoản của bạn.");

        var hasData = await users.HasDataAsync(user.Id, cancellationToken);
        if (user.IsActive == request.IsActive) return UserCommandResult<UserDto>.Ok(user.ToUserDto(hasData), "Không có thay đổi");

        var now = clock.GetUtcNow().UtcDateTime;
        SetActive(user, request.IsActive, now);
        await users.UpdateAsync(user, user.Audit(request.ActorId,
            request.IsActive ? UserAuditActions.Reactivated : UserAuditActions.Disabled, now), cancellationToken);
        return UserCommandResult<UserDto>.Ok(user.ToUserDto(hasData),
            request.IsActive ? "Đã kích hoạt lại người dùng" : "Đã vô hiệu hóa người dùng");
    }

    // Vô hiệu hóa xoay SecurityStamp để token cấp trước đó không dùng lại được kể cả sau khi kích hoạt lại.
    internal static void SetActive(User user, bool active, DateTime now)
    {
        user.IsActive = active;
        if (!active) user.SecurityStamp = Guid.NewGuid().ToString("N");
        user.UpdatedAt = now;
    }
}

public sealed class DeleteUserHandler(IUserRepository users, TimeProvider clock)
    : IRequestHandler<DeleteUserCommand, UserCommandResult<DeleteUserResultDto>>
{
    public const string Deleted = "deleted";
    public const string Disabled = "disabled";

    public async Task<UserCommandResult<DeleteUserResultDto>> Handle(DeleteUserCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null) return UserCommandResult<DeleteUserResultDto>.NotFound();
        if (user.Id == request.ActorId)
            return UserCommandResult<DeleteUserResultDto>.Rejected("Không thể xóa chính tài khoản của bạn.");

        var now = clock.GetUtcNow().UtcDateTime;
        // Đã có dữ liệu thì chỉ vô hiệu hóa, không xóa vật lý (BUSINESS_RULES).
        if (await users.HasDataAsync(user.Id, cancellationToken))
        {
            if (user.IsActive)
            {
                SetUserStatusHandler.SetActive(user, false, now);
                await users.UpdateAsync(user, user.Audit(request.ActorId, UserAuditActions.Disabled, now,
                    new { reason = "hasData" }), cancellationToken);
            }
            return UserCommandResult<DeleteUserResultDto>.Ok(new DeleteUserResultDto { Result = Disabled },
                "Người dùng đã có dữ liệu nên được vô hiệu hóa");
        }

        await users.DeleteAsync(user, user.Audit(request.ActorId, UserAuditActions.Deleted, now,
            new { role = user.Role.ToString() }), cancellationToken);
        return UserCommandResult<DeleteUserResultDto>.Ok(new DeleteUserResultDto { Result = Deleted }, "Đã xóa người dùng");
    }
}

public sealed class ResetUserPasswordHandler(IUserRepository users, IPasswordHasher hasher, TimeProvider clock)
    : IRequestHandler<ResetUserPasswordCommand, UserCommandResult<UserDto>>
{
    public async Task<UserCommandResult<UserDto>> Handle(ResetUserPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is null) return UserCommandResult<UserDto>.NotFound();
        if (request.NewPassword == user.UserCode)
            return UserCommandResult<UserDto>.Rejected("Mật khẩu mới phải khác mã người dùng.");

        var now = clock.GetUtcNow().UtcDateTime;
        user.PasswordHash = request.NewPassword is null
            ? hasher.HashInitialPassword(user.UserCode)
            : hasher.Hash(request.NewPassword);
        // Người dùng phải đổi lại mật khẩu (kèm OTP, PDR-003) ở lần đăng nhập kế tiếp;
        // phiên đang mở hết hiệu lực ngay.
        user.MustChangePassword = true;
        user.ClearActivationCode();
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        user.UpdatedAt = now;
        await users.UpdateAsync(user, user.Audit(request.ActorId, UserAuditActions.PasswordReset, now,
            new { mode = request.NewPassword is null ? "userCode" : "custom" }), cancellationToken);
        return UserCommandResult<UserDto>.Ok(user.ToUserDto(await users.HasDataAsync(user.Id, cancellationToken)),
            "Đã đặt lại mật khẩu");
    }
}
