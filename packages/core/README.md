# @brunsforge/azure-app-registration-monitor

TypeScript library for reading, analysing and monitoring Microsoft Entra App Registration client secrets.

## What is this?

When you register an application in Microsoft Entra ID you create **client secrets** (password credentials) that expire. Microsoft does not send automatic renewal reminders, and there is no single built-in view that shows you all expiring secrets across your tenant. When a secret expires, authentication silently breaks—often discovered only after a production outage.

This library is the engine behind the **Azure App Registration Monitor (AARM)** toolchain. It lets you:

- **Authenticate** against a tenant using client-secret, device code, interactive browser, certificate, or Azure CLI credentials
- **Read** all App Registrations and their `passwordCredentials` through Microsoft Graph
- **Calculate** each secret's expiry status and days remaining
- **Classify** risk level (Info → Critical) based on time to expiry
- **Run preflight checks** to detect which permissions are available in the current tenant
- **Produce stable JSON** output envelopes compatible with automation and the AARM desktop UI

The library has no UI or CLI logic. Use it programmatically in Node.js scripts, scheduled jobs, or as the engine behind the [`@brunsforge/aarm`](../cli/README.md) CLI.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js | ≥ 18 |
| TypeScript | ≥ 5.0 (if using from TypeScript) |
| Entra App Registration | With `Application.Read.All` granted and admin consent |
| Auth credentials | Client secret, certificate, or interactive login |

### Minimum Graph permissions

| Permission | Type | Required for |
|---|---|---|
| `Application.Read.All` | Application | Listing apps and secrets |
| `Directory.Read.All` | Application | Reading owners (optional) |

All application permissions require **admin consent** from a Global Administrator.

---

## Installation

```bash
npm install @brunsforge/azure-app-registration-monitor
```

---

## Quickstart

```typescript
import {
  createCredential,
  createGraphClient,
  GraphApplicationReader,
  SecretInventoryService,
  createResultEnvelope,
  envelopeToJson,
} from '@brunsforge/azure-app-registration-monitor';

// 1. Create a credential (client-secret auth)
const credential = createCredential({
  mode: 'client-secret',
  tenantId: '<your-tenant-id>',
  clientId: '<your-app-client-id>',
  clientSecret: '<your-client-secret>',   // load from OS credential store in production
});

// 2. Create a Graph client
const graphClient = createGraphClient(credential);

// 3. Create the inventory service
const reader = new GraphApplicationReader(graphClient);
const inventory = new SecretInventoryService(reader);

// 4. Get all App Registrations with their secret status
const apps = await inventory.getInventory({ includeOwners: false });

// 5. Filter to only High or Critical risk
const urgent = apps
  .flatMap(app => app.secrets)
  .filter(s => s.riskLevel === 'High' || s.riskLevel === 'Critical');

console.log(`Found ${urgent.length} urgent secrets`);

// 6. Wrap in the standard JSON envelope
const envelope = createResultEnvelope(apps, '<tenant-id>', 'prod');
console.log(envelopeToJson(envelope));
```

---

## Authentication Modes

### Client Secret (service-to-service, unattended)

```typescript
const credential = createCredential({
  mode: 'client-secret',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',
  clientSecret: process.env.AARM_CLIENT_SECRET!, // never hardcode
});
```

**Best for:** CI/CD pipelines, scheduled jobs, Azure Functions.

### Device Code (interactive, no browser redirect)

```typescript
const credential = createCredential({
  mode: 'device-code',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',
});
// The Azure SDK prints a URL and code to stdout.
// The user opens the URL and enters the code in a browser.
```

**Best for:** Terminal use on servers without a browser, developer workstations.

### Interactive Browser (OAuth flow via localhost redirect)

```typescript
const credential = createCredential({
  mode: 'interactive-browser',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',
  redirectUri: 'http://localhost:8080', // must be registered in the App Registration
});
```

**Best for:** Local developer use, desktop tools.

### Certificate

```typescript
const credential = createCredential({
  mode: 'certificate',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',
  certificatePath: '/path/to/certificate.pem',
});
```

**Best for:** High-security production environments.

### Azure CLI (developer convenience)

```typescript
const credential = createCredential({
  mode: 'azure-cli',
  tenantId: '<tenant-id>', // optional
});
// Delegates to the `az` CLI token cache. Requires `az login` first.
```

**Best for:** Local development when already authenticated via Azure CLI.

---

## Listing App Registrations and Secrets

