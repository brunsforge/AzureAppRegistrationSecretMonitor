# aarm — Azure App Registration Monitor CLI

Command-line tool for monitoring Microsoft Entra App Registration client secrets. Lists all secrets across a tenant, identifies expiring and expired ones, assesses risk, and runs preflight checks to detect which permissions are available.

## What is aarm?

Client secrets on Microsoft Entra App Registrations expire silently. There is no built-in Microsoft view that shows all expiring secrets across a tenant, and there is no automatic renewal notification. Authentication failures caused by expired secrets are often discovered only after a production outage.

`aarm` solves this by:

- Authenticating against a tenant using the auth mode you choose (client secret, device code, interactive browser, certificate, or Azure CLI)
- Querying Microsoft Graph to list all App Registrations and their `passwordCredentials`
- Calculating expiry status and risk level for every secret
- Reporting findings as a readable table or as stable JSON for automation

It is part of the **Azure App Registration Monitor (AARM)** toolchain. The same core engine is used by the [AARM desktop UI](../../apps/maui-blazor/README.md). The CLI is independently useful in CI/CD pipelines, scheduled monitoring jobs, and on developer workstations.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js | ≥ 18 |
| Microsoft Entra App Registration | Used to authenticate — must have admin consent granted |
| Graph permissions | At minimum: `Application.Read.All` (application permission) |

### Minimum permissions

```
Microsoft Graph API (application permissions):
  Application.Read.All   — required for listing apps and secrets
  Directory.Read.All     — optional, needed for reading owners
```

> All application permissions require admin consent from a **Global Administrator** or **Privileged Role Administrator**.

---

## Installation

```bash
npm install -g @brunsforge/aarm
```

After installation, the `aarm` binary is available on your PATH:

```bash
aarm --version
```

---

## How authentication works — the two App Registrations

Before reading the mode details, understand the two distinct App Registrations involved:

```
Your Entra tenant
│
├── App Registration: "aarm"                  ← YOU CREATE THIS ONCE
│     This is aarm's own identity.
│     It holds the permissions to call Graph.
│     Its client-id is what you set via --client-id when running "aarm tenants add".
│
├── App Registration: "CRM Connector"         ┐
├── App Registration: "Teams Bot"             ├── aarm READS THESE — do not touch them
└── App Registration: "Export Worker"         ┘
```

**You only need one "aarm" App Registration per tenant, regardless of auth mode.**

The auth mode only changes how `aarm` proves its identity to Entra when requesting a token. Once the token is issued, `aarm` uses it to call `GET /applications` and `GET /applications/{id}/passwordCredentials` to list all the other App Registrations and their secrets.

### Permission types: Application vs Delegated

Which permission type you need depends on the auth mode:

| Permission type | Auth modes that use it | What it means |
|---|---|---|
| **Application** | `client-secret`, `certificate` | `aarm` acts as itself (service principal). No user is involved. Can read everything if admin-consented. |
| **Delegated** | `device-code`, `username-password`, `interactive-browser` | `aarm` acts on behalf of the signed-in user. Access depends on the user's Entra roles. |
| **Neither** | `azure-cli` | Uses the token from `az login` directly. No separate App Registration required. |

> For **Delegated** modes, the signed-in user must have the **Cloud Application Administrator** or **Application Administrator** role in Entra to be able to read all App Registrations across the tenant. A regular user without these roles can only read apps they own.

---

## Authentication modes — configuration reference

This section is critical. Picking the wrong mode causes the "az command not available" or "no token" errors you see on the first run.

### Mode comparison

