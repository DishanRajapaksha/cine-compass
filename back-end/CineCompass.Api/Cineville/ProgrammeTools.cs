using System.ComponentModel;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace CineCompass.Api.Cineville;

[McpServerToolType]
internal sealed class ProgrammeTools(CinevilleProgramme programme, ILogger<ProgrammeTools> logger)
{
    [McpServerTool(Name = "list_cinemas", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("List participating Cineville cinemas and their IDs. Filter optionally by city.")]
    public Task<ToolPage<Cinema>> ListCinemas(CancellationToken ct,
        [Description("Exact city name, for example Amsterdam.")] string? city = null,
        int offset = 0, int limit = 25) =>
        ReadPage(() => programme.Cinemas(city, ct), offset, limit);

    [McpServerTool(Name = "search_screenings", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Search Cineville film screenings by city, cinema, Amsterdam date, spoken language, and subtitle language. With no dates, searches the rest of today.")]
    public Task<ToolPage<ScreeningResult>> SearchScreenings(CancellationToken ct,
        string? city = null,
        [Description("Exact cinema name or Cineville cinema ID.")] string? cinema = null,
        [Description("First date in Europe/Amsterdam, YYYY-MM-DD.")] string? startDate = null,
        [Description("Last date in Europe/Amsterdam, inclusive, YYYY-MM-DD. Defaults to the first date.")] string? endDate = null,
        [Description("Spoken language code such as en or fr.")] string? language = null,
        [Description("Subtitle language code such as en or nl.")] string? subtitles = null,
        [Description("Case-insensitive film title substring.")] string? title = null,
        int offset = 0, int limit = 25) =>
        ReadPage(async () => (await programme.Screenings(Filter(city, cinema, startDate, endDate, language, subtitles), ct))
            .Where(s => TitleMatches(s.Film!.Title, title)).Select(ToResult).ToArray(), offset, limit);

    [McpServerTool(Name = "get_film_showtimes", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Get upcoming published showtimes for a Cineville film ID returned by the catalogue or screening tools.")]
    public Task<ToolPage<ScreeningResult>> GetFilmShowtimes(
        [Description("Cineville film ID.")] string filmId, CancellationToken ct,
        string? city = null,
        [Description("Exact cinema name or Cineville cinema ID.")] string? cinema = null,
        [Description("Inclusive Amsterdam date, YYYY-MM-DD.")] string? startDate = null,
        [Description("Inclusive Amsterdam date, YYYY-MM-DD. Omit to include all published future dates.")] string? endDate = null,
        [Description("Spoken language code.")] string? language = null,
        [Description("Subtitle language code.")] string? subtitles = null,
        int offset = 0, int limit = 25) =>
        ReadPage(async () => (await programme.Screenings(Filter(city, cinema, startDate, endDate, language, subtitles),
            ct, filmId: RequiredId(filmId), upcomingOnly: true)).Select(ToResult).ToArray(), offset, limit);

    [McpServerTool(Name = "now_showing", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Find films with published screenings in the next seven days. Filter optionally by city or title.")]
    public Task<ToolPage<Film>> NowShowing(CancellationToken ct, string? city = null,
        [Description("Case-insensitive film title substring.")] string? title = null, int offset = 0, int limit = 25) =>
        ReadPage(async () => (await programme.NowShowing(city, ct)).Where(f => TitleMatches(f.Title, title)).ToArray(),
            offset, limit);

    [McpServerTool(Name = "upcoming_films", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Find films with a premiere date after today in Amsterdam, ordered by premiere date.")]
    public Task<ToolPage<Film>> UpcomingFilms(CancellationToken ct,
        [Description("Case-insensitive film title substring.")] string? title = null, int offset = 0, int limit = 25) =>
        ReadPage(async () => (await programme.Upcoming(ct)).Where(f => TitleMatches(f.Title, title)).ToArray(),
            offset, limit);

    [McpServerTool(Name = "get_specials", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Discover programme categories and tagged screenings, including special events without a film. Defaults to the rest of today.")]
    public async Task<SpecialsResult> GetSpecials(CancellationToken ct, string? city = null,
        [Description("Exact cinema name or Cineville cinema ID.")] string? cinema = null,
        [Description("Inclusive Amsterdam date, YYYY-MM-DD.")] string? startDate = null,
        [Description("Inclusive Amsterdam date, YYYY-MM-DD. Defaults to the first date.")] string? endDate = null,
        [Description("Filter the screening page by an exact event category.")] string? category = null,
        int offset = 0, int limit = 25)
    {
        ValidatePage(offset, limit);
        var events = await Read(() => programme.Screenings(Filter(city, cinema, startDate, endDate, null, null),
            ct, includeNonFilm: true));
        var tagged = events.Where(s => s.Categories.Length > 0).ToArray();
        var categories = tagged.SelectMany(s => s.Categories).Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase).ToArray();
        var results = tagged.Where(s => category is null || s.Categories.Contains(category.Trim(), StringComparer.OrdinalIgnoreCase))
            .Select(ToResult).ToArray();
        return new(categories, Page(results, offset, limit));
    }

    private async Task<ToolPage<T>> ReadPage<T>(Func<Task<T[]>> read, int offset, int limit)
    {
        ValidatePage(offset, limit);
        return Page(await Read(read), offset, limit);
    }

    private async Task<T> Read<T>(Func<Task<T>> read)
    {
        try { return await read(); }
        catch (ProgrammeInputException error) { throw new McpException(error.Message); }
        catch (CinevilleUpstreamException error)
        {
            logger.LogWarning(error, "Cineville upstream request failed");
            throw new McpException(error.Message);
        }
    }

    private static void ValidatePage(int offset, int limit)
    {
        if (offset < 0 || limit is < 1 or > 100) throw new McpException("Use a nonnegative offset and a limit between 1 and 100.");
    }

    private static ToolPage<T> Page<T>(T[] source, int offset, int limit)
    {
        var items = source.Skip(offset).Take(limit).ToArray();
        return new(items, source.Length, (long)offset + items.Length < source.Length ? offset + items.Length : null);
    }

    private static ProgrammeFilter Filter(string? city, string? cinema, string? start, string? end, string? language, string? subs) =>
        new(city, Single(cinema), Single(language), Single(subs), StartDate: start, EndDate: end);

    private static string RequiredId(string value) =>
        string.IsNullOrWhiteSpace(value) ? throw new ProgrammeInputException("A Cineville film ID is required.") : value.Trim();

    private static string[]? Single(string? value) => string.IsNullOrWhiteSpace(value) ? null : [value];
    private static bool TitleMatches(string title, string? filter) =>
        string.IsNullOrWhiteSpace(filter) || title.Contains(filter.Trim(), StringComparison.OrdinalIgnoreCase);

    private static ScreeningResult ToResult(Screening s) =>
        new(s.Film?.Id, s.Film?.Title ?? s.EventTitle, s.Film?.SpokenLanguages ?? [], s.SubtitleLanguages, s.Categories, s.Showtime);
}

internal sealed record ToolPage<T>(T[] Items, int Total, int? NextOffset);
internal sealed record SpecialsResult(string[] Categories, ToolPage<ScreeningResult> Screenings);
internal sealed record ScreeningResult(string? FilmId, string? Title, string[] SpokenLanguages, string[] SubtitleLanguages,
    string[] Categories, Showtime Showtime);
