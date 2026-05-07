import type { BlobJobConfigStore } from '../storage/BlobJobConfigStore.js';
import {
  DEFAULT_CRITICAL_TEMPLATE,
  DEFAULT_ERROR_TEMPLATE,
  DEFAULT_EXPIRING_TEMPLATE,
  DEFAULT_SUMMARY_TEMPLATE,
} from './defaultTemplates.js';

export type TemplateKey = 'critical' | 'expiring' | 'summary' | 'error';

const BUILT_IN: Record<TemplateKey, string> = {
  critical: DEFAULT_CRITICAL_TEMPLATE,
  expiring: DEFAULT_EXPIRING_TEMPLATE,
  summary: DEFAULT_SUMMARY_TEMPLATE,
  error: DEFAULT_ERROR_TEMPLATE,
};

export class TemplateLoader {
  constructor(private readonly store: BlobJobConfigStore) {}

  async load(key: TemplateKey, customBlobName?: string | null): Promise<string> {
    if (customBlobName) {
      const custom = await this.store.readTemplate(customBlobName);
      if (custom) return custom;
    }
    return BUILT_IN[key];
  }
}
