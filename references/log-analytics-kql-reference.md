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

**OQ-041 is In Review** — the following codes are candidates, pending validation in a real tenant.

| ResultType | AADSTS Code | Description |
|---|---|---|
| `7000222` | AADSTS7000222 | The provided client_secret keys for app have expired |
| `700215` | AADSTS700215 | Invalid client_secret provided (may include wrong or expired) |
| `700016` | AADSTS700016 | Application not found in directory for tenant |

**Recommended analysis approach:**

- Non-zero ResultType values from a specific key ID after its `endDateTime` = strong expired-secret signal.
- `7000222` is the most specific code for expired client secret.
- Surface all non-zero results in the evidence table; filter by these codes for the "failed after expiry" finding.

Validate these codes against a real tenant with an expired secret before hardcoding them.

## IP enrichment

**Decided by OQ-042:** Source IP enrichment with Azure resource data is deferred to Phase 2.

Phase 1 should surface raw IP addresses. Phase 2 may enrich with Azure resource lookups.

## Project limitations

- Log Analytics only contains data after diagnostic export is configured.
- Retention depends on workspace configuration.
- Logs show usage of credentials, not the concrete storage location of a secret.
- Source IP and resource names are hints, not proof of where a secret is configured.
