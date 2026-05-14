targetScope = 'resourceGroup'

// ── Parameters ────────────────────────────────────────────────────────────────

@description('Azure region for all resources. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Short prefix used in every resource name. 4–8 lowercase letters, no hyphens.')
@minLength(2)
@maxLength(8)
param prefix string = 'aarm'

@description('Environment label appended to resource names and used as a tag.')
@allowed(['dev', 'test', 'prod'])
param environment string = 'dev'

@description('''
Object ID of the Azure AD user or group that should be able to manage Key Vault secrets.
User ID:  az ad signed-in-user show --query id -o tsv
Group ID: az ad group show --group "<name>" --query id -o tsv
''')
param keyVaultAdminObjectId string

@description('Principal type for keyVaultAdminObjectId: "User" for a single user, "Group" for an Entra group.')
@allowed(['User', 'Group'])
param keyVaultAdminPrincipalType string = 'Group'

@description('Additional tags applied to every resource.')
param tags object = {}

// ── Naming ────────────────────────────────────────────────────────────────────

var commonTags = union(tags, {
  application: 'aarm'
  environment: environment
})

// Storage account names: 3–24 lowercase alphanumeric characters only, globally unique.
var storageAccountName = toLower(take('${prefix}${environment}${uniqueString(resourceGroup().id)}', 24))

var names = {
  uami: '${prefix}-${environment}-identity'
  storage: storageAccountName
  kv: '${prefix}-${environment}-kv'
  law: '${prefix}-${environment}-law'
  ai: '${prefix}-${environment}-ai'
  plan: '${prefix}-${environment}-plan'
  fn: '${prefix}-${environment}-fn'
  acsEmail: '${prefix}-${environment}-acs-email'
  acsComm: '${prefix}-${environment}-acs'
}

// ── Well-known Azure built-in role definition IDs ─────────────────────────────

var roles = {
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  keyVaultSecretsOfficer: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
}

// ── User-Assigned Managed Identity ───────────────────────────────────────────

resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: names.uami
  location: location
  tags: commonTags
}

// ── Storage Account ──────────────────────────────────────────────────────────

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: names.storage
  location: location
  tags: commonTags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

// Required by Flex Consumption for function deployment packages.
resource deploymentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'deployments'
  properties: {
    publicAccess: 'None'
  }
}

// UAMI needs Storage Blob Data Contributor to read job configs and write scan results.
resource uamiStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, uami.id, roles.storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      roles.storageBlobDataContributor
    )
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Key Vault ─────────────────────────────────────────────────────────────────

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: names.kv
  location: location
  tags: commonTags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enabledForDeployment: false
    enabledForTemplateDeployment: false
    enabledForDiskEncryption: false
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// UAMI needs Key Vault Secrets Officer to read, create, rotate and delete scanning credentials.
// (Secrets Officer = Secrets User + write + delete)
resource uamiKvSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, uami.id, roles.keyVaultSecretsOfficer)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsOfficer)
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Operator needs Key Vault Secrets Officer to create/rotate scanning credentials.
resource adminKvSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, keyVaultAdminObjectId, roles.keyVaultSecretsOfficer)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsOfficer)
    principalId: keyVaultAdminObjectId
    principalType: keyVaultAdminPrincipalType
  }
}

// ── Log Analytics Workspace ───────────────────────────────────────────────────

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: names.law
  location: location
  tags: commonTags
  properties: {
    retentionInDays: 30
    sku: { name: 'PerGB2018' }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Application Insights ──────────────────────────────────────────────────────

resource ai 'Microsoft.Insights/components@2020-02-02' = {
  name: names.ai
  location: location
  tags: commonTags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Azure Communication Services — Email ──────────────────────────────────────
// Optional: only used when mailTargets are configured in jobs.json.
// Auth: connection string stored in Key Vault (no RBAC role needed).

resource acsEmail 'Microsoft.Communication/emailServices@2023-06-01-preview' = {
  name: names.acsEmail
  location: 'global'
  tags: commonTags
  properties: {
    dataLocation: 'Europe'
  }
}

resource acsDomain 'Microsoft.Communication/emailServices/domains@2023-06-01-preview' = {
  parent: acsEmail
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
  }
}

resource acsComm 'Microsoft.Communication/communicationServices@2023-06-01-preview' = {
  name: names.acsComm
  location: 'global'
  tags: commonTags
  properties: {
    dataLocation: 'Europe'
    linkedDomains: [acsDomain.id]
  }
}

// Store ACS connection string in Key Vault — referenced via KV reference App Setting.
resource acsConnSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'aarm-acs-connection'
  properties: {
    value: listKeys(acsComm.id, '2023-06-01-preview').primaryConnectionString
  }
}

