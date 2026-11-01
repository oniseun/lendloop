import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { appError, ErrorCode } from './lib/errors';
import { roleValidator } from './lib/validators';
import {
  getProfile,
  setRoleByEmail,
  storeFromIdentity,
} from './modules/users/user.service';

// Controller: argument validation and auth only. Logic lives in
// modules/users/user.service.ts.

// Called by the client once Clerk has a session.
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw appError(ErrorCode.UNAUTHENTICATED, 'Sign in to continue');
    }
    return storeFromIdentity(ctx, identity);
  },
});

export const me = query({
  args: {},
  handler: (ctx) => getProfile(ctx),
});

// Internal only: run from the CLI or dashboard, never from a client.
//   npx convex run users:setRole '{"email":"you@example.com","role":"admin"}'
export const setRole = internalMutation({
  args: { email: v.string(), role: roleValidator },
  handler: (ctx, { email, role }) => setRoleByEmail(ctx, email, role),
});
