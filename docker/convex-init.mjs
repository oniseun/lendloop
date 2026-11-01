#!/usr/bin/env node
// One-shot init container for `docker compose up`:
//
//  1. reads the Convex admin key written by the convex-admin-key service
//  2. picks Clerk keys: from .env, from a previous run, or a new Clerk
//     keyless dev app (no account needed); ensures the "convex" JWT
//     template exists
//  3. generates the Convex <-> n8n HMAC secrets once
//  4. sets the Convex deployment env, deploys the functions, seeds data
//  5. writes /shared/app.env (Next.js) and /shared/n8n.env (n8n)
//
// Everything it creates lives in the `shared` volume, so re-running
// `docker compose up` reuses the same keys and secrets.

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  clerkClient,
  createKeylessApp,
  ensureConvexJwtTemplate,
  issuerFromPublishableKey,
} from '../scripts/lib/clerk.mjs';

const SHARED = '/shared';
const STATE_FILE = `${SHARED}/state.json`;
const log = (message) => console.info(`[convex-init] ${message}`);

const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  : {};

// 1. Convex admin key
const adminKey = readFileSync(`${SHARED}/admin_key`, 'utf8').trim();
if (!adminKey) throw new Error('No Convex admin key in /shared/admin_key');
const convexEnv = {
  ...process.env,
  CONVEX_SELF_HOSTED_URL: process.env.CONVEX_SELF_HOSTED_URL,
  CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey,
};
delete convexEnv.CONVEX_DEPLOYMENT;
const convex = (...args) =>
  execFileSync('npx', ['convex', ...args], {
    env: convexEnv,
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
  });

// 2. Clerk
let clerkKeys;
if (
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY
) {
  clerkKeys = {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  };
  log('Using the Clerk keys from .env');
} else if (state.clerk) {
  clerkKeys = state.clerk;
  log('Reusing the Clerk keyless app from a previous run');
} else {
  clerkKeys = await createKeylessApp();
  log('No Clerk keys in .env: created a Clerk keyless dev app.');
  log(`Claim it into your Clerk account any time: ${clerkKeys.claimUrl}`);
}
if (!process.env.CLERK_SECRET_KEY) state.clerk = clerkKeys;
if (await ensureConvexJwtTemplate(clerkClient(clerkKeys.secretKey))) {
  log('Created the "convex" JWT template in Clerk');
}

// 3. Secrets for the signed webhooks, generated once
state.convexToN8nSecret ??= randomBytes(32).toString('hex');
state.n8nToConvexSecret ??= randomBytes(32).toString('hex');
writeFileSync(STATE_FILE, JSON.stringify(state), { mode: 0o600 });

// 4. Convex
const deploymentEnv = {
  CLERK_JWT_ISSUER_DOMAIN: issuerFromPublishableKey(clerkKeys.publishableKey),
  N8N_REQUEST_WEBHOOK_URL: process.env.N8N_REQUEST_WEBHOOK_URL,
  CONVEX_TO_N8N_SECRET: state.convexToN8nSecret,
  N8N_TO_CONVEX_SECRET: state.n8nToConvexSecret,
  ...(process.env.ADMIN_EMAILS
    ? { ADMIN_EMAILS: process.env.ADMIN_EMAILS }
    : {}),
};
for (const [name, value] of Object.entries(deploymentEnv)) {
  convex('env', 'set', name, value);
}
log('Convex deployment env set');

convex('deploy', '--yes');
log('Convex functions deployed');

log(`Seed: ${convex('run', 'seed:run').trim().replace(/\s+/g, ' ')}`);

// 5. Hand-off files for the app and n8n
const lines = (values) =>
  `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
writeFileSync(
  `${SHARED}/app.env`,
  lines({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKeys.publishableKey,
    CLERK_SECRET_KEY: clerkKeys.secretKey,
  }),
  { mode: 0o600 },
);
writeFileSync(
  `${SHARED}/n8n.env`,
  lines({
    LENDLOOP_CONVEX_TO_N8N_SECRET: state.convexToN8nSecret,
    LENDLOOP_N8N_TO_CONVEX_SECRET: state.n8nToConvexSecret,
  }),
  { mode: 0o644 },
);
log('Done');
