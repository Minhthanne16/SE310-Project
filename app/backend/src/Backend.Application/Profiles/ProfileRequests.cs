using System.Text.RegularExpressions;
using Backend.Application.Common;
using Backend.Application.Common.Storage;
using Backend.Application.Users;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace Backend.Application.Profiles;

// Mọi lệnh chỉ nhận id từ phiên đăng nhập nên không có cách đọc/sửa hồ sơ người khác.
public record GetMyProfileQuery(Guid UserId) : IRequest<ApiResponse<ProfileDto>>;
public record UpdateMyProfileCommand(Guid UserId, UpdateProfileDto Profile) : IRequest<ProfileCommandResult>;
public record UploadMyAvatarCommand(Guid UserId, byte[] Content) : IRequest<ProfileCommandResult>;
public record RemoveMyAvatarCommand(Guid UserId) : IRequest<ProfileCommandResult>;
public record GetMyAvatarQuery(Guid UserId) : IRequest<AvatarFile?>;

public sealed record AvatarFile(byte[] Content, string ContentType);

public enum ProfileCommandStatus { Ok, AccountUnavailable, Rejected }

public sealed record ProfileCommandResult(ProfileCommandStatus Status, ApiResponse<ProfileDto> Response)
{
    public static ProfileCommandResult Ok(ProfileDto profile, string message) => new(ProfileCommandStatus.Ok, ApiResponse<ProfileDto>.Ok(profile, message));
    public static ProfileCommandResult AccountUnavailable() => new(ProfileCommandStatus.AccountUnavailable, ApiResponse<ProfileDto>.Fail(ProfileMapping.AccountUnavailableMessage));
    public static ProfileCommandResult Rejected(string message, List<string>? errors = null) => new(ProfileCommandStatus.Rejected, ApiResponse<ProfileDto>.Fail(message, errors));
}

internal static class ProfileMapping
{
    public const string AccountUnavailableMessage = "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa";

    public static ProfileDto ToProfileDto(this User user) => new()
    {
        Id = user.Id,
        UserCode = user.UserCode,
        FullName = user.FullName,
        Email = user.Email,
        Role = user.Role.ToString(),
        DateOfBirth = user.DateOfBirth,
        Phone = user.Phone,
        SecondaryEmail = user.SecondaryEmail,
        AvatarUrl = AvatarPolicy.UrlFor(user.AvatarObjectKey),
        ClassName = user.ClassName,
        Department = user.Department,
        AcademicTitle = user.AcademicTitle,
        LastLogins = user.LastLoginAt is { } login ? [DateTime.SpecifyKind(login, DateTimeKind.Utc)] : []
    };
}

public static class ProfileFields
{
    // Ngày theo giờ Việt Nam để hôm nay ở trình duyệt không bị coi là tương lai.
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    public static string? CleanPhone(string? phone)
    {
        var value = Regex.Replace(phone ?? string.Empty, @"[\s.]", string.Empty);
        return value.Length == 0 ? null : value;
    }

    public static string? CleanEmail(string? email)
    {
        var value = User.NormalizeEmail(email ?? string.Empty);
        return value.Length == 0 ? null : value;
    }

    public static DateOnly Today(TimeProvider clock) => DateOnly.FromDateTime(clock.GetUtcNow().ToOffset(VietnamOffset).DateTime);
}

public sealed class UpdateMyProfileValidator : AbstractValidator<UpdateMyProfileCommand>
{
    public UpdateMyProfileValidator()
    {
        RuleFor(x => (x.Profile.FullName ?? string.Empty).Trim())
            .NotEmpty().WithMessage("Nhập họ tên.")
            .MaximumLength(200).WithMessage("Họ tên tối đa 200 ký tự.")
            .OverridePropertyName("fullName");
        RuleFor(x => ProfileFields.CleanPhone(x.Profile.Phone))
            .Matches("^0[0-9]{9}$").WithMessage("Số điện thoại không đúng định dạng. Nhập 10 chữ số, bắt đầu bằng 0, ví dụ 0912345678.")
            .OverridePropertyName("phone");
        RuleFor(x => ProfileFields.CleanEmail(x.Profile.SecondaryEmail))
            .Must(email => email is null || (email.Length <= 256 && UserFields.IsValidEmail(email)))
            .WithMessage("Email phụ không đúng định dạng. Ví dụ: ten@gmail.com.")
            .OverridePropertyName("secondaryEmail");
    }
}

public sealed class GetMyProfileHandler(IUserRepository users)
    : IRequestHandler<GetMyProfileQuery, ApiResponse<ProfileDto>>
{
    public async Task<ApiResponse<ProfileDto>> Handle(GetMyProfileQuery request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        return user is { IsActive: true }
            ? ApiResponse<ProfileDto>.Ok(user.ToProfileDto())
            : ApiResponse<ProfileDto>.Fail(ProfileMapping.AccountUnavailableMessage);
    }
}

