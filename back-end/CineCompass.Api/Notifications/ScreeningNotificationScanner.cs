using System.Globalization;
using CineCompass.Api.Cineville;
using Microsoft.EntityFrameworkCore;

namespace CineCompass.Api.Notifications;

internal sealed class ScreeningNotificationScanner(
    AppDbContext db, CinevilleProgramme programme, TimeProvider clock, ILogger<ScreeningNotificationScanner> logger)
{
    internal const int DailyHour = 8;

    public async Task CheckDue(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var local = ProgrammeDates.LocalTime(now);
        if (local.Hour < DailyHour) return;
        var today = DateOnly.FromDateTime(local.DateTime);
        var checkpoint = await db.ScreeningNotificationScans.AsNoTracking()
            .SingleOrDefaultAsync(row => row.Id == ScreeningNotificationScan.DailySchedule, ct);
        if (checkpoint?.CompletedDay >= today) return;

        var audiences = await FilmAudiences(today, ct);
        var complete = true;
        foreach (var (filmId, audience) in audiences)
        {
            var endDate = audience.Max(entry => entry.Value).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            Screening[] screenings;
            try
            {
                screenings = await programme.Screenings(new(EndDate: endDate), ct, filmId, upcomingOnly: true);
            }
            catch (CinevilleUpstreamException error) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning(error, "Cineville could not check reminders for film {FilmId}", filmId);
                complete = false;
                continue;
            }
            await StoreNewScreenings(filmId, audience, screenings, now, ct);
        }
        if (!complete) return; // The worker will retry. Already saved screenings are deduplicated.
        if (checkpoint is not null)
        {
            await db.ScreeningNotificationScans.Where(row => row.Id == ScreeningNotificationScan.DailySchedule && row.CompletedDay < today)
                .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.CompletedDay, today), ct);
            return;
        }
        db.ScreeningNotificationScans.Add(new() { Id = ScreeningNotificationScan.DailySchedule, CompletedDay = today });
        await db.SaveChangesAsync(ct);
    }

    private async Task<Dictionary<string, Dictionary<string, DateOnly>>> FilmAudiences(DateOnly today, CancellationToken ct)
    {
        var audiences = new Dictionary<string, Dictionary<string, DateOnly>>(StringComparer.Ordinal);
        await foreach (var row in db.Settings.AsNoTracking().Select(row => new { row.UserId, row.Json }).AsAsyncEnumerable().WithCancellation(ct))
        {
            var settings = MovieListSettings.Parse(row.Json);
            var reminders = ReminderSettings.Parse(MovieListSettings.Text(settings[ReminderSettings.Key]));
            if (reminders is null) continue;
            foreach (var filmId in reminders.IncludedFilms(settings))
            {
                if (!audiences.TryGetValue(filmId, out var audience))
                    audiences[filmId] = audience = new(StringComparer.Ordinal);
                audience[row.UserId] = today.AddDays(reminders.LookAheadDays);
            }
        }
        return audiences;
    }

    private async Task StoreNewScreenings(string filmId, Dictionary<string, DateOnly> audience,
        Screening[] screenings, DateTimeOffset foundAt, CancellationToken ct)
    {
        if (screenings.Length == 0) return;
        var owners = audience.Keys.ToArray();
        var screeningIds = screenings.Select(entry => entry.Showtime.Id).ToArray();
        var saved = (await db.ScreeningNotifications.AsNoTracking()
            .Where(row => owners.Contains(row.UserId) && screeningIds.Contains(row.ScreeningId))
            .Select(row => new { row.UserId, row.ScreeningId }).ToListAsync(ct))
            .Select(row => (row.UserId, row.ScreeningId)).ToHashSet();
        foreach (var screening in screenings)
        {
            var time = screening.Showtime;
            if (time.StartDate <= clock.GetUtcNow()) continue;
            var date = ProgrammeDates.Today(time.StartDate);
            foreach (var (owner, end) in audience)
            {
                if (date > end || !saved.Add((owner, time.Id))) continue;
                db.ScreeningNotifications.Add(new()
                {
                    UserId = owner, FilmId = filmId, ScreeningId = time.Id, FilmTitle = screening.Film!.Title,
                    TheaterName = time.TheaterName, TheaterCity = time.TheaterCity, TicketingUrl = time.TicketingUrl,
                    StartsAt = time.StartDate.ToUniversalTime(), FoundAt = foundAt
                });
            }
        }
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
    }
}
