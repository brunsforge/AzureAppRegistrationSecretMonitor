# CLI Concept

## Purpose

The CLI is the operational surface of the npm package.

It must support human usage and machine usage.

## Naming

Working command name:

```bash
asm
```

Alternative:

```bash
entra-secret-monitor
```

Final name is open.

## Global Options

```bash
--tenant <name-or-id>
--environment <name>
--config <path>
--output table|json|markdown|csv
--verbose
--debug
--no-color
```

## Tenant Commands

```bash
asm tenants list
asm tenants add
asm tenants validate
asm tenants remove
```

## Preflight Commands

```bash
asm preflight run --tenant prod
asm preflight show --tenant prod
asm preflight explain --tenant prod
```

## App and Secret Commands

```bash
asm apps list
asm apps show --appId <client-id>

asm secrets list
asm secrets expiring --days 30
asm secrets expiring --months 3
asm secrets expired
asm secrets show --appId <client-id>
asm secrets show-key --keyId <secret-key-id>
```

## Usage Analysis Commands

```bash
asm usage analyze --appId <client-id> --days 360
asm usage analyze-secret --keyId <secret-key-id> --days 360
asm usage last-seen --appId <client-id>
asm usage rotation-check --appId <client-id> --oldKeyId <secret-key-id> --days 14
```

## Report Commands

```bash
asm report expiring --months 3 --output markdown
asm report tenant-summary --output json
asm report findings --severity high --output csv
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
