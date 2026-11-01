import type { Doc } from '../_generated/dataModel';

export type Availability = 'available' | 'on_loan';

type LoanRef = Pick<Doc<'loans'>, 'status' | 'startDate' | 'endDate'>;

// A tool is out once an approved loan has started and until the lender
// marks it returned, even if the borrower is late.
export const availabilityFor = (loans: LoanRef[], today: string): Availability =>
  loans.some((loan) => loan.status === 'approved' && loan.startDate <= today)
    ? 'on_loan'
    : 'available';

export const isOverdue = (loan: LoanRef, today: string) =>
  loan.status === 'approved' && loan.endDate < today;
