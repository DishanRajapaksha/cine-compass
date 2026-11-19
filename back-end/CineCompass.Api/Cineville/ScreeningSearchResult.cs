namespace CineCompass.Api.Cineville;

internal sealed record ScreeningPage(ScreeningResult[] Items, int Total, int? NextOffset, string? NextCursor,
    ScreeningSearchDetails Details) : ToolPage<ScreeningResult>(Items, Total, NextOffset, NextCursor);

internal sealed record ScreeningSearchDetails(EffectiveScreeningFilters EffectiveFilters, string? EmptyReason,
    FilterRelaxation[] RelaxationOptions);

internal sealed record EffectiveScreeningFilters(string? City, string? Cinema, string? Title, string? FilmId,
    string Language, string Subtitles, string LanguageMatch, string TimeZone, DateTimeOffset StartInclusive,
    DateTimeOffset? EndExclusive);

internal sealed record FilterRelaxation(string Language, string Subtitles, int Matches);

internal sealed record ScreeningResult(string? FilmId, string? Title, string[] SpokenLanguages, string[] SubtitleLanguages,
    string[] Categories, Showtime Showtime, string[] AudioLanguages, string AudioSource, string SubtitleStatus, string EndTimeSource)
{
    public static ScreeningResult From(Screening s) =>
        new(s.Film?.Id, s.Film?.Title ?? s.EventTitle, s.Film?.SpokenLanguages ?? [],
            s.SubtitleLanguages, s.Categories, s.Showtime, s.AudioLanguages, s.AudioSource, s.SubtitleStatus, s.EndTimeSource);
}

internal static class ScreeningSearchResult
{
    public static ProgrammeSnapshot<ScreeningResult, ScreeningSearchDetails> Create(
        ScreeningBatch batch, ProgrammeFilter filter, string? title, string? filmId)
    {
        var language = filter.Languages?.Single() ?? "any";
        var subtitles = filter.Subtitles?.Single() ?? "any";
        var effective = new EffectiveScreeningFilters(filter.City, filter.Cinemas?.Single(), title, filmId,
            language, subtitles, filter.MatchEitherLanguage ? "or" : "and", "Europe/Amsterdam", ProgrammeDates.LocalTime(batch.Start),
            batch.End is { } end ? ProgrammeDates.LocalTime(end) : null);

        var candidates = batch.Screenings.Where(s => string.IsNullOrWhiteSpace(title) ||
            s.Film?.Title.Contains(title, StringComparison.OrdinalIgnoreCase) == true).ToArray();
        var results = candidates.Where(s =>
            ScreeningLanguage.Matches(s, filter.Languages, filter.Subtitles, filter.MatchEitherLanguage))
            .Select(ScreeningResult.From).ToArray();
        var reason = results.Length > 0 ? null : batch.EmptyReason ??
            (candidates.Length == 0 ? "no_title_matches" : "no_language_matches");
        var alternatives = reason == "no_language_matches" ? Relax(candidates, filter, effective) : [];
        return new(results, new(effective, reason, alternatives));
    }

    private static FilterRelaxation[] Relax(
        Screening[] candidates, ProgrammeFilter filter, EffectiveScreeningFilters effective)
    {
        var alternatives = new List<FilterRelaxation>();
        if (filter.Languages is not null)
        {
            var matches = candidates.Count(s => ScreeningLanguage.Matches(filter.Subtitles, s.SubtitleLanguages));
            if (matches > 0) alternatives.Add(new("any", effective.Subtitles, matches));
        }
        if (filter.Subtitles is not null)
        {
            var matches = candidates.Count(s => ScreeningLanguage.Matches(filter.Languages, s.AudioLanguages));
            if (matches > 0) alternatives.Add(new(effective.Language, "any", matches));
        }
        if (alternatives.Count == 0 && filter.Languages is not null && filter.Subtitles is not null)
            alternatives.Add(new("any", "any", candidates.Length));
        return alternatives.ToArray();
    }
}
