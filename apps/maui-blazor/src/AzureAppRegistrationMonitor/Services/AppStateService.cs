using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Singleton that holds the currently selected tenant across all pages.
/// Pages subscribe to OnChange and call StateHasChanged when it fires.
/// </summary>
public class AppStateService
{
    private TenantProfile? _activeTenant;

    public TenantProfile? ActiveTenant => _activeTenant;

    public event Action? OnChange;

    public void SetActiveTenant(TenantProfile? tenant)
    {
        if (_activeTenant?.TenantId == tenant?.TenantId) return;
        _activeTenant = tenant;
        OnChange?.Invoke();
    }
}
