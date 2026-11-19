using System.Text.Json;
using CineCompass.Api.Cineville;

namespace CineCompass.Api.Notifications;

internal sealed record ReminderFilters(int LookAheadDays, string? City, string[] SpokenLanguages,
    string[] SubtitleLanguages, bool MatchEitherLanguage)
{
    public const int MaximumDays = 365;

    public static ReminderFilters? Read(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Object ||
            value.Field("lookAheadDays") is not { ValueKind: JsonValueKind.Number } horizon ||
            !horizon.TryGetInt32(out var days) || days is < 1 or > MaximumDays ||
            !ReadLanguage(value.Field("selectedSpokenLanguages"), out var spoken) ||
            !ReadLanguage(value.Field("selectedSubtitleLanguages"), out var subtitles)) return null;

        var location = value.Field("city");
        if (location.ValueKind is not (JsonValueKind.Undefined or JsonValueKind.Null) &&
            (location.ValueKind != JsonValueKind.String || !ValidText(location.GetString()))) return null;

        var mode = value.Field("languageMatchMode");
        var either = mode.ValueKind == JsonValueKind.Undefined || mode is { ValueKind: JsonValueKind.String } && mode.GetString() == "any";
        if (!either && (mode.ValueKind != JsonValueKind.String || mode.GetString() != "all")) return null;
        return new(days, value.Text("city"), spoken, subtitles, either);
    }

    private static bool ReadLanguage(JsonElement value, out string[] languages)
    {
        languages = value.ValueKind == JsonValueKind.Undefined ? ["en"] : [];
        if (value.ValueKind == JsonValueKind.Undefined) return true;
        if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() > 1) return false;
        if (value.GetArrayLength() == 0) return true;
        if (value[0].ValueKind != JsonValueKind.String || !ValidText(value[0].GetString(), 32)) return false;
        languages = [value[0].GetString()!];
        return true;
    }

    internal static bool ValidText(string? value, int maximum = 128) =>
        value is { Length: > 0 } && value.Length <= maximum && value == value.Trim();
}
