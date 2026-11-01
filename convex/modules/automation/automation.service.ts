import { internal } from '../../_generated/api';
import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import {
  SIGNATURE_TOLERANCE_MS,
  WEBHOOK_BACKOFF_MS,
  WEBHOOK_MAX_ATTEMPTS,
} from '../../lib/constants';
import { daysBetween } from '../../lib/dates';
import { appError, ErrorCode } from '../../lib/errors';
import {
  buildRequestEvent,
  RECIPIENT_FOR,
  reminderKey,
  requestEventId,
  type RequestEventType,
} from '../../lib/events';
import { createLogger } from '../../lib/logger';
import { firstName } from '../../lib/text';
import { loanRepository } from '../loans/loan.repository';
import { toolRepository } from '../tools/tool.repository';
import { userRepository } from '../users/user.repository';
import {
  toActivityDto,
  toFailedDeliveryDto,
  type OverdueLoanDto,
  type ReminderClaimInput,
  type ReminderClaimResult,
  type ReminderWriteInput,
  type ReminderWriteResult,
} from './automation.dto';
import {
  automationEventRepository,
  deliveryRepository,
  receiptRepository,
} from './automation.repository';

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
  const existing = await automationEventRepository.findByKey(ctx, input.key);
  const updatedAt = Date.now();
  if (existing) {
    await automationEventRepository.patch(ctx, existing._id, {
      status: input.status,
      detail: input.detail,
      updatedAt,
    });
    return existing._id;
  }
  return automationEventRepository.insert(ctx, { ...input, updatedAt });
};

// ---- Convex -> n8n: request notifications (transactional outbox) ----

