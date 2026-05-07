using './main.bicep'

// ── Required ──────────────────────────────────────────────────────────────────

// Object ID of the user (or group) who will manage Key Vault secrets (upload job credentials).
// Get your own ID:  az ad signed-in-user show --query id -o tsv
param keyVaultAdminObjectId = '<your-object-id>'

// ── Customise as needed ───────────────────────────────────────────────────────

param location    = 'westeurope'
param prefix      = 'aarm'
param environment = 'dev'

param tags = {
  project:     'azure-app-registration-monitor'
  managedBy:   'bicep'
}
