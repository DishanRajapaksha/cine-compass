using System.Text.Json;
using System.Text.Json.Nodes;
using CineCompass.Api.Cineville;

namespace CineCompass.Api.Notifications;

internal sealed record ReminderSettings(int LookAheadDays, HashSet<string> FilmIds, HashSet<string> ListIds)
{
    public const string Key = "cinecompass_screening_reminders";
    public const int MaximumDays = 365;

    public static ReminderSettings? Parse(string? json)
    {
        if (json is null) return null;
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("lookAheadDays", out var horizon) || horizon.ValueKind != JsonValueKind.Number ||
                !horizon.TryGetInt32(out var days) || days is < 1 or > MaximumDays ||
                !ReadIds(root, "filmIds", out var films) || !ReadIds(root, "listIds", out var lists)) return null;
            return new(days, films, lists);
        }
        catch (JsonException) { return null; }
    }

    private static bool ReadIds(JsonElement root, string name, out HashSet<string> ids)
    {
        ids = new(StringComparer.Ordinal);
        if (!root.TryGetProperty(name, out var list) || list.ValueKind != JsonValueKind.Array) return false;
        foreach (var item in list.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String || item.GetString() is not { Length: > 0 and <= 128 } id ||
                id != id.Trim() || !ids.Add(id)) return false;
        }
        return true;
    }

    public HashSet<string> IncludedFilms(JsonObject settings)
    {
        var result = FilmIds.Select(WatchedMovieMatcher.Id).ToHashSet(StringComparer.Ordinal);
        if (ListIds.Count == 0) return result;
        var lists = MovieListSettings.Read(settings);
        var watched = MovieListSettings.Films(lists, MovieListSettings.WatchedId).Select(AccountMovieLists.Movie);
        var matcher = new WatchedMovieMatcher(watched);
        foreach (var list in lists.OfType<JsonObject>())
        {
            if (MovieListSettings.Text(list["id"]) is not { } id || !ListIds.Contains(id)) continue;
            var films = MovieListSettings.Films(lists, id).Select(AccountMovieLists.Movie).ToArray();
            if (id == MovieListSettings.WatchlistId || list["hideWatched"]?.GetValue<bool>() == true)
                films = matcher.Visible(films);
            result.UnionWith(films.Select(film => WatchedMovieMatcher.Id(film.Id)));
        }
        return result;
    }
}
