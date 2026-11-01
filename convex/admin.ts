import { v } from 'convex/values';
import { internal } from './_generated/api';
import { todayIso } from './lib/dates';
import { appError, ErrorCode } from './lib/errors';
import { adminMutation, adminQuery } from './lib/functions';
import { createLogger } from './lib/logger';
import { loanStatusValidator } from './lib/validators';
import { presentLoan } from './model/loans';

const logger = createLogger('admin');

export const loans = adminQuery({
  args: { status: v.optional(loanStatusValidator) },
  handler: async (ctx, { status }) => {
    const today = todayIso();
    const all = await ctx.db.query('loans').order('desc').take(200);
    const filtered = status ? all.filter((loan) => loan.status === status) : all;
    return Promise.all(
      filtered.map((loan) => presentLoan(ctx, loan, ctx.user._id, today)),
    );
  },
});

export const users = adminQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('users').collect();
    return Promise.all(
      all.map(async (user) => {
        const tools = await ctx.db
          .query('tools')
          .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
          .collect();
        return {
          _id: user._id,
          name: user.name,
          role: user.role,
          isTrustedLender: user.isTrustedLender,
          listings: tools.filter((tool) => !tool.removedAt).length,
        };
      }),
    );
  },
});

export const setTrustedLender = adminMutation({
  args: { userId: v.id('users'), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw appError(ErrorCode.USER_NOT_FOUND, 'User not found');
    await ctx.db.patch(userId, { isTrustedLender: trusted });
    logger.info('trusted lender changed', {
      userId,
      trusted,
      adminId: ctx.user._id,
    });
  },
});

// Outbound webhooks that ran out of retries. Shown in the admin view
// so failures are never silent.
export const failedDeliveries = adminQuery({
  args: {},
  handler: async (ctx) => {
    const failed = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status', (q) => q.eq('status', 'failed'))
      .order('desc')
      .take(50);
    return failed.map((delivery) => ({
      _id: delivery._id,
      eventType: delivery.eventType,
      loanId: delivery.loanId,
      attempts: delivery.attempts,
      lastError: delivery.lastError ?? null,
      createdAt: delivery._creationTime,
    }));
  },
});

export const retryDelivery = adminMutation({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get(deliveryId);
    if (!delivery || delivery.status !== 'failed') {
      throw appError(ErrorCode.VALIDATION_ERROR, 'Nothing to retry');
    }
    await ctx.db.patch(deliveryId, { status: 'pending', attempts: 0 });
    await ctx.scheduler.runAfter(0, internal.automation.deliverRequestEvent, {
      deliveryId,
    });
    logger.info('delivery retried', { deliveryId, adminId: ctx.user._id });
  },
});
