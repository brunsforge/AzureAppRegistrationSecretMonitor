# aarm — Live Integration Tests

Full end-to-end tests for `@brunsforge/azure-app-registration-monitor` against a real Microsoft Entra tenant. Uses the **published npm package**, not the local workspace source.

## What is tested

| File | Feature |
|---|---|
| `01-auth.test.ts` | Token acquisition, caching, expiry |
| `02-graph.test.ts` | Microsoft Graph — listing App Registrations and owners |
| `03-inventory.test.ts` | Secret inventory, expiry calculation, risk classification, cross-checks |
| `04-preflight.test.ts` | Capability detection, mode-aware permission hints |
| `05-envelope.test.ts` | JSON output envelope — shape, camelCase keys, C# model compatibility |

## Prerequisites

1. An Entra App Registration configured for interactive browser login (see main README)
2. The tenant added to aarm:
   ```powershell
   aarm tenants add --auth-mode interactive-browser --tenant-id <guid> --client-id <guid>
   ```
3. Node.js 18+

## Setup

These tests use the **published** package from npm, not the local workspace. Install separately:

```powershell
cd tests/live
npm install
```

## Run all tests

```powershell
npm test
```

A browser window will open on the first test. Log in with your Entra account. All subsequent tests reuse the cached token — no further interaction required.

## Run a single feature

```powershell
npm run test:auth        # authentication only
npm run test:graph       # Graph listing only
npm run test:inventory   # secret inventory pipeline
npm run test:preflight   # capability detection
npm run test:envelope    # JSON output contract
```

## Configuration

Tests read tenant config from `~/.aarm/tenants.json` (same file the CLI uses).
Prefer a tenant with `interactive-browser` auth mode — tests fall back to the first tenant with a clientId.

Override with environment variables:

```powershell
$env:AARM_TEST_TENANT_ID = "your-tenant-id-guid"
$env:AARM_TEST_CLIENT_ID = "your-client-id-guid"
npm test
```

## Timeouts

- Per-test timeout: 60 seconds
- Auth (browser login) timeout: 120 seconds
- Tests run sequentially — only one browser window opens
