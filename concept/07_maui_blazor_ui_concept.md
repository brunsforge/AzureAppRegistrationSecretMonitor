# .NET MAUI Blazor UI Concept

## Purpose

The UI provides a local desktop application for users who do not want to work directly with CLI commands.

## Technology

- .NET MAUI Blazor Hybrid
- Local desktop app (Windows primary target)
- Local history store
- CLI process integration for secret scanning and usage analysis
- System tray integration: app runs in background when closed, tray icon with context menu

## MVP Integration with npm CLI

Decided by OQ-020 and OQ-022:

1. User configures tenant/environment in the UI.
2. UI invokes `aarm secrets list` as a local process.
3. CLI auto-saves the result to its local history store as a side effect (decided by OQ-045).
4. CLI returns stable JSON output.
5. UI validates the JSON schema.
6. UI stores the received result in the MAUI history store.
7. UI renders dashboard/detail screens.

"Scan Secrets" and "Scan All" UI actions map to `aarm secrets list`. No separate `aarm scan` command exists in the MVP.

The MAUI app bundles the npm CLI binary for MVP. No HTTP bridge is used.

The CLI is also independently usable as a standalone npm package outside MAUI.

## Main Screens

### Tenant Overview

Shows configured tenants and environments.

Fields:

- tenant display name
- tenant ID
- environment name
- auth mode
- last preflight
- last scan
- status

Actions:

- add tenant
- edit tenant
- run preflight
- scan secrets

### Preflight Detail

Shows capability result for a tenant/environment.

Header:

- tenant display name and environment name
- App Registration display name and Client ID that was tested
- timestamp of the last preflight run

Sections:

- authentication
- Graph capabilities (required set)
- Log Analytics capabilities (extended set)
- write capabilities (extended set)
- missing permissions
- warnings
- disabled features (plain-language description of which UI functions are blocked)

Capability grouping:

**Required set** — determines whether the MVP secret listing works. Shown with green / yellow / red indicator.

| Capability | Indicator meaning |
|---|---|
| `canReadApplications` | green = app list available; red = blocked |
| `canReadApplicationSecrets` | green = secret metadata available; red = blocked |
| `canReadServicePrincipals` | yellow = optional enrichment; red = limited |
| `canReadOwners` | yellow = optional; red = owner column hidden |

**Extended set** — enables deeper analysis. Shown as available or unavailable without blocking the required set.

| Capability | Feature it controls |
|---|---|
| `canQueryLogAnalytics` | Usage Analysis tab |
| `canAnalyzeServicePrincipalSignIns` | Last-seen data in secret list |
| `canReadAzureResources` | IP-to-resource enrichment |
| `canReadKeyVaultMetadata` | Key Vault secret scanning |
| `canCreateApplicationSecrets` | Secret creation |
| `canDeleteApplicationSecrets` | Secret deletion |
| `canCreateApplications` | App Registration creation |

Each capability row shows a short plain-language label describing which UI feature it controls.

### Dashboard

Cards:

- total App Registrations
- total secrets
- expiring in 30 days
- expiring in 90 days
- expired
- without owner
- recently used
- unknown usage

### Secret List

Columns:

- risk
- app name
- client ID
- secret display name
- key ID
- hint
- expires on
- days left
- owner
- last seen
- usage status
- portal link (icon button; opens the App Registration in Azure Portal via system browser)

Filters:

- tenant
- environment
- risk
- expiry window
- owner
- usage status
- search by app name or client ID

### Secret Detail

Sections:

- metadata (includes portal deep link to the App Registration in Azure Portal)
- expiry status
- owners
- usage analysis
- sign-in evidence
- likely locations
- remediation checklist
- history

Actions:

- Open in Azure Portal (deep link; opens in system browser)
- Send to Teams (Phase 2+; visible only when Teams webhook URL is configured for this tenant)

### Guided Rotation View

Not MVP write automation.

MVP can provide manual checklist:

1. Create new secret in Entra.
2. Store new secret safely.
3. Update consumers.
4. Trigger smoke tests.
5. Watch old key ID usage.
6. Remove old secret after safe waiting period.

### History

Stores:

- scan timestamp
- tenant/environment
- app count
- secret count
- findings
- preflight result
- usage summaries
- changes since previous scan

## Capability-Based UI

The UI must use the preflight result.

Examples:

| Missing Capability | UI Behavior |
|---|---|
| Cannot read applications | Dashboard blocked with setup guidance |
| Cannot read owners | Owner filter hidden |
| Cannot query Log Analytics | Usage tab disabled |
| Cannot create secrets | Rotation automation hidden |
| Cannot delete secrets | Old-secret removal hidden |

## Local Storage

Decided by OQ-021 and ADR-0004:

| Phase | Storage | Purpose |
|---|---|---|
| Phase 1 (MVP) | JSON files | Scan results, history, tenant profiles |
| Phase 2 | SQLite | Queryable history, diff comparisons, advanced reporting |
| Both phases | OS credential store | Sensitive credential values (client secret key material) |