| Mode | Who signs in | MFA support | Needs `az` CLI | Needs App Registration | Best for |
|---|---|---|---|---|---|
| `client-secret` | Service principal | N/A | No | Yes | CI/CD, automation, unattended |
| `username-password` | Your Entra user account (email + password) | **No** | No | Yes | Quick local access when no MFA is enforced |
| `device-code` | Your Entra user account (browser) | **Yes** | No | Yes | Interactive use, developer workstations |
| `interactive-browser` | Your Entra user account (browser redirect) | **Yes** | No | Yes | Desktop tools with localhost redirect |
| `certificate` | Service principal | N/A | No | Yes | High-security automated deployments |
| `azure-cli` | Reuses existing `az login` session | **Yes** | **Yes** | No | Developers who already use Azure CLI |
| `workload-identity-federation` | Managed Identity (Azure-hosted only) | N/A | No | Yes | **Not supported in the CLI.** Azure Function / VM only. |

> **`workload-identity-federation` is supported by the underlying library (`@brunsforge/azure-app-registration-monitor`) and by the AARM Azure Function, but it requires an Azure-hosted runtime (Function App, VM, ACI, AKS) and cannot be used with the `aarm` CLI on a developer workstation. Use `client-secret` or `certificate` for unattended automation, or `device-code` for interactive local use.

> **If you just got "az command not available":** your tenant is configured as `azure-cli` but the Azure CLI is not installed. Remove the tenant and re-add it with `device-code` or `username-password`.

---

## App Registration setup — complete Azure Portal reference

aarm needs **one App Registration** in each Entra tenant it monitors. This registration is aarm's own identity — it is separate from all the App Registrations that aarm reads and monitors.

```
Your Entra tenant
│
├── "aarm"                ← you create this once per tenant
│     → holds permissions to call Microsoft Graph
│     → its client-id is what you set with aarm tenants add
│
├── "CRM Connector"       ┐
├── "Teams Bot"           ├─ aarm reads and monitors these
└── "Export Worker"       ┘    (you never touch them for the setup)
```

The auth mode determines whether the token is issued to a **service principal** (application modes: `client-secret`, `certificate`) or to a **signed-in user** (delegated modes: `device-code`, `username-password`, `interactive-browser`, `azure-cli`). This matters because the required permission type and the error messages differ.

### Which permission type do I need?

| Auth mode | Token identity | Graph permission type | User role required? |
|---|---|---|---|
| `device-code` | Signed-in user | **Delegated** | Yes — Cloud App Admin |
| `username-password` | Signed-in user | **Delegated** | Yes — Cloud App Admin |
| `interactive-browser` | Signed-in user | **Delegated** | Yes — Cloud App Admin |
| `azure-cli` | Signed-in user (via az) | **Delegated** | Yes — Cloud App Admin |
| `client-secret` | Service principal | **Application** | No |
| `certificate` | Service principal | **Application** | No |

> **Why does the user role matter for delegated modes?**  
> With delegated `Application.Read.All`, Entra checks both the permission grant *and* whether the signed-in user has an Entra directory role that allows reading all App Registrations. Without **Cloud Application Administrator** or **Application Administrator**, the user can only see apps they personally own — not all apps in the tenant.  
> Application permissions (service principal) do not have this restriction: if admin consent is granted, the service principal can read all apps regardless of who created them.
---
### Recommended app registration setup

For local/user-based modes, create one public client app registration:

**AzureAppRegistrationSecretMonitor.PublicClient**
- Used by: device-code, interactive-browser, username-password
- Secret: none
- Certificate: none
- Redirect URI: `http://localhost` for interactive-browser
- Allow public client flows: Yes
- Microsoft Graph delegated permissions:
  - Application.Read.All
  - optionally Directory.Read.All for extended directory/owner checks
- The signed-in user still needs a suitable Entra directory role.

For automation modes, create one daemon app registration:

**AzureAppRegistrationSecretMonitor.Daemon**
- Used by: client-secret, certificate
- Redirect URI: none
- Allow public client flows: No
- Credential:
  - client-secret mode: client secret
  - certificate mode: uploaded certificate
- Microsoft Graph application permissions:
  - Application.Read.All for read-only monitoring
  - Application.ReadWrite.OwnedBy or Application.ReadWrite.All for secret rotation
- Admin consent is required.
---

### Modes A: `device-code` and `username-password` — delegated (interactive user)

