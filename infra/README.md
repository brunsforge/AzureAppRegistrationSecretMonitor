# AARM Infrastructure (Bicep)

Deploys the complete Azure infrastructure for the AARM Azure Function.

## Resources created

| Resource | Name pattern | Purpose |
|---|---|---|
| User-Assigned Managed Identity | `{prefix}-{env}-identity` | Runtime identity for the Function App |
| Storage Account | `{prefix}{env}{uniqueSuffix}` | Function runtime + AARM job configs and scan data |
| Key Vault | `{prefix}-{env}-kv` | Scanning credentials for target tenants |
| Log Analytics Workspace | `{prefix}-{env}-law` | Log sink for Application Insights |
| Application Insights | `{prefix}-{env}-ai` | Telemetry, traces, Live Metrics |
| Flex Consumption Plan | `{prefix}-{env}-plan` | Serverless hosting with always-warm timer instance |
| Function App | `{prefix}-{env}-fn` | AARM scanning engine |

## Role assignments

| Principal | Scope | Role |
|---|---|---|
| UAMI | Storage Account | Storage Blob Data Contributor |
| UAMI | Key Vault | Key Vault Secrets User |
| `keyVaultAdminObjectId` | Key Vault | Key Vault Secrets Officer |

## Prerequisites

- Azure CLI installed and logged in: `az login`
- Bicep CLI: comes with Azure CLI ≥ 2.50 (`az bicep version`)
- A resource group already created

```bash
az group create --name aarm-dev-rg --location westeurope
```

## Deploy

1. Edit `main.bicepparam` — fill in your `keyVaultAdminObjectId`:

```bash
az ad signed-in-user show --query id -o tsv
```

2. Run the deployment:

```bash
az deployment group create \
  --resource-group aarm-dev-rg \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
  --name aarm-deploy
```

3. Retrieve outputs:

```bash
az deployment group show \
  --resource-group aarm-dev-rg \
  --name aarm-deploy \
  --query properties.outputs
```

Key outputs you will need:

| Output | Used for |
|---|---|
| `functionAppName` | `func azure functionapp publish <name>` |
| `functionAppHostname` | Base URL for MAUI Cloud Mode settings |
| `keyVaultUri` | Key Vault reference prefix for per-job App Settings |
| `logAnalyticsWorkspaceId` | `logAnalytics.workspaceId` in job configs |

## After deployment — add scanning credentials

For each job that uses `client-secret` authMode, add the secret to Key Vault and reference it
as a Function App Setting. The naming convention is `AARM_SECRET_` + job ID in UPPER_SNAKE_CASE.

```bash
# 1. Store the client secret in Key Vault
az keyvault secret set \
  --vault-name <kv-name> \
  --name aarm-contoso-prod \
  --value "<client-secret-value>"

# 2. Add the Key Vault reference as a Function App Setting
az functionapp config appsettings set \
  --name <fn-name> \
  --resource-group aarm-dev-rg \
  --settings \
    "AARM_SECRET_CONTOSO_PROD=@Microsoft.KeyVault(SecretUri=https://<kv-name>.vault.azure.net/secrets/aarm-contoso-prod/)"
```

## After deployment — upload jobs.json

```bash
# Get the storage account name from deployment outputs
STORAGE=$(az deployment group show \
  --resource-group aarm-dev-rg --name aarm-deploy \
  --query properties.outputs.storageAccountName.value -o tsv)

az storage blob upload \
  --account-name $STORAGE \
  --container-name aarm-config \
  --name jobs.json \
  --file references/examples/jobs.json \
  --auth-mode login
```

## Deploy the function code

```bash
cd apps/azure-function
npm install && npm run build
func azure functionapp publish <fn-name> --node
```

## Tear down

```bash
az group delete --name aarm-dev-rg --yes
```

> **Note:** Key Vault uses soft-delete (90 days). After deletion the vault name is still reserved.
> To permanently delete: `az keyvault purge --name <kv-name>`
