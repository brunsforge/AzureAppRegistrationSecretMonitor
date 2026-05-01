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
  ConfigStore abstraction   // reads/writes JSON cache; never stores secret values
  CredentialStore abstraction // delegates to OS credential storage

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

**Decided by OQ-010:** Client Secret, Device Code and Interactive Browser are mandatory for MVP.

| Mode | MVP | Description | Redirect URI needed |
|---|---|---|---|
| Client Secret | Mandatory | App-only service authentication | No |
| Device Code | Mandatory | Interactive user login without local redirect | No |
| Interactive Browser | Mandatory | OAuth authorization code flow via browser and loopback redirect | Yes, localhost redirect |
| Certificate | Optional | App-only service authentication with certificate | No |
| Azure CLI Credential | Optional | Developer convenience; delegates to `az` CLI token cache | No |

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

## Local Config Cache

**Decided by OQ-011:** The CLI stores tenant profiles in a local JSON cache directory.

Rules:
- Non-sensitive profile data (tenant ID, display name, environment slug, auth mode, workspace ID) is stored in JSON files.
- Secret values (client secret key material) must never be stored in plain JSON files. They must be stored in the OS credential store.
- **Decided by OQ-012 and ADR-0005:** The npm CLI uses `keytar` (Windows Credential Manager) for storing client secret values.
- The cache directory location defaults to a platform-appropriate user data folder and can be overridden with `--config-dir`.

## Important Design Decision

The MAUI Blazor UI should consume the CLI rather than directly importing the npm library in-process.

Reason:

- avoids Node embedding in MAUI MVP
- keeps UI and engine loosely coupled
- makes the CLI useful independently
- enables CI/CD and scheduled automation
