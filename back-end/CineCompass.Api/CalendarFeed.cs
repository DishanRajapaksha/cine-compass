using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace CineCompass.Api;

public record CalendarSubscriptionRequest(int? ReminderMinutes);
public static class CalendarFeed
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly int[] ReminderOptions = [15, 30, 60, 1440];
    private static IDataProtector Protector(IDataProtectionProvider provider) => provider.CreateProtector("CineCompass.CalendarSubscription.v1");
    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    private static object Status(CalendarSubscription? row, string origin, IDataProtectionProvider provider) => new {
        enabled = row is not null,
        url = row is null ? null : $"{origin}/api/calendar/feed/{Protector(provider).Unprotect(row.ProtectedToken)}.ics",
        reminderMinutes = row?.ReminderMinutes
    };
    public static void MapCalendarFeed(this WebApplication app, string origin)
    {
        var management = app.MapGroup("/api/calendar/subscription").RequireAuthorization();
        management.MapGet("", async (HttpContext c, UserManager<AppUser> users, AppDbContext db, IDataProtectionProvider provider) =>
            Results.Ok(Status(await db.CalendarSubscriptions.FindAsync(users.GetUserId(c.User)), origin, provider)));
        management.MapPost("", async (CalendarSubscriptionRequest request, HttpContext c, UserManager<AppUser> users, AppDbContext db, IDataProtectionProvider provider) => {
            if (request.ReminderMinutes is int minutes && !ReminderOptions.Contains(minutes)) return Results.BadRequest(new { error = "Choose a valid calendar reminder." });
            var userId = users.GetUserId(c.User)!;
            var row = await db.CalendarSubscriptions.FindAsync(userId);
            if (row is null) {
                var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
                row = new CalendarSubscription { UserId = userId, TokenHash = Hash(token), ProtectedToken = Protector(provider).Protect(token), CreatedAt = DateTimeOffset.UtcNow };
                db.CalendarSubscriptions.Add(row);
            }
            row.ReminderMinutes = request.ReminderMinutes;
            row.Revision++;
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateException) { return Results.Conflict(new { error = "Calendar settings changed. Reload and try again." }); }
            return Results.Ok(Status(row, origin, provider));
        });
        management.MapDelete("", async (HttpContext c, UserManager<AppUser> users, AppDbContext db) => {
            var row = await db.CalendarSubscriptions.FindAsync(users.GetUserId(c.User));
            if (row is not null) { db.CalendarSubscriptions.Remove(row); await db.SaveChangesAsync(); }
            return Results.NoContent();
        });
        // Calendar clients cannot use the user's browser cookie. The unguessable,
        // revocable token grants read-only access to this feed and nothing else.
        app.MapMethods("/api/calendar/feed/{token}.ics", ["GET", "HEAD"], async (string token, HttpContext c, AppDbContext db) => {
            c.Response.Headers["Referrer-Policy"] = "no-referrer";
            c.Response.Headers["X-Content-Type-Options"] = "nosniff";
            if (!Regex.IsMatch(token, "^[A-Za-z0-9_-]{43}$")) return Results.NotFound();
            var hash = Hash(token);
            var subscription = await db.CalendarSubscriptions.AsNoTracking().SingleOrDefaultAsync(s => s.TokenHash == hash);
            if (subscription is null) return Results.NotFound();
            var settings = await db.Settings.AsNoTracking().SingleOrDefaultAsync(s => s.UserId == subscription.UserId);
            var content = Render(subscription, settings);
            c.Response.Headers.ContentDisposition = "inline; filename=\"cinecompass.ics\"";
            return Results.Text(content, "text/calendar; charset=utf-8", Encoding.UTF8);
        });
    }
    public static string Render(CalendarSubscription subscription, UserSettings? settings)
    {
        var lines = new List<string> { "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cine Compass//Saved screenings//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:CineCompass screenings", "X-WR-TIMEZONE:Europe/Amsterdam", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H" };
        var screenings = new List<FeedScreening>();
        try {
            using var json = JsonDocument.Parse(settings?.Json ?? "{}");
            if (json.RootElement.TryGetProperty("cineville_saved_showtimes", out var value) && value.ValueKind == JsonValueKind.String)
                screenings = JsonSerializer.Deserialize<List<FeedScreening>>(value.GetString()!, JsonOptions) ?? [];
        } catch (JsonException) { /* Invalid saved data should still produce a valid empty calendar. */ }
        foreach (var s in screenings.Where(s => s is not null).DistinctBy(s => s.ShowtimeId).OrderBy(s => s.StartDate)) {
            if (string.IsNullOrWhiteSpace(s.ShowtimeId) || string.IsNullOrWhiteSpace(s.MovieTitle) || !Date(s.StartDate, out var start) || !Date(s.EndDate, out var end) || end <= start) continue;
            var tickets = Uri.TryCreate(s.TicketingUrl, UriKind.Absolute, out var url) && (url.Scheme == "https" || url.Scheme == "http") && !s.TicketingUrl!.Any(char.IsControl) ? s.TicketingUrl : null;
            var location = string.Join(", ", new[] { s.TheaterName, s.TheaterCity }.Where(v => !string.IsNullOrWhiteSpace(v)));
            lines.AddRange(["BEGIN:VEVENT", $"UID:{Hash(subscription.UserId + ":" + s.ShowtimeId)}@cinecompass", $"DTSTAMP:{Timestamp(subscription.CreatedAt)}", $"SEQUENCE:{(settings?.Revision ?? 0) + subscription.Revision}", $"DTSTART:{Timestamp(start)}", $"DTEND:{Timestamp(end)}", $"SUMMARY:{Text(s.MovieTitle)}", $"LOCATION:{Text(location)}", $"DESCRIPTION:{Text($"Cinema screening: {s.MovieTitle}\n{location}" + (tickets is null ? "" : $"\nTickets: {tickets}"))}", "TRANSP:TRANSPARENT"]);
            if (tickets is not null) lines.Add($"URL:{tickets}");
            if (subscription.ReminderMinutes is int reminder) lines.AddRange(["BEGIN:VALARM", $"TRIGGER:-PT{reminder}M", "ACTION:DISPLAY", $"DESCRIPTION:{Text(s.MovieTitle)}", "END:VALARM"]);
            lines.Add("END:VEVENT");
        }
        lines.Add("END:VCALENDAR");
        return string.Join("\r\n", lines.Select(Fold)) + "\r\n";
    }
    private static bool Date(string? text, out DateTimeOffset value)
    {
        value = default;
        return text is not null && Regex.IsMatch(text, @"(?:Z|[+-]\d{2}:\d{2})$", RegexOptions.IgnoreCase) && DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out value);
    }
    private static string Timestamp(DateTimeOffset date) => date.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
    private static string Text(string value) => value.Replace("\\", "\\\\").Replace("\r\n", "\\n").Replace("\r", "\\n").Replace("\n", "\\n").Replace(";", "\\;").Replace(",", "\\,");
    private static string Fold(string value)
    {
        var result = new StringBuilder(); var bytes = 0;
        foreach (var rune in value.EnumerateRunes()) {
            if (bytes + rune.Utf8SequenceLength > 75) { result.Append("\r\n "); bytes = 1; }
            result.Append(rune.ToString()); bytes += rune.Utf8SequenceLength;
        }
        return result.ToString();
    }
    private sealed record FeedScreening(string? ShowtimeId, string? MovieTitle, string? StartDate, string? EndDate, string? TheaterName, string? TheaterCity, string? TicketingUrl);
}
