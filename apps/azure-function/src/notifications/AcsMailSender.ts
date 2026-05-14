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

let EmailClientClass: new (endpoint: string, credential: unknown) => EmailClient;
let DefaultAzureCredentialClass: new () => unknown;

function lazyLoad(): void {
  if (!EmailClientClass) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    EmailClientClass = require('@azure/communication-email').EmailClient;
  }
  if (!DefaultAzureCredentialClass) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    DefaultAzureCredentialClass = require('@azure/identity').DefaultAzureCredential;
  }
}

export function isAcsConfigured(): boolean {
  return !!(process.env['AARM_ACS_ENDPOINT'] && process.env['AARM_ACS_SENDER_EMAIL']);
}

export async function sendMail(
  to: string[],
  subject: string,
  html: string,
): Promise<void> {
  const endpoint = process.env['AARM_ACS_ENDPOINT'];
  const sender   = process.env['AARM_ACS_SENDER_EMAIL'];
  if (!endpoint || !sender) throw new Error('AARM_ACS_ENDPOINT or AARM_ACS_SENDER_EMAIL not configured');

  lazyLoad();
  const client = new EmailClientClass(endpoint, new DefaultAzureCredentialClass());

  const poller = await client.beginSend({
    senderAddress: sender,
    recipients:    { to: to.map(address => ({ address })) },
    content:       { subject, html },
  });

  await poller.pollUntilDone();
}
