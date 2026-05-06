# Implementation Plan

## Status

**Approved — Phase 1 implementation in progress.**

Concept freeze accepted 2026-05-01. ADRs 0001–0006 accepted. Concept files 01–08 MVP-stable.

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

## Code Generation Gate

Before Phase 1 begins, the user must explicitly approve implementation with wording similar to:

```text
Concept freeze accepted. Start Phase 1 implementation.
```

Without this approval, Claude must continue planning only.
