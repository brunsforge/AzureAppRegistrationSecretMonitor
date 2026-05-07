# AARM Azure Function

Scheduled cloud scanning engine for Azure App Registration client secrets.
Runs scans on a configurable schedule, stores results in Azure Blob Storage,
and sends Teams notifications. Exposes REST endpoints for the MAUI Cloud Mode
and the built-in HTML dashboard.

---

## Azure Resources Required

### 1. Azure Function App

| Setting | Value |
|---|---|
| Runtime stack | Node.js 20 LTS |
| OS | Linux |
| Hosting plan | **Flex Consumption** (recommended) or Consumption |
| Region | any |

### 2. Azure Storage Account

Used for both the Function runtime (`AzureWebJobsStorage`) and AARM data.

Required containers (created automatically on first run if permissions are set):

| Container | Purpose |
|---|---|
| `aarm-config` | `jobs.json`, notification templates |
| `aarm-data` | Scan results, history, runtime state |

### 3. Azure Key Vault

Stores the client secrets used to authenticate against each target tenant.

One secret per scanning job:

```bash
az keyvault secret set \
  --vault-name <vault-name> \
  --name aarm-contoso-prod \
  --value "<client-secret-value>"
```

### 4. Application Insights

Required for log forwarding, distributed tracing, and Live Metrics.

```bash
az monitor app-insights component create \
  --app aarm-fn-insights \
  --location <region> \
  --resource-group <rg> \
  --workspace <log-analytics-workspace-id>
```

Retrieve the connection string:
```bash
az monitor app-insights component show \
  --app aarm-fn-insights \
  --resource-group <rg> \
  --query connectionString -o tsv
```

The connection string is used in the `APPLICATIONINSIGHTS_CONNECTION_STRING` App Setting.

> **Tip:** Use an existing Log Analytics workspace (e.g. the one used for sign-in log queries)
> so all AARM telemetry lands in the same workspace.

### 5. User-Assigned Managed Identity (UAMI)

A UAMI decouples the function's identity from the function app lifecycle.
Role assignments survive redeployments and recreations.

```bash
# Create the UAMI
az identity create \
  --name aarm-fn-identity \
  --resource-group <rg>

# Assign to the Function App
az functionapp identity assign \
  --name <function-app-name> \
  --resource-group <rg> \
  --identities /subscriptions/<sub>/resourcegroups/<rg>/providers/Microsoft.ManagedIdentity/userAssignedIdentities/aarm-fn-identity
```

---

## Role Assignments

Grant the UAMI the following roles:

### Storage Account

```bash
UAMI_PRINCIPAL_ID=$(az identity show --name aarm-fn-identity --resource-group <rg> --query principalId -o tsv)
STORAGE_ID=$(az storage account show --name <account> --resource-group <rg> --query id -o tsv)

az role assignment create \
  --assignee $UAMI_PRINCIPAL_ID \
  --role "Storage Blob Data Contributor" \
  --scope $STORAGE_ID
```

### Key Vault

The UAMI needs **Key Vault Secrets Officer** (not just Secrets User) so it can create, rotate and
delete scanning credentials via the API, in addition to reading them at scan time.

```bash
KV_ID=$(az keyvault show --name <vault-name> --query id -o tsv)

az role assignment create \
  --assignee $UAMI_PRINCIPAL_ID \
  --role "Key Vault Secrets Officer" \
  --scope $KV_ID
```

---

## Function App Settings

Configure these Application Settings on the Function App:

### Infrastructure (set once)

