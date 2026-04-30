# Open Questions

## Product / Scope

| ID | Question | Status |
|---|---|---|
| OQ-001 | Final package/CLI name: `asm`, `entra-secret-monitor`, or another name? | Open |
| OQ-002 | Should DEV/TEST/PROD be user-defined labels only, or linked to concrete Dataverse/Azure environments? | Open |
| OQ-003 | Should MVP include Log Analytics usage analysis, or only define it and implement in phase 2? | Open |

## Authentication

| ID | Question | Status |
|---|---|---|
| OQ-010 | Which auth modes are mandatory for MVP: client secret, device code, interactive browser? | Open |
| OQ-011 | Should the CLI store tenant profiles locally, or should it be stateless and always receive parameters? | Open |
| OQ-012 | Which secure storage mechanism should be used on Windows for local credentials? | Open |

## MAUI Integration

| ID | Question | Status |
|---|---|---|
| OQ-020 | Should MAUI call the CLI process only, or should a local HTTP bridge be considered later? | Proposed: CLI process for MVP |
| OQ-021 | Should history be stored in SQLite from the start? | Open |
| OQ-022 | Should the MAUI app bundle the CLI or expect it to be installed separately? | Open |

## Permissions

| ID | Question | Status |
|---|---|---|
| OQ-030 | Exact minimum permissions for reading owners must be validated. | Open |
| OQ-031 | Exact Azure RBAC role recommendation for Log Analytics query access must be validated. | Open |
| OQ-032 | How should the tool detect missing admin consent cleanly? | Open |

## Usage Analysis

| ID | Question | Status |
|---|---|---|
| OQ-040 | How far back can customers practically query logs? 30/90/360 days depends on workspace retention. | Open |
| OQ-041 | Which result codes should be mapped to expired secret findings? | Open |
| OQ-042 | Can source IPs be enriched with Azure resource data later? | Open |
