using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services.DataProviders;

/// <summary>
/// Routes data requests to the local aarm CLI child process.
/// Forwards ProgressMessage events (device-code prompts, stderr lines) to subscribers.
/// </summary>
public class LocalCliDataProvider : IDataProvider
{
    private readonly CliExecutionService _cli;
    private readonly TenantConfigRepository _tenantRepo;

    public event Action<string>? ProgressMessage;
    public bool IsCloudMode => false;

    public LocalCliDataProvider(CliExecutionService cli, TenantConfigRepository tenantRepo)
    {
        _cli = cli;
        _tenantRepo = tenantRepo;
        _cli.ProgressMessage += msg => ProgressMessage?.Invoke(msg);
    }

    public async Task<IReadOnlyList<TenantProfile>> GetTenantsAsync() =>
        await _tenantRepo.ListTenantsAsync();

    public Task<ResultEnvelope<List<SecretSummary>>?> GetSecretsAsync(
        string tenantId, string? environmentName = null)
    {
        var args = WithEnv(new[] { "secrets", "list" }, environmentName);
        return _cli.RunAsync<List<SecretSummary>>(tenantId, args);
    }

    public Task<ResultEnvelope<List<AppRegistrationSummary>>?> GetAppsAsync(
        string tenantId, string? environmentName = null)
    {
        var args = WithEnv(new[] { "apps", "list" }, environmentName);
        return _cli.RunAsync<List<AppRegistrationSummary>>(tenantId, args);
    }

    public Task<ResultEnvelope<PreflightResult>?> GetPreflightAsync(
        string tenantId, string? environmentName = null)
    {
        var args = WithEnv(new[] { "preflight", "run" }, environmentName);
        return _cli.RunAsync<PreflightResult>(tenantId, args);
    }

    // Local Mode: scan happens on GetSecretsAsync — no separate trigger needed.
    public Task<bool> TriggerScanAsync(string tenantId) => Task.FromResult(true);

    private static string[] WithEnv(string[] baseArgs, string? env) =>
        env is null ? baseArgs : [.. baseArgs, "--env", env];
}
