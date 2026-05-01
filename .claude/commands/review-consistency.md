# /review-consistency

Read first:
- `CLAUDE.md`
- `README.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- `concept/11_skills_and_agents_plan.md`
- all `concept/*.md`
- all `decisions/*.md`
- all `references/*.md`
- all `.claude/commands/*.md`
- all `.claude/skills/*/SKILL.md`
- all `.claude/agents/*.md`

Work in **concept mode only**.

## Task

Review consistency across the complete planning/template set.

Use this command after:
- adding or changing commands
- updating orchestration rules
- answering open questions
- changing naming conventions
- adding ADRs or references
- preparing for implementation readiness

## Check for

### Structure
- Commands listed in `concept/00_index.md` exist under `.claude/commands`.
- Commands listed in `concept/11_skills_and_agents_plan.md` exist under `.claude/commands`.
- Skills and agents referenced by orchestration files exist.
- Supporting folders are documented in `references/repository-structure.md`.

### No-code gate
- No product implementation folders were created before approval.
- Commands, skills and agents still explicitly block product code during concept phase.
- `concept/10_implementation_plan.md` still controls implementation readiness.

### Concept consistency
- No contradictions between vision, domain model, permissions, npm library, CLI, usage analysis and UI concepts.
- Concept files link to relevant references where durable conventions are used.
- Open questions are not already answered elsewhere without being updated.

### ADR and references
- Binding architecture decisions are captured in `/decisions`.
- Durable conventions and reusable factual notes are captured in `/references`.
- Naming conventions are not duplicated inconsistently across concept files.

### Open questions
- `Answered` questions have clear impact lists.
- `Answered` questions that are not yet propagated are candidates for `/apply-answered-questions`.
- `Decided` questions have or request an ADR.
- `Applied` questions are actually reflected in the target files.

### Manual vs Claude ownership
- Files that are manual-owned are not silently overwritten.
- Claude-maintained files have clear maintenance rules.
- User-editable files are documented in `references/file-ownership-and-editing-policy.md`.

## Rules

- Do not generate production code.
- Prefer reporting first.
- Only edit files when the user explicitly asks for fixes.
- If you find contradictions, report the smallest safe fix.
- If you find missing commands or references, list exact files to add.

## Return

1. Overall consistency status: green / yellow / red
2. Critical contradictions
3. Soft inconsistencies
4. Missing or stale command references
5. Open questions that should be applied
6. ADRs that should be created or updated
7. References that should be created or updated
8. Suggested fixes in priority order