Both modes sign in as *you*, the user. **One App Registration covers both** — you can switch between modes without recreating the registration.

> ⚠ **`username-password` only:** does not work if your account has MFA enabled, is a federated account (ADFS, Google etc.) or is a personal Microsoft account (@outlook.com). Use `device-code` instead in those cases.

#### 1. Create the App Registration

- **Azure Portal → Entra ID → App registrations → New registration**
- **Name:** `aarm` (any name)
- **Supported account types:** *Accounts in this organizational directory only*
- **Redirect URI:** leave empty
- Click **Register** — note the **Application (client) ID** shown on the Overview page

#### 2. Enable public client flows

- Go to **Authentication** tab
- Under *Advanced settings* → **Allow public client flows** → toggle **Yes**
- Click **Save**

#### 3. Add Graph permissions (delegated)

- Go to **API permissions** tab
- **Add a permission → Microsoft Graph → Delegated permissions**
- Select:
  - `Application.Read.All` — required to list all App Registrations and their secrets
  - `Directory.Read.All` — optional, needed to resolve application owners
- Click **Grant admin consent for [your org]** — requires a Global Administrator

#### 4. Assign a directory role to your user account

- Go to **Entra ID → Roles and administrators**
- Find and open **Cloud Application Administrator** (or **Application Administrator**)
- Click **Add assignments** → select your user
- Without this role, delegated `Application.Read.All` only shows apps you personally own

#### 5a. Add tenant — `device-code` (MFA supported ✅)

```powershell
aarm tenants add `
  --tenant-id   "<tenant-id-guid>" `
  --display-name "Contoso" `
  --auth-mode   device-code `
  --client-id   "<application-client-id-from-step-1>"
```

First time you run a command, `aarm` prints:
```
To sign in, open https://microsoft.com/devicelogin and enter code ABCDE12345
```
Open the URL, enter the code, sign in normally (email, password, MFA if required). Token cached afterwards.

#### 5b. Add tenant — `username-password` (no MFA ⚠)

```powershell
aarm tenants add `
  --tenant-id   "<tenant-id-guid>" `
  --display-name "Contoso" `
  --auth-mode   username-password `
  --client-id   "<application-client-id-from-step-1>"
# Prompts: Username (full UPN e.g. you@contoso.com) and Password (hidden)
```

Password is stored in **Windows Credential Manager** — never in a plain JSON file.

---

### Mode B: `client-secret` — application permission, no user (unattended)

Used for CI/CD pipelines, scheduled jobs, or any scenario without an interactive user. `aarm` acts as a service principal — no directory role assignment needed.

#### 1. Create the App Registration

- **Azure Portal → Entra ID → App registrations → New registration**
- **Name:** `aarm-automation` (any name)
- **Redirect URI:** leave empty
- Click **Register** — note the **Application (client) ID**

#### 2. Add Graph permissions (application, not delegated)

- Go to **API permissions** tab
- **Add a permission → Microsoft Graph → Application permissions**
- Select:
  - `Application.Read.All` — required
  - `Directory.Read.All` — optional (for owner resolution)
- Click **Grant admin consent for [your org]** — requires a Global Administrator

#### 3. Create a client secret

- Go to **Certificates & secrets** tab
- Click **New client secret** — set an expiry — click **Add**
- **Copy the secret value immediately** — it is only shown once

#### 4. Add tenant

```powershell
aarm tenants add `
  --tenant-id   "<tenant-id-guid>" `
  --display-name "Contoso (automation)" `
  --auth-mode   client-secret `
  --client-id   "<application-client-id-from-step-1>"
# Prompts: Client Secret (hidden) — paste the value from step 3
```

Secret is stored in Windows Credential Manager.

---

### Mode C: `certificate` — application permission with certificate (high security)

Same as Mode B but uses a certificate instead of a client secret. No secret value to rotate manually.

**Steps 1–2 are identical to Mode B.**

#### 3. Upload a certificate

