using System.Text.Json;
using System.Text.Json.Nodes;
using CineCompass.Api.Cineville;

namespace CineCompass.Api.Notifications;

internal sealed record ReminderSettings(ReminderFilters Global, HashSet<string> FilmIds, HashSet<string> ListIds,
    Dictionary<string, ReminderFilters> FilmFilters, Dictionary<string, ReminderFilters> ListFilters)
{
    public const string Key = "cinecompass_screening_reminders";

    public static ReminderSettings? Parse(string? json)
    {
        if (json is null) return null;
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (ReminderFilters.Read(root) is not { } global ||
                !ReadIds(root, "filmIds", out var films) || !ReadIds(root, "listIds", out var lists) ||
                !ReadOverrides(root.Field("filmFilters"), out var filmFilters) ||
                !ReadOverrides(root.Field("listFilters"), out var listFilters)) return null;
            return new(global, films, lists, filmFilters, listFilters);
        }
        catch (JsonException) { return null; }
    }

    private static bool ReadIds(JsonElement root, string name, out HashSet<string> ids)
    {
        ids = new(StringComparer.Ordinal);
        if (!root.TryGetProperty(name, out var list) || list.ValueKind != JsonValueKind.Array) return false;
        foreach (var item in list.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String || !ReminderFilters.ValidText(item.GetString()) ||
                !ids.Add(item.GetString()!)) return false;
        }
        return true;
    }

    private static bool ReadOverrides(JsonElement value, out Dictionary<string, ReminderFilters> filters)
    {
        filters = new(StringComparer.Ordinal);
        if (value.ValueKind == JsonValueKind.Undefined) return true;
        if (value.ValueKind != JsonValueKind.Object) return false;
        foreach (var item in value.EnumerateObject())
            if (!ReminderFilters.ValidText(item.Name) || ReminderFilters.Read(item.Value) is not { } rule ||
                !filters.TryAdd(item.Name, rule)) return false;
        return true;
    }

    public IEnumerable<(string FilmId, ReminderFilters Filters)> FilmRules(JsonObject settings)
    {
        foreach (var id in FilmIds)
            yield return (WatchedMovieMatcher.Id(id), FilmFilters.GetValueOrDefault(id, Global));
        if (ListIds.Count == 0) yield break;
        var lists = MovieListSettings.Read(settings);
        var watched = MovieListSettings.Films(lists, MovieListSettings.WatchedId).Select(AccountMovieLists.Movie);
        var matcher = new WatchedMovieMatcher(watched);
        foreach (var list in lists.OfType<JsonObject>())
        {
            if (MovieListSettings.Text(list["id"]) is not { } id || !ListIds.Contains(id)) continue;
            var films = MovieListSettings.Films(lists, id).Select(AccountMovieLists.Movie).ToArray();
            if (id == MovieListSettings.WatchlistId || list["hideWatched"]?.GetValue<bool>() == true)
                films = matcher.Visible(films);
            var filters = ListFilters.GetValueOrDefault(id, Global);
            foreach (var film in films) yield return (WatchedMovieMatcher.Id(film.Id), filters);
        }
    }
}
