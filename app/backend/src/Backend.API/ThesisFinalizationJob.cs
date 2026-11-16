using Backend.Application.Submissions;
using MediatR;

namespace Backend.API;

public sealed class ThesisFinalizationJob(IServiceScopeFactory scopes, ILogger<ThesisFinalizationJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var count = await scope.ServiceProvider.GetRequiredService<ISender>()
                    .Send(new FinalizeExpiredThesesCommand(), stoppingToken);
                if (count > 0) logger.LogInformation("Finalized {Count} thesis submissions", count);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogError(error, "Thesis finalization job failed"); }
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
