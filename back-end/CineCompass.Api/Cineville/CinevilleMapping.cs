using System.Text.Json;

namespace CineCompass.Api.Cineville;

internal static class CinevilleMapping
{
    public static JsonElement Field(this JsonElement value, string key) =>
        value.ValueKind == JsonValueKind.Object && value.TryGetProperty(key, out var field) ? field : default;

    public static string? Text(this JsonElement value, string key) =>
        value.Field(key) is { ValueKind: JsonValueKind.String } text ? text.GetString()?.Trim() : null;

    private static string[] Strings(JsonElement value) =>
        value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String)
                .Select(x => x.GetString()!.Trim()).Where(x => x.Length > 0).ToArray()
            : [];

    private static int Number(JsonElement value, string key) =>
        value.Field(key) is { ValueKind: JsonValueKind.Number } number && number.TryGetInt32(out var result)
            ? result : 0;

    public static Cinema? Cinema(JsonElement venue) =>
        venue.Text("id") is { Length: > 0 } id && venue.Text("name") is { Length: > 0 } name &&
        venue.Field("address").Text("city") is { Length: > 0 } city &&
        venue.Field("isHidden").ValueKind != JsonValueKind.True
            ? new(id, name, city) : null;

    public static Film? Film(JsonElement raw)
    {
        if (raw.Text("id") is not { Length: > 0 } id || raw.Text("title") is not { Length: > 0 } title)
            return null;
        var attributes = raw.Field("attributes");
        var localized = raw.Field("localizableAttributes");
        var english = Description(localized.Field("en-GB"));
        var dutch = Description(localized.Field("nl-NL")) ?? NonEmpty(localized.Text("shortDescription"))
            ?? NonEmpty(localized.Text("description"));
        var assets = raw.Field("assets");
        return new(id, title, WebLink(assets.Field("poster").Text("url")) ?? WebLink(assets.Field("cover").Text("url")) ?? "",
            attributes.Text("premiereDate"), english ?? dutch ?? "No description available.",
            english is not null ? "en" : dutch is not null ? "nl" : null,
            Number(attributes, "duration"), Strings(attributes.Field("directors")), Strings(attributes.Field("cast")),
            Number(attributes, "releaseYear"), Strings(attributes.Field("spokenLanguages")), raw.Text("createdAt"));
    }

    public static Screening? Screening(JsonElement raw)
    {
        var embedded = raw.Field("_embedded");
        var cinema = Cinema(embedded.Field("venue"));
        if (cinema is null || raw.Text("id") is not { Length: > 0 } id ||
            !raw.Field("startDate").TryReadTimestamp(out var start) || raw.Field("isHidden").ValueKind == JsonValueKind.True)
            return null;
        var film = Film(embedded.Field("production"));
        var attributes = raw.Field("attributes");
        var localized = raw.Field("localizableAttributes");
        var custom = new[] { localized, localized.Field("en-GB"), localized.Field("nl-NL") }
            .Select(x => Strings(x.Field("customTags"))).FirstOrDefault(x => x.Length > 0) ?? [];
        var categories = Strings(attributes.Field("tags")).Concat(custom).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var subtitles = Strings(attributes.Field("subtitles"));
        var hasScheduledEnd = raw.Field("endDate").TryReadTimestamp(out var scheduledEnd) && scheduledEnd > start;
        var end = hasScheduledEnd ? scheduledEnd : EstimateEnd(start, film?.Duration ?? 0);
        var endTimeSource = hasScheduledEnd ? "scheduled" : end > start ? "estimated" : "unknown";
        var version = NonEmpty(attributes.Text("languageVersion"));
        var (audioLanguages, audioSource) = ScreeningLanguage.Audio(Strings(attributes.Field("spokenLanguages")),
            version, film?.SpokenLanguages ?? []);
        var showtime = new Showtime(id, start, end, cinema.Id, cinema.Name, cinema.City,
            WebLink(raw.Text("ticketingUrl")), categories.Length == 0 ? null : string.Join(", ", categories),
            string.Join(", ", subtitles), version);
        return new(film, showtime, subtitles, categories, DescriptionTitle(raw, localized),
            audioLanguages, audioSource, ScreeningLanguage.SubtitleStatus(subtitles, categories), endTimeSource);
    }

    private static string? DescriptionTitle(JsonElement raw, JsonElement localized) =>
        NonEmpty(raw.Text("title")) ?? NonEmpty(raw.Text("name")) ?? NonEmpty(localized.Field("en-GB").Text("title"))
        ?? NonEmpty(localized.Field("nl-NL").Text("title")) ?? NonEmpty(localized.Text("title"));

    private static string? Description(JsonElement localized) =>
        NonEmpty(localized.Text("description")) ?? NonEmpty(localized.Text("shortDescription"));

    private static string? NonEmpty(string? text) => string.IsNullOrEmpty(text) ? null : text;

    private static string? WebLink(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var url) && url.Scheme is "https" or "http" &&
        url.Host.Length > 0 && url.UserInfo.Length == 0 ? value : null;

    private static bool TryReadTimestamp(this JsonElement field, out DateTimeOffset timestamp)
    {
        timestamp = default;
        return field.ValueKind == JsonValueKind.String && field.TryGetDateTimeOffset(out timestamp);
    }

    private static DateTimeOffset EstimateEnd(DateTimeOffset start, int duration)
    {
        if (duration is <= 0 or > 1440) return start;
        var estimate = start.AddMinutes(duration + 15).UtcDateTime;
        return estimate.AddTicks(-(estimate.Ticks % TimeSpan.FromMinutes(5).Ticks));
    }
}
