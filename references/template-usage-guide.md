# Project Template Usage Guide

This repository can be reused as a planning-first Claude project template.

## Goal of the template

The template creates a disciplined planning environment where Claude:

1. reads a project contract,
2. classifies the task,
3. routes the work to the right concept area,
4. maintains open questions,
5. records binding decisions as ADRs,
6. stores durable conventions in references,
7. avoids implementation code until the concept is approved.

## Recommended startup flow

```text
/project-check
/plan-next
```

If the project is newly created or heavily changed, run:

```text
/review-consistency
```

## Recommended planning flow

```text
/refine-concept
/refine-preflight
/refine-npm-library
/refine-cli
/refine-ui
```

## Recommended maintenance flow

```text
/update-references
/update-open-questions
/record-decision
```

## Recommended implementation gate

```text
/freeze-mvp
/prepare-implementation
```

## How to adapt this template for another project

1. Rename product and short name in `references/project-naming-conventions.md`.
2. Rewrite `concept/01_project_vision.md`.
3. Rewrite `concept/02_domain_model.md`.
4. Adjust commands only if the project has different planning workstreams.
5. Keep `CLAUDE.md`, `00_index`, `99_orchestration` and the ownership policy aligned.
6. Run `/project-check`.
7. Run `/review-consistency`.
