# Project Naming Conventions

## Product names

| Context | Name |
|---|---|
| Repository / project folder | `AzureAppRegistrationSecretMonitor` |
| Short name | `ASM` |
| User-facing name | `Entra App Registration Secret Monitor` |
| Working CLI command | `asm` |

## Repository areas

- `/concept` contains product and architecture concepts.
- `/decisions` contains ADRs.
- `/references` contains reusable standards, conventions and factual references.
- `/prompts` contains reusable human prompts.
- `.claude/commands` contains slash-command workflows.
- `.claude/skills` contains reusable Claude workflows.
- `.claude/agents` contains specialized Claude roles.

## Concept file naming

Use numeric prefixes for reading order.

Example:

```text
03_permissions_and_preflight.md
```

## ADR naming

Use:

```text
ADR-0001-short-title.md
```

Example:

```text
ADR-0001-no-code-before-concept-freeze.md
```

## Claude command naming

Claude commands use kebab-case.

Examples:

```text
plan-next.md
review-consistency.md
update-references.md
```

## npm package naming

Package name candidate:

```text
@brunsforge/entra-secret-monitor
```

Alternative:

```text
@brunsforge/azure-app-secret-monitor
```

The final npm package name should be confirmed by ADR before publishing.

## TypeScript naming draft

- Services: `*Service`
- Clients: `*Client`
- DTOs: `*Dto`
- Results: `*Result`
- Options: `*Options`
- Errors: `*Error`
- Capability flags: `can*`

Examples:

- `GraphApplicationService`
- `SecretInventoryService`
- `PreflightService`
- `UsageAnalysisService`
- `TenantConfigDto`
- `SecretInventoryResult`
- `PreflightResult`
- `CapabilitySet`

## .NET MAUI Blazor naming draft

- Pages: `*Page`
- Components: `*Card`, `*Panel`, `*Table`, `*Dialog`
- Services: `*Service`
- View models: `*ViewModel`
- Local storage/repository classes: `*Repository`

Examples:

- `TenantOverviewPage`
- `SecretDashboardPage`
- `PreflightStatusPanel`
- `SecretRiskCard`
- `TenantConfigRepository`
