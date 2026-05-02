import type { TokenCredential } from '@azure/identity';
import type { Client } from '@microsoft/microsoft-graph-client';
import type { AuthMode } from '../auth/AuthMode.js';
import { CapabilityEvaluator } from './CapabilityEvaluator.js';
import { LogAnalyticsClient } from '../usage/LogAnalyticsClient.js';

export interface CapabilitySet {
  canReadApplications: boolean;
  canReadApplicationSecrets: boolean;
  canReadServicePrincipals: boolean;
  canReadOwners: boolean;
  canReadDirectory: boolean;
  canQueryLogAnalytics: boolean;
  canAnalyzeServicePrincipalSignIns: boolean;
  canCreateApplicationSecrets: boolean;
  canDeleteApplicationSecrets: boolean;
  canCreateApplications: boolean;
  canReadAzureResources: boolean;
  canReadKeyVaultMetadata: boolean;
}

export interface PreflightResult {
  tenantId: string;
  environmentName: string;
  authValid: boolean;
  graphReachable: boolean;
  checkedAt: string;
  capabilities: CapabilitySet;
  missingPermissions: string[];
  warnings: string[];
  errors: string[];
}

export interface PreflightParams {
  tenantId: string;
  environmentName: string;
  authMode: AuthMode;
  logAnalyticsWorkspaceId?: string;
}

export class PreflightService {
  constructor(
    private readonly client: Client,
    private readonly credential: TokenCredential,
  ) {}

  async run(params: PreflightParams): Promise<PreflightResult> {
    const checkedAt = new Date().toISOString();
    const errors: string[] = [];

    // Step 1 — verify token acquisition
    let authValid = false;
    try {
      await this.credential.getToken('https://graph.microsoft.com/.default');
      authValid = true;
    } catch (err) {
      errors.push(
        `Authentication failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.failResult(params, checkedAt, errors);
    }

    // Step 2 — verify Graph is reachable (a 403 still means reachable)
    let graphReachable = false;
    try {
      await this.client.api('/organization').select('id').top(1).get();
      graphReachable = true;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 403 || status === 401) {
        graphReachable = true; // API responded — reachable but permission limited
      } else {
        errors.push(
          `Microsoft Graph is not reachable: ${err instanceof Error ? err.message : String(err)}`,
        );
        return this.failResult(params, checkedAt, errors, true);
      }
    }

    // Step 3 — evaluate all capabilities (hints are auth-mode-aware)
    const evaluator = new CapabilityEvaluator(this.client, params.authMode);
    const graphResult = await evaluator.evaluateAll();

    // Step 4 — Log Analytics capability check
    let canQueryLogAnalytics = false;
    let canAnalyzeServicePrincipalSignIns = false;
    const laWarnings: string[] = [];

    if (params.logAnalyticsWorkspaceId) {
      const laClient = new LogAnalyticsClient(this.credential);
      const laResult = await laClient.checkCapability(params.logAnalyticsWorkspaceId);
      canQueryLogAnalytics = laResult.canQuery;
      canAnalyzeServicePrincipalSignIns = laResult.canAnalyzeSignIns;
      if (laResult.warning) laWarnings.push(laResult.warning);
      if (!laResult.canQuery) {
        graphResult.missingPermissions.push(
          'Log Analytics Reader or Monitoring Reader role on workspace',
        );
      }
    } else {
      laWarnings.push(
        'No Log Analytics workspace configured for this environment. Usage analysis is unavailable.',
      );
    }

    const capabilities: CapabilitySet = {
      ...graphResult.capabilities,
      canQueryLogAnalytics,
      canAnalyzeServicePrincipalSignIns,
    };

    return {
      tenantId: params.tenantId,
      environmentName: params.environmentName,
      authValid,
      graphReachable,
      checkedAt,
      capabilities,
      missingPermissions: graphResult.missingPermissions,
      warnings: [...graphResult.warnings, ...laWarnings],
      errors,
    };
  }

  private failResult(
    params: PreflightParams,
    checkedAt: string,
    errors: string[],
    authValid = false,
  ): PreflightResult {
    return {
      tenantId: params.tenantId,
      environmentName: params.environmentName,
      authValid,
      graphReachable: false,
      checkedAt,
      capabilities: {
        canReadApplications: false,
        canReadApplicationSecrets: false,
        canReadServicePrincipals: false,
        canReadOwners: false,
        canReadDirectory: false,
        canQueryLogAnalytics: false,
        canAnalyzeServicePrincipalSignIns: false,
        canCreateApplicationSecrets: false,
        canDeleteApplicationSecrets: false,
        canCreateApplications: false,
        canReadAzureResources: false,
        canReadKeyVaultMetadata: false,
      },
      missingPermissions: [],
      warnings: [],
      errors,
    };
  }
}
