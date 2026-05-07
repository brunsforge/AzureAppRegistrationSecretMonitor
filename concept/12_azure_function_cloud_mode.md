# Azure Function Cloud Mode Concept

## Purpose

This concept describes the optional cloud-hosted deployment of the AARM scanning engine
as an Azure Function, and the corresponding "Cloud Mode" for the MAUI Blazor UI.

The cloud deployment allows:
- scheduled, server-side secret scanning without a running desktop machine
- centralized scan results accessible to multiple users or dashboards
- Teams notifications triggered server-side on a configurable schedule
- an embedded HTML dashboard served directly from the function

The MAUI app can operate in two distinct modes selected at startup (or in Settings):

| Mode | Engine | Data source |
|---|---|---|
| **Local** | CLI child process (current) | `~/.aarm/` on local machine |
| **Cloud** | HTTP calls to Azure Function | Azure Blob Storage via function endpoints |

## MVP Scope

The Azure Function Cloud Mode is a **post-1.0 feature** relative to the local desktop MVP.
It must be considered during architecture decisions but no code is generated until explicitly approved.

Key constraint: the JSON output contract (`ResultEnvelope<T>`) must remain compatible between
both modes. MAUI must consume the same schema regardless of whether data comes from a local CLI
process or an Azure Function HTTP response.

---

## Azure Function Architecture

### How the function uses the npm library

The Azure Function imports the **core library** (`@brunsforge/azure-app-registration-monitor`)
directly as a Node.js dependency. It does **not** spawn a CLI child process.

The core library is quasi-stateless:
- All computation modules (Graph readers, secret analysis, preflight, Log Analytics) are
  stateless — they receive a credential object, call APIs, return plain data.
- The `@azure/identity` credential objects (`ClientSecretCredential`) cache the last access
  token in memory. On a cold start the token is re-acquired (a few hundred ms overhead,
  acceptable). On a warm instance the in-memory cache is reused across invocations.
- The CLI packages (`HistoryStore`, `ConfigStore`, `CredentialStore`) are **never imported**
  by the function. Storage and credential management are the function's own responsibility.

The function is responsible for:
- Reading `jobs.json` from Blob Storage
- Fetching client secrets from Key Vault using its UAMI
- Calling `createCredential({ mode: 'client-secret', ... })` and passing the result to library methods
- Writing `ResultEnvelope<T>` results to Blob Storage
- Sending Teams notifications

The `baseDir` / `configDir` concept applies only to local CLI usage.
See OQ-053 for the `cachePersistencePlugin` placement concern.

### Hosting

| Attribute | Value |
|---|---|
| Runtime | Node.js 20 LTS |
| Plan | Consumption (MVP) or Flex Consumption for always-warm |
| OS | Linux |
| Authentication to function | Function Key (API key) for MVP; Azure AD later |
| Identity | **User-Assigned Managed Identity (UAMI)** — see below |
| Storage | Azure Blob Storage (same account as function for MVP) |

### Identity: User-Assigned Managed Identity (UAMI)

A **UAMI** is preferred over a System-Assigned Managed Identity for the following reasons:

- The UAMI is an independent Azure resource with its own lifecycle. It survives function app
  redeployments, deletions and recreations without losing Key Vault or Storage role assignments.
- The same UAMI can be shared across staging and production function apps (or pre-created
  before the function app exists, with roles pre-assigned).
- A SAMI is deleted when the function app is deleted, requiring role assignments to be
  reconfigured on every recreation.

The UAMI is assigned to the function app in the Azure portal / IaC and granted:
- `Key Vault Secrets User` on the AARM Key Vault
- `Storage Blob Data Contributor` on the AARM storage account

### Function App Settings

The function runtime is configured through Application Settings in two categories:

**Infrastructure settings** (set once during deployment):

| Setting | Value | Purpose |
|---|---|---|
| `AZURE_CLIENT_ID` | `{uami-client-id}` | Tells `@azure/identity` which UAMI to use; standard `@azure/identity` env var |
| `AARM_STORAGE_URI` | `https://{account}.blob.core.windows.net` | Storage account for job configs and scan data (accessed via UAMI) |

