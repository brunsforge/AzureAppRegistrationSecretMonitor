# Claude Skills, Commands and Agents Plan

## Purpose

This project uses Claude project-level commands, skills and agents to keep planning disciplined.

The goal is not to create a fully autonomous implementation system yet. The first goal is to make Claude reliably operate in concept mode.

## Conventions

Project-scoped Claude files live in:

```text
.claude/
  commands/
  skills/
  agents/
  settings.json
```

Personal, cross-project Claude files live in:

```text
%USERPROFILE%\.claude
```

This project should prefer project-scoped commands and skills so behavior travels with the repository.

## Commands

Commands are the user-facing entry points.

| Command | Purpose | Primary files |
|---|---|---|
| `/plan-next` | Determine the next smallest planning increment | `00_index`, `99_orchestration` |
| `/project-check` | Check planning/template consistency | all steering files |
| `/refine-concept` | Refine one concept area | target concept + references |
| `/refine-preflight` | Refine permission/preflight/capability model | `03`, `06`, references |
| `/refine-npm-library` | Refine npm package architecture/contracts | `04`, `05`, references |
| `/refine-cli` | Refine CLI command surface/output contracts | `05`, CLI references |
| `/refine-ui` | Refine MAUI Blazor UI and mockups | `07`, `08`, UI references |
| `/review-consistency` | Check contradictions across all planning files | all concept/ADR/reference files |
| `/update-open-questions` | Maintain unresolved questions | `09_open_questions` |
| `/apply-answered-questions` | Apply answered questions consistently | `09_open_questions`, impacted concept/ADR/reference files |
| `/record-decision` | Create/update ADRs | `/decisions` |
| `/update-references` | Maintain durable conventions/facts | `/references` |
| `/prepare-implementation` | Check if implementation may start | `10_implementation_plan` |
| `/freeze-mvp` | Freeze and classify MVP scope | vision + implementation plan |

## Initial skills

| Skill | Purpose |
|---|---|
| `concept-orchestrate` | Classify a user task and route to the right concept file/agent. |
| `concept-review` | Check whether concept files are consistent and complete. |
| `permissions-preflight-design` | Work on Graph, Entra, Azure RBAC and capability model. |
| `npm-library-design` | Work on npm package architecture, API boundaries and JSON contracts. |
| `cli-design` | Work on command structure, output contracts and exit codes. |
| `maui-blazor-ui-design` | Work on UI screens, navigation, local history and CLI integration. |
| `usage-analysis-design` | Work on KQL, Log Analytics and sign-in log analysis. |
| `implementation-plan-design` | Turn approved concepts into implementation increments. |

## Initial agents

| Agent | Purpose |
|---|---|
| `asm-orchestrator` | Main planning router. |
| `asm-concept-architect` | Maintains product vision, domain model and concept consistency. |
| `asm-security-architect` | Maintains permissions, preflight and security boundaries. |
| `asm-npm-library-architect` | Designs npm library and CLI contracts. |
| `asm-maui-blazor-architect` | Designs MAUI Blazor application and UX. |
| `asm-implementation-planner` | Creates increments only after concept maturity. |
| `asm-documentation-curator` | Keeps concept docs, ADRs and open questions tidy. |

## Command vs skill vs agent

| Type | Use when | Example |
|---|---|---|
| Command | User wants to trigger a repeatable workflow | `/refine-preflight` |
| Skill | Claude needs a reusable work method | `permissions-preflight-design` |
| Agent | A focused role should inspect a topic | `asm-security-architect` |

## How Claude should develop these first

Before product code is generated, Claude should refine the project steering system itself.

Suggested first checks:

```text
/project-check
/review-consistency
/update-references
/apply-answered-questions
```

Skill improvement rules:

- keep skills short
- give each skill one purpose
- state which concept files it must read
- state which files it may update
- explicitly block product code where relevant
- add open questions instead of inventing risky details

## Maintenance expectations

When a new command is added:

- update this file
- update `concept/00_index.md` if the command is part of the standard inventory
- update `concept/99_orchestration.md` if routing behavior changes
- update `/references` if the command introduces a durable convention