public sealed class UpdateMyProfileHandler(IUserRepository users, TimeProvider clock)
    : IRequestHandler<UpdateMyProfileCommand, ProfileCommandResult>
{
    public async Task<ProfileCommandResult> Handle(UpdateMyProfileCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is not { IsActive: true }) return ProfileCommandResult.AccountUnavailable();

        var fullName = request.Profile.FullName!.Trim();
        var dateOfBirth = request.Profile.DateOfBirth;
        var phone = ProfileFields.CleanPhone(request.Profile.Phone);
        var secondaryEmail = ProfileFields.CleanEmail(request.Profile.SecondaryEmail);

        var errors = new List<string>();
        if (dateOfBirth > ProfileFields.Today(clock)) errors.Add("Ngày sinh không được ở tương lai.");
        if (secondaryEmail == user.Email) errors.Add("Email phụ phải khác email tài khoản.");
        if (errors.Count > 0) return ProfileCommandResult.Rejected("Validation failed", errors);

        // Ghi giá trị trước/sau của từng trường đổi (PDR-036).
        var changes = new Dictionary<string, object?>();
        void Track<TValue>(string field, TValue before, TValue after)
        {
            if (!EqualityComparer<TValue>.Default.Equals(before, after))
                changes[field] = new { from = before, to = after };
        }
        Track("fullName", user.FullName, fullName);
        Track("dateOfBirth", user.DateOfBirth, dateOfBirth);
        Track("phone", user.Phone, phone);
        Track("secondaryEmail", user.SecondaryEmail, secondaryEmail);
        if (changes.Count == 0) return ProfileCommandResult.Ok(user.ToProfileDto(), "Không có thay đổi");

        var now = clock.GetUtcNow().UtcDateTime;
        user.FullName = fullName;
        user.DateOfBirth = dateOfBirth;
        user.Phone = phone;
        user.SecondaryEmail = secondaryEmail;
        user.UpdatedAt = now;
        await users.UpdateAsync(user, user.Audit(user.Id, UserAuditActions.Updated, now, changes), cancellationToken);
        return ProfileCommandResult.Ok(user.ToProfileDto(), "Đã lưu thông tin cá nhân");
    }
}

public sealed class UploadMyAvatarHandler(IUserRepository users, IAvatarStorage storage, TimeProvider clock, ILogger<UploadMyAvatarHandler> logger)
    : IRequestHandler<UploadMyAvatarCommand, ProfileCommandResult>
{
    public async Task<ProfileCommandResult> Handle(UploadMyAvatarCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is not { IsActive: true }) return ProfileCommandResult.AccountUnavailable();
        if (request.Content.Length > AvatarPolicy.MaxBytes) return ProfileCommandResult.Rejected(AvatarPolicy.TooLargeMessage);
        if (AvatarPolicy.Detect(request.Content) is not { } format) return ProfileCommandResult.Rejected(AvatarPolicy.InvalidFormatMessage);

        var previousKey = user.AvatarObjectKey;
        var newKey = AvatarPolicy.NewObjectKey(user.Id, format);
        // Lưu tệp trước: nếu storage lỗi thì database và ảnh cũ chưa bị đụng tới.
        await storage.SaveAsync(newKey, request.Content, format.ContentType, cancellationToken);

        var now = clock.GetUtcNow().UtcDateTime;
        user.AvatarObjectKey = newKey;
        user.UpdatedAt = now;
        try
        {
            await users.UpdateAsync(user, user.Audit(user.Id, UserAuditActions.Updated, now, new { avatar = "uploaded" }), cancellationToken);
        }
        catch
        {
            user.AvatarObjectKey = previousKey;
            await AvatarCleanup.TryDeleteAsync(storage, newKey, logger);
            throw;
        }

        if (previousKey is not null) await AvatarCleanup.TryDeleteAsync(storage, previousKey, logger);
        return ProfileCommandResult.Ok(user.ToProfileDto(), "Đã cập nhật ảnh đại diện");
    }
}

public sealed class RemoveMyAvatarHandler(IUserRepository users, IAvatarStorage storage, TimeProvider clock, ILogger<RemoveMyAvatarHandler> logger)
    : IRequestHandler<RemoveMyAvatarCommand, ProfileCommandResult>
{
    public async Task<ProfileCommandResult> Handle(RemoveMyAvatarCommand request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is not { IsActive: true }) return ProfileCommandResult.AccountUnavailable();
        if (user.AvatarObjectKey is not { } key) return ProfileCommandResult.Ok(user.ToProfileDto(), "Chưa có ảnh đại diện");

        var now = clock.GetUtcNow().UtcDateTime;
        user.AvatarObjectKey = null;
        user.UpdatedAt = now;
        await users.UpdateAsync(user, user.Audit(user.Id, UserAuditActions.Updated, now, new { avatar = "removed" }), cancellationToken);
        await AvatarCleanup.TryDeleteAsync(storage, key, logger);
        return ProfileCommandResult.Ok(user.ToProfileDto(), "Đã gỡ ảnh đại diện");
    }
}

public sealed class GetMyAvatarHandler(IUserRepository users, IAvatarStorage storage)
    : IRequestHandler<GetMyAvatarQuery, AvatarFile?>
{
    public async Task<AvatarFile?> Handle(GetMyAvatarQuery request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        if (user is not { IsActive: true, AvatarObjectKey: { } key }) return null;
        var content = await storage.ReadAsync(key, cancellationToken);
        return content is null ? null : new AvatarFile(content, AvatarPolicy.ContentTypeOf(key));
    }
}

internal static class AvatarCleanup
{
    // Hồ sơ đã nhất quán; object còn sót chỉ tốn chỗ nên không làm hỏng thao tác của người dùng.
    public static async Task TryDeleteAsync(IAvatarStorage storage, string objectKey, ILogger logger)
    {
        try
        {
            await storage.DeleteAsync(objectKey, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not delete avatar object {ObjectKey}", objectKey);
        }
    }
}