- Go to **Certificates & secrets** tab
- Click **Upload certificate** — upload your `.cer` or `.pem` (public key)
- Keep the `.pfx` or `.pem` private key file locally — `aarm` will need the file path

#### 4. Add tenant

```powershell
aarm tenants add `
  --tenant-id   "<tenant-id-guid>" `
  --display-name "Contoso (cert)" `
  --auth-mode   certificate `
  --client-id   "<application-client-id-from-step-1>"
# Prompts: Client ID path (certificate path support in interactive add is planned)
```

---

### Mode D: `azure-cli` — reuse `az login`, no App Registration needed

No App Registration for `aarm` is required. `aarm` delegates to the Azure CLI token cache. The signed-in user still needs **Cloud Application Administrator** or **Application Administrator** to read all apps (same as delegated modes).

#### 1. Install the Azure CLI

```powershell
winget install Microsoft.AzureCLI
```

#### 2. Sign in

```powershell
az login
# A browser opens — sign in with email + password + MFA
```

#### 3. Add tenant (no client-id needed)

```powershell
aarm tenants add `
  --tenant-id   "<tenant-id-guid>" `
  --display-name "Contoso" `
  --auth-mode   azure-cli
# No client secret or password stored — uses az token cache
```

---

### Quick reference — which permissions go where

| Mode | Permission tab in Portal | Permission type | `Allow public client flows` |
|---|---|---|---|
| `device-code` | API permissions | **Delegated** | **Yes** |
| `username-password` | API permissions | **Delegated** | **Yes** |
| `client-secret` | API permissions | **Application** | Not needed |
| `certificate` | API permissions | **Application** | Not needed |
| `azure-cli` | — (no App Registration) | — | — |

---

### Reconfiguring a tenant's auth mode

```powershell
aarm tenants remove "Contoso"
aarm tenants add   # choose the new mode interactively
```

---

## Setup: Adding your first tenant

Every `aarm` command operates against a named tenant. Add a tenant once and all subsequent commands can reference it by name.

### Option A — interactive setup

```bash
aarm tenants add
```

The command prompts you for all required values:

```
Tenant ID (GUID): xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Display name: Contoso PROD
Auth mode (client-secret/device-code/interactive-browser/certificate/azure-cli): client-secret
Client ID (App Registration GUID): xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Client Secret (hidden): ****
Log Analytics Workspace ID (optional, press Enter to skip):
```

The client secret is stored in **Windows Credential Manager** via the OS credential store. It is never written to a plain JSON file.

### Option B — with flags

```bash
aarm tenants add \
  --tenant-id  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  --display-name "Contoso PROD" \
  --auth-mode client-secret \
  --client-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# aarm then prompts for the client secret
```

### Non-secret auth modes (no credential stored)

```bash
aarm tenants add \
  --tenant-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  --display-name "Contoso DEV" \
  --auth-mode device-code \
  --client-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

With `device-code` or `interactive-browser`, no client secret is stored. Authentication is triggered interactively the first time a command runs.

---

## Global options

These options apply to all commands:

| Option | Description | Default |
|---|---|---|
| `--tenant <name-or-id>` | Tenant display name or tenant ID to operate on | — |
| `--environment <name>` | Environment name (reserved for future use) | — |
| `--config-dir <path>` | Override the config directory | `~/.aarm` |
| `--output <format>` | Output format: `table`, `json` | `table` |
| `--verbose` | Enable verbose/debug output | `false` |
| `--no-color` | Disable colour in terminal output | `false` |
| `--version` | Print version | — |
| `--help` | Show help for any command | — |

---

## Command reference

### `aarm tenants`

Manage the list of configured tenants.

#### `aarm tenants list`

List all configured tenants.

```bash
aarm tenants list
aarm tenants list --output json
```

