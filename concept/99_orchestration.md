# Orchestration Rules

## Goal

The orchestrator keeps the project in concept mode and routes work to the right planning area.

Claude must not rely on file numbering alone. The effective workflow is defined by:

1. `CLAUDE.md`
2. `concept/00_index.md`
3. `concept/99_orchestration.md`
4. `concept/11_skills_and_agents_plan.md`
5. active command in `.claude/commands`
6. relevant skills/agents
7. relevant concept, decision and reference files

## Default prompt flow

```text
User prompt
  |
  v
CLAUDE.md
  |
  v
concept/00_index.md
  |
  v
concept/99_orchestration.md
  |
  v
concept/11_skills_and_agents_plan.md
  |
  v
relevant command / skill / agent
  |
  +--> concept/*.md       product and architecture planning
  +--> decisions/*.md     binding decisions
  +--> references/*.md    standards, naming rules, factual notes
  +--> prompts/*.md       reusable human prompts
  +--> 09_open_questions  assumptions and unresolved items
```

## Task classification

For every user request, classify it into one of:

- project vision
- domain model
- permissions / preflight
- npm library design
- CLI design
- Log Analytics usage analysis
- MAUI Blazor UI design
- mockups
- ADR / decision
- reference / convention
- open questions
- implementation plan
- product code

## Routing

| Classification | Primary file | Suggested skill | Suggested command |
|---|---|---|---|
| project vision | `concept/01_project_vision.md` | `concept-orchestrate` | `/refine-concept` |
| domain model | `concept/02_domain_model.md` | `concept-review` | `/refine-concept` |
| permissions / preflight | `concept/03_permissions_and_preflight.md` | `permissions-preflight-design` | `/refine-preflight` |
| npm library design | `concept/04_npm_library_concept.md` | `npm-library-design` | `/refine-npm-library` |
| CLI design | `concept/05_cli_concept.md` | `cli-design` | `/refine-cli` |
| usage analysis | `concept/06_usage_analysis_log_analytics.md` | `usage-analysis-design` | `/refine-concept` |
| MAUI UI | `concept/07_maui_blazor_ui_concept.md` | `maui-blazor-ui-design` | `/refine-ui` |
| mockups | `concept/08_mockups.md` | `maui-blazor-ui-design` | `/refine-ui` |
| open questions | `concept/09_open_questions.md` | `concept-review` | `/update-open-questions` |
| implementation plan | `concept/10_implementation_plan.md` | `implementation-plan-design` | `/prepare-implementation` |
| skills/agents/commands | `concept/11_skills_and_agents_plan.md` | `concept-orchestrate` | `/project-check` |
| orchestration | `concept/99_orchestration.md` | `concept-orchestrate` | `/project-check` |
| ADR / decision | `/decisions` | `concept-review` | `/record-decision` |
| reference / convention | `/references` | `concept-review` | `/update-references` |
| consistency review | all planning files | `concept-review` | `/review-consistency` |
| MVP freeze | concept + ADRs | `implementation-plan-design` | `/freeze-mvp` |
| product code | blocked before approval | none | `/prepare-implementation` |

## File roles

```text
CLAUDE.md
  Project contract. Manual-owned.

concept/
  Product and architecture planning. Mostly Claude-assisted.

decisions/
  ADRs for binding decisions. Claude-assisted, user-approved.

references/
  Durable conventions, reusable standards and factual notes. Claude-maintained.

prompts/
  Reusable human prompts. Claude-assisted.

.claude/commands/
  Slash-command workflows. Claude-maintained.

.claude/skills/
  Reusable Claude workflows. Claude-assisted.

.claude/agents/
  Specialized roles. Claude-assisted.
```

Detailed ownership is defined in:

```text
references/file-ownership-and-editing-policy.md
```

## Reference usage rules

The `/references` folder is the project's durable reference library.

It contains:

- internal naming conventions
- repository structure conventions
- file ownership rules
- CLI naming conventions
- npm package conventions
- MAUI Blazor UI conventions
- terminology references
- external documentation summaries
- Microsoft Graph and Entra permission references
- Log Analytics and KQL reference notes

Claude must read relevant files in `/references` before changing concept documents when the task touches:

- naming
- folder structure
- command naming
- DTO naming
- API design
- permission mapping
- UI terminology
- KQL queries
- external Microsoft platform behavior
- manual-vs-Claude ownership

