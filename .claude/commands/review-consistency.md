# /review-consistency

Read first:
- `CLAUDE.md`
- `README.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- all `concept/*.md`
- all `decisions/*.md`
- all `references/*.md`
- `.claude/commands/*`
- `.claude/skills/*/SKILL.md`
- `.claude/agents/*`

Work in **concept mode only**.

## Task
Review consistency across the complete planning/template set.

## Check for
- Contradictions between concept files.
- Missing cross-links between concept, references and ADRs.
- Commands that reference missing files.
- Skills or agents that conflict with no-code gate.
- Decisions hidden in concept files but missing ADRs.
- References that are outdated or incomplete.
- Manual vs Claude ownership ambiguity.

## Rules
- Do not generate production code.
- Prefer reporting first. Only edit files when the user explicitly asks for fixes.

## Return
1. Consistency status
2. Critical contradictions
3. Soft inconsistencies
4. Missing files or weak references
5. Suggested fixes in priority order
