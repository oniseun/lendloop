import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { getCurrentUser } from '../modules/users/user.service';
import { appError, ErrorCode } from './errors';
import { isAdmin } from './permissions';

// Guards used by the custom function builders in ./functions.ts, the
// Convex equivalent of an auth guard on a controller.

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
