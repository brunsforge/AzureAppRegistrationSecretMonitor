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

```bash
KV_ID=$(az keyvault show --name <vault-name> --query id -o tsv)

az role assignment create \
  --assignee $UAMI_PRINCIPAL_ID \
  --role "Key Vault Secrets User" \
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
| `AARM_DASHBOARD_URL` | `https://<function-app>.azurewebsites.net/api/dashboard` | Used in Teams notification card "Open Dashboard" links. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `InstrumentationKey=...;IngestionEndpoint=...` | Application Insights connection string. Enables automatic log forwarding, distributed tracing and Live Metrics. Leave empty to disable (not recommended in production). |
| `APPLICATIONINSIGHTS_ROLE_NAME` | `aarm-azure-function` | Sets the cloud role name in the Application Map. Distinguishes AARM from other services in a shared AI workspace. |
| `FUNCTIONS_EXTENSION_VERSION` | `~4` | Required. |

### Per-job scanning credentials (one per `client-secret` job)

Each App Setting holds a Key Vault reference resolved automatically by the runtime:

| Setting name | Value |
|---|---|
| `AARM_SECRET_CONTOSO_PROD` | `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/aarm-contoso-prod/)` |
| `AARM_SECRET_FABRIKAM_DEV` | `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/aarm-fabrikam-dev/)` |

**Naming convention:** `AARM_SECRET_` + job `id` in UPPER_SNAKE_CASE with hyphens replaced by underscores.

Add settings via CLI:
```bash
az functionapp config appsettings set \
  --name <function-app-name> \
  --resource-group <rg> \
  --settings \
    "AZURE_CLIENT_ID=<uami-client-id>" \
    "AzureWebJobsStorage__accountName=<storage-account-name>" \
    "AARM_STORAGE_URI=https://<account>.blob.core.windows.net" \
    "AARM_DASHBOARD_URL=https://<fn>.azurewebsites.net/api/dashboard" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=<connection-string>" \
    "APPLICATIONINSIGHTS_ROLE_NAME=aarm-azure-function" \
    "AARM_SECRET_CONTOSO_PROD=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/aarm-contoso-prod/)" \
    "AARM_SECRET_FABRIKAM_DEV=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/aarm-fabrikam-dev/)"
```

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

Upload `jobs.json` to the `aarm-config` container:

```bash
az storage blob upload \
  --account-name <storage-account> \
  --container-name aarm-config \
  --name jobs.json \
  --file references/examples/jobs.json \
  --auth-mode login
```

See `references/examples/jobs.json` for a complete example with two jobs (daily + weekly).
See `references/examples/template-critical-custom.json` for a custom notification template.

---

## HTTP Endpoints

All endpoints require the Function Key header (`x-functions-key`) except `/api/dashboard`
which is `anonymous` (key stored in browser localStorage).

| Method | Route | Description |
|---|---|---|
| GET | `/api/status` | Health check, job count, last scan time |
| GET | `/api/tenants` | List tenants with scan data |
| GET | `/api/tenants/{tenantId}/environments/{envName}/secrets` | Latest secret scan (JSON) |
| GET | `/api/tenants/{tenantId}/environments/{envName}/preflight` | Latest preflight result (JSON) |
| POST | `/api/tenants/{tenantId}/environments/{envName}/scan` | Trigger immediate scan (202 Accepted) |
| GET | `/api/dashboard` | Interactive HTML dashboard (client-side JS) |
| GET | `/api/report?tenant=…&env=…` | Server-rendered HTML snapshot |

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
