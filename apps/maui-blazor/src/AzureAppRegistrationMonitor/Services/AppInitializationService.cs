using AzureAppRegistrationMonitor.Services.DataProviders;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Runs once at startup: ensures required directories exist, loads settings,
/// restores the active data provider (Cloud or Local), and pre-selects the
/// default tenant in AppStateService.
/// </summary>
public class AppInitializationService
{
    private readonly SettingsService _settings;
    private readonly TenantConfigRepository _tenantRepo;
    private readonly AppStateService _appState;
    private readonly DelegatingDataProvider _dataProvider;
    private readonly CredentialRepository _credentials;
    private readonly LocalCliDataProvider _localProvider;

    public AppInitializationService(
        SettingsService settings,
        TenantConfigRepository tenantRepo,
        AppStateService appState,
        DelegatingDataProvider dataProvider,
        CredentialRepository credentials,
        LocalCliDataProvider localProvider)
    {
        _settings      = settings;
        _tenantRepo    = tenantRepo;
        _appState      = appState;
        _dataProvider  = dataProvider;
        _credentials   = credentials;
        _localProvider = localProvider;
    }

    /// <summary>
    /// True when the startup setup screen must be shown before the main UI.
    /// Recomputed on every access so that changes made during setup take effect
    /// immediately without requiring re-initialization.
    /// </summary>
    public bool SetupRequired =>
        !_settings.Settings.SetupCompleted
        || (_settings.Settings.AppMode == "cloud"
            && (string.IsNullOrWhiteSpace(_settings.Settings.CloudBaseUri)
                || string.IsNullOrWhiteSpace(_credentials.GetCloudFunctionKey())));

    public bool IsInitialized { get; private set; }

    public async Task InitializeAsync()
    {
        EnsureDirectories();
        await _settings.LoadAsync();

        // Restore the provider from persisted settings so the correct backend
        // is active immediately on restart — without requiring the setup screen.
        RestoreProvider();

        if (!SetupRequired)
            await PreSelectDefaultTenantAsync();

        IsInitialized = true;
    }

    /// <summary>
    /// Activates the Cloud provider using saved settings and stored key.
    /// Called from Startup.razor after the user completes setup, so the
    /// app doesn't need a restart to switch modes.
    /// </summary>
    public void ApplyCloudProvider(string baseUri, string functionKey)
    {
        _dataProvider.SetProvider(new CloudHttpDataProvider(baseUri, functionKey));
    }

    public void ApplyLocalProvider()
    {
        _dataProvider.SetProvider(_localProvider);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private void RestoreProvider()
    {
        if (_settings.Settings.AppMode == "cloud"
            && !string.IsNullOrWhiteSpace(_settings.Settings.CloudBaseUri))
        {
            var key = _credentials.GetCloudFunctionKey();
            if (!string.IsNullOrWhiteSpace(key))
            {
                _dataProvider.SetProvider(
                    new CloudHttpDataProvider(_settings.Settings.CloudBaseUri, key));
                return;
            }
            // Key missing from Credential Manager — SetupRequired will catch this and
            // show the setup screen so the user can re-enter the key.
        }

        _dataProvider.SetProvider(_localProvider);
    }

    private static void EnsureDirectories()
    {
        var configDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".aarm");
        Directory.CreateDirectory(configDir);
        Directory.CreateDirectory(Path.Combine(configDir, "history"));
    }

    private async Task PreSelectDefaultTenantAsync()
    {
        if (_settings.Settings.AppMode == "cloud")
        {
            // Try to pre-select from saved DefaultTenant setting via the cloud API.
            // Failures are swallowed — the user can select manually.
            try
            {
                var cloudTenants = await ((DelegatingDataProvider)_dataProvider).GetTenantsAsync();
                if (cloudTenants.Count == 0) return;
                var preferred = !string.IsNullOrEmpty(_settings.Settings.DefaultTenant)
                    ? cloudTenants.FirstOrDefault(t => t.DisplayName == _settings.Settings.DefaultTenant
                                                    || t.TenantId    == _settings.Settings.DefaultTenant)
                    : null;
                _appState.SetActiveTenant(preferred ?? cloudTenants[0]);
            }
            catch { /* API not reachable at startup — ignore */ }
            return;
        }

        var tenants = await _tenantRepo.ListTenantsAsync();
        if (tenants.Count == 0) return;
        var local = !string.IsNullOrEmpty(_settings.Settings.DefaultTenant)
            ? tenants.FirstOrDefault(t => t.DisplayName == _settings.Settings.DefaultTenant
                                       || t.TenantId    == _settings.Settings.DefaultTenant)
            : null;
        _appState.SetActiveTenant(local ?? tenants[0]);
    }
}
