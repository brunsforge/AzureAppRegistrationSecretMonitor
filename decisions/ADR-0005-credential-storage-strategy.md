# ADR-0005: Credential Storage Strategy

## Status

Accepted

## Context

OQ-012 asked which secure storage mechanism should be used for storing client secret values locally on Windows.

The npm CLI (Node.js) and the MAUI Blazor desktop app (.NET) require separate storage mechanisms because they run in different runtimes.

## Decision

### npm CLI (Node.js)

Use `keytar` to access Windows Credential Manager.

- `keytar` is a cross-platform npm package that wraps OS-level credential storage.
- On Windows it delegates to Windows Credential Manager.
- This avoids storing secret values in plain JSON files.

### .NET MAUI Blazor App

Use `Windows.Security.Credentials.PasswordVault`.

- This is the recommended .NET MAUI approach for Windows credential storage.
- It delegates to Windows Credential Manager, consistent with the CLI strategy.

## Consequences

Positive:
- Client secret values are never stored in plain JSON files.
- Both CLI and MAUI use Windows Credential Manager as the underlying store.
- `keytar` preserves cross-platform behavior for the CLI (supports macOS and Linux).

Negative:
- `keytar` is a native module and requires platform-specific binaries.
- `PasswordVault` is Windows-only; cross-platform MAUI scenarios would need an alternative.

## Constraint

Non-sensitive profile data (tenant ID, display name, environment slug, auth mode, workspace ID) continues to be stored in plain JSON files. Only client secret key material goes to the credential store.

## Related files

- `concept/04_npm_library_concept.md`
- `references/npm-cli-conventions.md`
- `concept/09_open_questions.md` (OQ-012)
