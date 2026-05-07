import { BlobServiceClient } from '@azure/storage-blob';
import { BlobJobConfigStore } from './BlobJobConfigStore.js';
import { BlobResultStore } from './BlobResultStore.js';
import { BlobRuntimeStateStore } from './BlobRuntimeStateStore.js';
import { getCredential } from '../auth/credential.js';

const REQUIRED_CONTAINERS = ['aarm-config', 'aarm-data'] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Required environment variable ${name} is not set`);
  return value;
}

let _jobConfigStore: BlobJobConfigStore | undefined;
let _resultStore: BlobResultStore | undefined;
let _runtimeStateStore: BlobRuntimeStateStore | undefined;

function storageUri(): string {
  return requireEnv('AARM_STORAGE_URI');
}

export function getJobConfigStore(): BlobJobConfigStore {
  _jobConfigStore ??= new BlobJobConfigStore(storageUri(), getCredential());
  return _jobConfigStore;
}

export function getResultStore(): BlobResultStore {
  _resultStore ??= new BlobResultStore(storageUri(), getCredential());
  return _resultStore;
}

export function getRuntimeStateStore(): BlobRuntimeStateStore {
  _runtimeStateStore ??= new BlobRuntimeStateStore(storageUri(), getCredential());
  return _runtimeStateStore;
}

/**
 * Creates the required Blob Storage containers if they do not yet exist.
 * Must be called once at function startup before any store operations.
 * Safe to call multiple times — createIfNotExists is idempotent.
 */
export async function initializeStorage(): Promise<void> {
  const client = new BlobServiceClient(storageUri(), getCredential());
  await Promise.all(
    REQUIRED_CONTAINERS.map(async (name) => {
      const container = client.getContainerClient(name);
      const result = await container.createIfNotExists();
      if (result.succeeded) {
        console.log(`[storage] Container '${name}' created.`);
      }
    }),
  );
}
