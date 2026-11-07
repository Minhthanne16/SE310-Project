using System.Text.RegularExpressions;
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

// Quên mật khẩu theo PDR-037 (phản hồi trung tính), PDR-044 (giới hạn) và PDR-045 (điều kiện tài khoản).
public sealed partial class PasswordResetTests
{
    private const string ResetPage = "http://localhost:3000/quen-mat-khau";
    private const string Source = "203.0.113.7";

    private readonly InMemoryUserRepository _users = new();
    private readonly InMemoryPasswordResetRepository _resets;
    private readonly CapturingEmailSender _emails = new();
    private readonly ManualTimeProvider _clock = new(new DateTimeOffset(2026, 11, 7, 8, 0, 0, TimeSpan.Zero));
    private readonly ISender _sender;
    private readonly User _active;

    public PasswordResetTests()
    {
        _resets = new InMemoryPasswordResetRepository(_users);
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplicationServices();
        services.AddSingleton<IUserRepository>(_users);
        services.AddSingleton<IPasswordResetRepository>(_resets);
        services.AddSingleton<IPasswordHasher, FakePasswordHasher>();
        services.AddSingleton<IEmailSender>(_emails);
        services.AddSingleton<TimeProvider>(_clock);
        services.AddSingleton<IAccessTokenIssuer, StubTokenIssuer>();
        _sender = services.BuildServiceProvider().GetRequiredService<ISender>();
        _active = _users.Add("sv22520001", "an.nv@truong.edu.vn", "matkhau123", UserRole.Student, mustChange: false);
    }

    [GeneratedRegex("#token=([A-Za-z0-9_-]+)")]
    private static partial Regex TokenInLink();

    private Task<Backend.Application.Common.ApiResponse<bool>> Request(string email, string source = Source) =>
        _sender.Send(new RequestPasswordResetCommand(email, source, ResetPage));

    private string LastToken() => TokenInLink().Match(_emails.Sent[^1].Text).Groups[1].Value;

    private async Task<string> Check(string token) =>
        (await _sender.Send(new CheckPasswordResetTokenQuery(token))).Data!.Status;

    private Task<Backend.Application.Common.ApiResponse<PasswordResetStatusDto>> Reset(string token, string newPassword = "MatKhauMoi9") =>
        _sender.Send(new ResetPasswordWithTokenCommand(new ResetPasswordWithTokenDto { Token = token, NewPassword = newPassword }));

    [Fact]
    public async Task EveryWellFormedEmailGetsTheSameNeutralResponseButOnlyAnEligibleAccountGetsMail()
    {
        var disabled = _users.Add("22520002", "disabled@truong.edu.vn", "matkhau123", UserRole.Student, mustChange: false);
        disabled.IsActive = false;
        _users.Add("22520003", "pending@truong.edu.vn", "22520003", UserRole.Student, mustChange: true);

        var responses = new[]
        {
            await Request(" An.NV@Truong.edu.vn "),
            await Request("nobody@truong.edu.vn"),
            await Request("disabled@truong.edu.vn"),
            await Request("pending@truong.edu.vn")
        };

        Assert.All(responses, r =>
        {
            Assert.True(r.Success);
            Assert.Equal(PasswordResetPolicy.NeutralMessage, r.Message);
        });
        var mail = Assert.Single(_emails.Sent);
        Assert.Equal("an.nv@truong.edu.vn", mail.To);
        Assert.Contains($"{ResetPage}#token=", mail.Text);
        Assert.Equal("valid", await Check(LastToken()));
    }

    [Theory]
    [InlineData("")]
    [InlineData("khong-phai-email")]
    [InlineData("a@b@c.vn")]
    public async Task MalformedEmailIsRejectedAsAFormatError(string email)
    {
        var ex = await Assert.ThrowsAsync<ValidationException>(() => Request(email));
        Assert.NotEmpty(ex.Errors);
        Assert.Empty(_emails.Sent);
    }

    [Fact]
    public async Task SameEmailMustWaitSixtySecondsBetweenAcceptedRequests()
    {
        await Request(_active.Email);
        _clock.Advance(TimeSpan.FromSeconds(59));
        var throttled = await Request(_active.Email);
        _clock.Advance(TimeSpan.FromSeconds(1));
        await Request(_active.Email);

        Assert.Equal(PasswordResetPolicy.NeutralMessage, throttled.Message);
        Assert.Equal(2, _emails.Sent.Count);
    }

