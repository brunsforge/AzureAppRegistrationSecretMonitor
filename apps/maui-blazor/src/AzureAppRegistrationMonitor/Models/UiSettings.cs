namespace AzureAppRegistrationMonitor.Models;

public class UiSettings
{
    /// <summary>Tenant most recently scanned — used for dashboard auto-load.</summary>
    public string? LastScannedTenant { get; set; }

    /// <summary>UTC timestamp of the last successful scan.</summary>
    public DateTimeOffset? LastScanTime { get; set; }

    /// <summary>Default tenant shown in dropdowns on first open.</summary>
    public string? DefaultTenant { get; set; }

    /// <summary>Default auth mode pre-selected when adding a new tenant from the UI.</summary>
    public string DefaultAuthMode { get; set; } = "interactive-browser";

    /// <summary>
    /// Override the CLI binary path for development.
    /// Equivalent to setting AARM_CLI_PATH env var.
    /// Leave empty to use auto-detection.
    /// </summary>
    public string CliPathOverride { get; set; } = "";
}
