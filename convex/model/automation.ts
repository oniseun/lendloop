import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import {
  buildRequestEvent,
  RECIPIENT_FOR,
  reminderKey,
  requestEventId,
  type RequestEventType,
} from '../lib/events';
import { daysBetween } from '../lib/dates';
import { createLogger } from '../lib/logger';
import { firstName } from '../lib/text';

const logger = createLogger('automation');

type AutomationKind = Doc<'automationEvents'>['kind'];
type AutomationStatus = Doc<'automationEvents'>['status'];

export const upsertAutomationEvent = async (
  ctx: MutationCtx,
  input: {
    loanId: Id<'loans'>;
    kind: AutomationKind;
    key: string;
    status: AutomationStatus;
    detail?: string;
  },
) => {
  const existing = await ctx.db
    .query('automationEvents')
    .withIndex('by_key', (q) => q.eq('key', input.key))
    .unique();
  const updatedAt = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      status: input.status,
      detail: input.detail,
      updatedAt,
    });
    return existing._id;
  }
  return ctx.db.insert('automationEvents', { ...input, updatedAt });
};

// Writes the event to the outbox in the same transaction as the loan
// change, then schedules delivery. If the transaction rolls back, no
// webhook is sent; if delivery fails, it is retried from the outbox.
export const enqueueRequestEvent = async (
  ctx: MutationCtx,
  loan: Doc<'loans'>,
  type: RequestEventType,
) => {
  const eventId = requestEventId(loan._id, type);
  const already = await ctx.db
    .query('webhookDeliveries')
    .withIndex('by_event', (q) => q.eq('eventId', eventId))
    .unique();
  if (already) {
    logger.warn('event already queued', { eventId });
    return already._id;
  }

  const tool = await ctx.db.get(loan.toolId);
  const recipientId =
    RECIPIENT_FOR[type] === 'lender' ? loan.lenderId : loan.borrowerId;
  const recipient = await ctx.db.get(recipientId);
  if (!tool || !recipient) {
    logger.error('cannot build event, missing tool or user', {
      loanId: loan._id,
      type,
    });
    return null;
  }

  const payload = buildRequestEvent({
    type,
    loan,
    tool,
    recipient,
    now: Date.now(),
  });

  const deliveryId = await ctx.db.insert('webhookDeliveries', {
    eventId,
    loanId: loan._id,
    eventType: type,
    payload: JSON.stringify(payload),
    status: 'pending',
    attempts: 0,
  });
  await upsertAutomationEvent(ctx, {
    loanId: loan._id,
    kind: 'request_notification',
    key: eventId,
    status: 'queued',
    detail: type,
  });
  await ctx.scheduler.runAfter(0, internal.automation.deliverRequestEvent, {
    deliveryId,
  });
  logger.info('event queued', { eventId, deliveryId });
  return deliveryId;
};

export interface OverdueLoan {
  loanId: Id<'loans'>;
  reminderDate: string;
  dueDate: string;
  daysOverdue: number;
  borrower: { firstName: string; email: string };
  tool: { name: string };
}

// Approved loans past their end date that have not had a successful
// reminder today. Only the fields the reminder needs leave Convex.
export const listOverdueLoans = async (
  ctx: QueryCtx,
  today: string,
  limit = 100,
): Promise<OverdueLoan[]> => {
  const loans = await ctx.db
    .query('loans')
    .withIndex('by_status_end', (q) =>
      q.eq('status', 'approved').lt('endDate', today),
    )
    .take(limit);

  const result: OverdueLoan[] = [];
  for (const loan of loans) {
    const reminder = await ctx.db
      .query('automationEvents')
      .withIndex('by_key', (q) => q.eq('key', reminderKey(loan._id, today)))
      .unique();
    if (reminder?.status === 'sent') continue;

    const [borrower, tool] = await Promise.all([
      ctx.db.get(loan.borrowerId),
      ctx.db.get(loan.toolId),
    ]);
    if (!borrower || !tool) continue;

    result.push({
      loanId: loan._id,
      reminderDate: today,
      dueDate: loan.endDate,
      daysOverdue: daysBetween(loan.endDate, today),
      borrower: { firstName: firstName(borrower.name), email: borrower.email },
      tool: { name: tool.name },
    });
  }
  return result;
};

export const activityForLoan = async (ctx: QueryCtx, loanId: Id<'loans'>) => {
  const events = await ctx.db
    .query('automationEvents')
    .withIndex('by_loan', (q) => q.eq('loanId', loanId))
    .collect();
  return events
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5)
    .map((event) => ({
      kind: event.kind,
      status: event.status,
      detail: event.detail ?? null,
      updatedAt: event.updatedAt,
    }));
};