| Setting | Value | Notes |
|---|---|---|
| `AZURE_CLIENT_ID` | `<uami-client-id>` | Client ID of the UAMI. Used by `@azure/identity` and Flex Consumption AzureWebJobsStorage auth. |
| `AzureWebJobsStorage__accountName` | `<storage-account-name>` | Flex Consumption: UAMI-based storage auth (no connection string needed). |
| `AARM_STORAGE_URI` | `https://<account>.blob.core.windows.net` | Storage account URI for AARM data containers. |
| `AARM_KEYVAULT_URI` | `https://<vault-name>.vault.azure.net` | Key Vault URI. The function reads, creates and deletes scanning credentials via SDK using this URI and the UAMI. |
| `AARM_DASHBOARD_URL` | `https://<function-app>.azurewebsites.net/api/dashboard` | Used in Teams notification card "Open Dashboard" links. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `InstrumentationKey=...;IngestionEndpoint=...` | Application Insights connection string. Enables automatic log forwarding, distributed tracing and Live Metrics. Leave empty to disable (not recommended in production). |
| `APPLICATIONINSIGHTS_ROLE_NAME` | `aarm-azure-function` | Sets the cloud role name in the Application Map. Distinguishes AARM from other services in a shared AI workspace. |
| `FUNCTIONS_EXTENSION_VERSION` | `~4` | Required. |

Add all infrastructure settings via CLI:

```bash
az functionapp config appsettings set \
  --name <function-app-name> \
  --resource-group <rg> \
  --settings \
    "AZURE_CLIENT_ID=<uami-client-id>" \
    "AzureWebJobsStorage__accountName=<storage-account-name>" \
    "AARM_STORAGE_URI=https://<account>.blob.core.windows.net" \
    "AARM_KEYVAULT_URI=https://<vault-name>.vault.azure.net" \
    "AARM_DASHBOARD_URL=https://<fn>.azurewebsites.net/api/dashboard" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=<connection-string>" \
    "APPLICATIONINSIGHTS_ROLE_NAME=aarm-azure-function"
```

### Scanning credentials

Scanning credentials (client secrets for each target tenant) are stored **directly in Key Vault** using
the UAMI — no App Settings needed per tenant.

The function reads credentials at scan time via the Key Vault SDK using `AARM_KEYVAULT_URI`.
The naming convention for secrets is `aarm-{jobId}` (e.g. `aarm-contoso-prod`).

**Recommended: use the MAUI Cloud Mode Add Tenant form.** It sends the credential to the function
API which stores it in Key Vault automatically.

**Or via Azure CLI:**
```bash
az keyvault secret set \
  --vault-name <vault-name> \
  --name aarm-contoso-prod \
  --value "<client-secret-value>"
```
Then set `"credentialRef": "aarm-contoso-prod"` in `jobs.json`.

---

## App Registration Setup (per target tenant)

In each tenant that the function will scan, create an App Registration with these permissions:

| Permission | Type | Purpose |
|---|---|---|
| `Application.Read.All` | Application | List App Registrations |
| `AuditLog.Read.All` | Application | Sign-in logs (optional, for usage analysis) |

Steps:
```bash
# In the TARGET tenant (not the function's host tenant)
az ad app create --display-name "AARM Scanner"
az ad app permission add --id <app-id> --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions 9a5d68dd-52b0-4cc2-bd40-abcf44ac3a30=Role  # Application.Read.All
# Grant admin consent
az ad app permission admin-consent --id <app-id>
# Create client secret
az ad app credential reset --id <app-id> --display-name "aarm-scanner"
# → store the returned secret value in Key Vault (see above)
```

---

## Job Configuration

The function reads all job configurations from a single file: `aarm-config/jobs.json` in Blob Storage.

Upload the file:
```bash
az storage blob upload \
  --account-name <storage-account> \
  --container-name aarm-config \
  --name jobs.json \
  --file references/examples/jobs.json \
  --auth-mode login
```

See `references/examples/jobs.json` for a complete working example with two jobs.

### Schema reference

`jobs.json` is a JSON object with a `jobs` array. Each entry describes one scanning job.

