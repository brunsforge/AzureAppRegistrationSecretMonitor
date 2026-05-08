import type { Client } from '@microsoft/microsoft-graph-client';
import type { AuthMode } from '../auth/AuthMode.js';
import { getPermissionHints, isDelegatedMode } from './PermissionHintMapper.js';
import type { CapabilitySet } from './PreflightService.js';

interface CheckOutcome {
  value: boolean;
  missingPermissionHint?: string;
  warning?: string;
}

export class CapabilityEvaluator {
  private readonly hints: Record<keyof CapabilitySet, string>;
  private readonly delegated: boolean;

  constructor(
    private readonly client: Client,
    authMode: AuthMode,
  ) {
    this.hints = getPermissionHints(authMode);
    this.delegated = isDelegatedMode(authMode);
  }

  async evaluateAll(): Promise<{
    capabilities: Omit<CapabilitySet, 'canQueryLogAnalytics' | 'canAnalyzeServicePrincipalSignIns'>;
    missingPermissions: string[];
    warnings: string[];
  }> {
    const missing: string[] = [];
    const warnings: string[] = [];

    /**
     * Record a capability check outcome.
     * required=true  → failure adds to missingPermissions (blocks core functionality)
     * required=false → failure adds to warnings (optional feature unavailable)
     */
    const record = <K extends keyof Omit<CapabilitySet, 'canQueryLogAnalytics' | 'canAnalyzeServicePrincipalSignIns'>>(
      key: K,
      outcome: CheckOutcome,
      required = false,
    ): boolean => {
      if (!outcome.value && outcome.missingPermissionHint) {
        if (required) {
          missing.push(outcome.missingPermissionHint);
        } else {
          warnings.push(`Optional capability unavailable: ${outcome.missingPermissionHint}`);
        }
      }
      if (outcome.warning) warnings.push(outcome.warning);
      return outcome.value;
    };

    // canReadApplications
    let firstAppId: string | undefined;
    const appsOutcome = await this.check(async () => {
      const resp = await this.client
        .api('/applications')
        .select('id')
        .top(1)
        .get() as { value: Array<{ id: string }> };
      firstAppId = resp.value[0]?.id;
    }, this.hints.canReadApplications);

    // canReadApplicationSecrets — passwordCredentials included in applications response
    const secretsOutcome = await this.check(async () => {
      await this.client
        .api('/applications')
        .select('id,passwordCredentials')
        .top(1)
        .get();
    }, this.hints.canReadApplicationSecrets);

    // canReadServicePrincipals
    const spOutcome = await this.check(async () => {
      await this.client.api('/servicePrincipals').select('id').top(1).get();
    }, this.hints.canReadServicePrincipals);

    // canReadOwners — requires a known application object ID
    let ownersOutcome: CheckOutcome;
    if (firstAppId) {
      ownersOutcome = await this.check(async () => {
        await this.client
          .api(`/applications/${firstAppId}/owners`)
          .select('id')
          .get();
      }, this.hints.canReadOwners);
    } else {
      ownersOutcome = {
        value: false,
        warning: 'canReadOwners could not be verified: no applications found in this tenant.',
      };
    }

    // canReadDirectory — organisation endpoint
    const dirOutcome = await this.check(async () => {
      await this.client.api('/organization').select('id').top(1).get();
    }, this.hints.canReadDirectory);

    // Write capabilities — not tested without mutation
    const writeHint = this.delegated
      ? 'Application.ReadWrite.All (delegated) + Application Administrator role on the signed-in user'
      : 'Application.ReadWrite.All (application permission) + admin consent';
    warnings.push(
      `Write capabilities (create/delete secrets, create apps) are not tested automatically to avoid mutations. ` +
      `Grant ${writeHint} and re-run preflight to verify write access.`,
    );

    // Azure resource capabilities — future phase
    warnings.push(
      'Azure resource and Key Vault capabilities (canReadAzureResources, canReadKeyVaultMetadata) will be evaluated in a future phase.',
    );

    return {
      capabilities: {
        canReadApplications:       record('canReadApplications',       appsOutcome,    true),
        canReadApplicationSecrets: record('canReadApplicationSecrets', secretsOutcome, true),
        canReadServicePrincipals:  record('canReadServicePrincipals',  spOutcome,      false),
        canReadOwners:             record('canReadOwners',             ownersOutcome,  false),
        canReadDirectory:          record('canReadDirectory',          dirOutcome,     false),
        canCreateApplicationSecrets: false,
        canDeleteApplicationSecrets: false,
        canCreateApplications: false,
        canReadAzureResources: false,
        canReadKeyVaultMetadata: false,
      },
      missingPermissions: missing,
      warnings,
    };
  }

  private async check(
    fn: () => Promise<unknown>,
    missingPermissionHint: string,
  ): Promise<CheckOutcome> {
    try {
      await fn();
      return { value: true };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 403 || status === 401) {
        return { value: false, missingPermissionHint };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return {
        value: false,
        warning: `Capability check failed with unexpected error (status ${status ?? 'unknown'}): ${msg}`,
      };
    }
  }
}
