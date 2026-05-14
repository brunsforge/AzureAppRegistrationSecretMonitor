# AARM E2E Test Suite

End-to-End-Tests für die AARM Azure Function API.

Kein externes Test-Framework, keine zusätzlichen Dependencies — nur Node.js 20+ (nutzt natives `fetch`).

## Was getestet wird

| Schritt | Endpoint | Prüfung |
|---|---|---|
| 1 | `GET /api/status` | `healthy: true`, Version und jobCount vorhanden |
| 2 | `POST /api/tenants` | 201, tenantId im Response; 409 bei Doppel-Anlage |
| 3 | `GET /api/tenants` | Neuer Tenant in der Liste, Felder korrekt |
| 4 | `PUT /api/tenants/{id}` | 200, 404 für unbekannten Tenant |
| 5 | `POST /api/tenants/{id}/scan` | 202 Accepted, 404 für unbekannten Tenant |
| 6 | `GET /api/tenants/{id}/secrets` | Wartet auf Scan-Ergebnis, prüft ResultEnvelope-Schema, App-Registrierungen und Secret-Felder |
| 7 | `GET /api/tenants/{id}/preflight` | authValid und graphReachable sind true, canReadApplications ist true |
| 8 | `GET /api/dashboard` | 200 HTML, enthält Dashboard-Titel |
| 9 | `GET /api/report` | 200 HTML, 400 ohne Parameter, 404 für unbekannten Tenant |
| 10 | `DELETE /api/tenants/{id}` | 204, Tenant nicht mehr in Liste, 404 bei erneutem Delete |

## Setup

```powershell
# 1. .env anlegen
Copy-Item .env.template .env

# 2. Werte eintragen (Function URL, Key, Tenant-Daten)
notepad .env
```

Alle Variablen in `.env`:

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `AARM_BASE_URL` | ja | Function App URL, z. B. `https://aarm-dev-fn.azurewebsites.net` |
| `AARM_FUNCTION_KEY` | ja | Default Function Key |
| `AARM_TEST_TENANT_ID` | ja | GUID des Zieltenants (der tenant dessen App Registrations gescannt werden) |
| `AARM_TEST_TENANT_NAME` | nein | Anzeigename, Standard: `AARM E2E Test Tenant` |
| `AARM_TEST_CLIENT_ID` | ja | Client-ID der App Registration im Zieltenant |
| `AARM_TEST_CLIENT_SECRET` | ja | Client Secret der App Registration |
| `AARM_SCAN_TIMEOUT_SEC` | nein | Wie lange auf Scan-Ergebnis warten, Standard: `60` |

**Function Key ermitteln:**
```powershell
az functionapp keys list `
  --name aarm-dev-fn `
  --resource-group aarm-dev-rg `
  --query "functionKeys.default" -o tsv
```

**Client Secret aus Key Vault lesen** (falls du ihn nicht mehr weißt):
```powershell
# Secret-Namen auflisten
az keyvault secret list --vault-name aarm-dev-kv --query "[].name" -o tsv

# Wert eines bestimmten Secrets anzeigen
az keyvault secret show --vault-name aarm-dev-kv --name aarm-<job-id> --query value -o tsv
```

> **Hinweis zur Isolation:** Der Test legt einen eigenen temporären Job für den Zieltenant an und löscht ihn am Ende wieder. Der bestehende Produktiv-Job in `jobs.json` wird dabei nicht berührt. Der Test schreibt jedoch Scan-Ergebnisse in Blob Storage (`latest/<tenantId>/`) — nach dem Test überschreiben diese den vorherigen Scan-Stand.

## Ausführen

```powershell
npm test
```

Mit ausführlicher HTTP-Ausgabe:
```powershell
npm run test:verbose
```

## Beispielausgabe

```
AARM Azure Function — E2E Test Suite
Base URL   : https://aarm-dev-fn.azurewebsites.net
Tenant     : Contoso Corporation (48b53673-ceff-...)
Client ID  : f63fe980-4f62-...
Environment: E2E

1 · Health-Check
  GET /api/status → 200 … ✓

2 · Tenant anlegen (POST /api/tenants)
  POST /api/tenants → 201 … ✓
  POST /api/tenants nochmal → 409 Conflict … ✓

3 · Tenant-Liste (GET /api/tenants)
  GET /api/tenants enthält neuen Tenant … ✓

4 · Tenant aktualisieren (PUT /api/tenants/{tenantId})
  PUT /api/tenants → 200 … ✓
  PUT nicht-existierender Tenant → 404 … ✓

5 · Scan auslösen (POST /api/tenants/{tenantId}/scan)
  POST /api/tenants/{tenantId}/scan → 202 … ✓
  POST /api/tenants/{tenantId}/scan nicht-existierend → 404 … ✓

6 · Secrets-Ergebnis (GET /api/tenants/{tenantId}/secrets)
    Warte auf Scan-Ergebnis (max 60s)......... erhalten
  Warte auf Scan-Ergebnis (Timeout: 60s) … ✓
  ResultEnvelope hat korrekte Struktur … ✓
  App-Registrierungen im Ergebnis enthalten … ✓
  Secret-Einträge haben korrektes Schema … ✓

7 · Preflight-Ergebnis (GET /api/tenants/{tenantId}/preflight)
  GET /api/tenants/{tenantId}/preflight → 200 … ✓
  Preflight: authValid und graphReachable sind true … ✓
  Preflight: canReadApplications und canReadApplicationSecrets sind true … ✓
  GET /api/tenants/{tenantId}/preflight nicht-existierend → 404 … ✓

8 · Dashboard (GET /api/dashboard)
  GET /api/dashboard → 200 HTML … ✓

9 · Report (GET /api/report)
  GET /api/report → 200 HTML … ✓
  GET /api/report ohne Parameter → 400 … ✓
  GET /api/report unbekannter Tenant → 404 … ✓

10 · Cleanup (DELETE /api/tenants/{tenantId})
  DELETE /api/tenants/{tenantId} → 204 … ✓
  Tenant nach Delete nicht mehr in Liste … ✓
  DELETE nochmal → 404 … ✓

──────────────────────────────────────────────────
✓ Alle 24 Tests bestanden.
```

## Zieltenant-Voraussetzungen

Die App Registration im Zieltenant braucht:
- `Application.Read.All` (Pflicht — Secrets lesen)
- `AuditLog.Read.All` (optional — Sign-in-Log-Analyse)

Admin Consent muss erteilt sein.

## Verhalten bei Fehlern

- Das Test-Script ist **selbst-bereinigend**: Tenant wird in Schritt 10 immer gelöscht, auch wenn frühere Tests fehlschlagen (sofern Schritt 2 erfolgreich war).
- Exit Code `0` = alle Tests grün, Exit Code `1` = mind. ein Test fehlgeschlagen.
- Für CI/CD-Integration direkt als Step verwendbar.
