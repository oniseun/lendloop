#!/usr/bin/env node
// Smoke test for the Docker stack (`docker compose up -d --build`).
// Checks every service answers, sends one signed request event through
// the n8n webhook, runs the overdue workflow once, and confirms both
// emails reach Mailpit. Used by CI; also handy locally:
//   node scripts/docker-smoke.mjs           (full)
//   node scripts/docker-smoke.mjs --quick   (skip the overdue run)
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';

const quick = process.argv.includes('--quick');
const APP = 'http://localhost:3000';
const CONVEX = 'http://localhost:3210';
const N8N = 'http://localhost:5678';
const MAILPIT = 'http://localhost:8025';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const step = (message) => console.info(`\n> ${message}`);
const fail = (message) => {
  throw new Error(message);
};

async function expectOk(url, { contains } = {}) {
  const res = await fetch(url);
  const body = await res.text();
  if (res.status !== 200) fail(`${url} returned ${res.status}`);
  if (contains && !body.includes(contains))
    fail(`${url} did not include "${contains}"`);
  console.info(`  ${url} -> 200`);
}

async function waitForEmail(query, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}`,
    );
    const { messages = [] } = await res.json();
    if (messages.length) return messages[0];
    await sleep(2000);
  }
  return fail(`No email in Mailpit matching ${query}`);
}

const compose = (...args) =>
  execFileSync('docker', ['compose', ...args], { encoding: 'utf8' });

step('Health');
await expectOk(APP, { contains: 'LendLoop' });
await expectOk(`${APP}/tools`);
await expectOk(`${CONVEX}/version`);
await expectOk(`${N8N}/healthz`);
await expectOk(`${MAILPIT}/readyz`);

step('n8n owner account (created on first boot)');
const login = await fetch(`${N8N}/rest/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    emailOrLdapLoginId: process.env.N8N_OWNER_EMAIL ?? 'admin@lendloop.local',
    password: process.env.N8N_OWNER_PASSWORD ?? 'LendLoop-local-1',
  }),
});
if (login.status !== 200) fail(`n8n owner login returned ${login.status}`);
console.info('  n8n login -> 200');

step('Signed request event -> n8n webhook -> Mailpit');
const secret = compose('exec', '-T', 'n8n', 'cat', '/shared/n8n.env')
  .split('\n')
  .find((line) => line.startsWith('LENDLOOP_CONVEX_TO_N8N_SECRET='))
  ?.split('=')[1];
if (!secret) fail('LENDLOOP_CONVEX_TO_N8N_SECRET missing from /shared/n8n.env');

const recipient = `smoke-${Date.now()}@example.com`;
const today = new Date().toISOString().slice(0, 10);
const body = JSON.stringify({
  eventId: `smoke:${randomUUID()}`,
  type: 'loan.requested',
  occurredAt: new Date().toISOString(),
  loanId: 'smoke-loan',
  recipient: { firstName: 'Smoke', email: recipient },
  tool: { name: 'Smoke tester' },
  dates: { start: today, end: today },
});
const webhook = `${N8N}/webhook/lendloop/request-events`;

const unsigned = await fetch(webhook, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
});
if (unsigned.status !== 401)
  fail(`Unsigned event returned ${unsigned.status}, expected 401`);
console.info('  unsigned event -> 401');

const timestamp = String(Math.floor(Date.now() / 1000));
const signature =
  'v1=' +
  createHmac('sha256', secret)
    .update(`${timestamp}.POST /request-events.${body}`)
    .digest('hex');
const signed = await fetch(webhook, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-lendloop-signature': signature,
    'x-lendloop-timestamp': timestamp,
  },
  body,
});
if (signed.status !== 200)
  fail(`Signed event returned ${signed.status}: ${await signed.text()}`);
console.info('  signed event -> 200');
const requestEmail = await waitForEmail(`to:${recipient}`);
console.info(`  Mailpit: "${requestEmail.Subject}" to ${recipient}`);

if (quick) {
  console.info('\nDocker stack smoke test passed (quick).');
  process.exit(0);
}

step('Overdue workflow (n8n -> Convex -> Mailpit)');
// Same command a reviewer can run by hand; the secrets come from the
// shared volume because `docker compose exec` skips the bootstrap script.
try {
  compose(
    'exec',
    '-T',
    'n8n',
    'sh',
    '-c',
    'set -a && . /shared/n8n.env && set +a && ' +
      'N8N_PORT=5679 N8N_RUNNERS_BROKER_PORT=5680 n8n execute --id lendloopOverdueW',
  );
} catch (error) {
  fail(`n8n execute failed:\n${String(error.stdout).slice(-2000)}`);
}
const reminder = await waitForEmail(
  'subject:"Reminder: please return the Cordless drill (18V)"',
);
console.info(`  Mailpit: "${reminder.Subject}"`);

console.info('\nDocker stack smoke test passed.');
