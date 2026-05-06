# Open Questions


## Workflow for answered questions

When the user answers an open question manually:

1. Keep the question in this file.
2. Set `Status` to `Answered` or `Decided`.
3. Fill `Answer / Decision`.
4. Add or review the `Impact` section.
5. Run `/apply-answered-questions`.
6. Run `/review-consistency`.

Do not delete answered questions. Mark them as `Applied` only after the answer has been propagated into the affected concept, reference and ADR files.

## Preferred detailed entry format

```markdown
## OQ-0000: Short question title

**Status:** Open | In Review | Answered | Decided | Applied | Superseded | Blocked  
**Owner:** Manual / Claude-assisted / Security / npm / CLI / UI / Implementation  
**Related files:**  
- `concept/...`
- `references/...`
- `decisions/...`

**Question:**  
The unresolved question.

**Answer / Decision:**  
Only fill this when the answer is clarified.

**Impact:**  
Files or concepts that must be updated after the answer is applied.

**Next action:**  
Recommended command or manual step.
```


## Product / Scope

| ID | Question | Status | Applied note |
|---|---|---|---|
| OQ-001 | Final package/CLI name → `@brunsforge/azure-app-registration-monitor`, CLI binary `aarm` | Applied | ADR-0003 created; `references/project-naming-conventions.md`, `references/npm-cli-conventions.md`, `concept/04_npm_library_concept.md`, `concept/05_cli_concept.md` updated |
| OQ-002 | Environments are user-defined slugs; display name = tenant metadata + slug | Applied | `concept/02_domain_model.md`, `concept/07_maui_blazor_ui_concept.md` updated |
| OQ-003 | Log Analytics: concept complete in planning phase; implementation in Phase 2 after secret listing MVP | Applied | `concept/01_project_vision.md`, `concept/10_implementation_plan.md` updated |

## Authentication

| ID | Question | Status | Applied note |
|---|---|---|---|
| OQ-010 | MVP auth modes: Client Secret, Device Code, Interactive Browser (all mandatory); Certificate and Azure CLI optional | Applied | `concept/04_npm_library_concept.md` updated |
| OQ-011 | CLI stores tenant profiles in local JSON cache directory; secret values go to OS credential store | Applied | `concept/04_npm_library_concept.md`, `concept/05_cli_concept.md`, `references/npm-cli-conventions.md` updated |

---

## OQ-012: Secure storage mechanism on Windows

**Status:** Applied  
**Owner:** Security / npm / UI  
**Related files:**
- `concept/04_npm_library_concept.md`
- `references/npm-cli-conventions.md`
- `decisions/ADR-0005-credential-storage-strategy.md`

**Question:**  
Which secure storage mechanism should be used on Windows for storing client secret values locally?

**Answer / Decision:**  
Use `keytar` (Windows Credential Manager) for the npm CLI. Use `Windows.Security.Credentials.PasswordVault` for the MAUI Blazor app. Windows Credential Manager is the preferred mechanism in both cases.

**Impact:**  
- `concept/04_npm_library_concept.md` — CredentialStore abstraction references ADR-0005
- `references/npm-cli-conventions.md` — security convention updated with keytar rule
- `decisions/ADR-0005-credential-storage-strategy.md` — created

**Applied note:** ADR-0005 created; `references/npm-cli-conventions.md` updated with keytar convention; `concept/04_npm_library_concept.md` references ADR-0005.
---

## MAUI Integration

| ID | Question | Status | Applied note |
|---|---|---|---|
| OQ-020 | No HTTP bridge for MVP; CLI process invocation only | Applied | `decisions/ADR-0002-maui-consumes-cli-json.md` accepted and updated; `concept/07_maui_blazor_ui_concept.md` updated |
| OQ-021 | History: JSON files for Phase 1 (MVP); SQLite deferred to Phase 2 | Applied | ADR-0004 created; `concept/07_maui_blazor_ui_concept.md`, `concept/10_implementation_plan.md` updated |
| OQ-022 | MAUI bundles the npm CLI binary; CLI is also usable standalone | Applied | `decisions/ADR-0002-maui-consumes-cli-json.md` updated; `concept/07_maui_blazor_ui_concept.md` updated |

## Permissions

