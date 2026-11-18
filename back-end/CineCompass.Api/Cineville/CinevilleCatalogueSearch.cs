using System.Globalization;
using Microsoft.AspNetCore.WebUtilities;

namespace CineCompass.Api.Cineville;

internal sealed partial class CinevilleProgramme
{
    private const int CataloguePageSize = 24;

    public async Task<CataloguePage> SearchCatalogue(string? title, string? cursor, CancellationToken ct)
    {
        title = title?.Trim();
        if (title is null || title.Length is < 1 or > 120)
            throw new ProgrammeInputException("Use a film title containing 1 to 120 characters.");
        if (cursor is not null && !ValidCursor(cursor))
            throw new ProgrammeInputException("Use the search cursor returned with the previous page.");

        // An encoded slash is rejected by Cineville's router. Escaping it twice lets the
        // title matcher find slash-separated titles while keeping the query in one segment.
        var segment = Uri.EscapeDataString(title.Replace("/", "%2F").Replace("\\", "%5C"));
        if (segment is "." or "..") return new([], null); // URI resolution treats these as navigation.
        var path = QueryHelpers.AddQueryString("/productions/by-title/" + segment, "page[limit]",
            CataloguePageSize.ToString(CultureInfo.InvariantCulture));
        if (cursor is not null) path = QueryHelpers.AddQueryString(path, "page[after]", cursor);

        var page = await client.ProductionsByTitle(path, ct);
        return new(page.Items.Select(CinevilleMapping.Film).OfType<Film>().ToArray(),
            ReadNextCursor(page.NextHref, cursor));
    }

    private static string? ReadNextCursor(string? href, string? previous)
    {
        if (href is null) return null;
        // Cineville can echo raw punctuation from the title in the link. Read only
        // the paging parameters and rebuild the URL from the original title.
        var queryStart = href.LastIndexOf('?');
        if (queryStart >= 0 && QueryHelpers.ParseQuery(href[queryStart..]).TryGetValue("page[after]", out var values)
            && values.Count == 1 && values[0] is { } cursor && ValidCursor(cursor) && cursor != previous)
            return cursor;
        throw new CinevilleUpstreamException(new IOException("Cineville returned an invalid title-search cursor."));
    }

    private static bool ValidCursor(string cursor) => cursor.Length is > 0 and <= 512 &&
        cursor.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '+' or '/' or '=');
}

internal sealed record CataloguePage(Film[] Films, string? NextCursor);
