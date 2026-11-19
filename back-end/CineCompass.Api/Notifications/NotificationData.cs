using Microsoft.EntityFrameworkCore;
using CineCompass.Api.Cineville;

namespace CineCompass.Api.Notifications;

public sealed class ScreeningNotification
{
    public long Id { get; set; }
    public string UserId { get; set; } = "";
    public string ScreeningId { get; set; } = "";
    public string FilmId { get; set; } = "";
    public string FilmTitle { get; set; } = "";
    public string TheaterName { get; set; } = "";
    public string TheaterCity { get; set; } = "";
    public string? TicketingUrl { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset FoundAt { get; set; }
    public bool IsRead { get; set; }
    public string[]? AudioLanguages { get; set; }
    public string? AudioSource { get; set; }
    public string? LanguageVersion { get; set; }
    public string[]? SubtitleLanguages { get; set; }
    public string? SubtitleStatus { get; set; }

    internal void RecordLanguages(Screening screening)
    {
        AudioLanguages = screening.AudioLanguages;
        AudioSource = screening.AudioSource;
        LanguageVersion = screening.Showtime.LanguageVersion;
        SubtitleLanguages = screening.SubtitleLanguages;
        SubtitleStatus = screening.SubtitleStatus;
    }
}

public sealed class ScreeningNotificationScan
{
    public const int DailySchedule = 1;
    public int Id { get; set; }
    public DateOnly CompletedDay { get; set; }
}

internal static class NotificationData
{
    public static void Configure(ModelBuilder model)
    {
        model.Entity<ScreeningNotificationScan>().Property(row => row.Id).ValueGeneratedNever();
        model.Entity<ScreeningNotificationScan>().Property(row => row.CompletedDay).IsConcurrencyToken();
        var inbox = model.Entity<ScreeningNotification>();
        inbox.HasIndex(row => new { row.UserId, row.ScreeningId }).IsUnique();
        inbox.HasIndex(row => new { row.UserId, row.Id });
        inbox.HasIndex(row => new { row.UserId, row.IsRead });
        inbox.HasIndex(row => new { row.UserId, row.FoundAt });
        inbox.HasOne<AppUser>().WithMany().HasForeignKey(row => row.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
