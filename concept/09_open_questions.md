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

---

## Azure Function / Cloud Mode

## OQ-047: Workload Identity Federation as a scanning auth mode

**Status:** Applied
**Owner:** npm / Security
**Related files:**
- `concept/04_npm_library_concept.md`
- `concept/12_azure_function_cloud_mode.md`

**Question:**
The Azure Function always scans *external* tenants (not its own host tenant in the typical case).
Managed Identity alone cannot grant cross-tenant Graph access without cooperation from
the target tenant.

Workload Identity Federation (OIDC) allows credential-free cross-tenant access if the target
tenant admin configures a federated credential trust on their App Registration.

Should the npm library expose a `workload-identity-federation` auth mode backed by
`OnBehalfOfCredential` / OIDC exchange, to support the case where target tenants have
performed the one-time federation setup?

If yes: this enables zero-stored-credential scanning for tenants that opt in.
If no: all external tenant jobs always use `client-secret` or `certificate`.

**Answer / Decision:**
Yes! prefered method is workload-identify-federation. client secret and certificate should be also possible for cloud mode.

**Impact:**
- `concept/04_npm_library_concept.md` — auth mode table
- `concept/12_azure_function_cloud_mode.md` — job config auth modes
- `AuthProviderFactory.ts` in packages/core

**Next action:** Decide. For MVP Azure Function: `client-secret` + Key Vault is sufficient.
Workload Identity Federation is a post-MVP option for tenants that want zero stored credentials.

---

## OQ-048: Separate vs shared Azure Storage Account for Azure Function

**Status:** Applied
**Owner:** Implementation / Security
**Related files:**
- `concept/12_azure_function_cloud_mode.md`

**Question:**
Should the Azure Function use a dedicated storage account for AARM data (`aarm-config`,
`aarm-data` containers), or the same storage account that Azure Functions runtime uses
for its own state (`AzureWebJobsStorage`)?

**Considerations:**
- Same account: simpler, fewer resources, fine for MVP
- Separate account: independent lifecycle, independent RBAC, cleaner for multi-team use

**Answer / Decision:**
for MVP everything under a main workload container in azure functions own storage.

**Impact:**
- `concept/12_azure_function_cloud_mode.md` — storage layout section

**Next action:** Decide and apply. Recommend: same account for MVP, separate for production.

---

## OQ-049: Client Secret storage for multi-tenant Azure Function jobs

**Status:** Applied
**Owner:** Security
**Related files:**
- `concept/12_azure_function_cloud_mode.md`
- `concept/03_permissions_and_preflight.md`

**Question:**
Job configurations in the Azure Function may use `client-secret` auth mode for tenants
where the function's Managed Identity cannot be granted access (e.g. external tenants).
Where are these client secrets stored?

**Options:**
1. Azure Key Vault — secrets referenced by name in job config JSON
2. Azure App Configuration with Key Vault references
3. Function App Settings (environment variables) — not recommended for multiple tenants

**Answer / Decision:**
I guess environment variables with references to a key vault secret is the common way? They should share a prefix for sorting.

**Impact:**
- `concept/12_azure_function_cloud_mode.md` — job configuration schema
- `concept/03_permissions_and_preflight.md`

**Next action:** Decide and apply.

---

## OQ-050: HTML Dashboard rendering approach for Azure Function endpoint

**Status:** Applied
**Owner:** npm / UI
**Related files:**
- `concept/12_azure_function_cloud_mode.md`

**Question:**
The `/api/dashboard` endpoint returns a self-contained HTML page. Two approaches:

1. **Server-side render once** — function generates full HTML from latest data at request time
2. **Static shell + client-side fetch** — function serves a fixed HTML/JS shell; JS fetches JSON endpoints on load and on tenant switch

Approach 2 is more responsive and reusable (same JSON endpoints used by MAUI and by the browser).
Approach 1 is simpler but stale between requests.

**Answer / Decision:**
Want both to use in different scenarios. Different routes. So maybe the static one can be used in some kind of service.

**Impact:**
- `concept/12_azure_function_cloud_mode.md` — HTML Dashboard section

**Next action:** Decide. Recommend: approach 2 (static shell + client-side fetch).

---

## OQ-051: IDataProvider implementation strategy for MAUI mode switch

**Status:** Applied
**Owner:** UI / Implementation
**Related files:**
- `concept/07_maui_blazor_ui_concept.md`
- `concept/12_azure_function_cloud_mode.md`

**Question:**
When the user switches from Local to Cloud mode (or vice versa) in Settings, how does MAUI
re-resolve the `IDataProvider` without requiring an app restart?

**Options:**
1. **Factory pattern** — `DataProviderFactory` resolves the correct provider on every call based on current `AppMode`
2. **Restart required** — simple but poor UX
3. **Proxy provider** — a `DelegatingDataProvider` singleton that holds a reference to the current inner provider and swaps it on mode change

**Answer / Decision:**
3 sounds solit. But if you have concerns go for 1.

**Impact:**
- `concept/07_maui_blazor_ui_concept.md` — IDataProvider section

**Next action:** Decide. Recommend: option 3 (proxy) — avoids restart, cleanest DI pattern.

---

## OQ-052: Notification template rendering engine

**Status:** Applied
**Owner:** npm / Implementation
**Related files:**
- `concept/12_azure_function_cloud_mode.md`

**Question:**
The Teams notification template system uses `{{placeholder}}`-style variables.
Should the rendering engine use:

1. A minimal custom string-replace implementation (no dependency)
2. `handlebars` npm package
3. `mustache` npm package

**Answer / Decision:**
handlebars.js

**Impact:**
- `concept/12_azure_function_cloud_mode.md` — Notification Template System section

**Next action:** Decide. Recommend: option 1 for MVP (few variables, no loops needed).

---

## OQ-053: Move cachePersistencePlugin registration out of core library

**Status:** Applied
**Owner:** npm
**Related files:**
- `packages/core/src/auth/AuthProviderFactory.ts`
- `concept/12_azure_function_cloud_mode.md`

**Question:**
`AuthProviderFactory.ts` calls `useIdentityPlugin(cachePersistencePlugin)` at module load
time. This enables disk-based token caching via keytar for interactive flows (device-code,
interactive-browser). On Linux / Azure Functions, keytar is not available. The call is
wrapped in `try/catch` so it silently no-ops — it does not break the function — but a
Windows-specific plugin dependency in the core library is architecturally incorrect.

Should `useIdentityPlugin(cachePersistencePlugin)` be moved to CLI bootstrap code
(`packages/cli/src/index.ts`) and removed from the core library?

**Answer / Decision:**
if it is in the way for a working mvp we have to move it. but as i understand it we dont have to since not every auth mode will run in that exception? I would prefer to leave it in the npm package since that one can also be used in other tools which may want such a thing.

**Impact:**
- `packages/core/src/auth/AuthProviderFactory.ts` — remove `useIdentityPlugin` call and import
- `packages/cli/src/index.ts` — add `useIdentityPlugin(cachePersistencePlugin)` call at startup
- `packages/core/package.json` — `@azure/identity-cache-persistence` moves to CLI, not core

**Next action:** Decide and implement. Low-risk cleanliness fix — current behavior is already
correct on both platforms due to the try/catch.

**Applied note:** Decision: keep `cachePersistencePlugin` registration in the core library.
The `try/catch` correctly handles environments where keytar is unavailable (Linux, Azure Functions).
The core package can be reused in other tools that benefit from persistent token caching.
No code change required. Impact section above is superseded by this decision.