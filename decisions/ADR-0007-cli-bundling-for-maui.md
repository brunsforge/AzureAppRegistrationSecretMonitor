# ADR-0007: CLI Bundling Strategy for MAUI Distribution

## Status

Accepted

## Context

OQ-046 asked how the `aarm` CLI binary should be packaged into the MAUI Blazor release build.

The CLI is a TypeScript/Node.js package that depends on `keytar`, a native Node.js addon (compiled `.node` binary for Windows Credential Manager access). This native module dependency rules out bundlers that cannot include pre-compiled native addons in a self-contained executable.

Candidates evaluated:

| Approach | Native modules | Verdict |
|---|---|---|
| `pkg` / `@yao-pkg/pkg` | Supported (with config) | Deprecated; community fork only |
| Node.js Single Executable Application (SEA, v21+) | Not inlined; .node still separate | New, complex; no advantage over chosen approach |
| `bun --compile` | keytar incompatible | Different runtime; risky |
| **esbuild + node.exe + keytar.node** | ✓ Full support | Chosen |

## Decision

Bundle the CLI for MAUI distribution using:

1. **esbuild** to compile the TypeScript CLI to a single `aarm.js` file. `keytar` is marked as external in the esbuild config so it is not inlined.
2. **Pre-built `keytar.node`** sourced from the `keytar` npm package (ships Windows x64 binaries via node-pre-gyp — no compilation required).
3. **`node.exe`** from the official Node.js LTS release for Windows x64 (~25 MB), bundled as a self-contained runtime.

The MAUI app invokes the CLI as:

```text
<cli-dir>\node.exe <cli-dir>\aarm.js [command] [args]
```

## Bundle layout

Inside the MAUI install directory:

```text
cli/
  node.exe                              ← Node.js LTS, Windows x64
  aarm.js                               ← esbuild output of packages/cli
  node_modules/
    keytar/
      package.json
      index.js
      build/
        Release/
          keytar.node                   ← pre-built Windows x64 native addon
```

## ICliLocatorService resolution

| Mode | Resolution |
|---|---|
| Debug | `Cli:ExecutablePath` in `appsettings.Development.json` — points to local `packages/cli/dist/aarm.js`; uses system Node.js |
| Release | `AppContext.BaseDirectory\cli\node.exe` and `AppContext.BaseDirectory\cli\aarm.js` |

## Standalone npm usage

The npm package is unaffected. It ships a normal `bin` entry pointing to `dist/aarm.js`. Users who install via npm use their own system Node.js.

## Build automation

A MSBuild `Target` (or pre-build PowerShell script) in `apps/maui-blazor/` handles:

1. Run `npm run build` in `packages/cli/` (esbuild → `dist/aarm.js`).
2. Copy `dist/aarm.js` to `apps/maui-blazor/Resources/Cli/`.
3. Copy `node.exe` from a pinned Node.js LTS download or local cache.
4. Copy keytar files from `packages/cli/node_modules/keytar/`.

## Consequences

Positive:
- Stable, well-maintained toolchain (`esbuild` is the industry standard for TypeScript bundling).
- Native modules work correctly — `keytar` accesses Windows Credential Manager as designed.
- No deprecated tools in the build pipeline.
- CLI remains independently publishable to npm without changes.

Negative:
- `node.exe` adds ~25 MB to the installer.
- Three file types must be kept in sync during builds (`node.exe` version, `aarm.js`, `keytar.node`).
- `node.exe` version must be pinned and updated when Node.js LTS changes.

## Related files

- `concept/07_maui_blazor_ui_concept.md` — `ICliLocatorService` design
- `decisions/ADR-0002-maui-consumes-cli-json.md` — CLI/MAUI integration boundary
- `concept/04_npm_library_concept.md` — npm library architecture
- `references/maui-blazor-ui-conventions.md` — `ICliLocatorService` service table
