using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services.DataProviders;

public interface IDataProvider
{
    /// <summary>Fired for each stderr line from the CLI (Local mode only).</summary>
    event Action<string>? ProgressMessage;

    bool IsCloudMode { get; }

    /// <summary>All configured tenants — drives dropdowns in every page.</summary>
    Task<IReadOnlyList<TenantProfile>> GetTenantsAsync();

    /// <summary>Flat list of all secrets — for the Secret List page.</summary>
    Task<ResultEnvelope<List<SecretSummary>>?> GetSecretsAsync(
        string tenantId, string? environmentName = null);

    /// <summary>Per-app summaries with nested secrets — for the Dashboard.</summary>
    Task<ResultEnvelope<List<AppRegistrationSummary>>?> GetAppsAsync(
        string tenantId, string? environmentName = null);

    Task<ResultEnvelope<PreflightResult>?> GetPreflightAsync(
        string tenantId, string? environmentName = null);

    /// <summary>
    /// Cloud Mode: triggers an immediate scan on the server (POST /api/tenants/{id}/scan).
    /// Teams notifications are sent by the server according to the job configuration.
    /// Local Mode: no-op — scanning happens when GetSecretsAsync is called.
    /// </summary>
    Task<bool> TriggerScanAsync(string tenantId);

    /// <summary>Adds a new tenant/job. Stores the credential in KV (Cloud) or local store (Local).</summary>
    Task<TenantProfile?> AddTenantAsync(CloudTenantRequest request);

    /// <summary>Updates an existing tenant/job. Pass null credentialValue to keep the existing credential.</summary>
    Task<TenantProfile?> UpdateTenantAsync(string tenantId, CloudTenantRequest request);

    /// <summary>Deletes a tenant/job and its stored credential.</summary>
    Task<bool> DeleteTenantAsync(string tenantId);
}
