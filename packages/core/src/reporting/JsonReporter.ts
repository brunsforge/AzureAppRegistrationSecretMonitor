export interface ResultEnvelope<T> {
  success: boolean;
  metadata: {
    tenantId: string;
    generatedAt: string;
    toolVersion: string;
  };
  data: T;
  warnings: string[];
  errors: string[];
}

const TOOL_VERSION = '0.1.0';

export function createResultEnvelope<T>(
  data: T,
  tenantId: string,
  options: { warnings?: string[]; errors?: string[] } = {},
): ResultEnvelope<T> {
  const errors = options.errors ?? [];
  return {
    success: errors.length === 0,
    metadata: {
      tenantId,
      generatedAt: new Date().toISOString(),
      toolVersion: TOOL_VERSION,
    },
    data,
    warnings: options.warnings ?? [],
    errors,
  };
}

export function envelopeToJson<T>(envelope: ResultEnvelope<T>): string {
  return JSON.stringify(envelope, null, 2);
}
