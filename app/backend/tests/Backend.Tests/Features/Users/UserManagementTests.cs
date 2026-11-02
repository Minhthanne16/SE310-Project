using System.Text.Json;
using Backend.Application;
using Backend.Application.Common.Security;
using Backend.Application.Users;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

public sealed class UserManagementTests
{
    private readonly InMemoryUserRepository _users = new();
    private readonly ISender _sender;
    private readonly User _staff;

    public UserManagementTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationServices();
        services.AddSingleton<IUserRepository>(_users);
        services.AddSingleton<IPasswordHasher, FakePasswordHasher>();
        _sender = services.BuildServiceProvider().GetRequiredService<ISender>();
        _staff = _users.Add("GVU0001", "giaovu@truong.edu.vn", "matkhau123", UserRole.AcademicAffairs, mustChange: false);
    }

    private static CreateUserDto NewStudent(string code = "22520001", string email = "an.nv@truong.edu.vn") => new()
    {
        UserCode = code,
        FullName = "Nguyễn Văn An",
        Email = email,
        Role = "Student",
        DateOfBirth = new DateOnly(2004, 3, 12),
        ClassName = "KTPM2022"
    };

    private Task<UserCommandResult<UserDto>> Create(CreateUserDto dto) => _sender.Send(new CreateUserCommand(_staff.Id, dto));

    private static UpdateUserDto EditOf(UserDto user) => new()
    {
        FullName = user.FullName,
        Email = user.Email,
        DateOfBirth = user.DateOfBirth,
        ClassName = user.ClassName,
        Department = user.Department,
        AcademicTitle = user.AcademicTitle
    };

    [Fact]
    public async Task CreateMakesAPendingAccountWithTheUserCodeAsInitialPassword()
    {
        var result = await Create(new CreateUserDto
        {
            UserCode = " 22520001 ", FullName = " Nguyễn Văn An ", Email = " An.NV@Truong.edu.vn ", Role = "Student",
            ClassName = "KTPM2022", Department = "Không thuộc sinh viên"
        });

        Assert.Equal(UserCommandStatus.Created, result.Status);
        var dto = result.Response.Data!;
        Assert.Equal("22520001", dto.UserCode);
        Assert.Equal("Nguyễn Văn An", dto.FullName);
        Assert.Equal("an.nv@truong.edu.vn", dto.Email);
        Assert.True(dto.IsActive);
        Assert.True(dto.MustChangePassword);
        Assert.False(dto.HasData);
        // Trường không thuộc vai trò bị bỏ.
        Assert.Null(dto.Department);
        var saved = _users.All().Single(u => u.Id == dto.Id);
        Assert.Equal("hash:22520001", saved.PasswordHash);
        var audit = Assert.Single(_users.Audits);
        Assert.Equal(UserAuditActions.Created, audit.Action);
        Assert.Equal(_staff.Id, audit.ActorUserId);
        Assert.Equal(dto.Id, audit.TargetUserId);
    }

    [Theory]
    [InlineData("", "Nguyễn Văn An", "an@truong.edu.vn", "Student", "Nhập mã người dùng.")]
    [InlineData("ma co dau cach", "Nguyễn Văn An", "an@truong.edu.vn", "Student", "Mã người dùng chỉ gồm")]
    [InlineData("22520001", "  ", "an@truong.edu.vn", "Student", "Nhập họ tên.")]
    [InlineData("22520001", "Nguyễn Văn An", "khong-phai-email", "Student", "Email không hợp lệ.")]
    [InlineData("22520001", "Nguyễn Văn An", "an@truong.edu.vn", "Admin", "Vai trò phải là")]
    [InlineData("22520001", "Nguyễn Văn An", "an@truong.edu.vn", "1", "Vai trò phải là")]
    public async Task CreateRejectsInvalidFields(string code, string name, string email, string role, string expected)
    {
        var ex = await Assert.ThrowsAsync<ValidationException>(() => Create(new CreateUserDto
        {
            UserCode = code, FullName = name, Email = email, Role = role, ClassName = "KTPM2022"
        }));

        Assert.Contains(ex.Errors, e => e.ErrorMessage.StartsWith(expected));
        Assert.Single(_users.All());
    }

    [Theory]
    [InlineData("Student", null, "Nhập lớp của sinh viên.")]
    [InlineData("Lecturer", "KTPM2022", "Nhập bộ môn của giảng viên.")]
    public async Task CreateRequiresTheRoleSpecificField(string role, string? className, string expected)
    {
        var result = await Create(new CreateUserDto
        {
            UserCode = "X01", FullName = "Người Mới", Email = "moi@truong.edu.vn", Role = role, ClassName = className
        });

        Assert.Equal(UserCommandStatus.Rejected, result.Status);
        Assert.Contains(expected, result.Response.Errors!);
    }

    [Fact]
    public async Task CreateReportsWhichFieldIsDuplicated()
    {
        await Create(NewStudent());

        var sameCode = await Create(NewStudent(email: "khac@truong.edu.vn"));
        var sameEmail = await Create(NewStudent(code: "22520002", email: "AN.NV@truong.edu.vn"));

        Assert.Equal((UserCommandStatus.Duplicate, UserFields.UserCode), (sameCode.Status, sameCode.DuplicateField));
        Assert.Equal((UserCommandStatus.Duplicate, UserFields.Email), (sameEmail.Status, sameEmail.DuplicateField));
        Assert.Equal(2, _users.All().Count);
    }

    [Fact]
    public async Task UpdateKeepsCodeAndRoleAndRecordsBeforeAndAfter()
    {
        var created = (await Create(NewStudent())).Response.Data!;
        var edit = EditOf(created);
        edit.FullName = "Nguyễn Văn Ân";
        edit.Email = "AN.MOI@truong.edu.vn";

        var result = await _sender.Send(new UpdateUserCommand(_staff.Id, created.Id, edit));

        Assert.Equal(UserCommandStatus.Ok, result.Status);
        Assert.Equal("Nguyễn Văn Ân", result.Response.Data!.FullName);
        Assert.Equal("an.moi@truong.edu.vn", result.Response.Data.Email);
        Assert.Equal("22520001", result.Response.Data.UserCode);
        Assert.Equal("Student", result.Response.Data.Role);
        var audit = _users.Audits.Last();
        Assert.Equal(UserAuditActions.Updated, audit.Action);
        var details = JsonDocument.Parse(audit.Details!).RootElement;
        Assert.Equal("Nguyễn Văn An", details.GetProperty("fullName").GetProperty("from").GetString());
        Assert.Equal("Nguyễn Văn Ân", details.GetProperty("fullName").GetProperty("to").GetString());
        Assert.Equal("an.moi@truong.edu.vn", details.GetProperty("email").GetProperty("to").GetString());
        Assert.False(details.TryGetProperty("className", out _));
    }

    [Fact]
    public async Task UpdateWithoutChangesWritesNoHistory()
    {
        var created = (await Create(NewStudent())).Response.Data!;
        var before = _users.Audits.Count;

        var result = await _sender.Send(new UpdateUserCommand(_staff.Id, created.Id, EditOf(created)));

        Assert.Equal(UserCommandStatus.Ok, result.Status);
        Assert.Equal(before, _users.Audits.Count);
    }

    [Fact]
    public async Task UpdateRejectsAnEmailUsedByAnotherAccountAndUnknownIds()
    {
        var created = (await Create(NewStudent())).Response.Data!;
        var edit = EditOf(created);
        edit.Email = "GIAOVU@truong.edu.vn";

        var duplicate = await _sender.Send(new UpdateUserCommand(_staff.Id, created.Id, edit));
        var missing = await _sender.Send(new UpdateUserCommand(_staff.Id, Guid.NewGuid(), EditOf(created)));

        Assert.Equal((UserCommandStatus.Duplicate, UserFields.Email), (duplicate.Status, duplicate.DuplicateField));
        Assert.Equal(UserCommandStatus.NotFound, missing.Status);
    }

    [Fact]
    public async Task DisablingRotatesTheSecurityStampAndReactivatingKeepsThePassword()
    {
        var created = (await Create(NewStudent())).Response.Data!;
        var user = _users.All().Single(u => u.Id == created.Id);
        var stamp = user.SecurityStamp;

        var disabled = await _sender.Send(new SetUserStatusCommand(_staff.Id, created.Id, false));
        Assert.False(disabled.Response.Data!.IsActive);
        Assert.NotEqual(stamp, user.SecurityStamp);

        var reactivated = await _sender.Send(new SetUserStatusCommand(_staff.Id, created.Id, true));
        Assert.True(reactivated.Response.Data!.IsActive);
        Assert.Equal("hash:22520001", user.PasswordHash);
        Assert.Equal([UserAuditActions.Created, UserAuditActions.Disabled, UserAuditActions.Reactivated],
            _users.Audits.Select(a => a.Action));
    }

    [Fact]
    public async Task StaffCannotDisableOrDeleteThemselves()
    {
        var disable = await _sender.Send(new SetUserStatusCommand(_staff.Id, _staff.Id, false));
        var delete = await _sender.Send(new DeleteUserCommand(_staff.Id, _staff.Id));

        Assert.Equal(UserCommandStatus.Rejected, disable.Status);
        Assert.Equal(UserCommandStatus.Rejected, delete.Status);
        Assert.True(_staff.IsActive);
        Assert.Contains(_users.All(), u => u.Id == _staff.Id);
    }

    [Fact]
    public async Task DeleteRemovesAnAccountWithoutDataButOnlyDisablesOneWithData()
    {
        var free = (await Create(NewStudent())).Response.Data!;
        var used = (await Create(NewStudent("22520002", "binh@truong.edu.vn"))).Response.Data!;
        _users.WithRelatedData.Add(used.Id);

        var deleted = await _sender.Send(new DeleteUserCommand(_staff.Id, free.Id));
        var disabled = await _sender.Send(new DeleteUserCommand(_staff.Id, used.Id));

        Assert.Equal(DeleteUserHandler.Deleted, deleted.Response.Data!.Result);
        Assert.DoesNotContain(_users.All(), u => u.Id == free.Id);
        Assert.Equal(DeleteUserHandler.Disabled, disabled.Response.Data!.Result);
        Assert.False(_users.All().Single(u => u.Id == used.Id).IsActive);
        Assert.True((await _sender.Send(new ListUsersQuery())).Data!.Single(u => u.Id == used.Id).HasData);
        // Lịch sử xóa còn lại sau khi tài khoản đã mất.
        Assert.Contains(_users.Audits, a => a.TargetUserId == free.Id && a.Action == UserAuditActions.Deleted);
    }

    [Fact]
    public async Task ResetToUserCodeForcesAPasswordChangeAndEndsOpenSessions()
    {
        var created = (await Create(NewStudent())).Response.Data!;
        var user = _users.All().Single(u => u.Id == created.Id);
        user.PasswordHash = "hash:matkhaurieng1";
        user.MustChangePassword = false;
        user.ActivationCodeHash = "hash:123456";
        var stamp = user.SecurityStamp;

        var result = await _sender.Send(new ResetUserPasswordCommand(_staff.Id, created.Id, null));

        Assert.Equal(UserCommandStatus.Ok, result.Status);
        Assert.Equal("hash:22520001", user.PasswordHash);
        Assert.True(user.MustChangePassword);
        Assert.Null(user.ActivationCodeHash);
        Assert.NotEqual(stamp, user.SecurityStamp);
        var audit = _users.Audits.Last();
        Assert.Equal(UserAuditActions.PasswordReset, audit.Action);
        Assert.DoesNotContain("matkhau", audit.Details!);
    }

    [Fact]
    public async Task ResetToACustomPasswordFollowsThePasswordRules()
    {
        // Mã có cả chữ và số để "trùng mã" qua được quy tắc mật khẩu và tới bước kiểm tra riêng.
        var created = (await Create(NewStudent("sv123456"))).Response.Data!;
        var user = _users.All().Single(u => u.Id == created.Id);

        await Assert.ThrowsAsync<ValidationException>(() =>
            _sender.Send(new ResetUserPasswordCommand(_staff.Id, created.Id, "chiconchu")));
        var sameAsCode = await _sender.Send(new ResetUserPasswordCommand(_staff.Id, created.Id, "sv123456"));
        var custom = await _sender.Send(new ResetUserPasswordCommand(_staff.Id, created.Id, "matkhau123"));

        Assert.Equal(UserCommandStatus.Rejected, sameAsCode.Status);
        Assert.Equal(UserCommandStatus.Ok, custom.Status);
        Assert.Equal("hash:matkhau123", user.PasswordHash);
        Assert.True(user.MustChangePassword);
        Assert.DoesNotContain(_users.Audits, a => a.Details?.Contains("matkhau123") == true);
    }
}
