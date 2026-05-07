# Implementation Plan

## Status

**Approved — Phase 9 in progress.**

Concept freeze accepted 2026-05-01. ADRs 0001–0008 accepted. Concept files 01–12 stable.

| Phase | Status | Notes |
|---|---|---|
| 0 — Concept Finalization | ✅ Complete | |
| 1 — npm Library Read-Only Core | ✅ Complete | |
| 2 — CLI MVP | ✅ Complete | |
| 3 — Preflight / Capability Model | ✅ Complete | |
| 4 — MAUI Blazor Shell | ✅ Complete | |
| 5 — History | ✅ Complete | CLI auto-saves; MAUI reads |
| 6 — Log Analytics Usage Analysis | ✅ Complete | |
| 7 — Guided Rotation | 🔵 Deferred | Manual checklist only; write ops post-ADR |
| 8 — Notifications and Integrations | ✅ Complete | Teams webhook in MAUI |
| 9.1 — Azure Function scaffolding + storage | ✅ Complete | |
| 9.2 — Auth + scanning engine | ✅ Complete | WIF + client-secret |
| 9.3 — Timer trigger | ✅ Complete | |
| 9.4 — HTTP data endpoints | ✅ Complete | |
| 9.5 — Teams notifications | ✅ Complete | Handlebars, 4 built-in templates |
| 9.6 — HTML dashboard + report | ✅ Complete | |
| 9.7 — Manual scan trigger | ✅ Complete | POST 202 |
| 9.8 — MAUI Cloud Mode | 🟡 Partial | Providers + DI done; **Settings page UI + page migration pending** |

## Phase 0: Concept Finalization

Goal:

- finalize project vocabulary
- finalize permission model
- finalize CLI shape
- finalize MAUI screens
- finalize JSON contracts

Deliverables:

- stable concept docs
- accepted ADR-0001
- initial ADR for MAUI-to-CLI integration
- first JSON schema drafts

## Phase 1: npm Library Read-Only Core

Goal:

- authenticate
- query Graph
- list applications
- extract passwordCredentials
- calculate expiry

Possible tasks after approval:

1. create npm package structure
2. add TypeScript configuration
3. add auth abstraction
4. add Graph application reader
5. add secret inventory service
6. add expiry/risk classifier
7. add JSON result envelope
8. add unit tests with mocked Graph responses

## Phase 2: CLI MVP

Goal:

- expose read-only functions as CLI

Commands:

- `preflight run`
- `apps list`
- `secrets list`
- `secrets expiring`
- `secrets expired`

## Phase 3: Preflight / Capability Model

Goal:

- active capability detection
- missing permission hints
- stable output consumed by UI

## Phase 4: MAUI Blazor Shell

Goal:

- local desktop shell
- tenant list
- preflight display
- dashboard placeholders
- CLI invocation abstraction
- system tray icon and context menu (background running; confirmed MVP by OQ-043)
- Azure Portal deep links in Secret List and Secret Detail (opens App Registration in system browser via `Launcher.OpenAsync`)

## Phase 5: History

Goal:

- store scan results as JSON files (decided by ADR-0004; SQLite deferred to a later phase after Phase 5 is stable)
- compare scans
- show changes over time

## Phase 6: Log Analytics Usage Analysis

Goal:

- configure workspace per environment
- execute KQL with user-configurable look-back window (`--days`)
- summarize app/secret usage
- show last-seen and old-key usage
- surface raw IP addresses (source IP enrichment with Azure resource data is post-Phase 6)

## Phase 7: Guided Rotation

Goal:

- manual checklist first
- key ID monitoring
- warnings before deleting old credentials
- write automation only after explicit ADR

## Phase 8: Notifications and Integrations

Goal:

- Teams webhook notification: send secret summary or single-secret status as Adaptive Card to a configured Teams channel
- webhook URL stored per tenant in tenant profile JSON (non-secret, plain config value)
- "Send to Teams" button on Secret List (tenant summary) and Secret Detail (single entry)

## Phase 9: Azure Function Cloud Mode

Approved. See `concept/12_azure_function_cloud_mode.md` for the full concept.

### Increment 9.1 — Project scaffolding + Blob Storage layer

- `apps/azure-function/` TypeScript project with Azure Functions v4 Node.js SDK
- `package.json`, `tsconfig.json`, `host.json`, `local.settings.json.template`
- `BlobJobConfigStore` — reads `aarm-config/jobs.json` from Blob Storage
- `BlobResultStore` — writes `aarm-data/history/` and `aarm-data/latest/`
- `BlobRuntimeStateStore` — reads/writes `aarm-data/runtime/{jobId}.json`

### Increment 9.2 — Auth + scanning engine

- Add `workload-identity-federation` auth mode to `packages/core/src/auth/AuthProviderFactory.ts`
- Per-job scan executor: reads credential from `process.env[credentialRef]`, creates credential, calls core library
- Scheduling logic: check `intervalDays` + `runAtUtc` against `lastRunAt`

### Increment 9.3 — Timer trigger

- CRON timer trigger every 5 minutes
- Reads `jobs.json`, evaluates schedule for each enabled job, fires qualifying jobs in parallel
- Writes runtime state blob after each job completes

### Increment 9.4 — HTTP data endpoints

- `GET /api/status` — health, job count, last timer tick
- `GET /api/tenants` — list tenants with scan data
- `GET /api/tenants/{tenantId}/environments/{envName}/secrets` — latest `ResultEnvelope<SecretFinding[]>`
- `GET /api/tenants/{tenantId}/environments/{envName}/preflight` — latest `ResultEnvelope<PreflightResult>`

### Increment 9.5 — Teams notifications

- Template loading from `aarm-config/templates/` with built-in fallbacks
- Handlebars.js rendering with `{{placeholder}}` variables
- Webhook posting per `teamsWebhooks` config fields with threshold evaluation

### Increment 9.6 — HTML dashboard and report

- `GET /api/dashboard` — static HTML shell; JS fetches JSON endpoints client-side
- `GET /api/report` — server-side rendered HTML snapshot (no JS required)

### Increment 9.7 — Manual scan trigger (optional)

- `POST /api/tenants/{tenantId}/environments/{envName}/scan` — immediate job trigger, `202 Accepted`

### Increment 9.8 — MAUI Cloud Mode

**Done:**
- `IDataProvider` interface + `DelegatingDataProvider` proxy singleton
- `LocalCliDataProvider` wraps `CliExecutionService` behind interface
- `CloudHttpDataProvider` calls Azure Function HTTP endpoints
- `UiSettings`: `AppMode` + `CloudBaseUri` fields
- `CredentialRepository`: `GetCloudFunctionKey` / `SetCloudFunctionKey`
- `MauiProgram.cs`: DI registration for all providers

**Remaining:**
- Settings page: Cloud/Local mode toggle, base URI, function key input, Test Connection button
- Settings page: read-only Diagnostics panel (cache paths in Local; connection status in Cloud)
- Migrate pages (`SecretList`, `Dashboard`, `PreflightDetail`) from direct `CliExecutionService` injection to `IDataProvider`
- Add `AARM_DASHBOARD_URL` to `local.settings.json.template`

See `concept/07_maui_blazor_ui_concept.md` for the concrete Settings page field spec.

## Code Generation Gate

Before Phase 1 begins, the user must explicitly approve implementation with wording similar to:

```text
Concept freeze accepted. Start Phase 1 implementation.
```

Without this approval, Claude must continue planning only.
