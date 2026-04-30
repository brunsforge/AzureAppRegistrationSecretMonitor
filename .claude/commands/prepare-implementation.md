# /prepare-implementation

Read first:
- `CLAUDE.md`
- `README.md`
- `concept/00_index.md`
- `concept/10_implementation_plan.md`
- `concept/09_open_questions.md`
- all relevant concept files
- all `decisions/*.md`
- all `references/*.md`

Work in **implementation readiness review mode**.

## Task
Check whether the project is ready to move from concept phase to implementation phase.

## Gate conditions
Implementation may start only when:
- Core concept files are stable or explicitly accepted as MVP-stable.
- MVP scope is frozen.
- Domain model is consistent.
- Preflight/capability model is sufficient.
- npm library contract is defined.
- CLI JSON output contract is defined.
- MAUI UI MVP screens are sketched.
- Open questions do not block MVP implementation.
- ADR-0001 still allows implementation or has been superseded.

## Rules
- Do not create product code.
- Do not create implementation folders.
- Produce a readiness report and missing checklist.

## Return
1. Ready: yes/no
2. Blocking gaps
3. Non-blocking gaps
4. Required ADRs before code
5. Exact next action before implementation
