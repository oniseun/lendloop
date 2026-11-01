import type { Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { LoanStatus } from '../../lib/constants';
import { createLogger } from '../../lib/logger';
import type { Actor } from '../../lib/permissions';
import {
  listFailedDeliveries,
  retryDelivery,
} from '../automation/automation.service';
import { listAllLoans } from '../loans/loan.service';
import { countActiveListings } from '../tools/tool.service';
import { setTrustedLender } from '../users/user.service';
import { userRepository } from '../users/user.repository';

// Admin use cases. Composes the other modules' services; owns no table.

const logger = createLogger('admin');

export const listLoansForAdmin = (
  ctx: QueryCtx,
  admin: Actor,
  status?: LoanStatus,
) => listAllLoans(ctx, admin, status);

export const listUsersForAdmin = async (ctx: QueryCtx) => {
  const users = await userRepository.listAll(ctx);
  return Promise.all(
    users.map(async (user) => ({
      _id: user._id,
      name: user.name,
      role: user.role,
      isTrustedLender: user.isTrustedLender,
      listings: await countActiveListings(ctx, user._id),
    })),
  );
};

export const markTrustedLender = (
  ctx: MutationCtx,
  admin: Actor,
  userId: Id<'users'>,
  trusted: boolean,
) => setTrustedLender(ctx, userId, trusted, admin._id);

// Outbound webhooks that ran out of retries. Shown in the admin view
// so failures are never silent.
export const listFailedAutomations = (ctx: QueryCtx) =>
  listFailedDeliveries(ctx);

export const retryFailedAutomation = async (
  ctx: MutationCtx,
  admin: Actor,
  deliveryId: Id<'webhookDeliveries'>,
) => {
  await retryDelivery(ctx, deliveryId);
  logger.info('delivery retried', { deliveryId, adminId: admin._id });
};
