import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

interface EmailClient {
  beginSend(message: EmailMessage): Promise<Poller>;
}
interface EmailMessage {
  senderAddress: string;
  recipients: { to: { address: string }[] };
  content: { subject: string; html: string };
}
interface Poller {
  pollUntilDone(): Promise<{ status: string }>;
}

let EmailClientClass: new (connectionString: string) => EmailClient;

function lazyLoad(): void {
  if (!EmailClientClass) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    EmailClientClass = require('@azure/communication-email').EmailClient;
  }
}

export function isAcsConfigured(): boolean {
  return !!(process.env['AARM_ACS_CONNECTION_STRING'] && process.env['AARM_ACS_SENDER_EMAIL']);
}

export async function sendMail(
  to: string[],
  subject: string,
  html: string,
): Promise<void> {
  const connStr = process.env['AARM_ACS_CONNECTION_STRING'];
  const sender  = process.env['AARM_ACS_SENDER_EMAIL'];
  if (!connStr || !sender) throw new Error('ACS not configured (AARM_ACS_CONNECTION_STRING or AARM_ACS_SENDER_EMAIL missing)');

  lazyLoad();
  const client = new EmailClientClass(connStr);

  const poller = await client.beginSend({
    senderAddress: sender,
    recipients:    { to: to.map(address => ({ address })) },
    content:       { subject, html },
  });

  await poller.pollUntilDone();
}
