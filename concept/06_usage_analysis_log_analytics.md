# Usage Analysis with Log Analytics

## Purpose

Secret inventory tells what exists.

Usage analysis helps answer:

- was this App Registration used recently?
- was this specific credential key used recently?
- is an old secret still used after rotation?
- are failures appearing after expiry?
- which resources were requested?
- which IP addresses appear?

## Data Source

Preferred source:

```text
AADServicePrincipalSignInLogs
```

This table is available only if Entra diagnostic logs are routed into a Log Analytics Workspace.

## Important Limitation

The logs show token usage, not the exact configuration location of the secret.

They can indicate:

- App ID
- Service Principal ID
- credential key ID
- resource display name
- IP address
- result code
- timestamp

They usually do not say:

- "this secret is stored in Azure Function X"
- "this secret is stored in Power Automate Connection Y"
- "this secret is in Dataverse plugin secure configuration"

The tool must therefore produce evidence and remediation hints, not pretend certainty.

## KQL: App Usage

Look-back window is user-configurable via `--days` parameter (decided by OQ-040). Default: 90 days.

```kusto
let clientId = "<client-id>";
let lookBackWindow = <days>d; // substituted at query construction time
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(lookBackWindow)
| where AppId == clientId
| project
    TimeGenerated,
    AppId,
    ServicePrincipalId,
    ServicePrincipalCredentialKeyId,
    ServicePrincipalCredentialThumbprint,
    ResourceDisplayName,
    IPAddress,
    ResultType,
    ResultSignature,
    ResultDescription,
    CorrelationId
| order by TimeGenerated desc
```

## KQL: Secret Key Usage

```kusto
let keyId = "<secret-key-id>";
let lookBackWindow = <days>d;
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(lookBackWindow)
| where ServicePrincipalCredentialKeyId == keyId
| summarize
    LastSeen = max(TimeGenerated),
    Count = count()
    by AppId, ServicePrincipalId, ResourceDisplayName, IPAddress, ResultType, ResultDescription
| order by LastSeen desc
```

## KQL: Rotation Check

```kusto
let clientId = "<client-id>";
let oldKeyId = "<old-secret-key-id>";
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(14d)
| where AppId == clientId
| where ServicePrincipalCredentialKeyId == oldKeyId
| summarize
    LastSeen = max(TimeGenerated),
    Count = count()
    by ResourceDisplayName, IPAddress, ResultType, ResultDescription
| order by LastSeen desc
```

## KQL: Expired Secret Failure Hint

```kusto
let clientId = "<client-id>";
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(30d)
| where AppId == clientId
| where ResultType != 0
| project
    TimeGenerated,
    AppId,
    ServicePrincipalCredentialKeyId,
    ResultType,
    ResultSignature,
    ResultDescription,
    ResourceDisplayName,
    IPAddress
| order by TimeGenerated desc
```

## Analysis Output

The tool should summarize:

- first seen
- last seen
- total sign-ins
- successful sign-ins
- failed sign-ins
- resources requested
- IP addresses
- credential key IDs used
- possible stale old key usage
- evidence table

## Source IP Enrichment

**Decided by OQ-042:** Source IP enrichment with Azure resource data is deferred to Phase 2.

Phase 1 surfaces raw IP addresses in the evidence table without enrichment.

## Heuristics for Likely Location

These must be framed as hints.

| Evidence | Possible Meaning |
|---|---|
| Known Azure outbound IP | Azure Function, App Service, Logic App or hosted workload |
| Dataverse resource requested | Dataverse integration, plugin helper, CLI, app or service |
| Graph resource requested | Graph automation, Teams, Planner, SharePoint, user or group read |
| SharePoint resource requested | SharePoint integration, file handling, document automation |
| Repeated daily same time | Scheduled job or pipeline |
| Burst during deployment hours | CI/CD pipeline or release tool |
| Rare quarterly pattern | batch/export job with long interval |
