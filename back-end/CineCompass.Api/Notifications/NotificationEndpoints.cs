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
            var unread = await CountUnreadAlerts(rows, ct);
            var alerts = rows.GroupBy(row => row.FoundAt)
                .Select(group => new { FoundAt = group.Key, LastId = group.Max(row => row.Id) });
            if (before is { } cursor) alerts = alerts.Where(alert => alert.LastId < cursor);
            var page = await alerts.OrderByDescending(alert => alert.LastId).Take(PageSize + 1).ToArrayAsync(ct);
            // Keep a check's showtimes together even when it found more than one page of screenings.
            var foundTimes = page.Take(PageSize).Select(alert => alert.FoundAt).ToArray();
            var items = await rows.Where(row => foundTimes.Contains(row.FoundAt)).OrderByDescending(row => row.Id).Select(row => new
            {
                row.Id, row.ScreeningId, row.FilmId, row.FilmTitle, row.TheaterName, row.TheaterCity,
                row.TicketingUrl, row.StartsAt, row.FoundAt, row.IsRead, row.AudioLanguages, row.AudioSource,
                row.LanguageVersion, row.SubtitleLanguages, row.SubtitleStatus
            }).ToArrayAsync(ct);
            return Results.Ok(new { items, unread, nextBefore = page.Length > PageSize ? page[PageSize - 1].LastId : (long?)null });
        });
        inbox.MapGet("/unread", async (HttpContext context, UserManager<AppUser> users, AppDbContext db, CancellationToken ct) =>
        {
            var owner = users.GetUserId(context.User);
            var unread = await CountUnreadAlerts(db.ScreeningNotifications.Where(row => row.UserId == owner), ct);
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

    private static Task<int> CountUnreadAlerts(IQueryable<ScreeningNotification> rows, CancellationToken ct) =>
        rows.Where(row => !row.IsRead).Select(row => row.FoundAt).Distinct().CountAsync(ct);

    internal sealed record MarkNotificationsRead(long Through);
}
