import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';

// Data access for the automation tables: activity rows shown on a loan
// (automationEvents), the Convex -> n8n outbox (webhookDeliveries) and
// accepted inbound signatures (webhookReceipts).

type NewEvent = Omit<Doc<'automationEvents'>, '_id' | '_creationTime'>;
type NewDelivery = Omit<Doc<'webhookDeliveries'>, '_id' | '_creationTime'>;
type DeliveryPatch = Partial<NewDelivery>;

export const automationEventRepository = {
  findByKey: (ctx: QueryCtx, key: string) =>
    ctx.db
      .query('automationEvents')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique(),

  listByLoan: (ctx: QueryCtx, loanId: Id<'loans'>) =>
    ctx.db
      .query('automationEvents')
      .withIndex('by_loan', (q) => q.eq('loanId', loanId))
      .collect(),

  insert: (ctx: MutationCtx, event: NewEvent) =>
    ctx.db.insert('automationEvents', event),

  patch: (
    ctx: MutationCtx,
    eventId: Id<'automationEvents'>,
    patch: Partial<NewEvent>,
  ) => ctx.db.patch(eventId, patch),
};

export const deliveryRepository = {
  getById: (ctx: QueryCtx, deliveryId: Id<'webhookDeliveries'>) =>
    ctx.db.get(deliveryId),

  findByEventId: (ctx: QueryCtx, eventId: string) =>
    ctx.db
      .query('webhookDeliveries')
      .withIndex('by_event', (q) => q.eq('eventId', eventId))
      .unique(),

  listFailed: (ctx: QueryCtx, limit: number) =>
    ctx.db
      .query('webhookDeliveries')
      .withIndex('by_status', (q) => q.eq('status', 'failed'))
      .order('desc')
      .take(limit),

  insert: (ctx: MutationCtx, delivery: NewDelivery) =>
    ctx.db.insert('webhookDeliveries', delivery),

  patch: (
    ctx: MutationCtx,
    deliveryId: Id<'webhookDeliveries'>,
    patch: DeliveryPatch,
  ) => ctx.db.patch(deliveryId, patch),
};

export const receiptRepository = {
  findBySignature: (ctx: QueryCtx, signature: string) =>
    ctx.db
      .query('webhookReceipts')
      .withIndex('by_signature', (q) => q.eq('signature', signature))
      .unique(),

  insert: (ctx: MutationCtx, signature: string) =>
    ctx.db.insert('webhookReceipts', { signature, receivedAt: Date.now() }),

  listOlderThan: (ctx: QueryCtx, cutoff: number, limit: number) =>
    ctx.db
      .query('webhookReceipts')
      .withIndex('by_received', (q) => q.lt('receivedAt', cutoff))
      .take(limit),

  delete: (ctx: MutationCtx, receiptId: Id<'webhookReceipts'>) =>
    ctx.db.delete(receiptId),
};