#### Identity fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique job identifier. Used to name the runtime state blob and the Key Vault secret (`aarm-{id}`). |
| `enabled` | boolean | yes | `false` pauses the job without removing it. The timer tick skips disabled jobs. |
| `tenantId` | string | yes | Azure AD tenant ID (GUID) of the **target** tenant — the one being scanned. This is not the function's host tenant. |
| `tenantDisplayName` | string | yes | Human-readable name shown in notifications and the dashboard. |
| `environmentName` | string | yes | User-defined label for this tenant/environment combination, e.g. `PROD`, `DEV`. |

#### Authentication fields

| Field | Type | Required | Description |
|---|---|---|---|
| `authMode` | string | yes | How the function authenticates to the target tenant. See auth modes below. |
| `clientId` | string | yes | Client ID of the App Registration **in the target tenant** that the function authenticates as. |
| `credentialRef` | string | conditional | Key Vault secret name holding the credential. Convention: `aarm-{jobId}`. Required for `client-secret` and `certificate`; omit for `workload-identity-federation`. |

**Auth modes:**

| Mode | Credential needed | Notes |
|---|---|---|
| `workload-identity-federation` | None | Preferred. The target tenant admin must configure a federated credential trust on their App Registration, pointing to this function's UAMI. No App Setting required. |
| `client-secret` | App Setting `AARM_SECRET_*` → Key Vault ref | Standard fallback. Set `credentialRef` to the App Setting name. |
| `certificate` | App Setting `AARM_SECRET_*` → Key Vault ref | Higher security. Same `credentialRef` pattern; Key Vault holds the certificate. |

**`credentialRef` naming convention:**

The App Setting name must follow `AARM_SECRET_` + job `id` in UPPER_SNAKE_CASE (hyphens → underscores):

```
job id "contoso-prod"  →  credentialRef "AARM_SECRET_CONTOSO_PROD"
job id "fabrikam-dev"  →  credentialRef "AARM_SECRET_FABRIKAM_DEV"
```

The App Setting value is a Key Vault reference:
```
@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/<name>/)
```

#### Schedule fields

| Field | Type | Required | Description |
|---|---|---|---|
| `schedule.intervalDays` | number | yes | How many days between runs. `1` = daily, `7` = weekly. The timer checks every 5 minutes whether a run is due. |
| `schedule.runAtUtc` | string | yes | Preferred start time in UTC, format `HH:mm`. Example: `"06:00"`. The function runs at the first timer tick after this time on the due day. |

#### Teams webhook fields

All webhook fields are optional. Omit or set to `null` to disable that notification channel.

| Field | Type | When fired |
|---|---|---|
| `teamsWebhooks.status` | string\|null | After every successful scan — sends the summary template. |
| `teamsWebhooks.alerts` | string\|null | When critical or expiring secrets are found — sends the critical or expiring template depending on severity. |
| `teamsWebhooks.errors` | string\|null | When the scan fails — sends the error template. |

#### Notification template fields

| Field | Type | Default | Description |
|---|---|---|---|
| `notificationTemplates.expiring` | string\|null | `null` | Blob name in `aarm-config/templates/`. `null` uses the built-in `default-expiring` Adaptive Card. |
| `notificationTemplates.critical` | string\|null | `null` | Custom template for critical secrets. |
| `notificationTemplates.summary` | string\|null | `null` | Custom template for regular summary (sent to `teamsWebhooks.status`). |
| `notificationTemplates.error` | string\|null | `null` | Custom template for scan failures. |

