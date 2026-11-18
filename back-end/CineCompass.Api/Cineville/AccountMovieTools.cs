using System.ComponentModel;
using Microsoft.AspNetCore.Identity;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace CineCompass.Api.Cineville;

[McpServerToolType]
internal sealed class AccountMovieTools(IHttpContextAccessor http, UserManager<AppUser> users, AppDbContext db,
    CinevilleProgramme programme, ProgrammePaging paging)
{
    [McpServerTool(Name = "list_watched_movies", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("List the films marked watched in the signed-in user's CineCompass account.")]
    public Task<ToolPage<AccountMovie>> ListWatchedMovies(CancellationToken ct, int offset = 0, int limit = 25,
        [Description("The nextCursor from this tool. Send only the cursor and optionally limit.")] string? cursor = null) =>
        List(nameof(ListWatchedMovies), AccountMovieLists.WatchedMovies, offset, limit, cursor, ct);

    [McpServerTool(Name = "list_watchlist", ReadOnly = true, Destructive = false, UseStructuredContent = true)]
    [Description("List the visible saved films in the signed-in user's CineCompass Movies watchlist.")]
    public Task<ToolPage<AccountMovie>> ListWatchlist(CancellationToken ct, int offset = 0, int limit = 25,
        [Description("The nextCursor from this tool. Send only the cursor and optionally limit.")] string? cursor = null) =>
        List(nameof(ListWatchlist), AccountMovieLists.Watchlist, offset, limit, cursor, ct);

    [McpServerTool(Name = "mark_movie_watched", ReadOnly = false, Destructive = false, Idempotent = true, UseStructuredContent = true)]
    [Description("Mark a Cineville film as watched in the signed-in user's CineCompass account. Watched films are excluded from the schedule and watchlist.")]
    public Task<MovieListChange> MarkMovieWatched(CancellationToken ct,
        [Description("Exact Cineville film ID from find_films or another programme tool.")] string filmId) =>
        Add(AccountMovieLists.WatchedMovies, filmId, ct);

    [McpServerTool(Name = "add_to_watchlist", ReadOnly = false, Destructive = false, Idempotent = true, UseStructuredContent = true)]
    [Description("Save a Cineville film to the signed-in user's CineCompass Movies watchlist.")]
    public Task<MovieListChange> AddToWatchlist(CancellationToken ct,
        [Description("Exact Cineville film ID from find_films or another programme tool.")] string filmId) =>
        Add(AccountMovieLists.Watchlist, filmId, ct);

    private async Task<ToolPage<AccountMovie>> List(string tool, string key, int offset, int limit, string? cursor, CancellationToken ct)
    {
        var owner = await Owner();
        var (page, _) = await paging.Read(tool, cursor, offset, limit, async () =>
        {
            var row = await db.Settings.FindAsync([owner], ct);
            var films = AccountMovieLists.Read(row?.Json, key);
            return new ProgrammeSnapshot<AccountMovie, object?>(films, null);
        }, owner: owner);
        return page;
    }

    private async Task<MovieListChange> Add(string key, string filmId, CancellationToken ct)
    {
        var owner = await Owner();
        if (filmId?.Trim() is not { Length: > 0 and <= 128 } id)
            throw new McpException("Supply a Cineville film ID from a programme tool.");

        Film? film;
        try { film = await programme.FindFilmById(id, ct); }
        catch (CinevilleUpstreamException error) { throw new McpException(error.Message); }
        if (film is null) throw new McpException("Cineville could not find that film ID.");
        return await AccountMovieLists.Add(db, owner, key, film, ct);
    }

    private async Task<string> Owner()
    {
        var identity = http.HttpContext?.Features.Get<McpAccountIdentity>()
            ?? throw new McpException("A verified Heimdall identity from Leyline is required for personal movie lists.");
        var user = await users.FindByLoginAsync(identity.Issuer, identity.Subject)
            ?? throw new McpException("Sign in to CineCompass with this Heimdall account to use personal movie lists.");
        return user.Id;
    }
}

internal sealed record AccountMovie(string Id, string Title, int? Year, string? PosterPath = null);
internal sealed record MovieListChange(AccountMovie Film, bool Changed);
