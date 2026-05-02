using AzureAppRegistrationMonitor.Models;
using AzureAppRegistrationMonitor.Services;

namespace AzureAppRegistrationMonitor.ViewModels;

public class SecretListViewModel
{
    private readonly CliExecutionService _cli;

    public SecretListViewModel(CliExecutionService cli) => _cli = cli;

    public IReadOnlyList<SecretSummary> Secrets { get; private set; } =
        Array.Empty<SecretSummary>();

    public bool IsLoading { get; private set; }
    public string? ErrorMessage { get; private set; }

    public async Task LoadExpiringAsync(string tenantNameOrId, int days = 90)
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            var envelope = await _cli.RunAsync<IReadOnlyList<SecretSummary>>(
                tenantNameOrId, "secrets", "expiring", "--days", days.ToString());
            Secrets = envelope?.Data ?? Array.Empty<SecretSummary>();
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

    public async Task LoadExpiredAsync(string tenantNameOrId)
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            var envelope = await _cli.RunAsync<IReadOnlyList<SecretSummary>>(
                tenantNameOrId, "secrets", "expired");
            Secrets = envelope?.Data ?? Array.Empty<SecretSummary>();
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