If a convention is introduced or changed, Claude must update the relevant file in `/references`.

If the convention represents an architectural decision, Claude must also create or update an ADR in `/decisions`.

## Maintenance rules

When a decision is made:

- create or update `/decisions/ADR-xxxx-title.md`

When an assumption is made:

- add it to `/concept/09_open_questions.md`

When an external fact is used:

- add a note to `/references`

When a repeated workflow emerges:

- create or update a skill in `.claude/skills`

When a reusable user prompt emerges:

- create or update a prompt in `/prompts`

When a slash workflow is useful:

- create or update a command in `.claude/commands`
- update `concept/11_skills_and_agents_plan.md`
- update `concept/00_index.md` if it becomes part of the standard inventory

## Maintenance rules for references

Update `/references` when:

- a naming convention is introduced or changed
- a folder structure convention is introduced or changed
- a file ownership rule is introduced or changed
- a CLI command naming pattern is introduced or changed
- a DTO, service, module or package naming pattern is introduced or changed
- a UI terminology convention is introduced or changed
- a Microsoft Graph permission mapping is researched
- a KQL query pattern is defined
- an external source is used as factual basis
- a reusable technical rule should be available across multiple concept files

Do not hide durable conventions inside one concept file only.

If a concept file introduces a convention, either:

1. move the convention to `/references`, or
2. explicitly link to the relevant reference file.

If a convention is binding for the architecture, also record the decision in `/decisions`.

## Trigger rules

### ADR trigger

Create or update an ADR when:

- a technology choice is made
- a boundary between npm library and MAUI UI is defined
- a permission model decision is made
- an MVP exclusion is decided
- a storage or security decision is made
- an implementation folder layout is approved
- a final package name or CLI name is approved

### Open-question trigger

Update `concept/09_open_questions.md` when:

- an assumption is introduced
- a tenant permission is unclear
- a UI behavior is not decided
- a library API shape is not final
- a feature is postponed but not rejected
- a reference contains an uncertain platform claim

### Reference trigger

Update `/references` when:

- Microsoft Graph documentation is used
- Azure Monitor / Log Analytics facts are used
- Entra permission facts are used
- .NET MAUI or Blazor technical constraints are used
- a naming pattern is defined
- a convention should be reused by more than one concept file

### Prompt trigger

Update `/prompts` when:

- a reusable human prompt was helpful
- a concept refinement prompt should be reused
- a workflow is not yet stable enough to become a skill or command

### Skill trigger

Create or update a skill when:

- the same workflow is repeated more than twice
- a workflow needs a checklist
- a workflow has file-reading rules
- a workflow should be invokable or discoverable as reusable Claude behavior

### Command trigger

Create or update a command when:

- the user needs a short slash-command entry point
- the workflow is stable enough to reuse
- the workflow should read a predictable set of files
- the workflow must block product code or enforce a gate

## Product code requests

If the user asks for product code before concept freeze:

1. Check `concept/10_implementation_plan.md`.
2. If implementation is not approved:
   - refuse product code generation briefly
   - explain what concept section is missing
   - update the relevant concept file instead
3. Do not create production source folders.

## Planning update rule

When updating a concept file:

- read the current file first
- preserve existing decisions unless explicitly changed
- add open questions for uncertainty
- update ADRs for durable decisions
- update `/references` for durable conventions
- respect `references/file-ownership-and-editing-policy.md`

## Final response rule

When Claude changes files:

- list changed files
- summarize what changed
- mention open questions added
- mention ADRs or references updated
- propose one next step

## ASCII: Which file pulls which file?

```text
CLAUDE.md
   |
   +--> concept/00_index.md
   |        |
   |        +--> Which concept files exist?
   |        +--> What status do they have?
   |        +--> Which command inventory is active?
   |
   +--> concept/99_orchestration.md
   |        |
   |        +--> What task type is this?
   |        +--> Which command/skill/agent applies?
   |        +--> Is code allowed?
   |
   +--> concept/11_skills_and_agents_plan.md
   |        |
   |        +--> Which commands exist?
   |        +--> Which skills and agents should be used?
   |
   +--> decisions/
   |        |
   |        +--> Are there binding architecture decisions?
   |        +--> Is a new ADR required?
   |
   +--> references/
   |        |
   |        +--> Are there durable conventions?
   |        +--> Are there platform facts or naming rules?
   |
   +--> .claude/commands/
            |
            +--> Which repeatable workflow is invoked?
```
