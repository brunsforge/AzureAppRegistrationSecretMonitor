---
name: concept-orchestrate
description: Classify Azure App Registration Secret Monitor planning tasks and route them to the right concept files. Use when the user asks what to do next, how to proceed, or asks for broad planning.
---


# Skill: Concept Orchestrator

## Mission

Keep the project in concept mode and route work to the right planning document.

## Required Reads

- `CLAUDE.md`
- `concept/00_index.md`
- `concept/99_orchestration.md`
- `concept/09_open_questions.md`

## Workflow

1. Classify the user request.
2. Identify the target concept file.
3. Check whether the request would create product code.
4. If yes and concept freeze is not approved, do not create code.
5. Update concept files only.
6. Add unresolved items to `concept/09_open_questions.md`.
7. If a durable decision appears, create or update an ADR.

## Output

- changed files
- short summary
- open questions
- one next step
