# AARM Azure Function

Scheduled cloud scanning engine for Azure App Registration client secrets.
Runs scans on a configurable schedule, stores results in Azure Blob Storage,
and sends Teams notifications. Exposes REST endpoints for the MAUI Cloud Mode
and the built-in HTML dashboard.

---

## Inhaltsverzeichnis

1. [Azure-Ressourcen](#1-azure-ressourcen)
2. [Deployment](#2-deployment)
3. [App Settings](#3-app-settings)
4. [App Registration Setup (Zieltenant)](#4-app-registration-setup-zieltenant)
5. [Job-Konfiguration](#5-job-konfiguration)
6. [HTTP-Endpoints](#6-http-endpoints)
7. [Timer-Trigger](#7-timer-trigger)
8. [Testen](#8-testen) — Postman-Collection & E2E-Suite
9. [Local Development](#9-local-development)

**Schnellstart mit Scripts:**

```powershell
# Alles in einem Schritt: Infra + Code deployen
.\apps\azure-function\infra\deploy.ps1 -ResourceGroup aarm-dev-rg

# Ersten Tenant interaktiv einrichten
.\infra\setup-tenant.ps1 -ResourceGroup aarm-dev-rg
```

---

## 1. Azure-Ressourcen

Alle Ressourcen werden via Bicep in einem Schritt bereitgestellt:

```powershell
cd infra
az deployment group create `
  --resource-group aarm-dev-rg `
  --template-file main.bicep `
  --parameters main.bicepparam `
  --name aarm-deploy
```

Das Deployment erstellt:

| Ressource | Name (dev) | Zweck |
|---|---|---|
| Function App | `aarm-dev-fn` | Hosting der Azure Function (Flex Consumption) |
| Storage Account | `aarmdev<hash>` | Deployment-Packages, Blob-Daten (`aarm-config`, `aarm-data`) |
| Key Vault | `aarm-dev-kv` | Scanning-Credentials (Client Secrets der Zieltabellen) |
| Log Analytics Workspace | `aarm-dev-law` | Basis für Application Insights |
| Application Insights | `aarm-dev-ai` | Telemetrie und Fehlerprotokollierung |
| User-Assigned Managed Identity (UAMI) | `aarm-dev-identity` | Passwortlose Authentifizierung gegen Storage und Key Vault |
| Hosting Plan | `aarm-dev-plan` | Flex Consumption (FC1, Linux) |

Tatsächliche Namen nach dem Deployment abfragen:

```powershell
az deployment group show `
  --resource-group aarm-dev-rg `
  --name aarm-deploy `
  --query properties.outputs -o json
```

---

## 2. Deployment

### Voraussetzungen

- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) global installiert:
  ```powershell
  npm install -g azure-functions-core-tools@4 --unsafe-perm true
  ```
- Node.js 20 (empfohlen — der Runtime der Function App)
- `az login` ausgeführt

### Warum ein separates `_deploy`-Verzeichnis?

Das Repository nutzt **npm Workspaces**. Alle Packages (`@azure/functions`, Azure SDKs etc.) sind im **Root-`node_modules/`** gehoisted, nicht im lokalen `apps/azure-function/node_modules/`. `func azure functionapp publish` packt nur das lokale Verzeichnis — ohne Root-`node_modules/` fehlen alle Abhängigkeiten im Deployment-Zip.

Lösung: ein separates `_deploy`-Verzeichnis mit:
- einer eigenen `package.json` (nur `@azure/functions` als Dependency, keine Workspace-Referenz)
- einem frischen `npm install` darin
- dem esbuild-Bundle (`dist/index.js`), das alle restlichen Abhängigkeiten einbettet

### Build-Prozess

1. **Core-Package bauen** (Abhängigkeit der Function):
   ```powershell
   cd C:\Daten\source\AzureAppRegistrationSecretMonitor
   npm run build --workspace packages/core
   ```

2. **esbuild-Bundle erstellen** (aus `apps/azure-function`):
   ```powershell
   cd apps\azure-function
   node esbuild.mjs
   ```
   Ausgabe: `dist/index.js` (~2,4 MB, enthält alle Dependencies außer `@azure/functions`)

3. **Bundle in `_deploy` kopieren**:
   ```powershell
   Copy-Item dist\index.js _deploy\dist\index.js -Force
   ```

4. **`_deploy` beim ersten Mal einrichten** (einmalig oder nach `npm install` im Root):
   ```powershell
   cd _deploy
   npm install
   ```

### Deployment-Befehl

```powershell
cd _deploy
func azure functionapp publish aarm-dev-fn --typescript
```

Der `--build local`-Flag ist nicht nötig — das Bundle ist bereits fertig.

### Wichtige Hinweise und Fallstricke

| Problem | Ursache | Lösung |
|---|---|---|
| `Cannot find module '@azure/functions'` | Workspace-Hoisting: `@azure/functions` liegt nur im Root-`node_modules/` | Aus `_deploy` deployen (hat eigenes `node_modules/@azure/functions`) |
| `Dynamic require of "net" is not supported` | CJS-Packages (Azure SDK) werden in ESM gebündelt, `require` ist im ESM-Kontext undefined | `createRequire`-Banner in `esbuild.mjs` (bereits eingebaut) |
| `Cannot find module 'cookie'` | `@azure/functions` hat transitive Abhängigkeiten, die manuell kopierte Packages nicht enthalten | `npm install` in `_deploy` installiert alle transitiven Deps korrekt |
| `Worker_runtime` App Setting nicht erlaubt | Flex Consumption verwaltet den Runtime intern | `FUNCTIONS_WORKER_RUNTIME` darf **nicht** in App Settings gesetzt sein |
| Keine Functions registriert trotz erfolgreichem Deployment | Top-Level-`await` im Entry-Module bricht die Modulinitialisierung ab | `initializeStorage()` wird nicht-blockierend aufgerufen (`.catch()`) |
| `@azure/identity-cache-persistence` nicht gefunden | Statischer Import eines Windows/macOS-Native-Addons in ESM | Wird dynamisch importiert (`try { await import(...) } catch {}`) |
| Health-Check `Unauthorized` nach Deployment | Flex Consumption schränkt `/admin`-Endpoint ein | Kein Fehler — das Deployment war erfolgreich, Meldung ignorieren |

---

## 3. App Settings

Alle Settings werden vom Bicep-Deployment automatisch gesetzt. Zur Referenz:

| Setting | Wert | Beschreibung |
|---|---|---|
| `AZURE_CLIENT_ID` | Client-ID der UAMI | Wird von `@azure/identity` für passwortlose Auth verwendet |
| `AzureWebJobsStorage__accountName` | Storage-Account-Name | Flex Consumption: UAMI-basierte Storage-Auth (kein Connection String) |
| `AzureWebJobsStorage__blobServiceUri` | Blob-Endpoint-URL | Flex Consumption: UAMI-basierte Storage-Auth |
| `AzureWebJobsStorage__credential` | `managedidentity` | Auth-Methode |
| `AzureWebJobsStorage__clientId` | Client-ID der UAMI | Spezifische UAMI für Storage-Auth |
| `AARM_STORAGE_URI` | `https://<account>.blob.core.windows.net` | Storage URI für AARM-Daten-Container |
| `AARM_KEYVAULT_URI` | `https://<vault>.vault.azure.net/` | Key Vault URI für Scanning-Credentials |
| `AARM_DASHBOARD_URL` | `https://<fn>.azurewebsites.net/api/dashboard` | Wird in Teams-Benachrichtigungen verlinkt |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `InstrumentationKey=...` | Application Insights Verbindungszeichenfolge |
| `APPLICATIONINSIGHTS_ROLE_NAME` | `aarm-azure-function` | Cloud-Rollenname in Application Map |
| `FUNCTIONS_EXTENSION_VERSION` | `~4` | Functions Runtime Version |

**Nicht setzen:**
- `FUNCTIONS_WORKER_RUNTIME` — von Flex Consumption verboten (wird intern verwaltet)

---

## 4. App Registration Setup (Zieltenant)

Pro Zieltenant eine App Registration anlegen:

```powershell
# Im ZIELTENANT (nicht im Function-Host-Tenant)
$app = az ad app create --display-name "AARM Scanner" | ConvertFrom-Json

# Application.Read.All (9a5d68dd-...)
az ad app permission add `
  --id $app.id `
  --api 00000003-0000-0000-c000-000000000000 `
  --api-permissions 9a5d68dd-52b0-4cc2-bd40-abcf44ac3a30=Role

# Admin Consent erteilen
az ad app permission admin-consent --id $app.id

# Client Secret erstellen
$cred = az ad app credential reset --id $app.id --display-name "aarm-scanner" | ConvertFrom-Json

# Secret in Key Vault speichern
az keyvault secret set `
  --vault-name aarm-dev-kv `
  --name "aarm-<job-id>" `
  --value $cred.password
```

Optional für Sign-in-Log-Analyse (`AuditLog.Read.All`):
```powershell
az ad app permission add `
  --id $app.id `
  --api 00000003-0000-0000-c000-000000000000 `
  --api-permissions b0afded3-3588-46d8-8b3d-9842eff778da=Role
```

---

## 5. Job-Konfiguration

Die Function liest alle Jobs aus einer einzigen Datei: `aarm-config/jobs.json` in Blob Storage.

**Empfohlen — interaktives Setup-Script** (fragt alle Parameter ab, speichert Secret in Key Vault, lädt `jobs.json` hoch):

```powershell
.\infra\setup-tenant.ps1 -ResourceGroup aarm-dev-rg
```

**Manuell** — Beispieldatei hochladen und anpassen:

```powershell
# Beispiel als Ausgangspunkt kopieren und Platzhalter ersetzen
Copy-Item references\examples\jobs.json jobs.json

az storage blob upload `
  --account-name <storage-account> `
  --container-name aarm-config `
  --name jobs.json `
  --file jobs.json `
  --overwrite `
  --auth-mode login
```

Ein vollständig kommentiertes Beispiel mit zwei Jobs (Client Secret + Workload Identity Federation) liegt unter [`references/examples/jobs.json`](../../../references/examples/jobs.json).

### Schema

`jobs.json` ist ein JSON-Objekt mit einem `jobs`-Array:

```json
{
  "jobs": [
    {
      "id": "contoso-prod",
      "enabled": true,
      "tenantId": "<tenant-guid>",
      "tenantDisplayName": "Contoso Corporation",
      "environmentName": "PROD",
      "authMode": "client-secret",
      "clientId": "<client-guid>",
      "credentialRef": "aarm-contoso-prod",
      "schedule": {
        "intervalDays": 1,
        "runAtUtc": "06:00"
      },
      "teamsWebhooks": {
        "status": null,
        "alerts": "https://...",
        "errors": null
      },
      "notificationThresholds": {
        "expiringWithinDays": 30,
        "criticalWithinDays": 7
      },
      "logAnalytics": {
        "workspaceId": null,
        "enabled": false
      }
    }
  ]
}
```

#### Felder

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | string | ja | Eindeutige Job-ID. Wird als Blob-Name und Key-Vault-Secret-Name (`aarm-{id}`) verwendet. Nur Kleinbuchstaben, Ziffern und Bindestriche. |
| `enabled` | boolean | ja | `false` pausiert den Job ohne ihn zu löschen. |
| `tenantId` | string | ja | GUID des **Zieltenants** (nicht des Function-Host-Tenants). |
| `tenantDisplayName` | string | ja | Anzeigename für Benachrichtigungen und Dashboard. |
| `environmentName` | string | ja | Frei wählbares Label, z. B. `PROD`, `DEV`. Differenziert Scan-Ergebnisse in Blob Storage. |
| `authMode` | string | ja | `client-secret`, `certificate` oder `workload-identity-federation`. |
| `clientId` | string | ja | Client-ID der App Registration **im Zieltenant**. |
| `credentialRef` | string | bedingt | Key-Vault-Secret-Name. Pflicht für `client-secret` und `certificate`. |
| `schedule.intervalDays` | number | ja | Tage zwischen zwei Scans. `1` = täglich, `7` = wöchentlich. |
| `schedule.runAtUtc` | string | ja | Bevorzugte Startzeit in UTC (`HH:mm`). Der Timer prüft alle 5 Minuten ob ein Scan fällig ist. |
| `teamsWebhooks.status` | string\|null | nein | Webhook für regulären Scan-Statusbericht. |
| `teamsWebhooks.alerts` | string\|null | nein | Webhook für ablaufende oder kritische Secrets. |
| `teamsWebhooks.errors` | string\|null | nein | Webhook bei Scan-Fehlern. |
| `notificationThresholds.expiringWithinDays` | number | nein | Standard: `30`. Secrets innerhalb dieser Tage gelten als "ablaufend". |
| `notificationThresholds.criticalWithinDays` | number | nein | Standard: `7`. Secrets innerhalb dieser Tage gelten als "kritisch". |
| `logAnalytics.workspaceId` | string\|null | nein | Workspace-ID für Sign-in-Log-Analyse. |
| `logAnalytics.enabled` | boolean | nein | Standard: `false`. |

---

## 6. HTTP-Endpoints

### Authentifizierung

Alle Endpoints außer `/api/dashboard` verwenden **Function Key Authentication** (`authLevel: function`).

Function Key im Header:
```
x-functions-key: <key>
```

Key abrufen:
```powershell
az functionapp keys list --name aarm-dev-fn --resource-group aarm-dev-rg --query "functionKeys.default" -o tsv
```

---

### GET `/api/status`

**Zweck:** Health-Check. Bestätigt dass die Function läuft, Storage erreichbar ist und zeigt Job-Anzahl.

**Auth:** Function Key

**Response 200:**
```json
{
  "healthy": true,
  "version": "0.1.0",
  "jobCount": 2,
  "enabledJobCount": 2,
  "lastScanAt": "2026-05-07T06:00:00.000Z",
  "storageConnected": true
}
```

| Feld | Beschreibung |
|---|---|
| `healthy` | `false` wenn Storage nicht erreichbar |
| `jobCount` | Alle Jobs in `jobs.json` (enabled + disabled) |
| `enabledJobCount` | Nur Jobs mit `enabled: true` |
| `lastScanAt` | ISO 8601 des letzten abgeschlossenen Scans; `null` wenn noch kein Scan gelaufen |
| `storageConnected` | `true` wenn Storage-Abfrage erfolgreich war |

---

### GET `/api/tenants`

**Zweck:** Listet alle konfigurierten Tenants. Wird von MAUI Cloud Mode und Dashboard verwendet.

**Auth:** Function Key

**Response 200:** Array von Tenant-Profilen
```json
[
  {
    "tenantId": "<tenant-guid>",
    "displayName": "Contoso Corporation",
    "authMode": "client-secret",
    "clientId": "<client-guid>",
    "username": null,
    "defaultEnvironmentName": "PROD",
    "logAnalyticsWorkspaceId": null,
    "createdAt": "2026-05-07T06:00:00.000Z",
    "updatedAt": "2026-05-07T06:00:00.000Z",
    "lastPreflightAt": "2026-05-07T06:00:00.000Z",
    "lastSuccessfulScanAt": "2026-05-07T06:00:00.000Z"
  }
]
```

Ein Eintrag pro eindeutiger `tenantId`. Bei mehreren Jobs für denselben Tenant wird nur der erste berücksichtigt. Gibt `[]` zurück wenn keine Jobs konfiguriert sind.

---

### POST `/api/tenants`

**Zweck:** Fügt einen neuen Tenant/Job hinzu. Speichert den Scanning-Credential in Key Vault.

**Auth:** Function Key

**Request Body:**
```json
{
  "tenantId": "<tenant-guid>",
  "tenantDisplayName": "Contoso Corporation",
  "authMode": "client-secret",
  "clientId": "<client-guid>",
  "credentialValue": "<client-secret>",
  "environmentName": "PROD",
  "schedule": {
    "intervalDays": 1,
    "runAtUtc": "06:00"
  },
  "teamsWebhooks": {
    "status": null,
    "alerts": "https://...",
    "errors": null
  },
  "notificationThresholds": {
    "expiringWithinDays": 30,
    "criticalWithinDays": 7
  },
  "logAnalytics": {
    "workspaceId": null,
    "enabled": false
  }
}
```

| Feld | Pflicht | Beschreibung |
|---|---|---|
| `tenantId` | ja | GUID des Zieltenants |
| `tenantDisplayName` | ja | Anzeigename |
| `authMode` | ja | `client-secret` oder `workload-identity-federation` |
| `clientId` | bedingt | Pflicht bei `client-secret` |
| `credentialValue` | bedingt | Client-Secret-Wert — wird in Key Vault gespeichert, nie persistiert |
| `environmentName` | nein | Standard: `default` |
| `schedule.intervalDays` | nein | Standard: `1` |
| `schedule.runAtUtc` | nein | Standard: `06:00` |

**Response 201:** Angelegtes Tenant-Profil (wie `GET /api/tenants` Eintrag)

**Response 400:** Pflichtfelder fehlen oder ungültig

**Response 409:** Tenant bereits vorhanden — PUT verwenden

---

### PUT `/api/tenants/{tenantId}`

**Zweck:** Aktualisiert Job-Konfiguration eines bestehenden Tenants. Rotiert optional den Key-Vault-Credential.

**Auth:** Function Key

**Path-Parameter:** `tenantId` (GUID)

**Request Body:** Gleiche Felder wie POST. `credentialValue` weglassen um den bestehenden Credential beizubehalten.

**Response 200:** Aktualisiertes Tenant-Profil

**Response 404:** Tenant nicht gefunden

---

### DELETE `/api/tenants/{tenantId}`

**Zweck:** Entfernt den Job aus `jobs.json` und löscht den Key-Vault-Credential. Der Runtime-State-Blob bleibt für Audit-Zwecke erhalten.

**Auth:** Function Key

**Path-Parameter:** `tenantId` (GUID)

**Response 204:** Erfolgreich gelöscht

**Response 404:** Tenant nicht gefunden

---

### GET `/api/tenants/{tenantId}/secrets`

**Zweck:** Gibt das letzte Scan-Ergebnis für einen Tenant zurück. Primärer Daten-Endpoint für MAUI Cloud Mode und Dashboard.

**Auth:** Function Key

**Path-Parameter:** `tenantId` (GUID)

**Response 200:** `ResultEnvelope<AppRegistrationSummary[]>`
```json
{
  "success": true,
  "metadata": {
    "tenantId": "<tenant-guid>",
    "environmentName": "PROD",
    "generatedAt": "2026-05-07T06:00:00.000Z",
    "toolVersion": "0.1.0"
  },
  "data": [
    {
      "applicationObjectId": "<object-guid>",
      "appId": "<app-guid>",
      "displayName": "My App Registration",
      "secretCount": 2,
      "expiredSecretCount": 0,
      "expiringSecretCount": 1,
      "riskLevel": "High",
      "secrets": [
        {
          "keyId": "<key-guid>",
          "displayName": "prod-key",
          "hint": "abc",
          "endDateTime": "2026-06-15T00:00:00Z",
          "daysUntilExpiry": 38,
          "status": "ExpiringSoon",
          "riskLevel": "High"
        }
      ]
    }
  ],
  "warnings": [],
  "errors": []
}
```

**Response 404:** Kein Scan für diesen Tenant oder kein Job konfiguriert

---

### GET `/api/tenants/{tenantId}/preflight`

**Zweck:** Gibt das letzte Preflight-/Capability-Check-Ergebnis zurück. Wird vom MAUI Preflight-Detail-Screen verwendet.

**Auth:** Function Key

**Path-Parameter:** `tenantId` (GUID)

**Response 200:** `ResultEnvelope<PreflightResult>`
```json
{
  "success": true,
  "metadata": {
    "tenantId": "<tenant-guid>",
    "environmentName": "PROD",
    "generatedAt": "2026-05-07T06:00:00.000Z",
    "toolVersion": "0.1.0"
  },
  "data": {
    "tenantId": "<tenant-guid>",
    "environmentName": "PROD",
    "authValid": true,
    "graphReachable": true,
    "checkedAt": "2026-05-07T06:00:00.000Z",
    "capabilities": {
      "canReadApplications": true,
      "canReadApplicationSecrets": true,
      "canReadServicePrincipals": true,
      "canReadOwners": true,
      "canReadDirectory": false,
      "canQueryLogAnalytics": false,
      "canAnalyzeServicePrincipalSignIns": false,
      "canCreateApplicationSecrets": false,
      "canDeleteApplicationSecrets": false,
      "canCreateApplications": false
    },
    "missingPermissions": [],
    "warnings": [],
    "errors": []
  },
  "warnings": [],
  "errors": []
}
```

**Response 404:** Kein Preflight-Ergebnis vorhanden — Scan zuerst ausführen

---

### POST `/api/tenants/{tenantId}/scan`

**Zweck:** Löst einen sofortigen Scan außerhalb des regulären Zeitplans aus. Alle konfigurierten Jobs für diesen Tenant werden ausgeführt. Teams-Benachrichtigungen werden gemäß Job-Konfiguration gesendet — identisches Verhalten wie der Timer-Trigger.

Der Scan läuft **asynchron** — der Endpoint gibt sofort `202 Accepted` zurück.

**Auth:** Function Key

**Path-Parameter:** `tenantId` (GUID)

**Response 202:**
```json
{
  "accepted": true,
  "startedAt": "2026-05-07T10:34:00.000Z",
  "jobCount": 1
}
```

**Response 404:** Kein Job für diesen Tenant konfiguriert

Ergebnisse sind nach Abschluss des Scans unter `/secrets` und `/preflight` abrufbar.

---

### GET `/api/dashboard`

**Zweck:** Liefert eine interaktive HTML-Seite. Die Seite lädt Daten client-seitig via `fetch()` aus den JSON-Endpoints.

**Auth:** `anonymous` — der Function Key wird im Browser-`localStorage` unter `aarm_fn_key` gespeichert. Beim ersten Aufruf erscheint ein Browser-Prompt.

**Query-Parameter (optional):**

| Parameter | Beschreibung |
|---|---|
| `tenant` | Wählt beim Laden einen Tenant vor (GUID) |

**Response 200:** HTML-Seite (`text/html`)

Verwendung:
- Im Browser bookmarken für schnellen Überblick
- In Dokumentation oder SharePoint verlinken
- `AARM_DASHBOARD_URL` in App Settings wird in Teams-Notifications verlinkt

---

### GET `/api/report`

**Zweck:** Liefert einen vollständig server-seitig gerenderten HTML-Snapshot ohne JavaScript. Alle Daten sind zum Anfragezeitpunkt eingebettet.

**Auth:** Function Key

**Query-Parameter (Pflicht):**

| Parameter | Beschreibung |
|---|---|
| `tenant` | Zieltenant-ID (GUID) |
| `env` | Environment-Name (z. B. `PROD`) |

Beispiel:
```
GET /api/report?tenant=<tenant-guid>&env=PROD
x-functions-key: <key>
```

**Response 200:** HTML-Snapshot (`text/html`)

**Response 400:** `tenant` oder `env` fehlen

**Response 404:** Keine Scan-Daten für diesen Tenant/Environment

Verwendung:
- E-Mail-Anhänge (HTML in E-Mail-Body einfügen)
- Archivierung von Punkt-zu-Punkt-Berichten
- Automatisierte Reportgenerierung in CI-Pipelines

---

## 7. Timer-Trigger

### `aarmScheduleTrigger`

**Schedule:** `0 */5 * * * *` — läuft alle 5 Minuten

Bei jedem Tick prüft der Trigger für alle konfigurierten Jobs ob ein Scan fällig ist (basierend auf `intervalDays` und `runAtUtc` in `jobs.json`). Qualifizierende Jobs werden parallel ausgeführt.

**Ablauf pro Job:**
1. Preflight-Check ausführen (Graph-Permissions, Auth)
2. App-Registrierungen und Secrets lesen
3. Ergebnisse in `aarm-data/` in Blob Storage speichern
4. Runtime-State aktualisieren (`lastRunAt`, `lastRunStatus`)
5. Teams-Benachrichtigungen senden (gemäß Webhook-Konfiguration und Schwellenwerten)

---

## 8. Testen

### Postman

Für manuelle und explorative Tests stehen zwei Dateien bereit:

| Datei | Zweck |
|---|---|
| `references/examples/aarm.postman_collection.json` | Collection mit allen 10 Endpoints und Test-Scripts |
| `references/examples/aarm-dev.postman_environment.json` | Environment-Template (Dev) |

Import-Reihenfolge in Postman:
1. Collection importieren (`aarm.postman_collection.json`)
2. Environment importieren (`aarm-dev.postman_environment.json`)
3. Environment oben rechts auswählen
4. `functionKey` und `tenantId` im Environment eintragen

Function Key ermitteln:
```powershell
az functionapp keys list --name aarm-dev-fn --resource-group aarm-dev-rg --query "functionKeys.default" -o tsv
```

`GET /api/tenants` schreibt die erste `tenantId` aus der Liste automatisch in die Collection-Variable — danach funktionieren alle `{tenantId}`-Endpoints ohne manuellen Eintrag.

---

### E2E-Test-Suite

Vollständiger automatisierter End-to-End-Test: legt einen Tenant an, löst einen Scan aus, wartet auf das Ergebnis, verifiziert alle Felder und räumt anschließend auf. Kein externes Test-Framework — nur Node.js 20.

```powershell
cd tests\e2e

# Einmalig: Konfiguration anlegen
Copy-Item .env.template .env
notepad .env   # Function URL, Key, Tenant-Daten eintragen

# Tests ausführen
npm test

# Mit HTTP-Ausgabe (Debugging)
npm run test:verbose
```

Mindestvoraussetzungen in `.env`:

| Variable | Beschreibung |
|---|---|
| `AARM_BASE_URL` | `https://aarm-dev-fn.azurewebsites.net` |
| `AARM_FUNCTION_KEY` | Default Function Key |
| `AARM_TEST_TENANT_ID` | GUID des Zieltenants |
| `AARM_TEST_CLIENT_ID` | Client-ID der App Registration |
| `AARM_TEST_CLIENT_SECRET` | Client Secret (wird über API in Key Vault gespeichert) |

Die App Registration im Zieltenant braucht `Application.Read.All` mit erteiltem Admin Consent.

Vollständige Dokumentation: [`tests/e2e/README.md`](../../../tests/e2e/README.md)

---

## 9. Local Development

### Voraussetzungen

- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) für lokale Storage-Emulation

### Setup

```powershell
# 1. Im Repo-Root: Core-Package und Bundle bauen
npm run build --workspace packages/core
cd apps\azure-function
node esbuild.mjs

# 2. Local Settings einrichten
Copy-Item local.settings.json.template local.settings.json
# Werte in local.settings.json eintragen

# 3. Lokal starten (aus apps/azure-function/)
func start
```

Der Timer-Trigger feuert alle 5 Minuten. Zum lokalen Testen die CRON-Expression in `src/triggers/timerTrigger.ts` temporär auf `*/30 * * * * *` (alle 30 Sekunden) ändern und neu bündeln.

### Local Settings Template

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AARM_STORAGE_URI": "http://127.0.0.1:10000/devstoreaccount1",
    "AARM_KEYVAULT_URI": "https://aarm-dev-kv.vault.azure.net/",
    "AARM_DASHBOARD_URL": "http://localhost:7071/api/dashboard",
    "AZURE_CLIENT_ID": ""
  }
}
```

> **Hinweis:** Lokal wird Azurite für Storage verwendet. Key Vault ist lokal nicht emulierbar — für `client-secret`-Tests wird ein echter Key Vault benötigt oder die Credentials werden direkt in `jobs.json` eingetragen (nur lokal, nie committen).
