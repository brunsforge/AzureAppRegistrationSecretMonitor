import type { BlobJobConfigStore } from '../storage/BlobJobConfigStore.js';
import {
  DEFAULT_CRITICAL_TEMPLATE,
  DEFAULT_ERROR_TEMPLATE,
  DEFAULT_EXPIRING_TEMPLATE,
  DEFAULT_SUMMARY_TEMPLATE,
} from './defaultTemplates.js';
import {
  DEFAULT_MAIL_CRITICAL,
  DEFAULT_MAIL_ERROR,
  DEFAULT_MAIL_EXPIRING,
  DEFAULT_MAIL_SUMMARY,
} from './defaultMailTemplates.js';

export type TemplateKey = 'critical' | 'expiring' | 'summary' | 'error';
export type MailTemplateKey = 'emailCritical' | 'emailExpiring' | 'emailSummary' | 'emailError';

const BUILT_IN_TEAMS: Record<TemplateKey, string> = {
  critical: DEFAULT_CRITICAL_TEMPLATE,
  expiring: DEFAULT_EXPIRING_TEMPLATE,
  summary:  DEFAULT_SUMMARY_TEMPLATE,
  error:    DEFAULT_ERROR_TEMPLATE,
};

const BUILT_IN_MAIL: Record<MailTemplateKey, string> = {
  emailCritical: DEFAULT_MAIL_CRITICAL,
  emailExpiring: DEFAULT_MAIL_EXPIRING,
  emailSummary:  DEFAULT_MAIL_SUMMARY,
  emailError:    DEFAULT_MAIL_ERROR,
};

export class TemplateLoader {
  constructor(private readonly store: BlobJobConfigStore) {}

  async load(key: TemplateKey, customBlobName?: string | null): Promise<string> {
    if (customBlobName) {
      const custom = await this.store.readTemplate(customBlobName);
      if (custom) return custom;
    }
    return BUILT_IN_TEAMS[key];
  }

  async loadMail(key: MailTemplateKey, customBlobName?: string | null): Promise<string> {
    if (customBlobName) {
      const custom = await this.store.readTemplate(customBlobName);
      if (custom) return custom;
    }
    return BUILT_IN_MAIL[key];
  }
}
