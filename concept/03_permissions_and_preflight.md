# Permissions and Preflight

## Purpose

The tool must not assume that a tenant connection has every permission.

Every tenant/environment must be evaluated by a preflight check. The preflight result creates a capability model. The CLI and UI use that model to decide which features are available.

## Initial Permission Groups

### Read-only Graph Monitoring

Needed for MVP listing:

- Microsoft Graph `Application.Read.All`

Useful for richer context:

- `Directory.Read.All`
- ability to read owners
- ability to read service principals

### Log Analytics Usage Analysis

Needed for usage analysis:

- Azure RBAC access to the relevant Log Analytics Workspace
- usually a role such as Log Analytics Reader or Monitoring Reader
- Entra diagnostic logs must be routed into that workspace
- expected table: `AADServicePrincipalSignInLogs`

### Write / Rotation Features

Not MVP.

Potentially needed later:

- `Application.ReadWrite.All`
- directory/application admin roles depending on operation
- appropriate Graph application or delegated permissions
- explicit admin consent
- careful audit logging

## Preflight Checks

### Minimal Checks

| Check | Purpose |
|---|---|
| Authenticate | Verify token acquisition works. |
| Graph Reachability | Verify Microsoft Graph can be called. |
| Read Applications | Verify App Registrations can be listed. |
| Read Password Credentials | Verify secret metadata can be read. |
| Read Service Principals | Verify enterprise app data can be resolved. |
| Read Owners | Verify application owners can be listed. |
| Query Log Analytics | Verify workspace query access. |
| Check Service Principal Logs | Verify `AADServicePrincipalSignInLogs` exists and returns metadata or rows. |
| Write Secret Test | Later phase; verify whether secret creation would be allowed, ideally without mutation first. |
| Read Azure Resources | Verify Azure Resource Manager API access (for IP-to-resource enrichment). |
| Read Key Vault Metadata | Verify Key Vault read access (for Key Vault secret scanning). |

## Capability Result Shape

```json
{
  "tenantId": "<tenant-id>",
  "environmentName": "PROD",
  "authValid": true,
  "graphReachable": true,
  "checkedAt": "2026-04-30T00:00:00Z",
  "capabilities": {
    "canReadApplications": true,
    "canReadApplicationSecrets": true,
    "canReadServicePrincipals": true,
    "canReadOwners": false,
    "canReadDirectory": false,
    "canQueryLogAnalytics": true,
    "canAnalyzeServicePrincipalSignIns": true,
    "canCreateApplicationSecrets": false,
    "canDeleteApplicationSecrets": false,
    "canCreateApplications": false,
    "canReadAzureResources": false,
    "canReadKeyVaultMetadata": false
  },
  "missingPermissions": [
    "Directory.Read.All"
  ],
  "warnings": [
    "Owner information cannot be resolved with current permissions.",
    "Secret rotation actions are disabled because write permissions are not available."
  ],
  "errors": []
}
```

## UI Behavior

| Capability | UI Behavior |
|---|---|
| `canReadApplications=false` | App list unavailable, show setup guidance. |
| `canReadApplicationSecrets=false` | Secret columns unavailable, show missing permission. |
| `canReadOwners=false` | Owner column hidden or marked unavailable. |
| `canReadServicePrincipals=false` | Service Principal enrichment unavailable; app and owner details may be incomplete. |
| `canReadDirectory=false` | Directory user information unavailable; owner user details cannot be resolved. |
| `canQueryLogAnalytics=false` | Usage Analysis tab disabled. |
| `canAnalyzeServicePrincipalSignIns=false` | Credential last-seen unavailable. |
| `canCreateApplicationSecrets=false` | Create Secret button hidden/disabled. |
| `canDeleteApplicationSecrets=false` | Delete Secret button hidden/disabled. |
| `canCreateApplications=false` | App Registration creation hidden. |
| `canReadAzureResources=false` | Azure resource enrichment unavailable; source IP cannot be mapped to Azure services. |
| `canReadKeyVaultMetadata=false` | Key Vault secret scanning unavailable. |

## Important Security Rule

The MVP must work in read-only mode.

Write functions must never be shown simply because the application supports them. They must be enabled only after a successful capability check for the current tenant/environment.

## Admin Consent Detection

**Decided by OQ-032:** Use preflight + catch approach.

The preflight service must not assume admin consent is present. It must detect missing consent by attempting each capability check and handling errors:

1. Attempt the corresponding Graph or Azure API call for each capability.
2. On HTTP 403 or 401 with `consent_required`, `interaction_required` or `insufficient_privileges` error codes, mark the capability as unavailable and record the missing permission.
3. On success, mark the capability as available.
4. Populate `missingPermissions` and `warnings` in the `PreflightResult` from all failed checks.

This means the preflight service is also the consent-state detector. No separate consent inspection is needed.

## Open Design Topic

The exact mapping between Graph permission, delegated user role and successful operation must be validated in implementation tests. The concept model should remain explicit and test-driven.

`Directory.Read.All` as the required permission for reading owners is an assumption. It must be validated at implementation time (see OQ-030).

Azure RBAC role for Log Analytics workspace access (Log Analytics Reader or Monitoring Reader) must be validated at implementation time (see OQ-031).
