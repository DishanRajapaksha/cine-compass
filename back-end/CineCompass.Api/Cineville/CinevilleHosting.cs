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
        builder.Services.AddMcpServer(options =>
        {
            options.ServerInfo = new Implementation { Name = "cineville", Version = "1.0.0" };
            options.ServerInstructions = "Read-only public cinema programme. Use Europe/Amsterdam dates. For paged results, pass nextOffset as offset with the same filters.";
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