**Per-tenant credential settings** (one per scanning job that uses `client-secret` or `certificate`):

| Setting | Value | Purpose |
|---|---|---|
| `AARM_SECRET_{JOB_ID_UPPER}` | `@Microsoft.KeyVault(SecretUri=https://{vault}.vault.azure.net/secrets/{name}/)` | Key Vault reference; Azure Functions runtime resolves it before the app reads it |

The `AARM_SECRET_` prefix groups all scanning credentials together for easy filtering in the
Azure Portal. The naming convention is `AARM_SECRET_` followed by the job `id` in uppercase
with hyphens replaced by underscores (e.g. job `contoso-prod` → `AARM_SECRET_CONTOSO_PROD`).

The `credentialRef` field in `jobs.json` contains the matching env var name. The function
reads `process.env[job.credentialRef]` at scan time — no Key Vault SDK calls needed in code.
The Azure Functions runtime resolves the Key Vault references using the UAMI before the app starts.

**Why env var references instead of direct Key Vault SDK calls:**
- Simpler code (one env var read vs SDK call + error handling)
- Credentials are resolved once at startup / config refresh, not on every scan
- Standard Azure Functions pattern, visible and manageable in the portal

**Trade-off:** Adding a new tenant requires adding an App Setting (and a minor config reload).
For large numbers of dynamically added tenants, a direct Key Vault SDK call approach scales
better — this can be reconsidered post-MVP.

### Two-Layer Authentication

The function uses two separate authentication layers:

#### Layer 1 — Infrastructure (Managed Identity)

The function's **User-Assigned Managed Identity (UAMI)** authenticates to Azure services that the
function itself operates. No credential is stored anywhere for this layer.

| Target | Purpose |
|---|---|
| Azure Blob Storage | Read job configs and templates; write scan results |
| Azure Key Vault | Read client secrets for scanning jobs |
| Azure Monitor / Log Analytics (own tenant) | Optional: Log Analytics queries within the function's home tenant |

Required Azure RBAC role assignments on the Managed Identity:
- `Storage Blob Data Contributor` on the storage account
- `Key Vault Secrets User` on the Key Vault
- `Log Analytics Reader` (optional, own subscription only)

#### Layer 2 — Scanning (Workload Identity Federation, Client Secret or Certificate per target tenant)

Each job configuration targets a specific customer or partner tenant. These tenants are
independent of the tenant where the function is hosted.

The function cannot use its Managed Identity to call Graph API in an external tenant
without explicit federation setup in that tenant.

For each scanning job, the function:
1. Reads `process.env[job.credentialRef]` — the credential value already resolved from Key Vault
   by the Azure Functions runtime at startup.
2. Passes the credential to `createCredential({ mode: job.authMode, tenantId, clientId, ... })`.
3. Calls Graph API in the target tenant.

#### Credential-free cross-tenant scanning (Workload Identity Federation)

**Preferred auth mode** when available. The admin of the target tenant configures their
App Registration to trust the function's UAMI as a federated credential (one-time setup).
The function then exchanges its own OIDC token for a Graph token in the target tenant —
no `credentialRef` / App Setting needed for that job.

Precondition: the target tenant admin must perform the federation setup in their own tenant.
This cannot be done unilaterally by the function operator.

#### Scanning auth modes in job configs

Ordered by preference:

| `authMode` | Credential source | Notes |
|---|---|---|
| `workload-identity-federation` | No stored credential | **Preferred.** Requires one-time federation setup in target tenant |
| `client-secret` | `process.env[credentialRef]` (App Setting → Key Vault ref) | Standard fallback for all external tenants |
| `certificate` | `process.env[credentialRef]` (App Setting → Key Vault ref) | Higher security; cert rotated in Key Vault |

`managed-identity` is **not** a valid scanning auth mode for external tenants.
It only applies to the function's own home tenant (edge case).

For `workload-identity-federation` jobs, `credentialRef` is omitted from the job config
and no `AARM_SECRET_*` App Setting is required.

### Storage Layout

