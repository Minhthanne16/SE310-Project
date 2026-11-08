using Backend.Application.Common;
using Backend.Domain.Interfaces;
using FluentValidation;
using MediatR;

namespace Backend.Application.Notifications;

public static class NotificationPolicy
{
    public const int ListLimit = 50;
    public const int MaxMarkReadIds = 200;
    public const string SystemSender = "Hệ thống";
}

public record ListMyNotificationsQuery(Guid UserId) : IRequest<ApiResponse<IReadOnlyList<NotificationDto>>>;
public record MarkNotificationsReadCommand(Guid UserId, IReadOnlyList<Guid>? Ids) : IRequest<ApiResponse<int>>;

public sealed class MarkNotificationsReadValidator : AbstractValidator<MarkNotificationsReadCommand>
{
    public MarkNotificationsReadValidator()
    {
        RuleFor(x => x.Ids)
            .Must(ids => ids is { Count: > 0 and <= NotificationPolicy.MaxMarkReadIds })
            .WithMessage($"Chọn từ 1 đến {NotificationPolicy.MaxMarkReadIds} thông báo.");
    }
}

public sealed class ListMyNotificationsHandler(INotificationRepository notifications)
    : IRequestHandler<ListMyNotificationsQuery, ApiResponse<IReadOnlyList<NotificationDto>>>
{
    public async Task<ApiResponse<IReadOnlyList<NotificationDto>>> Handle(ListMyNotificationsQuery request, CancellationToken cancellationToken)
    {
        var rows = await notifications.ListForRecipientAsync(request.UserId, NotificationPolicy.ListLimit, cancellationToken);
        IReadOnlyList<NotificationDto> items = rows.Select(n => new NotificationDto
        {
            Id = n.Id,
            Kind = n.Kind,
            Text = n.Text,
            From = n.Sender?.FullName ?? NotificationPolicy.SystemSender,
            Href = n.Href,
            CreatedAt = DateTime.SpecifyKind(n.CreatedAt, DateTimeKind.Utc),
            IsRead = n.ReadAt is not null
        }).ToList();
        return ApiResponse<IReadOnlyList<NotificationDto>>.Ok(items);
    }
}

public sealed class MarkNotificationsReadHandler(INotificationRepository notifications, TimeProvider clock)
    : IRequestHandler<MarkNotificationsReadCommand, ApiResponse<int>>
{
    public async Task<ApiResponse<int>> Handle(MarkNotificationsReadCommand request, CancellationToken cancellationToken)
    {
        var changed = await notifications.MarkReadAsync(request.UserId, request.Ids!, clock.GetUtcNow().UtcDateTime, cancellationToken);
        return ApiResponse<int>.Ok(changed, "Đã đánh dấu đã đọc");
    }
}