// ── Flex Consumption Hosting Plan ─────────────────────────────────────────────

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: names.plan
  location: location
  tags: commonTags
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  kind: 'functionapp'
  properties: {
    reserved: true // Linux
  }
}

// ── Function App ──────────────────────────────────────────────────────────────

resource fn 'Microsoft.Web/sites@2023-12-01' = {
  name: names.fn
  location: location
  tags: commonTags
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uami.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          // Deployment packages are stored in the 'deployments' container.
          value: '${storage.properties.primaryEndpoints.blob}deployments'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: uami.id
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
        alwaysReady: [
          // Keep one warm instance for the timer trigger to avoid cold-start delays.
          {
            name: 'function:aarmScheduleTrigger'
            instanceCount: 1
          }
        ]
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
    siteConfig: {
      appSettings: [
        // ── Identity ──────────────────────────────────────────────────────────
        {
          name: 'AZURE_CLIENT_ID'
          value: uami.properties.clientId
        }
        // ── AzureWebJobsStorage (UAMI-based, no connection string) ────────────
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storage.name
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: storage.properties.primaryEndpoints.blob
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: uami.properties.clientId
        }
        // ── AARM data storage ─────────────────────────────────────────────────
        {
          name: 'AARM_STORAGE_URI'
          value: 'https://${storage.name}.blob.core.windows.net'
        }
        {
          name: 'AARM_KEYVAULT_URI'
          value: kv.properties.vaultUri
        }
        {
          name: 'AARM_DASHBOARD_URL'
          value: 'https://${names.fn}.azurewebsites.net/api/dashboard'
        }
        // ── Application Insights ──────────────────────────────────────────────
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: ai.properties.ConnectionString
        }
        {
          name: 'APPLICATIONINSIGHTS_ROLE_NAME'
          value: 'aarm-azure-function'
        }
        // ── ACS Email (optional — only active when mailTargets are configured) ──
        {
          name: 'AARM_ACS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${kv.name};SecretName=aarm-acs-connection)'
        }
        {
          name: 'AARM_ACS_SENDER_EMAIL'
          value: 'DoNotReply@${acsDomain.properties.mailFromSenderDomain}'
        }
        // ── Functions runtime ─────────────────────────────────────────────────
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
      ]
    }
  }
  dependsOn: [
    uamiStorageRole // Function App needs storage role before it can start.
  ]
}

// ── Outputs ───────────────────────────────────────────────────────────────────

@description('Function App name — used for deployments and further az commands.')
output functionAppName string = fn.name

@description('Function App hostname — base URL for API calls and the dashboard.')
output functionAppHostname string = fn.properties.defaultHostName

@description('Storage account name.')
output storageAccountName string = storage.name

@description('Key Vault name.')
output keyVaultName string = kv.name

@description('Key Vault URI — used for Key Vault reference syntax in App Settings.')
output keyVaultUri string = kv.properties.vaultUri

@description('UAMI client ID — value for AZURE_CLIENT_ID in local.settings.json during local dev that targets this Azure setup.')
output uamiClientId string = uami.properties.clientId

@description('Log Analytics workspace resource ID — can be reused for signing-log queries in job configs.')
output logAnalyticsWorkspaceId string = law.id

@description('Application Insights connection string — already set as App Setting; shown here for reference.')
output appInsightsConnectionString string = ai.properties.ConnectionString

@description('ACS sender email address — set as AARM_ACS_SENDER_EMAIL App Setting.')
output acsSenderEmail string = 'DoNotReply@${acsDomain.properties.mailFromSenderDomain}'
