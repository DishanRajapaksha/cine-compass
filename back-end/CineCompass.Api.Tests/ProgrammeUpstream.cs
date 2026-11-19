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
    public string? FarScreeningDate { get; init; }
    public bool IncludeEnglishScreenings { get; set; }
    public bool UseLanguageEvidence { get; init; }

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
            "/productions/by-title/A%3FFilm" when url.Query.Contains("page%5Bafter%5D=next", StringComparison.Ordinal) =>
                Page("productions", null, """{"id":"related","title":"Film Club","attributes":{"releaseYear":2022}}"""),
            "/productions/by-title/A%3FFilm" =>
                Page("productions", CursorOverride ?? "/productions/by-title/A?Film?page[limit]=24&page[after]=next", Film),
            "/productions/search" when body!.Contains("\"id\":{\"eq\":\"film\"}", StringComparison.Ordinal) =>
                Page("productions", null, Film),
            "/productions/search" when body!.Contains("\"id\":{\"eq\":", StringComparison.Ordinal) =>
                Page("productions", null),
            "/productions/search" when body!.Contains("\"contains\"", StringComparison.Ordinal) && next =>
                Page("productions", null, """{"id":"remake","title":"A Film","attributes":{"releaseYear":2026}}""",
                    """{"id":"accented","title":"Amélie","attributes":{"releaseYear":2001}}"""),
            "/productions/search" when body!.Contains("\"contains\"", StringComparison.Ordinal) =>
                Page("productions", "?page=2", Film),
            "/productions/search" when next => Page("productions", null, """
                {"id":"second","title":"A Second Film","attributes":{"premiereDate":"2099-12-01"}}
                """, Film),
            "/productions/search" => Page("productions", "/productions/search?page=2", Film, """
                {"id":"today","title":"Today","attributes":{"premiereDate":"2026-11-19"}}
                """),
            _ => throw new InvalidOperationException("Unexpected upstream path.")
        };
    }

    private HttpResponseMessage SecondEvents(string body)
    {
        var early = Event("early", 18, "nl");
        var late = Event("late", 20, "en");
        if (FarScreeningDate is { } date)
            return Page("events", null, early, late,
                Event("later-window", 20, "en").Replace("2026-11-19", date, StringComparison.Ordinal));
        if (UseLanguageEvidence)
            return Page("events", null, early, late,
                Event("dub", 21, "en", spokenLanguage: "en", version: "nl-NL", publishedEnd: true),
                Event("explicit-none", 22, null, spokenLanguage: "en", withoutSubtitles: true),
                Event("unlisted", 23, null, spokenLanguage: "en", version: "dubbed edition"));
        if (IncludeEnglishScreenings)
            return Page("events", null, early, late, Event("english", 21, "en", spokenLanguage: "en"),
                Event("dutch-subs", 22, "nl", spokenLanguage: "en"));
        return body.Contains("\"productionId\"", StringComparison.Ordinal)
            ? Page("events", null, early, late)
            : Page("events", null, early, late, Event("panel", 21, "", film: false));
    }

    private static string Event(string id, int hour, string? subtitles, bool film = true,
        string? spokenLanguage = null, string? version = null, bool withoutSubtitles = false, bool publishedEnd = false)
    {
        var production = film ? JsonNode.Parse(Film) : null;
        if (spokenLanguage is not null)
            production!["attributes"]!["spokenLanguages"] = new JsonArray(JsonValue.Create(spokenLanguage));
        return JsonSerializer.Serialize(new
        {
            id, title = film ? null : "Panel", startDate = $"2026-11-19T{hour}:00:00Z",
            endDate = publishedEnd ? $"2026-11-19T{hour}:30:00Z" : null,
            ticketingUrl = $"https://tickets.example/{id}",
            attributes = new { subtitles = subtitles is null ? [] : new[] { subtitles }, languageVersion = version,
                tags = withoutSubtitles ? new[] { "noSubtitles" } : [] },
            localizableAttributes = new Dictionary<string, object>
            {
                ["nl-NL"] = new { customTags = film ? Array.Empty<string>() : new[] { "Discussion" } }
            },
            _embedded = new { venue = JsonNode.Parse(Eye), production }
        });
    }

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
