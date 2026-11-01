import { v } from 'convex/values';
import { internal } from './_generated/api';
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';
import {
  SIGNATURE_TOLERANCE_MS,
  WEBHOOK_BACKOFF_MS,
  WEBHOOK_MAX_ATTEMPTS,
} from './lib/constants';
import { reminderKey } from './lib/events';
import { createLogger } from './lib/logger';
import { signedHeaders } from './lib/signature';
import { listOverdueLoans, upsertAutomationEvent } from './model/automation';

const logger = createLogger('automation');

export const REQUEST_EVENTS_ROUTE = 'POST /request-events';
const DELIVERY_TIMEOUT_MS = 10_000;

// ---- Convex -> n8n: request notifications ---------------------------

export const getDelivery = internalQuery({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: (ctx, { deliveryId }) => ctx.db.get(deliveryId),
});

export const recordDeliveryAttempt = internalMutation({
  args: {
    deliveryId: v.id('webhookDeliveries'),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { deliveryId, ok, error }) => {
    const delivery = await ctx.db.get(deliveryId);
    if (!delivery || delivery.status !== 'pending') return;

    const attempts = delivery.attempts + 1;
    if (ok) {
      await ctx.db.patch(deliveryId, {
        status: 'delivered',
        attempts,
        deliveredAt: Date.now(),
        lastError: undefined,
      });
      await upsertAutomationEvent(ctx, {
        loanId: delivery.loanId,
        kind: 'request_notification',
        key: delivery.eventId,
        status: 'sent',
        detail: delivery.eventType,
      });
      logger.info('delivered', { deliveryId, attempts });
      return;
    }

    if (attempts < WEBHOOK_MAX_ATTEMPTS) {
      await ctx.db.patch(deliveryId, { attempts, lastError: error });
      const delay =
        WEBHOOK_BACKOFF_MS[attempts - 1] ??
        WEBHOOK_BACKOFF_MS[WEBHOOK_BACKOFF_MS.length - 1];
      await ctx.scheduler.runAfter(
        delay,
        internal.automation.deliverRequestEvent,
        { deliveryId },
      );
      logger.warn('delivery failed, retry scheduled', {
        deliveryId,
        attempts,
        delay,
        error,
      });
      return;
    }

    await ctx.db.patch(deliveryId, {
      status: 'failed',
      attempts,
      lastError: error,
    });
    await upsertAutomationEvent(ctx, {
      loanId: delivery.loanId,
      kind: 'request_notification',
      key: delivery.eventId,
      status: 'failed',
      detail: delivery.eventType,
    });
    logger.error('delivery failed permanently', {
      deliveryId,
      attempts,
      error,
    });
  },
});

