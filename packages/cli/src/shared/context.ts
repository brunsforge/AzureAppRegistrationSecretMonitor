import {
  AuthError,
  ConfigError,
  GraphError,
  PermissionError,
  createCredential,
  createGraphClient,
  GraphApplicationReader,
  PreflightService,
  SecretInventoryService,
  type AuthConfig,
  type AuthMode,
  type TenantProfile,
} from '@brunsforge/azure-app-registration-monitor';
import { ConfigStore } from '../config/ConfigStore.js';
import { CredentialStore } from '../config/CredentialStore.js';
import { EXIT } from '../exitCodes.js';

// Derive these types from factory functions to avoid direct imports from peer packages
type Credential = ReturnType<typeof createCredential>;
type GraphClient = ReturnType<typeof createGraphClient>;

export interface GlobalOptions {
  tenant?: string;
  configDir?: string;
  output: string;
  verbose: boolean;
  color: boolean;
  // Note: environment is not a CLI concept (each tenant has exactly one Graph API).
  // The environmentName field in context/output is always 'default' and exists
  // for compatibility with the ResultEnvelope JSON schema used by MAUI and Azure Function.
}

export interface CommandContext {
  configStore: ConfigStore;
  credentialStore: CredentialStore;
  credential: Credential;
  graphClient: GraphClient;
  graphReader: GraphApplicationReader;
  inventoryService: SecretInventoryService;
  preflightService: PreflightService;
  tenant: TenantProfile;
  tenantId: string;
  environmentName: string;
  authMode: AuthMode;
  logAnalyticsWorkspaceId?: string;
  isJson: boolean;
  verbose: boolean;
}

export async function buildContext(opts: GlobalOptions): Promise<CommandContext> {
  const configStore = new ConfigStore(opts.configDir);
  const credentialStore = new CredentialStore();

  if (!opts.tenant) {
    process.stderr.write(
      'Error: --tenant is required. Run "aarm tenants list" to see configured tenants.\n',
    );
    process.exit(EXIT.CONFIG_INVALID);
  }

  const tenant = await configStore.getTenant(opts.tenant);
  if (!tenant) {
    process.stderr.write(
      `Error: Tenant "${opts.tenant}" not found. Run "aarm tenants add" to configure it.\n`,
    );
    process.exit(EXIT.CONFIG_INVALID);
  }

  let authConfig: AuthConfig;

  if (tenant.authMode === 'client-secret') {
    if (!tenant.clientId) {
      process.stderr.write(`Error: Tenant "${tenant.displayName}" has no client ID configured.\n`);
      process.exit(EXIT.CONFIG_INVALID);
    }
    const secret = await credentialStore.getClientSecret(tenant.tenantId, tenant.clientId);
    if (!secret) {
      process.stderr.write(
        `Error: No client secret found for tenant "${tenant.displayName}". Re-run "aarm tenants add".\n`,
      );
      process.exit(EXIT.CONFIG_INVALID);
    }
    authConfig = {
      mode: 'client-secret',
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      clientSecret: secret,
    };
  } else if (tenant.authMode === 'username-password') {
    if (!tenant.clientId || !tenant.username) {
      process.stderr.write(
        `Error: Tenant "${tenant.displayName}" is missing clientId or username. Re-run "aarm tenants add".\n`,
      );
      process.exit(EXIT.CONFIG_INVALID);
    }
    const password = await credentialStore.getUserPassword(
      tenant.tenantId,
      tenant.clientId,
      tenant.username,
    );
    if (!password) {
      process.stderr.write(
        `Error: No password found for "${tenant.username}". Re-run "aarm tenants add".\n`,
      );
      process.exit(EXIT.CONFIG_INVALID);
    }
    authConfig = {
      mode: 'username-password',
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      username: tenant.username,
      password,
    };
  } else if (tenant.authMode === 'azure-cli') {
    authConfig = { mode: 'azure-cli', tenantId: tenant.tenantId };
  } else if (tenant.authMode === 'workload-identity-federation') {
    process.stderr.write(
      `Error: The "workload-identity-federation" auth mode requires an Azure-hosted runtime\n` +
      `(Function App, VM, ACI) and cannot be used with the aarm CLI.\n` +
      `For unattended automation use "client-secret" or "certificate".\n` +
      `For interactive use on a developer workstation use "device-code".\n`,
    );
    process.exit(EXIT.CONFIG_INVALID);
  } else {
    if (!tenant.clientId) {
      process.stderr.write(`Error: Tenant "${tenant.displayName}" has no client ID configured.\n`);
      process.exit(EXIT.CONFIG_INVALID);
    }
    authConfig = {
      mode: tenant.authMode as 'device-code' | 'interactive-browser' | 'certificate',
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
    } as AuthConfig;
  }

  const credential = createCredential(authConfig);
  const graphClient = createGraphClient(credential);
  const graphReader = new GraphApplicationReader(graphClient);
  const inventoryService = new SecretInventoryService(graphReader);
  const preflightService = new PreflightService(graphClient, credential);

  return {
    configStore,
    credentialStore,
    credential,
    graphClient,
    graphReader,
    inventoryService,
    preflightService,
    tenant,
    tenantId: tenant.tenantId,
    environmentName: tenant.defaultEnvironmentName ?? 'default',
    authMode: tenant.authMode,
    logAnalyticsWorkspaceId: tenant.logAnalyticsWorkspaceId,
    isJson: opts.output === 'json',
    verbose: opts.verbose,
  };
}

export function handleError(err: unknown): never {
  if (err instanceof AuthError) {
    process.stderr.write(`Authentication failed: ${err.message}\n`);
    process.stderr.write(
      'Check: correct tenant ID, client ID, secret value, and that the App Registration exists.\n',
    );
    process.exit(EXIT.AUTH_FAILED);
  }
  if (err instanceof PermissionError) {
    process.stderr.write(`Permission denied: ${err.message}\n`);
    process.stderr.write(
      'Check: Application.Read.All is in API permissions AND admin consent has been granted.\n' +
      'Run "aarm --tenant <name> preflight explain" for detailed grant instructions.\n',
    );
    process.exit(EXIT.PERMISSION_MISSING);
  }
  if (err instanceof GraphError) {
    process.stderr.write(`Graph API error: ${err.message}\n`);
    process.exit(EXIT.ERROR);
  }
  if (err instanceof ConfigError) {
    process.stderr.write(`Configuration error: ${err.message}\n`);
    process.exit(EXIT.CONFIG_INVALID);
  }
  if (err instanceof Error) {
    process.stderr.write(`Error: ${err.message}\n`);
  } else {
    process.stderr.write(`Unexpected error: ${String(err)}\n`);
  }
  process.exit(EXIT.ERROR);
}
