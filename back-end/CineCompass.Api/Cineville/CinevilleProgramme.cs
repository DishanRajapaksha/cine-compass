using System.Globalization;

namespace CineCompass.Api.Cineville;

internal sealed partial class CinevilleProgramme(CinevilleClient client, TimeProvider clock)
{
    private static readonly StringComparer Names = StringComparer.OrdinalIgnoreCase;
    private static readonly object SearchPage = new { limit = 100 };
    private static readonly object Visible = new { eq = false };

    public async Task<Cinema[]> Cinemas(string? city, CancellationToken ct) =>
        (await client.Venues(ct)).Select(CinevilleMapping.Cinema).OfType<Cinema>()
            .Where(c => string.IsNullOrWhiteSpace(city) || Names.Equals(city.Trim(), c.City))
            .OrderBy(c => c.City, Names).ThenBy(c => c.Name, Names).ThenBy(c => c.Id, StringComparer.Ordinal).ToArray();

    public async Task<Screening[]> Screenings(ProgrammeFilter filter, CancellationToken ct,
        string? filmId = null, bool upcomingOnly = false, bool includeNonFilm = false) =>
        (await ScreeningCandidates(filter, ct, filmId, upcomingOnly, includeNonFilm)).Screenings
            .Where(s => ScreeningLanguage.Matches(filter.Languages, s.Film?.SpokenLanguages ?? []) &&
                ScreeningLanguage.Matches(filter.Subtitles, s.SubtitleLanguages) &&
                (filter.Specials is not { Length: > 0 } ||
                    filter.Specials.Any(v => s.Categories.Contains(v.Trim(), Names)))).ToArray();

    public async Task<ScreeningBatch> ScreeningCandidates(ProgrammeFilter filter, CancellationToken ct,
        string? filmId = null, bool upcomingOnly = false, bool includeNonFilm = false)
    {
        var now = clock.GetUtcNow();
        var (start, end) = ProgrammeDates.Range(filter, now, upcomingOnly, openEnded: filmId is not null);
        var effectiveStart = upcomingOnly || (filter.StartDate is null && filter.StartTime is null)
            ? (start > now ? start : now) : start;

        var (venues, venueIssue) = await ResolveVenues(filter, ct);
        if (venues.Length == 0 || end <= effectiveStart)
            return new([], effectiveStart, end, venueIssue ?? "no_screenings");

        var dates = new Dictionary<string, DateTime> { ["gte"] = start.UtcDateTime };
        if (end is { } upper) dates["lt"] = upper.UtcDateTime;
        var body = new Dictionary<string, object>
        {
            ["startDate"] = dates, ["isHidden"] = Visible, ["venueId"] = new { @in = venues },
            ["embed"] = new { production = true, venue = true },
            ["sort"] = new { startDate = "asc" }, ["page"] = SearchPage
        };
        if (filmId is not null) body["productionId"] = new { eq = filmId };
        else if (!includeNonFilm) body["productionId"] = new { isNull = false };

        var venueSet = venues.ToHashSet(StringComparer.Ordinal);
        var screenings = (await client.Events(body, ct)).Select(CinevilleMapping.Screening).OfType<Screening>()
            .Where(s => venueSet.Contains(s.Showtime.TheaterId) &&
                s.Showtime.StartDate >= effectiveStart && (end is null || s.Showtime.StartDate < end))
            .Where(s => (includeNonFilm || s.Film is not null) && (filmId is null || s.Film?.Id == filmId))
            .OrderBy(s => s.Showtime.StartDate).ThenBy(s => s.Showtime.Id, StringComparer.Ordinal).ToArray();
        return new(screenings, effectiveStart, end, screenings.Length == 0 ? "no_screenings" : null);
    }

    public async Task<Film[]> NowShowing(string? city, CancellationToken ct)
    {
        var start = ProgrammeDates.Minute(clock.GetUtcNow());
        var (venues, _) = await ResolveVenues(new(City: city), ct);
        if (venues.Length == 0) return [];
        var body = new
        {
            @event = new
            {
                isHidden = Visible,
                startDate = new { gte = start.UtcDateTime, lt = start.AddDays(7).UtcDateTime },
                venueId = new { @in = venues }
            },
            sort = new { title = "asc" }, page = SearchPage
        };
        return (await client.Productions(body, ct)).Select(CinevilleMapping.Film).OfType<Film>()
            .OrderBy(f => f.Title, Names).ThenBy(f => f.Id, StringComparer.Ordinal).ToArray();
    }

    public async Task<Film[]> Upcoming(CancellationToken ct)
    {
        var today = ProgrammeDates.Today(clock.GetUtcNow());
        var body = new
        {
            premiereDate = new { isNull = false, gt = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) },
            sort = new { premiereDate = "asc" }, page = SearchPage
        };
        return (await client.Productions(body, ct)).Select(CinevilleMapping.Film).OfType<Film>()
            .Where(f => ProgrammeDates.TryDate(f.PremiereDate, out var date) && date > today)
            .OrderBy(f => f.PremiereDate, StringComparer.Ordinal).ThenBy(f => f.Title, Names)
            .ThenBy(f => f.Id, StringComparer.Ordinal).ToArray();
    }

    private async Task<(string[] Ids, string? EmptyReason)> ResolveVenues(ProgrammeFilter filter, CancellationToken ct)
    {
        var all = await Cinemas(null, ct);
        var local = all.Where(c => string.IsNullOrWhiteSpace(filter.City) || Names.Equals(filter.City.Trim(), c.City)).ToArray();
        if (local.Length == 0 && !string.IsNullOrWhiteSpace(filter.City)) return ([], "unknown_city");
        if (filter.Cinemas is { Length: > 0 } cinemas)
        {
            bool Selected(Cinema c) => cinemas.Any(name => Names.Equals(name?.Trim(), c.Name) || Names.Equals(name?.Trim(), c.Id));
            local = local.Where(Selected).ToArray();
            if (local.Length == 0) return ([], all.Any(Selected) ? "cinema_outside_city" : "unknown_cinema");
        }
        return (local.Select(c => c.Id).Order(StringComparer.Ordinal).ToArray(), null);
    }
}
