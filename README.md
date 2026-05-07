# Azure App Registration Secret Monitor (AARM)

Monitor, analyze and manage Entra App Registration client secrets — before they expire and break production.

## What this is

Three applications that work together:

| Component | What it does |
|---|---|
| **`aarm` CLI** (`packages/cli`) | Reads App Registrations and secrets from Microsoft Graph, runs preflight capability checks, analyzes usage via Log Analytics, produces stable JSON output |
| **MAUI Blazor UI** (`apps/maui-blazor`) | Windows desktop app — supports two modes: **Local** (invokes bundled CLI) or **Cloud** (calls Azure Function API) |
| **Azure Function** (`apps/azure-function`) | Cloud scanning engine — scheduled scans, Azure Blob Storage for results, Teams notifications, REST API for MAUI Cloud Mode and browser dashboard |

---

## Quick Start

### Option A — MAUI app (recommended for most users)

1. Open `apps/maui-blazor/src/AzureAppRegistrationMonitor/AzureAppRegistrationMonitor.csproj` in Visual Studio 2022.
2. Press **F5** to run in debug mode.
3. Click **+ Add Tenant** on the home screen and follow the form.

The MAUI app detects the CLI automatically (see [CLI resolution order](#cli-resolution-order)).
In debug mode, point it to your local `dist/` folder via **Settings → CLI path override**.

### Option B — CLI only

```bash
# Install globally via npm
npm install -g @brunsforge/aarm

# Add a tenant
aarm tenants add

# List secrets
aarm secrets list --tenant "Contoso PROD"

# Run preflight
aarm preflight run --tenant "Contoso PROD"
```

---

## Prerequisites

| Requirement | Why |
|---|---|
| Node.js ≥ 20 | CLI runtime |
| npm ≥ 10 | Package manager |
| .NET 10 SDK | MAUI build |
| Visual Studio 2022 ≥ 17.12 with MAUI workload | UI development |
| Windows 10 19041+ | MAUI target platform |

---

## Repository Structure

```
AzureAppRegistrationSecretMonitor/
  packages/
    core/             # npm library  (@brunsforge/azure-app-registration-monitor)
    cli/              # CLI binary   (aarm)
  apps/
    maui-blazor/      # .NET MAUI Blazor desktop application (Local + Cloud Mode)
    azure-function/   # Azure Function cloud scanning engine
  infra/              # Bicep templates for Azure infrastructure deployment
  scripts/            # Local publish and build automation (publish-local.ps1)
  tools/
    postman/          # Postman collection + environment for the Azure Function API
  concept/            # Planning and architecture documents
  decisions/          # Architecture Decision Records
  references/         # Durable conventions and factual notes
```

---

## CLI Installation

### Global install (standalone use)

```bash
npm install -g @brunsforge/aarm
aarm --version
```

The binary lands at `%APPDATA%\npm\aarm.cmd` on Windows.

### Development build (from source)

```bash
cd packages/core
npm install
npm run build

cd ../cli
npm install
npm run build
# Output: packages/cli/dist/index.js
```

Run without installing:

```bash
node packages/cli/dist/index.js --version
```

### MAUI bundled

When the MAUI app is installed (Release build), the CLI is bundled alongside it.
Debug builds use the **CLI path override** setting (see below).

---

## Config file locations

All config files live under `~/.aarm/` (`C:\Users\<you>\.aarm\` on Windows):

```
~/.aarm/
  tenants.json          # Tenant profiles (shared between CLI and MAUI app)
  ui-settings.json      # MAUI-only UI preferences (default tenant, Teams webhook, etc.)
  history/              # Scan history JSON files (one per scan, per tenant/environment)
```

Sensitive credentials (client secrets, passwords) are stored in **Windows Credential Manager** — never in plain files.

---

## Tenant Management

### From the MAUI UI

Open the **Tenants** page (home screen). Click **+ Add Tenant** and fill in the form:

| Field | Required | Notes |
|---|---|---|
| Display name | Yes | Free text, shown in all dropdowns |
| Tenant ID | Yes | Azure Entra tenant GUID |
| Auth mode | Yes | See [Auth modes](#auth-modes) |
| Client ID | Yes (except azure-cli) | App Registration GUID used for auth |
| Client Secret | Yes (client-secret mode) | Stored in Windows Credential Manager |
| Username | Yes (username-password mode) | UPN or email address |
| Password | Yes (username-password mode) | Stored in Windows Credential Manager |
| Log Analytics Workspace ID | No | Required for Usage Analysis |

Click **✏** to edit or **✕** to delete a tenant. Deleting also removes the stored credentials from Windows Credential Manager.

### From the CLI

```bash
# Interactive wizard (prompts for all fields)
aarm tenants add

# Non-interactive (client-secret mode, secret from env var)
AARM_CLIENT_SECRET=<value> aarm tenants add \
  --tenant-id <guid> \
  --display-name "Contoso PROD" \
  --auth-mode client-secret \
  --client-id <guid>

# List configured tenants
aarm tenants list

# Remove a tenant
aarm tenants remove "Contoso PROD"

# Validate auth (quick connectivity check)
aarm tenants validate --tenant "Contoso PROD"
```

---

## Auth Modes

### `interactive-browser` (recommended for users with MFA)

Opens a browser window for sign-in. Requires a `http://localhost` redirect URI registered on the App Registration.

**In Azure Portal:** App Registration → Authentication → Add platform → Web → `http://localhost`

```bash
aarm tenants add --auth-mode interactive-browser --client-id <guid> --tenant-id <guid>
```

### `device-code` (MFA-compatible, no redirect URI)

Shows a code in the terminal / app. User goes to `microsoft.com/devicelogin` and enters the code.

```bash
aarm tenants add --auth-mode device-code --client-id <guid> --tenant-id <guid>
```

### `azure-cli`

Reuses the token from an existing `az login` session. No client ID or secret needed in AARM.

**Prerequisites:** Azure CLI installed, `az login --tenant <tenant-id>` already run.

```bash
az login --tenant <tenant-id>
aarm tenants add --auth-mode azure-cli --tenant-id <guid> --display-name "Contoso"
```

### `client-secret` (service principals / automation)

App-only authentication with a client ID and secret. The secret value is stored in Windows Credential Manager.

**Minimum required permission:** `Application.Read.All` (application permission, requires admin consent).

```bash
aarm tenants add --auth-mode client-secret \
  --client-id <guid> \
  --tenant-id <guid>
# Secret is prompted interactively (hidden input)
# Or pass via env var: AARM_CLIENT_SECRET=<value> aarm tenants add ...
```

### `username-password` ⚠ Not recommended

Resource Owner Password Credentials (ROPC). Does not support MFA. Use `device-code` for accounts with MFA.

---

## CLI Commands Reference

### Preflight

```bash
aarm preflight run   --tenant "Contoso PROD"
aarm preflight show  --tenant "Contoso PROD"    # cached result, no network call
aarm preflight explain --tenant "Contoso PROD"  # per-permission grant instructions
```

### Apps & Secrets

```bash
aarm apps list                                 --tenant "Contoso PROD"
aarm secrets list                              --tenant "Contoso PROD"
aarm secrets expiring --days 30                --tenant "Contoso PROD"
aarm secrets expiring --months 3               --tenant "Contoso PROD"
aarm secrets expired                           --tenant "Contoso PROD"
```

### Usage Analysis (requires Log Analytics Workspace ID)

```bash
aarm usage analyze        --tenant "Contoso PROD" --app-id <client-id> --days 90
aarm usage analyze        --tenant "Contoso PROD" --app-name "CRM Connector"
aarm usage analyze-secret --tenant "Contoso PROD" --key-id <key-id> --days 90
aarm usage last-seen      --tenant "Contoso PROD" --app-id <client-id>
aarm usage rotation-check --tenant "Contoso PROD" --app-id <client-id> --old-key-id <key-id> --days 14
```

### Reports

```bash
aarm report expiring       --tenant "Contoso PROD" --months 3 --output markdown
aarm report findings       --tenant "Contoso PROD" --severity high --output csv
aarm report tenant-summary --tenant "Contoso PROD" --output json
aarm report rotation-guide --tenant "Contoso PROD" --app-id <client-id> --key-id <key-id>
```

### Global options

```bash
--tenant <name-or-id>    # Tenant display name or ID from local config
--output table|json      # Output format (table = default, json for automation)
--config-dir <path>      # Override ~/.aarm (useful for testing or multi-user setups)
--verbose                # Verbose output
```

---

## Debug Mode (MAUI)

In Visual Studio debug mode, the MAUI app cannot use the bundled CLI (no Release bundle exists yet). Point it to your local build:

**Option 1 — Settings page (recommended)**

1. Run the app in debug mode (F5).
2. Go to **Settings → CLI path override**.
3. Enter the full path to your local `dist/index.js`:

   ```
   C:\Daten\source\AzureAppRegistrationSecretMonitor\packages\cli\dist\index.js
   ```

4. Click **Save preferences**. The app picks this up immediately.

**Option 2 — Environment variable (before launching)**

Set `AARM_CLI_PATH` before starting the app:

```powershell
$env:AARM_CLI_PATH = "C:\Daten\source\AzureAppRegistrationSecretMonitor\packages\cli\dist\index.js"
```

Or add it to your user environment variables in Windows Settings → System → About → Advanced system settings.

**Option 3 — Globally installed CLI**

```bash
cd packages/cli
npm run build
npm link          # makes 'aarm' available on PATH
```

The app finds `aarm.cmd` at `%APPDATA%\npm\aarm.cmd` automatically.

---

## CLI Resolution Order

The MAUI app resolves the CLI binary in this order on every command:

1. `aarm.cmd` / `aarm.exe` alongside the MAUI executable (bundled production install)
2. `%APPDATA%\npm\aarm.cmd` (npm global install on Windows)
3. **Settings → CLI path override** → invokes as `node <path>`
4. `AARM_CLI_PATH` environment variable → invokes as `node <path>`
5. `aarm` on `PATH` (npm link or other)

---

## Minimum Required Permissions

| What you want | Permission needed |
|---|---|
| List App Registrations and secrets | `Application.Read.All` (application) |
| Read service principals | `Application.Read.All` or `Directory.Read.All` |
| Read owners | `Directory.Read.All` |
| Query Log Analytics | Log Analytics Reader or Monitoring Reader (Azure RBAC on workspace) |
| Create/delete secrets | `Application.ReadWrite.All` (post-MVP, admin consent required) |

Run `aarm preflight explain --tenant <name>` for step-by-step grant instructions.

---

## Development

```bash
# Install all workspace dependencies
npm install

# Build core library
cd packages/core && npm run build

# Build CLI
cd packages/cli && npm run build

# Run tests
npm test --workspaces

# Type-check only (no output)
npx tsc --noEmit
```

---

## Architecture

The MAUI app invokes the CLI as a child process and reads JSON from stdout.
No HTTP bridge, no embedded Node.js in the MAUI app for MVP.

See [decisions/ADR-0002-maui-consumes-cli-json.md](decisions/ADR-0002-maui-consumes-cli-json.md) and [decisions/ADR-0007-cli-bundling-for-maui.md](decisions/ADR-0007-cli-bundling-for-maui.md) for the rationale and bundling strategy.
