using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CineCompass.Api;
using Xunit;

public sealed class CalendarTests
{
    private static async Task<HttpClient> Client(ApiFactory factory, string? user = null)
    {
        var client = factory.CreateClient(new() { AllowAutoRedirect = false });
        if (user is not null) client.DefaultRequestHeaders.Add("Test-User", user);
        client.DefaultRequestHeaders.Add("Origin", "http://localhost:3000");
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        return client;
    }
    private static object Settings(long revision, params object[] screenings) => new {
        userId = "alice", revision, values = new Dictionary<string,string> { ["cineville_saved_showtimes"] = JsonSerializer.Serialize(screenings) }
    };
    private static object Screening(string id, string title, string start = "2026-10-24T23:30:00+02:00", string end = "2026-10-25T02:30:00+01:00") => new {
        showtimeId = id, movieTitle = title, startDate = start, endDate = end, theaterName = "Eye", theaterCity = "Amsterdam", ticketingUrl = "https://tickets.example/" + id
    };
    [Fact] public async Task Subscription_is_private_owner_scoped_stable_and_revocable()
    {
        using var f = new ApiFactory(); await f.Seed();
        using var alice = await Client(f, "alice"); using var bob = await Client(f, "bob"); using var guest = await Client(f);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/calendar/subscription")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PostAsJsonAsync("/api/calendar/subscription", new {reminderMinutes=15})).StatusCode);
        var created = await alice.PostAsJsonAsync("/api/calendar/subscription", new {reminderMinutes=30}); created.EnsureSuccessStatusCode();
        var state = await created.Content.ReadFromJsonAsync<JsonElement>();
        var path = new Uri(state.GetProperty("url").GetString()!).PathAndQuery;
        var restored = await alice.GetFromJsonAsync<JsonElement>("/api/calendar/subscription");
        Assert.Equal(state.GetProperty("url").GetString(), restored.GetProperty("url").GetString());
        Assert.False((await bob.GetFromJsonAsync<JsonElement>("/api/calendar/subscription")).GetProperty("enabled").GetBoolean());
        (await alice.PutAsJsonAsync("/api/settings", Settings(0, Screening("one", "First"), Screening("two", "Second", "2026-10-25T03:00:00+01:00", "2026-10-25T05:00:00+01:00")))).EnsureSuccessStatusCode();
        // A calendar client needs neither a session nor an Origin header.
        using var calendar = f.CreateClient();
        var response = await calendar.GetAsync(path); response.EnsureSuccessStatusCode();
        Assert.Equal("text/calendar", response.Content.Headers.ContentType!.MediaType);
        Assert.True(response.Headers.CacheControl!.NoStore);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Equal(2, content.Split("BEGIN:VEVENT").Length - 1);
        Assert.Equal(2, content.Split("TRIGGER:-PT30M").Length - 1);
        Assert.Contains("DTSTART:20261024T213000Z\r\nDTEND:20261025T013000Z", content);
        Assert.Contains("URL:https://tickets.example/one", content);
        Assert.Contains("URL:https://tickets.example/two", content);
        var uid = content.Split("\r\n").First(l => l.StartsWith("UID:"));
        (await alice.PutAsJsonAsync("/api/settings", Settings(1, Screening("one", "Changed title")))).EnsureSuccessStatusCode();
        var updated = await calendar.GetStringAsync(path);
        Assert.Equal(1, updated.Split("BEGIN:VEVENT").Length - 1);
        Assert.Contains("SUMMARY:Changed title", updated); Assert.Contains(uid, updated); Assert.Contains("SEQUENCE:3", updated);
        (await alice.PostAsJsonAsync("/api/calendar/subscription", new {reminderMinutes=(int?)null})).EnsureSuccessStatusCode();
        Assert.DoesNotContain("VALARM", await calendar.GetStringAsync(path));
        Assert.Equal(HttpStatusCode.OK, (await calendar.SendAsync(new HttpRequestMessage(HttpMethod.Head,path))).StatusCode);
        (await bob.DeleteAsync("/api/calendar/subscription")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await calendar.GetAsync(path)).StatusCode);
        (await alice.DeleteAsync("/api/calendar/subscription")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await calendar.GetAsync(path)).StatusCode);
        var again = await alice.PostAsJsonAsync("/api/calendar/subscription",new {reminderMinutes=15});again.EnsureSuccessStatusCode();
        Assert.NotEqual(state.GetProperty("url").GetString(), (await again.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("url").GetString());
    }
    [Fact] public async Task Subscription_mutations_validate_reminders_csrf_and_origin()
    {
        using var f=new ApiFactory();await f.Seed();using var alice=await Client(f,"alice");
        Assert.Equal(HttpStatusCode.BadRequest,(await alice.PostAsJsonAsync("/api/calendar/subscription",new {reminderMinutes=-1})).StatusCode);
        alice.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest,(await alice.PostAsJsonAsync("/api/calendar/subscription",new {reminderMinutes=15})).StatusCode);
        alice.DefaultRequestHeaders.Remove("Origin");alice.DefaultRequestHeaders.Add("Origin","https://evil.example");
        Assert.Equal(HttpStatusCode.Forbidden,(await alice.DeleteAsync("/api/calendar/subscription")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await alice.GetAsync("/api/calendar/feed/not-a-token.ics")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await alice.GetAsync("/api/calendar/feed/"+new string('a',43)+".ics")).StatusCode);
    }
    [Fact] public void Feed_escapes_and_folds_unicode_and_ignores_invalid_screenings()
    {
        var title="Film, a; b\\c\n"+string.Concat(Enumerable.Repeat("🎬漢字é",40));
        var values=new Dictionary<string,string>{["cineville_saved_showtimes"]=JsonSerializer.Serialize(new [] {Screening("one",title),Screening("bad","Invalid", "not-a-date"),Screening("same","Invalid end","2026-10-04T10:00:00Z","2026-10-04T10:00:00Z")})};
        var content=CalendarFeed.Render(new CalendarSubscription{UserId="alice",CreatedAt=DateTimeOffset.UtcNow},new UserSettings{Json=JsonSerializer.Serialize(values)});
        Assert.Equal(1,content.Split("BEGIN:VEVENT").Length-1);
        Assert.Contains("SUMMARY:Film\\, a\\; b\\\\c\\n",content.Replace("\r\n ",""));
        foreach(var line in content.Split("\r\n")) Assert.True(Encoding.UTF8.GetByteCount(line)<=75);
        Assert.EndsWith("END:VCALENDAR\r\n",content);
        Assert.DoesNotContain("BEGIN:VEVENT",CalendarFeed.Render(new CalendarSubscription(),new UserSettings{Json="invalid json"}));
    }
}
