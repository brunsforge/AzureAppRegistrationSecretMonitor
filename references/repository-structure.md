# Repository Structure Reference

This reference defines the planning repository structure before implementation begins.

## Current structure

```text
AzureAppRegistrationSecretMonitor/
  CLAUDE.md
  README.md
  concept/
  decisions/
  references/
    examples/         ← example configs and templates (not deployed; reference only)
  prompts/
  scripts/            ← local publish and build automation scripts
  infra/              ← Bicep templates for Azure infrastructure (Function App, Storage, Key Vault, AI)
  tools/
    postman/          ← Postman collection and environment for the Azure Function API
  .claude/
    commands/
    skills/
    agents/
    settings.json
```

## Concept phase rule

Do not create production implementation folders until implementation is explicitly approved.

Blocked before implementation approval:

```text
src/
packages/
apps/
cli/
maui/
frontend/
backend/
```

## Implementation structure

Decided by ADR-0006:

```text
packages/
  core/          ← npm library (@brunsforge/azure-app-registration-monitor)
  cli/           ← CLI entry point (aarm binary)
apps/
  maui-blazor/   ← .NET MAUI Blazor desktop application
```

`packages/` uses npm workspaces. `apps/maui-blazor/` is a .NET solution outside the npm workspace.

These folders must not be created until Phase 1 implementation is explicitly approved by the user.
