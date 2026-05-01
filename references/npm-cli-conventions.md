# npm and CLI Conventions

## Package naming

Package name (decided by ADR-0003):

```text
@brunsforge/azure-app-registration-monitor
```

## CLI binary name

Binary name (decided by ADR-0003):

```text
aarm
```

## Command style

Use noun-first command groups and kebab-case parameters.

Examples:

```bash
aarm tenants list
aarm tenants add
aarm preflight run
aarm apps list
aarm secrets list
aarm secrets expiring --months 3
aarm usage analyze --app-id <client-id> --days 360
aarm report markdown
```

## Output modes

Supported output modes should be designed as:

```bash
--output table
--output json
--output markdown
```

The MAUI Blazor UI consumes only stable JSON output.

## Exit-code convention

| Exit code | Meaning |
|---:|---|
| 0 | Success |
| 1 | General error |
| 2 | Authentication failed |
| 3 | Missing permission or capability |
| 4 | Configuration invalid |
| 5 | No data source available (e.g. Log Analytics not configured) |
| 10 | Findings found above configured threshold (CI threshold mode) |

## Security convention

The CLI must not store client secrets in plain JSON files.
Use placeholders in examples and prefer OS credential storage or secure secret stores.

**Decided by ADR-0005:** Use `keytar` (Windows Credential Manager) for storing client secret values in the npm CLI.
