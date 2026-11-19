using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CineCompass.Api;
using CineCompass.Api.Cineville;
using CineCompass.Api.Notifications;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

public sealed class ScreeningNotificationTests
{
    [Fact]
    public void Whole_list_reminders_respect_watched_visibility_and_individual_reminders_are_independent()
    {
        const string lists = """
            [{"id":"watched","name":"Watched","films":[{"id":"older","title":"A Film","year":2025,"posterPath":""}]},{"id":"club","name":"Film club","hideWatched":true,"films":[{"id":"film","title":"A Film","year":2025,"posterPath":""}]}]
            """;
        var settings = MovieListSettings.Parse(JsonSerializer.Serialize(new Dictionary<string, string> { [MovieListSettings.Key] = lists }));
        Assert.Empty(ReminderSettings.Parse("""{"lookAheadDays":365,"filmIds":[],"listIds":["club"]}""")!.FilmRules(settings));
        Assert.Equal("film", Assert.Single(ReminderSettings.Parse("""{"lookAheadDays":365,"filmIds":["film"],"listIds":["club"]}""")!.FilmRules(settings)).FilmId);
        Assert.Equal("older", Assert.Single(ReminderSettings.Parse("""{"lookAheadDays":365,"filmIds":[],"listIds":["watched"]}""")!.FilmRules(settings)).FilmId);
    }