    [Fact]
    public async Task SameEmailIsLimitedToFiveRequestsPerHourEvenFromDifferentSources()
    {
        for (var i = 0; i < 6; i++)
        {
            await Request(_active.Email, source: $"198.51.100.{i}");
            _clock.Advance(TimeSpan.FromMinutes(1));
        }
        Assert.Equal(5, _emails.Sent.Count);

        // Yêu cầu đầu tiên rời khỏi cửa sổ một giờ thì được gửi lại.
        _clock.Advance(TimeSpan.FromMinutes(55));
        await Request(_active.Email);
        Assert.Equal(6, _emails.Sent.Count);
    }

    [Fact]
    public async Task OneSourceIsLimitedToTwentyRequestsPerHourAcrossEmailsIncludingUnknownOnes()
    {
        for (var i = 0; i < 20; i++)
            await Request($"khong-co-{i}@truong.edu.vn");

        var throttled = await Request(_active.Email);
        Assert.Equal(PasswordResetPolicy.NeutralMessage, throttled.Message);
        Assert.Empty(_emails.Sent);

        await Request(_active.Email, source: "198.51.100.1");
        Assert.Single(_emails.Sent);
    }

    [Fact]
    public async Task ConcurrentRequestsForOneEmailSendAtMostOneMail()
    {
        await Task.WhenAll(Enumerable.Range(0, 10).Select(i => Request(_active.Email, source: $"198.51.100.{i}")));
        Assert.Single(_emails.Sent);
    }

    [Fact]
    public async Task LinkExpiresAfterThirtyMinutes()
    {
        await Request(_active.Email);
        var token = LastToken();

        _clock.Advance(TimeSpan.FromMinutes(30) - TimeSpan.FromSeconds(1));
        Assert.Equal("valid", await Check(token));
        _clock.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal("expired", await Check(token));

        var result = await Reset(token);
        Assert.False(result.Success);
        Assert.Equal("expired", result.Data!.Status);
    }

    [Fact]
    public async Task UnknownTokenIsInvalid()
    {
        Assert.Equal("invalid", await Check("khong-ton-tai"));
        Assert.Equal("invalid", (await Reset("khong-ton-tai")).Data!.Status);
    }

    [Fact]
    public async Task ResettingChangesThePasswordRevokesSessionsAndRecordsHistory()
    {
        var stamp = _active.SecurityStamp;
        await Request(_active.Email);

        var result = await Reset(LastToken());

        Assert.True(result.Success);
        Assert.Equal("completed", result.Data!.Status);
        Assert.Equal("hash:MatKhauMoi9", _active.PasswordHash);
        Assert.NotEqual(stamp, _active.SecurityStamp);
        Assert.False(_active.MustChangePassword);
        var audit = Assert.Single(_users.Audits);
        Assert.Equal(UserAuditActions.PasswordResetByLink, audit.Action);
        Assert.Equal(_active.Id, audit.ActorUserId);
        Assert.Null(audit.Details);
    }

    [Fact]
    public async Task LinkCanBeUsedOnlyOnceAndUsingOneRetiresEarlierLinks()
    {
        await Request(_active.Email);
        var first = LastToken();
        _clock.Advance(TimeSpan.FromMinutes(1));
        await Request(_active.Email);
        var second = LastToken();

        Assert.True((await Reset(second)).Success);

        Assert.Equal("used", await Check(second));
        Assert.Equal("used", (await Reset(second, "KhacNua123")).Data!.Status);
        Assert.Equal("used", await Check(first));
        Assert.Equal("hash:MatKhauMoi9", _active.PasswordHash);
    }

    [Fact]
    public async Task LinkStopsWorkingWhenTheAccountIsDisabledAfterIssue()
    {
        await Request(_active.Email);
        var token = LastToken();

        _active.IsActive = false;
        _active.SecurityStamp = Guid.NewGuid().ToString("N");

        Assert.Equal("invalid", await Check(token));
        Assert.False((await Reset(token)).Success);
        Assert.Equal("hash:matkhau123", _active.PasswordHash);
    }

