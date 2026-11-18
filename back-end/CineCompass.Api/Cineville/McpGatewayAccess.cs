using System.Security.Cryptography;
using System.Text;

namespace CineCompass.Api.Cineville;

internal static class McpGatewayAccess
{
    public static void UseMcpGatewayAccess(this WebApplication app)
    {
        var credential = app.Configuration["Cineville:McpGatewaySecret"];
        if (credential is not null && (credential.Length < 32 || !credential.All(char.IsAsciiLetterOrDigit)))
            throw new InvalidOperationException("Cineville:McpGatewaySecret must contain at least 32 ASCII letters or digits.");

        var expected = credential is null ? null : Encoding.UTF8.GetBytes("Bearer " + credential);
        var issuer = app.Configuration["Keycloak:Issuer"];
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/mcp"))
            {
                var authorization = context.Request.Headers.Authorization;
                if (expected is null || authorization.Count != 1 ||
                    !CryptographicOperations.FixedTimeEquals(expected, Encoding.UTF8.GetBytes(authorization[0]!)))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return;
                }

                // Leyline strips incoming identity headers and supplies only verified Heimdall claims.
                var issuers = context.Request.Headers["X-CineCompass-Issuer"];
                var subjects = context.Request.Headers["X-CineCompass-Subject"];
                if (issuer is not null && issuers.Count == 1 && issuers[0] == issuer &&
                    subjects.Count == 1 && subjects[0] is { Length: > 0 and <= 128 } subject &&
                    subject.All(c => c is >= '!' and <= '~' and not ','))
                    context.Features.Set(new McpAccountIdentity(issuer, subject));
            }

            await next();
        });
    }
}

internal sealed record McpAccountIdentity(string Issuer, string Subject);
