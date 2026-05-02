import type { AuthMode } from '../auth/AuthMode.js';
import type { CapabilitySet } from './PreflightService.js';

// ── Auth mode classification ─────────────────────────────────────────────────

const DELEGATED_MODES: ReadonlySet<AuthMode> = new Set([
  'device-code',
  'interactive-browser',
  'username-password',
  'azure-cli',
]);

export function isDelegatedMode(authMode: AuthMode): boolean {
  return DELEGATED_MODES.has(authMode);
}

// ── Permission hints per auth type ───────────────────────────────────────────

/**
 * Hints for application-permission modes (client-secret, certificate).
 * The token is issued to the service principal; no user is involved.
 * All permissions must be APPLICATION permissions with admin consent.
 */
export const APPLICATION_PERMISSION_HINTS: Record<keyof CapabilitySet, string> = {
  canReadApplications:
    'Application permission missing: Microsoft Graph → Application.Read.All (application) — grant admin consent',
  canReadApplicationSecrets:
    'Application permission missing: Microsoft Graph → Application.Read.All (application) — passwordCredentials are included in the applications response',
  canReadServicePrincipals:
    'Application permission missing: Microsoft Graph → Application.Read.All or Directory.Read.All (application) — grant admin consent',
  canReadOwners:
    'Application permission missing: Microsoft Graph → Directory.Read.All (application) — grant admin consent',
  canReadDirectory:
    'Application permission missing: Microsoft Graph → Directory.Read.All (application) — grant admin consent',
  canQueryLogAnalytics:
    'Azure RBAC missing: assign Log Analytics Reader or Monitoring Reader to the service principal on the Log Analytics workspace',
  canAnalyzeServicePrincipalSignIns:
    'Azure RBAC missing: Log Analytics Reader on workspace AND Entra diagnostic settings must route AADServicePrincipalSignInLogs to the workspace',
  canCreateApplicationSecrets:
    'Application permission missing: Microsoft Graph → Application.ReadWrite.All (application) — grant admin consent',
  canDeleteApplicationSecrets:
    'Application permission missing: Microsoft Graph → Application.ReadWrite.All (application) — grant admin consent',
  canCreateApplications:
    'Application permission missing: Microsoft Graph → Application.ReadWrite.All (application) — grant admin consent',
  canReadAzureResources:
    'Azure RBAC missing: Reader role on the relevant subscription or resource group (assign to the service principal)',
  canReadKeyVaultMetadata:
    'Azure RBAC missing: Key Vault Reader on the Key Vault (assign to the service principal)',
};

/**
 * Hints for delegated-permission modes (device-code, interactive-browser,
 * username-password, azure-cli).
 * The token represents the signed-in user. Both a delegated permission grant
 * AND the user's Entra directory role are required.
 */
export const DELEGATED_PERMISSION_HINTS: Record<keyof CapabilitySet, string> = {
  canReadApplications:
    'Delegated permission missing or user role missing: ' +
    'API permissions → Microsoft Graph → Delegated → Application.Read.All (admin consent required) ' +
    'AND signed-in user must have Cloud Application Administrator or Application Administrator role',
  canReadApplicationSecrets:
    'Delegated permission missing or user role missing: ' +
    'API permissions → Microsoft Graph → Delegated → Application.Read.All (admin consent required) ' +
    'AND signed-in user must have Cloud Application Administrator or Application Administrator role',
  canReadServicePrincipals:
    'Delegated permission missing: ' +
    'API permissions → Microsoft Graph → Delegated → Application.Read.All or Directory.Read.All (admin consent required)',
  canReadOwners:
    'Delegated permission missing: ' +
    'API permissions → Microsoft Graph → Delegated → Directory.Read.All (admin consent required)',
  canReadDirectory:
    'Delegated permission missing: ' +
    'API permissions → Microsoft Graph → Delegated → Directory.Read.All (admin consent required)',
  canQueryLogAnalytics:
    'Azure RBAC missing: assign Log Analytics Reader or Monitoring Reader to the signed-in user on the Log Analytics workspace',
  canAnalyzeServicePrincipalSignIns:
    'Azure RBAC missing: Log Analytics Reader on workspace (for signed-in user) AND Entra diagnostic settings must route AADServicePrincipalSignInLogs to the workspace',
  canCreateApplicationSecrets:
    'Delegated permission missing or user role missing: ' +
    'API permissions → Microsoft Graph → Delegated → Application.ReadWrite.All (admin consent required) ' +
    'AND signed-in user must have Application Administrator role',
  canDeleteApplicationSecrets:
    'Delegated permission missing or user role missing: ' +
    'API permissions → Microsoft Graph → Delegated → Application.ReadWrite.All (admin consent required) ' +
    'AND signed-in user must have Application Administrator role',
  canCreateApplications:
    'Delegated permission missing or user role missing: ' +
    'API permissions → Microsoft Graph → Delegated → Application.ReadWrite.All (admin consent required) ' +
    'AND signed-in user must have Application Administrator role',
  canReadAzureResources:
    'Azure RBAC missing: Reader role on the relevant subscription or resource group (assign to the signed-in user)',
  canReadKeyVaultMetadata:
    'Azure RBAC missing: Key Vault Reader on the Key Vault (assign to the signed-in user)',
};

