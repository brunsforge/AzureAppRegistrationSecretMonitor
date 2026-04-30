# /refine-cli

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/04_npm_library_concept.md`
- `concept/05_cli_concept.md`
- `references/npm-cli-conventions.md`, if it exists
- `references/project-naming-conventions.md`
- Related ADRs in `/decisions`

Work in **concept mode only**.

## Task
Refine the CLI command surface and automation behavior.

## Must cover
- Command names and parameter names.
- Output modes: table, JSON, Markdown.
- Stable JSON contract for the MAUI app.
- Exit codes.
- Error envelope.
- CI/CD behavior.
- Configuration file behavior without storing secrets insecurely.

## Rules
- Do not create CLI source code.
- CLI command naming conventions belong in `/references/npm-cli-conventions.md`.
- If the CLI/MAUI integration contract changes, update ADR-0002 or create a new ADR.

## Return
1. Commands refined
2. Output contracts refined
3. Exit/error behavior refined
4. References updated
5. Open questions
