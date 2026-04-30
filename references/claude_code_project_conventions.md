# Claude Code Project Conventions

## CLAUDE.md

`CLAUDE.md` is project memory/instructions. It should contain durable, concise project instructions and workflows.

It is not an enforcement mechanism like a compiler. It guides Claude, but vague or conflicting instructions may be ignored.

## Commands

Project commands should live in:

```text
.claude/commands/<command-name>.md
```

Use commands as short, repeatable slash-command entry points for the user.

Commands should:

- state which files must be read first
- define the task
- explicitly block product code where relevant
- define expected output
- link to references or ADRs when needed

## Skills

Project skills should live in:

```text
.claude/skills/<skill-name>/SKILL.md
```

Use skills for repeatable workflows and procedures that Claude may invoke when relevant.

## Agents

Project agents should live in:

```text
.claude/agents/<agent-name>.md
```

Use agents for focused roles, especially when a side task should not flood the main context.

## Settings

Project settings live in:

```text
.claude/settings.json
```

Local private settings live in:

```text
.claude/settings.local.json
```

Local settings should not be committed.

## Recommended pattern for this project

- `CLAUDE.md`: durable project rules and no-code gate
- `.claude/commands`: user-facing slash workflows
- `.claude/skills`: repeatable planning workflows
- `.claude/agents`: specialized planning roles
- `concept`: source of truth for planning
- `decisions`: ADRs for durable decisions
- `references`: conventions, standards and factual notes
- `prompts`: reusable human prompts that are not yet commands/skills
