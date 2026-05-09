// AARM Azure Function — full infrastructure deployment
//
// Deploy:
//   az group create -n <rg> -l westeurope
//   az deployment group create -g <rg> -f main.bicep -p prefix=aarm
//
// After deploy, publish the function code:
//   .\infra\deploy.ps1 -ResourceGroup <rg> -CodeOnly

@description('Short prefix for all resource names. Lowercase alphanumeric, max 8 chars.')
@maxLength(8)
param prefix string = 'aarm'

@description('Azure region for all resources.')
param location string = resourceGroup().location

// ── Derived names ──────────────────────────────────────────────────────────────
var suffix       = uniqueString(resourceGroup().id)
var storageName  = '${prefix}${take(suffix, 16)}'           // 3-24 chars, lowercase alphanum
var fnName       = '${prefix}-fn-${take(suffix, 8)}'
var kvName       = '${prefix}-kv-${take(suffix, 8)}'
var uamiName     = '${prefix}-fn-identity'
var planName     = '${prefix}-fn-plan'
var insightsName = '${prefix}-insights'
var logsName     = '${prefix}-logs'

// ── Built-in role definition IDs ───────────────────────────────────────────────
var roleBlobDataContributor  = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'  // Storage Blob Data Contributor
var roleQueueDataContributor = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'  // Storage Queue Data Contributor
var roleTableDataContributor = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'  // Storage Table Data Contributor
var roleKvSecretsOfficer     = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'  // Key Vault Secrets Officer

// ── User-Assigned Managed Identity ────────────────────────────────────────────
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: uamiName
  location: location
}

// ── Storage Account ────────────────────────────────────────────────────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// ── Key Vault (RBAC-enabled, no access policies) ───────────────────────────────
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// ── Log Analytics Workspace (feeds Application Insights) ──────────────────────
resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ── Application Insights ───────────────────────────────────────────────────────
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// ── App Service Plan (Consumption — Linux) ─────────────────────────────────────
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  properties: { reserved: true }
}

// ── Function App ───────────────────────────────────────────────────────────────
resource fn 'Microsoft.Web/sites@2023-12-01' = {
  name: fnName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uami.id}': {} }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      // Managed-identity auth for the Functions runtime storage
      // (no connection string — no secrets in config)
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION',              value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME',                 value: 'node' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT',           value: 'true' }
        // UAMI client ID — picked up by DefaultAzureCredential and managed-identity storage
        { name: 'AZURE_CLIENT_ID',                          value: uami.properties.clientId }
        // Functions runtime storage (managed identity, no connection string)
        { name: 'AzureWebJobsStorage__accountName',         value: storage.name }
        { name: 'AzureWebJobsStorage__blobServiceUri',      value: storage.properties.primaryEndpoints.blob }
        { name: 'AzureWebJobsStorage__queueServiceUri',     value: storage.properties.primaryEndpoints.queue }
        { name: 'AzureWebJobsStorage__tableServiceUri',     value: storage.properties.primaryEndpoints.table }
        { name: 'AzureWebJobsStorage__credential',          value: 'managedidentity' }
        { name: 'AzureWebJobsStorage__clientId',            value: uami.properties.clientId }
        // AARM-specific settings
        { name: 'AARM_STORAGE_URI',                         value: storage.properties.primaryEndpoints.blob }
        { name: 'AARM_KEYVAULT_URI',                        value: kv.properties.vaultUri }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING',    value: insights.properties.ConnectionString }
      ]
    }
  }
}

// ── Role: Storage Blob Data Contributor → UAMI ────────────────────────────────
// Covers Functions runtime blob state and AARM aarm-config / aarm-data containers.
resource rbacBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, uami.id, roleBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleBlobDataContributor)
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Role: Storage Queue Data Contributor → UAMI ───────────────────────────────
// Required by the Functions Consumption runtime for internal coordination.
resource rbacQueue 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, uami.id, roleQueueDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleQueueDataContributor)
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Role: Storage Table Data Contributor → UAMI ───────────────────────────────
// Required by the Functions Consumption runtime for internal coordination.
resource rbacTable 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, uami.id, roleTableDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleTableDataContributor)
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Role: Key Vault Secrets Officer → UAMI ────────────────────────────────────
// Secrets Officer covers get, set, delete — required for full CRUD via the API.
resource rbacKv 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, uami.id, roleKvSecretsOfficer)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsOfficer)
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────────
output functionAppName    string = fn.name
output functionAppUrl     string = 'https://${fn.properties.defaultHostName}'
output storageAccountName string = storage.name
output keyVaultName       string = kv.name
output keyVaultUri        string = kv.properties.vaultUri
output uamiClientId       string = uami.properties.clientId
output logAnalyticsId     string = logs.id
