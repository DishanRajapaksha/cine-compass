using System.Globalization;

namespace CineCompass.Api.Cineville;

internal sealed class CinevilleProgramme(CinevilleClient client, TimeProvider clock)
{
    private static readonly StringComparer Names = StringComparer.OrdinalIgnoreCase;
    private static readonly object SearchPage = new { limit = 100 };
    private static readonly object Visible = new { eq = false };

    public async Task<Cinema[]> Cinemas(string? city, CancellationToken ct) =>
        (await client.Venues(ct)).Select(CinevilleMapping.Cinema).OfType<Cinema>()
            .Where(c => string.IsNullOrWhiteSpace(city) || Names.Equals(city.Trim(), c.City))
            .OrderBy(c => c.City, Names).ThenBy(c => c.Name, Names).ThenBy(c => c.Id, StringComparer.Ordinal).ToArray();

    public async Task<Screening[]> Screenings(ProgrammeFilter filter, CancellationToken ct,
        string? filmId = null, bool upcomingOnly = false, bool includeNonFilm = false)
    {
        var now = clock.GetUtcNow();
        var (start, end) = ProgrammeDates.Range(filter, now, upcomingOnly, openEnded: filmId is not null);
        if (end <= start) return [];

        var venues = await VenueIds(filter, ct);
        if (venues.Length == 0) return [];
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

        var effectiveStart = upcomingOnly || (filter.StartDate is null && filter.StartTime is null)
            ? (start > now ? start : now) : start;
        return (await client.Events(body, ct)).Select(CinevilleMapping.Screening).OfType<Screening>()
            .Where(s => s.Showtime.StartDate >= effectiveStart && (end is null || s.Showtime.StartDate < end))
            .Where(s => (includeNonFilm || s.Film is not null) && (filmId is null || s.Film?.Id == filmId))
            .Where(s => Matches(s, filter))
            .OrderBy(s => s.Showtime.StartDate).ThenBy(s => s.Showtime.Id, StringComparer.Ordinal).ToArray();
    }

    public async Task<Film[]> NowShowing(string? city, CancellationToken ct)
    {
        var start = ProgrammeDates.Minute(clock.GetUtcNow());
        var venues = await VenueIds(new(City: city), ct);
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

    private async Task<string[]> VenueIds(ProgrammeFilter filter, CancellationToken ct) =>
        (await Cinemas(filter.City, ct))
            .Where(c => filter.Cinemas is not { Length: > 0 } ||
                filter.Cinemas.Any(name => Names.Equals(name?.Trim(), c.Name) || Names.Equals(name?.Trim(), c.Id)))
            .Select(c => c.Id).Order(StringComparer.Ordinal).ToArray();

    private static bool Matches(Screening s, ProgrammeFilter filter) =>
        MatchesAny(filter.Languages, s.Film?.SpokenLanguages ?? [], Language) &&
        MatchesAny(filter.Subtitles, s.SubtitleLanguages, Language) &&
        MatchesAny(filter.Specials, s.Categories, value => value.Trim());

    private static bool MatchesAny(string[]? values, string[] available, Func<string, string> normalize) =>
        values is not { Length: > 0 } ||
        values.Any(value => !string.IsNullOrWhiteSpace(value) && available.Any(x => Names.Equals(normalize(value), normalize(x))));

    private static string Language(string value) => value.Trim().Split('-', '_')[0].ToLowerInvariant() switch
    {
        "english" or "engels" or "eng" => "en",
        "dutch" or "nederlands" or "dut" or "nld" => "nl",
        var code => code
    };
}