export const deliverRequestEvent = internalAction({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.runQuery(internal.automation.getDelivery, {
      deliveryId,
    });
    if (!delivery || delivery.status !== 'pending') return;

    const url = process.env.N8N_REQUEST_WEBHOOK_URL;
    const secret = process.env.CONVEX_TO_N8N_SECRET;
    if (!url || !secret) {
      await ctx.runMutation(internal.automation.recordDeliveryAttempt, {
        deliveryId,
        ok: false,
        error: 'N8N_NOT_CONFIGURED',
      });
      return;
    }

    let error: string | undefined;
    try {
      const headers = await signedHeaders(
        secret,
        REQUEST_EVENTS_ROUTE,
        delivery.payload,
      );
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-lendloop-event-id': delivery.eventId,
          ...headers,
        },
        body: delivery.payload,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      if (!response.ok) error = `HTTP_${response.status}`;
    } catch (caught) {
      error = caught instanceof Error ? caught.name : 'FETCH_FAILED';
    }

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

export type ReminderWriteResult =
  | { outcome: 'recorded' | 'updated' | 'unchanged' }
  | { outcome: 'replayed' }
  | { outcome: 'loan_not_found' };

// Idempotent on (loanId, reminderDate): n8n can retry as often as it
// likes and the loan still shows one reminder per day. The signature is
// stored in the same transaction, so an exact replay of an accepted
// request is a no-op.
export const recordReminder = internalMutation({
  args: {
    signature: v.string(),
    loanId: v.string(),
    reminderDate: v.string(),
    status: v.union(v.literal('sent'), v.literal('failed')),
    channel: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ReminderWriteResult> => {
    const seen = await ctx.db
      .query('webhookReceipts')
      .withIndex('by_signature', (q) => q.eq('signature', args.signature))
      .unique();
    if (seen) {
      logger.warn('replayed request ignored', { loanId: args.loanId });
      return { outcome: 'replayed' };
    }

    const loanId = ctx.db.normalizeId('loans', args.loanId);
    const loan = loanId ? await ctx.db.get(loanId) : null;
    if (!loanId || !loan) return { outcome: 'loan_not_found' };

    await ctx.db.insert('webhookReceipts', {
      signature: args.signature,
      receivedAt: Date.now(),
    });

    const key = reminderKey(loanId, args.reminderDate);
    const existing = await ctx.db
      .query('automationEvents')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();

    // A sent reminder is final for the day; a later "failed" for the
    // same day (e.g. a retry that errored after the first one worked)
    // must not overwrite it.
    if (existing?.status === 'sent') return { outcome: 'unchanged' };

    const detail = args.channel ? `via ${args.channel}` : undefined;
    await upsertAutomationEvent(ctx, {
      loanId,
      kind: 'overdue_reminder',
      key,
      status: args.status,
      detail,
    });
    logger.info('reminder recorded', {
      loanId,
      reminderDate: args.reminderDate,
      status: args.status,
    });
    return { outcome: existing ? 'updated' : 'recorded' };
  },
});

export type ReminderClaimResult =
  | { outcome: 'claimed' | 'already_claimed' | 'replayed'; claimed: boolean }
  | { outcome: 'loan_not_found'; claimed: false };

export const claimReminder = internalMutation({
  args: {
    signature: v.string(),
    loanId: v.string(),
    reminderDate: v.string(),
  },
  handler: async (ctx, args): Promise<ReminderClaimResult> => {
    const seen = await ctx.db
      .query('webhookReceipts')
      .withIndex('by_signature', (q) => q.eq('signature', args.signature))
      .unique();
    const loanId = ctx.db.normalizeId('loans', args.loanId);
    const loan = loanId ? await ctx.db.get(loanId) : null;
    if (!loanId || !loan) return { outcome: 'loan_not_found', claimed: false };

    const key = reminderKey(loanId, args.reminderDate);
    const existing = await ctx.db
      .query('automationEvents')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();

    // n8n retrying the exact same claim (e.g. the first response timed
    // out): answer as before instead of stranding the claim.
    if (seen) {
      return { outcome: 'replayed', claimed: existing?.status === 'queued' };
    }

    await ctx.db.insert('webhookReceipts', {
      signature: args.signature,
      receivedAt: Date.now(),
    });

    if (existing && existing.status !== 'failed') {
      logger.warn('reminder already claimed', { loanId });
      return { outcome: 'already_claimed', claimed: false };
    }

    await upsertAutomationEvent(ctx, {
      loanId,
      kind: 'overdue_reminder',
      key,
      status: 'queued',
    });
    logger.info('reminder claimed', {
      loanId,
      reminderDate: args.reminderDate,
    });
    return { outcome: 'claimed', claimed: true };
  },
});

// Receipts only need to live as long as the timestamp window.
export const pruneReceipts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 2 * SIGNATURE_TOLERANCE_MS;
    const old = await ctx.db
      .query('webhookReceipts')
      .withIndex('by_received', (q) => q.lt('receivedAt', cutoff))
      .take(500);
    for (const receipt of old) await ctx.db.delete(receipt._id);
    if (old.length) logger.info('receipts pruned', { count: old.length });
  },
});
