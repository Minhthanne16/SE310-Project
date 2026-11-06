namespace Backend.Application.Notifications;

public sealed class NotificationDto
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string From { get; set; } = string.Empty;
    public string Href { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsRead { get; set; }
}

public sealed class MarkNotificationsReadDto
{
    public List<Guid>? Ids { get; set; }
}
