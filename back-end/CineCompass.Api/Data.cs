using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace CineCompass.Api;

public sealed class AppUser : IdentityUser;
public sealed class UserSettings
{
    public string UserId { get; set; } = "";
    public string Json { get; set; } = "{}";
    public long Revision { get; set; }
}
public sealed class CalendarSubscription
{
    public string UserId { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public string ProtectedToken { get; set; } = "";
    public int? ReminderMinutes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public long Revision { get; set; }
}
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser>(options)
{
    public DbSet<CalendarSubscription> CalendarSubscriptions => Set<CalendarSubscription>();
    public DbSet<UserSettings> Settings => Set<UserSettings>();
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<CalendarSubscription>().HasKey(x => x.UserId);
        builder.Entity<CalendarSubscription>().HasIndex(x => x.TokenHash).IsUnique();
        builder.Entity<CalendarSubscription>().Property(x => x.Revision).IsConcurrencyToken();
        builder.Entity<CalendarSubscription>().HasOne<AppUser>().WithOne().HasForeignKey<CalendarSubscription>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.Entity<UserSettings>().HasKey(x => x.UserId);
        builder.Entity<UserSettings>().Property(x => x.Json).HasColumnType("jsonb");
        builder.Entity<UserSettings>().Property(x => x.Revision).IsConcurrencyToken();
        builder.Entity<UserSettings>().HasOne<AppUser>().WithOne().HasForeignKey<UserSettings>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
