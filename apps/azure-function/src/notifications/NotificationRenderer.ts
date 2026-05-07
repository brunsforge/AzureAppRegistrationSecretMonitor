import Handlebars from 'handlebars';
import type { NotificationContext, ErrorNotificationContext } from './types.js';

export function renderTemplate(
  templateJson: string,
  context: NotificationContext | ErrorNotificationContext,
): unknown {
  const compiled = Handlebars.compile(templateJson);
  const rendered = compiled(context);
  return JSON.parse(rendered);
}
