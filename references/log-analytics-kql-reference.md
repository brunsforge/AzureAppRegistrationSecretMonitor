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

## Project limitations

- Log Analytics only contains data after diagnostic export is configured.
- Retention depends on workspace configuration.
- Logs show usage of credentials, not the concrete storage location of a secret.
- Source IP and resource names are hints, not proof of where a secret is configured.
