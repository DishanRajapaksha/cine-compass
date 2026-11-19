namespace CineCompass.Api.Notifications;

internal sealed class ScreeningNotificationWorker(
    IServiceScopeFactory scopes, TimeProvider clock, IConfiguration configuration,
    ILogger<ScreeningNotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("ScreeningNotifications:Enabled", true)) return;
        var interval = TimeSpan.FromMinutes(15);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<ScreeningNotificationScanner>().CheckDue(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception error)
            {
                logger.LogWarning(error, "The screening reminder check will retry");
            }
            // Align to the quarter hour so the scheduled check starts at 08:00 local time.
            var delay = interval - TimeSpan.FromTicks(clock.GetUtcNow().UtcTicks % interval.Ticks);
            try { await Task.Delay(delay, clock, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
        }
    }
}
