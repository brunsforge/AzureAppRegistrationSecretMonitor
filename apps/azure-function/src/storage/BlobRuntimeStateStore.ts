import { BlobServiceClient } from '@azure/storage-blob';
import type { TokenCredential } from '@azure/identity';
import type { Readable } from 'node:stream';
import type { JobRuntimeState } from '../types/RuntimeState.js';
import { streamToString } from './blobHelpers.js';

const DATA_CONTAINER = 'aarm-data';

export class BlobRuntimeStateStore {
  private readonly blobs: BlobServiceClient;

  constructor(storageUri: string, credential: TokenCredential) {
    this.blobs = new BlobServiceClient(storageUri, credential);
  }

  async read(jobId: string): Promise<JobRuntimeState> {
    const container = this.blobs.getContainerClient(DATA_CONTAINER);
    const blob = container.getBlockBlobClient(`runtime/${jobId}.json`);
    try {
      const { readableStreamBody } = await blob.download();
      if (!readableStreamBody) return emptyState(jobId);
      const content = await streamToString(readableStreamBody as Readable);
      return JSON.parse(content) as JobRuntimeState;
    } catch {
      return emptyState(jobId);
    }
  }

  async write(state: JobRuntimeState): Promise<void> {
    const container = this.blobs.getContainerClient(DATA_CONTAINER);
    const blob = container.getBlockBlobClient(`runtime/${state.jobId}.json`);
    const content = JSON.stringify(state, null, 2);
    await blob.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
  }

  async delete(jobId: string): Promise<void> {
    const container = this.blobs.getContainerClient(DATA_CONTAINER);
    const blob = container.getBlockBlobClient(`runtime/${jobId}.json`);
    await blob.deleteIfExists();
  }
}

function emptyState(jobId: string): JobRuntimeState {
  return { jobId, lastRunAt: null, lastRunStatus: null, lastRunSecretsFound: null };
}
