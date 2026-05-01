# /apply-answered-questions

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- `concept/11_skills_and_agents_plan.md`
- `concept/09_open_questions.md`
- all `decisions/*.md`
- all relevant `references/*.md`
- all concept files listed in the `Impact` sections of answered questions

Work in **concept mode only**.

## Task

Apply answered open questions consistently across the planning repository.

This command is used after the user manually answers one or more entries in `concept/09_open_questions.md`.

## What to apply

Process only questions with one of these statuses:

- `Answered`
- `Decided`

Do not apply questions with these statuses unless the user explicitly requests it:

- `Open`
- `In Review`
- `Blocked`
- `Superseded`
- `Applied`

## Workflow

For each `Answered` or `Decided` question:

1. Read the `Answer / Decision` section.
2. Read the `Impact` section.
3. Identify all affected concept, reference and ADR files.
4. Update affected concept files so the answer is reflected in the product plan.
5. Update `/references` when the answer creates a durable convention, naming rule, permission rule or reusable factual note.
6. Create or update an ADR when the answer is a binding architecture decision.
7. Update the question status:
   - `Answered` -> `Applied` when propagated.
   - `Decided` -> `Applied` only when the ADR/reference/concept impact has been handled.
8. Add a short `Applied note` to the question with the files changed.

## ADR trigger

Create or update an ADR if the answer decides:
- technology choice
- architecture boundary
- authentication strategy
- permission model
- local storage strategy
- npm/CLI vs MAUI integration boundary
- MVP inclusion/exclusion with long-term impact

## Reference trigger

Create or update a reference if the answer defines:
- naming convention
- folder convention
- CLI command pattern
- DTO/service naming pattern
- UI terminology
- Graph permission mapping
- KQL query pattern
- reusable technical standard

## Safety rules

- Do not invent answers for open questions.
- Do not apply ambiguous answers; mark them `In Review` and explain the ambiguity.
- Do not generate production code.
- Do not create `/src`, `/app`, `/packages` or implementation folders.
- Do not overwrite manual-owned files without explicit user instruction.
- Preserve traceability in `concept/09_open_questions.md`.

## Return

1. Questions applied
2. Files changed
3. ADRs created or updated
4. References created or updated
5. Questions skipped and why
6. Remaining follow-up questions
7. Recommended next command, usually `/review-consistency`
