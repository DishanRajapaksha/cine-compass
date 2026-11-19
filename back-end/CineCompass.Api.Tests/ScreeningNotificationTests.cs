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
        Assert.Empty(new ReminderSettings(365, [], ["club"]).IncludedFilms(settings));
        Assert.Equal("film", Assert.Single(new ReminderSettings(365, ["film"], ["club"]).IncludedFilms(settings)));
        Assert.Equal("older", Assert.Single(new ReminderSettings(365, [], ["watched"]).IncludedFilms(settings)));
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
        await Save(alice, "alice", 1, lists, ["film"]); // matching both the film and the list
        await Save(bob, "bob", 30, watchedLists, ["film"]); // the individual reminder survives the list's filter

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
        Assert.Equal(2, aliceNotices.GetProperty("unread").GetInt32());
        Assert.Equal(new[] { "early", "late", "later-window" }, Ids(await Inbox(bob)));
        await Scan();
        Assert.Equal(2, upstream.Requests.Count(request => request.Path.StartsWith("/events/search", StringComparison.Ordinal)));

        var head = aliceNotices.GetProperty("items")[0].GetProperty("id").GetInt64();
        using var read = await alice.PostAsJsonAsync("/api/notifications/read", new { through = head });
        Assert.Equal(HttpStatusCode.NoContent, read.StatusCode);
        Assert.Equal(0, (await Inbox(alice)).GetProperty("unread").GetInt32());
        Assert.Equal(3, (await Inbox(bob)).GetProperty("unread").GetInt32());

        clock.Now = DateTimeOffset.Parse("2026-11-20T07:05:00Z");
        await Scan();
        Assert.Equal(new[] { "early", "late" }, Ids(await Inbox(alice)));
        Assert.Equal(new[] { "early", "late", "later-window" }, Ids(await Inbox(bob)));
        Assert.Equal(0, (await Inbox(alice)).GetProperty("unread").GetInt32());

        // The first page is bounded, but the earlier read notifications remain accessible.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ScreeningNotifications.AddRange(Enumerable.Range(1, 25).Select(i => new ScreeningNotification
            {
                UserId = "alice", ScreeningId = $"new-{i}", FilmId = "film",
                FilmTitle = "A Film", StartsAt = clock.Now.AddDays(i), FoundAt = clock.Now
            }));
            await db.SaveChangesAsync();
        }
        var newestPage = await Inbox(alice);
        Assert.Equal(25, newestPage.GetProperty("items").GetArrayLength());
        var cursor = newestPage.GetProperty("nextBefore").GetInt64();
        var olderPage = await alice.GetFromJsonAsync<JsonElement>($"/api/notifications?before={cursor}");
        Assert.Equal(new[] { "early", "late" }, Ids(olderPage));
        Assert.All(olderPage.GetProperty("items").EnumerateArray(), item => Assert.True(item.GetProperty("isRead").GetBoolean()));

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

    private static async Task Save(HttpClient client, string userId, int lookAheadDays, string lists, string[] filmIds)
    {
        var values = new Dictionary<string, string>
        {
            ["cinecompass_movie_lists"] = lists,
            [ReminderSettings.Key] = JsonSerializer.Serialize(new { lookAheadDays, filmIds, listIds = new[] { "club" } })
        };
        using var response = await client.PutAsJsonAsync("/api/settings", new { userId, revision = 0, values });
        response.EnsureSuccessStatusCode();
    }

    private sealed class MutableClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; }
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
