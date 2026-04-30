# ADR-0002: MAUI Blazor UI Consumes CLI JSON

## Status

Proposed

## Context

The project combines a Node/TypeScript npm library with a .NET MAUI Blazor desktop UI.

Directly embedding Node logic inside MAUI would increase complexity in the MVP.

## Decision

For MVP, the MAUI Blazor UI will consume the npm package through its CLI.

The CLI must provide stable JSON output.

## Consequences

Positive:

- clear boundary between engine and UI
- CLI remains independently useful
- easier testing
- avoids Node embedding in MAUI
- enables automation and scheduled jobs

Negative:

- process invocation must be handled carefully
- JSON schema compatibility matters
- CLI installation/bundling must be decided

## Follow-up

Define JSON schemas before implementation.
