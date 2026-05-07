import { BlobServiceClient } from '@azure/storage-blob';
import type { TokenCredential } from '@azure/identity';
import type { Readable } from 'node:stream';
import type { JobsConfig } from '../types/JobConfig.js';
import { streamToString } from './blobHelpers.js';

const CONFIG_CONTAINER = 'aarm-config';

function emptyConfig(): JobsConfig {
  return { version: '1.0', jobs: [] };
}

function isBlobNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode: number }).statusCode === 404
  );
}

export class BlobJobConfigStore {
  private readonly blobs: BlobServiceClient;

  constructor(storageUri: string, credential: TokenCredential) {
    this.blobs = new BlobServiceClient(storageUri, credential);
  }

  async readJobs(): Promise<JobsConfig> {
    const container = this.blobs.getContainerClient(CONFIG_CONTAINER);
    const blob = container.getBlockBlobClient('jobs.json');
    try {
      const { readableStreamBody } = await blob.download();
      if (!readableStreamBody) return emptyConfig();
      return JSON.parse(await streamToString(readableStreamBody as Readable)) as JobsConfig;
    } catch (err: unknown) {
      // BlobNotFound (404) on a fresh deployment — return empty config so the function starts cleanly.
      if (isBlobNotFound(err)) return emptyConfig();
      throw err;
    }
  }

  /** Overwrites jobs.json with the provided config. */
  async writeJobs(config: JobsConfig): Promise<void> {
    const container = this.blobs.getContainerClient(CONFIG_CONTAINER);
    const blob = container.getBlockBlobClient('jobs.json');
    const content = JSON.stringify(config, null, 2);
    await blob.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
  }

  /** Returns the raw template JSON string, or null if the blob does not exist. */
  async readTemplate(blobName: string): Promise<string | null> {
    const container = this.blobs.getContainerClient(CONFIG_CONTAINER);
    const blob = container.getBlockBlobClient(`templates/${blobName}`);
    try {
      const { readableStreamBody } = await blob.download();
      if (!readableStreamBody) return null;
      return await streamToString(readableStreamBody as Readable);
    } catch {
      return null;
    }
  }
}
