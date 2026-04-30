# .NET MAUI Blazor UI Conventions

## UI principle

The UI is capability-based. It must not statically expose actions that the current tenant/environment cannot perform.

## Naming

| Element | Convention | Example |
|---|---|---|
| Page | `*Page` | `TenantOverviewPage` |
| Component | `*Card`, `*Panel`, `*Table`, `*Dialog` | `SecretRiskCard` |
| View model | `*ViewModel` | `TenantOverviewViewModel` |
| Service | `*Service` | `CliExecutionService` |
| Repository | `*Repository` | `TenantConfigRepository` |

## Screen states

Every feature screen should define:

- loading state
- success state
- empty state
- missing capability state
- authentication/authorization error state
- external service unavailable state

## MVP integration rule

The MAUI Blazor app invokes the CLI and consumes stable JSON output.
It should not embed Node.js logic directly in the MVP.
