using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using CineCompass.Api;
using Microsoft.AspNetCore.Authentication;
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

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        connection.Open();
        builder.UseEnvironment("Development").UseSetting("Passkeys:Origin", "http://localhost:3000").UseSetting("Passkeys:ServerDomain", "localhost").UseSetting("DataProtection:Path", Path.Combine(Path.GetTempPath(), "cinecompass-test-keys"));
        builder.ConfigureServices(services => {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o.UseSqlite(connection));
            services.AddAuthentication(o => o.DefaultAuthenticateScheme = "Test").AddScheme<AuthenticationSchemeOptions, TestAuth>("Test", _ => {});
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
public sealed class AccountTests
{
    private static async Task<HttpClient> Client(ApiFactory factory, string? user = null)
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
        var body = new { userId="alice", revision=0, values=new Dictionary<string,string> { ["cinecompass_schedule_view"]="\"compact\"" } };
        Assert.Equal(HttpStatusCode.OK,(await alice.PutAsJsonAsync("/api/settings",body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await bob.PutAsJsonAsync("/api/settings",body)).StatusCode);
        var result = await bob.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal(0,result.GetProperty("revision").GetInt64());Assert.Empty(result.GetProperty("values").EnumerateObject());
        Assert.Equal(HttpStatusCode.Conflict,(await alice.PutAsJsonAsync("/api/settings",body)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await alice.PutAsJsonAsync("/api/settings",new {userId="alice",revision=1,values=new {cinecompass_omdb_key="secret"}})).StatusCode);
    }
    [Fact] public async Task Mutations_require_csrf_and_exact_origin()
    {
        using var f = new ApiFactory();await f.Seed();using var c = await Client(f,"alice");
        c.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/auth/passkeys/options",new {})).StatusCode);
        c.DefaultRequestHeaders.Remove("Origin");c.DefaultRequestHeaders.Add("Origin","https://evil.example");
        Assert.Equal(HttpStatusCode.Forbidden,(await c.PostAsJsonAsync("/api/auth/passkeys/options",new {})).StatusCode);
    }
    [Fact] public async Task Registration_options_require_discoverable_verified_passkey_and_do_not_create_account()
    {
        using var f = new ApiFactory();await f.Seed();using var c = await Client(f);
        var response = await c.PostAsJsonAsync("/api/auth/register/options",new {name="new-user"});response.EnsureSuccessStatusCode();
        var json=await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("required",json.GetProperty("authenticatorSelection").GetProperty("residentKey").GetString());
        Assert.Equal("required",json.GetProperty("authenticatorSelection").GetProperty("userVerification").GetString());
        using var scope=f.Services.CreateScope();Assert.Null(await scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>().FindByNameAsync("new-user"));
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/auth/register/complete",new {credentialJson="{}"})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/auth/register/complete",new {credentialJson="{}"})).StatusCode);
    }
    [Fact] public void Ceremonies_are_browser_bound_mode_bound_and_single_use()
    {
        var store = new PasskeyCeremonies();var start=new Microsoft.AspNetCore.Http.DefaultHttpContext();
        store.Begin(start,"register","server-state","alice","alice");
        var cookie=start.Response.Headers.SetCookie.Last()!.Split(';')[0];
        var finish=new Microsoft.AspNetCore.Http.DefaultHttpContext();finish.Request.Headers.Cookie=cookie;
        Assert.Null(store.Take(new Microsoft.AspNetCore.Http.DefaultHttpContext(),"register"));
        Assert.Equal("alice",store.Take(finish,"register")!.UserId);Assert.Null(store.Take(finish,"register"));
        store.Begin(start,"login","state");finish.Request.Headers.Cookie=start.Response.Headers.SetCookie.Last()!.Split(';')[0];
        Assert.Null(store.Take(finish,"register"));Assert.Null(store.Take(finish,"login"));
    }
}