No clear-text secrets in local app settings or JSON files.

## System Tray

The app runs in the background after the main window is closed.

A system tray icon provides a minimal context menu. Candidate entries:

- Open
- Run Scan (all tenants)
- Show Expiring Secrets
- Exit

Tray behavior is confirmed MVP scope (decided by OQ-043).

## CLI Location Strategy

Decided by ADR-0007.

The MAUI app locates the CLI at runtime via `ICliLocatorService`.

### Bundle layout (release)

```text
cli/
  node.exe                          ← Node.js LTS, Windows x64 (~25 MB)
  aarm.js                           ← esbuild output of packages/cli
  node_modules/
    keytar/
      package.json
      index.js
      build/Release/keytar.node     ← pre-built Windows x64 native addon
```

### Invocation

```text
<cli-dir>\node.exe <cli-dir>\aarm.js [command] [args]
```

### ICliLocatorService

| Mode | Resolution |
|---|---|
| Debug | `Cli:ExecutablePath` in `appsettings.Development.json` — points to `packages/cli/dist/aarm.js`; uses system Node.js |
| Release | `AppContext.BaseDirectory\cli\node.exe` and `AppContext.BaseDirectory\cli\aarm.js` |

Methods:

- `GetNodePath()` — absolute path to `node.exe`
- `GetCliScriptPath()` — absolute path to `aarm.js`
- `IsCliAvailable()` — `true` if both files exist at the resolved paths

If the CLI is not found at startup, the app shows a setup guidance screen and blocks scanning until resolved.

### Build automation

A MSBuild `Target` in `apps/maui-blazor/` runs before the MAUI build and:

1. Runs `npm run build` in `packages/cli/` (esbuild → `dist/aarm.js`).
2. Copies `aarm.js` to `Resources/Cli/`.
3. Copies `node.exe` from a pinned Node.js LTS download or local cache.
4. Copies `keytar/` files from `packages/cli/node_modules/keytar/`.

## App Startup Initialization

`AppInitializationService` runs before the first page renders (invoked from `App.xaml.cs` or `MauiProgram.cs`).

Responsibilities:

- create required local directories (config cache, history folder)
- create default config files if absent
- verify the CLI binary is accessible via `ICliLocatorService`
- load the most recent `PreflightResult` for each configured tenant from local storage
- initialize capability flags in `AppStateService` so the UI gates features correctly without waiting for a new preflight run

## Global Application State

`AppStateService` is registered as a singleton in the DI container.

Responsibilities:

- hold the currently selected `TenantProfile` and `EnvironmentProfile`
- expose `ActiveTenant` and `ActiveEnvironment` properties
- raise an `OnChange` event when the selection changes
- persist the last-active tenant/environment selection so navigation between pages stays consistent

Usage pattern in pages:

- `@inject AppStateService AppState`
- subscribe to `AppState.OnChange` in `OnInitialized`
- call `StateHasChanged()` in the handler
- unsubscribe in `Dispose()`

## Connection Method Help Text

The Tenant Add / Edit form shows inline help text below the currently selected authentication mode.

| Mode | Help text |
|---|---|
| Client Secret | Enter the Client ID and the secret value. The secret is stored in Windows Credential Manager — never in plain files. |
| Interactive Browser | The app opens a browser window for login. A localhost redirect URI must be registered on the App Registration. |
| Device Code | A code appears in the app. Open `microsoft.com/devicelogin` in any browser and enter the code. No redirect URI needed. |
| Azure CLI | Requires `az` CLI installed and an active `az login` session. No Client ID or secret needed in the app. |
| Certificate | Enter the certificate thumbprint and file path. The private key must be accessible on this machine. (Post-MVP) |

Help text renders as a small info block below the selected option — not as a tooltip.

## Azure Portal Deep Links

The Secret List and Secret Detail screens provide an icon link that opens the App Registration directly in the Azure Portal.

URL pattern:

```text
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/{clientId}
```

Opens via `Launcher.OpenAsync(url)` in the system browser.

This is an MVP feature. No active Azure Portal session is assumed — the user must be separately logged into the portal.

## Teams Webhook Notification

Phase 2+ feature.

If a Teams incoming webhook URL is stored in the tenant profile, the user can push secret status information to a Teams channel.

| Trigger | Content |
|---|---|
| Secret List — "Send to Teams" button | Summary of all secrets for the selected tenant as an Adaptive Card |
| Secret Detail — "Notify" button | Status of a single secret as an Adaptive Card |

Adaptive Card format is preferred over plain Markdown for structured Teams display.

Card content:

- tenant name and environment
- timestamp
- per-secret: display name, expiry date, risk level, days remaining
- link to open the tool

Storage: the webhook URL is a plain non-secret configuration value stored in the tenant profile JSON file. It does not go to the OS credential store.
