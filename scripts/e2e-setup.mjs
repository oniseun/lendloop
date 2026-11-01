#!/usr/bin/env node
// Prepares Clerk and the local Convex deployment for the Playwright
// suite, without a Clerk account:
//
//  1. Clerk keys: uses NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY
//     from the environment or .env.local. If there are none, creates a
//     Clerk keyless (accountless) development app, the same thing
//     @clerk/nextjs does on first `next dev`, and writes the keys to
//     .env.local. The claim URL is printed so the app can be adopted
//     into a Clerk account later.
//  2. Creates the "convex" JWT template Convex verifies (once).
//  3. Creates the e2e users (lender, borrower, admin).
//  4. Points the local Convex deployment at this Clerk instance and turns
//     on the test fixtures (E2E_FIXTURES=true, local deployments only).
//
// Usage: node scripts/e2e-setup.mjs   (idempotent; safe to re-run)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import {
  clerkClient,
  createKeylessApp,
  ensureConvexJwtTemplate,
  issuerFromPublishableKey,
} from './lib/clerk.mjs';

const ENV_FILE = '.env.local';

const readEnvFile = () => {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    readFileSync(ENV_FILE, 'utf8')
      .split('\n')
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf('=')),
        line.slice(line.indexOf('=') + 1),
      ]),
  );
};

const saveEnv = (values) => {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  appendFileSync(
    ENV_FILE,
    `\n# Added by scripts/e2e-setup.mjs\n${lines.join('\n')}\n`,
  );
};

const fileEnv = readEnvFile();
const env = (name) => process.env[name] || fileEnv[name];

// 1. Keys
let publishableKey = env('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
let secretKey = env('CLERK_SECRET_KEY');
if (!publishableKey || !secretKey) {
  const app = await createKeylessApp();
  publishableKey = app.publishableKey;
  secretKey = app.secretKey;
  saveEnv({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
    CLERK_SECRET_KEY: secretKey,
  });
  console.info('Created a Clerk keyless dev app. Claim it later at:');
  console.info(`  ${app.claimUrl}`);
}
const issuer = issuerFromPublishableKey(publishableKey);
const clerk = clerkClient(secretKey);
console.info(`Clerk issuer: ${issuer}`);

// 2. JWT template used by ConvexProviderWithClerk
if (await ensureConvexJwtTemplate(clerk)) {
  console.info('Created the "convex" JWT template');
}

// 3. Users
const USERS = [
  ['lender', 'Lena', 'Lender'],
  ['borrower', 'Ben', 'Borrower'],
  ['admin', 'Ada', 'Admin'],
];
for (const [key, first, last] of USERS) {
  const email = `e2e-${key}+clerk_test@example.com`;
  const found = await clerk(
    `/users?email_address=${encodeURIComponent(email)}`,
  );
  // No password: the suite signs in with Clerk sign-in tickets.
  if (!found.length) {
    await clerk('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [email],
        first_name: first,
        last_name: last,
        skip_password_requirement: true,
      }),
    });
  }
  console.info(`User ready: ${email}`);
}

// 4. Convex (local deployment)
if (!process.argv.includes('--skip-convex')) {
  const convexEnv = {
    CLERK_JWT_ISSUER_DOMAIN: issuer,
    ADMIN_EMAILS: 'e2e-admin+clerk_test@example.com',
    E2E_FIXTURES: 'true',
  };
  for (const [name, value] of Object.entries(convexEnv)) {
    execFileSync('npx', ['convex', 'env', 'set', name, value], {
      stdio: 'inherit',
    });
  }
}
console.info('E2E setup done.');