Output (table):
```
┌─────────────────┬──────────────────────────────────────┬───────────────────┬────────────┬────────────┐
│ Name            │ Tenant ID                            │ Auth Mode         │ Client ID  │ Last Scan  │
├─────────────────┼──────────────────────────────────────┼───────────────────┼────────────┼────────────┤
│ Contoso PROD    │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │ client-secret     │ xxxxxxxx…  │ 01/05/2026 │
│ Contoso DEV     │ yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy │ device-code       │ yyyyyyyy…  │ Never      │
└─────────────────┴──────────────────────────────────────┴───────────────────┴────────────┴────────────┘
```

#### `aarm tenants add`

Add or update a tenant. Runs interactively when flags are omitted.

```bash
aarm tenants add [options]
```

| Option | Description |
|---|---|
| `--tenant-id <id>` | Entra tenant ID (GUID) |
| `--display-name <name>` | Friendly label for this tenant |
| `--auth-mode <mode>` | `client-secret`, `device-code`, `interactive-browser`, `certificate`, `azure-cli`, `username-password` |
| `--client-id <id>` | App Registration client ID (not needed for `azure-cli`) |
| `--username <email>` | UPN / email address — only for `username-password` mode |
| `--workspace-id <id>` | Log Analytics workspace ID (optional) |

#### `aarm tenants remove <name-or-id>`

Remove a configured tenant.

```bash
aarm tenants remove "Contoso DEV"
aarm tenants remove "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

### `aarm preflight`

Run capability checks and display what the current tenant configuration can do.

#### `aarm preflight run`

Authenticate, reach Microsoft Graph, and check each permission individually. Reports which capabilities are available and which permissions are missing.

```bash
aarm --tenant "Contoso PROD" preflight run
aarm --tenant "Contoso PROD" preflight run --output json
```

Output (table):
```
Preflight — xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Environment : prod
Checked at  : 2026-05-01T12:00:00.000Z

Authentication  : OK
Graph reachable : OK

Capabilities
┌────────────────────────────────────┬──────────────────────────────┐
│ Capability                         │ Status                       │
├────────────────────────────────────┼──────────────────────────────┤
│ canReadApplications                │ [✓] Available                │
│ canReadApplicationSecrets          │ [✓] Available                │
│ canReadServicePrincipals           │ [✓] Available                │
│ canReadOwners                      │ [ ] Unavailable              │
│ canReadDirectory                   │ [ ] Unavailable              │
│ canQueryLogAnalytics               │ [ ] Unavailable              │
...

Missing permissions
  ✗ Delegated permission missing: Directory.Read.All (admin consent required)
  ✗ Azure RBAC missing: assign Log Analytics Reader to the signed-in user on the workspace

Warnings
  ! No Log Analytics workspace configured for this environment.
```

JSON output follows the standard result envelope:

```json
{
  "success": true,
  "metadata": { "tenantId": "...", "environmentName": "prod", ... },
  "data": {
    "authValid": true,
    "graphReachable": true,
    "capabilities": {
      "canReadApplications": true,
      "canReadApplicationSecrets": true,
      "canReadOwners": false,
      ...
    },
    "missingPermissions": ["Microsoft Graph: Directory.Read.All"],
    "warnings": [],
    "errors": []
  },
  "warnings": [],
  "errors": []
}
```

#### `aarm preflight show`

Show the last cached preflight result (available after Phase 5 — local history).

```bash
aarm --tenant "Contoso PROD" preflight show
```

#### `aarm preflight explain`

Print a human-readable list of every permission `aarm` may need. Output is mode-aware: pass `--tenant` to see only the hints relevant to your configured auth mode.

```bash
# Show hints for all modes (both application and delegated)
aarm preflight explain

