# npm and CLI Conventions

## Package naming

Preferred package name candidate:

```text
@brunsforge/entra-secret-monitor
```

Alternative:

```text
@brunsforge/azure-app-secret-monitor
```

The final package name requires an ADR before publishing.

## CLI command name

Preferred command name:

```text
asm
```

## Command style

Use noun-first command groups and kebab-case parameters.

Examples:

```bash
asm tenants list
asm tenants add
asm preflight run
asm apps list
asm secrets list
asm secrets expiring --months 3
asm usage analyze --app-id <client-id> --days 360
asm report markdown
```

## Output modes

Supported output modes should be designed as:

```bash
--output table
--output json
--output markdown
```

The MAUI Blazor UI consumes only stable JSON output.

## Exit-code convention draft

| Exit code | Meaning |
|---:|---|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Authentication failed |
| 4 | Authorization/capability missing |
| 5 | External service unavailable |
| 6 | Findings found above configured threshold |

## Security convention

The CLI must not store client secrets in plain JSON files.
Use placeholders in examples and prefer OS credential storage or secure secret stores.
