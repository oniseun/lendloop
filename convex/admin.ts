import { v } from 'convex/values';
import { adminMutation, adminQuery } from './lib/functions';
import { loanStatusValidator } from './lib/validators';
import {
  listFailedAutomations,
  listLoansForAdmin,
  listUsersForAdmin,
  markTrustedLender,
  retryFailedAutomation,
} from './modules/admin/admin.service';

// Controller for the admin area. adminQuery / adminMutation are the
// role guard: non-admins are rejected before any handler runs.

export const loans = adminQuery({
  args: { status: v.optional(loanStatusValidator) },
  handler: (ctx, { status }) => listLoansForAdmin(ctx, ctx.user, status),
});

export const users = adminQuery({
  args: {},
  handler: (ctx) => listUsersForAdmin(ctx),
});

export const setTrustedLender = adminMutation({
  args: { userId: v.id('users'), trusted: v.boolean() },
  handler: (ctx, { userId, trusted }) =>
    markTrustedLender(ctx, ctx.user, userId, trusted),
});

export const failedDeliveries = adminQuery({
  args: {},
  handler: (ctx) => listFailedAutomations(ctx),
});

export const retryDelivery = adminMutation({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: (ctx, { deliveryId }) =>
    retryFailedAutomation(ctx, ctx.user, deliveryId),
});
