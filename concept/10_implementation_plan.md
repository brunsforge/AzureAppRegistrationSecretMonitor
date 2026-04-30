# Implementation Plan

## Status

Not approved for code generation yet.

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

## Phase 5: History

Goal:

- store scan results
- compare scans
- show changes over time

## Phase 6: Log Analytics Usage Analysis

Goal:

- configure workspace per environment
- execute KQL
- summarize app/secret usage
- show last-seen and old-key usage

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
