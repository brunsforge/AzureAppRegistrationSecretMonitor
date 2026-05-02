import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { CapabilityEvaluator } from '../../src/preflight/CapabilityEvaluator.js';

function buildApiChain(getResult: () => Promise<unknown>) {
  return {
    select: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    get: vi.fn().mockImplementation(getResult),
  };
}

type ApiResponse = () => Promise<unknown>;

function mockClient(
  responses: Record<string, ApiResponse>,
  defaultFn?: ApiResponse,
): Client {
  const api = vi.fn().mockImplementation((path: string) => {
    const match = Object.entries(responses).find(([key]) => path.includes(key));
    const fn = match ? match[1] : (defaultFn ?? (() => Promise.resolve({ value: [] })));
    return buildApiChain(fn);
  });
  return { api } as unknown as Client;
}

const OK = () => Promise.resolve({ value: [{ id: 'obj-1' }] });
const FORBIDDEN = () => Promise.reject({ statusCode: 403, message: 'Forbidden' });
const SERVER_ERROR = () => Promise.reject({ statusCode: 500, message: 'Internal Server Error' });

describe('CapabilityEvaluator.evaluateAll', () => {
  it('marks all Graph capabilities true when all calls succeed', async () => {
    const client = mockClient(
      {
        '/applications': OK,
        '/servicePrincipals': OK,
        '/owners': OK,
        '/organization': OK,
      },
      OK,
    );
    const evaluator = new CapabilityEvaluator(client, 'client-secret');
    const { capabilities, missingPermissions } = await evaluator.evaluateAll();

    expect(capabilities.canReadApplications).toBe(true);
    expect(capabilities.canReadApplicationSecrets).toBe(true);
    expect(capabilities.canReadServicePrincipals).toBe(true);
    expect(capabilities.canReadOwners).toBe(true);
    expect(capabilities.canReadDirectory).toBe(true);
    expect(missingPermissions).toHaveLength(0);
  });

  it('marks canReadApplications false and records missing permission on 403', async () => {
    const client = mockClient({ '/applications': FORBIDDEN }, FORBIDDEN);
    const evaluator = new CapabilityEvaluator(client, 'client-secret');
    const { capabilities, missingPermissions } = await evaluator.evaluateAll();

    expect(capabilities.canReadApplications).toBe(false);
    expect(missingPermissions.some((p) => p.includes('Application.Read.All'))).toBe(true);
  });

  it('marks canReadServicePrincipals false on 403', async () => {
    const client = mockClient(
      {
        '/applications': OK,
        '/servicePrincipals': FORBIDDEN,
        '/organization': OK,
      },
      OK,
    );
    const evaluator = new CapabilityEvaluator(client, 'client-secret');
    const { capabilities } = await evaluator.evaluateAll();

    expect(capabilities.canReadApplications).toBe(true);
    expect(capabilities.canReadServicePrincipals).toBe(false);
  });

  it('warns instead of throwing on unexpected server errors', async () => {
    const client = mockClient({ '/servicePrincipals': SERVER_ERROR }, OK);
    const evaluator = new CapabilityEvaluator(client, 'client-secret');
    const { capabilities, warnings } = await evaluator.evaluateAll();

    expect(capabilities.canReadServicePrincipals).toBe(false);
    expect(warnings.some((w) => w.includes('unexpected error'))).toBe(true);
  });

  it('always reports write capabilities as false', async () => {
    const client = mockClient({}, OK);
    const evaluator = new CapabilityEvaluator(client, 'client-secret');
    const { capabilities } = await evaluator.evaluateAll();

    expect(capabilities.canCreateApplicationSecrets).toBe(false);
    expect(capabilities.canDeleteApplicationSecrets).toBe(false);
    expect(capabilities.canCreateApplications).toBe(false);
  });

  it('warns about canReadOwners when no applications exist', async () => {
    const client = mockClient(
      { '/applications': () => Promise.resolve({ value: [] }) },
      OK,
    );
    const evaluator = new CapabilityEvaluator(client, 'client-secret');
    const { capabilities, warnings } = await evaluator.evaluateAll();

    expect(capabilities.canReadOwners).toBe(false);
    expect(warnings.some((w) => w.includes('canReadOwners'))).toBe(true);
  });
});
