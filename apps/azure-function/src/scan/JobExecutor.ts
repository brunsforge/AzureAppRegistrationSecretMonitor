import { ClientSecretCredential, ManagedIdentityCredential, ClientAssertionCredential } from '@azure/identity';
import type { TokenCredential } from '@azure/identity';
import {
  GraphApplicationReader,
  createGraphClient,
  SecretInventoryService,
  PreflightService,
  createResultEnvelope,
  type ResultEnvelope,
  type AppRegistrationSummary,
  type PreflightResult,
} from '@brunsforge/azure-app-registration-monitor';
import type { JobConfig } from '../types/JobConfig.js';

export interface JobScanResult {
  secretsEnvelope: ResultEnvelope<AppRegistrationSummary[]>;
  preflightEnvelope: ResultEnvelope<PreflightResult>;
  secretCount: number;
}

export async function executeJob(job: JobConfig): Promise<JobScanResult> {
  const credential = resolveCredential(job);
  const graphClient = createGraphClient(credential);

  const [preflightResult, inventory] = await Promise.all([
    new PreflightService(graphClient, credential).run({
      tenantId: job.tenantId,
      environmentName: job.environmentName,
      authMode: job.authMode as 'client-secret',
      logAnalyticsWorkspaceId: job.logAnalytics?.workspaceId ?? undefined,
    }),
    new SecretInventoryService(new GraphApplicationReader(graphClient)).getInventory({
      includeOwners: true,
    }),
  ]);

  return {
    secretsEnvelope: createResultEnvelope(inventory, job.tenantId, job.environmentName),
    preflightEnvelope: createResultEnvelope(preflightResult, job.tenantId, job.environmentName, {
      errors: preflightResult.errors,
      warnings: preflightResult.warnings,
    }),
    secretCount: inventory.reduce((sum, app) => sum + app.secretCount, 0),
  };
}

function resolveCredential(job: JobConfig): TokenCredential {
  switch (job.authMode) {
    case 'client-secret': {
      if (!job.credentialRef) {
        throw new Error(`Job "${job.id}": credentialRef is required for client-secret mode`);
      }
      const secret = process.env[job.credentialRef];
      if (!secret) {
        throw new Error(`Job "${job.id}": env var ${job.credentialRef} is not set or empty`);
      }
      return new ClientSecretCredential(job.tenantId, job.clientId, secret);
    }
    case 'workload-identity-federation': {
      const uamiClientId = process.env['AZURE_CLIENT_ID'];
      const msiCred = new ManagedIdentityCredential(
        uamiClientId ? { clientId: uamiClientId } : {},
      );
      return new ClientAssertionCredential(
        job.tenantId,
        job.clientId,
        async () => {
          const token = await msiCred.getToken('api://AzureADTokenExchange');
          return token.token;
        },
      );
    }
    case 'certificate':
      throw new Error(`Job "${job.id}": certificate auth mode is not yet implemented`);
    default: {
      const exhaustive: never = job.authMode;
      throw new Error(`Job "${job.id}": unsupported auth mode "${(exhaustive as JobConfig).authMode}"`);
    }
  }
}