    [Fact]
    public async Task LinkCannotBypassActivationWhenStaffResetThePasswordAfterIssue()
    {
        await Request(_active.Email);
        var token = LastToken();

        // Giáo vụ đặt lại mật khẩu: tài khoản quay về chờ kích hoạt, stamp đổi.
        _active.MustChangePassword = true;
        _active.SecurityStamp = Guid.NewGuid().ToString("N");

        Assert.Equal("invalid", await Check(token));
        Assert.False((await Reset(token)).Success);
    }

    [Fact]
    public async Task LinkStopsWorkingAfterThePasswordIsChangedAnotherWay()
    {
        await Request(_active.Email);
        var token = LastToken();

        await _sender.Send(new ChangePasswordCommand(_active.Id,
            new ChangePasswordDto { CurrentPassword = "matkhau123", NewPassword = "DaDoiRoi123" }));

        Assert.Equal("invalid", await Check(token));
        Assert.False((await Reset(token)).Success);
        Assert.Equal("hash:DaDoiRoi123", _active.PasswordHash);
    }

    [Fact]
    public async Task NewPasswordMustFollowTheRulesAndDifferFromTheUserCode()
    {
        await Request(_active.Email);
        var token = LastToken();

        await Assert.ThrowsAsync<ValidationException>(() => Reset(token, "ngan1"));
        await Assert.ThrowsAsync<ValidationException>(() => Reset(token, "chiCoChuThoi"));
        var sameAsCode = await Reset(token, "sv22520001");
        Assert.False(sameAsCode.Success);
        Assert.Equal("valid", await Check(token));
    }

    [Fact]
    public async Task MailFailureStillReturnsTheNeutralResponse()
    {
        _emails.FailNext = true;
        var result = await Request(_active.Email);
        Assert.True(result.Success);
        Assert.Equal(PasswordResetPolicy.NeutralMessage, result.Message);
    }
}

internal sealed class StubTokenIssuer : IAccessTokenIssuer
{
    public IssuedAccessToken Issue(User user) => new($"token-for-{user.Id}", DateTime.UtcNow.AddHours(1));
}

internal sealed class InMemoryPasswordResetRepository(InMemoryUserRepository users) : IPasswordResetRepository
{
    private readonly List<PasswordResetRequest> _requests = [];
    private readonly List<PasswordResetToken> _tokens = [];

    public Task<bool> TryRecordRequestAsync(PasswordResetRequest request, PasswordResetLimits limits, CancellationToken cancellationToken = default)
    {
        lock (_requests)
        {
            var since = request.CreatedAt - limits.Window;
            var byEmail = _requests.Where(r => r.EmailHash == request.EmailHash && r.CreatedAt > since).ToList();
            if (byEmail.Count >= limits.MaxPerEmail || byEmail.Any(r => request.CreatedAt - r.CreatedAt < limits.EmailCooldown))
                return Task.FromResult(false);
            if (_requests.Count(r => r.Source == request.Source && r.CreatedAt > since) >= limits.MaxPerSource)
                return Task.FromResult(false);
            _requests.Add(request);
            return Task.FromResult(true);
        }
    }

    public Task AddTokenAsync(PasswordResetToken token, CancellationToken cancellationToken = default)
    {
        lock (_tokens) _tokens.Add(token);
        return Task.CompletedTask;
    }

    public Task<PasswordResetToken?> GetTokenAsync(string tokenHash, CancellationToken cancellationToken = default)
    {
        lock (_tokens) return Task.FromResult(_tokens.FirstOrDefault(t => t.TokenHash == tokenHash));
    }

    public async Task<bool> CompleteResetAsync(User user, PasswordResetToken token, UserAuditEntry audit, DateTime now, CancellationToken cancellationToken = default)
    {
        lock (_tokens)
        {
            if (token.UsedAt is not null) return false;
            foreach (var t in _tokens.Where(t => t.UserId == user.Id && t.UsedAt is null)) t.UsedAt = now;
        }
        await users.UpdateAsync(user, audit, cancellationToken);
        return true;
    }
}
