using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CineCompass.Api;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Xunit;

public sealed class HeimdallTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Oidc_callback_uses_the_verified_subject_to_load_settings(bool linked)
    {
        using var keycloak = new TestHeimdall();
        using var factory = new ApiFactory(production: true, heimdall: keycloak);
        await factory.Seed();
        using (var scope = factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (linked)
            {
                var alice = (await users.FindByIdAsync("alice"))!;
                Assert.True((await users.AddLoginAsync(alice, new UserLoginInfo(
                    TestKeycloakSettings.Issuer, keycloak.Subject, "Heimdall"))).Succeeded);
            }
            db.Settings.Add(new UserSettings { UserId = "alice", Revision = 5, Json = "{}" });
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost:3000")
        });
        var challenge = await client.GetAsync("/api/auth/login");
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        var location = challenge.Headers.Location!;
        Assert.StartsWith(TestKeycloakSettings.Issuer, location.AbsoluteUri);
        var query = QueryHelpers.ParseQuery(location.Query);
        Assert.Equal("https://localhost:3000/api/auth/callback", query["redirect_uri"].ToString());
        Assert.Equal("S256", query["code_challenge_method"].ToString());
        keycloak.Nonce = query["nonce"].ToString();
        keycloak.CodeChallenge = query["code_challenge"].ToString();
        var callback = QueryHelpers.AddQueryString("/api/auth/callback", new Dictionary<string, string?>
        {
            ["code"] = "verified-code", ["state"] = query["state"].ToString(),
        });
        var signIn = await client.GetAsync(callback);
        Assert.Equal("/", signIn.Headers.Location?.OriginalString);
        Assert.Contains(signIn.Headers.GetValues("Set-Cookie"), cookie => cookie.StartsWith("cc.heimdall="));
        var settings = await client.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.Equal(linked ? 5 : 0, settings.GetProperty("revision").GetInt32());
        Assert.Equal(linked, settings.GetProperty("userId").GetString() == "alice");
    }
}

public sealed class TestHeimdall : HttpMessageHandler
{
    private readonly SecurityKey key = new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(32));
    public string Subject { get; } = "account-subject";
    public string Nonce { get; set; } = "";
    public string CodeChallenge { get; set; } = "";

    public void Configure(OpenIdConnectOptions options)
    {
        var issuer = TestKeycloakSettings.Issuer;
        options.Configuration = new OpenIdConnectConfiguration
        {
            Issuer = issuer, AuthorizationEndpoint = issuer + "/authorize", TokenEndpoint = issuer + "/token"
        };
        options.Configuration.SigningKeys.Add(key);
        options.Backchannel = new HttpClient(this, disposeHandler: false);
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var form = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(cancellationToken));
        Assert.Equal("verified-code", form["code"].ToString());
        Assert.Equal("https://localhost:3000/api/auth/callback", form["redirect_uri"].ToString());
        var verifier = SHA256.HashData(Encoding.ASCII.GetBytes(form["code_verifier"].ToString()));
        Assert.Equal(CodeChallenge, Base64UrlEncoder.Encode(verifier));
        var idToken = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = TestKeycloakSettings.Issuer, Audience = "cinecompass-test",
            Claims = new Dictionary<string, object> { ["sub"] = Subject, ["preferred_username"] = "alice", ["nonce"] = Nonce },
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
        });
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new { access_token = "ignored", token_type = "Bearer", id_token = idToken })
        };
    }
}
