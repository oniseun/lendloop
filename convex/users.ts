import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { shouldBootstrapAdmin } from './lib/admins';
import { getCurrentUser } from './lib/auth';
import { appError, ErrorCode } from './lib/errors';
import { createLogger } from './lib/logger';
import { roleValidator } from './lib/validators';

const logger = createLogger('users');

// Called by the client once Clerk has a session. Creates or refreshes
// the Convex user from the verified JWT claims.
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw appError(ErrorCode.UNAUTHENTICATED, 'Sign in to continue');
    }

    const name =
      identity.name ?? identity.givenName ?? identity.nickname ?? 'Neighbour';
    const email = (identity.email ?? '').toLowerCase();

    const existing = await getCurrentUser(ctx);
    if (existing) {
      if (existing.name !== name || existing.email !== email) {
        await ctx.db.patch(existing._id, { name, email });
      }
      return existing._id;
    }

    const role = shouldBootstrapAdmin(
      email,
      identity.emailVerified,
      process.env.ADMIN_EMAILS,
    )
      ? 'admin'
      : 'user';

    const userId = await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email,
      role,
      isTrustedLender: false,
    });
    logger.info('user created', { userId, role });
    return userId;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      role: user.role,
      isTrustedLender: user.isTrustedLender,
    };
  },
});

// Internal only: run from the CLI or dashboard, never from a client.
//   npx convex run users:setRole '{"email":"you@example.com","role":"admin"}'
export const setRole = internalMutation({
  args: { email: v.string(), role: roleValidator },
  handler: async (ctx, { email, role }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
      .unique();
    if (!user)
      throw appError(ErrorCode.USER_NOT_FOUND, 'No user with that email');
    await ctx.db.patch(user._id, { role });
    logger.info('role changed', { userId: user._id, role });
    return user._id;
  },
});
