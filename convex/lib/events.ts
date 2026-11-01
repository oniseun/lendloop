import type { Doc, Id } from '../_generated/dataModel';
import { firstName } from './text';

// Payloads sent to n8n. Each one carries only what the workflow needs
// to notify one person: their first name, their email, the tool name
// and the dates. No descriptions, no free-text messages, no details
// about the other party.

export type RequestEventType =
  | 'loan.requested'
  | 'loan.approved'
  | 'loan.declined'
  | 'loan.cancelled'
  | 'loan.returned';

export interface RequestEventPayload {
  eventId: string;
  type: RequestEventType;
  occurredAt: string;
  loanId: Id<'loans'>;
  recipient: { firstName: string; email: string };
  tool: { name: string };
  dates: { start: string; end: string };
}

// Who needs to hear about each change.
export const RECIPIENT_FOR: Record<RequestEventType, 'lender' | 'borrower'> = {
  'loan.requested': 'lender',
  'loan.cancelled': 'lender',
  'loan.approved': 'borrower',
  'loan.declined': 'borrower',
  'loan.returned': 'borrower',
};

// Each transition happens at most once per loan, so this is a natural
// idempotency key for the outbox and for n8n's own de-duplication.
export const requestEventId = (loanId: Id<'loans'>, type: RequestEventType) =>
  `${loanId}:${type}`;

export const buildRequestEvent = (input: {
  type: RequestEventType;
  loan: Pick<Doc<'loans'>, '_id' | 'startDate' | 'endDate'>;
  tool: Pick<Doc<'tools'>, 'name'>;
  recipient: Pick<Doc<'users'>, 'name' | 'email'>;
  now: number;
}): RequestEventPayload => ({
  eventId: requestEventId(input.loan._id, input.type),
  type: input.type,
  occurredAt: new Date(input.now).toISOString(),
  loanId: input.loan._id,
  recipient: {
    firstName: firstName(input.recipient.name),
    email: input.recipient.email,
  },
  tool: { name: input.tool.name },
  dates: { start: input.loan.startDate, end: input.loan.endDate },
});

export const reminderKey = (loanId: Id<'loans'>, reminderDate: string) =>
  `reminder:${loanId}:${reminderDate}`;
