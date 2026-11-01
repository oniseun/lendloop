import { isIsoDate } from './dates';

export interface ReminderInput {
  loanId: string;
  reminderDate: string;
  status: 'sent' | 'failed';
  channel?: string;
}

// Hand-rolled because the body comes from outside Convex's validators
// (an httpAction gets a raw Request).
export const parseReminderInput = (
  raw: string,
): { ok: true; value: ReminderInput } | { ok: false; error: string } => {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'INVALID_BODY' };
  }
  const { loanId, reminderDate, status, channel } = body as Record<
    string,
    unknown
  >;
  if (typeof loanId !== 'string' || loanId.length === 0 || loanId.length > 64) {
    return { ok: false, error: 'INVALID_LOAN_ID' };
  }
  if (typeof reminderDate !== 'string' || !isIsoDate(reminderDate)) {
    return { ok: false, error: 'INVALID_REMINDER_DATE' };
  }
  if (status !== 'sent' && status !== 'failed') {
    return { ok: false, error: 'INVALID_STATUS' };
  }
  if (
    channel !== undefined &&
    (typeof channel !== 'string' || !/^[a-z_-]{1,20}$/.test(channel))
  ) {
    return { ok: false, error: 'INVALID_CHANNEL' };
  }
  return { ok: true, value: { loanId, reminderDate, status, channel } };
};
