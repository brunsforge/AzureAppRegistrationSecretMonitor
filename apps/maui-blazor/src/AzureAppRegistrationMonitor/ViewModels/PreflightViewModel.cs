using AzureAppRegistrationMonitor.Models;
using AzureAppRegistrationMonitor.Services;

namespace AzureAppRegistrationMonitor.ViewModels;

public class PreflightViewModel
{
    private readonly CliExecutionService _cli;

    public PreflightViewModel(CliExecutionService cli) => _cli = cli;

    public PreflightResult? Result { get; private set; }
    public bool IsLoading { get; private set; }
    public string? ErrorMessage { get; private set; }

    public async Task RunAsync(string tenantNameOrId, string environmentName = "default")
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            var envelope = await _cli.RunAsync<PreflightResult>(
                tenantNameOrId, "preflight", "run");
            Result = envelope?.Data;
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
