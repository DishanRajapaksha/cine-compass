using System.Globalization;

namespace CineCompass.Api.Cineville;

internal static class ScreeningLanguage
{
    private static readonly HashSet<string> KnownLanguageCodes = CultureInfo.GetCultures(CultureTypes.NeutralCultures)
        .Where(c => c.Name.Length > 0)
        .SelectMany(c => new[] { c.TwoLetterISOLanguageName, c.ThreeLetterISOLanguageName })
        .Where(c => c != "und").ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static (string[] Languages, string Source) Audio(
        string[] screeningLanguages, string? version, string[] filmLanguages)
    {
        if (screeningLanguages.Length > 0) return (screeningLanguages, "screening");
        if (version is not null)
        {
            var code = Normalize(version);
            if (KnownLanguageCodes.Contains(code)) return ([code], "screening");
            // An unrecognised version may be a dub. Keep the raw label and avoid guessing its audio.
            if (version.Trim().ToLowerInvariant() is not ("ov" or "original" or "original version" or "originele versie"))
                return ([], "unknown");
        }
        return (filmLanguages, filmLanguages.Length > 0 ? "film" : "unknown");
    }

    public static string SubtitleStatus(string[] languages, string[] categories) =>
        languages.Length > 0 ? "listed" :
        categories.Contains("noSubtitles", StringComparer.OrdinalIgnoreCase) ? "none" : "unlisted";

    public static bool Matches(string[]? requested, string[] available) =>
        requested is not { Length: > 0 } ||
        requested.Any(value => !string.IsNullOrWhiteSpace(value) &&
            available.Any(x => Normalize(value) == Normalize(x)));

    public static string Normalize(string value) => value.Trim().Split('-', '_')[0].ToLowerInvariant() switch
    {
        "english" or "engels" or "eng" => "en",
        "dutch" or "nederlands" or "dut" or "nld" => "nl",
        "fra" or "fre" => "fr",
        "deu" or "ger" => "de",
        var code => code
    };
}
