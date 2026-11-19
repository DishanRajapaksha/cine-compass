using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol;

namespace CineCompass.Api.Cineville;

internal static class AccountMovieLists
{
    public static AccountMovie[] Read(string? json, string id)
    {
        var lists = MovieListSettings.Read(MovieListSettings.Parse(json));
        var movies = MovieListSettings.Films(lists, id).Select(Movie).ToArray();
        if (id != MovieListSettings.WatchlistId) return movies;

        var watched = MovieListSettings.Films(lists, MovieListSettings.WatchedId).Select(Movie);
        return new WatchedMovieMatcher(watched).Visible(movies);
    }

    public static async Task<MovieListChange> Add(AppDbContext db, string owner, string id, Film film, CancellationToken ct)
    {
        var movie = new AccountMovie(film.Id, film.Title, film.ReleaseYear > 0 ? film.ReleaseYear : null, film.PosterUrl);
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var row = await db.Settings.FindAsync([owner], ct);
            var settings = MovieListSettings.Parse(row?.Json);
            var lists = MovieListSettings.Read(settings);
            var films = MovieListSettings.Films(lists, id);
            if (films.Select(Movie).Any(existing => WatchedMovieMatcher.Id(existing.Id) == WatchedMovieMatcher.Id(movie.Id)))
                return new(movie, Changed: false);

            films.Add(MovieNode(movie, film));
            MovieListSettings.Save(settings, lists);
            var updated = MovieListSettings.Serialize(settings);
            if (updated.Length > UserSettings.MaxLength)
                throw new McpException("This change would exceed the CineCompass account settings limit.");

            var inserting = row is null;
            if (inserting) { row = new() { UserId = owner }; db.Settings.Add(row); }
            row!.Json = updated;
            row.Revision++;
            try
            {
                await db.SaveChangesAsync(ct);
                return new(movie, Changed: true);
            }
            catch (DbUpdateException error) when (inserting || error is DbUpdateConcurrencyException)
            {
                // Reapply the addition to the latest settings after a concurrent web or MCP save.
                db.Entry(row).State = EntityState.Detached;
            }
        }
        throw new McpException("CineCompass settings could not be saved. Try again.");
    }

    internal static AccountMovie Movie(JsonNode? entry) => new(entry!["id"]!.GetValue<string>(), entry["title"]!.GetValue<string>(),
        entry["year"] is JsonValue year && year.TryGetValue<int>(out var number) ? number : null,
        MovieListSettings.Text(entry["posterPath"]));

    private static JsonObject MovieNode(AccountMovie movie, Film film)
    {
        var entry = new JsonObject { ["id"] = movie.Id, ["title"] = movie.Title, ["posterPath"] = film.PosterUrl };
        if (movie.Year is { } year) entry["year"] = year;
        if (film.Duration > 0) entry["duration"] = film.Duration;
        if (film.PremiereDate is { } date) entry["releaseDate"] = date;
        if (film.CreatedAt is { } created) entry["createdAt"] = created;
        if (film.Overview.Length > 0) entry["overview"] = film.Overview;
        if (film.OverviewLanguage is { } language) entry["overviewLanguage"] = language;
        if (film.Directors.Length > 0) entry["directors"] = JsonSerializer.SerializeToNode(film.Directors);
        if (film.Cast.Length > 0) entry["cast"] = JsonSerializer.SerializeToNode(film.Cast);
        if (film.SpokenLanguages.Length > 0) entry["spokenLanguages"] = JsonSerializer.SerializeToNode(film.SpokenLanguages);
        return entry;
    }
}
