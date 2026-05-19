import Handlebars from 'handlebars';
import type { NotificationContext, ErrorNotificationContext } from './types.js';

/** Renders a JSON-based template (Adaptive Card for Teams) and parses the result. */
export function renderTemplate(
  templateJson: string,
  context: NotificationContext | ErrorNotificationContext,
): unknown {
  const compiled = Handlebars.compile(templateJson);
  const rendered = compiled(context);
  return JSON.parse(rendered);
}

/** Renders an HTML email template — returns the rendered string without JSON.parse. */
export function renderHtmlTemplate(
  templateHtml: string,
  context: NotificationContext | ErrorNotificationContext,
): string {
  return Handlebars.compile(templateHtml)(context);
}
