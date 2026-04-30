# Azure App Registration Secret Monitor

This repository is currently a **planning/template repository**.

It defines the concept, orchestration rules and Claude workflows for building an **Entra App Registration Secret Monitor**. Product code is intentionally blocked until the concept is stable and the implementation plan is approved.

## High-level product concept

The planned product consists of two applications:

### 1. npm Library / CLI

The npm package is the technical core.

It will:

- authenticate against Microsoft Entra ID
- read App Registrations and `passwordCredentials` through Microsoft Graph
- identify expired and expiring secrets
- run tenant/environment preflight checks
- expose a capability model
- optionally query Log Analytics for Service Principal sign-in usage
- produce stable JSON for automation and the desktop UI

### 2. .NET MAUI Blazor UI

The MAUI Blazor app is the local desktop UI.

It will:

- manage tenants and environments
- run preflight checks
- show capability-based UI states
- display secret inventory, risks and details
- consume the CLI JSON output
- store local history
- provide guided remediation hints

## Current mode

```text
Concept Phase. No production code.
```

Do not create product implementation folders before implementation approval:

```text
src/
packages/
apps/
cli/
maui/
frontend/
backend/
```

Implementation starts only after `concept/10_implementation_plan.md` explicitly marks the MVP as implementation-ready and the user approves it.

## Repository map

```text
CLAUDE.md                 Project contract for Claude
README.md                 Human entry point

concept/                  Product and architecture concept
decisions/                Architecture Decision Records
references/               Durable conventions, standards and factual notes
prompts/                  Reusable human prompts

.claude/
  commands/               Slash-command workflows
  skills/                 Reusable Claude workflows
  agents/                 Specialized Claude roles
  settings.json           Project-level Claude settings
```

## Most important files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project contract and no-code gate |
| `concept/00_index.md` | Concept index, status matrix and reading map |
| `concept/99_orchestration.md` | Routing, maintenance and trigger rules |
| `concept/11_skills_and_agents_plan.md` | Skills, agents and commands inventory |
| `references/file-ownership-and-editing-policy.md` | Defines manual-owned vs Claude-maintained files |
| `references/README.md` | Explains how the reference library is used |
| `decisions/ADR-0001-no-code-before-concept-freeze.md` | Binding no-code-before-concept-freeze decision |

## How to start with Claude

Recommended first prompt after opening the repository in Claude Code:

```text
/project-check
```

Then:

```text
/plan-next
```

For focused work:

```text
/refine-preflight
/refine-npm-library
/refine-cli
/refine-ui
```

For consistency and maintenance:

```text
/review-consistency
/update-references
/update-open-questions
/record-decision
```

For later implementation readiness:

```text
/freeze-mvp
/prepare-implementation
```

## Manual vs Claude-owned files

The ownership model is defined in:

```text
references/file-ownership-and-editing-policy.md
```

Short version:

| Area | Default owner |
|---|---|
| `CLAUDE.md` | Manual-owned |
| `concept/99_orchestration.md` | Manual-owned |
| `.claude/settings.json` | Manual-owned |
| `concept/*.md` | Claude-assisted |
| `concept/09_open_questions.md` | Claude-maintained |
| `references/*.md` | Claude-maintained |
| `.claude/commands/*.md` | Claude-maintained |
| `decisions/*.md` | Claude-assisted, user-approved |

## Key architecture principles

- Concept before code.
- Read-only monitoring MVP first.
- No write/remediation features in MVP unless explicitly approved.
- Every tenant/environment is evaluated through a preflight check.
- UI features are enabled, disabled or hidden based on capabilities.
- Durable conventions belong in `/references`.
- Binding decisions belong in `/decisions`.
- Assumptions and unresolved items belong in `concept/09_open_questions.md`.
- CLI JSON is the MVP integration boundary between npm core and MAUI Blazor UI.
