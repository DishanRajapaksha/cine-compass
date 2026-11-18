using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

public sealed partial class ProgrammeTests
{
    [Fact]
    public async Task Catalogue_search_pages_through_fuzzy_matches_without_requesting_screenings()
    {
        using var upstream = new ProgrammeUpstream();
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();
        const string search = "/api/cineville/films/search?q=A%3FFilm";

        var first = await http.GetFromJsonAsync<JsonElement>(search);
        var movie = Assert.Single(first.GetProperty("results").EnumerateArray());
        Assert.Equal("A Film", movie.GetProperty("title").GetString());
        Assert.Equal("English description", movie.GetProperty("overview").GetString());
        Assert.Empty(movie.GetProperty("showtimes").EnumerateArray());
        var cursor = first.GetProperty("nextCursor").GetString();
        Assert.Equal("next", cursor);
        Assert.Single(upstream.Requests);

        var second = await http.GetFromJsonAsync<JsonElement>(search + "&cursor=" + cursor);
        Assert.Equal("Film Club", second.GetProperty("results")[0].GetProperty("title").GetString());
        Assert.Equal(JsonValueKind.Null, second.GetProperty("nextCursor").ValueKind);
        Assert.Equal(2, upstream.Requests.Count);
        Assert.All(upstream.Requests, request =>
        {
            Assert.StartsWith("/productions/by-title/A%3FFilm?", request.Path);
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Null(request.Body);
        });
    }

    [Fact]
    public async Task Catalogue_search_rejects_invalid_input_and_reports_a_broken_upstream_cursor()
    {
        using var upstream = new ProgrammeUpstream { CursorOverride = "/productions/by-title/unusable" };
        using var factory = Factory(upstream);
        using var http = factory.CreateClient();

        using var emptyTitle = await http.GetAsync("/api/cineville/films/search?q=%20");
        using var invalidCursor = await http.GetAsync("/api/cineville/films/search?q=A%3FFilm&cursor=%3F");
        Assert.Equal(HttpStatusCode.BadRequest, emptyTitle.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalidCursor.StatusCode);
        Assert.Empty(upstream.Requests);

        using var brokenPage = await http.GetAsync("/api/cineville/films/search?q=A%3FFilm");
        Assert.Equal(HttpStatusCode.BadGateway, brokenPage.StatusCode);
    }
}
