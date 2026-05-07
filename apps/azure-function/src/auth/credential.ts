import { DefaultAzureCredential } from '@azure/identity';
import type { TokenCredential } from '@azure/identity';

let _credential: TokenCredential | undefined;

/**
 * Returns a shared DefaultAzureCredential instance.
 * In production: picks up AZURE_CLIENT_ID → UAMI.
 * In local dev: falls back to Azure CLI / VS Code / environment credentials.
 */
export function getCredential(): TokenCredential {
  _credential ??= new DefaultAzureCredential();
  return _credential;
}
