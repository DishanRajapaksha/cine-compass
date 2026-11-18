using System.Text.Json;
using System.Threading.RateLimiting;
using CineCompass.Api;
using CineCompass.Api.Cineville;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var origin = builder.Configuration["App:Origin"] ?? throw new InvalidOperationException("Configure App:Origin.");
var originUri = new Uri(origin);
if (origin != originUri.GetLeftPart(UriPartial.Authority) || originUri.UserInfo.Length != 0 ||
    (originUri.Scheme != "https" && !(builder.Environment.IsDevelopment() && originUri.IsLoopback && originUri.Scheme == "http")))
    throw new InvalidOperationException("App:Origin must be an exact HTTPS origin (HTTP loopback is allowed in Development).");
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Configure ConnectionStrings:Database.")));
builder.Services.AddDataProtection().SetApplicationName("CineCompass").PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["DataProtection:Path"] ?? ".data/keys"));
builder.AddAccountAuthentication(originUri);
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.Name = "cc.csrf"; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; });
builder.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 262144);
builder.AddCineville();
var app = builder.Build();
if (args.Contains("--migrate"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    return;
}
app.Use(async (context, next) => {
    // The public origin is configured explicitly. The private gateway hop is HTTP.
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Request.Scheme = originUri.Scheme;
    await next();
});
app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
app.Use(async (context, next) => {
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
        {
            if (context.Request.Headers.Origin != origin) { context.Response.StatusCode = 403; return; }
            try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = "Refresh the page and try again." }); return; }
        }
    }
    await next();
});
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapAccountAuthentication();
app.MapGet("/api/settings", async (HttpContext c, UserManager<AppUser> users, AppDbContext db) => {
    var row = await db.Settings.FindAsync(users.GetUserId(c.User));
    return Results.Ok(new { userId = users.GetUserId(c.User), revision = row?.Revision ?? 0, values = AccountMovieLists.ParseSettings(row?.Json) });
}).RequireAuthorization();
app.MapPut("/api/settings", async (SettingsRequest request, HttpContext c, UserManager<AppUser> users, AppDbContext db) => {
    var allowed = new HashSet<string> { "cinecompass_schedule_filters", "cinecompass_schedule_view", "cinecompass_schedule_grouping", "cinecompass_catalogue_view", "cinecompass_now_showing_sort", "cinecompass_upcoming_sort", "cineville_saved_showtimes", AccountMovieLists.Watchlist, AccountMovieLists.WatchedMovies, AccountMovieLists.LegacyWatchedMovies, "cinecompass_planner_prefs", "cineville_filters", "cineville_filters_open", "cineville_timeline_prefs", "cineville_timeline_theater_order" };
    if (request.Values.ValueKind != JsonValueKind.Object || request.Values.EnumerateObject().Any(x => !allowed.Contains(x.Name) || x.Value.ValueKind != JsonValueKind.String) || request.Values.GetRawText().Length > UserSettings.MaxLength)
        return Results.BadRequest(new { error = "Invalid settings." });
    var id = users.GetUserId(c.User)!;
    if (request.UserId != id) return Results.Forbid();
    var row = await db.Settings.FindAsync(id);
    if ((row?.Revision ?? 0) != request.Revision) return Results.Conflict(new { error = "Settings changed on another device. Reload account settings before saving." });
    if (row is null) { row = new UserSettings { UserId = id }; db.Settings.Add(row); }
    row.Json = AccountMovieLists.NormalizeSettings(request.Values); row.Revision++;
    try { await db.SaveChangesAsync(); }
    catch (DbUpdateException) { return Results.Conflict(new { error = "Settings changed on another device. Reload account settings before saving." }); }
    return Results.Ok(new { revision = row.Revision });
}).RequireAuthorization();
app.MapCalendarFeed(origin);
app.MapCineville();
app.MapCinevilleMcp(origin);
app.UseMcpGatewayAccess();
app.Map("/api/{**path}", () => Results.NotFound());
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions {
    OnPrepareResponse = context => {
        if (context.File.Name == "service-worker.js") context.Context.Response.Headers.CacheControl = "no-store";
        else if (context.File.Name is "index.html" or "manifest.json" or "offline.html") context.Context.Response.Headers.CacheControl = "no-cache";
    }
});
app.MapFallbackToFile("index.html");
app.Run();
public record SettingsRequest(long Revision, JsonElement Values, string? UserId);
public partial class Program;
