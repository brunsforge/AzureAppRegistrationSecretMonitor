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
    "canQueryLogAnalytics": true,
    "canAnalyzeServicePrincipalSignIns": true,
    "canCreateApplicationSecrets": false,
    "canDeleteApplicationSecrets": false,
    "canCreateApplications": false
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
| `canQueryLogAnalytics=false` | Usage Analysis tab disabled. |
| `canAnalyzeServicePrincipalSignIns=false` | Credential last-seen unavailable. |
| `canCreateApplicationSecrets=false` | Create Secret button hidden/disabled. |
| `canDeleteApplicationSecrets=false` | Delete Secret button hidden/disabled. |
| `canCreateApplications=false` | App Registration creation hidden. |

## Important Security Rule

The MVP must work in read-only mode.

Write functions must never be shown simply because the application supports them. They must be enabled only after a successful capability check for the current tenant/environment.

## Open Design Topic

The exact mapping between Graph permission, delegated user role and successful operation must be validated in implementation tests. The concept model should remain explicit and test-driven.
