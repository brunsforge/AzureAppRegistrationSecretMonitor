# /project-check

Read first:
- `CLAUDE.md`
- `README.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- `concept/11_skills_and_agents_plan.md`
- `decisions/*`
- `references/README.md`, if it exists
- `.claude/commands/*`

Work in **concept mode only**.

## Task
Check whether the planning system is internally consistent and usable as a project template.

## Verify
- All concept files listed in `concept/00_index.md` exist.
- Commands listed in `concept/11_skills_and_agents_plan.md` exist.
- Reference files mentioned by orchestration rules exist.
- ADRs exist for binding architecture decisions.
- Manual-owned, Claude-assisted and Claude-maintained files are clearly distinguished.
- No product code folders exist before concept freeze.
- No durable convention is hidden only inside a concept file.
- `concept/09_open_questions.md` contains unresolved items instead of undocumented assumptions.

## Rules
- Do not generate production code.
- Do not silently fix broad issues unless the user asked for it.
- Prefer a short consistency report with concrete file-level fixes.

## Return
1. Consistency result: green / yellow / red
2. Inconsistencies found
3. Missing steering files
4. Missing reference files
5. Missing ADRs
6. Recommended next cleanup step
