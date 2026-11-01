import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { LOAN_MESSAGE_MAX } from './lib/constants';
import { assertValidLoanRange, rangesOverlap, todayIso } from './lib/dates';
import { appError, ErrorCode } from './lib/errors';
import { userMutation, userQuery } from './lib/functions';
import { createLogger } from './lib/logger';
import {
  assertLoanAction,
  canRequestTool,
  type Actor,
  type LoanAction,
} from './lib/permissions';
import { cleanText } from './lib/text';
import { enqueueRequestEvent } from './model/automation';
import {
  hasApprovedOverlap,
  loansForTool,
  presentLoan,
  setLoanStatus,
} from './model/loans';

const logger = createLogger('loans');

export const request = userMutation({
  args: {
    toolId: v.id('tools'),
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { toolId, startDate, endDate, message }) => {
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.removedAt) {
      throw appError(ErrorCode.TOOL_NOT_FOUND, 'Tool not found');
    }
    if (!canRequestTool(ctx.user, tool)) {
      throw appError(ErrorCode.FORBIDDEN, 'You cannot borrow your own tool');
    }
    assertValidLoanRange(startDate, endDate, todayIso());

    const loans = await loansForTool(ctx, toolId);
    if (hasApprovedOverlap(loans, { startDate, endDate })) {
      throw appError(
        ErrorCode.DATES_UNAVAILABLE,
        'The tool is already booked for some of those dates',
      );
    }
    const duplicate = loans.some(
      (loan) => loan.borrowerId === ctx.user._id && loan.status === 'pending',
    );
    if (duplicate) {
      throw appError(
        ErrorCode.DUPLICATE_REQUEST,
        'You already have a pending request for this tool',
      );
    }

    const loanId = await ctx.db.insert('loans', {
      toolId,
      lenderId: tool.ownerId,
      borrowerId: ctx.user._id,
      startDate,
      endDate,
      message: message
        ? cleanText(message, { field: 'Message', max: LOAN_MESSAGE_MAX })
        : undefined,
      status: 'pending',
    });
    const loan = (await ctx.db.get(loanId))!;
    await enqueueRequestEvent(ctx, loan, 'loan.requested');
    logger.info('loan requested', { loanId, toolId, userId: ctx.user._id });
    return loanId;
  },
});

const applyAction = async (
  ctx: MutationCtx & { user: Actor },
  loanId: Id<'loans'>,
  action: LoanAction,
) => {
  const loan = await ctx.db.get(loanId);
  if (!loan) throw appError(ErrorCode.LOAN_NOT_FOUND, 'Request not found');

  let next;
  try {
    next = assertLoanAction(ctx.user, loan, action);
  } catch (error) {
    logger.warn('loan action rejected', {
      loanId,
      action,
      userId: ctx.user._id,
    });
    throw error;
  }

  if (action === 'approve') {
    const loans = await loansForTool(ctx, loan.toolId);
    if (hasApprovedOverlap(loans, loan, loan._id)) {
      throw appError(
        ErrorCode.DATES_UNAVAILABLE,
        'Another approved loan overlaps these dates',
      );
    }
    await setLoanStatus(ctx, loan, next);
    // The tool can't be in two places: decline pending requests that
    // overlap the one just approved.
    const clashing = loans.filter(
      (other) =>
        other._id !== loan._id &&
        other.status === 'pending' &&
        rangesOverlap(other, loan),
    );
    for (const other of clashing) await setLoanStatus(ctx, other, 'declined');
  } else {
    await setLoanStatus(ctx, loan, next);
  }

  logger.info('loan updated', { loanId, action, status: next });
};

export const approve = userMutation({
  args: { loanId: v.id('loans') },
  handler: (ctx, { loanId }) => applyAction(ctx, loanId, 'approve'),
});

export const decline = userMutation({
  args: { loanId: v.id('loans') },
  handler: (ctx, { loanId }) => applyAction(ctx, loanId, 'decline'),
});

export const cancel = userMutation({
  args: { loanId: v.id('loans') },
  handler: (ctx, { loanId }) => applyAction(ctx, loanId, 'cancel'),
});

export const markReturned = userMutation({
  args: { loanId: v.id('loans') },
  handler: (ctx, { loanId }) => applyAction(ctx, loanId, 'return'),
});

// "My requests": things I asked to borrow.
export const mine = userQuery({
  args: {},
  handler: async (ctx) => {
    const today = todayIso();
    const loans = await ctx.db
      .query('loans')
      .withIndex('by_borrower', (q) => q.eq('borrowerId', ctx.user._id))
      .order('desc')
      .collect();
    return Promise.all(
      loans.map((loan) => presentLoan(ctx, loan, ctx.user._id, today)),
    );
  },
});

// "Incoming requests": requests on tools I own.
export const incoming = userQuery({
  args: {},
  handler: async (ctx) => {
    const today = todayIso();
    const loans = await ctx.db
      .query('loans')
      .withIndex('by_lender', (q) => q.eq('lenderId', ctx.user._id))
      .order('desc')
      .collect();
    return Promise.all(
      loans.map((loan) => presentLoan(ctx, loan, ctx.user._id, today)),
    );
  },
});
