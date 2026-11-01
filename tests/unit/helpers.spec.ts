import { describe, expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import { shouldBootstrapAdmin } from '../../convex/lib/admins';
import {
  assertValidLoanRange,
  daysBetween,
  isIsoDate,
  rangesOverlap,
} from '../../convex/lib/dates';
import { buildRequestEvent, RECIPIENT_FOR } from '../../convex/lib/events';
import { parseReminderInput } from '../../convex/lib/reminderInput';
import {
  availabilityFor,
  isOverdue,
} from '../../convex/modules/loans/loan.rules';

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isIsoDate('2026-11-01')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('01/11/2026')).toBe(false);
  });

  it('treats ranges as inclusive', () => {
    const a = { startDate: '2026-11-01', endDate: '2026-11-03' };
    expect(
      rangesOverlap(a, { startDate: '2026-11-03', endDate: '2026-11-04' }),
    ).toBe(true);
    expect(
      rangesOverlap(a, { startDate: '2026-11-04', endDate: '2026-11-05' }),
    ).toBe(false);
    expect(daysBetween('2026-11-01', '2026-11-04')).toBe(3);
  });

  it('rejects past, inverted and overlong ranges', () => {
    const today = '2026-11-01';
    expect(() =>
      assertValidLoanRange('2026-10-31', '2026-11-02', today),
    ).toThrow();
    expect(() =>
      assertValidLoanRange('2026-11-05', '2026-11-02', today),
    ).toThrow();
    expect(() =>
      assertValidLoanRange('2026-11-01', '2026-12-15', today),
    ).toThrow();
    expect(() =>
      assertValidLoanRange('2026-11-01', '2026-11-01', today),
    ).not.toThrow();
  });
});

describe('availability', () => {
  const today = '2026-11-10';
  it('is on loan once an approved loan has started, even if late', () => {
    expect(
      availabilityFor(
        [
          {
            status: 'approved',
            startDate: '2026-11-01',
            endDate: '2026-11-05',
          },
        ],
        today,
      ),
    ).toBe('on_loan');
    expect(
      availabilityFor(
        [
          {
            status: 'approved',
            startDate: '2026-11-20',
            endDate: '2026-11-21',
          },
        ],
        today,
      ),
    ).toBe('available');
    expect(
      availabilityFor(
        [
          {
            status: 'returned',
            startDate: '2026-11-01',
            endDate: '2026-11-05',
          },
        ],
        today,
      ),
    ).toBe('available');
  });

  it('flags approved loans past their end date as overdue', () => {
    expect(
      isOverdue(
        { status: 'approved', startDate: '2026-11-01', endDate: '2026-11-09' },
        today,
      ),
    ).toBe(true);
    expect(
      isOverdue(
        { status: 'approved', startDate: '2026-11-01', endDate: '2026-11-10' },
        today,
      ),
    ).toBe(false);
    expect(
      isOverdue(
        { status: 'returned', startDate: '2026-11-01', endDate: '2026-11-09' },
        today,
      ),
    ).toBe(false);
  });
});

describe('request events', () => {
  it('carries only what the notification needs', () => {
    const payload = buildRequestEvent({
      type: 'loan.approved',
      loan: {
        _id: 'loan1' as Id<'loans'>,
        startDate: '2026-11-02',
        endDate: '2026-11-03',
      },
      tool: { name: 'Drill' },
      recipient: { name: 'Tom Hughes', email: 'tom@example.com' },
      now: Date.UTC(2026, 10, 1),
    });
    expect(payload).toEqual({
      eventId: 'loan1:loan.approved',
      type: 'loan.approved',
      occurredAt: '2026-11-01T00:00:00.000Z',
      loanId: 'loan1',
      recipient: { firstName: 'Tom', email: 'tom@example.com' },
      tool: { name: 'Drill' },
      dates: { start: '2026-11-02', end: '2026-11-03' },
    });
  });

  it('notifies the lender of new requests and the borrower of decisions', () => {
    expect(RECIPIENT_FOR['loan.requested']).toBe('lender');
    expect(RECIPIENT_FOR['loan.approved']).toBe('borrower');
    expect(RECIPIENT_FOR['loan.declined']).toBe('borrower');
  });
});

describe('admin bootstrap', () => {
  it('needs a verified email on the allow list', () => {
    expect(
      shouldBootstrapAdmin('Ops@Example.com', true, 'ops@example.com, x@y.z'),
    ).toBe(true);
    expect(
      shouldBootstrapAdmin('ops@example.com', false, 'ops@example.com'),
    ).toBe(false);
    expect(shouldBootstrapAdmin('ops@example.com', true, undefined)).toBe(
      false,
    );
    expect(
      shouldBootstrapAdmin('me@example.com', true, 'ops@example.com'),
    ).toBe(false);
  });
});

describe('reminder write-back input', () => {
  it('accepts a valid body', () => {
    expect(
      parseReminderInput(
        JSON.stringify({
          loanId: 'k1',
          reminderDate: '2026-11-01',
          status: 'sent',
          channel: 'email',
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        loanId: 'k1',
        reminderDate: '2026-11-01',
        status: 'sent',
        channel: 'email',
      },
    });
  });

  it('rejects anything unexpected', () => {
    expect(parseReminderInput('not json')).toEqual({
      ok: false,
      error: 'INVALID_JSON',
    });
    expect(
      parseReminderInput(
        '{"loanId":"k1","reminderDate":"2026-13-01","status":"sent"}',
      ),
    ).toEqual({ ok: false, error: 'INVALID_REMINDER_DATE' });
    expect(
      parseReminderInput(
        '{"loanId":"k1","reminderDate":"2026-11-01","status":"done"}',
      ),
    ).toEqual({ ok: false, error: 'INVALID_STATUS' });
    expect(
      parseReminderInput(
        '{"loanId":"k1","reminderDate":"2026-11-01","status":"sent","channel":"<script>"}',
      ),
    ).toEqual({ ok: false, error: 'INVALID_CHANNEL' });
  });
});
