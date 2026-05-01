# ADR-0004: Local History Storage Strategy

## Status

Accepted

## Context

OQ-021 asked whether history should be stored in SQLite from the start.

The MAUI Blazor UI needs to persist scan results and history locally. Two candidates were identified: SQLite (queryable, relational) and JSON files (simple, no dependency).

## Decision

- **Phase 1 (MVP):** Local history and scan results are stored as JSON files in the local cache directory.
- **Phase 2:** SQLite is introduced for queryable history, diff comparisons, and advanced reporting.

## Consequences

Positive:
- Phase 1 implementation requires only JSON file I/O; no ORM or SQLite dependency.
- Simpler MAUI app shell for MVP.
- The CLI cache already uses JSON files for tenant profiles, so the pattern is consistent.

Negative:
- Phase 1 history is not queryable beyond basic file reads.
- Phase 2 must provide a migration path from JSON to SQLite or introduce SQLite in parallel.

## Constraint

The MAUI app must use a storage abstraction so Phase 2 can introduce SQLite without restructuring Phase 1 screens.

## Follow-up

- Design Phase 2 increment to add SQLite with a migration or parallel storage path.
- Ensure `07_maui_blazor_ui_concept.md` and `10_implementation_plan.md` reflect this phasing.
