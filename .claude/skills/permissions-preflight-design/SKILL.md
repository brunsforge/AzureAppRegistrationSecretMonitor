---
name: permissions-preflight-design
description: Design permissions, Graph scopes, Entra roles, Azure RBAC requirements and tenant capability checks.
---


# Skill: Permissions and Preflight Design

## Required Reads

- `concept/03_permissions_and_preflight.md`
- `concept/02_domain_model.md`
- `concept/07_maui_blazor_ui_concept.md`
- `concept/09_open_questions.md`

## Focus

- Microsoft Graph permissions
- delegated vs application permission implications
- Entra roles
- Azure RBAC for Log Analytics
- capability model
- UI feature gating
- safe read-only MVP

## Rules

- Do not claim write operations are available unless the concept explicitly validates them.
- Prefer capability checks over static permission assumptions.
- Add uncertain permission mappings to open questions.
