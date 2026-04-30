# /refine-npm-library

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/02_domain_model.md`
- `concept/03_permissions_and_preflight.md`
- `concept/04_npm_library_concept.md`
- `concept/05_cli_concept.md`
- `references/project-naming-conventions.md`
- `references/npm-cli-conventions.md`, if it exists
- Related ADRs in `/decisions`

Work in **concept mode only**.

## Task
Refine the npm library architecture and contracts.

## Must cover
- Package boundaries.
- Services and responsibilities.
- DTO/result/error contracts.
- Authentication modes.
- Preflight service interface.
- Secret inventory service interface.
- Usage analysis service interface.
- JSON contracts consumed by CLI and MAUI UI.

## Rules
- Do not create TypeScript source files.
- Use TypeScript-like pseudotypes only when useful inside concept docs.
- Durable naming rules belong in `/references`.
- If the library/UI boundary changes, update or create an ADR.

## Return
1. Library modules refined
2. Contracts refined
3. Naming/reference updates
4. ADR impact
5. Open questions
