export async function postToTeams(webhookUrl: string, payload: unknown): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Teams webhook returned ${response.status}: ${await response.text()}`);
  }
}