# Show only the hints relevant to the auth mode of a specific tenant
aarm --tenant "Contoso PROD" preflight explain
```

Output with `--tenant` (delegated mode example):
```
Delegated modes  (device-code · username-password · interactive-browser · azure-cli)
────────────────────────────────────────────────────────────────────────

  canReadApplications [admin consent] [user role]
    Delegated permission missing or user role missing:
    API permissions → Microsoft Graph → Delegated → Application.Read.All (admin consent required)
    AND signed-in user must have Cloud Application Administrator or Application Administrator role

  canReadOwners [admin consent]
    Delegated permission missing: Directory.Read.All (admin consent required)

  canQueryLogAnalytics
    Azure RBAC missing: assign Log Analytics Reader to the signed-in user on the workspace

  canCreateApplicationSecrets [post-MVP] [admin consent] [user role]
    Delegated permission missing or user role missing:
    Application.ReadWrite.All (admin consent required) AND Application Administrator role
...
```

---

### `aarm apps`

Query App Registrations.

#### `aarm apps list`

List all App Registrations in the tenant with a risk summary.

```bash
aarm --tenant "Contoso PROD" apps list
aarm --tenant "Contoso PROD" apps list --include-owners
aarm --tenant "Contoso PROD" apps list --output json
```

| Option | Description |
|---|---|
| `--include-owners` | Resolve owners per app. Requires `Directory.Read.All`. |

Output (table):
```
┌──────────┬────────────────────┬──────────────┬─────────┬─────────┬──────────┐
│ Risk     │ App Name           │ Client ID    │ Secrets │ Expired │ Expiring │
├──────────┼────────────────────┼──────────────┼─────────┼─────────┼──────────┤
│ CRITICAL │ Export Worker      │ xxxxxxxx…    │ 2       │ 1       │ 0        │
│ HIGH     │ CRM Connector      │ yyyyyyyy…    │ 1       │ 0       │ 1        │
│ MEDIUM   │ Teams Bot          │ zzzzzzzz…    │ 1       │ 0       │ 0        │
│ INFO     │ Test Tool          │ aaaaaaaa…    │ 1       │ 0       │ 0        │
└──────────┴────────────────────┴──────────────┴─────────┴─────────┴──────────┘
142 app registration(s)
```

---

### `aarm secrets`

Query client secrets across all App Registrations.

#### `aarm secrets list`

List all secrets in the tenant.

```bash
aarm --tenant "Contoso PROD" secrets list
aarm --tenant "Contoso PROD" secrets list --output json
```

Output (table):
```
┌──────────┬──────────────────┬─────────────┬────────────┬──────┬─────────────┐
│ Risk     │ App              │ Secret      │ Expires    │ Days │ Status      │
├──────────┼──────────────────┼─────────────┼────────────┼──────┼─────────────┤
│ CRITICAL │ Export Worker    │ prod-secret │ expired    │ -4   │ Expired     │
│ HIGH     │ CRM Connector    │ crm-prod    │ 21/05/2026 │ 21   │ ExpiringSoon│
│ MEDIUM   │ Teams Bot        │ bot-secret  │ 10/07/2026 │ 71   │ Valid       │
│ INFO     │ Test Tool        │ dev-secret  │ 01/11/2026 │ 185  │ Valid       │
└──────────┴──────────────────┴─────────────┴────────────┴──────┴─────────────┘
4 secret(s)
```

#### `aarm secrets expiring`

List only secrets expiring within a given window.

```bash
aarm --tenant "Contoso PROD" secrets expiring
aarm --tenant "Contoso PROD" secrets expiring --days 30
aarm --tenant "Contoso PROD" secrets expiring --months 3
aarm --tenant "Contoso PROD" secrets expiring --days 90 --output json
```

| Option | Default | Description |
|---|---|---|
| `--days <n>` | `30` | Show secrets expiring within `n` days |
| `--months <n>` | — | Show secrets expiring within `n` months (converted to `n × 30` days) |

#### `aarm secrets expired`

List only secrets that are already expired.

```bash
aarm --tenant "Contoso PROD" secrets expired
aarm --tenant "Contoso PROD" secrets expired --output json
```

---

### `aarm usage`

Analyze secret usage via Azure Monitor / Log Analytics. Requires a Log Analytics workspace with
`AADServicePrincipalSignInLogs` enabled. Configure the workspace ID when adding a tenant with
`aarm tenants add --workspace-id <id>`.

All subcommands accept `--days <n>` (default 90) to set the look-back window.

#### `aarm usage analyze`

Show overall sign-in activity for an App Registration over the look-back period.

```bash
aarm --tenant "Contoso PROD" usage analyze --app-id  "<client-id>"
aarm --tenant "Contoso PROD" usage analyze --app-name "CRM Connector"
aarm --tenant "Contoso PROD" usage analyze --app-name "CRM Connector" --days 30
aarm --tenant "Contoso PROD" usage analyze --app-id "<client-id>" --output json
```

| Option | Description |
|---|---|
| `--app-id <id>` | App Registration client ID (one of `--app-id` or `--app-name` is required) |
| `--app-name <name>` | App Registration display name (resolved via Graph) |
| `--days <n>` | Look-back window in days (default: 90) |

Output shows total, successful, and failed sign-in counts, broken down by service principal and source IP.

#### `aarm usage analyze-secret`

Show activity broken down per secret key ID — useful to identify which specific credential is used.

```bash
aarm --tenant "Contoso PROD" usage analyze-secret --app-id "<client-id>"
aarm --tenant "Contoso PROD" usage analyze-secret --app-name "CRM Connector" --days 14
```

#### `aarm usage last-seen`

Show when each secret key ID was last used (last successful sign-in timestamp).

```bash
aarm --tenant "Contoso PROD" usage last-seen --app-id "<client-id>"
```

Output includes `lastSeenAt` per key ID, making it easy to identify credentials that are still actively used before rotating them.

#### `aarm usage rotation-check`

After rotating a secret, verify that the old key ID has stopped appearing in sign-in logs.

```bash
aarm --tenant "Contoso PROD" usage rotation-check --app-id "<client-id>" --days 7
```

Returns non-zero if the old credential is still seen within the look-back window.

---

### `aarm report`

Generate reports from the current secret inventory. Report commands perform a full inventory scan and then format the output for human consumption or automation.

All subcommands accept `--output <format>` with values `table` (default), `json`, `markdown`, or `csv`.

#### `aarm report expiring`

Report all secrets expiring within a configurable window, sorted by days remaining.

```bash
aarm --tenant "Contoso PROD" report expiring
aarm --tenant "Contoso PROD" report expiring --days 30
aarm --tenant "Contoso PROD" report expiring --output markdown
aarm --tenant "Contoso PROD" report expiring --output csv
```

| Option | Default | Description |
|---|---|---|
| `--days <n>` | `30` | Report secrets expiring within `n` days |

#### `aarm report tenant-summary`

High-level summary of the entire tenant: total apps, total secrets, risk distribution.

```bash
aarm --tenant "Contoso PROD" report tenant-summary
aarm --tenant "Contoso PROD" report tenant-summary --output json
```

#### `aarm report findings`

Report all secrets at or above a minimum risk level.

```bash
aarm --tenant "Contoso PROD" report findings
aarm --tenant "Contoso PROD" report findings --min-risk high
aarm --tenant "Contoso PROD" report findings --min-risk critical --output json
```

| Option | Default | Description |
|---|---|---|
| `--min-risk <level>` | `medium` | Minimum risk level: `info`, `low`, `medium`, `high`, `critical` |

#### `aarm report rotation-guide`

Produce a rotation checklist for all secrets expiring within the look-back window.

```bash
aarm --tenant "Contoso PROD" report rotation-guide
aarm --tenant "Contoso PROD" report rotation-guide --days 14 --output markdown
```

---

## Output formats

### Table (default, human-readable)

```bash
aarm --tenant "Contoso PROD" secrets expiring --days 30
```

Colour-coded by risk: red = Critical/High, yellow = Medium, cyan = Low, dim = Info.

Disable colours with `--no-color` for use in terminals that do not support ANSI codes.

### JSON (for automation and scripts)

```bash
aarm --tenant "Contoso PROD" secrets expiring --days 30 --output json
```

All JSON output follows the standard result envelope:

```json
{
  "success": true,
  "metadata": {
    "tenantId": "<tenant-id>",
    "environmentName": "default",
    "generatedAt": "2026-05-01T12:00:00.000Z",
    "toolVersion": "0.1.0"
  },
  "data": [
    {
      "applicationObjectId": "...",
      "appId": "...",
      "appDisplayName": "CRM Connector",
      "keyId": "...",
      "displayName": "crm-prod",
      "hint": "abc",
      "startDateTime": "2025-01-15T00:00:00Z",
      "endDateTime": "2026-05-21T00:00:00Z",
      "daysUntilExpiry": 21,
      "status": "ExpiringSoon",
      "riskLevel": "High"
    }
  ],
  "warnings": [],
  "errors": []
}
```

When using JSON output:
- No spinner, colour codes, or decorative text
- Non-zero exit only for real command failures (not for findings)
- Warnings and errors are inside the envelope, not on stderr

---

## Scenarios

### Scenario 1: First-time setup

```bash
# Install
npm install -g @brunsforge/aarm

