import { signedHeaders } from '../../convex/lib/signature';

// Calls the Convex HTTP API exactly as the n8n overdue workflow does,
// signed with N8N_TO_CONVEX_SECRET. Lets the suite exercise reminder
// claims and write-backs without n8n running.

const siteUrl = () =>
  process.env.E2E_CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  'http://127.0.0.1:3211';

export const hasN8nSecret = () => Boolean(process.env.E2E_N8N_TO_CONVEX_SECRET);

const call = async (method: 'GET' | 'POST', path: string, body?: object) => {
  const raw = body ? JSON.stringify(body) : '';
  const headers = await signedHeaders(
    process.env.E2E_N8N_TO_CONVEX_SECRET!,
    `${method} ${path}`,
    raw,
  );
  const response = await fetch(`${siteUrl()}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? raw : undefined,
  });
  return { status: response.status, json: await response.json() };
};

export const fetchOverdue = () => call('GET', '/api/loans/overdue');

export const claimReminder = (loanId: string, reminderDate: string) =>
  call('POST', '/api/automation/reminders/claim', { loanId, reminderDate });

export const recordReminder = (
  loanId: string,
  reminderDate: string,
  status: 'sent' | 'failed',
) =>
  call('POST', '/api/automation/reminders', {
    loanId,
    reminderDate,
    status,
    channel: 'email',
  });
