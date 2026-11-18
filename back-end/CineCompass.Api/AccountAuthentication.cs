using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace CineCompass.Api;

internal static class AccountAuthentication
{
    private const string Session = "CineCompass.HeimdallSession";
    private const string Scheme = "Heimdall";
    private const string Callback = "/api/auth/callback";

    public static void AddAccountAuthentication(this WebApplicationBuilder builder, Uri origin)
    {
        var config = builder.Configuration.GetSection("Keycloak");
        var issuer = config["Issuer"] ?? throw new InvalidOperationException("Configure Keycloak:Issuer.");
        if (!Uri.TryCreate(issuer, UriKind.Absolute, out var authority) || authority.Scheme != "https" ||
            authority.UserInfo.Length != 0 || authority.Query.Length != 0 || authority.Fragment.Length != 0 ||
            issuer.EndsWith('/'))
            throw new InvalidOperationException("Keycloak:Issuer must be the HTTPS realm issuer without a trailing slash.");
        var clientId = config["ClientId"] ?? throw new InvalidOperationException("Configure Keycloak:ClientId.");
        var secret = config["ClientSecret"] ?? throw new InvalidOperationException("Configure Keycloak:ClientSecret.");

        builder.Services.AddScoped<KeycloakAccounts>();
        builder.Services.AddIdentityCore<AppUser>(options => options.Stores.SchemaVersion = IdentitySchemaVersions.Version3)
            .AddEntityFrameworkStores<AppDbContext>();
        builder.Services.AddAuthentication(Session)
            // The new ticket name and scheme purpose invalidate existing local-passkey sessions.
            .AddCookie(Session, options =>
            {
                options.Cookie.Name = "cc.heimdall";
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = origin.Scheme == "https" ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromDays(14);
                options.SlidingExpiration = true;
                options.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
                options.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
            })
            .AddOpenIdConnect(Scheme, options =>
            {
                options.SignInScheme = Session;
                options.Authority = issuer;
                options.ClientId = clientId;
                options.ClientSecret = secret;
                options.CallbackPath = Callback;
                options.ResponseType = OpenIdConnectResponseType.Code;
                options.ResponseMode = OpenIdConnectResponseMode.Query;
                options.UsePkce = true;
                options.SaveTokens = false;
                options.MapInboundClaims = false;
                options.TokenValidationParameters.ValidIssuer = issuer;
                options.Events.OnRedirectToIdentityProvider = c =>
                {
                    c.ProtocolMessage.RedirectUri = new Uri(origin, Callback).AbsoluteUri;
                    return Task.CompletedTask;
                };
                options.Events.OnTicketReceived = async c =>
                {
                    var subject = c.Principal?.FindFirstValue("sub");
                    if (string.IsNullOrEmpty(subject))
                    {
                        c.Fail("Heimdall did not supply a subject.");
                        return;
                    }
                    var name = c.Principal!.FindFirstValue("preferred_username");
                    var accounts = c.HttpContext.RequestServices.GetRequiredService<KeycloakAccounts>();
                    var user = await accounts.Resolve(issuer, subject, c.HttpContext.RequestAborted);
                    c.Principal = new ClaimsPrincipal(new ClaimsIdentity([
                        new Claim(ClaimTypes.NameIdentifier, user.Id),
                        new Claim(ClaimTypes.Name, string.IsNullOrWhiteSpace(name) ? "Heimdall user" : name)
                    ], Session));
                    c.Properties!.IsPersistent = true;
                };
                options.Events.OnRemoteFailure = c =>
                {
                    c.HandleResponse();
                    c.Response.Redirect("/?signin=failed");
                    return Task.CompletedTask;
                };
            });
    }

    public static void MapAccountAuthentication(this WebApplication app)
    {
        var auth = app.MapGroup("/api/auth").RequireRateLimiting("auth");
        app.MapGet("/api/auth/csrf", (HttpContext c, IAntiforgery a) => Results.Ok(new { token = a.GetAndStoreTokens(c).RequestToken }));
        app.MapGet("/api/auth/me", async (HttpContext c, UserManager<AppUser> users) =>
        {
            var user = await users.GetUserAsync(c.User);
            return Results.Ok(new { user = user is null ? null : new { id = user.Id, name = c.User.Identity?.Name ?? user.UserName } });
        });
        auth.MapGet("/login", () => Results.Challenge(new AuthenticationProperties { RedirectUri = "/" }, [Scheme]));
        auth.MapPost("/logout", async (HttpContext c) =>
        {
            await c.SignOutAsync(Session);
            return Results.NoContent();
        }).RequireAuthorization();
    }
}
