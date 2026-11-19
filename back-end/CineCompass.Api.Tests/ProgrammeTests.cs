using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

public sealed partial class ProgrammeTests
{
    private const string GatewayCredential = "testcinevillegatewaycredential1234";
    [Fact]
    public async Task Rest_and_Mcp_share_complete_cached_pages_and_filter_each_screening()
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();

        var cinemas = await http.GetFromJsonAsync<JsonElement>("/api/cineville/cinemas?city=amsterdam");
        Assert.Equal("eye", cinemas[0].GetProperty("theaters")[0].GetProperty("id").GetString());
        Assert.Equal(2, upstream.Requests.Count(r => r.Path.StartsWith("/venues", StringComparison.Ordinal)));
        var movies = await http.GetFromJsonAsync<JsonElement>(
            "/api/cineville/screenings?startDate=2026-11-19&city=Amsterdam&cinema=eye&language=fr&subtitle=en");
        var movie = movies.GetProperty("results")[0];
        Assert.Equal("English description", movie.GetProperty("overview").GetString());
        Assert.Equal("en", movie.GetProperty("overviewLanguage").GetString());
        Assert.Equal("https://images.example/film.jpg", movie.GetProperty("poster_path").GetString());
        var showtime = Assert.Single(movie.GetProperty("showtimes").EnumerateArray());
        Assert.Equal("late", showtime.GetProperty("id").GetString());
        Assert.Equal(DateTimeOffset.Parse("2026-11-19T21:45:00Z"), showtime.GetProperty("endDate").GetDateTimeOffset());

