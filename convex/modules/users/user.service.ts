import type { UserIdentity } from 'convex/server';
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { shouldBootstrapAdmin } from '../../lib/admins';
import type { UserRole } from '../../lib/constants';
import { appError, ErrorCode } from '../../lib/errors';
import { createLogger } from '../../lib/logger';
import { toMeDto } from './user.dto';
import { userRepository } from './user.repository';

const logger = createLogger('users');

// Resolves the signed-in user from the verified Clerk JWT.
export const getCurrentUser = async (ctx: QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return userRepository.findByToken(ctx, identity.tokenIdentifier);
};

// Creates or refreshes the Convex user from the JWT claims. Role is
// decided here, server-side, never taken from the client.
export const storeFromIdentity = async (
  ctx: MutationCtx,
  identity: UserIdentity,
): Promise<Id<'users'>> => {
  const name =
    identity.name ?? identity.givenName ?? identity.nickname ?? 'Neighbour';
  const email = (identity.email ?? '').toLowerCase();

  const existing = await userRepository.findByToken(
    ctx,
    identity.tokenIdentifier,
  );
  if (existing) {
    if (existing.name !== name || existing.email !== email) {
      await userRepository.patch(ctx, existing._id, { name, email });
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

  const userId = await userRepository.insert(ctx, {
    tokenIdentifier: identity.tokenIdentifier,
    name,
    email,
    role,
    isTrustedLender: false,
  });
  logger.info('user created', { userId, role });
  return userId;
};

export const getProfile = async (ctx: QueryCtx) => {
  const user = await getCurrentUser(ctx);
  return user ? toMeDto(user) : null;
};

export const setRoleByEmail = async (
  ctx: MutationCtx,
  email: string,
  role: UserRole,
) => {
  const user = await userRepository.findByEmail(ctx, email);
  if (!user) {
    throw appError(ErrorCode.USER_NOT_FOUND, 'No user with that email');
  }
  await userRepository.patch(ctx, user._id, { role });
  logger.info('role changed', { userId: user._id, role });
  return user._id;
};

export const setTrustedLender = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
  trusted: boolean,
  adminId: Id<'users'>,
) => {
  const user = await userRepository.getById(ctx, userId);
  if (!user) throw appError(ErrorCode.USER_NOT_FOUND, 'User not found');
  await userRepository.patch(ctx, userId, { isTrustedLender: trusted });
  logger.info('trusted lender changed', { userId, trusted, adminId });
};
