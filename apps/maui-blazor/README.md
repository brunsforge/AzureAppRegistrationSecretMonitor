# Azure App Registration Monitor — Desktop UI

Local Windows desktop application for monitoring Microsoft Entra App Registration client secrets. Provides a graphical interface on top of the `aarm` CLI engine.

## What does this app do?

The app lets you:

- See all configured tenants and their connection status at a glance
- Run preflight checks to understand which Graph permissions are available
- View a risk dashboard — expired secrets, expiring within 30/90 days, total counts
- Browse the full secret list with risk colour coding
- Store scan history locally (JSON files in `~/.aarm/history/`)
- Stay in the background as a system tray icon when you close the window

The app supports **two data source modes** — chosen at first launch or changed in Settings:

| Mode | How data is fetched | Where credentials are stored |
|---|---|---|
| **Local Mode** | Invokes the bundled `aarm` CLI as a child process | Windows Credential Manager (local) |
| **Cloud Mode** | Calls the AARM Azure Function REST API | Azure Key Vault (managed by the function) |

---

## Startup mode selection

On first launch the app shows a **mode selection screen**:

- **Local Mode** — no further setup required; the bundled CLI is used automatically.
- **Cloud Mode** — enter the Azure Function base URI and function key. A test connection confirms the setup before proceeding.

The selected mode is persisted. To change it later: open **Settings → Change mode…**.

---

## How it integrates with its data source

### Local Mode

```
MAUI Blazor UI
    │  Process.Start("node aarm.mjs --tenant Contoso --output json secrets list")
    ▼
aarm CLI (packages/cli)  →  Microsoft Graph API  →  Microsoft Entra ID
```

The UI calls the CLI, reads stdout, and deserialises the `ResultEnvelope<T>` JSON.
No HTTP bridge or embedded Node.js is required (ADR-0002).

### Cloud Mode

```
MAUI Blazor UI
    │  GET https://<fn>.azurewebsites.net/api/tenants/{id}/secrets
    ▼
AARM Azure Function  →  Microsoft Graph API  →  Microsoft Entra ID
```

The UI calls the Azure Function REST API. Scan results come from Azure Blob Storage;
credentials are stored in Azure Key Vault. Adding, editing or removing tenants via the UI
sends requests to the function API — no local credential storage is involved.

---

## Prerequisites

