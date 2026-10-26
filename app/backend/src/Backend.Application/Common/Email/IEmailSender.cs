namespace Backend.Application.Common.Email;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string text, CancellationToken cancellationToken = default);
}
