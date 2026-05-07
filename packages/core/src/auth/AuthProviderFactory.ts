import {
  AzureCliCredential,
  ClientAssertionCredential,
  ClientCertificateCredential,
  ClientSecretCredential,
  DeviceCodeCredential,
  InteractiveBrowserCredential,
  ManagedIdentityCredential,
  UsernamePasswordCredential,
  useIdentityPlugin,
  type TokenCredential,
} from '@azure/identity';
import { cachePersistencePlugin } from '@azure/identity-cache-persistence';
import { AuthError } from '../errors/index.js';
import type { AuthMode } from './AuthMode.js';

export interface ClientSecretAuthConfig {
  mode: 'client-secret';
  tenantId: string;
  clientId: string;
  /** Retrieved from OS credential store at runtime — never stored in plain config files. */
  clientSecret: string;
}

export interface DeviceCodeAuthConfig {
  mode: 'device-code';
  tenantId: string;
  clientId: string;
}

export interface InteractiveBrowserAuthConfig {
  mode: 'interactive-browser';
  tenantId: string;
  clientId: string;
  /** Defaults to http://localhost when not set. */
  redirectUri?: string;
}

export interface CertificateAuthConfig {
  mode: 'certificate';
  tenantId: string;
  clientId: string;
  certificatePath: string;
}

export interface AzureCliAuthConfig {
  mode: 'azure-cli';
  tenantId?: string;
}

/**
 * Username + password (ROPC — Resource Owner Password Credentials flow).
 *
 * Limitations:
 * - Does NOT support accounts with MFA enabled.
 * - Does NOT support federated/guest accounts from other tenants.
 * - Requires the App Registration to have "Allow public client flows" enabled.
 * - Considered a legacy flow by Microsoft — prefer device-code when possible.
 */
export interface UsernamePasswordAuthConfig {
  mode: 'username-password';
  tenantId: string;
  clientId: string;
  /** User principal name (UPN) — the email address used to sign in to Entra. */
  username: string;
  /** Retrieved from OS credential store at runtime — never stored in plain JSON. */
  password: string;
}

/**
 * Credential-free cross-tenant access via OIDC Workload Identity Federation.
 * The runtime's Managed Identity (UAMI via AZURE_CLIENT_ID) issues an OIDC token
 * that the target tenant trusts as a federated credential.
 * Only valid in Azure-hosted environments with a configured UAMI.
 */
export interface WorkloadIdentityFederationAuthConfig {
  mode: 'workload-identity-federation';
  tenantId: string;
  clientId: string;
}

export type AuthConfig =
  | ClientSecretAuthConfig
  | DeviceCodeAuthConfig
  | InteractiveBrowserAuthConfig
  | CertificateAuthConfig
  | AzureCliAuthConfig
  | UsernamePasswordAuthConfig
  | WorkloadIdentityFederationAuthConfig;

// Register the cache-persistence plugin once (idempotent).
// Enables persistent token caching for interactive-browser and device-code modes
// so the user does not need to re-authenticate on every CLI invocation.
try { useIdentityPlugin(cachePersistencePlugin); } catch { /* unavailable in some environments */ }

const TOKEN_CACHE_OPTIONS = { enabled: true };

export function createCredential(config: AuthConfig): TokenCredential {
  switch (config.mode) {
    case 'client-secret':
      return new ClientSecretCredential(
        config.tenantId,
        config.clientId,
        config.clientSecret,
      );
    case 'device-code':
      return new DeviceCodeCredential({
        tenantId: config.tenantId,
        clientId: config.clientId,
        tokenCachePersistenceOptions: TOKEN_CACHE_OPTIONS,
        // Write to stderr so that --output json stdout stays clean for machine consumers
        // and MAUI can surface the code/URL via the ProgressMessage event.
        userPromptCallback: (info) => process.stderr.write(info.message + '\n'),
      });
    case 'interactive-browser':
      return new InteractiveBrowserCredential({
        tenantId: config.tenantId,
        clientId: config.clientId,
        redirectUri: config.redirectUri ?? 'http://localhost',
        tokenCachePersistenceOptions: TOKEN_CACHE_OPTIONS,
      });
    case 'certificate':
      return new ClientCertificateCredential(
        config.tenantId,
        config.clientId,
        config.certificatePath,
      );
    case 'azure-cli':
      return new AzureCliCredential({ tenantId: config.tenantId });
    case 'workload-identity-federation': {
      const uamiClientId = process.env['AZURE_CLIENT_ID'];
      const msiCred = new ManagedIdentityCredential(
        uamiClientId ? { clientId: uamiClientId } : {},
      );
      return new ClientAssertionCredential(
        config.tenantId,
        config.clientId,
        async () => {
          const token = await msiCred.getToken('api://AzureADTokenExchange');
          return token.token;
        },
      );
    }
    case 'username-password':
      return new UsernamePasswordCredential(
        config.tenantId,
        config.clientId,
        config.username,
        config.password,
      );
    default: {
      const exhaustive: never = config;
      throw new AuthError(
        `Unsupported auth mode: ${(exhaustive as { mode: AuthMode }).mode}`,
      );
    }
  }
}
