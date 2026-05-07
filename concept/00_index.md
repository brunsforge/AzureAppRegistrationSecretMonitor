# Concept Index

This folder is the source of truth for the planning phase.

Claude must not use the numbering mechanically. The numbering gives reading order. Task classification decides which file is relevant.

## Primary reading sequence

```text
CLAUDE.md
  -> concept/00_index.md
  -> concept/99_orchestration.md
  -> concept/11_skills_and_agents_plan.md
  -> relevant command / skill / agent
  -> relevant concept + decision + reference files
```

## Concept status matrix

| File | Status | Owner mode | Primary purpose | Must read before |
|---|---|---|---|---|
| `01_project_vision.md` | MVP-stable | Claude-assisted | Product vision, scope and boundaries | all major planning |
| `02_domain_model.md` | MVP-stable | Claude-assisted | Shared language and core entities | permissions, npm, CLI, UI |
| `03_permissions_and_preflight.md` | MVP-stable | Claude-assisted | Permissions, capability model and security gates | npm, CLI, UI |
| `04_npm_library_concept.md` | MVP-stable | Claude-assisted | npm library architecture and module boundaries | CLI, UI integration |
| `05_cli_concept.md` | MVP-stable | Claude-assisted | CLI command surface and automation behavior | MAUI integration, implementation |
| `06_usage_analysis_log_analytics.md` | MVP-stable | Claude-assisted | KQL, Log Analytics and usage analysis | UI analytics, implementation |
| `07_maui_blazor_ui_concept.md` | MVP-stable | Claude-assisted | Desktop UI architecture and screens | mockups, implementation |
| `08_mockups.md` | MVP-stable | Claude-assisted | Textual UI sketches | implementation |
| `09_open_questions.md` | Active | Claude-maintained | Unresolved questions and assumptions | every planning update |
| `10_implementation_plan.md` | Approved | Claude-assisted | Implementation increments after concept stabilization | product code |
| `11_skills_and_agents_plan.md` | Active | Claude-assisted | Claude skills, agents and command conventions | orchestration changes |
| `12_azure_function_cloud_mode.md` | Draft | Claude-assisted | Azure Function cloud deployment and MAUI Cloud Mode | cloud implementation |
| `99_orchestration.md` | Active | Manual-owned | How Claude should route and maintain work | every command |

## Supporting directories

| Directory | Purpose | Maintenance rule |
|---|---|---|
| `/decisions` | ADRs for binding architecture decisions | update when durable decisions are made |
| `/references` | Durable standards, conventions and factual notes | update when reusable rules or external facts appear |
| `/prompts` | Reusable human prompts | update when prompt patterns should be reused |
| `.claude/commands` | Slash-command workflows | keep aligned with skills and concept files |
| `.claude/skills` | Reusable Claude workflows | keep short and focused |
| `.claude/agents` | Specialized roles | keep aligned with orchestration |

## Command inventory

| Command | Purpose |
|---|---|
| `/plan-next` | Determine next smallest planning increment |
| `/project-check` | Check planning/template structure and missing files |
| `/refine-concept` | Refine one concept area |
| `/refine-preflight` | Refine permissions, preflight and capability model |
| `/refine-npm-library` | Refine npm library modules and contracts |
| `/refine-cli` | Refine CLI command surface and JSON contracts |
| `/refine-ui` | Refine MAUI Blazor UI screens and mockups |
| `/review-consistency` | Review consistency across all planning files |
| `/update-open-questions` | Maintain unresolved assumptions and questions |
| `/apply-answered-questions` | Propagate answered open questions into affected concept, ADR and reference files |
| `/record-decision` | Create or update ADRs |
| `/update-references` | Maintain durable conventions and factual references |
| `/prepare-implementation` | Check implementation readiness |
| `/freeze-mvp` | Freeze MVP scope and classify features |

## Rule

If a planning change affects more than one file, update all affected files or add an item to `09_open_questions.md`.

## No-code gate

Product code is blocked until `10_implementation_plan.md` explicitly marks the MVP as implementation-ready and the user approves implementation.

## File ownership

Ownership rules are defined in:

```text
references/file-ownership-and-editing-policy.md
```
