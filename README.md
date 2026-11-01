# LendLoop

Borrow what you need. Lend what you don't.

A tool-lending board for a neighbourhood. Neighbours list tools, request to borrow them for a date range, and the owner approves, declines and marks them returned. n8n handles the notifications and the daily overdue reminders.

Built for the Fluence take-home. Next.js (App Router) + Clerk + Convex + n8n, all TypeScript.

## 🛠 Tech Stack

- **Web:** Next.js 16 (App Router), React 19, MUI 9
- **Auth:** Clerk (JWT verified by Convex)
- **Data + backend:** Convex (queries, mutations, HTTP actions, scheduler)
- **Automation:** n8n 2.x (self-hosted via Docker), Mailpit as the local SMTP sink
- **Tests:** Vitest + `convex-test` (runs the real Convex functions in memory)
- **Tooling:** ESLint, Prettier, Husky + commitlint (conventional commits), GitHub Actions

## 🚀 Getting Started

### Prerequisites

- Node 22 (`.nvmrc`)
- Docker (for n8n + Mailpit)
- A free Clerk development instance

### 1. Install

```bash
npm run setup   # copies .env.example to .env.local and installs
```

### 2. Clerk

1. Create an application in Clerk.
2. In the Clerk dashboard, open **Integrations → Convex** and activate it. That creates the `convex` JWT template Convex expects. Copy the **Frontend API URL** shown there.
3. Put the publishable and secret keys in `.env.local`.

### 3. Convex

```bash
npx convex dev
```

Pick a local deployment (no account needed) or log in for a cloud dev deployment. It writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local` and keeps running. In another terminal:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
npx convex env set ADMIN_EMAILS you@example.com
npx convex env set N8N_REQUEST_WEBHOOK_URL http://localhost:5678/webhook/lendloop/request-events
npx convex env set CONVEX_TO_N8N_SECRET "$(openssl rand -hex 32)"
npx convex env set N8N_TO_CONVEX_SECRET "$(openssl rand -hex 32)"
npm run seed
```

`npm run seed` adds three demo neighbours, seven tools and a few loans, one of them overdue, so the reminder workflow has something to do. The demo neighbours can't sign in; you sign in as yourself and lend or borrow against them.

> A Convex **cloud** deployment can't call `localhost:5678`. Either use the local Convex deployment (simplest), or expose n8n (n8n Cloud or a tunnel) and use that URL for `N8N_REQUEST_WEBHOOK_URL`.

### 4. n8n

```bash
cp n8n/.env.example n8n/.env
# fill in N8N_ENCRYPTION_KEY and the two LENDLOOP_*_SECRET values
# (same values as CONVEX_TO_N8N_SECRET / N8N_TO_CONVEX_SECRET above:
#  npx convex env get CONVEX_TO_N8N_SECRET)
docker compose up -d
```

