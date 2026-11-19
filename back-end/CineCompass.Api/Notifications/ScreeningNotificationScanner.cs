using System.Globalization;
using CineCompass.Api.Cineville;
using Microsoft.EntityFrameworkCore;

namespace CineCompass.Api.Notifications;

internal sealed class ScreeningNotificationScanner(
    AppDbContext db, CinevilleProgramme programme, TimeProvider clock, ILogger<ScreeningNotificationScanner> logger)
{
    internal const int DailyHour = 8;
    private static readonly StringComparer CityNames = StringComparer.OrdinalIgnoreCase;

    public async Task CheckDue(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var local = ProgrammeDates.LocalTime(now);
        if (local.Hour < DailyHour) return;
        var today = DateOnly.FromDateTime(local.DateTime);
        var checkpoint = await db.ScreeningNotificationScans
            .SingleOrDefaultAsync(row => row.Id == ScreeningNotificationScan.DailySchedule, ct);
        if (checkpoint?.CompletedDay >= today) return;

        var audiences = await FilmAudiences(ct);
        var complete = true;
        foreach (var (filmId, audience) in audiences)
        {
            var filters = audience.Values.SelectMany(rules => rules).ToArray();
            var endDate = today.AddDays(filters.Max(rule => rule.LookAheadDays)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var cities = filters.Select(rule => rule.City).Distinct(CityNames).ToArray();
            var city = cities.Length == 1 ? cities[0] : null;
            Screening[] screenings;
            try
            {
                screenings = await programme.Screenings(new(City: city, EndDate: endDate), ct, filmId, upcomingOnly: true);
            }
            catch (CinevilleUpstreamException error) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning(error, "Cineville could not check reminders for film {FilmId}", filmId);
                complete = false;
                continue;
            }
            await StageScreenings(filmId, audience, screenings, today, now, ct);
        }
        // Commit all discoveries from this check together. A retry only alerts for IDs still unseen.
        if (complete)
        {
            if (checkpoint is null)
                db.ScreeningNotificationScans.Add(new() { Id = ScreeningNotificationScan.DailySchedule, CompletedDay = today });
            else
                checkpoint.CompletedDay = today;
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task<Dictionary<string, Dictionary<string, HashSet<ReminderFilters>>>> FilmAudiences(CancellationToken ct)
    {
        var audiences = new Dictionary<string, Dictionary<string, HashSet<ReminderFilters>>>(StringComparer.Ordinal);
        await foreach (var row in db.Settings.AsNoTracking().Select(row => new { row.UserId, row.Json }).AsAsyncEnumerable().WithCancellation(ct))
        {
            var settings = MovieListSettings.Parse(row.Json);
            var reminders = ReminderSettings.Parse(MovieListSettings.Text(settings[ReminderSettings.Key]));
            if (reminders is null) continue;
            foreach (var (filmId, filters) in reminders.FilmRules(settings))
            {
                if (!audiences.TryGetValue(filmId, out var audience))
                    audiences[filmId] = audience = new(StringComparer.Ordinal);
                if (!audience.TryGetValue(row.UserId, out var rules))
                    audience[row.UserId] = rules = [];
                rules.Add(filters);
            }
        }
        return audiences;
    }

    private async Task StageScreenings(string filmId, Dictionary<string, HashSet<ReminderFilters>> audience,
        Screening[] screenings, DateOnly today, DateTimeOffset foundAt, CancellationToken ct)
    {
        if (screenings.Length == 0) return;
        var owners = audience.Keys.ToArray();
        var screeningIds = screenings.Select(entry => entry.Showtime.Id).ToArray();
        var saved = (await db.ScreeningNotifications
            .Where(row => owners.Contains(row.UserId) && screeningIds.Contains(row.ScreeningId))
            .ToListAsync(ct)).ToDictionary(row => (row.UserId, row.ScreeningId));
        foreach (var screening in screenings)
        {
            var time = screening.Showtime;
            if (time.StartDate <= clock.GetUtcNow()) continue;
            var date = ProgrammeDates.Today(time.StartDate);
            foreach (var (owner, rules) in audience)
            {
                if (saved.TryGetValue((owner, time.Id), out var existing))
                {
                    if (existing.SubtitleStatus is null) existing.RecordLanguages(screening);
                    continue;
                }
                if (!rules.Any(rule => date <= today.AddDays(rule.LookAheadDays) &&
                    (rule.City is null || CityNames.Equals(rule.City, time.TheaterCity)) &&
                    ScreeningLanguage.Matches(screening, rule.SpokenLanguages, rule.SubtitleLanguages, rule.MatchEitherLanguage)))
                    continue;
                var notice = new ScreeningNotification
                {
                    UserId = owner, FilmId = filmId, ScreeningId = time.Id, FilmTitle = screening.Film!.Title,
                    TheaterName = time.TheaterName, TheaterCity = time.TheaterCity, TicketingUrl = time.TicketingUrl,
                    StartsAt = time.StartDate.ToUniversalTime(), FoundAt = foundAt
                };
                notice.RecordLanguages(screening);
                saved.Add((owner, time.Id), notice);
                db.ScreeningNotifications.Add(notice);
            }
        }
    }
}
