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

## Core application services

These singleton services are registered in the DI container and are available to all pages:

| Service | Responsibility |
|---|---|
| `AppInitializationService` | Runs at startup: creates directories, verifies CLI path, loads last preflight results |
| `AppStateService` | Holds active `TenantProfile` and `EnvironmentProfile`; raises `OnChange` event on selection change |
| `ICliLocatorService` | Resolves the `aarm` binary path; debug mode reads from config, release mode uses `AppContext.BaseDirectory` |
| `CliExecutionService` | Invokes the CLI process and returns parsed JSON output |

## MVP integration rule

The MAUI Blazor app invokes the CLI and consumes stable JSON output.
It should not embed Node.js logic directly in the MVP.
