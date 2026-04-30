# References

This folder is the project's durable reference library.

It is used for standards, conventions and factual notes that should be reused across concept files, commands, skills and agents.

## What belongs here

- Naming conventions
- Repository and folder conventions
- Manual-vs-Claude file ownership rules
- CLI command conventions
- npm package conventions
- .NET MAUI Blazor UI conventions
- Terminology references
- Microsoft Graph and Entra permission notes
- Azure Monitor / Log Analytics / KQL notes
- Source summaries and external documentation notes

## What does not belong here

- Product scope decisions that should be ADRs
- Temporary notes that belong in `concept/09_open_questions.md`
- Implementation code
- Real credentials, tenant IDs, secrets or tokens

## Maintenance rules

- If a rule is reused by more than one concept file, it belongs here.
- If a convention changes, update the matching reference file.
- If the convention represents a binding architecture decision, also create or update an ADR in `/decisions`.
- If a concept file introduces a convention, either move the convention here or explicitly link to the matching reference file.
