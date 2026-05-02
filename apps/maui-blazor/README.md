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

It does **not** embed Node.js or call Microsoft Graph directly. Instead it invokes the `aarm` CLI as a child process and reads its JSON output. Any tenant you configure via `aarm tenants add` appears immediately in the UI — both tools share the same `~/.aarm/tenants.json` config file.

---

## How it integrates with the CLI

```
MAUI Blazor UI
    │
    │  Process.Start("aarm", "--tenant Contoso --output json secrets expiring --days 30")
    │
    ▼
aarm CLI (packages/cli)
    │
    │  Microsoft Graph API calls
    │
    ▼
Microsoft Entra ID / Azure
```

The UI calls the CLI, reads stdout, and deserialises the `ResultEnvelope<T>` JSON. No HTTP bridge or embedded Node.js runtime is required (MVP decision — see ADR-0002).

---

## Prerequisites

| Requirement | Version | Install |
|---|---|---|
| Windows | 10 build 19041+ or Windows 11 | — |
| .NET 9 SDK | 9.0 or later | [dot.net](https://dot.net) |
| MAUI workload | — | `dotnet workload install maui-windows` |
| aarm CLI | 0.1.0+ | See [packages/cli/README.md](../../packages/cli/README.md) |

Check installed versions:

```powershell
dotnet --version          # must be 9.x
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
dotnet build -f net9.0-windows10.0.19041.0
```

If `dotnet restore` fails because of missing workload:

```powershell
dotnet workload install maui-windows
dotnet restore
```

---

## Run

```powershell
# From the project folder
dotnet run -f net9.0-windows10.0.19041.0
```

The app opens a desktop window with a sidebar navigation. The system tray icon appears in the notification area. Closing the window hides it to the tray — right-click the tray icon and choose **Exit** to quit the process.

### First launch checklist

1. Make sure the `aarm` CLI is available. Test it:
   ```powershell
   aarm --version
   # or if not globally installed:
   node path\to\packages\cli\dist\index.js --version
   ```

2. If `aarm` is not on PATH, the app looks for `aarm.cmd` or `aarm.exe` in the same directory as its executable. You can also use `npm link` (see CLI README).

3. Add at least one tenant via the CLI:
   ```powershell
   aarm tenants add
   ```

4. Start the app. The **Tenants** screen shows configured tenants. Click **Preflight** to check permissions, then **Scan Secrets** to load the dashboard.

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
| `~/.aarm/tenants.json` | Tenant profiles (shared with CLI) |
| `~/.aarm/history/*.json` | Scan history (one file per scan) |
| Windows Credential Manager | Client secrets (written by CLI, not by the UI) |

The UI never writes credentials. Secret key material stays in Windows Credential Manager, managed by the CLI.

---

## Troubleshooting

### `aarm` not found when the app starts a scan

The app searches for `aarm.cmd` or `aarm.exe` next to its own executable, then falls back to PATH. Install the CLI globally:

```powershell
cd packages\cli
npm link
```

Or copy `packages\cli\dist\` into the MAUI app's output folder.

### `The type initializer for 'H.NotifyIcon...' threw an exception`

The tray icon requires Windows App SDK runtime. Install it from:
[https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/downloads](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/downloads)

### MAUI workload not found

```powershell
dotnet workload install maui-windows
dotnet workload repair
```

### Build error: `net9.0-windows10.0.19041.0` not found

You need the .NET 9 SDK with the Windows targeting pack:

```powershell
winget install Microsoft.DotNet.SDK.9
dotnet workload install maui-windows
```

---

## Related

| Package | Description |
|---|---|
| [`@brunsforge/azure-app-registration-monitor`](../../packages/core/README.md) | TypeScript engine library |
| [`@brunsforge/aarm`](../../packages/cli/README.md) | CLI that this app invokes |
