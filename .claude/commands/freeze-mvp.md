# /freeze-mvp

Read first:
- `CLAUDE.md`
- `concept/01_project_vision.md`
- `concept/02_domain_model.md`
- `concept/03_permissions_and_preflight.md`
- `concept/04_npm_library_concept.md`
- `concept/05_cli_concept.md`
- `concept/06_usage_analysis_log_analytics.md`
- `concept/07_maui_blazor_ui_concept.md`
- `concept/08_mockups.md`
- `concept/09_open_questions.md`
- `concept/10_implementation_plan.md`
- Relevant ADRs and references

Work in **MVP scope review mode**.

## Task
Review and freeze the MVP scope.

## Must classify features as
- MVP
- Post-MVP
- Explicitly out of scope
- Open / needs decision

## Rules
- Do not create product code.
- If MVP is frozen, update `concept/01_project_vision.md` and `concept/10_implementation_plan.md`.
- Create an ADR if the MVP boundary is a durable decision.
- Move postponed features to open questions or post-MVP section.

## Return
1. MVP features
2. Post-MVP features
3. Out-of-scope features
4. Remaining blockers
5. ADR/reference updates required
