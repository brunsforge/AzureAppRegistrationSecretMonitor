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

Authentication: OK
Microsoft Graph: OK
Log Analytics: Warning
Write Operations: Disabled

Capabilities
[✓] Read App Registrations
[✓] Read Secrets
[ ] Read Owners
[✓] Query Log Analytics
[ ] Create Secrets
[ ] Delete Secrets

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
Risk      App Name        Secret        Expires     Days  Last Seen
CRITICAL  Export Worker   prod-secret   expired     -4    yesterday
HIGH      CRM Connector   crm-prod      2026-05-21  21    2 days ago
MEDIUM    Teams Bot       bot-secret    2026-07-10  71    unknown
LOW       Test Tool       dev-secret    2026-11-01  185   never
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
