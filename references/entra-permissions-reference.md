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

## Project rule

The product must start with a read-only monitoring MVP.
Write capabilities must be hidden or disabled unless the preflight result explicitly confirms the needed capability.
