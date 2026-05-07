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

  async saveSecrets(tenantId: string, envName: string, envelope: unknown): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await Promise.all([
      this.upload(`history/${tenantId}/${envName}/secrets-${timestamp}.json`, envelope),
      this.upload(`latest/${tenantId}/${envName}/secrets.json`, envelope),
    ]);
  }

  async savePreflight(tenantId: string, envName: string, envelope: unknown): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await Promise.all([
      this.upload(`history/${tenantId}/${envName}/preflight-${timestamp}.json`, envelope),
      this.upload(`latest/${tenantId}/${envName}/preflight.json`, envelope),
    ]);
  }

  async getLatestSecrets(tenantId: string, envName: string): Promise<unknown | null> {
    return this.downloadJson(`latest/${tenantId}/${envName}/secrets.json`);
  }

  async getLatestPreflight(tenantId: string, envName: string): Promise<unknown | null> {
    return this.downloadJson(`latest/${tenantId}/${envName}/preflight.json`);
  }

  /** Returns all {tenantId, envName} pairs that have a latest/secrets.json blob. */
  async listTenantEnvironments(): Promise<Array<{ tenantId: string; envName: string }>> {
    const container = this.blobs.getContainerClient(DATA_CONTAINER);
    const results: Array<{ tenantId: string; envName: string }> = [];
    for await (const blob of container.listBlobsFlat({ prefix: 'latest/' })) {
      const match = blob.name.match(/^latest\/([^/]+)\/([^/]+)\/secrets\.json$/);
      if (match) results.push({ tenantId: match[1], envName: match[2] });
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
