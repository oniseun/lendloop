import type { Doc, Id } from '../../_generated/dataModel';

// Request and response shapes for the automation module.

export interface OverdueLoanDto {
  loanId: Id<'loans'>;
  reminderDate: string;
  dueDate: string;
  daysOverdue: number;
  borrower: { firstName: string; email: string };
  tool: { name: string };
}

export type ReminderWriteResult =
  | { outcome: 'recorded' | 'updated' | 'unchanged' }
  | { outcome: 'replayed' }
  | { outcome: 'loan_not_found' };

export type ReminderClaimResult =
  | { outcome: 'claimed' | 'already_claimed' | 'replayed'; claimed: boolean }
  | { outcome: 'loan_not_found'; claimed: false };

export interface ReminderWriteInput {
  signature: string;
  loanId: string;
  reminderDate: string;
  status: 'sent' | 'failed';
  channel?: string;
}

export interface ReminderClaimInput {
  signature: string;
  loanId: string;
  reminderDate: string;
}

export const toActivityDto = (event: Doc<'automationEvents'>) => ({
  kind: event.kind,
  status: event.status,
  detail: event.detail ?? null,
  updatedAt: event.updatedAt,
});

export const toFailedDeliveryDto = (delivery: Doc<'webhookDeliveries'>) => ({
  _id: delivery._id,
  eventType: delivery.eventType,
  loanId: delivery.loanId,
  attempts: delivery.attempts,
  lastError: delivery.lastError ?? null,
  createdAt: delivery._creationTime,
});

export type ActivityDto = ReturnType<typeof toActivityDto>;
