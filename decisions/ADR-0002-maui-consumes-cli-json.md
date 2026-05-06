# ADR-0002: MAUI Blazor UI Consumes CLI JSON

## Status

Accepted

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

## CLI bundling

The MAUI Blazor app bundles the npm CLI binary for MVP.

The CLI must also be usable as a standalone npm package independent of MAUI.

No HTTP bridge is needed for MVP. Process invocation with JSON output is the only integration boundary.

The specific bundling mechanism is decided in **ADR-0007**: esbuild bundles the TypeScript CLI to `aarm.js`; a pre-built `keytar.node` and a pinned `node.exe` (Node.js LTS) are shipped alongside in a `cli/` subfolder of the install directory. MAUI invokes `cli\node.exe cli\aarm.js [args]`.

## Follow-up

- Define JSON schemas before implementation.
- See ADR-0007 for CLI build automation and bundle layout details.