        var results = await Call(http, "search_screenings", new
        {
            city = "Amsterdam", cinema = "Eye Filmmuseum", startDate = "2026-11-19", language = "fr-FR",
            subtitles = "English", languageMatch = "and"
        });
        Assert.Equal("late", ScreeningId(Assert.Single(results.GetProperty("items").EnumerateArray())));
        var requests = upstream.Requests.Where(r => r.Path.StartsWith("/events/search", StringComparison.Ordinal)).ToArray();
        Assert.Equal(2, requests.Length);
        Assert.Equal("/events/search?page%5Bafter%5D=next", requests[1].Path);
        Assert.Equal(requests[0].Body, requests[1].Body);
        Assert.All(requests, r => Assert.Equal(HttpMethod.Post, r.Method));
    }

    [Fact]
    public async Task Mcp_screening_search_defaults_to_either_English_filter_and_allows_requiring_both()
    {
        using var upstream = new ProgrammeUpstream { IncludeEnglishScreenings = true };
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        const string date = "2026-11-19";

        using var list = await Rpc(http, "tools/list", new { });
        var search = list.RootElement.GetProperty("result").GetProperty("tools").EnumerateArray()
            .Single(tool => tool.GetProperty("name").GetString() == "search_screenings");
        var parameters = search.GetProperty("inputSchema").GetProperty("properties");
        Assert.Equal("en", parameters.GetProperty("language").GetProperty("default").GetString());
        Assert.Equal("en", parameters.GetProperty("subtitles").GetProperty("default").GetString());
        Assert.Equal("or", parameters.GetProperty("languageMatch").GetProperty("default").GetString());

        Assert.Equal(new[] { "late", "english", "dutch-subs" }, await Search(new { startDate = date }));
        Assert.Equal(new[] { "english" }, await Search(new { startDate = date, languageMatch = "and" }));
        Assert.Equal(new[] { "early", "late", "english" }, await Search(new { startDate = date, language = "fr" }));
        Assert.Equal(new[] { "early", "english", "dutch-subs" }, await Search(new { startDate = date, subtitles = "nl" }));
        Assert.Equal(new[] { "late", "english" }, await Search(new { startDate = date, language = "any" }));
        Assert.Equal(new[] { "english", "dutch-subs" }, await Search(new { startDate = date, subtitles = "any" }));
        foreach (var languageMatch in new[] { "or", "and" })
        {
            Assert.Equal(new[] { "english", "dutch-subs" }, await Search(new { startDate = date, subtitles = "any", languageMatch }));
            Assert.Equal(new[] { "early", "late", "english", "dutch-subs" },
                await Search(new { startDate = date, language = "any", subtitles = "any", languageMatch }));
        }
        await AssertToolError(http, "search_screenings", new { startDate = date, languageMatch = "xor" });

        var film = await Call(http, "get_film_showtimes", new { filmId = "film", startDate = date, language = "en", subtitles = "en" });
        Assert.Equal("english", ScreeningId(Assert.Single(film.GetProperty("items").EnumerateArray())));

        async Task<string?[]> Search(object arguments) =>
            (await Call(http, "search_screenings", arguments)).GetProperty("items").EnumerateArray()
                .Select(item => item.GetProperty("showtime").GetProperty("id").GetString()).ToArray();
    }

    [Fact]
    public async Task Tool_inventory_dates_catalogues_and_empty_film_use_the_public_contract()
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        using var list = await Rpc(http, "tools/list", new { });
        var tools = list.RootElement.GetProperty("result").GetProperty("tools").EnumerateArray().ToArray();
        Assert.Equal(new[] { "add_to_watchlist", "find_films", "get_film_showtimes", "get_specials", "list_cinemas",
            "list_watched_movies", "list_watchlist", "mark_movie_watched", "now_showing", "search_screenings", "upcoming_films" },
            tools.Select(t => t.GetProperty("name").GetString()).Order(StringComparer.Ordinal));
        Assert.All(tools, tool =>
        {
            var name = tool.GetProperty("name").GetString();
            var annotations = tool.GetProperty("annotations");
            var writes = name is "mark_movie_watched" or "add_to_watchlist";
            Assert.Equal(!writes, annotations.GetProperty("readOnlyHint").GetBoolean());
            if (writes) Assert.True(annotations.GetProperty("idempotentHint").GetBoolean());
        });

        var first = await Call(http, "list_cinemas", new { limit = 1 });
        Assert.Equal(1, first.GetProperty("nextOffset").GetInt32());
        var second = await Call(http, "list_cinemas", new { offset = 1, limit = 1 });
        Assert.Equal("kino", second.GetProperty("items")[0].GetProperty("id").GetString());
        var film = await Call(http, "get_film_showtimes", new { filmId = "film", city = "Amsterdam" });
        Assert.Equal(2, film.GetProperty("total").GetInt32());
        var unavailable = await http.GetFromJsonAsync<JsonElement>("/api/cineville/films/unknown/showtimes");
        Assert.Equal(JsonValueKind.Null, unavailable.ValueKind);
        var upcoming = await Call(http, "upcoming_films", new { });
        Assert.Equal(2, upcoming.GetProperty("total").GetInt32());
        Assert.Equal("2099-11-19", upcoming.GetProperty("items")[0].GetProperty("premiereDate").GetString());
        Assert.Equal(3, (await Call(http, "now_showing", new { city = "Amsterdam" })).GetProperty("total").GetInt32());
        var specials = await Call(http, "get_specials", new { startDate = "2026-11-19", category = "Discussion" });
        Assert.Contains(specials.GetProperty("categories").EnumerateArray(), c => c.GetString() == "Discussion");
        Assert.Equal(1, specials.GetProperty("screenings").GetProperty("total").GetInt32());
        Assert.Equal("Panel", specials.GetProperty("screenings").GetProperty("items")[0].GetProperty("title").GetString());
        var noCity = await http.GetFromJsonAsync<JsonElement>("/api/cineville/screenings?city=Missing");
        Assert.Equal(0, noCity.GetProperty("total_results").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await http.GetAsync("/api/cineville/screenings?startDate=2026-02-30")).StatusCode);
        using var invalid = await Rpc(http, "tools/call", new { name = "list_cinemas", arguments = new { limit = 101 } });
        Assert.True(invalid.RootElement.GetProperty("result").GetProperty("isError").GetBoolean());
    }

    [Theory]
    [InlineData("2026-03-29", "2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z")]
    [InlineData("2026-10-25", "2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z")]
    public async Task Amsterdam_days_follow_daylight_saving(string day, string start, string end)
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        var response = await http.GetAsync($"/api/cineville/screenings?startDate={day}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(upstream.Requests.First(r => r.Path == "/events/search").Body!);
        var range = body.RootElement.GetProperty("startDate");
        Assert.Equal(start, range.GetProperty("gte").GetString());
        Assert.Equal(end, range.GetProperty("lt").GetString());
    }

    [Theory]
    [InlineData("https://other.example/events/search?page=2")]
    [InlineData("/venues?page=2")]
    [InlineData("/events/search")]
    public async Task Invalid_cursor_chains_fail_without_caching_partial_data(string cursor)
    {
        using var upstream = new ProgrammeUpstream { CursorOverride = cursor };
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        const string path = "/api/cineville/screenings?startDate=2026-11-19";
        Assert.Equal(HttpStatusCode.BadGateway, (await http.GetAsync(path)).StatusCode);
        upstream.CursorOverride = null;
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync(path)).StatusCode);
        Assert.Equal(2, upstream.Requests.Count(r => r.Path == "/events/search"));
    }

    [Fact]
    public async Task Cache_can_be_disabled_and_Mcp_rejects_an_unknown_browser_origin()
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream, venueCacheSeconds: "0");
        using var http = factory.CreateClient();
        await http.GetFromJsonAsync<JsonElement>("/api/cineville/cinemas");
        await Call(http, "list_cinemas", new { });
        Assert.Equal(4, upstream.Requests.Count(r => r.Path.StartsWith("/venues", StringComparison.Ordinal)));

        http.DefaultRequestHeaders.Add("Authorization", "Bearer " + GatewayCredential);
        http.DefaultRequestHeaders.Add("Origin", "https://unknown.example");
        using var response = await http.PostAsJsonAsync("/mcp", new { method = "tools/list" });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Expired_cache_is_refetched()
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream, venueCacheSeconds: "1");
        using var http = factory.CreateClient();
        await http.GetFromJsonAsync<JsonElement>("/api/cineville/cinemas");
        await Task.Delay(TimeSpan.FromSeconds(1.1));
        await http.GetFromJsonAsync<JsonElement>("/api/cineville/cinemas");
        Assert.Equal(4, upstream.Requests.Count);
    }

    private static WebApplicationFactory<Program> Factory(ProgrammeUpstream upstream, string venueCacheSeconds = "900",
        string eventCacheSeconds = "60", TimeProvider? clock = null) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("App:Origin", "https://cinecompass.example");
            builder.UseSetting("ScreeningNotifications:Enabled", "false");
            TestKeycloakSettings.Configure(builder);
            builder.UseSetting("Cineville:McpGatewaySecret", GatewayCredential);
            builder.UseSetting("ConnectionStrings:Database", "Host=localhost;Database=test;Username=test");
            builder.UseSetting("Cineville:CacheSeconds:venues", venueCacheSeconds);
            builder.UseSetting("Cineville:CacheSeconds:events", eventCacheSeconds);
            builder.ConfigureServices(services =>
            {
                services.Replace(ServiceDescriptor.Singleton<TimeProvider>(clock ?? new ProgrammeClock()));
                services.AddHttpClient("Cineville").ConfigurePrimaryHttpMessageHandler(() => upstream);
            });
        });

    private static async Task<JsonElement> Call(HttpClient http, string name, object arguments)
    {
        using var document = await Rpc(http, "tools/call", new { name, arguments });
        var result = document.RootElement.GetProperty("result");
        Assert.True(result.TryGetProperty("structuredContent", out var structured), result.GetRawText());
        return structured.Clone();
    }

    private static async Task<JsonDocument> Rpc(HttpClient http, string method, object parameters)
    {
        var args = JsonSerializer.SerializeToElement(parameters).EnumerateObject().ToDictionary(p => p.Name, p => (object)p.Value);
        args["_meta"] = new Dictionary<string, object>
        {
            ["io.modelcontextprotocol/protocolVersion"] = "2026-07-28",
            ["io.modelcontextprotocol/clientCapabilities"] = new { },
            ["io.modelcontextprotocol/clientInfo"] = new { name = "ProgrammeTests", version = "1.0" }
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, "/mcp");
        request.Headers.Authorization = new("Bearer", GatewayCredential);
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Accept.ParseAdd("text/event-stream");
        request.Content = JsonContent.Create(new { jsonrpc = "2.0", id = 1, method, @params = args });
        using var response = await http.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var text = await response.Content.ReadAsStringAsync();
        if (response.Content.Headers.ContentType?.MediaType == "text/event-stream")
            text = text.Split('\n').Single(line => line.StartsWith("data: ", StringComparison.Ordinal))[6..];
        return JsonDocument.Parse(text);
    }

    private sealed class ProgrammeClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 11, 18, 23, 30, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
