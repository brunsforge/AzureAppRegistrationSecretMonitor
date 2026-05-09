using AzureAppRegistrationMonitor.Models;
using AzureAppRegistrationMonitor.Services;

namespace AzureAppRegistrationMonitor.Services.DataProviders;

/// <summary>
/// Routes data requests to the local aarm CLI child process.
/// Forwards ProgressMessage events (device-code prompts, stderr lines) to subscribers.
/// </summary>
public class LocalCliDataProvider : IDataProvider
{
    private readonly CliExecutionService _cli;
    private readonly TenantConfigRepository _tenantRepo;
    private readonly CredentialRepository _credentials;

    public event Action<string>? ProgressMessage;
    public bool IsCloudMode => false;

    public LocalCliDataProvider(
        CliExecutionService cli,
        TenantConfigRepository tenantRepo,
        CredentialRepository credentials)
    {
        _cli = cli;
        _tenantRepo = tenantRepo;
        _credentials = credentials;
        _cli.ProgressMessage += msg => ProgressMessage?.Invoke(msg);
    }

    public async Task<IReadOnlyList<TenantProfile>> GetTenantsAsync() =>
        await _tenantRepo.ListTenantsAsync();

    public Task<ResultEnvelope<List<SecretSummary>>?> GetSecretsAsync(
        string tenantId, string? environmentName = null)
        => _cli.RunAsync<List<SecretSummary>>(tenantId, ["secrets", "list"]);

    public Task<ResultEnvelope<List<AppRegistrationSummary>>?> GetAppsAsync(
        string tenantId, string? environmentName = null)
        => _cli.RunAsync<List<AppRegistrationSummary>>(tenantId, ["apps", "list"]);

    public Task<ResultEnvelope<PreflightResult>?> GetPreflightAsync(
        string tenantId, string? environmentName = null)
        => _cli.RunAsync<PreflightResult>(tenantId, ["preflight", "run"]);

    // Local Mode: scan happens on GetSecretsAsync — no separate trigger needed.
    public Task<bool> TriggerScanAsync(string tenantId) => Task.FromResult(true);

    public async Task<TenantProfile?> AddTenantAsync(CloudTenantRequest req)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        var profile = new TenantProfile(
            TenantId: req.TenantId, DisplayName: req.TenantDisplayName,
            AuthMode: req.AuthMode, ClientId: req.ClientId, Username: null,
            DefaultEnvironmentName: req.EnvironmentName,
            LogAnalyticsWorkspaceId: req.LogAnalytics?.WorkspaceId,
            CreatedAt: now, UpdatedAt: now,
            LastPreflightAt: null, LastSuccessfulScanAt: null);
        await _tenantRepo.UpsertTenantAsync(profile);
        if (req.AuthMode == "client-secret" && req.ClientId is not null && req.CredentialValue is not null)
            _credentials.SetClientSecret(req.TenantId, req.ClientId, req.CredentialValue);
        return profile;
    }

    public async Task<TenantProfile?> UpdateTenantAsync(string tenantId, CloudTenantRequest req)
    {
        var existing = await _tenantRepo.GetTenantAsync(tenantId);
        var now = DateTimeOffset.UtcNow.ToString("O");
        var profile = new TenantProfile(
            TenantId: tenantId, DisplayName: req.TenantDisplayName,
            AuthMode: req.AuthMode, ClientId: req.ClientId, Username: null,
            DefaultEnvironmentName: req.EnvironmentName,
            LogAnalyticsWorkspaceId: req.LogAnalytics?.WorkspaceId,
            CreatedAt: existing?.CreatedAt ?? now, UpdatedAt: now,
            LastPreflightAt: existing?.LastPreflightAt,
            LastSuccessfulScanAt: existing?.LastSuccessfulScanAt);
        await _tenantRepo.UpsertTenantAsync(profile);
        if (req.AuthMode == "client-secret" && req.ClientId is not null && req.CredentialValue is not null)
            _credentials.SetClientSecret(tenantId, req.ClientId, req.CredentialValue);
        return profile;
    }

    public async Task<bool> DeleteTenantAsync(string tenantId)
    {
        var tenant = await _tenantRepo.GetTenantAsync(tenantId);
        if (tenant?.ClientId is not null)
        {
            _credentials.DeleteClientSecret(tenantId, tenant.ClientId);
            if (tenant.Username is not null)
                _credentials.DeleteUserPassword(tenantId, tenant.ClientId, tenant.Username);
        }
        await _tenantRepo.DeleteTenantAsync(tenantId);
        return true;
    }

}
