# Log Analytics and KQL Reference

This file stores reusable KQL patterns and assumptions for usage analysis.

## Primary table candidate

```kusto
AADServicePrincipalSignInLogs
```

## Key fields

| Field | Purpose |
|---|---|
| `TimeGenerated` | When token/sign-in activity was logged. |
| `AppId` | Client/Application ID. |
| `ServicePrincipalId` | Service Principal identifier. |
| `ServicePrincipalCredentialKeyId` | Credential key ID used by the sign-in, when available. |
| `ServicePrincipalCredentialThumbprint` | Certificate thumbprint, when certificate credentials are used. |
| `ResourceDisplayName` | Target resource. |
| `IPAddress` | Source IP observed by Entra. |
| `ResultType` | Numeric result code. |
| `ResultDescription` | Human-readable result detail. |

## Last seen by app

```kusto
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(30d)
| where AppId == "<client-id>"
| summarize LastSeen=max(TimeGenerated), Count=count() by ServicePrincipalCredentialKeyId, ResourceDisplayName, IPAddress, ResultType, ResultDescription
| order by LastSeen desc
```

## Last seen by secret key ID

```kusto
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(30d)
| where ServicePrincipalCredentialKeyId == "<secret-key-id>"
| summarize LastSeen=max(TimeGenerated), Count=count() by AppId, ServicePrincipalId, ResourceDisplayName, IPAddress, ResultType, ResultDescription
| order by LastSeen desc
```

## Configurable look-back window

**Decided by OQ-040:** The look-back window is user-configurable, not fixed.

The tool should pass the look-back period as a parameter. KQL queries must accept a timespan variable:

```kusto
// lookBackWindow is substituted at query construction time, e.g. 30d, 90d, 180d, 360d
let lookBackWindow = <lookBackDays>d;
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(lookBackWindow)
| ...
```

CLI parameter: `--days <n>` (e.g. `aarm usage analyze --app-id <client-id> --days 90`)

Default value: 90 days (suggested; subject to UI/CLI design decision).

## Result codes for expired secret findings

**OQ-041 Applied** — codes partially confirmed from Microsoft documentation; real-tenant validation still recommended.

Reference: [Microsoft Entra error codes](https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes)

| ResultType | AADSTS Code | Description | Status |
|---|---|---|---|
| `7000222` | AADSTS7000222 | The provided client_secret keys for app have expired | Candidate — most specific expiry code; not yet confirmed via documentation review; prioritize if found in tenant |
| `7000215` | AADSTS7000215 | Invalid client secret provided (developer error — app signed in without correct authentication parameters) | Confirmed in documentation |
| `700016` | AADSTS700016 | Application not found in directory / UnauthorizedClient_DoesNotMatchRequest | Confirmed in documentation — indicates configuration problem, not expiry alone |

Note: AADSTS700016 signals a directory or tenant configuration issue rather than secret expiry. Use it alongside credential key ID context and `endDateTime` when classifying findings.

**Recommended analysis approach:**

- Non-zero ResultType from a specific key ID after its `endDateTime` = strong expired-secret signal regardless of code.
- `7000222` is the most expiry-specific code — prioritize it when found; real-tenant validation still needed.
- `7000215` (invalid secret) is relevant but not expiry-specific — may also appear for misconfigured credentials.
- `700016` indicates app/tenant configuration errors — useful context, not an expiry indicator on its own.
- Surface all non-zero results in the evidence table; annotate findings with the specific code and its description.
- Filter by `7000222` and `7000215` for the "failed after expiry" finding classification.

Further codes may be relevant — consult the Microsoft error codes reference above before finalising hardcoded filters.

## IP enrichment

**Decided by OQ-042:** Source IP enrichment with Azure resource data is deferred to Phase 2.

Phase 1 should surface raw IP addresses. Phase 2 may enrich with Azure resource lookups.

## Project limitations

- Log Analytics only contains data after diagnostic export is configured.
- Retention depends on workspace configuration.
- Logs show usage of credentials, not the concrete storage location of a secret.
- Source IP and resource names are hints, not proof of where a secret is configured.
