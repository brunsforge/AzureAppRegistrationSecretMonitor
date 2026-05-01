# Project Vision

## Working Title

**Azure App Registration Secret Monitor**

## Problem

Client Secrets in Microsoft Entra App Registrations expire. When the real consumer of a secret is unknown, teams often discover the dependency only after authentication breaks.

There is no single Microsoft view that reliably tells where a secret is stored in all customer-owned systems. The tenant can tell which App Registrations and credentials exist. Sign-in logs can tell whether a credential was used. The exact storage location still requires configuration analysis and owner knowledge.

## Product Goal

Build a tool that helps teams:

- list App Registrations and secrets
- identify expiring and expired secrets
- assess which secrets are actively used
- understand which permissions are available in the current tenant
- guide users to likely remediation locations
- document and historicize checks
- prepare safe secret rotation without waiting for production failures

## Planned Applications

### 1. npm Library / CLI

The npm package is the technical core.

It should:

- authenticate against Microsoft Entra ID
- call Microsoft Graph
- list App Registrations
- list `passwordCredentials`
- calculate expiry status
- run preflight checks
- optionally query Log Analytics
- produce stable JSON for tools and UI

### 2. .NET MAUI Blazor UI

The UI is a local desktop application.

It should:

- manage tenants and environments
- trigger CLI commands
- import CLI JSON output
- store history locally
- show dashboards and details
- hide or disable features based on capability results
- guide users through analysis and rotation planning
- run in the background once closed
- show a tray icon with context menu entries

## MVP Scope

Read-only monitoring first.

MVP includes:

- tenant/environment configuration concept
- authentication modes concept
- Graph-based listing of App Registrations and secrets
- expiry calculation
- preflight/capability model
- CLI command design
- JSON output schema
- MAUI Blazor screen concept
- local history concept (JSON files; SQLite in Phase 2)
- usage analysis concept (concept complete in planning; implementation in Phase 2 after secret listing MVP)
- system tray (background running and tray icon with context menu; confirmed MVP by OQ-043)

## Explicit Non-MVP

Not part of the first implementation:

- automatic creation of new secrets
- deletion of old secrets
- automatic App Registration creation
- automatic Power Platform connection updates
- automatic Azure App Settings updates
- automatic Key Vault updates
- automatic Azure DevOps variable group updates
- tenant-wide remediation

These can be later phases gated by capability checks.

## Key Design Principle

The system must be useful with minimal read-only permissions, but it must be designed to unlock additional functions when higher privileges are available.

This is why preflight and capability detection must be implemented from the start.
