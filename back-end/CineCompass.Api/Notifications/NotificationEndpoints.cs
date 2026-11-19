using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CineCompass.Api.Notifications;

internal static class NotificationEndpoints
{
    private const int PageSize = 25;

    public static void MapScreeningNotifications(this WebApplication app)
    {
        var inbox = app.MapGroup("/api/notifications").RequireAuthorization();
        inbox.MapGet("", async (long? before, HttpContext context, UserManager<AppUser> users, AppDbContext db, CancellationToken ct) =>
        {
            if (before is <= 0) return Results.BadRequest(new { error = "Invalid notification cursor." });
            var owner = users.GetUserId(context.User);
            var rows = db.ScreeningNotifications.AsNoTracking().Where(row => row.UserId == owner);
            var unread = await rows.CountAsync(row => !row.IsRead, ct);
            if (before is { } cursor) rows = rows.Where(row => row.Id < cursor);
            var page = await rows.OrderByDescending(row => row.Id).Take(PageSize + 1).Select(row => new
            {
                row.Id, row.ScreeningId, row.FilmId, row.FilmTitle, row.TheaterName, row.TheaterCity,
                row.TicketingUrl, row.StartsAt, row.FoundAt, row.IsRead
            }).ToArrayAsync(ct);
            return Results.Ok(new { items = page.Take(PageSize), unread, nextBefore = page.Length > PageSize ? page[PageSize - 1].Id : (long?)null });
        });
        inbox.MapGet("/unread", async (HttpContext context, UserManager<AppUser> users, AppDbContext db, CancellationToken ct) =>
        {
            var owner = users.GetUserId(context.User);
            var unread = await db.ScreeningNotifications.CountAsync(row => row.UserId == owner && !row.IsRead, ct);
            return Results.Ok(new { unread });
        });
        inbox.MapPost("/read", async (MarkNotificationsRead request, HttpContext context, UserManager<AppUser> users, AppDbContext db, CancellationToken ct) =>
        {
            if (request.Through <= 0) return Results.BadRequest(new { error = "Invalid notification cursor." });
            var owner = users.GetUserId(context.User);
            await db.ScreeningNotifications.Where(row => row.UserId == owner && !row.IsRead && row.Id <= request.Through)
                .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.IsRead, true), ct);
            return Results.NoContent();
        });
    }

    internal sealed record MarkNotificationsRead(long Through);
}
