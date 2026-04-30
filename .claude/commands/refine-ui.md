# /refine-ui

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/03_permissions_and_preflight.md`
- `concept/07_maui_blazor_ui_concept.md`
- `concept/08_mockups.md`
- `references/maui-blazor-ui-conventions.md`, if it exists
- `references/project-naming-conventions.md`
- Related ADRs in `/decisions`

Work in **concept mode only**.

## Task
Refine the .NET MAUI Blazor UI concept and mockups.

## Must cover
- Page structure.
- Navigation flow.
- Tenant/environment management.
- Preflight/capability status display.
- Secret dashboard.
- Secret detail view.
- Usage analysis view.
- Local history view.
- UI states when capabilities are missing.

## Rules
- Do not create Razor, C#, CSS or project files.
- Use ASCII/wireframe mockups in `concept/08_mockups.md`.
- UI naming conventions belong in `/references/maui-blazor-ui-conventions.md`.

## Return
1. UI screens refined
2. Mockups updated
3. Capability-based UI changes
4. References updated
5. Open questions
