# /update-open-questions

Read first:
- `CLAUDE.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- `concept/11_skills_and_agents_plan.md`
- `concept/09_open_questions.md`
- the concept, ADR or reference file currently being discussed

Work in **concept mode only**.

## Task

Maintain `concept/09_open_questions.md` as the active clarification log for the project.

Use this command when:
- new assumptions appear
- a concept file has unresolved decisions
- the user answered a question manually
- a question should be reclassified, superseded or blocked
- answered questions should be prepared for `/apply-answered-questions`

## Required entry format

Each open question should use this structure when possible:

```markdown
## OQ-0000: Short question title

**Status:** Open | In Review | Answered | Decided | Applied | Superseded | Blocked  
**Owner:** Manual / Claude-assisted / Security / npm / CLI / UI / Implementation  
**Related files:**  
- `concept/...`
- `references/...`
- `decisions/...`

**Question:**  
The unresolved question.

**Answer / Decision:**  
Only fill this when the user or an ADR has clarified the answer.

**Impact:**  
Files or concepts that must be updated after the answer is applied.

**Next action:**  
Recommended command or manual step.
```

## Status rules

- `Open`: unresolved and needs clarification.
- `In Review`: Claude/user is actively refining it.
- `Answered`: user supplied an answer, but it has not yet been propagated.
- `Decided`: answer is binding and should normally have or require an ADR.
- `Applied`: answer has been propagated into affected concept/reference/ADR files.
- `Superseded`: no longer relevant because another decision replaced it.
- `Blocked`: cannot be answered until another external fact/decision exists.

## Rules

- Do not delete answered questions. Keep traceability.
- Do not turn assumptions into facts. Mark them as `Open` or `Blocked`.
- Do not hide architectural decisions only in `09_open_questions.md`; create or update an ADR when needed.
- If a user writes an answer into the file, keep it and set status to `Answered` unless it is already applied.
- If a question introduces a reusable convention, add or update a file under `/references`.
- Keep entries short, actionable and linked to affected files.

## Return

1. Questions added
2. Questions updated
3. Questions marked as `Answered`, `Decided`, `Applied`, `Superseded` or `Blocked`
4. Questions requiring `/apply-answered-questions`
5. Questions requiring `/record-decision`
6. Questions requiring `/update-references`
