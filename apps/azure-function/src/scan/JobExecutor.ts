import { ClientSecretCredential, ManagedIdentityCredential, ClientAssertionCredential } from '@azure/identity';
import type { TokenCredential } from '@azure/identity';
import { getSecret } from '../storage/KeyVaultCredentialStore.js';
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
import { getResultStore } from '../storage/stores.js';

export interface JobScanResult {
  secretsEnvelope: ResultEnvelope<AppRegistrationSummary[]>;
  preflightEnvelope: ResultEnvelope<PreflightResult>;
  secretCount: number;
}

export async function executeJob(job: JobConfig): Promise<JobScanResult> {
  const credential = await resolveCredential(job);
  const graphClient = createGraphClient(credential);

  // Run preflight first and save it immediately — so it is always persisted
  // even if the subsequent inventory scan fails (e.g. wrong credentials).
  const preflightResult = await new PreflightService(graphClient, credential).run({
    tenantId: job.tenantId,
    authMode: job.authMode as 'client-secret',
    logAnalyticsWorkspaceId: job.logAnalytics?.workspaceId ?? undefined,
  });

  const preflightEnvelope = createResultEnvelope(preflightResult, job.tenantId, {
    errors:   preflightResult.errors,
    warnings: preflightResult.warnings,
  });

  // Persist preflight before attempting inventory — auth errors become visible immediately.
  await getResultStore().savePreflight(job.tenantId, preflightEnvelope);

  // If auth failed, stop here — no point querying Graph for inventory.
  if (!preflightResult.authValid) {
    const emptyEnvelope = createResultEnvelope([] as AppRegistrationSummary[], job.tenantId, {
      errors: preflightResult.errors,
    });
    return { secretsEnvelope: emptyEnvelope, preflightEnvelope, secretCount: 0 };
  }

  const inventory = await new SecretInventoryService(
    new GraphApplicationReader(graphClient),
  ).getInventory({ includeOwners: true });

  return {
    secretsEnvelope: createResultEnvelope(inventory, job.tenantId),
    preflightEnvelope,
    secretCount: inventory.reduce((sum, app) => sum + app.secretCount, 0),
  };
}

async function resolveCredential(job: JobConfig): Promise<TokenCredential> {
  switch (job.authMode) {
    case 'client-secret': {
      if (!job.credentialRef) {
        throw new Error(`Job "${job.id}": credentialRef is required for client-secret mode`);
      }
      const secret = await getSecret(job.credentialRef);
      if (!secret) {
        throw new Error(`Job "${job.id}": secret "${job.credentialRef}" not found in Key Vault or env fallback`);
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