Custom templates are Adaptive Card v1.4 JSON files rendered with [Handlebars.js](https://handlebarsjs.com/).

**Available template placeholders:**

| Placeholder | Value |
|---|---|
| `{{tenantDisplayName}}` | From the job config |
| `{{environmentName}}` | From the job config |
| `{{scanTimestamp}}` | ISO 8601 scan completion time |
| `{{secretCount}}` | Total secrets found |
| `{{expiringCount}}` | Secrets expiring within `expiringWithinDays` |
| `{{criticalCount}}` | Secrets expiring within `criticalWithinDays` |
| `{{dashboardUrl}}` | Value of the `AARM_DASHBOARD_URL` App Setting |

See `references/examples/template-critical-custom.json` for a full custom template example.

#### Notification threshold fields

| Field | Type | Default | Description |
|---|---|---|---|
| `notificationThresholds.expiringWithinDays` | number | `30` | Secrets expiring within this many days are counted as "expiring" and trigger the alerts webhook. |
| `notificationThresholds.criticalWithinDays` | number | `7` | Secrets expiring within this many days are counted as "critical" and trigger the critical template instead of the expiring template. |

#### Log Analytics fields

| Field | Type | Default | Description |
|---|---|---|---|
| `logAnalytics.workspaceId` | string\|null | `null` | Log Analytics workspace ID for the target tenant. Used during preflight to check sign-in log access. You can use the `logAnalyticsWorkspaceId` output from the Bicep deployment for the function's own workspace. |
| `logAnalytics.enabled` | boolean | `false` | Whether to include Log Analytics capability checks in the preflight run for this job. |

---

## HTTP Endpoints

### Authentication

All endpoints use **Function Key authentication** (`authLevel: 'function'`) except `/api/dashboard`
which is `authLevel: 'anonymous'` (the key is stored client-side in browser `localStorage`).

Include the key in the request header:
```
x-functions-key: <your-function-key>
```

Retrieve the default function key:
```bash
az functionapp keys list --name <fn-name> --resource-group <rg>
```

### Route overview

| Method | Route | Description |
|---|---|---|
| GET | `/api/status` | Health check, job count, last scan time |
| GET | `/api/tenants` | List tenants with profile data |
| POST | `/api/tenants` | Add tenant/job + store credential in KV |
| PUT | `/api/tenants/{tenantId}` | Update tenant/job + optional credential rotation |
| DELETE | `/api/tenants/{tenantId}` | Delete tenant/job + purge KV secret |
| GET | `/api/tenants/{tenantId}/secrets` | Latest secret scan (`ResultEnvelope<AppRegistrationSummary[]>`) |
| GET | `/api/tenants/{tenantId}/preflight` | Latest preflight result |
| POST | `/api/tenants/{tenantId}/scan` | Trigger immediate scan + send Teams notifications |
| GET | `/api/dashboard` | Interactive HTML dashboard (client-side JS, anonymous) |
| GET | `/api/report?tenant=&env=` | Server-rendered HTML snapshot |

---

### GET `/api/status`

**Purpose:** Health check. Confirms the function is running, can reach Blob Storage, and shows
how many jobs are configured. Use this to verify a new deployment or test connectivity from MAUI.

**Response:**
```json
{
  "healthy": true,
  "version": "0.1.0",
  "jobCount": 2,
  "enabledJobCount": 2,
  "lastScanAt": "2026-05-07T06:00:00.000Z",
  "storageConnected": true
}
```

| Field | Description |
|---|---|
| `healthy` | `false` if an exception occurred reading storage |
| `jobCount` | Total jobs in `jobs.json` (enabled + disabled) |
| `enabledJobCount` | Jobs with `enabled: true` |
| `lastScanAt` | ISO 8601 timestamp of the most recent completed scan across all jobs; `null` if no scan has run yet |

---

### GET `/api/tenants`

**Purpose:** Lists all tenant/environment combinations for which scan results exist in
`aarm-data/latest/`. Used by the MAUI Cloud Mode tenant selector and the HTML dashboard.

**Response:**
```json
[
  {
    "tenantId": "<contoso-tenant-id>",
    "displayName": "Contoso Corporation",
    "authMode": "client-secret",
    "clientId": "<client-id>",
    "username": null,
    "defaultEnvironmentName": "PROD",
    "logAnalyticsWorkspaceId": "<workspace-id>",
    "createdAt": "2026-05-07T06:00:00.000Z",
    "updatedAt": "2026-05-07T06:00:00.000Z",
    "lastPreflightAt": "2026-05-07T06:00:00.000Z",
    "lastSuccessfulScanAt": "2026-05-07T06:00:00.000Z"
  }
]
```

One entry per unique `tenantId`. If the same tenant has multiple jobs (different `environmentName`
values in `jobs.json`), only the first job's metadata is returned and `defaultEnvironmentName`
identifies the primary environment.

**Design note:** MAUI has no environment selector in its UI. Environments are an internal routing
detail of the function (they differentiate scan results in Blob Storage when the same tenant is
scanned with different job configurations). MAUI always uses `defaultEnvironmentName` transparently.

Returns `[]` if no jobs are configured yet.

---

### GET `/api/tenants/{tenantId}/secrets`

**Purpose:** Returns the latest secret scan result for a tenant as a
`ResultEnvelope<AppRegistrationSummary[]>`. The function resolves the correct environment
internally from the job config. This is the primary data endpoint consumed by
the MAUI Cloud Mode and the HTML dashboard.

**Path parameters:** `tenantId` (GUID)

**Response shape:**
```json
{
  "success": true,
  "metadata": {
    "tenantId": "<tenant-id>",
    "environmentName": "PROD",
    "generatedAt": "2026-05-07T06:00:00.000Z",
    "toolVersion": "0.1.0"
  },
  "data": [
    {
      "applicationObjectId": "...",
      "appId": "...",
      "displayName": "My App",
      "secretCount": 2,
      "expiredSecretCount": 0,
      "expiringSecretCount": 1,
      "riskLevel": "High",
      "secrets": [
        {
          "keyId": "...",
          "displayName": "prod-key",
          "hint": "abc",
          "endDateTime": "2026-06-15T00:00:00Z",
          "daysUntilExpiry": 38,
          "status": "ExpiringSoon",
          "riskLevel": "High"
        }
      ]
    }
  ],
  "warnings": [],
  "errors": []
}
```

**404** — returned when no scan data exists yet or no job is configured for this tenant.

**Note for MAUI:** `LocalCliDataProvider.GetSecretsAsync` returns a **flat** `SecretSummary[]`,
while this endpoint returns the **nested** `AppRegistrationSummary[]`. The `CloudHttpDataProvider`
flattens the response automatically before handing it to the Secret List page.

---

### GET `/api/tenants/{tenantId}/preflight`

**Purpose:** Returns the latest preflight/capability check result. Used by the MAUI Preflight
Detail page in Cloud Mode to show which Graph permissions are available.

**Response shape:**
```json
{
  "success": true,
  "metadata": { "tenantId": "...", "environmentName": "PROD", "generatedAt": "...", "toolVersion": "0.1.0" },
  "data": {
    "tenantId": "...",
    "environmentName": "PROD",
    "authValid": true,
    "graphReachable": true,
    "checkedAt": "2026-05-07T06:00:00.000Z",
    "capabilities": {
      "canReadApplications": true,
      "canReadApplicationSecrets": true,
      "canReadServicePrincipals": true,
      "canReadOwners": true,
      "canReadDirectory": false,
      "canQueryLogAnalytics": true,
      "canAnalyzeServicePrincipalSignIns": true,
      "canCreateApplicationSecrets": false,
      "canDeleteApplicationSecrets": false,
      "canCreateApplications": false,
      "canReadAzureResources": false,
      "canReadKeyVaultMetadata": false
    },
    "missingPermissions": [],
    "warnings": [],
    "errors": []
  },
  "warnings": [],
  "errors": []
}
```

**404** — returned when no preflight data exists yet.

---

### POST `/api/tenants/{tenantId}/scan`

**Purpose:** Triggers an immediate scan for a tenant outside the regular schedule.
All configured jobs for this tenant are executed. Teams notifications are sent per job config —
identical behaviour to the scheduled timer trigger.

The scan runs **asynchronously** — the endpoint returns immediately with `202 Accepted`.

**Response (202 Accepted):**
```json
{
  "accepted": true,
  "startedAt": "2026-05-07T10:34:00.000Z",
  "jobCount": 1
}
```

**404** — returned when no job is configured for this `tenantId` in `jobs.json`.

After the scan completes, results are available at the `/secrets` and `/preflight` endpoints.

---

### POST `/api/tenants`

**Purpose:** Adds a new tenant/job. Stores the scanning credential in Key Vault.
Returns the created tenant profile.

**Request body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| `tenantId` | string | yes | Azure AD tenant GUID |
| `tenantDisplayName` | string | yes | Display name for notifications and MAUI |
| `authMode` | string | yes | `client-secret` or `workload-identity-federation` |
| `clientId` | string | cond. | Required for `client-secret` |
| `credentialValue` | string | cond. | Client secret value — stored in KV, never persisted |
| `environmentName` | string | no | Defaults to `default` |
| `schedule.intervalDays` | number | no | Default: `1` |
| `schedule.runAtUtc` | string | no | Default: `06:00` |
| `teamsWebhooks.*` | string | no | Optional per-channel webhook URLs |
| `notificationThresholds.*` | number | no | Default: expiring=30, critical=7 |
| `logAnalytics.workspaceId` | string | no | For usage analysis |

**Response: 201 Created** with the TenantProfile.

---

### PUT `/api/tenants/{tenantId}`

**Purpose:** Updates an existing tenant's job configuration. If `credentialValue` is provided,
the Key Vault secret is rotated. Omit `credentialValue` to keep the existing credential.

**Response: 200 OK** with the updated TenantProfile.

---

### DELETE `/api/tenants/{tenantId}`

**Purpose:** Removes the tenant's job from `jobs.json`, deletes and purges the Key Vault secret,
and preserves the runtime state blob for audit.

**Response: 204 No Content**.

---

### GET `/api/dashboard`

**Purpose:** Serves a self-contained interactive HTML page. The page loads data from the
JSON endpoints client-side via `fetch()`.

**Auth:** `anonymous` — the Function Key is stored in browser `localStorage` under
the key `aarm_fn_key`. On first load, the browser prompts for the key.

**Query parameters (optional):**
| Param | Description |
|---|---|
| `tenant` | Pre-selects a tenant ID on load |
| `env` | Pre-selects an environment name on load |

**Use cases:**
- Bookmark in a browser for a quick status check
- Link in documentation or a SharePoint page
- Monitoring screen / wall dashboard

---

### GET `/api/report`

**Purpose:** Returns a fully server-side rendered HTML snapshot with no JavaScript.
All data is embedded in the HTML at request time.

**Auth:** Function Key required.

**Query parameters (required):**
| Param | Description |
|---|---|
| `tenant` | Target tenant ID |
| `env` | Environment name |

**Example:**
```
GET /api/report?tenant=<tenant-id>&env=PROD
x-functions-key: <key>
```

**Use cases:**
- Email attachments (paste the HTML into an email body)
- Archiving point-in-time reports
- Embedding in services that can't execute JavaScript (e.g. some SharePoint web parts)
- Automated report generation in CI pipelines

---

## Local Development

1. Install [Azure Functions Core Tools v4](https://docs.microsoft.com/azure/azure-functions/functions-run-local) globally.
2. Install [Azurite](https://docs.microsoft.com/azure/storage/common/storage-use-azurite) for local storage emulation.
3. Copy `local.settings.json.template` to `local.settings.json` and fill in the values.
4. Build and start:

```bash
npm install
npm run build
func start
```

The timer trigger fires every 5 minutes. To test locally, temporarily change the CRON
expression in `src/triggers/timerTrigger.ts` to `*/30 * * * * *` (every 30 seconds).

---

## Deployment

```bash
# Build
npm run build

# Deploy via Azure CLI
func azure functionapp publish <function-app-name> --node
```

Or use GitHub Actions / Azure DevOps with the standard Azure Functions deployment action.
