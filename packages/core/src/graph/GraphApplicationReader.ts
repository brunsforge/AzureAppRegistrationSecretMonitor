import { Client, PageIterator } from '@microsoft/microsoft-graph-client';
import type { TokenCredential } from '@azure/identity';
import { GraphError } from '../errors/index.js';

export interface GraphPasswordCredential {
  keyId: string;
  displayName: string | null;
  hint: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
}

export interface GraphApplication {
  id: string;
  appId: string;
  displayName: string;
  createdDateTime: string;
  passwordCredentials: GraphPasswordCredential[];
}

export interface GraphOwner {
  id: string;
  displayName: string | null;
  userPrincipalName: string | null;
}

/** Creates a Graph SDK client authenticated with an Azure Identity credential. */
export function createGraphClient(credential: TokenCredential): Client {
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken('https://graph.microsoft.com/.default');
        if (!token) throw new GraphError('Failed to acquire access token for Microsoft Graph');
        return token.token;
      },
    },
  });
}

export class GraphApplicationReader {
  constructor(private readonly client: Client) {}

  async listApplications(): Promise<GraphApplication[]> {
    const results: GraphApplication[] = [];
    let response: { value: GraphApplication[] };

    try {
      response = await this.client
        .api('/applications')
        .select('id,appId,displayName,createdDateTime,passwordCredentials')
        .top(999)
        .get() as { value: GraphApplication[] };
    } catch (err) {
      throw new GraphError(
        `Failed to list applications: ${err instanceof Error ? err.message : String(err)}`,
        (err as { statusCode?: number }).statusCode,
      );
    }

    const iterator = new PageIterator(
      this.client,
      response,
      (app: GraphApplication) => {
        results.push(app);
        return true;
      },
    );

    try {
      await iterator.iterate();
    } catch (err) {
      throw new GraphError(
        `Pagination error while listing applications: ${err instanceof Error ? err.message : String(err)}`,
        (err as { statusCode?: number }).statusCode,
      );
    }

    return results;
  }

  async getApplicationOwners(applicationObjectId: string): Promise<GraphOwner[]> {
    try {
      const response = await this.client
        .api(`/applications/${applicationObjectId}/owners`)
        .select('id,displayName,userPrincipalName')
        .get() as { value: GraphOwner[] };
      return response.value ?? [];
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // Silently return empty when the caller lacks Directory.Read.All.
      // The preflight result already exposes canReadOwners=false in this case.
      if (statusCode === 403 || statusCode === 401) {
        return [];
      }
      throw new GraphError(
        `Failed to get owners for application ${applicationObjectId}: ${err instanceof Error ? err.message : String(err)}`,
        statusCode,
      );
    }
  }
}
