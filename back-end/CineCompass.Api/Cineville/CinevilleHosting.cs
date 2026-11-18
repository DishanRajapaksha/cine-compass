using ModelContextProtocol.AspNetCore;
using ModelContextProtocol.Protocol;

namespace CineCompass.Api.Cineville;

internal static class CinevilleHosting
{
    public static void AddCineville(this WebApplicationBuilder builder)
    {
        var baseUrl = builder.Configuration["Cineville:BaseUrl"] ?? "https://api.cineville.nl";
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps ||
            uri.AbsolutePath != "/" || uri.Query.Length != 0 || uri.Fragment.Length != 0 || uri.UserInfo.Length != 0)
            throw new InvalidOperationException("Cineville:BaseUrl must be an HTTPS origin.");
        builder.Services.AddHttpClient(CinevilleClient.ClientName, client =>
        {
            client.BaseAddress = uri;
            client.Timeout = TimeSpan.FromSeconds(20);
            client.MaxResponseContentBufferSize = 8 * 1024 * 1024;
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<CinevilleClient>();
        builder.Services.AddSingleton<CinevilleProgramme>();
        builder.Services.AddSingleton<ProgrammePaging>();
        builder.Services.AddMcpServer(options =>
        {
            options.ServerInfo = new Implementation { Name = "cineville", Version = "1.0.0" };
            options.ServerInstructions = """
                Read-only public cinema programme. Use Europe/Amsterdam dates.
                search_screenings defaults to both English audio and English subtitles. Each filter defaults independently.
                Use the language and subtitles arguments to honour the user's preferences. Pass a language code to change a filter or "any" to clear it.
                Prefer screening audio evidence. If audioSource is film, say the audio is inferred. An unlisted subtitle status means availability is unknown.
                Use startTime and endTime to constrain screening starts in Amsterdam. An estimated or unknown end time is not a guaranteed finish.
                If a search is empty, explain details.emptyReason and offer relevant relaxationOptions for the user to choose.
                Use find_films for title lookup. Disambiguate candidates with the user when needed, then pass the selected ID to get_film_showtimes.
                Pass nextCursor back to the same tool with only the cursor and optionally limit. The snapshot expires after five minutes.
                """;
        }).WithHttpTransport(options => options.SessionMode = HttpServerSessionMode.Stateless)
            .WithTools<ProgrammeTools>();
    }

    public static void MapCinevilleMcp(this WebApplication app, string appOrigin)
    {
        var gatewayOrigin = app.Configuration["Cineville:McpOrigin"];
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/mcp"))
            {
                context.Response.Headers.CacheControl = "no-store";
                var origin = context.Request.Headers.Origin;
                if (origin.Count != 0 && (origin.Count != 1 || (origin[0] != appOrigin && origin[0] != gatewayOrigin)))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return;
                }
            }
            await next();
        });
        app.MapMcp("/mcp");
        app.Map("/mcp/{**path}", () => Results.NotFound());
    }
}
