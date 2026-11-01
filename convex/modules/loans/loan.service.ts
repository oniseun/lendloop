import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { LOAN_MESSAGE_MAX, type LoanStatus } from '../../lib/constants';
import { assertValidLoanRange, todayIso } from '../../lib/dates';
import { appError, ErrorCode } from '../../lib/errors';
import { createLogger } from '../../lib/logger';
import {
  assertLoanAction,
  canRequestTool,
  type Actor,
  type LoanAction,
} from '../../lib/permissions';
import { cleanText } from '../../lib/text';
import {
  activityForLoan,
  enqueueRequestEvent,
} from '../automation/automation.service';
import { toolRepository } from '../tools/tool.repository';
import { userRepository } from '../users/user.repository';
import { toLoanDto, type LoanDto } from './loan.dto';
import { loanRepository } from './loan.repository';
import {
  clashingPendingRequests,
  EVENT_FOR_STATUS,
  hasApprovedOverlap,
  hasPendingRequestFrom,
} from './loan.rules';

const logger = createLogger('loans');

export interface RequestLoanInput {
  toolId: Id<'tools'>;
  startDate: string;
  endDate: string;
  message?: string;
}

export const requestLoan = async (
  ctx: MutationCtx,
  actor: Actor,
  input: RequestLoanInput,
) => {
  const { toolId, startDate, endDate, message } = input;
  const tool = await toolRepository.getActiveById(ctx, toolId);
  if (!tool) throw appError(ErrorCode.TOOL_NOT_FOUND, 'Tool not found');
  if (!canRequestTool(actor, tool)) {
    throw appError(ErrorCode.FORBIDDEN, 'You cannot borrow your own tool');
  }
  assertValidLoanRange(startDate, endDate, todayIso());

  const loans = await loanRepository.listByTool(ctx, toolId);
  if (hasApprovedOverlap(loans, { startDate, endDate })) {
    throw appError(
      ErrorCode.DATES_UNAVAILABLE,
      'The tool is already booked for some of those dates',
    );
  }
  if (hasPendingRequestFrom(loans, actor._id)) {
    throw appError(
      ErrorCode.DUPLICATE_REQUEST,
      'You already have a pending request for this tool',
    );
  }

  const loanId = await loanRepository.insert(ctx, {
    toolId,
    lenderId: tool.ownerId,
    borrowerId: actor._id,
    startDate,
    endDate,
    message: message
      ? cleanText(message, { field: 'Message', max: LOAN_MESSAGE_MAX })
      : undefined,
    status: 'pending',
  });
  const loan = (await loanRepository.getById(ctx, loanId))!;
  await enqueueRequestEvent(ctx, loan, 'loan.requested');
  logger.info('loan requested', { loanId, toolId, userId: actor._id });
  return loanId;
};

// Every status change goes through here so the matching notification is
// always queued in the same transaction.
export const setLoanStatus = async (
  ctx: MutationCtx,
  loan: Doc<'loans'>,
  status: LoanStatus,
) => {
  const now = Date.now();
  await loanRepository.patch(ctx, loan._id, {
    status,
    ...(status === 'returned' ? { returnedAt: now } : { decidedAt: now }),
  });
  const event = EVENT_FOR_STATUS[status];
  if (event) await enqueueRequestEvent(ctx, { ...loan, status }, event);
};

export const declinePendingRequests = async (
  ctx: MutationCtx,
  loans: Doc<'loans'>[],
) => {
  for (const loan of loans.filter((item) => item.status === 'pending')) {
    await setLoanStatus(ctx, loan, 'declined');
  }
};

export const applyLoanAction = async (
  ctx: MutationCtx,
  actor: Actor,
  loanId: Id<'loans'>,
  action: LoanAction,
) => {
  const loan = await loanRepository.getById(ctx, loanId);
  if (!loan) throw appError(ErrorCode.LOAN_NOT_FOUND, 'Request not found');

  let next: LoanStatus;
  try {
    next = assertLoanAction(actor, loan, action);
  } catch (error) {
    logger.warn('loan action rejected', { loanId, action, userId: actor._id });
    throw error;
  }

  if (action === 'approve') {
    const loans = await loanRepository.listByTool(ctx, loan.toolId);
    if (hasApprovedOverlap(loans, loan, loan._id)) {
      throw appError(
        ErrorCode.DATES_UNAVAILABLE,
        'Another approved loan overlaps these dates',
      );
    }
    await setLoanStatus(ctx, loan, next);
    for (const other of clashingPendingRequests(loans, loan)) {
      await setLoanStatus(ctx, other, 'declined');
    }
  } else {
    await setLoanStatus(ctx, loan, next);
  }

  logger.info('loan updated', { loanId, action, status: next });
};

const presentLoans = async (
  ctx: QueryCtx,
  loans: Doc<'loans'>[],
  viewerId: Id<'users'>,
): Promise<LoanDto[]> => {
  const today = todayIso();
  return Promise.all(
    loans.map(async (loan) => {
      const [tool, lender, borrower, activity] = await Promise.all([
        toolRepository.getById(ctx, loan.toolId),
        userRepository.getById(ctx, loan.lenderId),
        userRepository.getById(ctx, loan.borrowerId),
        activityForLoan(ctx, loan._id),
      ]);
      return toLoanDto(
        { loan, tool, lender, borrower, activity },
        viewerId,
        today,
      );
    }),
  );
};

// "My requests": things I asked to borrow.
export const listBorrowerLoans = async (ctx: QueryCtx, actor: Actor) =>
  presentLoans(
    ctx,
    await loanRepository.listByBorrower(ctx, actor._id),
    actor._id,
  );

// "Incoming requests": requests on tools I own.
export const listLenderLoans = async (ctx: QueryCtx, actor: Actor) =>
  presentLoans(
    ctx,
    await loanRepository.listByLender(ctx, actor._id),
    actor._id,
  );

export const listAllLoans = async (
  ctx: QueryCtx,
  actor: Actor,
  status?: LoanStatus,
) =>
  presentLoans(
    ctx,
    await loanRepository.listRecent(ctx, 200, status),
    actor._id,
  );