```typescript
const apps = await inventory.getInventory({
  includeOwners: true,          // resolves owners (needs Directory.Read.All)
  thresholds: {
    expiringWithinDays: 90,     // secrets expiring within 90 days → ExpiringSoon
  },
});

for (const app of apps) {
  console.log(`${app.displayName}  [${app.riskLevel}]`);
  console.log(`  ${app.secretCount} secret(s), ${app.expiredSecretCount} expired`);
  console.log(`  Owners: ${app.owners.map(o => o.displayName).join(', ')}`);

  for (const secret of app.secrets) {
    console.log(
      `  • ${secret.displayName ?? secret.keyId}` +
      `  expires ${secret.endDateTime ?? 'unknown'}` +
      `  (${secret.daysUntilExpiry ?? '?'} days)` +
      `  status=${secret.status}  risk=${secret.riskLevel}`
    );
  }
}
```

### SecretSummary fields

| Field | Type | Description |
|---|---|---|
| `applicationObjectId` | `string` | Object ID of the parent App Registration |
| `appId` | `string` | Client ID (application ID) |
| `appDisplayName` | `string` | Display name of the App Registration |
| `keyId` | `string` | Unique identifier for this password credential |
| `displayName` | `string \| null` | User-assigned name for the secret |
| `hint` | `string \| null` | Partial hint returned by Graph |
| `startDateTime` | `string \| null` | ISO 8601 creation date |
| `endDateTime` | `string \| null` | ISO 8601 expiry date |
| `daysUntilExpiry` | `number \| null` | Negative = already expired |
| `status` | `SecretStatus` | `Valid`, `ExpiringSoon`, `Expired`, `Unknown` |
| `riskLevel` | `RiskLevel` | `Info`, `Low`, `Medium`, `High`, `Critical` |

### Risk levels

| Risk | Condition |
|---|---|
| `Info` | Valid and expires more than 180 days from now |
| `Low` | Expires within 181–90 days |
| `Medium` | Expires within 90–31 days |
| `High` | Expires within 30 days |
| `Critical` | Already expired |

---

## Expiry calculation

Use the standalone functions if you need them outside the inventory service:

```typescript
import { calculateExpiryStatus, classifySecretRisk } from '@brunsforge/azure-app-registration-monitor';

const result = calculateExpiryStatus(
  '2026-06-15T00:00:00Z',
  { expiringWithinDays: 30 },
  new Date(),                   // injectable for testing
);
// → { status: 'ExpiringSoon', daysUntilExpiry: 44 }

const risk = classifySecretRisk(result.daysUntilExpiry, result.status);
// → 'Medium'
```

---

## Preflight capability checks

Before running a scan you can check which Graph and Azure permissions are available. The result tells the UI or automation which features to enable.

```typescript
import { PreflightService, createGraphClient, createCredential } from '@brunsforge/azure-app-registration-monitor';

const credential = createCredential({ ... });
const graphClient = createGraphClient(credential);

const preflight = new PreflightService(graphClient, credential);
const result = await preflight.run({
  tenantId: '<tenant-id>',
  environmentName: 'prod',
  logAnalyticsWorkspaceId: '<workspace-id>', // optional
});

console.log('Auth valid:', result.authValid);
console.log('Graph reachable:', result.graphReachable);
console.log('Can read apps:', result.capabilities.canReadApplications);
console.log('Can query Log Analytics:', result.capabilities.canQueryLogAnalytics);
console.log('Missing permissions:', result.missingPermissions);
```

### Capability flags

| Flag | Meaning |
|---|---|
| `canReadApplications` | App Registrations can be listed |
| `canReadApplicationSecrets` | Password credentials are returned with apps |
| `canReadServicePrincipals` | Enterprise apps can be resolved |
| `canReadOwners` | Application owners can be listed |
| `canReadDirectory` | Directory user information can be resolved |
| `canQueryLogAnalytics` | Log Analytics workspace is queryable |
| `canAnalyzeServicePrincipalSignIns` | `AADServicePrincipalSignInLogs` table is accessible |
| `canCreateApplicationSecrets` | Secret creation is permitted (post-MVP) |
| `canDeleteApplicationSecrets` | Secret deletion is permitted (post-MVP) |
| `canCreateApplications` | App Registration creation is permitted (post-MVP) |
| `canReadAzureResources` | Azure resource metadata can be read (post-MVP) |
| `canReadKeyVaultMetadata` | Key Vault metadata can be read (post-MVP) |

---

## JSON result envelope

Every CLI command returns data wrapped in a stable envelope. Use `createResultEnvelope` and `envelopeToJson` to produce the same format programmatically:

