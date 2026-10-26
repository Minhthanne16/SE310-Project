using Backend.Application.Auth;

namespace Backend.API.Authentication;

public static class AuthCookie
{
    public const string Name = "qlkltn_access";

    public static void Append(HttpContext context, IssuedAccessToken token) =>
        context.Response.Cookies.Append(Name, token.Value, Options(context, token.ExpiresAt));

    public static void Delete(HttpContext context) =>
        context.Response.Cookies.Delete(Name, Options(context, expires: null));

    private static CookieOptions Options(HttpContext context, DateTime? expires) => new()
    {
        HttpOnly = true,
        // Ngoài Development luôn Secure; khi chạy local qua http thì trình duyệt mới nhận cookie.
        Secure = context.Request.IsHttps || !context.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment(),
        SameSite = SameSiteMode.Lax,
        Path = "/",
        Expires = expires
    };
}
