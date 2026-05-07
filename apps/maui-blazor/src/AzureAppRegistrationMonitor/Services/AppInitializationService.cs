namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Runs once at startup: ensures required directories exist, loads settings,
/// and pre-selects the default tenant in AppStateService.
/// </summary>
public class AppInitializationService
{
    private readonly SettingsService _settings;
    private readonly TenantConfigRepository _tenantRepo;
    private readonly AppStateService _appState;

    public AppInitializationService(
        SettingsService settings,
        TenantConfigRepository tenantRepo,
        AppStateService appState)
    {
        _settings   = settings;
        _tenantRepo = tenantRepo;
        _appState   = appState;
    }

    /// <summary>
    /// True when the startup setup screen must be shown before the main UI.
    /// Conditions: first run (SetupCompleted = false), or Cloud Mode configured
    /// without a base URI.
    /// </summary>
    public bool SetupRequired { get; private set; }

    public async Task InitializeAsync()
    {
        EnsureDirectories();
        await _settings.LoadAsync();

        SetupRequired = !_settings.Settings.SetupCompleted
                        || (_settings.Settings.AppMode == "cloud"
                            && string.IsNullOrWhiteSpace(_settings.Settings.CloudBaseUri));

        if (!SetupRequired)
            await PreSelectDefaultTenantAsync();
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
        var tenants = await _tenantRepo.ListTenantsAsync();
        if (tenants.Count == 0) return;

        var preferred = !string.IsNullOrEmpty(_settings.Settings.DefaultTenant)
            ? tenants.FirstOrDefault(t => t.DisplayName == _settings.Settings.DefaultTenant
                                       || t.TenantId    == _settings.Settings.DefaultTenant)
            : null;

        _appState.SetActiveTenant(preferred ?? tenants[0]);
    }
}
