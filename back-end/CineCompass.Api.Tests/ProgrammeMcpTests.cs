using System.Text.Json;
using Xunit;

public sealed partial class ProgrammeTests
{
    private const string ScreeningDate = "2026-11-19";

    [Fact]
    public async Task Audio_uses_screening_evidence_and_subtitles_and_end_times_report_their_sources()
    {
        using var upstream = new ProgrammeUpstream { UseLanguageEvidence = true };
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        var day = await Call(http, "search_screenings", new
        {
            startDate = ScreeningDate, endDate = "2026-11-20", language = "any", subtitles = "any"
        });
        var screenings = day.GetProperty("items").EnumerateArray().ToDictionary(ScreeningId);
        var dub = screenings["dub"];
        Assert.Equal("en", dub.GetProperty("spokenLanguages")[0].GetString());
        Assert.Equal("nl", dub.GetProperty("audioLanguages")[0].GetString());
        Assert.Equal("screening", dub.GetProperty("audioSource").GetString());
        Assert.Equal("scheduled", dub.GetProperty("endTimeSource").GetString());
        Assert.Equal("listed", dub.GetProperty("subtitleStatus").GetString());
        Assert.Equal("film", screenings["late"].GetProperty("audioSource").GetString());
        Assert.Equal("estimated", screenings["late"].GetProperty("endTimeSource").GetString());
        Assert.Equal("none", screenings["explicit-none"].GetProperty("subtitleStatus").GetString());
        Assert.Equal("unlisted", screenings["unlisted"].GetProperty("subtitleStatus").GetString());
        Assert.Equal("unknown", screenings["unlisted"].GetProperty("audioSource").GetString());

        var result = await Call(http, "search_screenings", new { startDate = ScreeningDate, language = "nld" });
        Assert.Equal("dub", ScreeningId(Assert.Single(result.GetProperty("items").EnumerateArray())));
        var defaultSearch = await Call(http, "search_screenings", new { startDate = ScreeningDate });
        Assert.Equal(0, defaultSearch.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Both_screening_tools_expose_Amsterdam_time_boundaries()
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        var result = await Call(http, "search_screenings", new
        {
            startDate = ScreeningDate, startTime = "19:01", endTime = "21:00", language = "any", subtitles = "any"
        });
        Assert.Equal("late", ScreeningId(Assert.Single(result.GetProperty("items").EnumerateArray())));
        var filters = result.GetProperty("details").GetProperty("effectiveFilters");
        Assert.Equal("Europe/Amsterdam", filters.GetProperty("timeZone").GetString());
        Assert.Equal("2026-11-19T19:01:00+01:00", filters.GetProperty("startInclusive").GetString());
        Assert.Equal("2026-11-19T21:01:00+01:00", filters.GetProperty("endExclusive").GetString());

        var film = await Call(http, "get_film_showtimes", new
        {
            filmId = "film", startDate = ScreeningDate, startTime = "19:00", endTime = "20:59"
        });
        Assert.Equal("early", ScreeningId(Assert.Single(film.GetProperty("items").EnumerateArray())));
        await AssertToolError(http, "search_screenings", new { startDate = ScreeningDate, startTime = "25:00" });
    }

    [Theory]
    [InlineData("Unknown", null, "unknown_city")]
    [InlineData("Amsterdam", "Unknown", "unknown_cinema")]
    [InlineData("Amsterdam", "Kino", "cinema_outside_city")]
    [InlineData("Rotterdam", "Kino", "no_screenings")]
    public async Task Empty_search_distinguishes_locations_from_no_screenings(string city, string? cinema, string reason)
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        var result = await Call(http, "search_screenings", new { city, cinema, startDate = ScreeningDate });
        Assert.Equal(0, result.GetProperty("total").GetInt32());
        Assert.Equal(reason, result.GetProperty("details").GetProperty("emptyReason").GetString());
    }

