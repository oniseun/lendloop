# LendLoop

Borrow what you need. Lend what you don't.

A tool-lending board for a neighbourhood. Neighbours list tools, request to borrow them for a date range, and the owner approves, declines and marks them returned. n8n handles the notifications and the daily overdue reminders.

Built with Next.js (App Router) + Clerk + Convex + n8n, all TypeScript.

## 🛠 Tech Stack

- **Web:** Next.js 16 (App Router), React 19, MUI 9
- **Auth:** Clerk (JWT verified by Convex)
- **Data + backend:** Convex (queries, mutations, HTTP actions, scheduler)
- **Automation:** n8n 2.x (self-hosted via Docker), Mailpit as the local SMTP sink
- **Tests:** Vitest + `convex-test` (runs the real Convex functions in memory)
- **Tooling:** ESLint, Prettier, Husky + commitlint (conventional commits), GitHub Actions

## 🚀 Getting Started

### Quick start (Docker)

Needs Docker with Compose v2. Nothing else: no Node, no Clerk account.

```bash
cp .env.example .env    # optional: add your Clerk keys, see below
docker compose up -d --build    # or: npm run docker:up
```

The first start takes a few minutes (it builds the app). Then:

| What             | Where                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| App              | http://localhost:3000                                                        |
| n8n              | http://localhost:5678 (`N8N_OWNER_EMAIL` / `N8N_OWNER_PASSWORD` from `.env`) |
| Mailpit (emails) | http://localhost:8025                                                        |
| Convex dashboard | http://localhost:6791 (admin key: see below)                                 |
| Convex API       | http://localhost:3210 (HTTP actions on :3211)                                |

What `docker compose up` does, in order:

1. **convex-backend** (self-hosted Convex) and **mailpit** start and report healthy.
2. **convex-admin-key** derives the Convex admin key; **convex-init** then
   - uses the Clerk keys from `.env`, or, if they're empty, creates a Clerk **keyless** dev app (its claim link is in `docker compose logs convex-init`) and adds the `convex` JWT template,
   - generates the two webhook signing secrets,
   - sets the Convex env (`CLERK_JWT_ISSUER_DOMAIN`, `ADMIN_EMAILS`, `N8N_REQUEST_WEBHOOK_URL`, secrets), deploys the functions and seeds the demo data.
3. **web** builds and serves Next.js; **n8n** imports the SMTP credential and the three workflows, publishes them and creates the owner account. No clicks needed.

Keys, secrets and data live in Docker volumes and are reused by the next `up`. `docker compose down -v` resets everything.

**Clerk:** leaving both keys empty is fine for trying it out. To use your own Clerk app, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (both) in `.env` before the first `up`; the `convex` JWT template is created for you. Add your email to `ADMIN_EMAILS` to get the admin role on first sign-in.

Useful commands:

```bash
docker compose logs -f web n8n                       # follow logs
docker compose exec convex-backend ./generate_admin_key.sh   # dashboard admin key
docker compose exec n8n sh -c 'set -a && . /shared/n8n.env && N8N_PORT=5679 N8N_RUNNERS_BROKER_PORT=5680 n8n execute --id lendloopOverdueW'   # run the overdue reminders now
node scripts/docker-smoke.mjs                        # the CI smoke test
docker compose down                                  # stop (add -v to wipe data)
```

CI runs exactly this (`docker` job): `cp .env.example .env`, `docker compose up -d --build`, then `scripts/docker-smoke.mjs` checks the app, Convex, n8n and Mailpit, sends a signed request event through the n8n webhook and runs the overdue workflow, and confirms both emails arrive in Mailpit.

### Manual setup (without Docker for the app)

For working on the code with hot reload: Next.js and Convex run on your machine, n8n + Mailpit in Docker.

Prerequisites: Node 22 (`.nvmrc`), Docker (for n8n + Mailpit), a free Clerk development instance.

#### 1. Install

```bash
npm run setup   # copies .env.example to .env.local and installs
```

#### 2. Clerk

