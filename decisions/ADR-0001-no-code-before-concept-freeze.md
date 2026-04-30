# ADR-0001: No Product Code Before Concept Freeze

## Status

Accepted for planning phase.

## Context

The project contains two connected applications:

1. npm Library / CLI
2. .NET MAUI Blazor UI

Starting implementation too early would create unstable boundaries, duplicated logic and unclear security assumptions.

## Decision

No production code will be generated until the concept phase is complete and the user explicitly approves implementation.

Claude must not create source folders or product code during concept phase.

## Consequences

Positive:

- clearer architecture
- stable CLI/UI boundary
- better permission model
- safer security design
- less rework

Negative:

- implementation starts later
- some technical assumptions remain to be validated by prototypes

## Implementation Gate

Implementation starts only after the user explicitly says:

```text
Concept freeze accepted. Start Phase 1 implementation.
```
