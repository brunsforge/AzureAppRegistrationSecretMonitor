# ADR-0006: Implementation Folder Layout

## Status

Accepted

## Context

`references/repository-structure.md` documents two candidate layouts and states that a final implementation layout requires an ADR before any source folders are created.

The project contains:
- A TypeScript/Node npm library (`@brunsforge/azure-app-registration-monitor`)
- A Node CLI entry point (`aarm` binary)
- A .NET MAUI Blazor desktop application

## Decision

Use a `packages/` + `apps/` monorepo layout within the existing repository:

```text
packages/
  core/             ← npm library (@brunsforge/azure-app-registration-monitor)
  cli/              ← CLI entry point (aarm binary)
apps/
  maui-blazor/      ← .NET MAUI Blazor desktop application
  azure-function/   ← Azure Functions v4 cloud scanning engine (Phase 9)
```

The `packages/` directory uses npm workspaces. `apps/azure-function/` is also included
in the npm workspace so it can reference `packages/core` via the workspace protocol.
`apps/maui-blazor/` is a .NET solution and is not part of the npm workspace.

## Rationale

- `packages/` + `apps/` is idiomatic for JavaScript/TypeScript monorepos and clearly separates npm-publishable packages from the .NET application.
- `core/` and `cli/` are separate npm packages so the library can be published independently of the CLI wrapper.
- `apps/maui-blazor/` is a .NET solution; it is intentionally outside the npm workspace.
- This layout matches the first candidate documented in `references/repository-structure.md`.

## Consequences

Positive:
- Library and CLI are independently publishable to npm.
- MAUI app is clearly separated from the npm ecosystem.
- Standard npm workspace tooling applies to `packages/`.
- Each package has its own `package.json`, `tsconfig.json` and test scope.

Negative:
- Two separate build systems (Node/npm and .NET) coexist in one repository.
- CI pipelines must handle both ecosystems.

## Constraint

These folders must not be created until Phase 1 implementation is explicitly approved by the user.

## Related files

- `references/repository-structure.md`
- `concept/10_implementation_plan.md`
- `decisions/ADR-0001-no-code-before-concept-freeze.md`
