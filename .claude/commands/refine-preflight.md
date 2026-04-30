# /refine-preflight

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/02_domain_model.md`
- `concept/03_permissions_and_preflight.md`
- `concept/06_usage_analysis_log_analytics.md`
- `concept/07_maui_blazor_ui_concept.md`
- `references/entra-permissions-reference.md`, if it exists
- `references/log-analytics-kql-reference.md`, if it exists
- Related ADRs in `/decisions`

Work in **concept mode only**.

## Task
Refine the permission, preflight and capability model.

## Must cover
- Graph permissions per feature.
- Azure RBAC / Log Analytics permissions per feature.
- Read-only MVP capabilities.
- Later write capabilities such as creating/deleting secrets.
- Capability flags and naming.
- UI enable/disable/hide behavior per capability.
- Failure modes and diagnostic messages.

## Rules
- Do not invent permissions silently. Mark uncertain permissions as open questions.
- Do not design write operations as MVP unless an ADR explicitly approves it.
- Move reusable permission mappings to `/references/entra-permissions-reference.md`.

## Return
1. Capability model changes
2. Permission mapping changes
3. UI gating changes
4. Open questions
5. ADRs required
