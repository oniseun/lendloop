# Review guidelines

## Architecture

- **Backend (convex/)**: one module per domain under `convex/modules/<domain>`.
  - Controllers are the exported Convex functions in `convex/<domain>.ts` and the routes in `convex/http.ts`. They validate arguments (DTO validators), resolve the user through `userQuery` / `userMutation` / `adminQuery` / `adminMutation`, and call one service function. No business logic.
  - Services (`<domain>.service.ts`) hold the use cases and call the permission policy in `convex/lib/permissions.ts`.
  - Repositories (`<domain>.repository.ts`) are the only place `ctx.db` is used (fixtures in `seed.ts` / `e2e.ts` excepted).
  - DTOs (`<domain>.dto.ts`) define request validators and `to…Dto()` response mappers. Never return raw documents; other neighbours see a first name only.
  - Pure rules (`loan.rules.ts`, `lib/permissions.ts`) take no Convex context and are unit tested.
  - Every loan status change goes through `loan.service.setLoanStatus` so its notification is queued in the same transaction.
- **Frontend (src/)**: `src/modules/<feature>/{api,hooks,components,views,dto,context}`. Views call hooks, hooks use the module's `api` references. Routes in `src/app` only render a view.
- Convex file names may only contain letters, digits, underscores and dots: `loan.service.ts`, not `loan-service.ts`.

## Security

- Never log emails, tokens, signatures or secrets. Use `createLogger` with ids only.
- Inbound n8n routes must go through `webhook.guard.verifyInbound`.
- Test fixtures stay internal and gated by `E2E_FIXTURES=true`.

## Testing

- Unit / Convex tests: `npm test`. Browser tests: `npm run e2e` (see README).
- New services and rules need tests; keep lint, typecheck and CI green.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
