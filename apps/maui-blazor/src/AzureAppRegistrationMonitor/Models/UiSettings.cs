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

    /// <summary>
    /// Teams incoming webhook URL for sending secret status notifications.
    /// Leave empty to disable Teams notifications.
    /// </summary>
    public string TeamsWebhookUrl { get; set; } = "";

    // ── Cloud Mode ────────────────────────────────────────────────────────────

    /// <summary>"local" uses the bundled CLI; "cloud" calls the Azure Function endpoints.</summary>
    public string AppMode { get; set; } = "local";

    /// <summary>Base URI of the AARM Azure Function app, e.g. https://aarm-fn.azurewebsites.net</summary>
    public string CloudBaseUri { get; set; } = "";

    // CloudFunctionKey is stored in Windows Credential Manager (not here) under
    // target name "aarm/cloud-function-key".

    // ── Setup gate ────────────────────────────────────────────────────────────

    /// <summary>
    /// Set to true after the user completes the initial startup mode-selection screen.
    /// False (default) triggers the startup screen on next launch.
    /// </summary>
    public bool SetupCompleted { get; set; } = false;
}