/** Returns the correct hint set for a given auth mode. */
export function getPermissionHints(authMode: AuthMode): Record<keyof CapabilitySet, string> {
  return isDelegatedMode(authMode)
    ? DELEGATED_PERMISSION_HINTS
    : APPLICATION_PERMISSION_HINTS;
}

// ── Legacy export (kept for explain command and backwards compatibility) ──────

/** @deprecated Use getPermissionHints(authMode) for mode-aware hints. */
export const PERMISSION_HINTS = APPLICATION_PERMISSION_HINTS;

export interface PermissionDetail {
  capability: keyof CapabilitySet;
  applicationHint: string;
  delegatedHint: string;
  requiresAdminConsent: boolean;
  requiresUserRole: boolean;
  mvp: boolean;
}

/** Full detail set used by `preflight explain`. */
export const PERMISSION_DETAILS: PermissionDetail[] = [
  {
    capability: 'canReadApplications',
    applicationHint: APPLICATION_PERMISSION_HINTS.canReadApplications,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canReadApplications,
    requiresAdminConsent: true,
    requiresUserRole: true,
    mvp: true,
  },
  {
    capability: 'canReadApplicationSecrets',
    applicationHint: APPLICATION_PERMISSION_HINTS.canReadApplicationSecrets,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canReadApplicationSecrets,
    requiresAdminConsent: true,
    requiresUserRole: true,
    mvp: true,
  },
  {
    capability: 'canReadServicePrincipals',
    applicationHint: APPLICATION_PERMISSION_HINTS.canReadServicePrincipals,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canReadServicePrincipals,
    requiresAdminConsent: true,
    requiresUserRole: false,
    mvp: true,
  },
  {
    capability: 'canReadOwners',
    applicationHint: APPLICATION_PERMISSION_HINTS.canReadOwners,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canReadOwners,
    requiresAdminConsent: true,
    requiresUserRole: false,
    mvp: true,
  },
  {
    capability: 'canReadDirectory',
    applicationHint: APPLICATION_PERMISSION_HINTS.canReadDirectory,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canReadDirectory,
    requiresAdminConsent: true,
    requiresUserRole: false,
    mvp: true,
  },
  {
    capability: 'canQueryLogAnalytics',
    applicationHint: APPLICATION_PERMISSION_HINTS.canQueryLogAnalytics,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canQueryLogAnalytics,
    requiresAdminConsent: false,
    requiresUserRole: false,
    mvp: true,
  },
  {
    capability: 'canAnalyzeServicePrincipalSignIns',
    applicationHint: APPLICATION_PERMISSION_HINTS.canAnalyzeServicePrincipalSignIns,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canAnalyzeServicePrincipalSignIns,
    requiresAdminConsent: false,
    requiresUserRole: false,
    mvp: true,
  },
  {
    capability: 'canCreateApplicationSecrets',
    applicationHint: APPLICATION_PERMISSION_HINTS.canCreateApplicationSecrets,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canCreateApplicationSecrets,
    requiresAdminConsent: true,
    requiresUserRole: true,
    mvp: false,
  },
  {
    capability: 'canDeleteApplicationSecrets',
    applicationHint: APPLICATION_PERMISSION_HINTS.canDeleteApplicationSecrets,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canDeleteApplicationSecrets,
    requiresAdminConsent: true,
    requiresUserRole: true,
    mvp: false,
  },
  {
    capability: 'canCreateApplications',
    applicationHint: APPLICATION_PERMISSION_HINTS.canCreateApplications,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canCreateApplications,
    requiresAdminConsent: true,
    requiresUserRole: true,
    mvp: false,
  },
  {
    capability: 'canReadAzureResources',
    applicationHint: APPLICATION_PERMISSION_HINTS.canReadAzureResources,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canReadAzureResources,
    requiresAdminConsent: false,
    requiresUserRole: false,
    mvp: false,
  },
  {
    capability: 'canReadKeyVaultMetadata',
    applicationHint: APPLICATION_PERMISSION_HINTS.canReadKeyVaultMetadata,
    delegatedHint: DELEGATED_PERMISSION_HINTS.canReadKeyVaultMetadata,
    requiresAdminConsent: false,
    requiresUserRole: false,
    mvp: false,
  },
];
