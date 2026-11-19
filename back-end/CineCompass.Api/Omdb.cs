using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace CineCompass.Api;

public sealed class OmdbCredential
{
    public string UserId { get; set; } = "";
    public string ProtectedKey { get; set; } = "";
}

internal static class Omdb
{
    internal const string ClientName = "Omdb";

    public static void AddOmdb(this WebApplicationBuilder builder) =>
        builder.Services.AddHttpClient(ClientName, client =>
        {
            client.BaseAddress = new Uri("https://www.omdbapi.com/");
            client.Timeout = TimeSpan.FromSeconds(10);
            client.MaxResponseContentBufferSize = 64 * 1024;
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false })
        // OMDb requires the key in the query string.
        .RemoveAllLoggers();

    public static void MapOmdb(this WebApplication app)
    {
        var group = app.MapGroup("/api/imdb").RequireAuthorization();
        group.MapPut("/key", SaveKey);
        group.MapGet("/film", Lookup);
    }

    private static IDataProtector Protector(IDataProtectionProvider provider, string userId) =>
        provider.CreateProtector("CineCompass.OmdbKey.v1", userId);

    private static async Task<IResult> SaveKey(KeyRequest request, HttpContext context, UserManager<AppUser> users,
        AppDbContext db, IDataProtectionProvider provider, CancellationToken ct)
    {
        var owner = users.GetUserId(context.User)!;
        if (owner != request.UserId) return Results.Forbid();
        if (request.Key is null)
        {
            await db.OmdbCredentials.Where(row => row.UserId == owner).ExecuteDeleteAsync(ct);
            return Results.NoContent();
        }

        var key = request.Key.Trim();
        if (key.Length is < 1 or > 128 || key.Any(c => char.IsControl(c) || char.IsWhiteSpace(c)))
            return Results.BadRequest(new { error = "Enter a valid OMDb API key." });

        var protectedKey = Protector(provider, owner).Protect(key);
        var credential = await db.OmdbCredentials.FindAsync([owner], ct);
        if (credential is null) db.OmdbCredentials.Add(new() { UserId = owner, ProtectedKey = protectedKey });
        else credential.ProtectedKey = protectedKey;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return Results.Conflict(new { error = "The OMDb key changed. Reload and try again." }); }
        return Results.NoContent();
    }

    private static async Task<IResult> Lookup(string userId, string title, int? year, HttpContext context,
        UserManager<AppUser> users, AppDbContext db, IDataProtectionProvider provider, IHttpClientFactory clients, CancellationToken ct)
    {
        if (users.GetUserId(context.User) != userId) return Results.Forbid();
        if (title.Trim().Length is < 1 or > 240 || year is < 1 or > 9999) return Results.BadRequest();
        var credential = await db.OmdbCredentials.AsNoTracking().SingleOrDefaultAsync(row => row.UserId == userId, ct);
        if (credential is null) return Results.NotFound();

        try
        {
            var key = Protector(provider, userId).Unprotect(credential.ProtectedKey);
            var args = new Dictionary<string, string?> { ["apikey"] = key, ["type"] = "movie", ["t"] = title.Trim() };
            if (year is int exact) args["y"] = exact.ToString(System.Globalization.CultureInfo.InvariantCulture);
            using var client = clients.CreateClient(ClientName);
            using var response = await client.GetAsync(QueryHelpers.AddQueryString("/", args), ct);
            if (!response.IsSuccessStatusCode) return Results.StatusCode(502);
            var movie = await response.Content.ReadFromJsonAsync<OmdbMovie>(cancellationToken: ct);
            if (movie?.Response == "True") return Results.Ok(movie with { Error = null });
            if (movie?.Error == "Movie not found!") return Results.Ok(new OmdbMovie("False", "Movie not found!", null, null, null));
        }
        catch (Exception error) when (!ct.IsCancellationRequested &&
            error is CryptographicException or HttpRequestException or System.Text.Json.JsonException or OperationCanceledException)
        { /* Return a generic failure because upstream errors can include the request URL. */ }
        return Results.StatusCode(502);
    }

    internal sealed record KeyRequest(string UserId, [property: JsonRequired] string? Key);
    internal sealed record OmdbMovie(
        [property: JsonPropertyName("Response")] string? Response,
        [property: JsonPropertyName("Error")] string? Error,
        [property: JsonPropertyName("imdbID")] string? ImdbId,
        string? ImdbRating,
        [property: JsonPropertyName("Year")] string? Year);
}
