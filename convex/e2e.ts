import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { toIsoDate } from './lib/dates';
import { appError, ErrorCode } from './lib/errors';
import { createLogger } from './lib/logger';
import { loanRepository } from './modules/loans/loan.repository';
import { toolRepository } from './modules/tools/tool.repository';
import { userRepository } from './modules/users/user.repository';

// Test fixtures for the Playwright suite (e2e/). Internal functions, so
// no browser can call them; run only through `npx convex run` with the
// deployment's admin credentials. They also refuse to run unless the
// deployment has E2E_FIXTURES=true, which is never set in production.

const logger = createLogger('e2e');
const DAY_MS = 24 * 60 * 60 * 1000;

const assertFixturesEnabled = () => {
  if (process.env.E2E_FIXTURES !== 'true') {
    throw appError(ErrorCode.FORBIDDEN, 'E2E fixtures are disabled');
  }
};

// The UI can't create a loan in the past, so the overdue spec gets one
// from here: a tool owned by the lender, lent to the borrower, due
// `daysOverdue` days ago.
export const createOverdueLoan = internalMutation({
  args: {
    lenderEmail: v.string(),
    borrowerEmail: v.string(),
    toolName: v.string(),
    daysOverdue: v.number(),
  },
  handler: async (ctx, args) => {
    assertFixturesEnabled();
    const [lender, borrower] = await Promise.all([
      userRepository.findByEmail(ctx, args.lenderEmail),
      userRepository.findByEmail(ctx, args.borrowerEmail),
    ]);
    if (!lender || !borrower) {
      throw appError(
        ErrorCode.USER_NOT_FOUND,
        'Sign both users in once before creating fixtures',
      );
    }
    const day = (offset: number) =>
      toIsoDate(new Date(Date.now() + offset * DAY_MS));

    const toolId = await toolRepository.insert(ctx, {
      ownerId: lender._id,
      name: args.toolName,
      category: 'hand_tools',
      condition: 'good',
      description: 'Created by the e2e overdue fixture.',
    });
    const loanId = await loanRepository.insert(ctx, {
      toolId,
      lenderId: lender._id,
      borrowerId: borrower._id,
      startDate: day(-(args.daysOverdue + 3)),
      endDate: day(-args.daysOverdue),
      status: 'approved',
      decidedAt: Date.now(),
    });
    logger.info('overdue fixture created', { loanId, toolId });
    return { loanId, toolId };
  },
});
