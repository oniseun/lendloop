import { v } from 'convex/values';
import { internal } from './_generated/api';
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import type {
  ReminderClaimResult,
  ReminderWriteResult,
} from './modules/automation/automation.dto';
import {
  claimReminder as claimReminderService,
  getPendingDelivery,
  listOverdueLoans,
  pruneReceipts as pruneReceiptsService,
  recordDeliveryAttempt as recordDeliveryAttemptService,
  recordReminder as recordReminderService,
} from './modules/automation/automation.service';
import { sendRequestEvent } from './modules/automation/n8n.gateway';

// Controller for the automation module. Internal functions only: they
// are called by the scheduler, crons and the signed HTTP routes in
// http.ts, never by a browser.

export { REQUEST_EVENTS_ROUTE } from './modules/automation/n8n.gateway';

// ---- Convex -> n8n: request notifications ---------------------------

export const getDelivery = internalQuery({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: (ctx, { deliveryId }) => getPendingDelivery(ctx, deliveryId),
});

export const recordDeliveryAttempt = internalMutation({
  args: {
    deliveryId: v.id('webhookDeliveries'),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: (ctx, args) => recordDeliveryAttemptService(ctx, args),
});

// Actions can't touch the database, so this one reads the outbox row,
// does the HTTP call and records the outcome in a mutation.
export const deliverRequestEvent = internalAction({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.runQuery(internal.automation.getDelivery, {
      deliveryId,
    });
    if (!delivery) return;
    const error = await sendRequestEvent(delivery);
    await ctx.runMutation(internal.automation.recordDeliveryAttempt, {
      deliveryId,
      ok: !error,
      error,
    });
  },
});

// ---- n8n -> Convex: overdue reminders --------------------------------

export const overdueLoans = internalQuery({
  args: { today: v.string() },
  handler: (ctx, { today }) => listOverdueLoans(ctx, today),
});

export const recordReminder = internalMutation({
  args: {
    signature: v.string(),
    loanId: v.string(),
    reminderDate: v.string(),
    status: v.union(v.literal('sent'), v.literal('failed')),
    channel: v.optional(v.string()),
  },
  handler: (ctx, args): Promise<ReminderWriteResult> =>
    recordReminderService(ctx, args),
});

export const claimReminder = internalMutation({
  args: {
    signature: v.string(),
    loanId: v.string(),
    reminderDate: v.string(),
  },
  handler: (ctx, args): Promise<ReminderClaimResult> =>
    claimReminderService(ctx, args),
});

export const pruneReceipts = internalMutation({
  args: {},
  handler: (ctx) => pruneReceiptsService(ctx),
});
