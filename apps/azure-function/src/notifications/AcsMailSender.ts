// require is provided globally by the esbuild createRequire banner in esbuild.mjs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: (module: string) => any;

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
  if (!connStr || !sender) throw new Error('ACS not configured');

  lazyLoad();
  const client = new EmailClientClass(connStr);

  const addresses = to
    .flatMap(a => a.split(/[;,]/))
    .map(a => a.trim())
    .filter(Boolean);

  const poller = await client.beginSend({
    senderAddress: sender,
    recipients:    { to: addresses.map(address => ({ address })) },
    content:       { subject, html },
  });

  await poller.pollUntilDone();
}