MVP: two containers in the **same storage account as the Azure Function runtime**
(`AzureWebJobsStorage`). No separate storage account is needed for MVP.

```text
Storage Account: <function-runtime-storage-account>

Container: aarm-config
  jobs.json                   ← single file; array of all job configurations (user-maintained)
  templates/
    default-expiring.json     ← built-in notification templates (shipped with function code)
    default-critical.json
    default-summary.json
    {custom-name}.json        ← user-provided template overrides

Container: aarm-data
  runtime/
    {jobId}.json              ← per-job runtime state written by function (lastRunAt etc.)
  history/
    {tenantId}/
      {envName}/
        secrets-{timestamp}.json
        preflight-{timestamp}.json
  latest/
    {tenantId}/
      {envName}/
        secrets.json          ← always-current pointer (overwritten on each scan)
        preflight.json
```

**Why `jobs.json` is a single file, not one file per job:**
A single file is the natural "this is the config" mental model. Runtime state is kept separate
in `aarm-data/runtime/{jobId}.json` so the function can update each job's state atomically after
a scan without a read-modify-write cycle on the shared config file (avoids blob concurrency
conflicts when multiple jobs complete simultaneously).

The `latest/` prefix allows O(1) retrieval of current state without listing blobs.

**Function Storage Abstractions:**
The Azure Function implements its own Blob Storage equivalents for the three CLI-side storage
classes. These are internal to the function — the core library is never involved:

| Function class | CLI equivalent | Backend |
|---|---|---|
| `BlobJobConfigStore` | `ConfigStore` (CLI) | Reads `aarm-config/jobs.json` |
| `BlobResultStore` | `HistoryStore` (CLI) | Writes to `aarm-data/history/` and `aarm-data/latest/` |
| `BlobRuntimeStateStore` | — | Reads/writes `aarm-data/runtime/{jobId}.json` |
| Env var lookup | `CredentialStore` (CLI/keytar) | `process.env[credentialRef]` resolved from KV App Settings |

---

## Job Configuration

All jobs are defined in a single file `aarm-config/jobs.json` as a top-level `jobs` array.
See the Storage Layout section above for the full container structure.

### Schema

Full field reference:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique job identifier; used as blob name |
| `enabled` | boolean | yes | `false` pauses the job without deleting it |
| `tenantId` | string | yes | Target Azure AD tenant ID (GUID) |
| `tenantDisplayName` | string | yes | Human-readable name for notifications and dashboard |
| `environmentName` | string | yes | User-defined environment slug (e.g. `PROD`, `DEV`) |
| `authMode` | string | yes | `workload-identity-federation`, `client-secret`, or `certificate` |
| `clientId` | string | yes | App Registration client ID **in the target tenant** |
| `credentialRef` | string | cond. | App Setting env var name holding the credential (e.g. `AARM_SECRET_CONTOSO_PROD`). Required for `client-secret` and `certificate`; omit for `workload-identity-federation`. |
| `schedule.intervalDays` | number | yes | How many days between runs; 1 = daily, 7 = weekly |
| `schedule.runAtUtc` | string | yes | Time of day to run in UTC, format `HH:mm` |
| `teamsWebhooks.status` | string\|null | no | Webhook URL for regular summary notifications |
| `teamsWebhooks.alerts` | string\|null | no | Webhook URL for expiring and critical secret alerts |
| `teamsWebhooks.errors` | string\|null | no | Webhook URL for scan errors and failures |
| `notificationTemplates.expiring` | string\|null | no | Blob name of custom template, or `null` for built-in default |
| `notificationTemplates.critical` | string\|null | no | Blob name of custom template, or `null` for built-in default |
| `notificationTemplates.summary` | string\|null | no | Blob name of custom template, or `null` for built-in default |
| `notificationTemplates.error` | string\|null | no | Blob name of custom template, or `null` for built-in default |
| `notificationThresholds.expiringWithinDays` | number | no | Default: `30` |
| `notificationThresholds.criticalWithinDays` | number | no | Default: `7` |
| `logAnalytics.workspaceId` | string\|null | no | Log Analytics workspace ID for usage analysis |
| `logAnalytics.enabled` | boolean | no | Default: `false` |

