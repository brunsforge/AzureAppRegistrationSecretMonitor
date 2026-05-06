# Entra and Microsoft Graph Permissions Reference

This file collects reusable permission notes for the project.

It is not a substitute for current Microsoft documentation. If a permission is uncertain, mark it as an open question.

## Read-only MVP permission candidates

| Capability | Likely permission / role | Notes |
|---|---|---|
| Read app registrations | `Application.Read.All` | Needed to list applications and password credential metadata. |
| Read service principals | `Application.Read.All` or `Directory.Read.All` | Needs validation per query shape. |
| Read owners | `Directory.Read.All` may be required | Treat as optional capability if unavailable. |
| Read sign-in logs via Log Analytics | Azure RBAC on workspace, e.g. Log Analytics Reader / Monitoring Reader | Not a Graph application permission. |

## Later write capability candidates

| Capability | Likely permission / role | MVP status |
|---|---|---|
| Create application secret | `Application.ReadWrite.All` / appropriate admin role | Post-MVP |
| Delete application secret | `Application.ReadWrite.All` / appropriate admin role | Post-MVP |
| Create app registration | `Application.ReadWrite.All` / appropriate admin role | Post-MVP |
| Modify API permissions | Higher privileged application/admin rights | Post-MVP |

## Validation status

The following permissions require implementation-time validation in a real tenant:

| Permission / role | Open question | Validation note |
|---|---|---|
| `Directory.Read.All` for reading owners | OQ-030 | Must confirm that this permission reliably returns owners via Graph. Treat as optional capability if absent. |
| Log Analytics Reader / Monitoring Reader | OQ-031 | Must confirm that this role allows workspace queries for `AADServicePrincipalSignInLogs`. |

These are confirmed as planning assumptions. Final mapping must be validated before implementation completes Phase 3 (Preflight).

## Admin consent detection

**Decided by OQ-032:** Use preflight + catch approach.

Detection strategy:

1. During each preflight capability check, attempt the corresponding Graph or Azure call.
2. On HTTP 403 or 401 with `consent_required`, `interaction_required` or `insufficient_privileges` error codes, record the capability as unavailable and surface the missing permission hint.
3. On success, mark the capability as available.
4. Surface all missing permissions in the `missingPermissions` array of the `PreflightResult`.

This approach does not require inspecting token claims directly — it relies on live API call outcomes.

## Phase 2 Azure capability candidates

These are not Graph permissions. They require Azure RBAC on Azure resources.

| Capability | Likely permission / role | Phase |
|---|---|---|
| `canReadAzureResources` | Azure RBAC Reader on relevant subscription or resource group | Phase 2 (IP-to-resource enrichment) |
| `canReadKeyVaultMetadata` | Azure RBAC Key Vault Reader or Key Vault Secrets User | Phase 2 (Key Vault secret scanning) |

The preflight service must attempt these checks and report the resulting capability flags so the UI can gate the affected features correctly (decided by OQ-044).

## Azure Portal deep link pattern

The following URL opens an App Registration directly in the Azure Portal by Client ID:

```text
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/{clientId}
```

Usage in MAUI: open via `Launcher.OpenAsync(url)` in the system browser. No portal session is assumed — the user must be separately logged into the portal.

This link is used in the Secret List and Secret Detail screens.

## Project rule

The product must start with a read-only monitoring MVP.
Write capabilities must be hidden or disabled unless the preflight result explicitly confirms the needed capability.
