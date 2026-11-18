using System.ComponentModel;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace CineCompass.Api.Cineville;

[McpServerToolType]
internal sealed class ProgrammeTools(CinevilleProgramme programme, ProgrammePaging paging, ILogger<ProgrammeTools> logger)
{
    [McpServerTool(Name = "list_cinemas", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("List participating Cineville cinemas and their IDs. Filter optionally by city.")]
    public Task<ToolPage<Cinema>> ListCinemas(CancellationToken ct,
        [Description("Exact city name, for example Amsterdam.")] string? city = null,
        int offset = 0, int limit = 25,
        [Description("The nextCursor returned by this tool. Send only the cursor and optionally limit when paging.")] string? cursor = null) =>
        ReadPage(nameof(ListCinemas), cursor, offset, limit, () => programme.Cinemas(city, ct));

    [McpServerTool(Name = "search_screenings", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Search Cineville film screenings by city, cinema, Amsterdam date, spoken language, and subtitle language. Defaults to screenings with both English audio and English subtitles. Use a language code to override either filter or any to clear it. With no dates, searches the rest of today.")]
    public Task<ScreeningPage> SearchScreenings(CancellationToken ct,
        string? city = null,
        [Description("Exact cinema name or Cineville cinema ID.")] string? cinema = null,
        [Description("First date in Europe/Amsterdam, YYYY-MM-DD.")] string? startDate = null,
        [Description("Last date in Europe/Amsterdam, inclusive, YYYY-MM-DD. Defaults to the first date.")] string? endDate = null,
        [Description("Spoken language code. Defaults to en (English). Use any to allow all spoken languages.")] string language = "en",
        [Description("Subtitle language code. Defaults to en (English). Use any to include screenings regardless of subtitles.")] string subtitles = "en",
        [Description("Case-insensitive film title substring.")] string? title = null,
        int offset = 0, int limit = 25,
        [Description("Inclusive lower boundary in Amsterdam local time, HH:mm.")] string? startTime = null,
        [Description("Inclusive final minute for screening starts in Amsterdam local time, HH:mm.")] string? endTime = null,
        [Description("The nextCursor from this tool. Send only the cursor and optionally limit when paging.")] string? cursor = null) =>
        ReadScreenings(nameof(SearchScreenings), cursor, offset, limit,
            Filter(city, cinema, startDate, endDate, language, subtitles, startTime, endTime), ct, Clean(title));

    [McpServerTool(Name = "get_film_showtimes", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Get upcoming published showtimes for a Cineville film ID returned by the catalogue or screening tools.")]
    public Task<ScreeningPage> GetFilmShowtimes(
        CancellationToken ct,
        [Description("Cineville film ID from find_films or a catalogue. Required for the first page.")] string? filmId = null,
        string? city = null,
        [Description("Exact cinema name or Cineville cinema ID.")] string? cinema = null,
        [Description("Inclusive Amsterdam date, YYYY-MM-DD.")] string? startDate = null,
        [Description("Inclusive Amsterdam date, YYYY-MM-DD. Omit to include all published future dates.")] string? endDate = null,
        [Description("Spoken language code.")] string? language = null,
        [Description("Subtitle language code.")] string? subtitles = null,
        int offset = 0, int limit = 25,
        [Description("Inclusive lower boundary in Amsterdam local time, HH:mm.")] string? startTime = null,
        [Description("Inclusive final minute for screening starts in Amsterdam local time, HH:mm.")] string? endTime = null,
        [Description("The nextCursor from this tool. Omit filmId and filters when sending a cursor.")] string? cursor = null) =>
        ReadScreenings(nameof(GetFilmShowtimes), cursor, offset, limit,
            Filter(city, cinema, startDate, endDate, language, subtitles, startTime, endTime), ct, filmId: filmId, upcomingOnly: true);

    [McpServerTool(Name = "find_films", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Look up Cineville film IDs by a title or title fragment. Use release years to distinguish remakes and re-releases.")]
    public Task<ToolPage<FilmMatch>> FindFilms(CancellationToken ct,
        [Description("Film title or fragment, case- and accent-insensitive. Required for the first page.")] string? title = null,
        [Description("Filter by the film's original release year.")] int? releaseYear = null,
        int offset = 0, int limit = 25, string? cursor = null) =>
        ReadPage(nameof(FindFilms), cursor, offset, limit, () => programme.FindFilms(title, releaseYear, ct));

    [McpServerTool(Name = "now_showing", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Find films with published screenings in the next seven days. Filter optionally by city or title.")]
    public Task<ToolPage<Film>> NowShowing(CancellationToken ct, string? city = null,
        [Description("Case-insensitive film title substring.")] string? title = null, int offset = 0, int limit = 25, string? cursor = null) =>
        ReadPage(nameof(NowShowing), cursor, offset, limit,
            async () => (await programme.NowShowing(city, ct)).Where(f => TitleMatches(f.Title, title)).ToArray());

    [McpServerTool(Name = "upcoming_films", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Find films with a premiere date after today in Amsterdam, ordered by premiere date.")]
    public Task<ToolPage<Film>> UpcomingFilms(CancellationToken ct,
        [Description("Case-insensitive film title substring.")] string? title = null, int offset = 0, int limit = 25, string? cursor = null) =>
        ReadPage(nameof(UpcomingFilms), cursor, offset, limit,
            async () => (await programme.Upcoming(ct)).Where(f => TitleMatches(f.Title, title)).ToArray());

    [McpServerTool(Name = "get_specials", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("Discover programme categories and tagged screenings, including special events without a film. Defaults to the rest of today.")]
    public async Task<SpecialsResult> GetSpecials(CancellationToken ct, string? city = null,
        [Description("Exact cinema name or Cineville cinema ID.")] string? cinema = null,
        [Description("Inclusive Amsterdam date, YYYY-MM-DD.")] string? startDate = null,
        [Description("Inclusive Amsterdam date, YYYY-MM-DD. Defaults to the first date.")] string? endDate = null,
        [Description("Filter the screening page by an exact event category.")] string? category = null,
        int offset = 0, int limit = 25, string? cursor = null)
    {
        var (page, categories) = await paging.Read(nameof(GetSpecials), cursor, offset, limit, async () =>
        {
            var events = await Read(() => programme.Screenings(Filter(city, cinema, startDate, endDate, null, null),
                ct, includeNonFilm: true));
            var tagged = events.Where(s => s.Categories.Length > 0).ToArray();
            var available = tagged.SelectMany(s => s.Categories).Distinct(StringComparer.OrdinalIgnoreCase)
                .Order(StringComparer.OrdinalIgnoreCase).ToArray();
            var results = tagged.Where(s => category is null || s.Categories.Contains(category.Trim(), StringComparer.OrdinalIgnoreCase))
                .Select(ScreeningResult.From).ToArray();
            return new ProgrammeSnapshot<ScreeningResult, string[]>(results, available);
        });
        return new(categories, page);
    }

    private async Task<ToolPage<T>> ReadPage<T>(string tool, string? cursor, int offset, int limit, Func<Task<T[]>> read)
    {
        var (page, _) = await paging.Read(tool, cursor, offset, limit,
            async () => new ProgrammeSnapshot<T, object?>(await Read(read), null));
        return page;
    }

    private async Task<ScreeningPage> ReadScreenings(string tool, string? cursor, int offset, int limit,
        ProgrammeFilter filter, CancellationToken ct, string? title = null, string? filmId = null, bool upcomingOnly = false)
    {
        var (page, details) = await paging.Read(tool, cursor, offset, limit, async () =>
        {
            var batch = await Read(() => programme.ScreeningCandidates(filter, ct,
                upcomingOnly ? RequiredId(filmId) : null, upcomingOnly));
            return ScreeningSearchResult.Create(batch, filter, title, Clean(filmId));
        });
        return new(page.Items, page.Total, page.NextOffset, page.NextCursor, details);
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

    private static ProgrammeFilter Filter(string? city, string? cinema, string? start, string? end, string? language,
        string? subtitles, string? startTime = null, string? endTime = null) =>
        new(Clean(city), Single(Clean(cinema)), Languages(language), Languages(subtitles),
            StartDate: start, EndDate: end, StartTime: startTime, EndTime: endTime);

    private static string RequiredId(string? value) =>
        Clean(value) ?? throw new ProgrammeInputException("Supply a Cineville film ID from find_films or a catalogue.");

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string[]? Single(string? value) => value is null ? null : [value];
    private static string[]? Languages(string? value) =>
        Clean(value) is { } text && !text.Equals("any", StringComparison.OrdinalIgnoreCase)
            ? [ScreeningLanguage.Normalize(text)] : null;

    private static bool TitleMatches(string title, string? filter) =>
        string.IsNullOrWhiteSpace(filter) || title.Contains(filter.Trim(), StringComparison.OrdinalIgnoreCase);
}

internal sealed record SpecialsResult(string[] Categories, ToolPage<ScreeningResult> Screenings);
