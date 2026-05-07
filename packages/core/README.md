# @brunsforge/azure-app-registration-monitor

TypeScript library for reading, analysing and monitoring Microsoft Entra App Registration client secrets.

## What is this?

When you register an application in Microsoft Entra ID you create **client secrets** (password credentials) that expire. Microsoft does not send automatic renewal reminders, and there is no single built-in view that shows you all expiring secrets across your tenant. When a secret expires, authentication silently breaks — often discovered only after a production outage.

This library is the engine behind the **Azure App Registration Monitor (AARM)** toolchain. It lets you:

- **Authenticate** against a tenant using client-secret, device code, interactive browser, certificate, username-password, or Azure CLI credentials
- **Read** all App Registrations and their `passwordCredentials` through Microsoft Graph
- **Calculate** each secret's expiry status and days remaining
- **Classify** risk level (Info → Critical) based on time to expiry
- **Run preflight checks** to detect which permissions are available in the current tenant
- **Analyze usage** via Log Analytics `AADServicePrincipalSignInLogs` to see when each credential was last used
- **Produce stable JSON** output envelopes compatible with automation and the AARM desktop UI

The library has no UI or CLI logic. Use it programmatically in Node.js scripts, scheduled jobs, or as the engine behind the [`@brunsforge/aarm`](../cli/README.md) CLI.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js | ≥ 20 |
| TypeScript | ≥ 5.0 (if using from TypeScript) |
| Entra App Registration | With `Application.Read.All` granted and admin consent |
| Auth credentials | Client secret, certificate, or interactive login |

### Minimum Graph permissions

| Permission | Type | Required for |
|---|---|---|
| `Application.Read.All` | Application | Listing apps and secrets |
| `Directory.Read.All` | Application | Reading owners (optional) |

All application permissions require **admin consent** from a Global Administrator.

### Log Analytics (optional)

To use usage analysis, Entra diagnostic logs must be routed to a Log Analytics Workspace:

- Azure Portal → Entra ID → Diagnostic settings → enable `ServicePrincipalSignInLogs`
- RBAC on the workspace: `Log Analytics Reader` or `Monitoring Reader`

---

## Installation

```bash
npm install @brunsforge/azure-app-registration-monitor
```

For **persistent token caching** (device-code and interactive-browser without re-authenticating on every run), also install:

```bash
npm install @azure/identity-cache-persistence
```

The library calls `useIdentityPlugin(cachePersistencePlugin)` internally when the package is available.

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
  clientSecret: process.env.AARM_CLIENT_SECRET!, // load from env or OS credential store
});

// 2. Create a Graph client
const graphClient = createGraphClient(credential);

// 3. Build the inventory service
const reader    = new GraphApplicationReader(graphClient);
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

### Client Secret — service-to-service, unattended

```typescript
const credential = createCredential({
  mode: 'client-secret',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',
  clientSecret: process.env.AARM_CLIENT_SECRET!, // never hardcode
});
```

**Best for:** CI/CD pipelines, scheduled jobs, Azure Functions.  
**Note:** Requires admin consent for `Application.Read.All`.

---

### Device Code — interactive, no browser redirect needed

```typescript
const credential = createCredential({
  mode: 'device-code',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',
});
// The library writes to process.stderr:
// "To sign in, open https://microsoft.com/devicelogin and enter the code XXXXXXXX"
```

**Best for:** Headless servers, terminal use on developer workstations.  
**Token cache:** When `@azure/identity-cache-persistence` is installed, tokens persist between runs.

---

### Interactive Browser — OAuth flow via localhost redirect

```typescript
const credential = createCredential({
  mode: 'interactive-browser',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',
  redirectUri: 'http://localhost', // must be registered in the App Registration
});
// Opens the system browser for sign-in.
```

**Best for:** Desktop tools, local development.  
**Setup:** Add `http://localhost` as a redirect URI under App Registration → Authentication → Single-page application or Web.  
**Token cache:** When `@azure/identity-cache-persistence` is installed, the browser prompt is skipped on subsequent runs within the token lifetime.

---

### Certificate — app-only with X.509 certificate

```typescript
const credential = createCredential({
  mode: 'certificate',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',
  certificatePath: '/path/to/certificate.pem',
});
```

**Best for:** High-security production environments.

---

### Azure CLI — developer convenience

```typescript
const credential = createCredential({
  mode: 'azure-cli',
  tenantId: '<tenant-id>', // optional — omit to use the default subscription
});
// Delegates to the `az` CLI token cache. Run `az login` first.
```

**Best for:** Local development when already authenticated via Azure CLI.

---

### Username + Password — ROPC flow