# Add your tenant (interactive)
aarm tenants add

# Check what permissions you have
aarm --tenant "Contoso PROD" preflight run

# Run a quick secret audit
aarm --tenant "Contoso PROD" secrets list
```

### Scenario 2: Daily monitoring check

```bash
# See what's expiring in the next 90 days
aarm --tenant "Contoso PROD" secrets expiring --months 3

# Find anything already expired
aarm --tenant "Contoso PROD" secrets expired
```

### Scenario 3: CI/CD pipeline integration

Use `--output json` and check the exit code:

```yaml
# GitHub Actions example
- name: Check for expired secrets
  run: |
    aarm --tenant "Contoso PROD" --output json secrets expired \
      | jq '.data | length' \
      | xargs -I{} test {} -eq 0
  env:
    AARM_CONFIG_DIR: ${{ runner.temp }}/aarm-config
```

Or use the exit code for threshold alerting (exit 10 when findings exceed threshold — planned for a future release).

### Scenario 4: Pre-rotation check

Before rotating a secret, check if the old key is still actively used:

```bash
# Check which apps have secrets expiring within 14 days
aarm --tenant "Contoso PROD" secrets expiring --days 14 --output json \
  | jq '.data[] | {app: .appDisplayName, keyId: .keyId, days: .daysUntilExpiry}'
