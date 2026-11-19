using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace CineCompass.Api.Cineville;

internal static class MovieListSettings
{
    public const string Key = "cinecompass_movie_lists";
    public const string WatchlistId = "watchlist";
    public const string WatchedId = "watched";
    public const string LegacyWatchlist = "cinecompass_saved_films";
    public const string LegacyWatched = "cinecompass_watched_movies";
    public const string LegacyHidden = "cinecompass_hidden_movies";
    private const string SavedShowtimes = "cineville_saved_showtimes";
    private static readonly JsonSerializerOptions StorageJson = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static string Serialize(JsonNode value) => value.ToJsonString(StorageJson);

    public static JsonObject Parse(string? json)
    {
        var settings = json is null ? new JsonObject() : JsonNode.Parse(json)!.AsObject();
        Normalize(settings, previous: null);
        return settings;
    }

    public static string? NormalizeRequest(JsonElement values, string? previous)
    {
        try
        {
            var settings = JsonNode.Parse(values.GetRawText())!.AsObject();
            if (settings.ContainsKey(Key) && !ValidLists(Array(settings[Key]))) return null;
            Normalize(settings, previous);
            var serialized = Serialize(settings);
            return serialized.Length <= UserSettings.MaxLength ? serialized : null;
        }
        catch (ArgumentException)
        {
            // JsonObject rejects duplicate property names when its properties are accessed.
            return null;
        }
    }

    private static void Normalize(JsonObject settings, string? previous)
    {
        var hasLegacy = settings.ContainsKey(LegacyWatchlist) || settings.ContainsKey(LegacyWatched) || settings.ContainsKey(LegacyHidden);
        var hasLists = settings.ContainsKey(Key);
        // An older web client can update the built-ins without removing custom lists.
        var prior = !hasLists && previous is not null ? Array(Parse(previous)[Key]) : null;
        if (!hasLists && !hasLegacy && prior is null && !settings.ContainsKey(SavedShowtimes)) return;

        var lists = Array(settings[Key]) ?? prior ?? new JsonArray();
        var watchlist = Find(lists, WatchlistId)?.DeepClone().AsObject() ?? NewList(WatchlistId, "Watchlist");
        var watched = Find(lists, WatchedId)?.DeepClone().AsObject() ?? NewList(WatchedId, "Watched");
        if (!hasLists)
        {
            if (settings.ContainsKey(LegacyWatchlist)) watchlist["films"] = LegacyFilms(settings[LegacyWatchlist]);
            else if (prior is null) watchlist["films"] = FilmsFromShowtimes(settings[SavedShowtimes]);

            if (settings.ContainsKey(LegacyWatched) || settings.ContainsKey(LegacyHidden))
                watched["films"] = LegacyFilms(settings[LegacyWatched] ?? settings[LegacyHidden]);
        }
        watchlist["name"] = "Watchlist";
        watched["name"] = "Watched";
        watchlist.Remove("hideWatched");
        watched.Remove("hideWatched");
        var normalized = new JsonArray(watchlist, watched);
        foreach (var list in lists.OfType<JsonObject>().Where(list => Text(list["id"]) is not (WatchlistId or WatchedId)))
            normalized.Add(list.DeepClone());
        Save(settings, normalized);
    }

    public static JsonArray Read(JsonObject settings) =>
        Array(settings[Key]) ?? new JsonArray(NewList(WatchlistId, "Watchlist"), NewList(WatchedId, "Watched"));

    public static JsonArray Films(JsonArray lists, string id) => Find(lists, id)!["films"]!.AsArray();

    public static void Save(JsonObject settings, JsonArray lists)
    {
        settings.Remove(LegacyWatchlist);
        settings.Remove(LegacyWatched);
        settings.Remove(LegacyHidden);
        settings[Key] = Serialize(lists);
    }

    private static JsonObject NewList(string id, string name) => new() { ["id"] = id, ["name"] = name, ["films"] = new JsonArray() };
    private static JsonObject? Find(JsonArray lists, string id) => lists.OfType<JsonObject>().FirstOrDefault(list => Text(list["id"]) == id);

    private static JsonArray LegacyFilms(JsonNode? value) => UniqueFilms((Array(value) ?? []).OfType<JsonObject>()
        .Where(film => Text(film["id"]) is not null && Text(film["title"]) is not null)
        .Select(film =>
        {
            var copy = film.DeepClone().AsObject();
            copy["posterPath"] = Text(copy["posterPath"]) ?? "";
            return copy;
        }));

    private static JsonArray FilmsFromShowtimes(JsonNode? value) => UniqueFilms((Array(value) ?? []).OfType<JsonObject>()
        .Where(entry => Text(entry["movieId"]) is not null && Text(entry["movieTitle"]) is not null)
        .Select(entry => new JsonObject
        {
            ["id"] = Text(entry["movieId"]), ["title"] = Text(entry["movieTitle"]), ["posterPath"] = Text(entry["posterPath"]) ?? ""
        }));

    private static JsonArray UniqueFilms(IEnumerable<JsonObject> films) =>
        new(films.GroupBy(film => Text(film["id"])).Select(group => group.Last()).ToArray<JsonNode?>());

    private static JsonArray? Array(JsonNode? node)
    {
        try { return Text(node) is { } text ? JsonNode.Parse(text) as JsonArray : null; }
        catch (JsonException) { return null; }
    }

    private static bool ValidLists(JsonArray? lists)
    {
        if (lists is null) return false;
        var listIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var node in lists)
        {
            if (node is not JsonObject list || Text(list["id"]) is not { Length: > 0 } id || !listIds.Add(id) ||
                string.IsNullOrWhiteSpace(Text(list["name"])) || list["films"] is not JsonArray films) return false;
            if (list.ContainsKey("hideWatched") &&
                (list["hideWatched"] is not JsonValue hideWatched || !hideWatched.TryGetValue<bool>(out _))) return false;
            var filmIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (var entry in films)
            {
                if (entry is not JsonObject film || Text(film["id"]) is not { Length: > 0 } filmId ||
                    !filmIds.Add(filmId) || Text(film["title"]) is null || Text(film["posterPath"]) is null ||
                    !ValidMetadata(film)) return false;
            }
        }
        return true;
    }

    private static bool ValidMetadata(JsonObject film) =>
        new[] { "year", "duration" }.All(key => film[key] is null || film[key] is JsonValue number && number.TryGetValue<int>(out _)) &&
        new[] { "releaseDate", "overview", "overviewLanguage", "createdAt" }.All(key => film[key] is null || Text(film[key]) is not null) &&
        new[] { "directors", "cast", "spokenLanguages", "availableSubtitles", "availableLanguageVersions", "availableSpecials" }
            .All(key => film[key] is null || film[key] is JsonArray values && values.All(item => Text(item) is not null));

    internal static string? Text(JsonNode? value) => value is JsonValue scalar && scalar.TryGetValue<string>(out var text) ? text : null;
}
