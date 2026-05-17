import { BlobServiceClient } from '@azure/storage-blob';
import type { TokenCredential } from '@azure/identity';
import type { Readable } from 'node:stream';
import { streamToString } from './blobHelpers.js';

const DATA_CONTAINER = 'aarm-data';

export class BlobResultStore {
  private readonly blobs: BlobServiceClient;

  constructor(storageUri: string, credential: TokenCredential) {
    this.blobs = new BlobServiceClient(storageUri, credential);
  }

  async saveSecrets(tenantId: string, envelope: unknown): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await Promise.all([
      this.upload(`history/${tenantId}/secrets-${timestamp}.json`, envelope),
      this.upload(`latest/${tenantId}/secrets.json`, envelope),
    ]);
  }

  async savePreflight(tenantId: string, envelope: unknown): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await Promise.all([
      this.upload(`history/${tenantId}/preflight-${timestamp}.json`, envelope),
      this.upload(`latest/${tenantId}/preflight.json`, envelope),
    ]);
  }

  async getLatestSecrets(tenantId: string): Promise<unknown | null> {
    return this.downloadJson(`latest/${tenantId}/secrets.json`);
  }

  async getLatestPreflight(tenantId: string): Promise<unknown | null> {
    return this.downloadJson(`latest/${tenantId}/preflight.json`);
  }

  /**
   * Returns summary rows for the last `maxEntries` scans of a tenant,
   * newest first. Downloads each history blob to extract counts.
   */
  async listHistory(tenantId: string, maxEntries = 60): Promise<HistorySummary[]> {
    const container = this.blobs.getContainerClient(DATA_CONTAINER);
    const prefix = `history/${tenantId}/secrets-`;

    const blobNames: string[] = [];
    for await (const blob of container.listBlobsFlat({ prefix })) {
      blobNames.push(blob.name);
    }
    // Sort descending (ISO-like filename), take the most recent N.
    blobNames.sort().reverse();
    const slice = blobNames.slice(0, maxEntries);

    const results = await Promise.all(slice.map(async (name) => {
      try {
        const data = await this.downloadJson(name) as HistoryBlob | null;
        if (!data) return null;
        const apps = Array.isArray(data.data) ? data.data : [];
        const scannedAt = data.metadata?.generatedAt ?? this.timestampFromName(name);
        return {
          scannedAt,
          appCount:     apps.length,
          secretCount:  apps.reduce((s: number, a: AppSummaryLike) => s + (a.secretCount ?? 0), 0),
          expiredCount: apps.reduce((s: number, a: AppSummaryLike) => s + (a.expiredSecretCount ?? 0), 0),
          expiringCount: apps.reduce((s: number, a: AppSummaryLike) => s + (a.expiringSecretCount ?? 0), 0),
        } satisfies HistorySummary;
      } catch {
        return null;
      }
    }));

    return results.filter((r): r is HistorySummary => r !== null);
  }

  private timestampFromName(blobName: string): string {
    // e.g. history/<id>/secrets-2026-05-16T08-00-00-000Z.json → ISO string
    const match = blobName.match(/secrets-(.+)\.json$/);
    if (!match) return new Date().toISOString();
    return match[1].replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
  }

  /** Returns all tenantIds that have a latest/secrets.json blob. */
  async listTenants(): Promise<string[]> {
    const container = this.blobs.getContainerClient(DATA_CONTAINER);
    const results: string[] = [];
    for await (const blob of container.listBlobsFlat({ prefix: 'latest/' })) {
      const match = blob.name.match(/^latest\/([^/]+)\/secrets\.json$/);
      if (match) results.push(match[1]);
    }
    return results;
  }

  private async upload(blobPath: string, data: unknown): Promise<void> {
    const container = this.blobs.getContainerClient(DATA_CONTAINER);
    const blob = container.getBlockBlobClient(blobPath);
    const content = JSON.stringify(data, null, 2);
    await blob.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
  }

  private async downloadJson(blobPath: string): Promise<unknown | null> {
    const container = this.blobs.getContainerClient(DATA_CONTAINER);
    const blob = container.getBlockBlobClient(blobPath);
    try {
      const { readableStreamBody } = await blob.download();
      if (!readableStreamBody) return null;
      const content = await streamToString(readableStreamBody as Readable);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

export interface HistorySummary {
  scannedAt: string;
  appCount: number;
  secretCount: number;
  expiredCount: number;
  expiringCount: number;
}

interface HistoryBlob {
  metadata?: { generatedAt?: string };
  data?: AppSummaryLike[];
}

interface AppSummaryLike {
  secretCount?: number;
  expiredSecretCount?: number;
  expiringSecretCount?: number;
}
