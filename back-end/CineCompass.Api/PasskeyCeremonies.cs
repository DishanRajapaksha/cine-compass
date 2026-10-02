using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace CineCompass.Api;

// State never leaves the server. A random HttpOnly cookie binds it to the initiating browser.
// Atomic removal makes completion single-use, including concurrent or failed attempts.
public sealed class PasskeyCeremonies
{
    public sealed record Pending(string Kind, string State, string? UserId, string? Name, DateTimeOffset Expires);
    private readonly ConcurrentDictionary<string, Pending> pending = new();
    private const string Cookie = "cc.passkey";
    public void Begin(HttpContext context, string kind, string state, string? userId = null, string? name = null)
    {
        Cancel(context);
        foreach (var item in pending.Where(x => x.Value.Expires <= DateTimeOffset.UtcNow)) pending.TryRemove(item.Key, out _);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        pending[token] = new(kind, state, userId, name, DateTimeOffset.UtcNow.AddMinutes(5));
        context.Response.Cookies.Append(Cookie, token, new CookieOptions { HttpOnly = true, Secure = context.Request.IsHttps, SameSite = SameSiteMode.Strict, Path = "/api", MaxAge = TimeSpan.FromMinutes(5) });
    }
    public Pending? Take(HttpContext context, string kind)
    {
        context.Request.Cookies.TryGetValue(Cookie, out var token);
        context.Response.Cookies.Delete(Cookie, new CookieOptions { Path = "/api" });
        return token is not null && pending.TryRemove(token, out var value) && value.Kind == kind && value.Expires > DateTimeOffset.UtcNow ? value : null;
    }
    public void Cancel(HttpContext context)
    {
        if (context.Request.Cookies.TryGetValue(Cookie, out var token)) pending.TryRemove(token, out _);
        context.Response.Cookies.Delete(Cookie, new CookieOptions { Path = "/api" });
    }
}
