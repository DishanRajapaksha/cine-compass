using System.Globalization;

namespace CineCompass.Api.Cineville;

internal sealed partial class CinevilleProgramme
{
    public async Task<Film?> FindFilmById(string id, CancellationToken ct)
    {
        var body = new { id = new { eq = id }, page = SearchPage };
        return (await client.Productions(body, ct)).Select(CinevilleMapping.Film).OfType<Film>()
            .FirstOrDefault(film => film.Id == id);
    }

    public async Task<FilmMatch[]> FindFilms(string? title, int? releaseYear, CancellationToken ct)
    {
        title = title?.Trim();
        if (title is null || title.Length is < 2 or > 120)
            throw new ProgrammeInputException("Use a film title containing 2 to 120 characters.");
        if (releaseYear is <= 0 or > 9999)
            throw new ProgrammeInputException("Use a release year between 1 and 9999.");

        var body = new
        {
            title = new { contains = title },
            sort = new { title = "asc" },
            page = SearchPage
        };
        var compare = CultureInfo.InvariantCulture.CompareInfo;
        const CompareOptions matching = CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace;
        return (await client.Productions(body, ct)).Select(CinevilleMapping.Film).OfType<Film>()
            .Where(f => (releaseYear is null || f.ReleaseYear == releaseYear) &&
                compare.IndexOf(f.Title, title, matching) >= 0)
            .OrderByDescending(f => compare.Compare(f.Title, title, matching) == 0)
            .ThenBy(f => f.Title, Names).ThenBy(f => f.ReleaseYear)
            .ThenBy(f => f.Id, StringComparer.Ordinal)
            .Select(f => new FilmMatch(f.Id, f.Title, f.ReleaseYear > 0 ? f.ReleaseYear : null, f.PremiereDate)).ToArray();
    }
}

internal sealed record FilmMatch(string Id, string Title, int? ReleaseYear, string? PremiereDate);
