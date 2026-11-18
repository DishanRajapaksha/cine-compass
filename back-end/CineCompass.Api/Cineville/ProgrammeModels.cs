using System.Text.Json.Serialization;

namespace CineCompass.Api.Cineville;

internal sealed record Cinema(string Id, string Name, string City);
internal sealed record City(string Name, Cinema[] Theaters);
internal sealed record ProgrammeFilter(
    string? City = null, string[]? Cinemas = null, string[]? Languages = null,
    string[]? Subtitles = null, string[]? Specials = null,
    string? StartDate = null, string? EndDate = null, string? StartTime = null, string? EndTime = null);
internal sealed record Film(
    string Id, string Title, string PosterUrl, string? PremiereDate, string Overview, string? OverviewLanguage,
    int Duration, string[] Directors, string[] Cast, int ReleaseYear, string[] SpokenLanguages, string? CreatedAt);
internal sealed record Showtime(
    string Id, DateTimeOffset StartDate, DateTimeOffset EndDate, string TheaterId, string TheaterName,
    string TheaterCity, string? TicketingUrl, string? Specials, string Subtitles, string? LanguageVersion);
internal sealed record Screening(Film? Film, Showtime Showtime, string[] SubtitleLanguages, string[] Categories, string? EventTitle);
internal sealed record Movie(
    string Id, string Title,
    [property: JsonPropertyName("poster_path")] string PosterPath,
    [property: JsonPropertyName("release_date")] string ReleaseDate,
    string Overview,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? OverviewLanguage,
    int Duration, string[] Directors, string[] Cast, int ReleaseYear,
    string[] SpokenLanguages, string[] AvailableSubtitles, string[] AvailableLanguageVersions,
    string[] AvailableSpecials, Showtime[] Showtimes,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CreatedAt)
{
    [JsonPropertyName("vote_average")]
    public int VoteAverage => 0;

    [JsonPropertyName("genre_ids")]
    public int[] GenreIds => [];
}

internal sealed class ProgrammeInputException(string message) : Exception(message);
