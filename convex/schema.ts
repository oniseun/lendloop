import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  automationKindValidator,
  automationStatusValidator,
  categoryValidator,
  conditionValidator,
  deliveryStatusValidator,
  loanStatusValidator,
  roleValidator,
} from './lib/validators';

export default defineSchema({
  users: defineTable({
    // Clerk identity. tokenIdentifier is issuer + subject, unique per user.
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    // Role lives in Convex, never in client state or unverified metadata.
    role: roleValidator,
    isTrustedLender: v.boolean(),
  })
    .index('by_token', ['tokenIdentifier'])
    .index('by_email', ['email']),

  tools: defineTable({
    ownerId: v.id('users'),
    name: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
    description: v.string(),
    // Soft delete keeps loan history intact for audit.
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id('users')),
  })
    .index('by_owner', ['ownerId'])
    .index('by_category', ['category']),

  loans: defineTable({
    toolId: v.id('tools'),
    lenderId: v.id('users'),
    borrowerId: v.id('users'),
    // ISO calendar dates (YYYY-MM-DD), inclusive.
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
    status: loanStatusValidator,
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
  })
    .index('by_tool', ['toolId'])
    .index('by_lender', ['lenderId'])
    .index('by_borrower', ['borrowerId'])
    .index('by_status_end', ['status', 'endDate']),

  // One row per automation side effect, shown on the loan as activity.
  automationEvents: defineTable({
    loanId: v.id('loans'),
    kind: automationKindValidator,
    status: automationStatusValidator,
    // Idempotency key, e.g. "reminder:<loanId>:2026-11-01" or an event id.
    key: v.string(),
    detail: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_loan', ['loanId']),

  // Outbox for Convex -> n8n webhooks. Retried by the scheduler.
  webhookDeliveries: defineTable({
    eventId: v.string(),
    loanId: v.id('loans'),
    eventType: v.string(),
    payload: v.string(),
    status: deliveryStatusValidator,
    attempts: v.number(),
    lastError: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
  })
    .index('by_event', ['eventId'])
    .index('by_status', ['status']),

  // Signatures of accepted inbound requests, kept for the replay window.
  webhookReceipts: defineTable({
    signature: v.string(),
    receivedAt: v.number(),
  }).index('by_signature', ['signature']),
});
