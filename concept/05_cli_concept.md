# CLI Concept

## Purpose

The CLI is the operational surface of the npm package.

It must support human usage and machine usage.

## Naming

CLI binary (decided by ADR-0003):

```bash
aarm
```

## Global Options

```bash
--tenant <name-or-id>
--environment <name>
--config-dir <path>
--output table|json|markdown|csv
--verbose
--debug
--no-color
```

`--config-dir` overrides the default cache directory for tenant profiles and config files.

## Tenant Commands

```bash
aarm tenants list
aarm tenants add
aarm tenants validate
aarm tenants remove
```

## Preflight Commands

```bash
aarm preflight run --tenant prod
aarm preflight show --tenant prod
aarm preflight explain --tenant prod
```

## App and Secret Commands

```bash
aarm apps list
aarm apps show --app-id <client-id>

aarm secrets list
aarm secrets expiring --days 30
aarm secrets expiring --months 3
aarm secrets expired
aarm secrets show --app-id <client-id>
aarm secrets show-key --key-id <secret-key-id>
```

## Automatic History Persistence

When `aarm secrets list` completes successfully, it automatically persists the result to the local history store as a side effect (decided by OQ-045).

- No dedicated `aarm scan` command exists in the MVP.
- Persistence happens after the result JSON is produced, before the process exits.
- Persistence failures must not cause a non-zero exit code; they are reported as warnings in the output envelope only.
- The history file location follows the same cache directory as tenant profiles and is configurable via `--config-dir`.

## Usage Analysis Commands

```bash
aarm usage analyze --app-id <client-id> --days 360
aarm usage analyze-secret --key-id <secret-key-id> --days 360
aarm usage last-seen --app-id <client-id>
aarm usage rotation-check --app-id <client-id> --old-key-id <secret-key-id> --days 14
```

## Report Commands

```bash
aarm report expiring --months 3 --output markdown
aarm report tenant-summary --output json
aarm report findings --severity high --output csv
```

## Expected Exit Codes

| Exit Code | Meaning |
|---|---|
| 0 | Successful command. |
| 1 | General error. |
| 2 | Authentication failed. |
| 3 | Missing permission or capability. |
| 4 | Configuration invalid. |
| 5 | No data source available, e.g. Log Analytics not configured. |
| 10 | Findings found above configured threshold, useful for CI. |

## Machine Output Rule

When `--output json` is used:

- no decorative text
- no spinner text
- no color escape sequences
- stable envelope schema
- warnings/errors inside JSON
- non-zero exit only for real command failure, unless threshold mode is explicitly enabled

## Human Output Rule

When `--output table` is used:

- concise table
- risk coloring may be allowed
- include next-step hint
- avoid overwhelming output by default