| Requirement | Version | Install |
|---|---|---|
| Windows | 10 build 19041+ or Windows 11 | — |
| .NET 10 SDK | 10.0 or later | [dot.net](https://dot.net) |
| MAUI workload | — | `dotnet workload install maui-windows` |
| aarm CLI | 0.1.0+ | See [packages/cli/README.md](../../packages/cli/README.md) |

Check installed versions:

```powershell
dotnet --version          # must be 10.x
dotnet workload list      # must show maui or maui-windows
node packages/cli/dist/index.js --version   # or: aarm --version
```

---

## Build

```powershell
# From repo root
cd apps\maui-blazor\src\AzureAppRegistrationMonitor

# Restore NuGet packages
dotnet restore
# Build for Windows
dotnet build -f net10.0-windows10.0.19041.0
```

If `dotnet restore` fails because of missing workload:

```powershell
dotnet workload install maui-windows
dotnet restore
```

### Publish (distribute without installer)

```powershell
# From repo root — produces a self-contained folder ready to zip and ship
dotnet publish apps\maui-blazor\src\AzureAppRegistrationMonitor `
  -f net10.0-windows10.0.19041.0 `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -o publish\aarm-win-x64
```

Then zip the output:

```powershell
Compress-Archive -Path publish\aarm-win-x64\* `
  -DestinationPath publish\aarm-win-x64.zip -Force
```

The recipient unpacks the zip and runs `AzureAppRegistrationMonitor.exe` — no .NET installation required.

**Only prerequisite on the target machine:** WebView2 Runtime (Edge-based). This ships with Windows 11 and is installed automatically on Windows 10 via Windows Update since late 2021. On older machines download the Evergreen Installer from [Microsoft](https://developer.microsoft.com/microsoft-edge/webview2/).

> Debug builds and the published exe share the **same settings file** (`%USERPROFILE%\.aarm\ui-settings.json`). If you want a clean first-launch experience on your own machine after publishing, delete that file before starting the published exe (see [Reset to first-launch setup screen](#reset-to-first-launch-setup-screen) below).

---

## Run

```powershell
# From the project folder
dotnet run -f net10.0-windows10.0.19041.0
```

The app opens a desktop window with a sidebar navigation. The system tray icon appears in the notification area. Closing the window hides it to the tray — right-click the tray icon and choose **Exit** to quit the process.

### First launch checklist

#### Local Mode (default)

1. Make sure the `aarm` CLI is available. Test it:
   ```powershell
   aarm --version
   # or if not globally installed:
   node path\to\packages\cli\dist\index.js --version
   ```

2. If `aarm` is not on PATH, the app looks for `aarm.cmd` or `aarm.exe` in the same directory as its executable. You can also use `npm link` (see CLI README).

3. On first launch the mode selection screen appears. Choose **Local Mode** and click **Continue**.

4. Add at least one tenant from the **Tenants** page (or via CLI: `aarm tenants add`).

5. Click **Preflight** to check permissions, then **↻ Scan** to load the dashboard.

#### Cloud Mode

1. Deploy the AARM Azure Function (see `apps/azure-function/README.md` and `infra/README.md`).

2. On first launch the mode selection screen appears. Choose **Cloud Mode**.

3. Enter the Function base URI (e.g. `https://aarm-dev-fn.azurewebsites.net`) and the function key.

4. Click **Test connection** to verify. Click **Continue** to proceed.

5. Add tenants via the **Tenants** page — credentials are stored in Azure Key Vault automatically.

---

## Authentication modes explained

The app supports the same auth modes as the CLI. The mode is set when you run `aarm tenants add`.

| Mode | What happens | MFA support | Needs `az` CLI? | Needs App Registration? |
|---|---|---|---|---|
| `username-password` | Sign in with email + password directly (ROPC flow) | ❌ No | No | Yes (public client, delegated perms) |
| `device-code` | Opens `https://microsoft.com/devicelogin` — you enter a code and sign in in a browser | ✅ Yes | No | Yes (public client, delegated perms) |
| `interactive-browser` | Opens a browser popup on localhost for OAuth sign-in | ✅ Yes | No | Yes (with redirect URI `http://localhost`) |
| `client-secret` | Service principal with a stored client secret (unattended) | N/A | No | Yes (application perms) |
| `certificate` | Service principal with certificate (unattended) | N/A | No | Yes (application perms) |
| `azure-cli` | Reuses the token from `az login` | ✅ Yes | **Yes** | No |

### Which mode should I use?

| Situation | Recommended mode |
|---|---|
| Personal workstation, no MFA enforced | `username-password` — simplest, just email + password |
| Personal workstation, MFA enforced | `device-code` — works with MFA, no redirect URI needed |
| CI/CD pipeline or scheduled automation | `client-secret` |
| Already using Azure CLI (`az login` done) | `azure-cli` |

> **Important for `username-password`:** This mode does **not** work if your account has MFA enabled. Use `device-code` instead — it supports MFA and is Microsoft's recommended interactive flow.

### Reconfiguring a tenant's auth mode

If you created a tenant with the wrong auth mode:

```powershell
# Remove the old config
aarm tenants remove "Your Tenant Name"

# Re-add with the correct mode
aarm tenants add --tenant-id <guid> --display-name "Your Tenant" --auth-mode device-code --client-id <guid>
```

---

## Settings

Open **AARM → Settings** from the sidebar. The available options depend on the active mode.

### Mode indicator

A badge next to the brand name shows the active mode: ☁ Cloud or 💻 Local.
Click **Change mode…** in Settings to return to the mode selection screen.

### Cloud Mode settings

| Setting | Description |
|---|---|
| Function base URI | HTTPS URL of the AARM Azure Function app |
| Function key | Host key from Azure Portal → Function App → App keys → default. Stored in Windows Credential Manager. |
| Test connection | Calls `/api/status` to verify connectivity and show enabled job count |
| Diagnostics | Shows Function URI and last connection result |

In Cloud Mode: Teams notifications, CLI path, and default auth mode are managed by the Azure Function
job configuration — not in the UI.

### CLI path override (Local Mode only)

The **CLI path override** field tells the app where to find the `aarm` CLI when it is not installed globally or when you want to use a specific local build during development.

**When to use it:**

| Situation | Recommended approach |
|---|---|
| Running from the repo during development, CLI not globally installed | Set CLI path override to the local `dist/index.js` |
| Want to test a new CLI version before publishing | Point override to that version's `dist/index.js` |
| `aarm` is globally installed and working | Leave this field empty |

**What to enter:**

Enter the full path to the CLI entry point — the compiled `index.js` file inside the `dist/` folder:

```
C:\dev\AzureAppRegistrationSecretMonitor\packages\cli\dist\index.js
```

The app runs `node <path>` in place of calling `aarm` directly. Node.js must be on PATH (the app calls `where node` to locate it).

**Changes take effect immediately** — no restart required.

**Resolution order** (the app checks in this order and uses the first match):

| Priority | Location | What the app does |
|---|---|---|
| 1 | `aarm.cmd` / `aarm.exe` next to the app `.exe` | Calls it directly (bundled deployment) |
| 2 | `%APPDATA%\npm\aarm.cmd` | Calls it directly (`npm install -g`) |
| 3 | CLI path override (Settings page) | Runs `node <path>` |
| 4 | `AARM_CLI_PATH` environment variable | Runs `node <path>` |
| 5 | `aarm` on PATH | Calls it directly (`npm link`) |

> **Development shortcut:** Instead of the Settings page you can set the `AARM_CLI_PATH` environment variable in your shell before launching the app — it has the same effect as the Settings field but does not persist across app restarts.

### Default tenant and auth mode

- **Default tenant** — pre-selected in all dropdowns when the app opens.
- **Default auth mode for new tenants** — pre-selected when you add a tenant from within the UI.

### Configured tenants (Local Mode)

The tenants table reflects the same `~/.aarm/tenants.json` file that the CLI writes. For non-secret
auth modes (`interactive-browser`, `device-code`, `azure-cli`) you can change the auth mode directly
in the UI. For modes that store a credential (`client-secret`, `username-password`, `certificate`)
the credential must be reconfigured via the CLI:

```powershell
aarm tenants remove "Your Tenant"
aarm tenants add --tenant-id <guid> --display-name "Your Tenant" --auth-mode client-secret --client-id <guid>
```

### Configured tenants (Cloud Mode)

The tenant list is loaded from the Azure Function `/api/tenants`. You can add, edit and delete tenants
directly from the **Tenants** page. Credentials are sent to the function and stored in Azure Key Vault —
nothing is stored locally in Cloud Mode.

---

## Project structure

```
apps/maui-blazor/src/AzureAppRegistrationMonitor/
├── AzureAppRegistrationMonitor.csproj   ← project file (net9.0-windows)
├── MauiProgram.cs                       ← DI setup, registers services + view models
├── App.xaml / App.xaml.cs               ← window lifecycle, hide-to-tray on close
├── MainPage.xaml                        ← BlazorWebView host
├── Routes.razor                         ← Blazor router
├── _Imports.razor                       ← global @using directives
│
├── Models/
│   └── CliModels.cs                     ← C# records matching CLI JSON output
│
├── Services/
│   ├── CliExecutionService.cs           ← invokes aarm, deserialises ResultEnvelope<T>
│   ├── TenantConfigRepository.cs        ← reads ~/.aarm/tenants.json
│   ├── HistoryRepository.cs             ← reads/writes ~/.aarm/history/*.json
│   └── SystemTrayService.cs             ← tray icon via H.NotifyIcon.Maui
│
├── ViewModels/
│   ├── TenantOverviewViewModel.cs       ← loads tenants, triggers preflight
│   ├── PreflightViewModel.cs            ← runs preflight for a tenant
│   ├── DashboardViewModel.cs            ← loads app + secret counts
│   └── SecretListViewModel.cs           ← loads expiring / expired secrets
│
├── Components/
│   ├── Layout/
│   │   └── MainLayout.razor             ← sidebar + main content area
│   └── Pages/
│       ├── TenantOverview.razor         ← / — tenant list + preflight buttons
│       ├── PreflightDetail.razor        ← /preflight/{TenantName}
│       └── Dashboard.razor              ← /dashboard
│
└── Resources/
    └── Styles/
        ├── Colors.xaml                  ← brand + risk colours
        └── Styles.xaml                  ← base MAUI styles
```

---

## Local storage

| Location | What is stored |
|---|---|
| `%USERPROFILE%\.aarm\tenants.json` | Tenant profiles (shared with CLI) |
| `%USERPROFILE%\.aarm\history\*.json` | Scan history (one file per scan) |
| `%USERPROFILE%\.aarm\ui-settings.json` | UI preferences, active mode, Function URI, default tenant |
| Windows Credential Manager | Client secrets, function key (Cloud Mode) |

This location is **user-profile-bound**, not inside the app directory. Debug builds and published/distributed builds share the same files — if you run both, they will see each other's settings.

In Local Mode, secret key material is written by the CLI and never stored in plain files.
In Cloud Mode, credentials are sent to the Azure Function API and stored in Azure Key Vault —
no credential material is stored locally.

---

## Troubleshooting

### `aarm` not found when the app starts a scan

The app searches for the CLI in this order: bundled `aarm.cmd/exe` next to the app, `%APPDATA%\npm\aarm.cmd`, CLI path override from Settings, `AARM_CLI_PATH` env var, then `aarm` on PATH.

**Quickest fix during development** — open **Settings → CLI path override** and enter the full path to `packages\cli\dist\index.js`:

```
C:\dev\AzureAppRegistrationSecretMonitor\packages\cli\dist\index.js
```

**Or** install globally and restart the app:

```powershell
cd packages\cli
npm link
```

**Or** copy `packages\cli\dist\` into the MAUI app's output folder so it is found as a bundled executable.

### `The type initializer for 'H.NotifyIcon...' threw an exception`

The tray icon requires Windows App SDK runtime. Install it from:
[https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/downloads](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/downloads)

### MAUI workload not found

```powershell
dotnet workload install maui-windows
dotnet workload repair
```

### Reset to first-launch setup screen

The mode-selection screen (Local vs. Cloud, Function URI + key) appears only when no valid settings exist. To trigger it again — for example when testing a fresh install or switching to a new Azure Function — delete the settings file:

```powershell
Remove-Item "$env:USERPROFILE\.aarm\ui-settings.json"
```

The app will show the setup screen on the next launch.

If you only want to re-enter the Azure Function URI and key without wiping all other settings, edit the file directly:

```powershell
notepad "$env:USERPROFILE\.aarm\ui-settings.json"
```

Set `appMode` to `""`, `cloudBaseUri` to `""` and save. The app will prompt for the connection details on next launch.

The **function key** is stored separately in Windows Credential Manager, not in the JSON file. To remove it:

```powershell
# List AARM entries
cmdkey /list | Select-String "aarm"

# Delete a specific entry (replace <TargetName> with the name shown above)
cmdkey /delete:<TargetName>
```

Or open **Control Panel → Credential Manager → Windows Credentials** and remove entries containing `aarm`.

### Build error: `net10.0-windows10.0.19041.0` not found

You need the .NET 10 SDK with the Windows targeting pack:

```powershell
winget install Microsoft.DotNet.SDK.10
dotnet workload install maui-windows
```

---

## Related

| Package / App | Description |
|---|---|
| [`@brunsforge/azure-app-registration-monitor`](../../packages/core/README.md) | TypeScript engine library |
| [`@brunsforge/aarm`](../../packages/cli/README.md) | CLI that this app invokes in Local Mode |
| [AARM Azure Function](../azure-function/README.md) | Cloud scanning engine used in Cloud Mode |
| [Bicep Infrastructure](../../infra/README.md) | Azure resources for Cloud Mode deployment |
