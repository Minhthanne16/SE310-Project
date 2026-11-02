using Backend.Application.Common;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using MediatR;

namespace Backend.Application.Profiles;

public record GetMyProfileQuery(Guid UserId) : IRequest<ApiResponse<ProfileDto>>;

internal static class ProfileMapping
{
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
        AvatarUrl = user.AvatarObjectKey is null ? null : "/api/profile/avatar",
        ClassName = user.ClassName,
        Department = user.Department,
        AcademicTitle = user.AcademicTitle,
        LastLogins = user.LastLoginAt is { } login ? [login] : []
    };
}

public sealed class GetMyProfileHandler(IUserRepository users)
    : IRequestHandler<GetMyProfileQuery, ApiResponse<ProfileDto>>
{
    public async Task<ApiResponse<ProfileDto>> Handle(GetMyProfileQuery request, CancellationToken cancellationToken)
    {
        var user = await users.GetByIdAsync(request.UserId, cancellationToken);
        return user is { IsActive: true }
            ? ApiResponse<ProfileDto>.Ok(user.ToProfileDto())
            : ApiResponse<ProfileDto>.Fail("Tài khoản không tồn tại hoặc đã bị vô hiệu hóa");
    }
}
