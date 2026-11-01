import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { appError, ErrorCode } from './errors';
import { isAdmin } from './permissions';

export const getCurrentUser = async (
  ctx: QueryCtx,
): Promise<Doc<'users'> | null> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query('users')
    .withIndex('by_token', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique();
};

export const requireUser = async (ctx: QueryCtx): Promise<Doc<'users'>> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Sign in to continue');
  }
  const user = await getCurrentUser(ctx);
  if (!user) {
    // Client calls users.store right after sign-in; this is a race or a
    // deleted user.
    throw appError(ErrorCode.USER_NOT_FOUND, 'Account not set up yet');
  }
  return user;
};

export const requireAdmin = async (ctx: QueryCtx): Promise<Doc<'users'>> => {
  const user = await requireUser(ctx);
  if (!isAdmin(user)) {
    throw appError(ErrorCode.FORBIDDEN, 'Admins only');
  }
  return user;
};
