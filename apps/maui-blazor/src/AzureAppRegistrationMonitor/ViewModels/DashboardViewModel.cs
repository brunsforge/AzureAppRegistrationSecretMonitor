using AzureAppRegistrationMonitor.Models;
using AzureAppRegistrationMonitor.Services;

namespace AzureAppRegistrationMonitor.ViewModels;

public class DashboardViewModel
{
    private readonly CliExecutionService _cli;

    public DashboardViewModel(CliExecutionService cli) => _cli = cli;

    public IReadOnlyList<AppRegistrationSummary> Apps { get; private set; } =
        Array.Empty<AppRegistrationSummary>();

    public bool IsLoading { get; private set; }
    public string? ErrorMessage { get; private set; }

    public int TotalSecrets => Apps.Sum(a => a.SecretCount);
    public int ExpiredCount => Apps.Sum(a => a.ExpiredSecretCount);
    public int ExpiringIn30Days => Apps
        .SelectMany(a => a.Secrets)
        .Count(s => s.DaysUntilExpiry is >= 0 and <= 30);
    public int ExpiringIn90Days => Apps
        .SelectMany(a => a.Secrets)
        .Count(s => s.DaysUntilExpiry is >= 0 and <= 90);

    public async Task LoadAsync(string tenantNameOrId)
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            var envelope = await _cli.RunAsync<IReadOnlyList<AppRegistrationSummary>>(
                tenantNameOrId, "apps", "list");
            Apps = envelope?.Data ?? Array.Empty<AppRegistrationSummary>();
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsLoading = false;
        }
    }
}
