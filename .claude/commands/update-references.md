# /update-references

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- `concept/11_skills_and_agents_plan.md`
- `references/README.md`, if it exists
- Related concept and ADR files

Work in **concept mode only**.

## Task
Update or create reference files for durable project standards, naming conventions, external facts or reusable technical patterns.

## Use `/references` for
- naming conventions
- repository structure conventions
- CLI command conventions
- npm package conventions
- .NET MAUI Blazor conventions
- terminology
- Microsoft Graph notes
- Entra permission notes
- Log Analytics / KQL notes
- source summaries and external facts

## Rules
- Do not create production code.
- Do not change implementation files.
- Prefer `/references` for reusable conventions used by multiple concept files.
- Use `/decisions` only for binding decisions.
- Update `concept/09_open_questions.md` if unresolved assumptions appear.

## Return
1. Changed reference files
2. Conventions added or changed
3. Whether an ADR is required
4. Open questions added
