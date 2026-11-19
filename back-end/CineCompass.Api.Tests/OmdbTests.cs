using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CineCompass.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public sealed partial class AccountTests
{
    [Fact]
    public async Task Omdb_key_is_encrypted_owner_scoped_and_used_only_for_server_lookups()
    {
        const string key = "test-key";
        using var database = new ApiFactory();
        await database.Seed();
        using var upstream = new OmdbHandler();
        using var factory = database.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddHttpClient(Omdb.ClientName).ConfigurePrimaryHttpMessageHandler(() => upstream)));
        using var alice = await Client(factory, "alice");
        using var bob = await Client(factory, "bob");
        using var guest = await Client(factory);

        const string endpoint = "/api/imdb/key";
        const string lookup = "/api/imdb/film?userId=alice&title=Akira&year=1988";
        var body = new { userId = "alice", key };
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PutAsJsonAsync(endpoint, body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await bob.PutAsJsonAsync(endpoint, body)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await alice.PutAsJsonAsync(endpoint, body)).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var row = await db.OmdbCredentials.SingleAsync();
            Assert.Equal("alice", row.UserId);
            Assert.DoesNotContain(key, row.ProtectedKey);
        }

        var settings = await alice.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.True(settings.GetProperty("omdbConfigured").GetBoolean());
        Assert.DoesNotContain(key, settings.GetRawText());
        Assert.False((await bob.GetFromJsonAsync<JsonElement>("/api/settings")).GetProperty("omdbConfigured").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await bob.GetAsync(lookup)).StatusCode);
        Assert.Null(upstream.ReceivedKey);

        var film = await alice.GetFromJsonAsync<JsonElement>(lookup);
        Assert.Equal("tt0094625", film.GetProperty("imdbID").GetString());
        Assert.Equal("True", film.GetProperty("Response").GetString());
        Assert.DoesNotContain(key, film.GetRawText());
        Assert.Equal(key, upstream.ReceivedKey);

        Assert.Equal(HttpStatusCode.NoContent,
            (await alice.PutAsJsonAsync(endpoint, new { userId = "alice", key = (string?)null })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await alice.GetAsync(lookup)).StatusCode);
    }

    private sealed class OmdbHandler : HttpMessageHandler
    {
        public string? ReceivedKey { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Assert.Equal("www.omdbapi.com", request.RequestUri!.Host);
            var query = QueryHelpers.ParseQuery(request.RequestUri.Query);
            ReceivedKey = query["apikey"].ToString();
            Assert.Equal("Akira", query["t"].ToString());
            Assert.Equal("1988", query["y"].ToString());
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new { Response = "True", imdbID = "tt0094625", imdbRating = "8.0", Year = "1988" })
            });
        }
    }
}
