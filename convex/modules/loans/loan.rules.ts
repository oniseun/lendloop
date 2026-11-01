import type { Doc, Id } from '../../_generated/dataModel';
import { rangesOverlap } from '../../lib/dates';
import type { RequestEventType } from '../../lib/events';

// Pure domain rules for loans and tool availability. No database, no
// Convex context: unit tested directly.

export type Availability = 'available' | 'on_loan';

type LoanDates = Pick<Doc<'loans'>, 'status' | 'startDate' | 'endDate'>;
type DateRange = { startDate: string; endDate: string };

// A tool is out once an approved loan has started and until the lender
// marks it returned, even if the borrower is late.
export const availabilityFor = (
  loans: LoanDates[],
  today: string,
): Availability =>
  loans.some((loan) => loan.status === 'approved' && loan.startDate <= today)
    ? 'on_loan'
    : 'available';

export const isOverdue = (loan: LoanDates, today: string) =>
  loan.status === 'approved' && loan.endDate < today;

export const hasApprovedOverlap = (
  loans: Doc<'loans'>[],
  range: DateRange,
  excludeId?: Id<'loans'>,
) =>
  loans.some(
    (loan) =>
      loan._id !== excludeId &&
      loan.status === 'approved' &&
      rangesOverlap(loan, range),
  );

export const hasPendingRequestFrom = (
  loans: Doc<'loans'>[],
  borrowerId: Id<'users'>,
) =>
  loans.some(
    (loan) => loan.borrowerId === borrowerId && loan.status === 'pending',
  );

// The tool can't be in two places: pending requests that overlap an
// approved loan are declined.
export const clashingPendingRequests = (
  loans: Doc<'loans'>[],
  approved: Doc<'loans'>,
) =>
  loans.filter(
    (other) =>
      other._id !== approved._id &&
      other.status === 'pending' &&
      rangesOverlap(other, approved),
  );

// Which notification each status change raises.
export const EVENT_FOR_STATUS: Partial<
  Record<Doc<'loans'>['status'], RequestEventType>
> = {
  approved: 'loan.approved',
  declined: 'loan.declined',
  cancelled: 'loan.cancelled',
  returned: 'loan.returned',
};
