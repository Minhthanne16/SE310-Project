using Backend.Application;
using Backend.Application.Auth;
using Backend.Application.Common.Email;
using Backend.Application.Common.Security;
using Backend.Domain.Entities;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Backend.Tests;

public sealed class AuthWorkflowTests
{
    private const string Code = "123456";
    private readonly InMemoryUserRepository _users = new();
    private readonly CapturingEmailSender _emails = new();
    private readonly ManualTimeProvider _clock = new(new DateTimeOffset(2026, 10, 24, 8, 0, 0, TimeSpan.Zero));
    private readonly ISender _sender;

    public AuthWorkflowTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationServices();
        services.AddSingleton<IUserRepository>(_users);
        services.AddSingleton<IPasswordHasher, FakePasswordHasher>();
        services.AddSingleton<IAccessTokenIssuer, FakeTokenIssuer>();
        services.AddSingleton<IEmailSender>(_emails);
        services.AddSingleton<IActivationCodeGenerator>(new FixedCodeGenerator(Code));
        services.AddSingleton<TimeProvider>(_clock);
        _sender = services.BuildServiceProvider().GetRequiredService<ISender>();
    }

    [Fact]
    public async Task LoginSucceedsWithCaseInsensitiveEmailAndReturnsUser()
    {
        var user = _users.Add("22520001", "an.nv@truong.edu.vn", "matkhau123", UserRole.Student, mustChange: false);

        var result = await _sender.Send(new LoginCommand(new LoginDto { Email = "  AN.NV@truong.edu.vn ", Password = "matkhau123" }));

        Assert.True(result.Success);
        Assert.Equal(user.Id, result.Data!.User.Id);
        Assert.Equal(AppRoles.Student, result.Data.User.Role);
        Assert.False(result.Data.User.MustChangePassword);
        Assert.Equal($"token-for-{user.Id}", result.Data.AccessToken.Value);
        Assert.NotNull(user.LastLoginAt);
    }

    [Fact]
    public async Task LoginReportsMustChangePasswordForInitialPassword()
    {
        _users.Add("22520001", "an.nv@truong.edu.vn", "22520001", UserRole.Student, mustChange: true);

        var result = await _sender.Send(new LoginCommand(new LoginDto { Email = "an.nv@truong.edu.vn", Password = "22520001" }));

        Assert.True(result.Success);
        Assert.True(result.Data!.User.MustChangePassword);
    }

    [Theory]
    [InlineData("an.nv@truong.edu.vn", "sai-mat-khau1")]
    [InlineData("khong.ton.tai@truong.edu.vn", "matkhau123")]
    public async Task LoginFailsWithOneGenericMessage(string email, string password)
    {
        _users.Add("22520001", "an.nv@truong.edu.vn", "matkhau123", UserRole.Student, mustChange: false);

        var result = await _sender.Send(new LoginCommand(new LoginDto { Email = email, Password = password }));

        Assert.False(result.Success);
        Assert.Equal(LoginHandler.InvalidCredentialsMessage, result.Message);
    }

    [Fact]
    public async Task LoginRejectsDeactivatedAccount()
    {
        var user = _users.Add("GV001", "gv@truong.edu.vn", "matkhau123", UserRole.Lecturer, mustChange: false);
        user.IsActive = false;

        var result = await _sender.Send(new LoginCommand(new LoginDto { Email = "gv@truong.edu.vn", Password = "matkhau123" }));

        Assert.False(result.Success);
        Assert.Equal(LoginHandler.InvalidCredentialsMessage, result.Message);
    }

    [Fact]
    public async Task LoginRequiresEmailAndPassword()
    {
        await Assert.ThrowsAsync<ValidationException>(() =>
            _sender.Send(new LoginCommand(new LoginDto { Email = "", Password = "" })));
    }

    [Fact]
    public async Task SendActivationCodeEmailsHashedCodeToAccountEmail()
    {
        var user = NewStudentWithInitialPassword();

        var result = await _sender.Send(new SendActivationCodeCommand(user.Id));

        Assert.Equal(SendActivationCodeStatus.Sent, result.Status);
        var email = Assert.Single(_emails.Sent);
        Assert.Equal(user.Email, email.To);
        Assert.Contains(Code, email.Text);
        Assert.Equal($"hash:{Code}", user.ActivationCodeHash);
        Assert.Equal(_clock.GetUtcNow().UtcDateTime.AddMinutes(10), user.ActivationCodeExpiresAt);
        Assert.Equal(_clock.GetUtcNow().UtcDateTime.AddSeconds(60), result.Response.Data!.ResendAvailableAt);
    }

    [Fact]
    public async Task SendActivationCodeEnforcesResendCooldown()
    {
        var user = NewStudentWithInitialPassword();
        await _sender.Send(new SendActivationCodeCommand(user.Id));

        var tooSoon = await _sender.Send(new SendActivationCodeCommand(user.Id));
        _clock.Advance(TimeSpan.FromSeconds(61));
        var later = await _sender.Send(new SendActivationCodeCommand(user.Id));

        Assert.Equal(SendActivationCodeStatus.TooSoon, tooSoon.Status);
        Assert.Equal(SendActivationCodeStatus.Sent, later.Status);
        Assert.Equal(2, _emails.Sent.Count);
    }

    [Fact]
    public async Task SendActivationCodeIsNotForActivatedAccounts()
    {
        var user = _users.Add("22520001", "an.nv@truong.edu.vn", "matkhau123", UserRole.Student, mustChange: false);

        var result = await _sender.Send(new SendActivationCodeCommand(user.Id));

        Assert.Equal(SendActivationCodeStatus.NotRequired, result.Status);
        Assert.Empty(_emails.Sent);
    }

    [Fact]
    public async Task SendActivationCodeDeliveryFailureDiscardsCodeAndAllowsImmediateRetry()
    {
        var user = NewStudentWithInitialPassword();
        _emails.FailNext = true;

        var failed = await _sender.Send(new SendActivationCodeCommand(user.Id));
        var retry = await _sender.Send(new SendActivationCodeCommand(user.Id));

        Assert.Equal(SendActivationCodeStatus.DeliveryFailed, failed.Status);
        Assert.Equal(SendActivationCodeStatus.Sent, retry.Status);
    }

    [Fact]
    public async Task ChangeInitialPasswordClearsFlagCodeAndRotatesSecurityStamp()
    {
        var user = NewStudentWithInitialPassword();
        await _sender.Send(new SendActivationCodeCommand(user.Id));
        var oldStamp = user.SecurityStamp;

        var result = await ChangePassword(user, "22520001", "matkhau123", Code);

        Assert.True(result.Success);
        Assert.False(result.Data!.User.MustChangePassword);
        Assert.False(user.MustChangePassword);
        Assert.NotEqual(oldStamp, user.SecurityStamp);
        Assert.Equal("hash:matkhau123", user.PasswordHash);
        Assert.Null(user.ActivationCodeHash);
    }

    [Fact]
    public async Task ChangeInitialPasswordRejectsWrongCurrentPassword()
    {
        var user = NewStudentWithInitialPassword();
        await _sender.Send(new SendActivationCodeCommand(user.Id));

        var result = await ChangePassword(user, "sai", "matkhau123", Code);

        Assert.False(result.Success);
        Assert.True(user.MustChangePassword);
        Assert.Equal(0, user.ActivationCodeFailedAttempts);
    }

    [Fact]
    public async Task ChangeInitialPasswordRequiresACodeToHaveBeenSent()
    {
        var user = NewStudentWithInitialPassword();

        var result = await ChangePassword(user, "22520001", "matkhau123", Code);

        Assert.False(result.Success);
        Assert.True(user.MustChangePassword);
    }

    [Fact]
    public async Task ChangeInitialPasswordRejectsWrongCodeAndCountsAttempts()
    {
        var user = NewStudentWithInitialPassword();
        await _sender.Send(new SendActivationCodeCommand(user.Id));

        var result = await ChangePassword(user, "22520001", "matkhau123", "000000");

        Assert.False(result.Success);
        Assert.Equal(1, user.ActivationCodeFailedAttempts);
        Assert.True(user.MustChangePassword);
    }

    [Fact]
    public async Task FifthWrongCodeInvalidatesTheCode()
    {
        var user = NewStudentWithInitialPassword();
        await _sender.Send(new SendActivationCodeCommand(user.Id));
        for (var i = 0; i < 5; i++)
            await ChangePassword(user, "22520001", "matkhau123", "000000");

        var result = await ChangePassword(user, "22520001", "matkhau123", Code);

        Assert.False(result.Success);
        Assert.Null(user.ActivationCodeHash);
        Assert.True(user.MustChangePassword);
    }

    [Fact]
    public async Task ExpiredCodeIsRejected()
    {
        var user = NewStudentWithInitialPassword();
        await _sender.Send(new SendActivationCodeCommand(user.Id));
        _clock.Advance(TimeSpan.FromMinutes(10).Add(TimeSpan.FromSeconds(1)));

        var result = await ChangePassword(user, "22520001", "matkhau123", Code);

        Assert.False(result.Success);
        Assert.True(user.MustChangePassword);
    }

    [Fact]
    public async Task ChangeInitialPasswordRejectsUserCodeAsNewPassword()
    {
        var user = _users.Add("sv22520001", "an.nv@truong.edu.vn", "tam12345", UserRole.Student, mustChange: true);
        await _sender.Send(new SendActivationCodeCommand(user.Id));

        var result = await ChangePassword(user, "tam12345", "sv22520001", Code);

        Assert.False(result.Success);
        Assert.True(user.MustChangePassword);
    }

    [Fact]
    public async Task ChangeInitialPasswordIsOnlyForAccountsThatMustChange()
    {
        var user = _users.Add("22520001", "an.nv@truong.edu.vn", "matkhau123", UserRole.Student, mustChange: false);

        var result = await ChangePassword(user, "matkhau123", "matkhau456", Code);

        Assert.False(result.Success);
    }

    [Theory]
    [InlineData("abc1234", Code)]    // ngắn hơn 8 ký tự
    [InlineData("abcdefgh", Code)]   // không có số
    [InlineData("12345678", Code)]   // không có chữ
    [InlineData("22520001", Code)]   // trùng mật khẩu hiện tại
    [InlineData("matkhau123", "")]   // thiếu mã xác thực
    [InlineData("matkhau123", "12a456")]
    [InlineData("matkhau123", "12345")]
    public async Task ChangeInitialPasswordValidatesInput(string newPassword, string code)
    {
        await Assert.ThrowsAsync<ValidationException>(() => _sender.Send(new ChangeInitialPasswordCommand(Guid.NewGuid(),
            new ChangeInitialPasswordDto { CurrentPassword = "22520001", NewPassword = newPassword, ActivationCode = code })));
    }

    [Fact]
    public async Task GetCurrentUserFailsForDeactivatedAccount()
    {
        var user = _users.Add("22520001", "an.nv@truong.edu.vn", "matkhau123", UserRole.Student, mustChange: false);
        user.IsActive = false;

        var result = await _sender.Send(new GetCurrentUserQuery(user.Id));

        Assert.False(result.Success);
    }

    private User NewStudentWithInitialPassword() =>
        _users.Add("22520001", "an.nv@truong.edu.vn", "22520001", UserRole.Student, mustChange: true);

    private Task<Backend.Application.Common.ApiResponse<AuthenticatedSession>> ChangePassword(
        User user, string current, string newPassword, string code) =>
        _sender.Send(new ChangeInitialPasswordCommand(user.Id,
            new ChangeInitialPasswordDto { CurrentPassword = current, NewPassword = newPassword, ActivationCode = code }));

    private sealed class FakeTokenIssuer : IAccessTokenIssuer
    {
        public IssuedAccessToken Issue(User user) => new($"token-for-{user.Id}", DateTime.UtcNow.AddHours(1));
    }
}

