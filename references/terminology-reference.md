# Terminology Reference

Use these terms consistently across concept files, commands, skills and UI text.

| Term | Meaning |
|---|---|
| Tenant | Microsoft Entra tenant. |
| Environment | A configured monitoring context, usually tenant + stage + auth mode + optional workspace. |
| App Registration | Entra application object. |
| Service Principal | Enterprise application / service principal instance in a tenant. |
| Password Credential | Graph object representing a client secret metadata entry. |
| Secret | User-facing term for password credential/client secret. |
| Key ID | `keyId` of a password credential. |
| Hint | Secret hint returned by Graph metadata. |
| Preflight Check | Test that determines available permissions/capabilities for an environment. |
| Capability | Boolean or structured flag that tells UI/CLI which feature is available. |
| Finding | A detected issue or noteworthy state. |
| Risk Level | Severity classification for a finding. |
| Usage Analysis | Log Analytics based analysis of service principal sign-ins. |
| Guided Rotation | Post-MVP feature that guides users through safe secret rotation. |
| Remediation Hint | Human-readable next step for resolving a finding. |
