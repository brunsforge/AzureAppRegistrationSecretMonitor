using System.Text.Json.Serialization;

namespace AzureAppRegistrationMonitor.Models;

/// <summary>
/// Request body for POST /api/tenants (add) and PUT /api/tenants/{id} (update).
/// The function stores the credential in Key Vault — it is never persisted locally.
/// </summary>
public class CloudTenantRequest
{
    [JsonPropertyName("tenantId")]
    public string TenantId { get; set; } = "";

    [JsonPropertyName("tenantDisplayName")]
    public string TenantDisplayName { get; set; } = "";

    [JsonPropertyName("environmentName")]
    public string EnvironmentName { get; set; } = "default";

    [JsonPropertyName("authMode")]
    public string AuthMode { get; set; } = "client-secret";

    [JsonPropertyName("clientId")]
    public string? ClientId { get; set; }

    /// <summary>
    /// Client secret value. Sent to the function API over HTTPS and stored in Azure Key Vault.
    /// Never persisted locally.
    /// For update: leave null to keep the existing credential.
    /// </summary>
    [JsonPropertyName("credentialValue")]
    public string? CredentialValue { get; set; }

    [JsonPropertyName("schedule")]
    public CloudJobSchedule Schedule { get; set; } = new();

    [JsonPropertyName("teamsWebhooks")]
    public CloudTeamsWebhooks? TeamsWebhooks { get; set; }

    [JsonPropertyName("notificationThresholds")]
    public CloudNotificationThresholds? NotificationThresholds { get; set; }

    [JsonPropertyName("logAnalytics")]
    public CloudLogAnalytics? LogAnalytics { get; set; }
}

public class CloudJobSchedule
{
    [JsonPropertyName("intervalDays")]
    public int IntervalDays { get; set; } = 1;

    [JsonPropertyName("runAtUtc")]
    public string RunAtUtc { get; set; } = "06:00";
}

public class CloudTeamsWebhooks
{
    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("alerts")]
    public string? Alerts { get; set; }

    [JsonPropertyName("errors")]
    public string? Errors { get; set; }
}

public class CloudNotificationThresholds
{
    [JsonPropertyName("expiringWithinDays")]
    public int ExpiringWithinDays { get; set; } = 30;

    [JsonPropertyName("criticalWithinDays")]
    public int CriticalWithinDays { get; set; } = 7;
}

public class CloudLogAnalytics
{
    [JsonPropertyName("workspaceId")]
    public string? WorkspaceId { get; set; }

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; }
}
