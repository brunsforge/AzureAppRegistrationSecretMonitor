using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services.DataProviders;

/// <summary>
/// Singleton proxy registered in the DI container.
/// Delegates all calls to the currently active inner provider.
/// Call <see cref="SetProvider"/> to hot-swap providers when the user changes AppMode
/// in Settings — no app restart required.
/// </summary>
public class DelegatingDataProvider : IDataProvider
{
    private IDataProvider _inner;

    public event Action<string>? ProgressMessage;
    public bool IsCloudMode => _inner.IsCloudMode;

    public DelegatingDataProvider(LocalCliDataProvider local)
    {
        _inner = local;
        WireEvents();
    }

    public void SetProvider(IDataProvider provider)
    {
        _inner.ProgressMessage -= OnInnerProgress;
        _inner = provider;
        WireEvents();
    }

    public Task<IReadOnlyList<TenantProfile>> GetTenantsAsync()
        => _inner.GetTenantsAsync();

    public Task<ResultEnvelope<List<SecretSummary>>?> GetSecretsAsync(
        string tenantId, string? environmentName = null)
        => _inner.GetSecretsAsync(tenantId, environmentName);

    public Task<ResultEnvelope<List<AppRegistrationSummary>>?> GetAppsAsync(
        string tenantId, string? environmentName = null)
        => _inner.GetAppsAsync(tenantId, environmentName);

    public Task<ResultEnvelope<PreflightResult>?> GetPreflightAsync(
        string tenantId, string? environmentName = null)
        => _inner.GetPreflightAsync(tenantId, environmentName);

    public Task<bool> TriggerScanAsync(string tenantId)
        => _inner.TriggerScanAsync(tenantId);

    public Task<TenantProfile?> AddTenantAsync(CloudTenantRequest request)
        => _inner.AddTenantAsync(request);

    public Task<TenantProfile?> UpdateTenantAsync(string tenantId, CloudTenantRequest request)
        => _inner.UpdateTenantAsync(tenantId, request);

    public Task<bool> DeleteTenantAsync(string tenantId)
        => _inner.DeleteTenantAsync(tenantId);

    private void OnInnerProgress(string msg) => ProgressMessage?.Invoke(msg);
    private void WireEvents() => _inner.ProgressMessage += OnInnerProgress;
}
