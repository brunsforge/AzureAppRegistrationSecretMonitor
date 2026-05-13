using './main.bicep'

// ── Required ──────────────────────────────────────────────────────────────────

// Object ID of the user (or group) who will manage Key Vault secrets (upload job credentials).
// Get your own ID:  az ad signed-in-user show --query id -o tsv
param keyVaultAdminObjectId = '00000000-0000-0000-0000-000000000000'

// 'User' for a single user, 'Group' for an Entra group.
// Use a group for shared/production setups - see infra/README.md.
param keyVaultAdminPrincipalType = 'Group'

// ── Customise as needed ───────────────────────────────────────────────────────

param location = 'westeurope'
param prefix = 'aarm'
param environment = 'dev'

param tags = {
  project: 'azure-app-registration-monitor'
  managedBy: 'bicep'
}