On boot the container imports the SMTP credential (built from env into n8n's encrypted store), imports the three workflows from `n8n/workflows` and publishes them. Open http://localhost:5678 and create the owner account. Emails land in Mailpit at http://localhost:8025.

### 5. Run the app

```bash
npm run dev
```

Open http://localhost:3000 and sign in. If your email is in `ADMIN_EMAILS` (and verified in Clerk) you get the admin role on first sign-in. Otherwise:

```bash
npx convex run users:setRole '{"email":"you@example.com","role":"admin"}'
```

### Try the automations

- **Request notification:** borrow one of the demo tools. The owner's email shows up in Mailpit within a second or two, and the loan shows "Notification sent less than a minute ago".
- **Overdue reminders:** open _LendLoop – Overdue reminders_ in n8n and run it with the manual trigger (it also runs daily at 09:00). The seeded overdue drill gets a reminder in Mailpit and the loan shows "Reminder sent". Run it again and nothing is sent twice.

## 🔑 Environment Variables

| Where        | Variable                                                         | Purpose                                                                                |
| ------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `.env.local` | `NEXT_PUBLIC_CONVEX_URL`                                         | Convex client URL (written by `convex dev`)                                            |
| `.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`          | Clerk                                                                                  |
| Convex env   | `CLERK_JWT_ISSUER_DOMAIN`                                        | Clerk issuer Convex trusts                                                             |
| Convex env   | `ADMIN_EMAILS`                                                   | Comma-separated, first-admin bootstrap                                                 |
| Convex env   | `N8N_REQUEST_WEBHOOK_URL`                                        | n8n webhook for request events                                                         |
| Convex env   | `CONVEX_TO_N8N_SECRET`                                           | HMAC key, Convex → n8n                                                                 |
| Convex env   | `N8N_TO_CONVEX_SECRET`                                           | HMAC key, n8n → Convex                                                                 |
| `n8n/.env`   | `LENDLOOP_CONVEX_TO_N8N_SECRET`, `LENDLOOP_N8N_TO_CONVEX_SECRET` | Same two keys, n8n side                                                                |
| `n8n/.env`   | `LENDLOOP_CONVEX_SITE_URL`                                       | Convex HTTP actions base URL (`*.convex.site`, or `host.docker.internal:3211` locally) |
| `n8n/.env`   | `LENDLOOP_NOTIFY_CHANNEL`                                        | `email` (SMTP credential) or `mock` (masked log line)                                  |
| `n8n/.env`   | `SMTP_*`, `LENDLOOP_EMAIL_FROM`, `LENDLOOP_ALERT_EMAIL`          | Email + failure alerts                                                                 |
| `n8n/.env`   | `N8N_ENCRYPTION_KEY`                                             | Encrypts n8n's credential store                                                        |

No server secret lives in Next.js. Next only has public config plus the Clerk secret key its middleware needs.

## 🧱 Architecture

```
 Browser ── Next.js (App Router, Clerk UI) ──► Convex queries / mutations
                                                  │  RBAC in every function
                                                  │  outbox row + scheduler
                                                  ▼
                                   signed POST ─► n8n "Request notification" ─► email

 n8n "Overdue reminders" (daily) ── signed GET  ─► Convex /api/loans/overdue
                                 ── signed POST ─► Convex /api/automation/reminders/claim
                                 ── email each claimed borrower
                                 ── signed POST ─► Convex /api/automation/reminders (idempotent)

 any n8n failure ─► n8n "Error handler" ─► log + alert email
```

```
convex/
  schema.ts            tables + indexes
  users.ts tools.ts loans.ts admin.ts   public API (the "controllers")
  automation.ts        internal: outbox delivery, overdue query, reminder write-back
  http.ts              signed HTTP endpoints for n8n
  model/               domain logic shared by the functions (the "services")
  lib/                 pure helpers: permissions, signature, dates, validators, errors, logger
  seed.ts crons.ts
src/
  app/                 routes only, each renders a view
  modules/<feature>/   components, views, dto (same layout as my other frontends)
n8n/
  workflows/           exported workflow JSON (no secrets)
  docker/bootstrap.sh  credential + workflow import on boot
tests/
  unit/                permissions, signing, dates, payloads, n8n Code nodes
  convex/              real Convex functions via convex-test
```

Same split I use elsewhere: thin entry points, logic in services, pure policy in one place. In Convex terms the exported functions validate args and resolve the user, `model/` does the work, `lib/permissions.ts` decides who can do what.

### Roles and rules

- **user:** create, edit, delete their own listings; request to borrow other people's tools; cancel their own pending requests; approve, decline and mark returned on requests for their own tools.
- **admin:** everything a user can, plus remove any listing, view all loans, mark a lender as Trusted Lender, and see and retry failed automations.

Admins see every loan but can't approve or return someone else's. Moderation is a different job from lending, and it keeps the blast radius of an admin account small.

## 🔐 Security and Data Minimisation

**Authorisation lives in Convex, not the UI.** Every non-public function is built with `userQuery`/`userMutation` or `adminQuery`/`adminMutation` (`convex/lib/functions.ts`), which resolve the caller from the Clerk JWT. A client never passes its own user id or role. Each mutation then checks `lib/permissions.ts` (ownership, plus a loan status machine: `pending → approved | declined | cancelled`, `approved → returned`). Roles are stored in Convex, so changing one takes effect on the next request, and the only ways to grant admin are a verified email in `ADMIN_EMAILS` or an internal function run from the CLI. The Next.js proxy (middleware) only stops signed-out users reaching app pages.

**Only what each audience needs:**

- The public page gets tool name and category, nothing about owners.
- Signed-in users see the other party's first name and Trusted Lender badge. Emails never reach the browser (admins included).
- The free-text note on a request is shown to the lender only, and never sent to n8n.
- n8n payloads carry the recipient's first name and email, the tool name and the dates. No descriptions, no notes, nothing about the other party.
- Logs carry ids and outcomes only. n8n's mock channel masks emails, and failure alerts don't include item data.

**Signed webhooks, both directions:**

- HMAC-SHA256 over `timestamp.route.body`, header `x-lendloop-signature: v1=<hex>`, timestamp in `x-lendloop-timestamp`.
- The route (e.g. `POST /api/automation/reminders`) is part of the signed string, so a signature for one endpoint can't be replayed against another.
- A separate secret for each direction, so a leaked n8n-side key can't forge Convex events and vice versa.
- Constant-time comparison. Every failure returns the same 401.
- Replay protection: a 5-minute timestamp window. On top of that, Convex stores the signatures of accepted write-backs (pruned hourly) and treats an exact replay as a no-op, and n8n de-duplicates request events by `eventId`.
- Bodies are size-capped and validated field by field before they touch the database.

**Secrets:** Convex deployment env, n8n env, and n8n's encrypted credential store (SMTP). The exported workflow JSON references the credential by name and id only, and a test fails if a secret ever appears in it.

Also: server-side length limits and trimming on all text, date validation (no past dates, max 30 days, no double-booking), soft deletes so loan history stays intact, and basic security headers.

## 🔁 Reliability and Error Handling

- **Outbox.** A loan change and its webhook row are written in the same Convex transaction. If the mutation fails, nothing is sent. If n8n is down, the scheduler retries (3 attempts, 30s then 2m backoff), then marks the delivery `failed`. Failed deliveries show on the loan ("Notification failed") and in **Admin → Failed automations**, with a retry button.
- **Idempotency.** Event ids are `<loanId>:<transition>`. Each transition can only happen once, so a duplicate can't be queued. n8n marks an event processed only after the email has gone out (kept 30 days), so a retried delivery after a failed send still notifies.
- **Reminders: at most one per loan per day.** Before sending, n8n claims `(loanId, date)` through a signed `POST /api/automation/reminders/claim`. The claim is written atomically in Convex, so overlapping runs, or a run after a write-back that failed once the email had already gone, can't email twice. Only a reminder written back as `failed` can be claimed again. The write-back is keyed the same way: retries don't duplicate, and a `sent` is never downgraded. Claimed or sent loans are left out of the next fetch, and they're skipped before the page limit applies, so older loans can't starve newer ones.
- **n8n.** HTTP calls and email sends retry 3 times. A reminder email that still fails takes the error output and is written back as `failed` (visible on the loan) rather than stopping the run. Anything else that errors fires the _Error handler_ workflow (logs, plus an email to `LENDLOOP_ALERT_EMAIL`), and failed executions are always saved.

## 🧪 Testing

```bash
npm test          # vitest
npm run lint
npm run typecheck
npm run build
```

67 tests:

- **Permissions** (pure policy) and **RBAC through the real Convex functions**: anonymous writes, editing or deleting someone else's tool, approving or returning as borrower, stranger or admin, admin-only functions, admin removal, and what each list returns (no owner data publicly, no emails when signed in).
- **Loan rules**: double-booking, clashing requests declined on approval, duplicate requests, state transitions.
- **Signing**: a known HMAC vector, tampering, wrong secret, wrong route, stale and future timestamps, malformed headers.
- **Automation**: signed minimal payloads, retry then failure then admin retry, overdue endpoint auth and shape, single-winner reminder claims, idempotent write-backs, exact-replay handling, paging past handled loans.
- **n8n workflows**: the JavaScript inside the exported Code nodes is executed and checked against the Convex signer and verifier, so the two sides can't drift. A further test asserts the exports carry no secrets and route failures to the error workflow.

I also ran the whole loop locally against a local Convex backend, n8n 2.45.7 and Mailpit: request → signed webhook → email to the lender → delivery marked sent; overdue run → claim → reminder email → write-back recorded; a second run sends nothing; an unreachable Convex URL triggers the error workflow.

Not covered by automated tests: the Clerk sign-in UI itself (tests use simulated Convex identities) and browser-level E2E.

## ⚖️ Decisions and Trade-offs

- **Roles in Convex, not Clerk metadata.** One source of truth, enforced where the data is, revocable instantly. Cost: admin bootstrap is via `ADMIN_EMAILS` or the CLI.
- **User sync on sign-in (`users.store`) rather than Clerk webhooks.** Fewer moving parts for a take-home. Name and email changes sync on the next sign-in, and deleting a user in Clerk doesn't remove them here (see below).
- **HMAC secrets in n8n env, not n8n credentials.** Code nodes can't read credentials, so the HMAC keys come from `$env` (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`). SMTP, which a node can use directly, is a proper credential.
- **Business scheduling in n8n, as the brief asks.** Convex crons only prune replay receipts.
- **Availability computed on read.** Fine at neighbourhood scale (a query per tool). At more scale I'd denormalise the active loan onto the tool and paginate.
- **Dates are UTC calendar days.** Good enough for one neighbourhood.
- **Only the lender marks a loan returned.** They're the one who knows it's back.
- **Approving a request declines overlapping pending ones**, and the borrowers are told, so nobody waits on a request that can't happen.
- **Request notifications are at-least-once.** If n8n sends the email and then crashes before answering, Convex retries and the lender could get a second email. Reminders, which repeat daily and matter more, are claimed first so they're at most once. In production I'd pass the event id to an email provider's idempotency key.
- **Vitest rather than Jest**, because `convex-test` needs it.

## 🏭 Running This in Production

What I'd change:

- **Environments.** A Clerk production instance and a Convex production deployment. n8n in queue mode on Postgres, behind TLS, with external task runners, the editor not on the public internet, and only the webhook path exposed.
- **Secrets.** Move them to a secrets manager (AWS Secrets Manager or similar). Rotate the HMAC keys without downtime by accepting the old and new key during a rotation window. Narrow `NODE_FUNCTION_ALLOW_BUILTIN`/env access to what's used.
- **Users.** Clerk webhooks (Svix-verified) for `user.updated`/`user.deleted`, with a proper deletion path: anonymise the user, keep loan history.
- **Abuse.** Rate limits on mutations (e.g. requests per user per hour) and on the HTTP endpoints, plus an IP allowlist for the n8n caller.
- **Audit.** A separate append-only audit table for admin actions and role changes (who, when, what). Today it's structured logs only.
- **Observability.** Sentry on Next.js. Convex log streams to Datadog. An alert on failed deliveries and on the error workflow firing, rather than relying on the admin page.
- **Email.** A transactional provider with templates, bounce handling and unsubscribe, instead of raw SMTP.
- **Tests and delivery.** Playwright E2E using Clerk testing tokens, preview deployments per PR, and a CSP header.