    [Fact]
    public async Task Daily_scan_respects_account_windows_and_keeps_owned_history_after_screenings()
    {
        using var upstream = new ProgrammeUpstream { FarScreeningDate = "2026-12-19" };
        using var database = new ApiFactory();
        var clock = new MutableClock { Now = DateTimeOffset.Parse("2026-11-19T06:59:00Z") };
        using var factory = database.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton<TimeProvider>(clock));
            services.AddHttpClient("Cineville").ConfigurePrimaryHttpMessageHandler(() => upstream);
        }));
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.EnsureCreatedAsync();
            db.Users.AddRange(new AppUser { Id = "alice", UserName = "alice" }, new AppUser { Id = "bob", UserName = "bob" });
            await db.SaveChangesAsync();
        }

        using var alice = await Account("alice");
        using var bob = await Account("bob");
        using var guest = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/notifications")).StatusCode);
        const string lists = """
            [{"id":"club","name":"Film club","films":[{"id":"film","title":"A Film","year":2025,"posterPath":""}]}]
            """;
        const string watchedLists = """
            [{"id":"watched","name":"Watched","films":[{"id":"old-id","title":"A Film","year":2025,"posterPath":""}]},{"id":"club","name":"Film club","hideWatched":true,"films":[{"id":"film","title":"A Film","year":2025,"posterPath":""}]}]
            """;
        using var invalid = await alice.PutAsJsonAsync("/api/settings", new
        {
            userId = "alice", revision = 0, values = new Dictionary<string, string>
            {
                [ReminderSettings.Key] = """{"lookAheadDays":366,"filmIds":[],"listIds":[]}"""
            }
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Null(ReminderSettings.Parse("""{"lookAheadDays":30,"filmIds":[],"listIds":[],"city":" Amsterdam "}"""));
        Assert.Null(ReminderSettings.Parse("""{"lookAheadDays":30,"filmIds":["film"],"listIds":[],"filmFilters":{"film":{"lookAheadDays":0}}}"""));
        await Save(alice, "alice", lists, """
            {"lookAheadDays":45,"city":"Rotterdam","languageMatchMode":"all","filmIds":["film"],"listIds":["club"],
             "filmFilters":{"film":{"lookAheadDays":1,"city":"amsterdam","selectedSpokenLanguages":["fr"],"selectedSubtitleLanguages":[]}},
             "listFilters":{"club":{"lookAheadDays":1,"city":"Amsterdam","languageMatchMode":"all","selectedSpokenLanguages":["ja"],"selectedSubtitleLanguages":["en"]}}}
            """);
        await Save(bob, "bob", watchedLists, """{"lookAheadDays":30,"filmIds":["film"],"listIds":["club"]}""");

        await Scan();
        Assert.Empty(upstream.Requests);
        clock.Now = DateTimeOffset.Parse("2026-11-19T07:00:00Z"); // 08:00 Amsterdam
        await Scan();
        var eventRequests = upstream.Requests.Where(request => request.Path.StartsWith("/events/search", StringComparison.Ordinal)).ToArray();
        Assert.Equal(2, eventRequests.Length); // One film request with two pages, shared by both accounts.
        using var body = JsonDocument.Parse(eventRequests[0].Body!);
        Assert.Equal(DateTimeOffset.Parse("2026-12-19T23:00:00Z"),
            body.RootElement.GetProperty("startDate").GetProperty("lt").GetDateTimeOffset());

        var aliceNotices = await Inbox(alice);
        Assert.Equal(new[] { "early", "late" }, Ids(aliceNotices));
        Assert.Equal(1, aliceNotices.GetProperty("unread").GetInt32());
        var late = aliceNotices.GetProperty("items").EnumerateArray().Single(item => item.GetProperty("screeningId").GetString() == "late");
        Assert.Equal("fr", late.GetProperty("audioLanguages")[0].GetString());
        Assert.Equal("en", late.GetProperty("subtitleLanguages")[0].GetString());
        Assert.Equal("Amsterdam", late.GetProperty("theaterCity").GetString());
        Assert.Equal("Eye Filmmuseum", late.GetProperty("theaterName").GetString());
        Assert.Equal(new[] { "late", "later-window", "rotterdam", "rotterdam-audio" }, Ids(await Inbox(bob)));
        await Scan();
        Assert.Equal(2, upstream.Requests.Count(request => request.Path.StartsWith("/events/search", StringComparison.Ordinal)));

        var head = aliceNotices.GetProperty("items")[0].GetProperty("id").GetInt64();
        using var read = await alice.PostAsJsonAsync("/api/notifications/read", new { through = head });
        Assert.Equal(HttpStatusCode.NoContent, read.StatusCode);
        Assert.Equal(0, (await Inbox(alice)).GetProperty("unread").GetInt32());
        Assert.Equal(1, (await Inbox(bob)).GetProperty("unread").GetInt32());

        // A legacy notice can pick up language evidence without changing its alert or read status.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var legacy = db.ScreeningNotifications.Single(row => row.UserId == "bob" && row.ScreeningId == "later-window");
            legacy.SubtitleLanguages = null;
            legacy.SubtitleStatus = null;
            legacy.IsRead = true;
            await db.SaveChangesAsync();
        }
        clock.Now = DateTimeOffset.Parse("2026-11-20T07:05:00Z");
        await Scan();
        Assert.Equal(new[] { "early", "late" }, Ids(await Inbox(alice)));
        var bobNotices = await Inbox(bob);
        Assert.Equal(new[] { "late", "later-window", "rotterdam", "rotterdam-audio" }, Ids(bobNotices));
        var refreshed = bobNotices.GetProperty("items").EnumerateArray().Single(item => item.GetProperty("screeningId").GetString() == "later-window");
        Assert.Equal("en", refreshed.GetProperty("subtitleLanguages")[0].GetString());
        Assert.Equal(DateTimeOffset.Parse("2026-11-19T07:00:00Z"), refreshed.GetProperty("foundAt").GetDateTimeOffset());
        Assert.True(refreshed.GetProperty("isRead").GetBoolean());
        Assert.Equal(0, (await Inbox(alice)).GetProperty("unread").GetInt32());

        await Save(bob, "bob", "[]", """{"lookAheadDays":30,"filmIds":[],"listIds":[]}""", revision: 1);
        upstream.IncludeNewReminderScreenings = true;
        clock.Now = DateTimeOffset.Parse("2026-11-21T07:05:00Z");
        await Scan();
        using var citySearch = JsonDocument.Parse(upstream.Requests.Last(request => request.Path.StartsWith("/events/search", StringComparison.Ordinal)).Body!);
        Assert.Equal("eye", citySearch.RootElement.GetProperty("venueId").GetProperty("in").EnumerateArray().Single().GetString());
        var newNotices = await Inbox(alice);
        Assert.Equal(new[] { "early", "late", "new-early", "new-late" }, Ids(newNotices));
        var unread = await alice.GetFromJsonAsync<JsonElement>("/api/notifications/unread");
        Assert.Equal(1, unread.GetProperty("unread").GetInt32());
        var discoveries = newNotices.GetProperty("items").EnumerateArray().Where(item => !item.GetProperty("isRead").GetBoolean()).ToArray();
        Assert.Equal(2, discoveries.Length);
        Assert.Single(discoveries.Select(item => item.GetProperty("foundAt").GetDateTimeOffset()).Distinct());
        var newEarly = discoveries.Single(item => item.GetProperty("screeningId").GetString() == "new-early");
        Assert.Equal("ja", newEarly.GetProperty("audioLanguages")[0].GetString());
        var newLate = discoveries.Single(item => item.GetProperty("screeningId").GetString() == "new-late");
        Assert.Equal("none", newLate.GetProperty("subtitleStatus").GetString());

        // A page holds whole alerts, including one with more than 25 showtimes.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ScreeningNotifications.AddRange(Enumerable.Range(1, 50).Select(i => new ScreeningNotification
            {
                UserId = "alice", ScreeningId = $"fixture-{i}", FilmId = "film",
                FilmTitle = "A Film", StartsAt = clock.Now.AddDays(i), FoundAt = clock.Now.AddMinutes(Math.Min(i, 25))
            }));
            await db.SaveChangesAsync();
        }
        var newestPage = await Inbox(alice);
        Assert.Equal(50, newestPage.GetProperty("items").GetArrayLength());
        var cursor = newestPage.GetProperty("nextBefore").GetInt64();
        var olderPage = await alice.GetFromJsonAsync<JsonElement>($"/api/notifications?before={cursor}");
        Assert.Equal(new[] { "early", "late", "new-early", "new-late" }, Ids(olderPage));
        Assert.Equal(2, olderPage.GetProperty("items").EnumerateArray().Count(item => item.GetProperty("isRead").GetBoolean()));

        async Task<HttpClient> Account(string user)
        {
            var client = factory.CreateClient();
            client.DefaultRequestHeaders.Add("Test-User", user);
            client.DefaultRequestHeaders.Add("Origin", "http://localhost:3000");
            var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
            client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
            return client;
        }

        async Task Scan()
        {
            using var scope = factory.Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ScreeningNotificationScanner>().CheckDue(CancellationToken.None);
        }
    }

    private static Task<JsonElement> Inbox(HttpClient client) => client.GetFromJsonAsync<JsonElement>("/api/notifications");

    private static string?[] Ids(JsonElement inbox) => inbox.GetProperty("items").EnumerateArray()
        .Select(item => item.GetProperty("screeningId").GetString()).Order(StringComparer.Ordinal).ToArray();

    private static async Task Save(HttpClient client, string userId, string lists, string reminders, long revision = 0)
    {
        var values = new Dictionary<string, string>
        {
            ["cinecompass_movie_lists"] = lists,
            [ReminderSettings.Key] = reminders
        };
        using var response = await client.PutAsJsonAsync("/api/settings", new { userId, revision, values });
        response.EnsureSuccessStatusCode();
    }

    private sealed class MutableClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; }
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
