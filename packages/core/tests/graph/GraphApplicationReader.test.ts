import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { GraphApplicationReader } from '../../src/graph/GraphApplicationReader.js';
import { GraphError } from '../../src/errors/index.js';

// Mock PageIterator to run the callback synchronously over the first response page.
vi.mock('@microsoft/microsoft-graph-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@microsoft/microsoft-graph-client')>();
  return {
    ...actual,
    PageIterator: class {
      constructor(
        _client: unknown,
        private readonly response: { value: unknown[] },
        private readonly callback: (item: unknown) => boolean,
      ) {}
      async iterate() {
        for (const item of this.response.value) {
          if (!this.callback(item)) break;
        }
      }
    },
  };
});

function buildApiChain(getResult: () => Promise<unknown>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    get: vi.fn().mockImplementation(getResult),
  };
  return chain;
}

function mockClient(getResult: () => Promise<unknown>): Client {
  return {
    api: vi.fn().mockReturnValue(buildApiChain(getResult)),
  } as unknown as Client;
}

const APP_FIXTURE = {
  id: 'obj-1',
  appId: 'client-1',
  displayName: 'Test App',
  createdDateTime: '2025-01-15T00:00:00Z',
  passwordCredentials: [
    {
      keyId: 'key-1',
      displayName: 'prod-secret',
      hint: 'abc',
      startDateTime: '2025-01-15T00:00:00Z',
      endDateTime: '2027-01-15T00:00:00Z',
    },
  ],
};

describe('GraphApplicationReader.listApplications', () => {
  it('returns applications from the Graph response', async () => {
    const client = mockClient(() =>
      Promise.resolve({ value: [APP_FIXTURE] }),
    );
    const reader = new GraphApplicationReader(client);
    const result = await reader.listApplications();

    expect(result).toHaveLength(1);
    expect(result[0].appId).toBe('client-1');
    expect(result[0].passwordCredentials).toHaveLength(1);
  });

  it('returns an empty array when no applications exist', async () => {
    const client = mockClient(() => Promise.resolve({ value: [] }));
    const reader = new GraphApplicationReader(client);
    const result = await reader.listApplications();
    expect(result).toHaveLength(0);
  });

  it('throws GraphError when the API call fails', async () => {
    const client = mockClient(() =>
      Promise.reject({ statusCode: 403, message: 'Forbidden' }),
    );
    const reader = new GraphApplicationReader(client);
    await expect(reader.listApplications()).rejects.toThrow(GraphError);
  });
});

describe('GraphApplicationReader.getApplicationOwners', () => {
  it('returns owners when the call succeeds', async () => {
    const owners = [
      { id: 'user-1', displayName: 'Alice', userPrincipalName: 'alice@example.com' },
    ];
    const client = mockClient(() => Promise.resolve({ value: owners }));
    const reader = new GraphApplicationReader(client);
    const result = await reader.getApplicationOwners('obj-1');
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Alice');
  });

  it('returns an empty array on 403 without throwing', async () => {
    const client = mockClient(() =>
      Promise.reject({ statusCode: 403, message: 'Forbidden' }),
    );
    const reader = new GraphApplicationReader(client);
    const result = await reader.getApplicationOwners('obj-1');
    expect(result).toEqual([]);
  });

  it('throws GraphError on non-auth failures', async () => {
    const client = mockClient(() =>
      Promise.reject({ statusCode: 500, message: 'Server error' }),
    );
    const reader = new GraphApplicationReader(client);
    await expect(reader.getApplicationOwners('obj-1')).rejects.toThrow(GraphError);
  });
});
