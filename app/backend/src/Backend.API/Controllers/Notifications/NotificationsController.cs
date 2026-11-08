using Backend.Application.Auth;
using Backend.Application.Common;
using Backend.Application.Notifications;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.API.Controllers.Notifications;

// Chuông thông báo: người nhận luôn lấy từ phiên đăng nhập, không nhận id người dùng từ client.
[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(ISender sender) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<NotificationDto>>>> Mine(CancellationToken cancellationToken) =>
        Ok(await sender.Send(new ListMyNotificationsQuery(CurrentUserId), cancellationToken));

    [HttpPost("read")]
    public async Task<ActionResult<ApiResponse<int>>> MarkRead(MarkNotificationsReadDto dto, CancellationToken cancellationToken) =>
        Ok(await sender.Send(new MarkNotificationsReadCommand(CurrentUserId, dto.Ids), cancellationToken));

    private Guid CurrentUserId => Guid.Parse(User.FindFirst(AppClaims.UserId)!.Value);
}
