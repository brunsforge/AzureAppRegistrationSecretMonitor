# ADR-0008: Cloud / Local Mode Architecture

## Status

Proposed

## Context

The AARM tool was initially designed as a local desktop application:
- npm library handles scanning logic
- CLI wraps the library and writes JSON output
- MAUI app spawns the CLI as a child process and renders the results

The user now requires a cloud-hosted scanning engine (Azure Function) that:
1. Runs scans on a schedule without a desktop machine being online
2. Persists results in Azure Blob Storage
3. Exposes REST endpoints so the MAUI app (and a browser) can read results
4. Sends Teams notifications server-side

This introduces a second operational mode alongside the existing local mode.

## Decision

### Two modes, one UI

The MAUI app introduces a `mode` setting: `local` (default) or `cloud`.

- **Local mode** — current behavior: CLI child process, `~/.aarm/` filesystem, Windows Credential Manager.
- **Cloud mode** — no CLI process; MAUI makes HTTP calls to an Azure Function base URI using a Function Key for authentication.

Both modes return the same `ResultEnvelope<T>` JSON schema.

### IDataProvider abstraction

A `IDataProvider` interface is registered in the MAUI DI container. The active implementation
is selected based on `AppMode` at startup:

- `LocalCliDataProvider` (existing `CliExecutionService` wrapped behind the interface)
- `CloudHttpDataProvider` (new; calls Azure Function REST endpoints)

A `DelegatingDataProvider` singleton proxies calls to the current inner provider,
allowing hot mode switches without an app restart.

### Azure Function as optional standalone engine

The Azure Function is a standalone Node.js function app that uses the npm library directly.
It does not depend on the CLI binary. It reads job configurations from Blob Storage and
writes scan results back to Blob Storage.

The MAUI app is not required for the function to operate — the function works independently.

### Data contract stability

The `ResultEnvelope<T>` schema defined in `concept/04_npm_library_concept.md` is the contract
between all producers (CLI, Azure Function) and all consumers (MAUI local, MAUI cloud, HTML dashboard).
It must not be broken by cloud mode additions.

### Authentication for Azure-hosted scanning

The function uses a **User-Assigned Managed Identity (UAMI)** — not a System-Assigned identity.
The UAMI is an independent Azure resource whose role assignments (Key Vault, Storage) survive
function app redeployment or deletion. Its client ID is passed to the function via the
`AZURE_CLIENT_ID` app setting, which `@azure/identity` uses automatically.

**Two-layer auth:**
1. UAMI → Key Vault (read scanning credentials) + Blob Storage (read configs, write results)
2. Client Secret or Certificate retrieved from Key Vault → Graph API in each target tenant

Cross-tenant Graph calls always use a stored credential (client secret or certificate) fetched
from Key Vault at runtime. Workload Identity Federation is a post-MVP option for target tenants
that configure a federated credential trust (see OQ-047).

### Storage

MVP: Azure Blob Storage in the same storage account as the function runtime.
Containers: `aarm-config` (job configs, templates) and `aarm-data` (history, latest pointers).

Production upgrade path: move to a dedicated storage account without code changes
(only connection string config changes).

### HTML Dashboard

The `/api/dashboard` endpoint serves a self-contained HTML shell with minimal JavaScript.
The JavaScript fetches data from the same JSON endpoints used by MAUI Cloud Mode.
No server-side template rendering at request time; data is loaded client-side.

## Consequences

### Positive

- Local mode behavior is unchanged; existing MAUI users are unaffected
- The npm library gains a `workload-identity-federation` auth mode (preferred for cloud scanning); existing modes unchanged
- The JSON contract is reused across CLI, function, MAUI and browser — no duplication
- Cloud and local modes can coexist; users can switch without reinstalling

### Negative / Trade-offs

- `IDataProvider` abstraction adds indirection to the MAUI codebase
- Azure Function deployment requires Azure infrastructure setup (storage, function app, Managed Identity role assignments)
- Mode switching without restart requires a proxy pattern that adds a small amount of complexity
- HTML dashboard is limited to what the JSON endpoints expose (no server-side enrichment)

## Alternatives Considered

### Single mode only (local)
Rejected: the user explicitly requires scheduled cloud scanning without a running desktop.

### Embed npm library directly in MAUI via Node embedding
Rejected: already decided against in ADR-0002 for MVP. The function approach keeps
the integration boundary clean.

### Separate MAUI app for cloud mode
Rejected: unnecessary duplication. Mode switch in Settings is sufficient for MVP.

## Follow-up

All open questions raised by this ADR have been answered and applied:

| OQ | Decision |
|---|---|
| OQ-047 | Workload Identity Federation preferred; client-secret and certificate also supported |
| OQ-048 | MVP: same storage account as function runtime; separate account post-MVP |
| OQ-049 | Credentials via App Settings as Key Vault references (`AARM_SECRET_*` prefix) |
| OQ-050 | Two HTML endpoints: `/api/dashboard` (interactive shell+fetch) + `/api/report` (server-rendered snapshot) |
| OQ-051 | `DelegatingDataProvider` proxy pattern for MAUI mode switch without restart |
| OQ-052 | Handlebars.js for template rendering |
| OQ-053 | `cachePersistencePlugin` stays in core library (try/catch handles Linux correctly) |
