import { v } from 'convex/values';
import type { Doc, Id } from '../../_generated/dataModel';
import type { ActivityDto } from '../automation/automation.dto';
import { toNeighbourDto } from '../users/user.dto';
import { isOverdue } from './loan.rules';
import { firstName } from '../../lib/text';

// Request DTOs (Convex validators) and the response shape for a loan.

export const requestLoanArgs = {
  toolId: v.id('tools'),
  startDate: v.string(),
  endDate: v.string(),
  message: v.optional(v.string()),
};

export const loanIdArgs = { loanId: v.id('loans') };

export interface LoanParts {
  loan: Doc<'loans'>;
  tool: Doc<'tools'> | null;
  lender: Doc<'users'> | null;
  borrower: Doc<'users'> | null;
  activity: ActivityDto[];
}

// Shapes a loan for the UI of one of its parties. The other party is
// shown by first name only.
export const toLoanDto = (
  { loan, tool, lender, borrower, activity }: LoanParts,
  viewerId: Id<'users'>,
  today: string,
) => ({
  _id: loan._id,
  _creationTime: loan._creationTime,
  status: loan.status,
  startDate: loan.startDate,
  endDate: loan.endDate,
  message: loan.message ?? null,
  isOverdue: isOverdue(loan, today),
  tool: tool
    ? {
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        isRemoved: Boolean(tool.removedAt),
      }
    : null,
  lender: lender ? toNeighbourDto(lender) : null,
  borrower: borrower ? { firstName: firstName(borrower.name) } : null,
  viewerIsLender: loan.lenderId === viewerId,
  viewerIsBorrower: loan.borrowerId === viewerId,
  activity,
});

export type LoanDto = ReturnType<typeof toLoanDto>;
