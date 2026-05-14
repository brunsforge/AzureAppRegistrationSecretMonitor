/** Built-in Adaptive Card templates. All placeholders use Handlebars {{syntax}}. */

export const DEFAULT_CRITICAL_TEMPLATE = JSON.stringify({
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '🚨 CRITICAL: Expiring Secrets',
          weight: 'bolder',
          size: 'large',
          color: 'attention',
        },
        {
          type: 'TextBlock',
          text: '{{tenantDisplayName}}',
          spacing: 'none',
          isSubtle: true,
        },
        {
          type: 'FactSet',
          spacing: 'medium',
          facts: [
            { title: 'Critical (expire very soon)', value: '{{criticalCount}}' },
            { title: 'Expiring (within threshold)', value: '{{expiringCount}}' },
            { title: 'Total secrets', value: '{{secretCount}}' },
            { title: 'Scanned at (UTC)', value: '{{scanTimestamp}}' },
          ],
        },
        {
          type: 'TextBlock',
          text: 'Immediate action required. Rotate critical secrets before they expire.',
          wrap: true,
          spacing: 'medium',
          color: 'attention',
        },
      ],
      actions: [{ type: 'Action.OpenUrl', title: 'Open Dashboard', url: '{{dashboardUrl}}' }],
    },
  }],
});

export const DEFAULT_EXPIRING_TEMPLATE = JSON.stringify({
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '⚠️ Secrets Expiring Soon',
          weight: 'bolder',
          size: 'large',
          color: 'warning',
        },
        {
          type: 'TextBlock',
          text: '{{tenantDisplayName}}',
          spacing: 'none',
          isSubtle: true,
        },
        {
          type: 'FactSet',
          spacing: 'medium',
          facts: [
            { title: 'Expiring within threshold', value: '{{expiringCount}}' },
            { title: 'Total secrets', value: '{{secretCount}}' },
            { title: 'Scanned at (UTC)', value: '{{scanTimestamp}}' },
          ],
        },
      ],
      actions: [{ type: 'Action.OpenUrl', title: 'Open Dashboard', url: '{{dashboardUrl}}' }],
    },
  }],
});

export const DEFAULT_SUMMARY_TEMPLATE = JSON.stringify({
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '✅ Scan Completed',
          weight: 'bolder',
          size: 'medium',
          color: 'good',
        },
        {
          type: 'TextBlock',
          text: '{{tenantDisplayName}}',
          spacing: 'none',
          isSubtle: true,
        },
        {
          type: 'FactSet',
          spacing: 'medium',
          facts: [
            { title: 'Total secrets', value: '{{secretCount}}' },
            { title: 'Expiring', value: '{{expiringCount}}' },
            { title: 'Critical', value: '{{criticalCount}}' },
            { title: 'Scanned at (UTC)', value: '{{scanTimestamp}}' },
          ],
        },
      ],
      actions: [{ type: 'Action.OpenUrl', title: 'Open Dashboard', url: '{{dashboardUrl}}' }],
    },
  }],
});

export const DEFAULT_ERROR_TEMPLATE = JSON.stringify({
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '❌ Scan Failed',
          weight: 'bolder',
          size: 'large',
          color: 'attention',
        },
        {
          type: 'TextBlock',
          text: '{{tenantDisplayName}}',
          spacing: 'none',
          isSubtle: true,
        },
        {
          type: 'TextBlock',
          text: '{{errorMessage}}',
          wrap: true,
          spacing: 'medium',
        },
        {
          type: 'TextBlock',
          text: 'Failed at (UTC): {{timestamp}}',
          isSubtle: true,
          spacing: 'none',
        },
      ],
      actions: [{ type: 'Action.OpenUrl', title: 'Open Dashboard', url: '{{dashboardUrl}}' }],
    },
  }],
});
