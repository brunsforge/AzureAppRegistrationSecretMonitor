# Domain Model

## Core Terms

| Term | Meaning |
|---|---|
| Tenant | A Microsoft Entra ID tenant. |
| Environment | A named context inside a tenant, e.g. DEV, TEST, PROD. May map to a Dataverse environment or an organizational environment label. |
| App Registration | The Entra application object where application configuration and credentials are defined. |
| Service Principal | The enterprise application instance of an App Registration in a tenant. Sign-in logs usually relate to the service principal. |
| Password Credential | Microsoft Graph object representing a client secret on an application. |
| Secret | User-facing term for a Password Credential. The secret value is only visible at creation time and cannot be read later. |
| Key ID | Stable identifier of a credential. Used to connect a password credential to sign-in log usage. |
| Hint | Partial hint for a secret value, useful only for human recognition. |
| Owner | User or service principal responsible for an application. Requires sufficient directory read permissions. |
| Preflight Check | A set of active tests that determines which functions are available in a tenant/environment. |
| Capability | A boolean or structured result representing one available function, e.g. `canReadApplications`. |
| Finding | A risk or observation produced by analysis. |
| Risk Level | Classification such as Info, Low, Medium, High, Critical. |
| Usage Analysis | Analysis of Service Principal Sign-in Logs to detect whether an app/credential was used. |
| Log Analytics Workspace | Azure Monitor workspace that stores Entra diagnostic logs. |
| Guided Rotation | Assisted process for rotating a secret safely, not necessarily automated. |
| Remediation Hint | Human-readable guidance on where to check or what to change. |

## Main Entities

### TenantProfile

Represents a configured tenant.

Fields:

- `tenantId`
- `displayName`
- `defaultEnvironmentName`
- `authMode`
- `createdAt`
- `updatedAt`
- `lastPreflightAt`
- `lastSuccessfulScanAt`

### EnvironmentProfile

Represents a named operational context within a tenant.

Fields:

- `environmentId`
- `tenantId`
- `name` — user-defined slug, free text (e.g. `prod`, `test`, `contoso-prod`)
- `notes`
- `logAnalyticsWorkspaceId`
- `defaultDaysForUsageAnalysis`

Display name in UI is composed from tenant metadata and the user-defined slug, for example: `Contoso — prod`.

There is no pre-defined type enum. Users label environments freely. DEV / TEST / PROD are examples, not enforced values.

### AppRegistrationSummary

Fields:

- `displayName`
- `appId`
- `applicationObjectId`
- `createdDateTime`
- `owners`
- `secretCount`
- `expiredSecretCount`
- `expiringSecretCount`
- `riskLevel`

### SecretSummary

Fields:

- `applicationObjectId`
- `appId`
- `appDisplayName`
- `keyId`
- `displayName`
- `hint`
- `startDateTime`
- `endDateTime`
- `daysUntilExpiry`
- `status`
- `riskLevel`
- `lastSeenAt`
- `usageCount`

### PreflightResult

Fields:

- `tenantId`
- `environmentName`
- `authValid`
- `graphReachable`
- `checkedAt`
- `capabilities`
- `missingPermissions`
- `warnings`
- `errors`

### CapabilitySet

Initial capabilities:

- `canReadApplications`
- `canReadApplicationSecrets`
- `canReadServicePrincipals`
- `canReadOwners`
- `canReadDirectory`
- `canQueryLogAnalytics`
- `canAnalyzeServicePrincipalSignIns`
- `canCreateApplicationSecrets`
- `canDeleteApplicationSecrets`
- `canCreateApplications`
- `canReadAzureResources`
- `canReadKeyVaultMetadata`

### UsageObservation

Fields:

- `appId`
- `servicePrincipalId`
- `credentialKeyId`
- `timeGenerated`
- `resourceDisplayName`
- `ipAddress`
- `resultType`
- `resultDescription`
- `correlationId`

### Finding

Fields:

- `findingId`
- `tenantId`
- `environmentName`
- `appId`
- `keyId`
- `severity`
- `category`
- `title`
- `description`
- `evidence`
- `recommendedAction`

## Secret Status

| Status | Meaning |
|---|---|
| Valid | Secret is valid beyond the configured threshold. |
| ExpiringSoon | Secret expires within the configured threshold. |
| Expired | Secret end date is in the past. |
| Unknown | Dates are missing or cannot be evaluated. |

## Risk Level Proposal

| Risk | Example |
|---|---|
| Info | Secret valid for more than 180 days. |
| Low | Secret expires within 180 days. |
| Medium | Secret expires within 90 days. |
| High | Secret expires within 30 days. |
| Critical | Secret expired and recent failed sign-ins exist. |
