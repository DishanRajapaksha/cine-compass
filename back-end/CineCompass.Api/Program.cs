using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using CineCompass.Api;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var origin = builder.Configuration["Passkeys:Origin"] ?? throw new InvalidOperationException("Configure Passkeys:Origin with the public HTTPS origin.");
var originUri = new Uri(origin);
if (origin != originUri.GetLeftPart(UriPartial.Authority) || (!builder.Environment.IsDevelopment() && originUri.Scheme != "https"))
    throw new InvalidOperationException("Passkeys:Origin must be an exact HTTPS origin (HTTP localhost is allowed in Development).");
var domain = builder.Configuration["Passkeys:ServerDomain"] ?? originUri.Host;
if (domain != originUri.Host) throw new InvalidOperationException("Passkeys:ServerDomain must match the public origin host.");
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Configure ConnectionStrings:Database.")));
builder.Services.AddDataProtection().SetApplicationName("CineCompass").PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["DataProtection:Path"] ?? ".data/keys"));
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.ConfigureApplicationCookie(o => {
    o.Cookie.Name = "cc.session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromDays(14); o.SlidingExpiration = true;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddIdentityCore<AppUser>(o => o.Stores.SchemaVersion = IdentitySchemaVersions.Version3)
    .AddEntityFrameworkStores<AppDbContext>().AddSignInManager();
builder.Services.Configure<IdentityPasskeyOptions>(o => { o.ServerDomain = domain; o.UserVerificationRequirement = "required"; o.ResidentKeyRequirement = "required"; o.AuthenticatorTimeout = TimeSpan.FromMinutes(5); });
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.Name = "cc.csrf"; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; });
builder.Services.AddSingleton<PasskeyCeremonies>();
builder.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 262144);
var app = builder.Build();
if (args.Contains("--migrate"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    return;
}
app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
app.Use(async (context, next) => {
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        // The app is behind the private gateway; the configured public origin determines
        // the scheme for secure cookies/antiforgery, including GET /auth/csrf.
        // Never infer it from client-supplied forwarded headers.
        context.Request.Scheme = originUri.Scheme;
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
app.MapGet("/api/auth/csrf", (HttpContext c, IAntiforgery a) => Results.Ok(new { token = a.GetAndStoreTokens(c).RequestToken }));
app.MapGet("/api/auth/me", async (HttpContext c, UserManager<AppUser> users) => {
    var user = await users.GetUserAsync(c.User);
    return Results.Ok(new { user = user is null ? null : new { id = user.Id, name = user.UserName } });
});
var auth = app.MapGroup("/api/auth").RequireRateLimiting("auth");
auth.MapPost("/register/options", async (NameRequest request, HttpContext c, UserManager<AppUser> users, IPasskeyHandler<AppUser> handler, PasskeyCeremonies ceremonies) => {
    if (c.User.Identity?.IsAuthenticated == true) return Results.BadRequest(new { error = "Sign out before creating another account." });
    if (!Regex.IsMatch(request.Name ?? "", @"^[a-zA-Z0-9_-]{3,40}$")) return Results.BadRequest(new { error = "Choose a username of 3–40 letters, numbers, underscores or hyphens." });
    if (await users.FindByNameAsync(request.Name!) is not null) return Results.Conflict(new { error = "That username is unavailable." });
    var id = Guid.NewGuid().ToString();
    var options = await handler.MakeCreationOptionsAsync(new() { Id = id, Name = request.Name!, DisplayName = request.Name! }, c);
    ceremonies.Begin(c, "register", options.AttestationState!, id, request.Name);
    return Results.Content(options.CreationOptionsJson, "application/json");
});
auth.MapPost("/register/complete", async (CredentialRequest request, HttpContext c, UserManager<AppUser> users, SignInManager<AppUser> signin, IPasskeyHandler<AppUser> handler, PasskeyCeremonies ceremonies, AppDbContext db) => {
    var pending = ceremonies.Take(c, "register");
    if (pending is null || c.User.Identity?.IsAuthenticated == true) return Results.BadRequest(new { error = "Start registration again." });
    var verified = await handler.PerformAttestationAsync(new() { HttpContext = c, CredentialJson = request.CredentialJson, AttestationState = pending.State });
    if (!verified.Succeeded || verified.UserEntity.Id != pending.UserId) return Results.BadRequest(new { error = "Passkey verification failed." });
    await using var tx = await db.Database.BeginTransactionAsync();
    var user = new AppUser { Id = pending.UserId!, UserName = pending.Name };
    var created = await users.CreateAsync(user);
    if (!created.Succeeded) return Results.Conflict(new { error = "That username is unavailable." });
    verified.Passkey.Name = "First passkey";
    if (!(await users.AddOrUpdatePasskeyAsync(user, verified.Passkey)).Succeeded) return Results.BadRequest(new { error = "Could not save the passkey." });
    await tx.CommitAsync();
    await signin.SignInAsync(user, isPersistent: true, authenticationMethod: "passkey");
    return Results.Ok(new { id = user.Id, name = user.UserName });
});
auth.MapPost("/login/options", async (HttpContext c, IPasskeyHandler<AppUser> handler, PasskeyCeremonies ceremonies) => {
    var options = await handler.MakeRequestOptionsAsync(null, c);
    ceremonies.Begin(c, "login", options.AssertionState!);
    return Results.Content(options.RequestOptionsJson, "application/json");
});
auth.MapPost("/login/complete", async (CredentialRequest request, HttpContext c, UserManager<AppUser> users, SignInManager<AppUser> signin, IPasskeyHandler<AppUser> handler, PasskeyCeremonies ceremonies) => {
    var pending = ceremonies.Take(c, "login");
    if (pending is null) return Results.BadRequest(new { error = "Start sign-in again." });
    var verified = await handler.PerformAssertionAsync(new() { HttpContext = c, CredentialJson = request.CredentialJson, AssertionState = pending.State });
    if (!verified.Succeeded) return Results.BadRequest(new { error = "Passkey verification failed." });
    if (!(await users.AddOrUpdatePasskeyAsync(verified.User, verified.Passkey)).Succeeded) return Results.BadRequest(new { error = "Could not update the passkey." });
    await signin.SignInAsync(verified.User, isPersistent: true, authenticationMethod: "passkey");
    return Results.Ok(new { id = verified.User.Id, name = verified.User.UserName });
});
auth.MapPost("/logout", async (HttpContext c, SignInManager<AppUser> signin, PasskeyCeremonies ceremonies) => { ceremonies.Cancel(c); await signin.SignOutAsync(); return Results.NoContent(); }).RequireAuthorization();
auth.MapPost("/passkeys/options", async (HttpContext c, UserManager<AppUser> users, IPasskeyHandler<AppUser> handler, PasskeyCeremonies ceremonies) => {
    var user = (await users.GetUserAsync(c.User))!;
    if ((await users.GetPasskeysAsync(user)).Count >= 10) return Results.BadRequest(new { error = "You already have ten passkeys." });
    var options = await handler.MakeCreationOptionsAsync(new() { Id = user.Id, Name = user.UserName!, DisplayName = user.UserName! }, c);
    ceremonies.Begin(c, "add", options.AttestationState!, user.Id);
    return Results.Content(options.CreationOptionsJson, "application/json");
}).RequireAuthorization();
auth.MapPost("/passkeys/complete", async (CredentialRequest request, HttpContext c, UserManager<AppUser> users, IPasskeyHandler<AppUser> handler, PasskeyCeremonies ceremonies) => {
    var pending = ceremonies.Take(c, "add"); var user = (await users.GetUserAsync(c.User))!;
    if (pending is null || pending.UserId != user.Id) return Results.BadRequest(new { error = "Start adding your passkey again." });
    var verified = await handler.PerformAttestationAsync(new() { HttpContext = c, CredentialJson = request.CredentialJson, AttestationState = pending.State });
    if (!verified.Succeeded || verified.UserEntity.Id != user.Id) return Results.BadRequest(new { error = "Passkey verification failed." });
    verified.Passkey.Name = $"Passkey {(await users.GetPasskeysAsync(user)).Count + 1}";
    return (await users.AddOrUpdatePasskeyAsync(user, verified.Passkey)).Succeeded ? Results.NoContent() : Results.BadRequest(new { error = "Could not save the passkey." });
}).RequireAuthorization();
app.MapGet("/api/settings", async (HttpContext c, UserManager<AppUser> users, AppDbContext db) => {
    var row = await db.Settings.FindAsync(users.GetUserId(c.User));
    return Results.Ok(new { userId = users.GetUserId(c.User), revision = row?.Revision ?? 0, values = JsonSerializer.Deserialize<JsonElement>(row?.Json ?? "{}") });
}).RequireAuthorization();
app.MapPut("/api/settings", async (SettingsRequest request, HttpContext c, UserManager<AppUser> users, AppDbContext db) => {
    var allowed = new HashSet<string> { "cinecompass_schedule_filters", "cinecompass_schedule_view", "cineville_saved_showtimes", "cinecompass_saved_films", "cinecompass_hidden_movies", "cinecompass_planner_prefs", "cineville_filters", "cineville_filters_open", "cineville_timeline_prefs", "cineville_timeline_theater_order" };
    if (request.Values.ValueKind != JsonValueKind.Object || request.Values.EnumerateObject().Any(x => !allowed.Contains(x.Name) || x.Value.ValueKind != JsonValueKind.String) || request.Values.GetRawText().Length > 200000)
        return Results.BadRequest(new { error = "Invalid settings." });
    var id = users.GetUserId(c.User)!;
    if (request.UserId != id) return Results.Forbid();
    var row = await db.Settings.FindAsync(id);
    if ((row?.Revision ?? 0) != request.Revision) return Results.Conflict(new { error = "Settings changed on another device. Reload account settings before saving." });
    if (row is null) { row = new UserSettings { UserId = id }; db.Settings.Add(row); }
    row.Json = request.Values.GetRawText(); row.Revision++;
    try { await db.SaveChangesAsync(); }
    catch (DbUpdateException) { return Results.Conflict(new { error = "Settings changed on another device. Reload account settings before saving." }); }
    return Results.Ok(new { revision = row.Revision });
}).RequireAuthorization();
app.MapCalendarFeed(origin);
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
public record NameRequest(string Name);
public record CredentialRequest(string CredentialJson);
public record SettingsRequest(long Revision, JsonElement Values, string? UserId);
public partial class Program;
