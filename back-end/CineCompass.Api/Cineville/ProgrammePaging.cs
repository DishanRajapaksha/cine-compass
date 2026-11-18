using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using ModelContextProtocol;

namespace CineCompass.Api.Cineville;

internal sealed class ProgrammePaging(TimeProvider clock) : IDisposable
{
    private const int MaxSnapshotBytes = 16 * 1024 * 1024;
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    private readonly MemoryCache cache = new(new MemoryCacheOptions { SizeLimit = 2 * MaxSnapshotBytes });

    public async Task<(ToolPage<T> Page, TContext Context)> Read<T, TContext>(
        string tool, string? cursor, int offset, int limit, Func<Task<ProgrammeSnapshot<T, TContext>>> load)
    {
        if (offset < 0 || limit is < 1 or > 100)
            throw new McpException("Use a nonnegative offset and a limit between 1 and 100.");
        if (cursor is not null && offset != 0)
            throw new McpException("Send a cursor or an offset.");

        Guid id = default;
        ProgrammeSnapshot<T, TContext> snapshot;
        if (cursor is null)
            snapshot = await load();
        else
        {
            (id, offset) = ParseCursor(cursor);
            if (!cache.TryGetValue((tool, id), out StoredSnapshot? stored) ||
                stored is null || clock.GetUtcNow() >= stored.ExpiresAt)
                throw new McpException("This cursor has expired or belongs to another tool. Start a new search.");
            snapshot = JsonSerializer.Deserialize<ProgrammeSnapshot<T, TContext>>(stored.Data, JsonSerializerOptions.Web)!;
        }

        var items = snapshot.Items.Skip(offset).Take(limit).ToArray();
        int? next = (long)offset + items.Length < snapshot.Items.Length ? offset + items.Length : null;
        if (next.HasValue && cursor is null)
        {
            var data = JsonSerializer.SerializeToUtf8Bytes(snapshot, JsonSerializerOptions.Web);
            if (data.Length > MaxSnapshotBytes)
                throw new McpException("This result is too large to page. Narrow the search and try again.");

            id = Guid.NewGuid();
            cache.Set((tool, id), new StoredSnapshot(data, clock.GetUtcNow() + Lifetime),
                new MemoryCacheEntryOptions().SetSize(data.Length).SetAbsoluteExpiration(Lifetime));
            if (!cache.TryGetValue((tool, id), out _))
                throw new McpException("The pagination cache is busy. Narrow the search or try again shortly.");
        }

        var nextCursor = next is { } nextOffset
            ? $"{id:N}.{nextOffset.ToString(CultureInfo.InvariantCulture)}" : null;
        return (new(items, snapshot.Items.Length, next, nextCursor), snapshot.Context);
    }

    private static (Guid Id, int Offset) ParseCursor(string cursor)
    {
        if (cursor.Length is >= 34 and <= 43 && cursor[32] == '.' &&
            Guid.TryParseExact(cursor.AsSpan(0, 32), "N", out var id) &&
            int.TryParse(cursor.AsSpan(33), NumberStyles.None, CultureInfo.InvariantCulture, out var offset) && offset > 0)
            return (id, offset);
        throw new McpException("Use the nextCursor returned by the tool.");
    }

    public void Dispose() => cache.Dispose();

    private sealed record StoredSnapshot(byte[] Data, DateTimeOffset ExpiresAt);
}

internal sealed record ProgrammeSnapshot<T, TContext>(T[] Items, TContext Context);
internal record ToolPage<T>(T[] Items, int Total, int? NextOffset, string? NextCursor);