// Writes the event to the outbox in the same transaction as the loan
// change, then schedules delivery. If the transaction rolls back, no
// webhook is sent; if delivery fails, it is retried from the outbox.
export const enqueueRequestEvent = async (
  ctx: MutationCtx,
  loan: Doc<'loans'>,
  type: RequestEventType,
) => {
  const eventId = requestEventId(loan._id, type);
  const already = await deliveryRepository.findByEventId(ctx, eventId);
  if (already) {
    logger.warn('event already queued', { eventId });
    return already._id;
  }

  const recipientId =
    RECIPIENT_FOR[type] === 'lender' ? loan.lenderId : loan.borrowerId;
  const [tool, recipient] = await Promise.all([
    toolRepository.getById(ctx, loan.toolId),
    userRepository.getById(ctx, recipientId),
  ]);
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

  const deliveryId = await deliveryRepository.insert(ctx, {
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

export const getPendingDelivery = async (
  ctx: QueryCtx,
  deliveryId: Id<'webhookDeliveries'>,
) => {
  const delivery = await deliveryRepository.getById(ctx, deliveryId);
  return delivery?.status === 'pending' ? delivery : null;
};

export const recordDeliveryAttempt = async (
  ctx: MutationCtx,
  input: { deliveryId: Id<'webhookDeliveries'>; ok: boolean; error?: string },
) => {
  const { deliveryId, ok, error } = input;
  const delivery = await deliveryRepository.getById(ctx, deliveryId);
  if (!delivery || delivery.status !== 'pending') return;

  const attempts = delivery.attempts + 1;
  const activity = {
    loanId: delivery.loanId,
    kind: 'request_notification' as const,
    key: delivery.eventId,
    detail: delivery.eventType,
  };

  if (ok) {
    await deliveryRepository.patch(ctx, deliveryId, {
      status: 'delivered',
      attempts,
      deliveredAt: Date.now(),
      lastError: undefined,
    });
    await upsertAutomationEvent(ctx, { ...activity, status: 'sent' });
    logger.info('delivered', { deliveryId, attempts });
    return;
  }

  if (attempts < WEBHOOK_MAX_ATTEMPTS) {
    await deliveryRepository.patch(ctx, deliveryId, {
      attempts,
      lastError: error,
    });
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

  await deliveryRepository.patch(ctx, deliveryId, {
    status: 'failed',
    attempts,
    lastError: error,
  });
  await upsertAutomationEvent(ctx, { ...activity, status: 'failed' });
  logger.error('delivery failed permanently', { deliveryId, attempts, error });
};

export const listFailedDeliveries = async (ctx: QueryCtx, limit = 50) =>
  (await deliveryRepository.listFailed(ctx, limit)).map(toFailedDeliveryDto);

export const retryDelivery = async (
  ctx: MutationCtx,
  deliveryId: Id<'webhookDeliveries'>,
) => {
  const delivery = await deliveryRepository.getById(ctx, deliveryId);
  if (!delivery || delivery.status !== 'failed') {
    throw appError(ErrorCode.VALIDATION_ERROR, 'Nothing to retry');
  }
  await deliveryRepository.patch(ctx, deliveryId, {
    status: 'pending',
    attempts: 0,
  });
  await ctx.scheduler.runAfter(0, internal.automation.deliverRequestEvent, {
    deliveryId,
  });
};

// ---- n8n -> Convex: overdue reminders --------------------------------

// Approved loans past their end date with no reminder claimed or sent
// today. Only the fields the reminder needs leave Convex.
export const listOverdueLoans = async (
  ctx: QueryCtx,
  today: string,
  limit = 100,
): Promise<OverdueLoanDto[]> => {
  const result: OverdueLoanDto[] = [];
  // Skip already-handled loans before applying the limit, so loans past
  // the first page are never starved.
  for await (const loan of loanRepository.streamApprovedEndingBefore(
    ctx,
    today,
  )) {
    if (result.length >= limit) break;
    const reminder = await automationEventRepository.findByKey(
      ctx,
      reminderKey(loan._id, today),
    );
    // Claimed (queued) or sent today: not ours to send again.
    if (reminder && reminder.status !== 'failed') continue;

    const [borrower, tool] = await Promise.all([
      userRepository.getById(ctx, loan.borrowerId),
      toolRepository.getById(ctx, loan.toolId),
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

// Idempotent on (loanId, reminderDate): n8n can retry as often as it
// likes and the loan still shows one reminder per day. The signature is
// stored in the same transaction, so an exact replay of an accepted
// request is a no-op.
export const recordReminder = async (
  ctx: MutationCtx,
  input: ReminderWriteInput,
): Promise<ReminderWriteResult> => {
  if (await receiptRepository.findBySignature(ctx, input.signature)) {
    logger.warn('replayed request ignored', { loanId: input.loanId });
    return { outcome: 'replayed' };
  }

  const loan = await loanRepository.findByRawId(ctx, input.loanId);
  if (!loan) return { outcome: 'loan_not_found' };

  await receiptRepository.insert(ctx, input.signature);

  const key = reminderKey(loan._id, input.reminderDate);
  const existing = await automationEventRepository.findByKey(ctx, key);

  // A sent reminder is final for the day; a later "failed" for the
  // same day (e.g. a retry that errored after the first one worked)
  // must not overwrite it.
  if (existing?.status === 'sent') return { outcome: 'unchanged' };

  await upsertAutomationEvent(ctx, {
    loanId: loan._id,
    kind: 'overdue_reminder',
    key,
    status: input.status,
    detail: input.channel ? `via ${input.channel}` : undefined,
  });
  logger.info('reminder recorded', {
    loanId: loan._id,
    reminderDate: input.reminderDate,
    status: input.status,
  });
  return { outcome: existing ? 'updated' : 'recorded' };
};

// n8n claims a reminder before sending it, so two overlapping runs can
// never both email the same borrower on the same day.
export const claimReminder = async (
  ctx: MutationCtx,
  input: ReminderClaimInput,
): Promise<ReminderClaimResult> => {
  const seen = await receiptRepository.findBySignature(ctx, input.signature);
  const loan = await loanRepository.findByRawId(ctx, input.loanId);
  if (!loan) return { outcome: 'loan_not_found', claimed: false };

  const key = reminderKey(loan._id, input.reminderDate);
  const existing = await automationEventRepository.findByKey(ctx, key);

  // n8n retrying the exact same claim (e.g. the first response timed
  // out): answer as before instead of stranding the claim.
  if (seen) {
    return { outcome: 'replayed', claimed: existing?.status === 'queued' };
  }

  await receiptRepository.insert(ctx, input.signature);

  if (existing && existing.status !== 'failed') {
    logger.warn('reminder already claimed', { loanId: loan._id });
    return { outcome: 'already_claimed', claimed: false };
  }

  await upsertAutomationEvent(ctx, {
    loanId: loan._id,
    kind: 'overdue_reminder',
    key,
    status: 'queued',
  });
  logger.info('reminder claimed', {
    loanId: loan._id,
    reminderDate: input.reminderDate,
  });
  return { outcome: 'claimed', claimed: true };
};

// Receipts only need to live as long as the timestamp window.
export const pruneReceipts = async (ctx: MutationCtx) => {
  const cutoff = Date.now() - 2 * SIGNATURE_TOLERANCE_MS;
  const old = await receiptRepository.listOlderThan(ctx, cutoff, 500);
  for (const receipt of old) await receiptRepository.delete(ctx, receipt._id);
  if (old.length) logger.info('receipts pruned', { count: old.length });
};

export const activityForLoan = async (ctx: QueryCtx, loanId: Id<'loans'>) => {
  const events = await automationEventRepository.listByLoan(ctx, loanId);
  return events
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5)
    .map(toActivityDto);
};