internal sealed class InMemoryUserRepository : IUserRepository
{
    private readonly Dictionary<Guid, User> _users = [];

    public User Add(string code, string email, string password, UserRole role, bool mustChange, Func<string, string>? hash = null)
    {
        var user = new User
        {
            UserCode = code,
            FullName = $"Người dùng {code}",
            Email = User.NormalizeEmail(email),
            PasswordHash = (hash ?? (p => $"hash:{p}"))(password),
            Role = role,
            MustChangePassword = mustChange
        };
        lock (_users) _users.Add(user.Id, user);
        return user;
    }

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        lock (_users) return Task.FromResult(_users.GetValueOrDefault(id));
    }

    public Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default)
    {
        lock (_users) return Task.FromResult(_users.Values.FirstOrDefault(u => u.Email == normalizedEmail));
    }

    public Task<IReadOnlySet<string>> GetExistingUserCodesAsync(IReadOnlyCollection<string> userCodes, CancellationToken cancellationToken = default)
    {
        lock (_users) return Task.FromResult<IReadOnlySet<string>>(_users.Values.Select(u => u.UserCode).Where(userCodes.Contains).ToHashSet());
    }

    public Task<IReadOnlySet<string>> GetExistingEmailsAsync(IReadOnlyCollection<string> normalizedEmails, CancellationToken cancellationToken = default)
    {
        lock (_users) return Task.FromResult<IReadOnlySet<string>>(_users.Values.Select(u => u.Email).Where(normalizedEmails.Contains).ToHashSet());
    }

    public Task AddRangeAsync(IReadOnlyCollection<User> users, CancellationToken cancellationToken = default)
    {
        lock (_users)
        {
            if (users.Any(n => _users.Values.Any(u => u.UserCode == n.UserCode || u.Email == n.Email)))
                throw new DuplicateUserException();
            foreach (var user in users) _users.Add(user.Id, user);
        }
        return Task.CompletedTask;
    }

    public IReadOnlyList<User> All()
    {
        lock (_users) return _users.Values.ToList();
    }

    public Task UpdateAsync(User user, CancellationToken cancellationToken = default) => Task.CompletedTask;

    // Mô phỏng bảng nghiệp vụ tham chiếu tới tài khoản (chưa có trong schema thật).
    public HashSet<Guid> WithRelatedData { get; } = [];
    public List<UserAuditEntry> Audits { get; } = [];

    public Task<IReadOnlyList<User>> ListAsync(CancellationToken cancellationToken = default)
    {
        lock (_users) return Task.FromResult<IReadOnlyList<User>>(_users.Values.OrderBy(u => u.UserCode).ToList());
    }

    public Task<IReadOnlySet<Guid>> GetUserIdsWithRelatedDataAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default)
    {
        lock (_users) return Task.FromResult<IReadOnlySet<Guid>>(userIds.Where(WithRelatedData.Contains).ToHashSet());
    }

    public Task AddAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default)
    {
        lock (_users)
        {
            if (_users.Values.Any(u => u.UserCode == user.UserCode || u.Email == user.Email))
                throw new DuplicateUserException();
            _users.Add(user.Id, user);
            Audits.Add(audit);
        }
        return Task.CompletedTask;
    }

    public Task UpdateAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default)
    {
        lock (_users)
        {
            if (_users.Values.Any(u => u.Id != user.Id && u.Email == user.Email))
                throw new DuplicateUserException();
            Audits.Add(audit);
        }
        return Task.CompletedTask;
    }

    public Task DeleteAsync(User user, UserAuditEntry audit, CancellationToken cancellationToken = default)
    {
        lock (_users)
        {
            _users.Remove(user.Id);
            Audits.Add(audit);
        }
        return Task.CompletedTask;
    }
}

internal sealed class FakePasswordHasher : IPasswordHasher
{
    public string Hash(string password) => $"hash:{password}";
    public string HashInitialPassword(string userCode) => $"hash:{userCode}";
    public bool Verify(string password, string hash) => hash == $"hash:{password}";
}

internal sealed class CapturingEmailSender : IEmailSender
{
    public sealed record Message(string To, string Subject, string Text);

    public List<Message> Sent { get; } = [];
    public bool FailNext { get; set; }

    public Task SendAsync(string to, string subject, string text, CancellationToken cancellationToken = default)
    {
        if (FailNext)
        {
            FailNext = false;
            throw new InvalidOperationException("SMTP unavailable");
        }
        lock (Sent) Sent.Add(new Message(to, subject, text));
        return Task.CompletedTask;
    }
}

internal sealed class FixedCodeGenerator(string code) : IActivationCodeGenerator
{
    public string NewCode() => code;
}

internal sealed class ManualTimeProvider(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;
    public override DateTimeOffset GetUtcNow() => _now;
    public void Advance(TimeSpan by) => _now += by;
}
