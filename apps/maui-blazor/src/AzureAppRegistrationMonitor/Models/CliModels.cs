using System.Text.Json.Serialization;

namespace AzureAppRegistrationMonitor.Models;

/// <summary>Standard result envelope returned by every aarm --output json command.</summary>
public record ResultEnvelope<T>(
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("metadata")] ResultMetadata Metadata,
    [property: JsonPropertyName("data")] T Data,
    [property: JsonPropertyName("warnings")] IReadOnlyList<string> Warnings,
    [property: JsonPropertyName("errors")] IReadOnlyList<string> Errors
);

public record ResultMetadata(
    [property: JsonPropertyName("tenantId")] string TenantId,
    [property: JsonPropertyName("environmentName")] string EnvironmentName,
    [property: JsonPropertyName("generatedAt")] string GeneratedAt,
    [property: JsonPropertyName("toolVersion")] string ToolVersion
);

public record TenantProfile(
    [property: JsonPropertyName("tenantId")] string TenantId,
    [property: JsonPropertyName("displayName")] string DisplayName,
    [property: JsonPropertyName("authMode")] string AuthMode,
    [property: JsonPropertyName("clientId")] string? ClientId,
    [property: JsonPropertyName("username")] string? Username,
    [property: JsonPropertyName("defaultEnvironmentName")] string? DefaultEnvironmentName,
    [property: JsonPropertyName("logAnalyticsWorkspaceId")] string? LogAnalyticsWorkspaceId,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("updatedAt")] string UpdatedAt,
    [property: JsonPropertyName("lastPreflightAt")] string? LastPreflightAt,
    [property: JsonPropertyName("lastSuccessfulScanAt")] string? LastSuccessfulScanAt
);

/// <summary>Owner of an App Registration (user or service principal).</summary>
public record AppOwner(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("displayName")] string? DisplayName,
    [property: JsonPropertyName("userPrincipalName")] string? UserPrincipalName
);

public record AppRegistrationSummary(
    [property: JsonPropertyName("applicationObjectId")] string ApplicationObjectId,
    [property: JsonPropertyName("appId")] string AppId,
    [property: JsonPropertyName("displayName")] string DisplayName,
    [property: JsonPropertyName("createdDateTime")] string CreatedDateTime,
    [property: JsonPropertyName("owners")] IReadOnlyList<AppOwner> Owners,
    [property: JsonPropertyName("secretCount")] int SecretCount,
    [property: JsonPropertyName("expiredSecretCount")] int ExpiredSecretCount,
    [property: JsonPropertyName("expiringSecretCount")] int ExpiringSecretCount,
    [property: JsonPropertyName("riskLevel")] string RiskLevel,
    [property: JsonPropertyName("secrets")] IReadOnlyList<SecretSummary> Secrets
);

public record SecretSummary(
    [property: JsonPropertyName("applicationObjectId")] string ApplicationObjectId,
    [property: JsonPropertyName("appId")] string AppId,
    [property: JsonPropertyName("appDisplayName")] string AppDisplayName,
    [property: JsonPropertyName("keyId")] string KeyId,
    [property: JsonPropertyName("displayName")] string? DisplayName,
    [property: JsonPropertyName("hint")] string? Hint,
    [property: JsonPropertyName("startDateTime")] string? StartDateTime,
    [property: JsonPropertyName("endDateTime")] string? EndDateTime,
    [property: JsonPropertyName("daysUntilExpiry")] int? DaysUntilExpiry,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("riskLevel")] string RiskLevel
);

public record CapabilitySet(
    [property: JsonPropertyName("canReadApplications")] bool CanReadApplications,
    [property: JsonPropertyName("canReadApplicationSecrets")] bool CanReadApplicationSecrets,
    [property: JsonPropertyName("canReadServicePrincipals")] bool CanReadServicePrincipals,
    [property: JsonPropertyName("canReadOwners")] bool CanReadOwners,
    [property: JsonPropertyName("canReadDirectory")] bool CanReadDirectory,
    [property: JsonPropertyName("canQueryLogAnalytics")] bool CanQueryLogAnalytics,
    [property: JsonPropertyName("canAnalyzeServicePrincipalSignIns")] bool CanAnalyzeServicePrincipalSignIns,
    [property: JsonPropertyName("canCreateApplicationSecrets")] bool CanCreateApplicationSecrets,
    [property: JsonPropertyName("canDeleteApplicationSecrets")] bool CanDeleteApplicationSecrets,
    [property: JsonPropertyName("canCreateApplications")] bool CanCreateApplications,
    [property: JsonPropertyName("canReadAzureResources")] bool CanReadAzureResources,
    [property: JsonPropertyName("canReadKeyVaultMetadata")] bool CanReadKeyVaultMetadata
);

public record PreflightResult(
    [property: JsonPropertyName("tenantId")] string TenantId,
    [property: JsonPropertyName("environmentName")] string EnvironmentName,
    [property: JsonPropertyName("authValid")] bool AuthValid,
    [property: JsonPropertyName("graphReachable")] bool GraphReachable,
    [property: JsonPropertyName("checkedAt")] string CheckedAt,
    [property: JsonPropertyName("capabilities")] CapabilitySet Capabilities,
    [property: JsonPropertyName("missingPermissions")] IReadOnlyList<string> MissingPermissions,
    [property: JsonPropertyName("warnings")] IReadOnlyList<string> Warnings,
    [property: JsonPropertyName("errors")] IReadOnlyList<string> Errors
);
