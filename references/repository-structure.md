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
  prompts/
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

## Future implementation structure candidates

These are candidates only. They must not be created before concept freeze.

```text
packages/
  npm-core/
  cli/
apps/
  maui-blazor/
```

or:

```text
src/
  npm/
  cli/
  maui-blazor/
```

A final implementation layout requires an ADR.
