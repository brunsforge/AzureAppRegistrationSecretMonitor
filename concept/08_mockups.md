# Mockups

These are textual mockups for planning. They are not final UI designs.

## 1. Tenant Overview

```text
+--------------------------------------------------------------+
| Azure App Registration Secret Monitor                        |
+--------------------------------------------------------------+
| Tenants                                                      |
|                                                              |
| [Add Tenant] [Run All Preflight Checks] [Scan All]            |
|                                                              |
| Name            Env    Auth       Preflight   Last Scan       |
| Contoso         PROD   Browser    OK          2026-04-30      |
| Contoso         TEST   Device     Warning     2026-04-29      |
| Fabrikam        PROD   Secret     Failed      Never           |
+--------------------------------------------------------------+
```

## 2. Preflight Detail

```text
Tenant: Contoso
Environment: PROD
App Registration: CRM Integration App  (<client-id>)
Preflight run: 2026-05-05 10:30

Authentication: OK
Microsoft Graph: OK
Log Analytics: Warning
Write Operations: Disabled

--- Required Set -----------------------------------------------
[✓] Read App Registrations          App list available
[✓] Read Secrets                    Secret metadata available
[~] Read Service Principals         Enrichment limited
[ ] Read Owners                     Owner column hidden

--- Extended Set (nice to have) --------------------------------
[✓] Query Log Analytics             Usage Analysis tab enabled
[✓] Analyze SP Sign-in Logs         Last-seen data available
[ ] Read Azure Resources            IP enrichment unavailable
[ ] Read Key Vault Metadata         Key Vault scan unavailable
[ ] Create / Delete Secrets         Rotation automation disabled
[ ] Create App Registrations        App creation hidden

Missing / limited:
- Directory.Read.All may be needed to resolve owners.
- Application.ReadWrite.All is not granted; rotation automation disabled.
```

## 3. Dashboard

```text
Tenant: Contoso PROD

+------------------+ +------------------+ +------------------+
| App Registrations| | Secrets          | | Expired          |
| 142              | | 231              | | 3                |
+------------------+ +------------------+ +------------------+

+------------------+ +------------------+ +------------------+
| Expiring 30 days | | Expiring 90 days | | Unknown Owner    |
| 8                | | 24               | | 31               |
+------------------+ +------------------+ +------------------+

[Open Secret List] [Run Scan] [Export Report]
```

## 4. Secret List

```text
Risk      App Name        Secret        Expires     Days  Last Seen     [↗]
CRITICAL  Export Worker   prod-secret   expired     -4    yesterday     [↗]
HIGH      CRM Connector   crm-prod      2026-05-21  21    2 days ago    [↗]
MEDIUM    Teams Bot       bot-secret    2026-07-10  71    unknown       [↗]
LOW       Test Tool       dev-secret    2026-11-01  185   never         [↗]

[↗] opens the App Registration directly in Azure Portal (system browser)
```

## 5. Secret Detail

```text
App: CRM Connector
Client ID: <client-id>
Secret: crm-prod
Key ID: <secret-key-id>
Expires: 2026-05-21
Risk: HIGH

Usage Summary:
- Last seen: 2 days ago
- Used resources: Dataverse, Graph
- Source IPs: 2 distinct
- Old key still active: yes/no

Likely locations:
- Azure Function / App Service
- Dataverse plugin helper
- Power Automate custom connector

Recommended actions:
1. Create replacement secret.
2. Update known consumers.
3. Observe old Key ID for 7-14 days.
4. Remove old secret when no usage remains.
```

## 6. Feature Disabled State

```text
Usage Analysis unavailable

Reason:
This tenant/environment has no working Log Analytics access or the Entra diagnostic logs are not routed to the configured workspace.

Required:
- Configure Entra Diagnostic Settings
- Route Service Principal Sign-in Logs to Log Analytics
- Grant Log Analytics Reader or Monitoring Reader
```

## Section 7 — Tenant Add / Edit Form

```text
+--------------------------------------------------------------+
| Add Tenant                                                   |
+--------------------------------------------------------------+
| Display Name:   [Contoso PROD             ]                  |
| Tenant ID:      [<tenant-id>              ]                  |
| Environment:    [PROD                     ]                  |
|                                                              |
| Auth Mode:      ( ) Client Secret                            |
|                 ( ) Certificate           (Post-MVP)         |
|                 (•) Interactive Browser                      |
|                 ( ) Device Code                              |
|                 ( ) Azure CLI                                |
|                                                              |
| ℹ The app opens a browser window for login. A localhost      |
|   redirect URI must be registered on the App Registration.   |
|                                                              |
| Log Analytics Workspace ID:                                  |
|                 [<workspace-id>           ] (optional)       |
|                                                              |
| Teams Webhook URL:                                           |
|                 [                         ] (optional, Ph 2) |
|                                                              |
| [Cancel]                           [Validate] [Save Tenant]  |
+--------------------------------------------------------------+
```

Help text rules: the ℹ block below Auth Mode is dynamic — it changes when the user selects a different mode.

| Mode selected | Help text shown |
|---|---|
| Client Secret | Enter Client ID and secret value. Secret is stored in Windows Credential Manager. |
| Interactive Browser | The app opens a browser for login. A localhost redirect URI must be registered on the App Registration. |
| Device Code | A code appears in the app. Open `microsoft.com/devicelogin` and enter the code. No redirect URI needed. |
| Azure CLI | Requires `az` CLI installed and an active `az login` session. No Client ID or secret needed here. |
| Certificate | Enter certificate thumbprint and file path. Private key must be accessible on this machine. (Post-MVP) |

## Section 8 — History

```text
+--------------------------------------------------------------+
| History — Contoso PROD                                       |
+--------------------------------------------------------------+
| Scan Date     Apps   Secrets  Expired  Expiring  Findings    |
| 2026-04-30    142    231      3        8         5 HIGH       |
| 2026-04-28    141    230      2        9         4 HIGH       |
| 2026-04-15    139    228      1        12        3 MEDIUM     |
|                                                              |
| [View Scan Details] [Compare with Previous] [Export]         |
|                                                              |
| Changes since last scan:                                     |
| + 1 App Registration added                                   |
| + 1 Secret added (CRM Connector)                             |
| - 1 Secret expiry window moved to HIGH                       |
+--------------------------------------------------------------+
```