| ID | Question | Status | Applied note |
|---|---|---|---|
| OQ-030 | Exact minimum permissions for reading owners: confirmed as needing implementation validation | Applied | `references/entra-permissions-reference.md` updated with validation note |
| OQ-031 | Exact Azure RBAC role for Log Analytics: confirmed as needing implementation validation | Applied | `references/entra-permissions-reference.md` updated with validation note |
| OQ-032 | Admin consent detection: preflight check + catch 403/consent-required errors | Applied | `concept/03_permissions_and_preflight.md` updated with consent detection section; `references/entra-permissions-reference.md` updated |

## Usage Analysis

| ID | Question | Status | Applied note |
|---|---|---|---|
| OQ-040 | Log query look-back window: user-configurable via `--days` parameter; default 90 days | Applied | `concept/06_usage_analysis_log_analytics.md`, `references/log-analytics-kql-reference.md` updated |
| OQ-042 | Source IP enrichment with Azure resource data: Phase 2 | Applied | `concept/06_usage_analysis_log_analytics.md`, `concept/10_implementation_plan.md` updated |

---

## OQ-041: Result codes for expired secret findings

**Status:** Applied  
**Owner:** Claude-assisted / Usage Analysis  
**Related files:**
- `concept/06_usage_analysis_log_analytics.md`
- `references/log-analytics-kql-reference.md`

**Question:**  
Which `ResultType` codes in `AADServicePrincipalSignInLogs` should be mapped to expired client secret findings?

**Suggested codes (need validation in a real tenant with an expired secret):**

| ResultType | AADSTS Code | Description |
|---|---|---|
| `7000222` | AADSTS7000222 | The provided client_secret keys for app have expired |
| `700215` | AADSTS700215 | Invalid client_secret provided (may include expired or wrong) |
| `700016` | AADSTS700016 | Application not found in directory for tenant |

**Recommended analysis strategy:**

- Non-zero ResultType from a specific key ID after its `endDateTime` = strong expired-secret signal.
- `7000222` is the most specific code for expired client secret.
- All non-zero results from a key ID after expiry should be surfaced in the evidence table.

**Answer / Decision:**  
In Documentation
- AADSTS7000215	Es wurde ein ungültiger geheimer Clientschlüssel bereitgestellt. Entwicklerfehler: Die App versucht, sich ohne die erforderlichen oder richtigen Authentifizierungsparameter anzumelden.
-AADSTS700016	UnauthorizedClient_DoesNotMatchRequest: Die Anwendung wurde nicht im Verzeichnis/Mandanten gefunden. Dies kann auftreten, wenn die Anwendung nicht vom Administrator des Mandanten installiert wurde oder wenn sie von den Benutzern des Mandanten keine Zustimmung erhalten hat. Unter Umständen haben Sie den Bezeichnerwert für die Anwendung falsch konfiguriert oder die Authentifizierungsanforderung an den falschen Mandanten gesendet.
- weitere relevant Codes evtl. hier recherchieren https://learn.microsoft.com/de-de/entra/identity-platform/reference-error-codes

**Impact:**
- `references/log-analytics-kql-reference.md` — updated with documentation-confirmed codes, AADSTS descriptions and Microsoft error codes reference URL

**Applied note:** `references/log-analytics-kql-reference.md` updated with confirmed codes (AADSTS7000215, AADSTS700016) and Microsoft error codes reference; AADSTS7000222 remains a candidate pending real-tenant validation.

---

## UI / MAUI

## OQ-043: System tray scope

**Status:** Applied  
**Owner:** UI / Manual  
**Related files:**
- `concept/01_project_vision.md`
- `concept/07_maui_blazor_ui_concept.md`
- `concept/10_implementation_plan.md`

**Question:**  
Is system tray integration (background running + tray icon with context menu) part of MVP, or deferred to Phase 2?

**Answer / Decision:**  
System tray integration is part of MVP scope.

**Impact:**  
- `concept/01_project_vision.md` — confirm system tray as MVP (remove "to be confirmed" note)
- `concept/07_maui_blazor_ui_concept.md` — assign tray to MVP phase
- `concept/10_implementation_plan.md` — add tray to Phase 4 MAUI Shell goals

**Applied note:** `concept/01_project_vision.md`, `concept/07_maui_blazor_ui_concept.md`, `concept/10_implementation_plan.md` updated; system tray confirmed as MVP scope.

---

