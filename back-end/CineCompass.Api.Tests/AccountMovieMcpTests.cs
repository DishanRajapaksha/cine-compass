using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CineCompass.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public sealed partial class ProgrammeTests
{
    [Fact]
    public async Task Movie_tools_read_and_update_only_the_linked_Heimdall_accounts_web_settings()
    {
        using var upstream = new ProgrammeUpstream();
        using var database = new ApiFactory();
        using var factory = database.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Cineville:McpGatewaySecret", GatewayCredential);
            builder.ConfigureServices(s => s.AddHttpClient("Cineville").ConfigurePrimaryHttpMessageHandler(() => upstream));
        });
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.EnsureCreatedAsync();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            foreach (var user in new[] { "alice", "bob", "new-user" })
            {
                var account = new AppUser { Id = user, UserName = user };
                Assert.True((await users.CreateAsync(account)).Succeeded);
                Assert.True((await users.AddLoginAsync(account,
                    new UserLoginInfo(TestKeycloakSettings.Issuer, $"subject-{user}", "Heimdall"))).Succeeded);
            }
            db.Settings.Add(new UserSettings { UserId = "alice", Revision = 7, Json = JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["cinecompass_schedule_view"] = "\"posters\"",
                ["cinecompass_hidden_movies"] = """[{"id":"legacy","title":"Already Watched","year":2024}]""",
                ["cineville_saved_showtimes"] = """[{"movieId":"old","movieTitle":"Older Bookmark","showtimeId":"saved","startDate":"2026-11-18T19:00:00Z","endDate":"2026-11-18T21:00:00Z"}]"""
            }) });
            db.Settings.Add(new UserSettings { UserId = "bob", Json = JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["cineville_saved_showtimes"] = """[{"movieId":"bob-film","movieTitle":"Bob's Film"}]""",
                ["cinecompass_saved_films"] = "[]"
            }) });
            await db.SaveChangesAsync();
        }

        using var alice = LinkedClient("subject-alice");
        using var bob = LinkedClient("subject-bob");
        using var unlinked = LinkedClient("unlinked");
        using var wrongRealm = LinkedClient("subject-alice", "https://other.example/realms/test");
        using var gatewayOnly = factory.CreateClient();
        gatewayOnly.DefaultRequestHeaders.Add("Test-User", "alice");
        await AssertToolError(gatewayOnly, "list_watchlist", new { });
        await AssertToolError(wrongRealm, "list_watched_movies", new { });
        await AssertToolError(unlinked, "add_to_watchlist", new { filmId = "film" });
        Assert.Empty(upstream.Requests);
        using var direct = await alice.PostAsJsonAsync("/mcp", new { method = "tools/list" });
        Assert.Equal(HttpStatusCode.Unauthorized, direct.StatusCode);

        Assert.Equal("old", Assert.Single((await Call(alice, "list_watchlist", new { })).GetProperty("items").EnumerateArray()).GetProperty("id").GetString());
        Assert.Empty((await Call(bob, "list_watchlist", new { })).GetProperty("items").EnumerateArray());
        Assert.Empty((await Call(bob, "list_watched_movies", new { })).GetProperty("items").EnumerateArray());
        Assert.Equal("legacy", Assert.Single((await Call(alice, "list_watched_movies", new { })).GetProperty("items").EnumerateArray()).GetProperty("id").GetString());
        await AssertToolError(alice, "mark_movie_watched", new { filmId = "missing" });
        Assert.True((await Call(alice, "add_to_watchlist", new { filmId = "film" })).GetProperty("changed").GetBoolean());
        Assert.False((await Call(alice, "add_to_watchlist", new { filmId = "film" })).GetProperty("changed").GetBoolean());

        var firstPage = await Call(alice, "list_watchlist", new { limit = 1 });
        Assert.Equal(2, firstPage.GetProperty("total").GetInt32());
        var cursor = firstPage.GetProperty("nextCursor").GetString();
        await AssertToolError(bob, "list_watchlist", new { cursor });
        Assert.Equal("film", (await Call(alice, "list_watchlist", new { cursor })).GetProperty("items")[0].GetProperty("id").GetString());

        Assert.True((await Call(alice, "mark_movie_watched", new { filmId = "film" })).GetProperty("changed").GetBoolean());
        Assert.False((await Call(alice, "mark_movie_watched", new { filmId = "film" })).GetProperty("changed").GetBoolean());
        Assert.Equal(2, (await Call(alice, "list_watched_movies", new { })).GetProperty("total").GetInt32());
        Assert.Equal(1, (await Call(alice, "list_watchlist", new { })).GetProperty("total").GetInt32());

        using var newcomer = LinkedClient("subject-new-user");
        Assert.True((await Call(newcomer, "add_to_watchlist", new { filmId = "film" })).GetProperty("changed").GetBoolean());
        Assert.Equal(1, (await Call(newcomer, "list_watchlist", new { })).GetProperty("total").GetInt32());

        alice.DefaultRequestHeaders.Add("Test-User", "alice");
        var settings = await alice.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal(9, settings.GetProperty("revision").GetInt64());
        var values = settings.GetProperty("values");
        Assert.False(values.TryGetProperty("cinecompass_hidden_movies", out _));
        using var watchedFilms = JsonDocument.Parse(values.GetProperty("cinecompass_watched_movies").GetString()!);
        Assert.Equal(new[] { "legacy", "film" }, watchedFilms.RootElement.EnumerateArray().Select(f => f.GetProperty("id").GetString()));
        Assert.Equal("\"posters\"", values.GetProperty("cinecompass_schedule_view").GetString());
        using var storedFilms = JsonDocument.Parse(values.GetProperty("cinecompass_saved_films").GetString()!);
        Assert.Equal(new[] { "old", "film" }, storedFilms.RootElement.EnumerateArray().Select(f => f.GetProperty("id").GetString()));
        Assert.Equal("https://images.example/film.jpg", storedFilms.RootElement[1].GetProperty("posterPath").GetString());

        HttpClient LinkedClient(string subject, string issuer = TestKeycloakSettings.Issuer)
        {
            var http = factory.CreateClient();
            http.DefaultRequestHeaders.Add("X-CineCompass-Issuer", issuer);
            http.DefaultRequestHeaders.Add("X-CineCompass-Subject", subject);
            return http;
        }
    }
}
