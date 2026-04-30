# /plan-next

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- `concept/11_skills_and_agents_plan.md`
- `references/README.md`, if it exists

Work in **concept mode only**.

## Task
Determine the next smallest useful planning increment for this project.

## Rules
- Do not generate production code.
- Do not create `src/`, `apps/`, `packages/`, `cli/`, `maui/`, `frontend/` or `backend/`.
- Prefer updating one concept file at a time.
- If a missing convention blocks progress, suggest updating `/references` first.
- If a decision is needed, say whether an ADR is required.
- If an assumption is needed, add or propose an entry for `concept/09_open_questions.md`.

## Return
1. Current concept status
2. Missing critical files or weak areas
3. Next recommended file to edit
4. Exact proposed change
5. Whether an ADR, reference update or open question update is required
