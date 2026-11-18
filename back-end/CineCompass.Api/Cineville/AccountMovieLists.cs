using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol;

namespace CineCompass.Api.Cineville;

internal static class AccountMovieLists
{
    public const string WatchedMovies = "cinecompass_watched_movies";
    public const string LegacyWatchedMovies = "cinecompass_hidden_movies";
    public const string Watchlist = "cinecompass_saved_films";
    private const string SavedShowtimes = "cineville_saved_showtimes";
    // Stored as JSON data. Preserve Unicode in both the settings and the nested list strings.
    private static readonly JsonSerializerOptions StorageJson = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static AccountMovie[] Read(string? json, string key)
    {
        var settings = ParseSettings(json);
        var movies = Films(settings, key).Select(Movie).ToArray();
        if (key == WatchedMovies) return movies;

        var watched = ReadList(settings, WatchedMovies).Select(Movie);
        return new WatchedMovieMatcher(watched).Visible(movies);
    }

    public static async Task<MovieListChange> Add(AppDbContext db, string owner, string key, Film film, CancellationToken ct)
    {
        var movie = new AccountMovie(film.Id, film.Title, film.ReleaseYear > 0 ? film.ReleaseYear : null,
            key == Watchlist ? film.PosterUrl : null);
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var row = await db.Settings.FindAsync([owner], ct);
            var settings = ParseSettings(row?.Json);
            var films = Films(settings, key);
            if (films.Select(Movie).Any(existing => WatchedMovieMatcher.Id(existing.Id) == WatchedMovieMatcher.Id(movie.Id)))
                return new(movie, Changed: false);

            var entry = MovieNode(movie);
            if (key == Watchlist && film.Duration > 0) entry["duration"] = film.Duration;
            if (key == Watchlist && film.SpokenLanguages.Length > 0)
                entry["spokenLanguages"] = JsonSerializer.SerializeToNode(film.SpokenLanguages);
            films.Add(entry);
            settings[key] = films.ToJsonString(StorageJson);
            var updated = settings.ToJsonString(StorageJson);
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

    private static JsonArray Films(JsonObject settings, string key)
    {
        if (key != Watchlist || settings.ContainsKey(key)) return ReadList(settings, key);

        // Older accounts derive their watchlist from saved showtimes until they save a movie list.
        var legacy = ReadList(settings, SavedShowtimes).Select(s => new AccountMovie(
            RequiredText(s, "movieId"), RequiredText(s, "movieTitle"), null, s?["posterPath"]?.GetValue<string>() ?? ""));
        return new JsonArray(legacy.GroupBy(movie => movie.Id).Select(group => MovieNode(group.Last())).ToArray());
    }

    public static JsonObject ParseSettings(string? json)
    {
        if (json is null) return new();
        var settings = JsonNode.Parse(json) as JsonObject
            ?? throw new McpException("CineCompass account settings could not be read.");
        if (settings.Remove(LegacyWatchedMovies, out var legacy) && !settings.ContainsKey(WatchedMovies))
            settings[WatchedMovies] = legacy;
        return settings;
    }

    public static string NormalizeSettings(JsonElement values) =>
        values.TryGetProperty(LegacyWatchedMovies, out _)
            ? ParseSettings(values.GetRawText()).ToJsonString(StorageJson)
            : values.GetRawText();

    private static JsonArray ReadList(JsonObject settings, string key)
    {
        if (!settings.TryGetPropertyValue(key, out var value)) return [];
        try
        {
            if (value is JsonValue text && text.TryGetValue<string>(out var json) && JsonNode.Parse(json) is JsonArray list)
                return list;
        }
        catch (JsonException) { }
        throw new McpException("A saved CineCompass list could not be read. Check it in the web app.");
    }

    private static AccountMovie Movie(JsonNode? entry) => new(RequiredText(entry, "id"), RequiredText(entry, "title"),
        entry?["year"] is JsonValue year && year.TryGetValue<int>(out var number) ? number : null,
        entry?["posterPath"] is JsonValue poster && poster.TryGetValue<string>(out var path) ? path : null);

    private static string RequiredText(JsonNode? entry, string key) =>
        entry is JsonObject obj && obj[key] is JsonValue text && text.TryGetValue<string>(out var value)
            ? value : throw new McpException("A saved CineCompass list could not be read. Check it in the web app.");

    private static JsonObject MovieNode(AccountMovie movie)
    {
        var entry = new JsonObject { ["id"] = movie.Id, ["title"] = movie.Title };
        if (movie.Year is { } year) entry["year"] = year;
        if (movie.PosterPath is { } poster) entry["posterPath"] = poster;
        return entry;
    }
}