Runtime state (`lastRunAt`, `lastRunStatus`, `lastRunSecretsFound`) is stored separately in
`aarm-data/runtime/{jobId}.json` — never in `jobs.json`. See Storage Layout above.

`credentialRef` is the **App Setting name** (e.g. `AARM_SECRET_CONTOSO_PROD`) whose value
is a Key Vault reference resolved by the Azure Functions runtime before the app reads it.
Required for `client-secret` and `certificate`; omit for `workload-identity-federation`.

`notificationTemplates` blob names reference files in `aarm-config/templates/`.
`null` means use the built-in default template shipped with the function code.

### Example configuration

See `references/examples/jobs.json` for a complete example with two jobs:
- `contoso-prod` — daily scan at 06:00 UTC, all three webhooks, custom critical template, Log Analytics enabled
- `fabrikam-dev` — weekly scan at 08:00 UTC, error-only webhook, all defaults, Log Analytics disabled

---

## Timer Trigger Behavior

The function host runs a single timer trigger every 5 minutes.

On each tick:
1. Read `aarm-config/jobs.json` and filter to `enabled: true` jobs.
2. For each job: read `aarm-data/runtime/{jobId}.json` to get `lastRunAt`.
   Check whether `schedule.runAtUtc` falls within the current 5-minute window,
   taking `schedule.intervalDays` into account against `lastRunAt`.
3. Fire qualifying jobs in parallel (within configurable concurrency limit).
4. Each job run:
   a. Fetches the scanning credential from Key Vault using the UAMI (`credentialRef`).
   b. Authenticates to the target tenant using `authMode`.
   c. Calls the npm library: `preflight` + `secrets list`.
   d. Writes result blobs to `aarm-data/history/` and overwrites `aarm-data/latest/`.
   e. Evaluates notification thresholds.
   f. Sends Teams notifications via configured webhooks using resolved templates.
   g. Writes `aarm-data/runtime/{jobId}.json` with `lastRunAt`, `lastRunStatus`,
      `lastRunSecretsFound` (atomic write, no conflict with other jobs).

The 5-minute tick allows minute-level scheduling flexibility without a cron-per-job approach.

---

## HTTP Endpoints

### Status

```
GET /api/status
Authorization: x-functions-key: {key}
```

Response:
```json
{
  "healthy": true,
  "version": "1.0.0",
  "jobCount": 3,
  "enabledJobCount": 2,
  "lastTimerTickAt": "2026-05-07T06:00:00Z",
  "storageConnected": true
}
```

### Tenant list

```
GET /api/tenants
```

Returns all tenants for which scan data exists.

### Secrets (latest scan)

```
GET /api/tenants/{tenantId}/environments/{envName}/secrets
```

Returns the `ResultEnvelope<SecretFinding[]>` blob from `aarm-data/latest/`.
Schema is identical to the local CLI JSON output, ensuring MAUI compatibility.

### Preflight (latest)

```
GET /api/tenants/{tenantId}/environments/{envName}/preflight
```

Returns the `ResultEnvelope<PreflightResult>` blob from `aarm-data/latest/`.

### Manual scan trigger

```
POST /api/tenants/{tenantId}/environments/{envName}/scan
```

Triggers an immediate scan for the specified tenant/environment.
Returns `202 Accepted` with a `Location` header to poll for status.
Optional (Phase 2).

### HTML Dashboard (interactive)

```
GET /api/dashboard
GET /api/dashboard?tenant={tenantId}&env={envName}
```

Returns a self-contained HTML shell with minimal embedded JavaScript.
JavaScript fetches data from the JSON endpoints above on load and on tenant/environment change.

Features:
- tenant/environment selector (populates from `/api/tenants`)
- current secret summary (counts by risk level)
- sortable secret list table
- no external CDN dependencies (self-contained)

Use case: bookmark in a browser, monitoring screen, self-service portal.

### HTML Report (static snapshot)

```
GET /api/report
GET /api/report?tenant={tenantId}&env={envName}
```

