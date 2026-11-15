using Backend.Application.Common;
using Backend.Application.Common.Storage;
using Backend.Domain.Interfaces;
using FluentValidation;

namespace Backend.API.Middlewares;

public sealed class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ValidationException ex)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("Validation failed", ex.Errors.Select(x => x.ErrorMessage).ToList()));
        }
        catch (DuplicateUserException)
        {
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(
                "Một số mã người dùng hoặc email vừa được tạo bởi thao tác khác. Hãy xem trước lại tệp."));
        }
        catch (StorageUnavailableException ex)
        {
            logger.LogError(ex, "Object storage unavailable");
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("Chưa xử lý được tệp vì kho lưu trữ tệp không sẵn sàng. Thử lại sau."));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled API error");
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("Internal server error"));
        }
    }
}