1. Create an application in Clerk.
2. In the Clerk dashboard, open **Integrations → Convex** and activate it. That creates the `convex` JWT template Convex expects. Copy the **Frontend API URL** shown there.
3. Put the publishable and secret keys in `.env.local`.

#### 3. Convex

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

#### 4. n8n

```bash
cp n8n/.env.example n8n/.env
# fill in N8N_ENCRYPTION_KEY and the two LENDLOOP_*_SECRET values
# (same values as CONVEX_TO_N8N_SECRET / N8N_TO_CONVEX_SECRET above:
#  npx convex env get CONVEX_TO_N8N_SECRET)
npm run n8n:up   # docker compose -f docker-compose.n8n.yml up -d
```

On boot the container imports the SMTP credential (built from env into n8n's encrypted store), imports the three workflows from `n8n/workflows` and publishes them. Open http://localhost:5678 and create the owner account. Emails land in Mailpit at http://localhost:8025.

#### 5. Run the app

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

With Docker, `.env` only holds the optional values in `.env.example` (Clerk keys, `ADMIN_EMAILS`, n8n login, notify channel); everything else below is generated and wired up by `convex-init`. The table describes the manual setup.

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

Same layering I use in FLIQ (NestJS backend + React web): one module per domain, controllers stay thin, services own the use cases, repositories own the queries, DTOs shape what goes in and out. Convex has no classes or DI, so each layer is a plain TypeScript module, but the boundaries are the same.

| FLIQ backend (NestJS)                      | LendLoop (Convex)                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `modules/<x>/controllers/*.controller.ts`  | `convex/<x>.ts` – exported query/mutation = route; args + auth only      |
| `@UseGuards(AuthGuard)`, `@Roles(...)`     | `userQuery` / `userMutation` / `adminQuery` (`convex/lib/functions.ts`)  |
| `modules/<x>/services/*.service.ts`        | `convex/modules/<x>/<x>.service.ts`                                      |
| `modules/<x>/repositories/*.repository.ts` | `convex/modules/<x>/<x>.repository.ts` – the only place `ctx.db` is used |
| `dtos/request` + `dtos/response`           | `convex/modules/<x>/<x>.dto.ts` – Convex validators in, `to…Dto()` out   |
| entities / enums                           | `convex/schema.ts`, `convex/lib/constants.ts`                            |
| `ResponseFormat<T>`                        | `convex/lib/http.ts` (same `{ success, message, data }` envelope)        |
| providers (email, SMS lambdas)             | `convex/modules/automation/n8n.gateway.ts`                               |
| `modules/common`                           | `convex/lib` (permissions, signature, dates, errors, logger)             |

```
convex/
  schema.ts                       tables + indexes
  users.ts tools.ts loans.ts      controllers: validate args, resolve the user, call a service
  admin.ts automation.ts          (automation.ts is internal: scheduler, crons and http.ts only)
  http.ts                         HTTP controllers for n8n: size limit, signature guard, parse, call
  modules/
    users/    user.repository  user.service  user.dto
    tools/    tool.repository  tool.service  tool.dto
    loans/    loan.repository  loan.service  loan.dto  loan.rules (pure domain rules)
    automation/
              automation.repository  automation.service  automation.dto
              n8n.gateway (outbound HTTP)  webhook.guard (inbound HMAC check)
    admin/    admin.service (composes the other services, owns no table)
  lib/                            common: permissions policy, signing, dates, validators, errors, logger
  e2e.ts                          test fixtures, gated by E2E_FIXTURES=true (see Testing)
  seed.ts crons.ts
src/
  app/                            routes only, each renders a view
  modules/<feature>/              same layout as fliq-web-frontend:
    api/                          Convex function references (the "apiClient" of each module)
    hooks/                        useQuery / useMutation wrappers the views call
    components/ views/ dto/ context/
n8n/
  workflows/                      exported workflow JSON (no secrets)
  docker/bootstrap.sh             credential + workflow import, owner account, on boot
docker-compose.yml  Dockerfile    the full stack (see Quick start)
docker/                           convex-init.mjs (keys, env, deploy, seed), web-start.sh
docker-compose.n8n.yml            n8n + Mailpit only, for the manual setup
tests/
  unit/                           permissions, loan rules, signing, dates, payloads, n8n Code nodes
  convex/                         real Convex functions via convex-test
e2e/                              Playwright, real Clerk sessions, local Convex backend
```

A request flows `view → hook → api ref → convex/loans.ts (controller) → loan.service → loan.repository / loan.rules`, and every state change queues its notification through `automation.service` in the same transaction.

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
npm test          # vitest: unit + Convex function tests
npm run lint
npm run typecheck
npm run build
npm run e2e       # Playwright (see below)
```

71 unit and integration tests:

- **Permissions** (pure policy) and **RBAC through the real Convex functions**: anonymous writes, editing or deleting someone else's tool, approving or returning as borrower, stranger or admin, admin-only functions, admin removal, and what each list returns (no owner data publicly, no emails when signed in).
- **Loan rules**: double-booking, clashing requests declined on approval, duplicate requests, state transitions, plus unit tests for `loan.rules.ts`.
- **Signing**: a known HMAC vector, tampering, wrong secret, wrong route, stale and future timestamps, malformed headers.
- **Automation**: signed minimal payloads, retry then failure then admin retry, overdue endpoint auth and shape, single-winner reminder claims, idempotent write-backs, exact-replay handling, paging past handled loans.
- **n8n workflows**: the JavaScript inside the exported Code nodes is executed and checked against the Convex signer and verifier, so the two sides can't drift. A further test asserts the exports carry no secrets and route failures to the error workflow.

### End-to-end (Playwright)

9 browser tests in `e2e/`, run against the Next.js app, a local Convex backend and a **real Clerk dev instance**. No auth bypass: each test gets a genuine Clerk session through `@clerk/testing` (testing token + sign-in ticket for a `+clerk_test` user), and Convex verifies the real JWT.

- signed-out visitors see the public board and are redirected away from app pages
- lender lists two tools; own listings can't be borrowed
- borrower requests both; lender sees the note; the n8n email lands in Mailpit (when `E2E_MAILPIT_URL` is set)
- lender approves one, declines the other; borrower sees both; the board shows "On loan"
- borrower gets no lender actions
- lender marks returned; the tool is available again
- overdue: a loan due two days ago is listed for n8n, the first claim wins, a second claim the same day is refused, the write-back shows "Reminder sent" and the loan drops off the list, and a late "failed" can't overwrite "sent"
- admin area visible to admins only

Run locally:

```bash
npx convex dev                 # local backend (leave running)
npm run e2e:setup              # Clerk JWT template + e2e users, Convex env (idempotent)
npm run e2e                    # starts `next dev` if nothing is on :3000
```

`e2e:setup` uses `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` from the environment or `.env.local`. With no keys it creates a Clerk **keyless** dev app (what `@clerk/nextjs` does on first run, no account needed) and writes the keys to `.env.local`. For the overdue spec also set `E2E_N8N_TO_CONVEX_SECRET` to the deployment's `N8N_TO_CONVEX_SECRET`; for the email check set `E2E_MAILPIT_URL=http://localhost:8025` with n8n and Mailpit running.

**Against the Docker stack:** the same suite passes against `docker compose up` (9 passed, email check included). Point the tools at the self-hosted backend instead of `convex dev`: `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210`, `CONVEX_SELF_HOSTED_ADMIN_KEY` from `docker compose exec convex-backend ./generate_admin_key.sh`, the Clerk keys from `/shared/app.env` in the `shared` volume, `E2E_N8N_TO_CONVEX_SECRET` from `/shared/n8n.env`, `E2E_BASE_URL=http://localhost:3000` and `E2E_MAILPIT_URL=http://localhost:8025`; then `npm run e2e:setup && npm run e2e`.

The overdue spec needs a loan in the past, which the UI rightly refuses, so it calls `convex/e2e.ts:createOverdueLoan`. That is an **internal** mutation (no browser can call it; only `npx convex run` with the deployment's admin key) and it throws unless the deployment has `E2E_FIXTURES=true`, which `e2e:setup` sets on local deployments only. Never set it in production.

**CI:** the `e2e` job in `.github/workflows/ci.yml` starts a local Convex backend, runs `e2e:setup`, builds and runs the suite. If the repo secrets `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set it uses that Clerk instance; otherwise it creates a throwaway keyless Clerk app for the run. n8n and Mailpit aren't started in CI, so the email assertion is skipped there; it runs locally.

**Screenshots** in `docs/screenshots` are produced by `e2e/docs-screenshots.spec.ts` (skipped unless `E2E_SCREENSHOTS=1`) against a freshly seeded deployment with n8n and Mailpit running; the overdue email comes from a real n8n run (`OVERDUE_RUN_CMD="docker compose -f docker-compose.n8n.yml exec -T n8n n8n execute --id lendloopOverdueW"`).

I also ran the whole loop by hand against a local Convex backend, n8n 2.45.7 and Mailpit: request → signed webhook → email to the lender → delivery marked sent; overdue run → claim → reminder email → write-back recorded; a second run sends nothing; an unreachable Convex URL triggers the error workflow.

## 📸 Screenshots

|                                                                                                                                            |                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| ![Public board](docs/screenshots/01-public-board-signed-out.png) Signed-out landing page with the public board (names and categories only) | ![Board](docs/screenshots/04-borrower-board.png) The board for a signed-in borrower: availability, Trusted Lender badge |
| ![List a tool](docs/screenshots/02-lender-list-a-tool.png) Lender listing a tool                                                           | ![My listings](docs/screenshots/03-lender-my-listings.png) Lender's listings                                            |
| ![Request](docs/screenshots/05-borrower-request-dialog.png) Borrower requesting dates with a note                                          | ![My requests](docs/screenshots/06-borrower-my-requests-pending.png) Borrower's pending requests                        |
| ![Incoming](docs/screenshots/07-lender-incoming-request.png) Lender's incoming requests, with n8n notification status                      | ![Email to lender](docs/screenshots/08-email-new-request-to-lender.png) The n8n email to the lender (Mailpit)           |
| ![Approved and declined](docs/screenshots/09-lender-approved-and-declined.png) One approved, one declined                                  | ![Approved email](docs/screenshots/10-email-approved-to-borrower.png) Approval email to the borrower                    |
| ![On loan](docs/screenshots/11-board-drill-on-loan.png) The board shows the drill as On loan                                               | ![Overdue](docs/screenshots/12-borrower-overdue-with-reminder.png) Overdue loan with the reminder recorded by n8n       |
| ![Reminder email](docs/screenshots/13-email-overdue-reminder.png) Overdue reminder email                                                   | ![Mailpit inbox](docs/screenshots/14-mailpit-inbox.png) Every email the flow sent                                       |
| ![Returned](docs/screenshots/15-lender-marked-returned.png) Lender marks the drill returned                                                | ![Admin](docs/screenshots/16-admin-all-loans.png) Admin: all loans with automation activity                             |
| ![n8n request workflow](docs/screenshots/17-n8n-request-notification-workflow.png) n8n: request notification workflow                      | ![n8n overdue workflow](docs/screenshots/18-n8n-overdue-reminder-workflow.png) n8n: daily overdue reminders             |
| ![n8n error workflow](docs/screenshots/19-n8n-error-workflow.png) n8n: error handler                                                       | ![n8n executions](docs/screenshots/20-n8n-executions.png) n8n executions, all successful                                |

## ⚖️ Decisions and Trade-offs

- **Roles in Convex, not Clerk metadata.** One source of truth, enforced where the data is, revocable instantly. Cost: admin bootstrap is via `ADMIN_EMAILS` or the CLI.
- **User sync on sign-in (`users.store`) rather than Clerk webhooks.** Fewer moving parts. Name and email changes sync on the next sign-in, and deleting a user in Clerk doesn't remove them here (see below).
- **HMAC secrets in n8n env, not n8n credentials.** Code nodes can't read credentials, so the HMAC keys come from `$env` (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`). SMTP, which a node can use directly, is a proper credential.
- **Business scheduling lives in n8n.** Convex crons only prune replay receipts.
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
