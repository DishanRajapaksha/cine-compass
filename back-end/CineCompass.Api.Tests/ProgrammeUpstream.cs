using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

internal sealed class ProgrammeUpstream : HttpMessageHandler
{
    private const string Eye = """{"id":"eye","name":"Eye Filmmuseum","address":{"city":"Amsterdam"},"isHidden":false}""";
    private const string Kino = """{"id":"kino","name":"Kino","address":{"city":"Rotterdam"},"isHidden":false}""";
    private const string Hidden = """{"id":"hidden","name":"Closed","address":{"city":"Amsterdam"},"isHidden":true}""";
    private const string Film = """
        {"id":"film","title":"A Film","createdAt":"2026-09-16T10:00:00Z",
         "assets":{"cover":{"url":"https://images.example/film.jpg"}},"attributes":{"duration":91,"releaseYear":2025,
         "spokenLanguages":["fr"],"premiereDate":"2099-11-19"},
         "localizableAttributes":{"en-GB":{"description":"English description"},"nl-NL":{"description":"Dutch description"}}}
        """;

    public ConcurrentQueue<(string Path, string? Body, HttpMethod Method)> Requests { get; } = new();
    public string? CursorOverride { get; set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var url = request.RequestUri!;
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        Requests.Enqueue((url.PathAndQuery, body, request.Method));
        if (url.Host != "api.cineville.nl") throw new InvalidOperationException("Unexpected upstream host.");
        var next = url.Query.StartsWith("?page", StringComparison.Ordinal);

        return url.AbsolutePath switch
        {
            "/venues" when next => Page("venues", null, Kino, Hidden, Eye),
            "/venues" => Page("venues", "https://api.cineville.nl/venues?page=2", Eye),
            "/events/search" when body!.Contains("\"eq\":\"unknown\"", StringComparison.Ordinal) => Page("events", null),
            "/events/search" when next => SecondEvents(body!),
            "/events/search" => Page("events", CursorOverride ?? "?page%5Bafter%5D=next", Event("early", 18, "nl")),
            "/productions/search" when next => Page("productions", null, """
                {"id":"second","title":"A Second Film","attributes":{"premiereDate":"2099-12-01"}}
                """, Film),
            "/productions/search" => Page("productions", "/productions/search?page=2", Film, """
                {"id":"today","title":"Today","attributes":{"premiereDate":"2026-11-19"}}
                """),
            _ => throw new InvalidOperationException("Unexpected upstream path.")
        };
    }

    private static HttpResponseMessage SecondEvents(string body)
    {
        var early = Event("early", 18, "nl");
        var late = Event("late", 20, "en");
        return body.Contains("\"productionId\"", StringComparison.Ordinal)
            ? Page("events", null, early, late)
            : Page("events", null, early, late, Event("panel", 21, "", film: false));
    }

    private static string Event(string id, int hour, string subtitles, bool film = true) =>
        JsonSerializer.Serialize(new
        {
            id, title = film ? null : "Panel", startDate = $"2026-11-19T{hour}:00:00Z",
            ticketingUrl = $"https://tickets.example/{id}", attributes = new { subtitles = new[] { subtitles } },
            localizableAttributes = new Dictionary<string, object>
            {
                ["nl-NL"] = new { customTags = film ? Array.Empty<string>() : new[] { "Discussion" } }
            },
            _embedded = new { venue = JsonNode.Parse(Eye), production = film ? JsonNode.Parse(Film) : null }
        });

    private static HttpResponseMessage Page(string collection, string? href, params string[] items) =>
        new(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new
            {
                _embedded = new Dictionary<string, JsonArray> { [collection] = new(items.Select(item => JsonNode.Parse(item)).ToArray()) },
                _links = new { next = href is null ? null : new { href } }
            })
        };
}