    [Fact]
    public async Task Empty_search_explains_title_and_language_filters_and_counts_possible_alternatives()
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        var result = await Call(http, "search_screenings", new { startDate = ScreeningDate });
        Assert.Equal(0, result.GetProperty("total").GetInt32());
        var details = result.GetProperty("details");
        var filters = details.GetProperty("effectiveFilters");
        Assert.Equal("en", filters.GetProperty("language").GetString());
        Assert.Equal("en", filters.GetProperty("subtitles").GetString());
        Assert.Equal("no_language_matches", details.GetProperty("emptyReason").GetString());
        var option = Assert.Single(details.GetProperty("relaxationOptions").EnumerateArray());
        Assert.Equal("any", option.GetProperty("language").GetString());
        Assert.Equal("en", option.GetProperty("subtitles").GetString());
        Assert.Equal(1, option.GetProperty("matches").GetInt32());

        var unknownTitle = await Call(http, "search_screenings", new { startDate = ScreeningDate, title = "Unknown" });
        Assert.Equal("no_title_matches", unknownTitle.GetProperty("details").GetProperty("emptyReason").GetString());
    }

    [Fact]
    public async Task Film_lookup_reports_candidate_years_and_ids_and_matches_accented_titles()
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        var films = await Call(http, "find_films", new { title = "a film" });
        var matches = films.GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal(new[] { 2025, 2026 }, matches.Select(m => m.GetProperty("releaseYear").GetInt32()));
        Assert.Equal(new[] { "film", "remake" }, matches.Select(m => m.GetProperty("id").GetString()));
        var byYear = await Call(http, "find_films", new { title = "A Film", releaseYear = 2026 });
        Assert.Equal("remake", byYear.GetProperty("items")[0].GetProperty("id").GetString());
        var accented = await Call(http, "find_films", new { title = "amelie" });
        Assert.Equal("Amélie", accented.GetProperty("items")[0].GetProperty("title").GetString());
        var showtimes = await Call(http, "get_film_showtimes", new { filmId = matches[0].GetProperty("id").GetString() });
        Assert.Equal(2, showtimes.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Cursor_survives_an_upstream_refresh_and_rejects_expired_or_wrong_tool_cursors()
    {
        using var upstream = new ProgrammeUpstream { IncludeEnglishScreenings = true };
        var clock = new ProgrammeClock();
        using var factory = Factory(upstream, eventCacheSeconds: "0", clock: clock);
        using var http = factory.CreateClient();
        var first = await Call(http, "search_screenings",
            new { startDate = ScreeningDate, language = "any", subtitles = "any", limit = 1 });
        Assert.Equal("early", ScreeningId(first.GetProperty("items")[0]));
        var cursor = first.GetProperty("nextCursor").GetString();
        Assert.False(string.IsNullOrWhiteSpace(cursor));

        upstream.IncludeEnglishScreenings = false;
        var fresh = await Call(http, "search_screenings", new { startDate = ScreeningDate, language = "any", subtitles = "any" });
        Assert.Equal(2, fresh.GetProperty("total").GetInt32());
        var upstreamRequests = upstream.Requests.Count;
        var second = await Call(http, "search_screenings", new { cursor, limit = 2 });
        Assert.Equal(4, second.GetProperty("total").GetInt32());
        Assert.Equal(new[] { "late", "english" }, second.GetProperty("items").EnumerateArray().Select(ScreeningId));
        Assert.Equal(first.GetProperty("details").GetRawText(), second.GetProperty("details").GetRawText());
        var last = await Call(http, "search_screenings", new { cursor = second.GetProperty("nextCursor").GetString() });
        Assert.Equal("dutch-subs", ScreeningId(last.GetProperty("items")[0]));
        Assert.True(!last.TryGetProperty("nextCursor", out var end) || end.ValueKind == JsonValueKind.Null);
        Assert.Equal(upstreamRequests, upstream.Requests.Count);

        await AssertToolError(http, "list_cinemas", new { cursor });
        await AssertToolError(http, "search_screenings", new { cursor, offset = 1 });
        clock.Now = clock.Now.AddMinutes(5);
        await AssertToolError(http, "search_screenings", new { cursor });
    }

    private static string ScreeningId(JsonElement screening) => screening.GetProperty("showtime").GetProperty("id").GetString()!;

    private static async Task AssertToolError(HttpClient http, string tool, object arguments)
    {
        using var response = await Rpc(http, "tools/call", new { name = tool, arguments });
        Assert.True(response.RootElement.GetProperty("result").GetProperty("isError").GetBoolean());
    }
}
