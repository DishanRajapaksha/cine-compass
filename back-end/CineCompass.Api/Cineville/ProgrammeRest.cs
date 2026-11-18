using System.Globalization;
using Microsoft.AspNetCore.Mvc;

namespace CineCompass.Api.Cineville;

internal static class ProgrammeRest
{
    public static void MapCineville(this WebApplication app)
    {
        var group = app.MapGroup("/api/cineville").AddEndpointFilter(async (context, next) =>
        {
            try { return await next(context); }
            catch (ProgrammeInputException error) { return Results.Problem(error.Message, statusCode: 400); }
            catch (CinevilleUpstreamException error)
            {
                app.Logger.LogWarning(error, "Cineville upstream request failed");
                return Results.Problem(error.Message, statusCode: 502);
            }
        });

        group.MapGet("/cinemas", async (string? city, CinevilleProgramme programme, CancellationToken ct) =>
            (await programme.Cinemas(city, ct)).GroupBy(c => c.City, StringComparer.OrdinalIgnoreCase)
                .Select(c => new City(c.Key, c.ToArray())).ToArray());

        group.MapGet("/screenings", async ([AsParameters] ScreeningQuery args, bool? includePosterless,
            string? query, CinevilleProgramme programme, CancellationToken ct) =>
        {
            Movie[] movies = [];
            if (query is null || !string.IsNullOrWhiteSpace(query))
                movies = GroupMovies(await programme.Screenings(args.ToFilter(), ct))
                    .Where(m => (includePosterless == true || m.PosterPath.Length > 0) &&
                        (query is null || m.Title.Contains(query.Trim(), StringComparison.OrdinalIgnoreCase))).ToArray();
            return new { page = 1, results = movies, total_pages = 1, total_results = movies.Length };
        });

        group.MapGet("/films/{id}/showtimes", async (string id, [AsParameters] ScreeningQuery args,
            CinevilleProgramme programme, CancellationToken ct) =>
        {
            var movie = GroupMovies(await programme.Screenings(args.ToFilter(), ct, filmId: id, upcomingOnly: true))
                .FirstOrDefault();
            return movie is null ? Results.Text("null", "application/json") : Results.Ok(movie);
        });

        group.MapGet("/films/search", async (string? q, string? cursor, CinevilleProgramme programme, CancellationToken ct) =>
        {
            var page = await programme.SearchCatalogue(q, cursor, ct);
            return new { results = page.Films.Select(f => AsMovie(f, [], catalogue: true)).ToArray(), page.NextCursor };
        });

        group.MapGet("/now-showing", async (string? city, CinevilleProgramme programme, CancellationToken ct) =>
            (await programme.NowShowing(city, ct)).Select(f => AsMovie(f, [], catalogue: true)).ToArray());

        group.MapGet("/upcoming-films", async (CinevilleProgramme programme, CancellationToken ct) =>
            (await programme.Upcoming(ct)).Select(f => AsMovie(f, [], catalogue: true)).ToArray());

        group.MapGet("/specials", async ([AsParameters] ScreeningQuery args, CinevilleProgramme programme, CancellationToken ct) =>
            new { specials = (await programme.Screenings(args.ToFilter(), ct, includeNonFilm: true))
                .SelectMany(s => s.Categories).Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToArray() });
    }

    private static IEnumerable<Movie> GroupMovies(IEnumerable<Screening> screenings) =>
        screenings.Where(s => s.Film is not null).GroupBy(s => s.Film!.Id)
            .Select(s => AsMovie(s.First().Film!, s.Select(x => x.Showtime).ToArray(), catalogue: false));

    private static Movie AsMovie(Film f, Showtime[] showtimes, bool catalogue) =>
        new(f.Id, f.Title, f.PosterUrl, f.PremiereDate ?? (catalogue || f.ReleaseYear <= 0
            ? "" : f.ReleaseYear.ToString("D4", CultureInfo.InvariantCulture) + "-01-01"), f.Overview, f.OverviewLanguage,
            f.Duration, f.Directors, f.Cast, f.ReleaseYear, f.SpokenLanguages,
            Unique(showtimes.Select(s => s.Subtitles)), Unique(showtimes.Select(s => s.LanguageVersion)),
            Unique(showtimes.Select(s => s.Specials)), showtimes, f.CreatedAt);

    private static string[] Unique(IEnumerable<string?> items) =>
        items.OfType<string>().Where(s => s.Length > 0).Distinct(StringComparer.Ordinal).ToArray();
}

internal sealed class ScreeningQuery
{
    [FromQuery] public string? City { get; init; }
    [FromQuery] public string[]? Cinema { get; init; }
    [FromQuery] public string[]? Language { get; init; }
    [FromQuery] public string[]? Subtitle { get; init; }
    [FromQuery] public string[]? Special { get; init; }
    [FromQuery] public string? StartDate { get; init; }
    [FromQuery] public string? EndDate { get; init; }
    [FromQuery] public string? StartTime { get; init; }
    [FromQuery] public string? EndTime { get; init; }

    public ProgrammeFilter ToFilter() => new(City, Cinema, Language, Subtitle, Special, StartDate, EndDate, StartTime, EndTime);
}
