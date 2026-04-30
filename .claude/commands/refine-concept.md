# /refine-concept

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- `concept/09_open_questions.md`
- Related files in `/references`
- Related ADRs in `/decisions`

Work in **concept mode only**.

## Task
Refine one concept area without creating product code.

## Required behavior
- Identify the target concept file from the user's request.
- Read the current target file before editing.
- Preserve existing decisions unless explicitly changed.
- Move durable naming, structure or terminology rules to `/references`.
- Create or update ADRs for binding decisions.
- Update `concept/09_open_questions.md` for assumptions or unresolved details.

## Return
1. Target concept file
2. Summary of changes
3. Reference files updated or needed
4. ADRs updated or needed
5. Open questions added
6. Next small planning step
