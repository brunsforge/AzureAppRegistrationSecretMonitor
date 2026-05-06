# Claude Project Instructions

## Project

Project name: **Azure App Registration Secret Monitor**

The project targets Microsoft Entra ID App Registration Client Secret monitoring.

The planned product consists of two applications:

1. **npm Library / CLI**
   - Reads Microsoft Entra App Registrations and client secrets through Microsoft Graph.
   - Lists, filters and evaluates expiring or expired `passwordCredentials`.
   - Performs permission and capability preflight checks.
   - Optionally analyzes Service Principal Sign-in Logs through Azure Monitor / Log Analytics.
   - Produces structured JSON output for automation and UI consumption.

2. **.NET MAUI Blazor UI**
   - Provides a local desktop UI.
   - Manages tenants and environments.
   - Runs the CLI as a local engine and consumes JSON output.
   - Stores check history locally.
   - Shows dashboards, secret details, preflight/capability status and guided remediation hints.

## Current Phase

This repository is in **phase 1, concept is freezed **.

Do not create production code yet.

Do not create source folders such as:

- `src/`
- `packages/`
- `apps/`
- `cli/`
- `maui/`
- `frontend/`
- `backend/`

unless the implementation plan explicitly says implementation is allowed.

## Concept Source of Truth

All planning output belongs in `/concept`.

Claude must read and reference:

1. `concept/00_index.md`
2. the most relevant concept file for the current task
3. `concept/09_open_questions.md`
4. `decisions/`

Do not rely on numbering alone. Numbering defines reading order, but the instructions in this file and in `concept/00_index.md` define how the documents are used.

## Planning Workflow

For every task:

1. Classify the task:
   - concept clarification
   - domain model
   - security / permissions / preflight
   - npm library design
   - CLI design
   - Log Analytics usage analysis
   - MAUI Blazor UI design
   - mockup design
   - implementation planning
   - code generation

2. Select the relevant concept file.

3. If information is missing:
   - ask a concise question, or
   - document the assumption in `concept/09_open_questions.md`.

4. If a durable architectural decision is made:
   - add or update an ADR in `/decisions`.

5. If the user asks for code before concept freeze:
   - do not generate product code.
   - explain which concept section must be finished first.
   - update the relevant concept file instead.

## Definition of Concept Freeze

Implementation may start only when all of these are true:

- `concept/01_project_vision.md` is stable.
- `concept/02_domain_model.md` is stable.
- `concept/03_permissions_and_preflight.md` is stable.
- `concept/04_npm_library_concept.md` is stable.
- `concept/05_cli_concept.md` is stable.
- `concept/06_usage_analysis_log_analytics.md` is stable.
- `concept/07_maui_blazor_ui_concept.md` is stable.
- `concept/08_mockups.md` contains enough UI sketches for MVP.
- `concept/10_implementation_plan.md` is approved.
- `decisions/ADR-0001-no-code-before-concept-freeze.md` is accepted.


## Repository Usage Rules

Claude must use repository areas as follows:

| Area | Purpose |
|---|---|
| `/concept` | Product and architecture planning. |
| `/decisions` | Binding Architecture Decision Records. |
| `/references` | Durable conventions, reusable standards and factual notes. |
| `/prompts` | Reusable human-facing prompts. |
| `.claude/commands` | Slash-command workflows. |
| `.claude/skills` | Reusable Claude workflows. |
| `.claude/agents` | Specialized Claude roles. |

Before changing planning files, Claude must read:

1. `CLAUDE.md`
2. `concept/00_index.md`
3. `concept/99_orchestration.md`
4. `concept/11_skills_and_agents_plan.md`
5. relevant files in `/references`
6. relevant ADRs in `/decisions`

For file ownership rules, read:

```text
references/file-ownership-and-editing-policy.md
```

Claude must not treat folder names alone as instructions. The effective workflow is defined by `CLAUDE.md`, `concept/00_index.md`, `concept/99_orchestration.md`, `concept/11_skills_and_agents_plan.md` and the active command in `.claude/commands`.


## Output Style

Prefer concise, structured planning increments.

Avoid large undifferentiated text blocks.

Use:

- short sections
- tables where useful
- explicit assumptions
- explicit open questions
- explicit next step

## Security Rules

Never write real secrets, tenant IDs, client secrets, access tokens, refresh tokens or credentials into repository files.

Use placeholders:

- `<tenant-id>`
- `<client-id>`
- `<workspace-id>`
- `<secret-key-id>`
- `<dataverse-url>`

Do not suggest storing client secrets in plain local JSON files. If secrets are needed for local development, recommend OS credential storage or a secure secret store.

## Core Product Principle

The tool must start with a **read-only monitoring MVP**.

Write operations such as creating secrets, deleting secrets, creating App Registrations or modifying cloud resources are optional later features and must be gated by explicit capability checks.

## Capability-Based UI Rule

The MAUI Blazor UI must not expose features statically.

Every tenant/environment must run a preflight check. The UI must enable, disable or hide features based on the resulting capability model.

Examples:

- can read applications
- can read secrets
- can read owners
- can query Log Analytics
- can analyze Service Principal Sign-in Logs
- can create secrets
- can delete secrets
- can create App Registrations

## Preferred Integration Boundary

The .NET MAUI Blazor app should not embed Node.js logic directly in the MVP.

Preferred MVP integration:

- npm package exposes a CLI.
- CLI returns stable JSON.
- MAUI app invokes the CLI process and imports JSON results.
- Later alternatives can be evaluated by ADR.

## Important Project Terms

Use these terms consistently:

- Tenant
- Environment
- App Registration
- Service Principal
- Password Credential
- Secret
- Key ID
- Hint
- Owner
- Preflight Check
- Capability
- Finding
- Risk Level
- Usage Analysis
- Log Analytics Workspace
- Service Principal Sign-in Logs
- Guided Rotation
- Remediation Hint
