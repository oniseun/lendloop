import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { rangesOverlap } from '../lib/dates';
import type { RequestEventType } from '../lib/events';
import { firstName } from '../lib/text';
import { activityForLoan, enqueueRequestEvent } from './automation';
import { isOverdue } from './availability';

export const loansForTool = (ctx: QueryCtx, toolId: Id<'tools'>) =>
  ctx.db
    .query('loans')
    .withIndex('by_tool', (q) => q.eq('toolId', toolId))
    .collect();

export const hasApprovedOverlap = (
  loans: Doc<'loans'>[],
  range: { startDate: string; endDate: string },
  excludeId?: Id<'loans'>,
) =>
  loans.some(
    (loan) =>
      loan._id !== excludeId &&
      loan.status === 'approved' &&
      rangesOverlap(loan, range),
  );

const EVENT_FOR: Partial<Record<Doc<'loans'>['status'], RequestEventType>> = {
  approved: 'loan.approved',
  declined: 'loan.declined',
  cancelled: 'loan.cancelled',
  returned: 'loan.returned',
};

export const setLoanStatus = async (
  ctx: MutationCtx,
  loan: Doc<'loans'>,
  status: Doc<'loans'>['status'],
) => {
  const now = Date.now();
  await ctx.db.patch(loan._id, {
    status,
    ...(status === 'returned' ? { returnedAt: now } : { decidedAt: now }),
  });
  const event = EVENT_FOR[status];
  if (event) await enqueueRequestEvent(ctx, { ...loan, status }, event);
};

// Shapes a loan for the UI of one of its parties. The other party is
// shown by first name only.
export const presentLoan = async (
  ctx: QueryCtx,
  loan: Doc<'loans'>,
  viewerId: Id<'users'>,
  today: string,
) => {
  const [tool, lender, borrower, activity] = await Promise.all([
    ctx.db.get(loan.toolId),
    ctx.db.get(loan.lenderId),
    ctx.db.get(loan.borrowerId),
    activityForLoan(ctx, loan._id),
  ]);
  return {
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
    lender: lender
      ? {
          firstName: firstName(lender.name),
          isTrustedLender: lender.isTrustedLender,
        }
      : null,
    borrower: borrower ? { firstName: firstName(borrower.name) } : null,
    viewerIsLender: loan.lenderId === viewerId,
    viewerIsBorrower: loan.borrowerId === viewerId,
    activity,
  };
};

export type PresentedLoan = Awaited<ReturnType<typeof presentLoan>>;
