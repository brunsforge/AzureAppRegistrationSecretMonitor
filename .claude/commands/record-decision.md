# /record-decision

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- Existing files in `/decisions`
- Related concept and reference files

Work in **concept mode only**.

## Task
Create or update an Architecture Decision Record under `/decisions`.

## ADR triggers
Create or update an ADR when:
- a technology choice is made
- a boundary between npm library and MAUI UI is defined
- a permission/security model decision is made
- an MVP exclusion is decided
- storage, credential, authentication or deployment strategy is decided

## ADR format
Use:
- Title
- Status
- Context
- Decision
- Consequences
- Related files

## Rules
- Use sequential file names: `ADR-0003-short-title.md`.
- Do not overwrite old ADRs unless the user explicitly wants to supersede them.
- If an ADR introduces conventions, update `/references` too.
- If an ADR resolves open questions, update `concept/09_open_questions.md`.

## Return
1. ADR created or updated
2. Decision summary
3. Concept/reference files that should be aligned
4. Open questions resolved or added