Returns a fully server-side rendered HTML snapshot of the current state at request time.
No JavaScript required; all data is embedded in the HTML at generation time.

Use case: email attachments, embedding in other services (e.g. SharePoint web parts),
scheduled export to static hosting, archiving.

---

## MAUI Cloud Mode

### Mode Selection

A `mode` setting in MAUI Settings controls the data source:

| Setting | Value |
|---|---|
| `AppMode` | `local` (default) \| `cloud` |
| `CloudBaseUri` | Base URI of the Azure Function app, e.g. `https://aarm-fn.azurewebsites.net` |
| `CloudFunctionKey` | API key for the function (stored in Windows Credential Manager) |

The mode can be switched at runtime without restarting the app.

### IDataProvider Abstraction

MAUI introduces a `IDataProvider` interface that abstracts the data source:

```text
IDataProvider
  GetSecretsAsync(tenantId, envName) → ResultEnvelope<SecretFinding[]>
  GetPreflightAsync(tenantId, envName) → ResultEnvelope<PreflightResult>
  GetTenantsAsync() → TenantProfile[]
  TriggerScanAsync(tenantId, envName) → void
```

Implementations:
- `LocalCliDataProvider` — current implementation (spawns CLI child process)
- `CloudHttpDataProvider` — makes HTTP calls to the Azure Function endpoints

A `DelegatingDataProvider` singleton is registered in the DI container. It holds a reference
to the currently active inner provider (`LocalCliDataProvider` or `CloudHttpDataProvider`)
and delegates all calls to it. When the user changes `AppMode` in Settings, `AppStateService`
notifies the `DelegatingDataProvider` to swap its inner provider — no app restart required.

```text
DelegatingDataProvider (singleton, registered in DI)
  └─ holds ref to → LocalCliDataProvider  (when AppMode = local)
                 or  CloudHttpDataProvider (when AppMode = cloud)
```

If the proxy pattern causes problems during implementation, a `DataProviderFactory` that
resolves the correct provider on each call is an acceptable fallback (slightly less efficient
but simpler).

### Settings Page: Cache and Connection Info

The Settings page must show the following read-only information:

**Local Mode:**
- Config directory: resolved absolute path of `~/.aarm/` (or `AARM_CONFIG_DIR`)
- History directory: `{configDir}/history/`
- Tenant profiles file: `{configDir}/tenants.json`
- MSAL cache file: `{configDir}/msal.cache`
- Total history file count

**Cloud Mode:**
- Function base URI
- Last successful connection timestamp
- Configured job count (from `/api/status`)
- Storage account name (if returned by the status endpoint)

---

## Notification Template System

Templates are JSON files stored in `aarm-config/templates/`.

Built-in templates ship with the function code.

User-provided templates can be uploaded as blobs alongside the built-in ones.
A job configuration references a template by its blob name.

### Template schema

Templates use Microsoft Teams Adaptive Card format (preferred over MessageCard).

Built-in template keys:
- `default-expiring` — triggered when secrets expire within `expiringWithinDays`
- `default-critical` — triggered when secrets expire within `criticalWithinDays`
- `default-summary` — triggered after every scan (optional, disabled by default)

Templates are rendered using **Handlebars.js** (`handlebars` npm package).
This enables conditionals and loops in templates beyond simple variable substitution,
at the cost of one additional npm dependency.

Template variables:

| Placeholder | Value |
|---|---|
| `{{tenantDisplayName}}` | Tenant display name from job config |
| `{{environmentName}}` | Environment slug from job config |
| `{{scanTimestamp}}` | ISO 8601 scan completion timestamp |
| `{{secretCount}}` | Total secrets scanned |
| `{{expiringCount}}` | Secrets expiring within `expiringWithinDays` |
| `{{criticalCount}}` | Secrets expiring within `criticalWithinDays` |
| `{{dashboardUrl}}` | Base URL of the Azure Function HTML dashboard |

### Example template

See `references/examples/template-critical-custom.json` for a complete custom Adaptive Card
template for critical secret alerts.

---

## Open Questions

All OQs raised by this concept (OQ-047 through OQ-053) have been answered and applied.
