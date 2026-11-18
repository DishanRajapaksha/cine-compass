using System.Text;
using System.Text.RegularExpressions;

namespace CineCompass.Api.Cineville;

internal sealed class WatchedMovieMatcher(IEnumerable<AccountMovie> watched)
{
    private static readonly Regex ReleaseSuffix = new(@"\s*[([](?:re[\s-]?release|re[\s-]?issue)(?:\s+\d{4})?[)\]]\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    private static readonly Regex Diacritics = new(@"[\u0300-\u036f]", RegexOptions.NonBacktracking);
    private static readonly Regex Punctuation = new(@"[^\p{L}\p{N}]+", RegexOptions.NonBacktracking);

    public AccountMovie[] Visible(AccountMovie[] films)
    {
        var entries = watched.ToArray();
        var ids = entries.Select(movie => Id(movie.Id)).ToHashSet();
        var titles = entries.Select(TitleAndYear).OfType<(string, int)>().ToHashSet();
        return films.Where(movie => !ids.Contains(Id(movie.Id)) &&
            !(TitleAndYear(movie) is { } title && titles.Contains(title))).ToArray();
    }

    public static string Id(string id) => Guid.TryParseExact(id.Trim(), "D", out var guid) ? guid.ToString("D") : id;

    // Mirrors the web app's title-and-year match for films with changed catalogue IDs.
    private static (string, int)? TitleAndYear(AccountMovie movie)
    {
        if (movie.Year is not > 0) return null;
        var title = ReleaseSuffix.Replace(movie.Title, "").Normalize(NormalizationForm.FormKD);
        title = Punctuation.Replace(Diacritics.Replace(title, "").ToLowerInvariant(), " ").Trim();
        return title.Length > 0 ? (title, movie.Year.Value) : null;
    }
}
