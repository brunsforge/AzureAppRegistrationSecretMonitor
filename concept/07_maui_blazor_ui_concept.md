# .NET MAUI Blazor UI Concept

## Purpose

The UI provides a local desktop application for users who do not want to work directly with CLI commands.

## Technology

- .NET MAUI Blazor Hybrid
- Local desktop app
- Local history store
- CLI process integration for secret scanning and usage analysis

## MVP Integration with npm CLI

Preferred integration:

1. User configures tenant/environment in the UI.
2. UI calls the npm CLI as a local process.
3. CLI returns JSON.
4. UI validates JSON schema.
5. UI stores results locally.
6. UI renders dashboard/detail screens.

This avoids embedding Node.js directly in MAUI for MVP.

## Main Screens

### Tenant Overview

Shows configured tenants and environments.

Fields:

- tenant display name
- tenant ID
- environment name
- auth mode
- last preflight
- last scan
- status

Actions:

- add tenant
- edit tenant
- run preflight
- scan secrets

### Preflight Detail

Shows capability result for a tenant/environment.

Sections:

- authentication
- Graph capabilities
- Log Analytics capabilities
- write capabilities
- missing permissions
- warnings
- disabled features

### Dashboard

Cards:

- total App Registrations
- total secrets
- expiring in 30 days
- expiring in 90 days
- expired
- without owner
- recently used
- unknown usage

### Secret List

Columns:

- risk
- app name
- client ID
- secret display name
- key ID
- hint
- expires on
- days left
- owner
- last seen
- usage status

Filters:

- tenant
- environment
- risk
- expiry window
- owner
- usage status
- search by app name or client ID

### Secret Detail

Sections:

- metadata
- expiry status
- owners
- usage analysis
- sign-in evidence
- likely locations
- remediation checklist
- history

### Guided Rotation View

Not MVP write automation.

MVP can provide manual checklist:

1. Create new secret in Entra.
2. Store new secret safely.
3. Update consumers.
4. Trigger smoke tests.
5. Watch old key ID usage.
6. Remove old secret after safe waiting period.

### History

Stores:

- scan timestamp
- tenant/environment
- app count
- secret count
- findings
- preflight result
- usage summaries
- changes since previous scan

## Capability-Based UI

The UI must use the preflight result.

Examples:

| Missing Capability | UI Behavior |
|---|---|
| Cannot read applications | Dashboard blocked with setup guidance |
| Cannot read owners | Owner filter hidden |
| Cannot query Log Analytics | Usage tab disabled |
| Cannot create secrets | Rotation automation hidden |
| Cannot delete secrets | Old-secret removal hidden |

## Local Storage

Potential options:

- SQLite for history and queryable results
- JSON files for early prototype
- OS credential store for sensitive local auth references

No clear-text secrets in local app settings.
