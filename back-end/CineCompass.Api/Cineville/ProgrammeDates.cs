using System.Globalization;

namespace CineCompass.Api.Cineville;

internal static class ProgrammeDates
{
    private static readonly TimeZoneInfo Amsterdam = TimeZoneInfo.FindSystemTimeZoneById("Europe/Amsterdam");

    public static DateTimeOffset LocalTime(DateTimeOffset time) => TimeZoneInfo.ConvertTime(time, Amsterdam);

    public static DateOnly Today(DateTimeOffset now) => DateOnly.FromDateTime(LocalTime(now).DateTime);

    public static DateTimeOffset Minute(DateTimeOffset now) =>
        new(now.Ticks - now.Ticks % TimeSpan.TicksPerMinute, now.Offset);

    public static bool TryDate(string? text, out DateOnly day) =>
        DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out day);

    public static (DateTimeOffset Start, DateTimeOffset? End) Range(
        ProgrammeFilter filter, DateTimeOffset now, bool upcomingOnly, bool openEnded)
    {
        var today = Today(now);
        var first = ParseDate(filter.StartDate) ?? today;
        var last = ParseDate(filter.EndDate);
        var startTime = ParseTime(filter.StartTime);
        var endTime = ParseTime(filter.EndTime);
        var start = filter.StartDate is null && startTime is null
            ? Minute(now)
            : ToInstant(first.ToDateTime(startTime ?? TimeOnly.MinValue), end: false);
        DateTimeOffset? end = null;
        if (last is not null || endTime is not null || !openEnded)
        {
            var endDay = last ?? first;
            var localEnd = endTime is { } time
                ? endDay.ToDateTime(time).AddMinutes(1)
                : endDay.AddDays(1).ToDateTime(TimeOnly.MinValue);
            end = ToInstant(localEnd, end: true);
            if (endDay < first || (end <= start && (filter.StartDate is not null || startTime is not null)))
                throw new ProgrammeInputException("End date and time must follow the start.");
        }

        return (upcomingOnly && start < Minute(now) ? Minute(now) : start, end);
    }

    private static DateOnly? ParseDate(string? value)
    {
        if (value is null) return null;
        if (TryDate(value, out var day) && day.Year is > 1 and < 9999) return day;
        throw new ProgrammeInputException("Dates must use YYYY-MM-DD.");
    }

    private static TimeOnly? ParseTime(string? value)
    {
        if (value is null) return null;
        if (TimeOnly.TryParseExact(value, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return time;
        throw new ProgrammeInputException("Times must use HH:mm.");
    }

    private static DateTimeOffset ToInstant(DateTime local, bool end)
    {
        // Advance a boundary in the spring gap to the first real minute.
        while (Amsterdam.IsInvalidTime(local))
            local = local.AddMinutes(1);

        var offset = Amsterdam.IsAmbiguousTime(local)
            ? (end ? Amsterdam.GetAmbiguousTimeOffsets(local).Min() : Amsterdam.GetAmbiguousTimeOffsets(local).Max())
            : Amsterdam.GetUtcOffset(local);
        return new DateTimeOffset(local, offset);
    }
}
