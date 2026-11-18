using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace CineCompass.Api.Cineville;

internal sealed class CinevilleClient(
    IHttpClientFactory clients, IConfiguration configuration, IHostApplicationLifetime lifetime) : IDisposable
{
    internal const string ClientName = "Cineville";
    private const int MaxPages = 250;
    private const int MaxSnapshotSize = 64 * 1024 * 1024;
    private readonly SemaphoreSlim upstreamSlots = new(8);
    private readonly MemoryCache cache = new(new MemoryCacheOptions { SizeLimit = 32 * 1024 * 1024 });
    private readonly Dictionary<string, Task<CinevillePage>> pending = new();
    private readonly object gate = new();

    public async Task<JsonElement[]> Venues(CancellationToken ct) =>
        (await Read("/venues", "venues", null, 900, ct)).Items;
    public async Task<JsonElement[]> Events(object body, CancellationToken ct) =>
        (await Read("/events/search", "events", body, 60, ct)).Items;
    public async Task<JsonElement[]> Productions(object body, CancellationToken ct) =>
        (await Read("/productions/search", "productions", body, 120, ct)).Items;
    public Task<CinevillePage> ProductionsByTitle(string pathAndQuery, CancellationToken ct) =>
        Read(pathAndQuery, "productions", null, 120, ct, singlePage: true);

    private Task<CinevillePage> Read(string path, string collection, object? body, int seconds,
        CancellationToken ct, bool singlePage = false)
    {
        var json = body is null ? null : JsonSerializer.Serialize(body);
        var key = path + json;
        lock (gate)
        {
            if (cache.TryGetValue(key, out CinevillePage? cached))
                return Task.FromResult(cached!);
            if (!pending.TryGetValue(key, out var task))
                pending[key] = task = FetchAndCache(key, path, collection, json, seconds, singlePage);
            return task.WaitAsync(ct);
        }
    }

    private async Task<CinevillePage> FetchAndCache(string key, string path, string collection, string? body,
        int seconds, bool singlePage)
    {
        // Register the shared task before its continuation can remove it.
        await Task.Yield();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(lifetime.ApplicationStopping);
        timeout.CancelAfter(TimeSpan.FromSeconds(45));
        try
        {
            await upstreamSlots.WaitAsync(timeout.Token);
            CinevillePage page;
            long size;
            try { (page, size) = await Fetch(path, collection, body, singlePage, timeout.Token); }
            finally { upstreamSlots.Release(); }
            var ttl = configuration.GetValue($"Cineville:CacheSeconds:{collection}", seconds);
            if (ttl > 0)
                cache.Set(key, page, new MemoryCacheEntryOptions()
                    .SetSize(Math.Max(1, size + key.Length * 2L))
                    .SetAbsoluteExpiration(TimeSpan.FromSeconds(ttl)));
            return page;
        }
        catch (Exception error) when (error is HttpRequestException or IOException or JsonException
            or InvalidOperationException or OperationCanceledException)
        {
            throw new CinevilleUpstreamException(error);
        }
        finally
        {
            lock (gate)
                pending.Remove(key);
        }
    }

    private async Task<(CinevillePage Page, long Size)> Fetch(
        string path, string collection, string? body, bool singlePage, CancellationToken ct)
    {
        using var client = clients.CreateClient(ClientName);
        Uri? url = new(client.BaseAddress!, path);
        var visited = new HashSet<Uri>();
        var items = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        long size = 0;
        while (url is not null)
        {
            if (!visited.Add(url) || visited.Count > MaxPages)
                throw new IOException("Cineville pagination repeated or exceeded its page limit.");

            using var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, url);
            request.Headers.Add("locale", "*");
            if (body is not null)
                request.Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
            using var response = await client.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            var page = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
            var entries = page.Field("_embedded").Field(collection);
            if (entries.ValueKind != JsonValueKind.Array)
                throw new JsonException($"Cineville response has no {collection} array.");
            foreach (var item in entries.EnumerateArray())
            {
                var id = item.Text("id") ?? throw new JsonException("Cineville item has no ID.");
                if (items.ContainsKey(id)) continue;
                size += item.GetRawText().Length * 2L;
                if (size > MaxSnapshotSize)
                    throw new IOException("Cineville response exceeded its size limit.");
                items.Add(id, item.Clone());
            }
            var href = page.Field("_links").Field("next").Text("href");
            if (singlePage) return (new(items.Values.ToArray(), href), size + (href?.Length ?? 0) * 2L);
            url = href is null ? null : NextPage(url, path, href);
        }
        return (new(items.Values.ToArray(), null), size);
    }

    private static Uri NextPage(Uri current, string path, string href)
    {
        if (!Uri.TryCreate(current, href, out var next) || next.Scheme != current.Scheme ||
            next.IdnHost != current.IdnHost || next.Port != current.Port || next.AbsolutePath != path ||
            next.UserInfo.Length != 0 || next.Fragment.Length != 0)
            throw new IOException("Cineville returned an invalid pagination URL.");
        return next;
    }

    public void Dispose() => cache.Dispose();
}

internal sealed record CinevillePage(JsonElement[] Items, string? NextHref);

internal sealed class CinevilleUpstreamException(Exception inner)
    : Exception("Cineville programme data is temporarily unavailable.", inner);
