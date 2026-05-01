# ADR-0003: npm Package Name and CLI Binary Name

## Status

Accepted

## Context

OQ-001 asked for the final name for the npm package and CLI binary.

Options considered were `asm`, `entra-secret-monitor`, and a user-chosen alternative.

## Decision

- **npm package:** `@brunsforge/azure-app-registration-monitor`
- **GitHub repository:** `brunsforge/azure-app-registration-monitor`
- **CLI binary name:** `aarm`

The CLI binary name `aarm` is the natural acronym of **A**zure **A**pp **R**egistration **M**onitor.

## Consequences

- All concept files, references and CLI command examples must use `aarm` as the binary name.
- The npm scope `@brunsforge` is the publisher identity on the npm registry.
- Package name and CLI binary are frozen for MVP planning.

## Follow-up

- All CLI command examples in concept files and references are updated from `asm` to `aarm`.
- Final confirmation of CLI binary name `aarm` is recommended before first npm publish.