```typescript
import { createResultEnvelope, envelopeToJson } from '@brunsforge/azure-app-registration-monitor';

const envelope = createResultEnvelope(
  apps,                    // data: T
  '<tenant-id>',
  'prod',
  {
    warnings: ['Owner information unavailable.'],
    errors: [],
  }
);

console.log(envelopeToJson(envelope));
```

Output shape:

```json
{
  "success": true,
  "metadata": {
    "tenantId": "<tenant-id>",
    "environmentName": "prod",
    "generatedAt": "2026-05-01T12:00:00.000Z",
    "toolVersion": "0.1.0"
  },
  "data": [ ... ],
  "warnings": ["Owner information unavailable."],
  "errors": []
}
```

---

## Error handling

All errors extend `AarmError` and carry a `code` string:

```typescript
import {
  AuthError,
  GraphError,
  PermissionError,
  ConfigError,
} from '@brunsforge/azure-app-registration-monitor';

try {
  const apps = await inventory.getInventory();
} catch (err) {
  if (err instanceof AuthError) {
    // Token acquisition failed — check credentials
  } else if (err instanceof PermissionError) {
    // Missing Graph permission — check admin consent
  } else if (err instanceof GraphError) {
    console.error(`Graph API error (HTTP ${err.statusCode}): ${err.message}`);
  }
}
```

| Error class | `code` | Cause |
|---|---|---|
| `AuthError` | `AUTH_ERROR` | Token acquisition failed |
| `PermissionError` | `PERMISSION_ERROR` | Missing Graph permission |
| `GraphError` | `GRAPH_ERROR` | Microsoft Graph returned an error |
| `ConfigError` | `CONFIG_ERROR` | Invalid or missing configuration |

---

## API reference

### Authentication

| Export | Description |
|---|---|
| `createCredential(config: AuthConfig)` | Returns an Azure Identity `TokenCredential` for the given auth mode |
| `createGraphClient(credential)` | Creates a configured Microsoft Graph SDK `Client` |
| `AuthMode` | Union type: `'client-secret' \| 'device-code' \| 'interactive-browser' \| 'certificate' \| 'azure-cli'` |

### Configuration types

| Type | Description |
|---|---|
| `TenantProfile` | Stored tenant configuration (tenantId, displayName, authMode, clientId, timestamps) |
| `EnvironmentProfile` | Named operational context within a tenant (name, workspaceId, etc.) |

### Graph reader

| Export | Description |
|---|---|
| `GraphApplicationReader` | `listApplications()`, `getApplicationOwners(objectId)` |
| `GraphApplication` | Raw Graph application object |
| `GraphPasswordCredential` | Raw Graph password credential |
| `GraphOwner` | Raw Graph owner (user or service principal) |

### Secrets

| Export | Description |
|---|---|
| `SecretInventoryService` | `getInventory(options?)` — returns `AppRegistrationSummary[]` |
| `calculateExpiryStatus(endDateTime, thresholds?, now?)` | Returns `ExpiryResult` |
| `classifySecretRisk(daysUntilExpiry, status)` | Returns `RiskLevel` |
| `maxRiskLevel(levels)` | Returns the highest `RiskLevel` from an array |
| `SecretStatus` | `'Valid' \| 'ExpiringSoon' \| 'Expired' \| 'Unknown'` |
| `RiskLevel` | `'Info' \| 'Low' \| 'Medium' \| 'High' \| 'Critical'` |

### Preflight

| Export | Description |
|---|---|
| `PreflightService` | `run(params)` — returns `PreflightResult` |
| `CapabilityEvaluator` | Runs individual Graph capability checks |
| `PERMISSION_HINTS` | Record mapping each capability to its required permission string |
| `PERMISSION_DETAILS` | Array of `PermissionDetail` (capability, hint, requiresAdminConsent, mvp) |
| `CapabilitySet` | All 12 boolean capability flags |
| `PreflightResult` | Full preflight result including authValid, graphReachable, capabilities, missingPermissions, warnings, errors |

### Reporting

| Export | Description |
|---|---|
| `createResultEnvelope<T>(data, tenantId, env, options?)` | Wraps data in the standard envelope |
| `envelopeToJson<T>(envelope)` | Serializes the envelope to a JSON string |
| `ResultEnvelope<T>` | The envelope type |

### Errors

`AarmError`, `AuthError`, `PermissionError`, `GraphError`, `ConfigError`

---

## Related packages

| Package | Description |
|---|---|
| [`@brunsforge/aarm`](../cli/README.md) | CLI tool built on top of this library |
| Azure App Registration Monitor (MAUI) | Desktop UI that runs the CLI and visualises results |
