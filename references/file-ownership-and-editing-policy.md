# File Ownership and Editing Policy

This file defines which files are primarily edited by the user and which files Claude is expected to maintain.

The goal is to avoid unclear ownership and accidental overwrite of manually curated project rules.

## Ownership classes

| Class | Meaning | Edit behavior |
|---|---|---|
| Manual-owned | The user is the primary editor. Claude may suggest changes but should not overwrite without explicit request. | Ask before editing. |
| Claude-assisted | The user and Claude may both edit. Claude may update when the task requires it. | Edit carefully and summarize. |
| Claude-maintained | Claude is expected to maintain this file as part of project workflows. | Edit when triggered by commands/rules. |

## File ownership matrix

| Path | Ownership | Notes |
|---|---|---|
| `CLAUDE.md` | Manual-owned | Project contract. Claude may propose changes or edit only when asked. |
| `README.md` | Claude-assisted | Human-facing entry point. Keep concise and current. |
| `concept/00_index.md` | Claude-assisted | Status matrix and navigation. Keep synchronized with concept files. |
| `concept/01_project_vision.md` | Claude-assisted | Product intent and MVP boundaries. |
| `concept/02_domain_model.md` | Claude-assisted | Shared language. Must stay consistent with references. |
| `concept/03_permissions_and_preflight.md` | Claude-assisted | Core security/capability model. |
| `concept/04_npm_library_concept.md` | Claude-assisted | npm library design. |
| `concept/05_cli_concept.md` | Claude-assisted | CLI design and JSON contracts. |
| `concept/06_usage_analysis_log_analytics.md` | Claude-assisted | Log Analytics / KQL analysis design. |
| `concept/07_maui_blazor_ui_concept.md` | Claude-assisted | UI architecture and screens. |
| `concept/08_mockups.md` | Claude-assisted | Wireframes/mockups. |
| `concept/09_open_questions.md` | Claude-maintained | Must be updated whenever assumptions or unresolved details appear. |
| `concept/10_implementation_plan.md` | Claude-assisted | Must not approve implementation without user confirmation. |
| `concept/11_skills_and_agents_plan.md` | Claude-assisted | Tracks skills, agents and commands. |
| `concept/99_orchestration.md` | Manual-owned | Routing and maintenance rules. Claude may suggest or edit only when asked. |
| `decisions/*.md` | Claude-assisted | ADRs. User should approve binding decisions. |
| `references/*.md` | Claude-maintained | Durable conventions and reusable factual notes. |
| `prompts/*.md` | Claude-assisted | Reusable human prompts. |
| `.claude/commands/*.md` | Claude-maintained | Slash-command workflows. |
| `.claude/skills/*/SKILL.md` | Claude-assisted | Reusable workflows. Keep short and focused. |
| `.claude/agents/*.md` | Claude-assisted | Specialized roles. Keep aligned with commands/skills. |
| `.claude/settings.json` | Manual-owned | Project settings. Claude should not change without explicit request. |

## Editing rules for Claude

Claude must:

1. Read the relevant file before editing it.
2. Preserve manual-owned files unless the user explicitly requests changes.
3. Summarize every changed file.
4. Add unresolved assumptions to `concept/09_open_questions.md`.
5. Add durable conventions to `/references`.
6. Add binding decisions to `/decisions`.
7. Avoid broad rewrites when a targeted edit is enough.

## User editing guidance

The user can manually edit any file, but should prefer:

- `CLAUDE.md` for high-level project rules.
- `concept/99_orchestration.md` for routing and maintenance behavior.
- `references/file-ownership-and-editing-policy.md` for ownership rules.
- `references/project-naming-conventions.md` for naming standards.
- `concept/09_open_questions.md` for personal notes that should become project questions.
