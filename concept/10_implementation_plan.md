# Implementation Plan

## Status

Pending user approval for code generation.

All concept files are MVP-stable. ADRs 0001–0006 are accepted. Open questions OQ-001 through OQ-044 are Applied or In Review without blocking MVP Phase 1.

To unlock code generation, the user must explicitly say:

```text
Concept freeze accepted. Start Phase 1 implementation.
```

This document defines the planned implementation increments. It does not yet authorize product code.

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

## Phase 5: History

Goal:

- store scan results as JSON files (decided by ADR-0004; SQLite in Phase 2)
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

## Code Generation Gate

Before Phase 1 begins, the user must explicitly approve implementation with wording similar to:

```text
Concept freeze accepted. Start Phase 1 implementation.
```

Without this approval, Claude must continue planning only.