```typescript
const credential = createCredential({
  mode: 'username-password',
  tenantId: '<tenant-id>',
  clientId: '<client-id>',  // App Registration with "Allow public client flows" enabled
  username: 'user@contoso.com',
  password: process.env.AARM_USER_PASSWORD!,
});
```

**Best for:** Automation against tenants where MFA is disabled for the service account.  
**Limitations:**
- Does **not** support MFA. Use `device-code` for accounts with MFA.
- Does **not** support federated or guest accounts.
- The App Registration must have **Allow public client flows** enabled (Authentication → Advanced settings).

---

## Listing App Registrations and Secrets

```typescript
const apps = await inventory.getInventory({
  includeOwners: true,          // resolves owners via Graph (needs Directory.Read.All)
  thresholds: {
    expiringWithinDays: 90,     // secrets expiring within 90 days get status ExpiringSoon
  },
});

for (const app of apps) {
  console.log(`${app.displayName}  [${app.riskLevel}]`);
  console.log(`  ${app.secretCount} secret(s), ${app.expiredSecretCount} expired`);
  console.log(`  Owners: ${app.owners.map(o => o.displayName).join(', ') || '—'}`);

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

### Find a single App Registration by display name

```typescript
const reader = new GraphApplicationReader(graphClient);

// Exact match — returns the app or null if not found / ambiguous
const app = await reader.findByDisplayName('CRM Connector');
if (app) {
  console.log(`Found: ${app.appId}  (${app.passwordCredentials.length} secrets)`);
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
| `Info` | Valid, expires in more than 180 days |
| `Low` | Expires within 181–91 days |
| `Medium` | Expires within 90–31 days |
| `High` | Expires within 30 days or fewer |
| `Critical` | Already expired |

---

## Expiry calculation

Use the standalone functions directly if you need them outside the inventory service:

```typescript
import {
  calculateExpiryStatus,
  classifySecretRisk,
  riskLevelOrder,
} from '@brunsforge/azure-app-registration-monitor';

const result = calculateExpiryStatus(
  '2026-06-15T00:00:00Z',        // endDateTime from Graph
  { expiringWithinDays: 30 },    // thresholds (optional)
  new Date(),                    // override "now" for testing
);
// → { status: 'ExpiringSoon', daysUntilExpiry: 40 }

const risk = classifySecretRisk(result.daysUntilExpiry, result.status);
// → 'Medium'

// Compare / sort risk levels
const sorted = ['High', 'Info', 'Critical', 'Low', 'Medium']
  .sort((a, b) => riskLevelOrder(a as any) - riskLevelOrder(b as any));
// → ['Info', 'Low', 'Medium', 'High', 'Critical']
```

---

## Preflight capability checks

Before running a scan you can detect which Graph and Azure permissions are available. The result drives capability-based UI behavior and tells automation which features to enable.

```typescript
import {
  PreflightService,
  createGraphClient,
  createCredential,
} from '@brunsforge/azure-app-registration-monitor';

const credential  = createCredential({ /* ... */ });
const graphClient = createGraphClient(credential);

const preflight = new PreflightService(graphClient, credential);
const result    = await preflight.run({
  tenantId:                  '<tenant-id>',
  environmentName:           'prod',
  authMode:                  'client-secret',
  logAnalyticsWorkspaceId:   '<workspace-id>',  // optional; omit to skip LA checks
});

console.log('Auth valid         :', result.authValid);
console.log('Graph reachable    :', result.graphReachable);
console.log('Read applications  :', result.capabilities.canReadApplications);
console.log('Read secrets       :', result.capabilities.canReadApplicationSecrets);
console.log('Read owners        :', result.capabilities.canReadOwners);
console.log('Log Analytics      :', result.capabilities.canQueryLogAnalytics);
console.log('SP Sign-in logs    :', result.capabilities.canAnalyzeServicePrincipalSignIns);
console.log('Missing perms      :', result.missingPermissions);
console.log('Warnings           :', result.warnings);
```

### Understand which permissions are needed

```typescript
import {
  PERMISSION_DETAILS,
  isDelegatedMode,
  getPermissionHints,
} from '@brunsforge/azure-app-registration-monitor';

// Print grant instructions for every capability
for (const detail of PERMISSION_DETAILS) {
  const hint = isDelegatedMode('device-code')
    ? detail.delegatedHint
    : detail.applicationHint;
  console.log(`${detail.capability}  [MVP: ${detail.mvp}]`);
  console.log(`  How to grant: ${hint}`);
}

// Get the permission hint map for a specific auth mode
const hints = getPermissionHints('client-secret');
console.log('canReadApplications requires:', hints.canReadApplications);
```

### Capability flags

| Flag | Meaning |
|---|---|
| `canReadApplications` | App Registrations can be listed |
| `canReadApplicationSecrets` | Password credentials are returned with apps |
| `canReadServicePrincipals` | Enterprise apps can be resolved |
| `canReadOwners` | Application owners can be listed (`Directory.Read.All`) |
| `canReadDirectory` | Directory user information can be resolved |
| `canQueryLogAnalytics` | Log Analytics workspace is queryable |
| `canAnalyzeServicePrincipalSignIns` | `AADServicePrincipalSignInLogs` table exists and is accessible |
| `canCreateApplicationSecrets` | Secret creation is permitted (post-MVP) |
| `canDeleteApplicationSecrets` | Secret deletion is permitted (post-MVP) |
| `canCreateApplications` | App Registration creation is permitted (post-MVP) |
| `canReadAzureResources` | Azure resource metadata can be read (post-MVP) |
| `canReadKeyVaultMetadata` | Key Vault metadata can be read (post-MVP) |

---

## Log Analytics usage analysis

Requires `canQueryLogAnalytics` and `canAnalyzeServicePrincipalSignIns` from preflight.  
The workspace must have `AADServicePrincipalSignInLogs` routed via Entra Diagnostic Settings.

### App usage — last seen, sign-in counts, active keys

```typescript
import { LogAnalyticsClient } from '@brunsforge/azure-app-registration-monitor';

const la = new LogAnalyticsClient(credential);

const result = await la.queryAppUsage(
  '<workspace-id>',
  '<app-client-id>',    // appId from Graph
  90,                   // look-back window in days
);

console.log('Last seen    :', result.lastSeen);       // ISO 8601 or null
console.log('First seen   :', result.firstSeen);
console.log('Total sign-ins:', result.totalCount);
console.log('Successes    :', result.successCount);
console.log('Failures     :', result.failureCount);
console.log('Active keys  :', result.distinctKeyIds);  // credential key IDs seen in the window

for (const row of result.rows.slice(0, 5)) {
  console.log(
    row.timeGenerated,
    row.credentialKeyId.slice(0, 8),
    row.resourceDisplayName,
    row.ipAddress,
    row.resultType === '0' ? 'OK' : `FAIL(${row.resultType})`,
  );
}
```

### Secret key usage — last-seen for a specific key ID

```typescript
const result = await la.querySecretUsage(
  '<workspace-id>',
  '<key-id>',   // keyId from passwordCredential
  90,
);

console.log('Last seen    :', result.lastSeen);
console.log('Total count  :', result.totalCount);

for (const row of result.rows) {
  console.log(
    row.lastSeen,
    row.count,
    row.resourceDisplayName,
    row.ipAddress,
    row.resultType === '0' ? 'OK' : `FAIL(${row.resultType})`,
  );
}
```

### Rotation check — is the old key still in use?

Use this after rotating a secret to verify all consumers have switched to the new key:

```typescript
const result = await la.queryRotationCheck(
  '<workspace-id>',
  '<app-client-id>',
  '<old-key-id>',   // the key ID of the rotated (old) secret
  14,               // look-back window in days
);

if (result.totalCount === 0) {
  console.log('Safe to delete: old key not seen in the last 14 days.');
} else {
  console.log(`Old key still active: ${result.totalCount} sign-in(s)`);
  console.log(`Last seen: ${result.lastSeen}`);
  for (const row of result.rows) {
    console.log(`  ${row.lastSeen}  ×${row.count}  via ${row.resourceDisplayName} (${row.ipAddress})`);
  }
}
```

### Check workspace capability without running a full scan

```typescript
const check = await la.checkCapability('<workspace-id>');

console.log('Can query       :', check.canQuery);
console.log('SP sign-in logs :', check.canAnalyzeSignIns);
if (check.warning) console.warn(check.warning);
```

### Result codes for expired-secret failures

When a secret has expired, sign-in attempts typically produce one of these `ResultType` values:

| ResultType | AADSTS Code | Meaning |
|---|---|---|
| `7000222` | AADSTS7000222 | The provided client secret keys have expired (most specific) |
| `7000215` | AADSTS7000215 | Invalid client secret provided |
| `700016`  | AADSTS700016 | Application not found in directory (usually a configuration error) |

```typescript
const EXPIRED_SECRET_CODES = new Set(['7000222', '7000215']);

const failures = result.rows.filter(r =>
  r.resultType !== '0' &&
  EXPIRED_SECRET_CODES.has(r.resultType)
);
if (failures.length > 0) {
  console.warn(`Likely expired-secret failures: ${failures.length} event(s)`);
}
```

---

## JSON result envelope

Every CLI command returns data wrapped in a stable envelope. Use `createResultEnvelope` and `envelopeToJson` to produce the same format programmatically:

```typescript
import { createResultEnvelope, envelopeToJson } from '@brunsforge/azure-app-registration-monitor';

const envelope = createResultEnvelope(
  apps,                // data: T  (any serialisable value)
  '<tenant-id>',
  'prod',
  {
    warnings: ['Owner information unavailable.'],
    errors:   [],
  }
);

process.stdout.write(envelopeToJson(envelope) + '\n');
```

Output shape:

```json
{
  "success": true,
  "metadata": {
    "tenantId": "<tenant-id>",
    "environmentName": "prod",
    "generatedAt": "2026-05-06T12:00:00.000Z",
    "toolVersion": "0.1.1"
  },
  "data": [ "..." ],
  "warnings": ["Owner information unavailable."],
  "errors": []
}
```

---

## End-to-end example

Authenticate, scan a tenant, check usage of every expiring secret, print a summary:

```typescript
import {
  createCredential,
  createGraphClient,
  GraphApplicationReader,
  SecretInventoryService,
  LogAnalyticsClient,
  PreflightService,
  createResultEnvelope,
  envelopeToJson,
} from '@brunsforge/azure-app-registration-monitor';

const TENANT_ID    = process.env.AZURE_TENANT_ID!;
const CLIENT_ID    = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const WORKSPACE_ID = process.env.LOG_ANALYTICS_WORKSPACE_ID; // optional

async function main() {
  const credential  = createCredential({ mode: 'client-secret', tenantId: TENANT_ID, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
  const graphClient = createGraphClient(credential);

  // 1. Preflight
  const preflight = new PreflightService(graphClient, credential);
  const caps      = await preflight.run({ tenantId: TENANT_ID, environmentName: 'prod', authMode: 'client-secret', logAnalyticsWorkspaceId: WORKSPACE_ID });

  if (!caps.capabilities.canReadApplications) {
    throw new Error('Missing Application.Read.All. Grant admin consent and retry.');
  }

  // 2. Inventory
  const inventory = new SecretInventoryService(new GraphApplicationReader(graphClient));
  const apps      = await inventory.getInventory({ includeOwners: true });

  const expiring = apps.flatMap(a => a.secrets).filter(s => s.status !== 'Valid' && s.status !== 'Unknown');
  console.log(`${expiring.length} expiring or expired secrets across ${apps.length} App Registrations`);

  // 3. Usage analysis (only if Log Analytics is available)
  if (WORKSPACE_ID && caps.capabilities.canAnalyzeServicePrincipalSignIns) {
    const la = new LogAnalyticsClient(credential);
    for (const secret of expiring) {
      const usage = await la.querySecretUsage(WORKSPACE_ID, secret.keyId, 90);
      console.log(
        `  ${secret.appDisplayName} / ${secret.displayName ?? secret.keyId.slice(0, 8)}` +
        `  last seen: ${usage.lastSeen ?? 'never'}` +
        `  (${usage.totalCount} sign-ins in 90 days)`
      );
    }
  }

  // 4. Emit result envelope for downstream consumption
  process.stdout.write(envelopeToJson(createResultEnvelope(apps, TENANT_ID, 'prod')) + '\n');
}

main().catch(err => { process.stderr.write(err.message + '\n'); process.exit(1); });
```

---

## Error handling

All errors extend `AarmError`:

```typescript
import { AuthError, GraphError, PermissionError, ConfigError } from '@brunsforge/azure-app-registration-monitor';

try {
  const apps = await inventory.getInventory();
} catch (err) {
  if (err instanceof AuthError)       console.error('Auth failed:', err.message);
  else if (err instanceof PermissionError) console.error('Permission denied:', err.message);
  else if (err instanceof GraphError) console.error(`Graph HTTP ${err.statusCode}:`, err.message);
  else if (err instanceof ConfigError) console.error('Config error:', err.message);
  else throw err;
}
```

| Error class | Cause |
|---|---|
| `AuthError` | Token acquisition failed — check credentials or auth mode |
| `PermissionError` | Missing Graph permission — check admin consent |
| `GraphError` | Microsoft Graph returned an error (`statusCode` available) |
| `ConfigError` | Invalid or missing configuration |

---

## API reference

### Authentication

| Export | Description |
|---|---|
| `createCredential(config: AuthConfig)` | Returns an Azure Identity `TokenCredential` |
| `createGraphClient(credential)` | Returns a configured Graph SDK `Client` |
| `AuthMode` | `'client-secret' \| 'device-code' \| 'interactive-browser' \| 'certificate' \| 'azure-cli' \| 'username-password'` |
| `isDelegatedMode(mode)` | `true` for device-code, interactive-browser, azure-cli, username-password |

### Configuration types

| Type | Fields |
|---|---|
| `TenantProfile` | `tenantId`, `displayName`, `authMode`, `clientId?`, `username?`, `logAnalyticsWorkspaceId?`, `defaultEnvironmentName?`, timestamps |
| `EnvironmentProfile` | `environmentId`, `tenantId`, `name`, `logAnalyticsWorkspaceId?`, `defaultDaysForUsageAnalysis?` |

### Graph reader

| Export | Description |
|---|---|
| `GraphApplicationReader` | `listApplications()` — all apps with `passwordCredentials` |
| | `findByDisplayName(name)` — single app by exact display name or `null` |
| | `getApplicationOwners(objectId)` — `GraphOwner[]` |
| `GraphApplication` | Raw Graph application object |
| `GraphPasswordCredential` | Raw Graph password credential |
| `GraphOwner` | Raw owner object (`id`, `displayName`, `userPrincipalName`) |

### Secrets

| Export | Description |
|---|---|
| `SecretInventoryService` | `getInventory(options?)` → `AppRegistrationSummary[]` |
| `calculateExpiryStatus(endDateTime, thresholds?, now?)` | → `ExpiryResult` (`status`, `daysUntilExpiry`) |
| `classifySecretRisk(daysUntilExpiry, status)` | → `RiskLevel` |
| `maxRiskLevel(levels)` | → highest `RiskLevel` from an array |
| `riskLevelOrder(level)` | → numeric order 0–4 for sorting/comparison |
| `SecretStatus` | `'Valid' \| 'ExpiringSoon' \| 'Expired' \| 'Unknown'` |
| `RiskLevel` | `'Info' \| 'Low' \| 'Medium' \| 'High' \| 'Critical'` |

### Preflight

| Export | Description |
|---|---|
| `PreflightService` | `run(params)` → `PreflightResult` |
| `CapabilityEvaluator` | Low-level Graph capability checks |
| `PERMISSION_DETAILS` | `PermissionDetail[]` — full permission info per capability |
| `PERMISSION_HINTS` | `Record<capability, hint>` for the default auth mode |
| `APPLICATION_PERMISSION_HINTS` | Hints for application (client-secret/certificate) modes |
| `DELEGATED_PERMISSION_HINTS` | Hints for delegated (device-code/browser/cli) modes |
| `getPermissionHints(authMode)` | Returns the correct hint map for a given `AuthMode` |
| `isDelegatedMode(authMode)` | `true` for user-delegated auth modes |
| `CapabilitySet` | All 12 boolean capability flags |
| `PreflightResult` | Full result: `authValid`, `graphReachable`, `capabilities`, `missingPermissions`, `warnings`, `errors` |

### Log Analytics

| Export | Description |
|---|---|
| `LogAnalyticsClient` | `checkCapability(workspaceId)` → `LogAnalyticsCapabilityResult` |
| | `queryAppUsage(workspaceId, appId, days)` → `AppUsageResult` |
| | `querySecretUsage(workspaceId, keyId, days)` → `SecretUsageResult` |
| | `queryRotationCheck(workspaceId, appId, oldKeyId, days)` → `SecretUsageResult` |
| `AppUsageResult` | `firstSeen`, `lastSeen`, `totalCount`, `successCount`, `failureCount`, `distinctKeyIds`, `rows: UsageObservation[]` |
| `SecretUsageResult` | `lastSeen`, `totalCount`, `rows: UsageSummary[]` |
| `UsageObservation` | Per-event row: `timeGenerated`, `appId`, `credentialKeyId`, `resourceDisplayName`, `ipAddress`, `resultType`, `resultDescription` |
| `UsageSummary` | Aggregated row: `lastSeen`, `count`, `resourceDisplayName`, `ipAddress`, `resultType` |

### Reporting

| Export | Description |
|---|---|
| `createResultEnvelope<T>(data, tenantId, env, options?)` | Wraps any data in the stable output envelope |
| `envelopeToJson<T>(envelope)` | Serializes to a JSON string |
| `ResultEnvelope<T>` | `{ success, metadata, data, warnings, errors }` |

### Errors

`AarmError`, `AuthError`, `PermissionError`, `GraphError`, `ConfigError`

---

## Related packages

| Package | Description |
|---|---|
| [`@brunsforge/aarm`](../cli/README.md) | CLI tool built on top of this library |
| Azure App Registration Monitor (MAUI) | Desktop UI that runs the CLI and visualises results |
