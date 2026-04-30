# npm Library Concept

## Purpose

The npm package is the reusable core for tenant authentication, Microsoft Graph access, secret inventory, expiry analysis, preflight checks and optional Log Analytics usage analysis.

It should be usable as:

- library from TypeScript/Node
- CLI engine
- automation component in scheduled jobs
- JSON provider for the MAUI Blazor desktop application

## Package Responsibilities

The package should provide:

- authentication adapters
- Graph client creation
- App Registration listing
- Secret/passwordCredential extraction
- expiry status calculation
- owner/service principal enrichment
- preflight/capability checks
- usage analysis via Log Analytics
- report generation
- normalized errors

## Proposed Modules

```text
auth/
  AuthProviderFactory
  AuthMode
  TokenDiagnostics

config/
  TenantProfile
  EnvironmentProfile
  ConfigStore abstraction

graph/
  GraphApplicationReader
  GraphServicePrincipalReader
  GraphOwnerReader

secrets/
  SecretInventoryService
  SecretStatusCalculator
  SecretRiskClassifier

preflight/
  PreflightService
  CapabilityEvaluator
  PermissionHintMapper

usage/
  LogAnalyticsClient
  UsageAnalysisService
  KqlQueryFactory

reporting/
  JsonReporter
  MarkdownReporter
  CsvReporter

errors/
  AuthError
  PermissionError
  GraphError
  LogAnalyticsError
```

## Authentication Modes

Initial concepts:

| Mode | Description | Redirect URI needed |
|---|---|---|
| Client Secret | App-only service authentication | No |
| Certificate | App-only service authentication | No |
| Device Code | Interactive user login without local redirect | No |
| Interactive Browser | User login via browser and loopback redirect | Yes, localhost redirect |
| Azure CLI Credential | Optional developer convenience | No app-specific redirect in this tool |

## Library Boundary

The library should not know about MAUI.

It should return plain data structures that the CLI can serialize.

The CLI output must be stable enough for the MAUI app to consume.

## Output Contract Principle

Every CLI command intended for UI consumption must support:

```bash
--output json
```

and return a stable schema with:

- `success`
- `data`
- `warnings`
- `errors`
- `metadata`

## Example Result Envelope

```json
{
  "success": true,
  "metadata": {
    "tenantId": "<tenant-id>",
    "environmentName": "PROD",
    "generatedAt": "2026-04-30T00:00:00Z",
    "toolVersion": "0.1.0"
  },
  "data": {},
  "warnings": [],
  "errors": []
}
```

## Important Design Decision

The MAUI Blazor UI should consume the CLI rather than directly importing the npm library in-process.

Reason:

- avoids Node embedding in MAUI MVP
- keeps UI and engine loosely coupled
- makes the CLI useful independently
- enables CI/CD and scheduled automation
