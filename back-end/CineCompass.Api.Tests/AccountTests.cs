using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using CineCompass.Api;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

public sealed class ApiFactory(bool production = false, TestHeimdall? heimdall = null) : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        connection.Open();
        builder.UseEnvironment(production ? "Production" : "Development").UseSetting("ConnectionStrings:Database", "Host=localhost;Database=test;Username=test").UseSetting("App:Origin", production ? "https://localhost:3000" : "http://localhost:3000").UseSetting("DataProtection:Path", Path.Combine(Path.GetTempPath(), "cinecompass-test-keys"));
        builder.UseSetting("ScreeningNotifications:Enabled", "false");
        TestKeycloakSettings.Configure(builder);
        builder.ConfigureServices(services => {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o.UseSqlite(connection));
            if (heimdall is null)
                services.AddAuthentication(o => o.DefaultAuthenticateScheme = "Test")
                    .AddScheme<AuthenticationSchemeOptions, TestAuth>("Test", _ => { });
            else
                services.Configure<OpenIdConnectOptions>("Heimdall", heimdall.Configure);
        });
    }
    public async Task Seed()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        await users.CreateAsync(new AppUser { Id = "alice", UserName = "alice" });
        await users.CreateAsync(new AppUser { Id = "bob", UserName = "bob" });
    }
    protected override void Dispose(bool disposing) { base.Dispose(disposing); if (disposing) connection.Dispose(); }
}
public sealed class TestAuth(IOptionsMonitor<AuthenticationSchemeOptions> o, ILoggerFactory l, UrlEncoder e) : AuthenticationHandler<AuthenticationSchemeOptions>(o,l,e)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var user = Request.Headers["Test-User"].FirstOrDefault();
        return Task.FromResult(user is null ? AuthenticateResult.NoResult() : AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,user)], "Test")), "Test")));
    }
}
public sealed partial class AccountTests
{
    private static async Task<HttpClient> Client(WebApplicationFactory<Program> factory, string? user = null)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        if(user is not null) client.DefaultRequestHeaders.Add("Test-User",user);
        client.DefaultRequestHeaders.Add("Origin","http://localhost:3000");
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN",csrf.GetProperty("token").GetString());
        return client;
    }
    [Fact] public async Task Settings_require_login_and_password_endpoints_do_not_exist()
    {
        using var f = new ApiFactory(); await f.Seed();using var c = await Client(f);
        Assert.Equal(HttpStatusCode.Unauthorized,(await c.GetAsync("/api/settings")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await c.PostAsJsonAsync("/api/auth/password",new {})).StatusCode);
    }
    [Fact] public async Task Settings_are_owner_scoped_and_stale_updates_cannot_overwrite()
    {
        using var f = new ApiFactory(); await f.Seed();using var alice = await Client(f,"alice");using var bob = await Client(f,"bob");
        var body = new { userId="alice", revision=0, values=new Dictionary<string,string> {
            ["cinecompass_schedule_view"]="\"compact\"",
            ["cinecompass_saved_films"]="[{\"id\":\"film\",\"title\":\"A Film\",\"posterPath\":\"\"}]",
            ["cinecompass_cinema_lists"]="""[{"name":"Weekend","theaterIds":["eye","rialto"]},{"name":"Utrecht","theaterIds":["springhaver"]}]"""
        } };
        Assert.Equal(HttpStatusCode.OK,(await alice.PutAsJsonAsync("/api/settings",body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await bob.PutAsJsonAsync("/api/settings",body)).StatusCode);
        var saved = await alice.GetFromJsonAsync<JsonElement>("/api/settings");
        using var lists = JsonDocument.Parse(saved.GetProperty("values").GetProperty("cinecompass_movie_lists").GetString()!);
        var watchlist = lists.RootElement[0];
        Assert.Equal("watchlist", watchlist.GetProperty("id").GetString());
        Assert.Equal(body.values["cinecompass_saved_films"], watchlist.GetProperty("films").GetRawText());
        Assert.Equal(body.values["cinecompass_cinema_lists"],saved.GetProperty("values").GetProperty("cinecompass_cinema_lists").GetString());
        var result = await bob.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal(0,result.GetProperty("revision").GetInt64());Assert.Empty(result.GetProperty("values").EnumerateObject());
        Assert.Equal(HttpStatusCode.Conflict,(await alice.PutAsJsonAsync("/api/settings",body)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await alice.PutAsJsonAsync("/api/settings",new {userId="alice",revision=1,values=new {cinecompass_omdb_key="secret"}})).StatusCode);
    }
    [Theory]
    [InlineData("cinecompass_hidden_movies")]
    [InlineData("cinecompass_watched_movies")]
    public async Task Catalogue_preferences_do_not_block_watched_movie_sync(string inputKey)
    {
        using var f = new ApiFactory(); await f.Seed(); using var alice = await Client(f,"alice");
        var values = new Dictionary<string,string> {
            ["cinecompass_schedule_grouping"]="\"movie\"",
            ["cinecompass_catalogue_view"]="\"grid\"",
            ["cinecompass_now_showing_sort"]="\"title-asc\"",
            ["cinecompass_upcoming_sort"]="\"release-asc\"",
            [inputKey]="[{\"id\":\"film\",\"title\":\"Below the Clouds\",\"year\":2025}]"
        };
        var response = await alice.PutAsJsonAsync("/api/settings",new {userId="alice",revision=0,values});
        Assert.Equal(HttpStatusCode.OK,response.StatusCode);
        var saved = await alice.GetFromJsonAsync<JsonElement>("/api/settings");
        var stored = saved.GetProperty("values");
        foreach (var pair in values.Where(pair => pair.Key != inputKey))
            Assert.Equal(pair.Value, stored.GetProperty(pair.Key).GetString());
        using var lists = JsonDocument.Parse(stored.GetProperty("cinecompass_movie_lists").GetString()!);
        var watched = lists.RootElement[1];
        Assert.Equal("watched", watched.GetProperty("id").GetString());
        var film = Assert.Single(watched.GetProperty("films").EnumerateArray());
        Assert.Equal("Below the Clouds", film.GetProperty("title").GetString());
        Assert.Equal(2025, film.GetProperty("year").GetInt32());
        Assert.Equal("", film.GetProperty("posterPath").GetString());
        Assert.False(stored.TryGetProperty("cinecompass_hidden_movies", out _));
    }
    [Fact]
    public async Task Custom_lists_survive_legacy_saves_and_invalid_payloads_are_rejected()
    {
        using var factory = new ApiFactory();
        await factory.Seed();
        using var alice = await Client(factory, "alice");
        const string custom = """{"id":"club","name":"Film club","films":[{"id":"film","title":"A Film","posterPath":"","directors":["A Director"]}],"hideWatched":true}""";
        var canonical = new Dictionary<string, string> { ["cinecompass_movie_lists"] = $"[{custom}]" };

        var created = await alice.PutAsJsonAsync("/api/settings", new { userId = "alice", revision = 0, values = canonical });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var duplicate = new Dictionary<string, string> { ["cinecompass_movie_lists"] = $"[{custom},{custom}]" };
        var rejected = await alice.PutAsJsonAsync("/api/settings", new { userId = "alice", revision = 1, values = duplicate });
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        canonical["cinecompass_movie_lists"] = """[{"id":"club","name":"Film club","films":[],"hideWatched":"true"}]""";
        var invalidFilter = await alice.PutAsJsonAsync("/api/settings", new { userId = "alice", revision = 1, values = canonical });
        Assert.Equal(HttpStatusCode.BadRequest, invalidFilter.StatusCode);

        var oldClient = new Dictionary<string, string> { ["cinecompass_saved_films"] = """[{"id":"older","title":"Older Film","posterPath":""}]""" };
        var saved = await alice.PutAsJsonAsync("/api/settings", new { userId = "alice", revision = 1, values = oldClient });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var settings = await alice.GetFromJsonAsync<JsonElement>("/api/settings");
        var values = settings.GetProperty("values");
        Assert.False(values.TryGetProperty("cinecompass_saved_films", out _));
        using var lists = JsonDocument.Parse(values.GetProperty("cinecompass_movie_lists").GetString()!);
        Assert.Equal(oldClient["cinecompass_saved_films"], lists.RootElement[0].GetProperty("films").GetRawText());
        Assert.Equal(custom, lists.RootElement[2].GetRawText());
    }

    [Fact] public async Task Mutations_require_csrf_and_exact_origin()
    {
        using var f = new ApiFactory();await f.Seed();using var c = await Client(f,"alice");
        c.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/auth/logout",new {})).StatusCode);
        c.DefaultRequestHeaders.Remove("Origin");c.DefaultRequestHeaders.Add("Origin","https://evil.example");
        Assert.Equal(HttpStatusCode.Forbidden,(await c.PostAsJsonAsync("/api/auth/logout",new {})).StatusCode);
    }
    [Fact] public async Task Production_gateway_can_issue_secure_csrf_cookie_over_its_private_http_hop()
    {
        using var f = new ApiFactory(production: true);
        using var c = f.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://localhost"), AllowAutoRedirect = false });
        var response = await c.GetAsync("/api/auth/csrf");
        response.EnsureSuccessStatusCode();
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), cookie => cookie.Contains("cc.csrf=") && cookie.Contains("secure"));
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(json.GetProperty("token").GetString()));
    }
    [Fact] public async Task Legacy_passkey_endpoints_are_retired()
    {
        using var f = new ApiFactory();
        await f.Seed();
        using var c = await Client(f);
        Assert.Equal(HttpStatusCode.NotFound, (await c.PostAsJsonAsync("/api/auth/register/options", new { name = "alice" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.PostAsJsonAsync("/api/auth/login/complete", new { credentialJson = "{}" })).StatusCode);
    }
}

internal static class TestKeycloakSettings
{
    public const string Issuer = "https://heimdall.example/realms/test";

    public static void Configure(IWebHostBuilder builder)
    {
        builder.UseSetting("Keycloak:Issuer", Issuer);
        builder.UseSetting("Keycloak:ClientId", "cinecompass-test");
        builder.UseSetting("Keycloak:ClientSecret", "test-secret");
    }
}