```

After rotation, you can verify the old key is no longer used with the `usage rotation-check` command (Phase 6).

### Scenario 5: Verify permissions before onboarding a new tenant

```bash
# After registering the app and granting admin consent:
aarm tenants add --tenant-id "<new-tenant>" --display-name "New Customer" \
  --auth-mode client-secret --client-id "<client-id>"

# Immediately run preflight to confirm what's available
aarm --tenant "New Customer" preflight run
aarm preflight explain
```

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General error |
| `2` | Authentication failed (token acquisition error) |
| `3` | Missing permission or capability |
| `4` | Configuration invalid (tenant not found, missing client ID, etc.) |
| `5` | No data source available (e.g. Log Analytics not configured) |
| `10` | Findings found above configured threshold (CI threshold mode — future release) |

---

## Configuration directory

By default, `aarm` stores tenant profiles in `~/.aarm/` (Linux/macOS) or `%USERPROFILE%\.aarm\` (Windows).

```
~/.aarm/
  tenants.json     ← non-sensitive tenant profiles
```

Client secrets are stored separately in the OS credential store (Windows Credential Manager on Windows). They are never written to `tenants.json`.

Override the directory:

```bash
aarm --config-dir /etc/aarm --tenant "Contoso PROD" secrets list
```

---

## Related

| Resource | Description |
|---|---|
| [`@brunsforge/azure-app-registration-monitor`](../core/README.md) | TypeScript library used as the engine |
| [Azure App Registration Monitor (MAUI)](../../apps/maui-blazor/README.md) | Desktop UI for the same functionality |