## OQ-044: Phase assignment for `canReadAzureResources` and `canReadKeyVaultMetadata`

**Status:** Applied  
**Owner:** Claude-assisted / Security  
**Related files:**
- `concept/02_domain_model.md`
- `concept/03_permissions_and_preflight.md`
- `references/entra-permissions-reference.md`

**Question:**  
The domain model `CapabilitySet` defines `canReadAzureResources` and `canReadKeyVaultMetadata`. Neither appears in the preflight result shape or UI behavior table in `03_permissions_and_preflight.md`.

Should these capabilities be added to the MVP preflight shape, treated as Phase 2, or removed from the CapabilitySet until Phase 2 defines them?

**Answer / Decision:**  
Both capabilities must be included in the MVP preflight shape and UI behavior table. The preflight service needs to report all capabilities so the UI can gate features correctly, even if the features themselves are implemented in Phase 2.

**Impact:**  
- `concept/03_permissions_and_preflight.md` — added to preflight checks table, JSON shape and UI behavior table
- `references/entra-permissions-reference.md` — added Phase 2 Azure RBAC capability candidates

**Applied note:** `concept/03_permissions_and_preflight.md` updated with `canReadAzureResources` and `canReadKeyVaultMetadata` in preflight checks, JSON shape and UI behavior table; `references/entra-permissions-reference.md` updated.

## OQ-045: Should history saving be a dedicated `aarm scan` command or an automatic side-effect of `aarm secrets list`?

**Status:** Applied  
**Owner:** Claude-assisted / CLI / UI  
**Related files:**
- `concept/05_cli_concept.md`
- `concept/07_maui_blazor_ui_concept.md`
- `concept/10_implementation_plan.md`

**Question:**  
Should history saving (persisting scan results to local JSON files) be triggered by a dedicated `aarm scan` command, or should it be an automatic side-effect when `aarm secrets list` is run?

**Answer / Decision:**  
History saving is an automatic side-effect of `aarm secrets list`. No dedicated `aarm scan` command is needed for MVP.

**Impact:**
- `concept/05_cli_concept.md` — add a note that `aarm secrets list` automatically persists results to local history storage
- `concept/07_maui_blazor_ui_concept.md` — confirm that "Run Scan" / "Scan All" UI actions map to `aarm secrets list` and that history is saved automatically as part of that invocation

**Applied note:** `concept/05_cli_concept.md` updated with Automatic History Persistence section; `concept/07_maui_blazor_ui_concept.md` MVP Integration section updated; `references/npm-cli-conventions.md` updated with history persistence convention.

---

## OQ-046: CLI binary bundling mechanism for MAUI release build

**Status:** Applied  
**Owner:** Claude-assisted / UI / npm  
**Related files:**
- `concept/07_maui_blazor_ui_concept.md`
- `concept/04_npm_library_concept.md`
- `decisions/ADR-0002-maui-consumes-cli-json.md`
- `decisions/ADR-0007-cli-bundling-for-maui.md`

**Question:**  
How exactly is the `aarm` CLI binary bundled into the MAUI app for release builds?

- Is it a raw Node.js binary, a self-contained executable (e.g. `pkg` or `esbuild` bundle), or an npm pack output unpacked into the app folder?
- Which MAUI build step handles the copy?
- What is the target path relative to the installed app's `AppContext.BaseDirectory`?

**Answer / Decision:**  
esbuild bundles the TypeScript CLI to a single `aarm.js` (keytar marked as external). A pre-built `keytar.node` (Windows x64, sourced from the keytar npm package) and a pinned `node.exe` (Node.js LTS) are shipped alongside in a `cli/` subfolder of the install directory. MAUI invokes `cli\node.exe cli\aarm.js [args]`. A MSBuild target handles the copy step at build time. See ADR-0007 for full rationale and layout.

**Impact:**
- `decisions/ADR-0007-cli-bundling-for-maui.md` — created with full decision, bundle layout and build automation plan
- `concept/07_maui_blazor_ui_concept.md` — CLI Location Strategy updated with specific bundle layout and invocation pattern

**Applied note:** ADR-0007 created; `concept/07_maui_blazor_ui_concept.md` CLI Location Strategy updated; `ICliLocatorService` now exposes `GetNodePath()` and `GetCliScriptPath()` instead of a single binary path.