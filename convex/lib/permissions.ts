import type { Doc, Id } from '../_generated/dataModel';
import type { LoanStatus } from './constants';
import { appError, ErrorCode } from './errors';

// Pure policy checks. Every Convex function that reads or changes
// data goes through one of these, so the rules live in one place and
// can be unit tested without a database.

export type Actor = Pick<Doc<'users'>, '_id' | 'role'>;
type ToolRef = Pick<Doc<'tools'>, 'ownerId' | 'removedAt'>;
type LoanRef = Pick<Doc<'loans'>, 'lenderId' | 'borrowerId' | 'status'>;

export const isAdmin = (actor: Actor) => actor.role === 'admin';

const isSame = (a: Id<'users'>, b: Id<'users'>) => a === b;

export const canEditTool = (actor: Actor, tool: ToolRef) =>
  !tool.removedAt && isSame(actor._id, tool.ownerId);

// Owners can delete their own listing; admins can remove any listing.
export const canRemoveTool = (actor: Actor, tool: ToolRef) =>
  !tool.removedAt && (isSame(actor._id, tool.ownerId) || isAdmin(actor));

export const canRequestTool = (actor: Actor, tool: ToolRef) =>
  !tool.removedAt && !isSame(actor._id, tool.ownerId);

export const canViewLoan = (actor: Actor, loan: LoanRef) =>
  isAdmin(actor) ||
  isSame(actor._id, loan.lenderId) ||
  isSame(actor._id, loan.borrowerId);

// Approve / decline / mark returned: only the owner of the tool.
// Admins can see every loan but do not act on other people's lending.
export const canActAsLender = (actor: Actor, loan: LoanRef) =>
  isSame(actor._id, loan.lenderId);

export const canActAsBorrower = (actor: Actor, loan: LoanRef) =>
  isSame(actor._id, loan.borrowerId);

export const LOAN_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  pending: ['approved', 'declined', 'cancelled'],
  approved: ['returned'],
  declined: [],
  cancelled: [],
  returned: [],
};

export const canTransition = (from: LoanStatus, to: LoanStatus) =>
  LOAN_TRANSITIONS[from].includes(to);

export type LoanAction = 'approve' | 'decline' | 'cancel' | 'return';

const ACTION_TARGET: Record<LoanAction, LoanStatus> = {
  approve: 'approved',
  decline: 'declined',
  cancel: 'cancelled',
  return: 'returned',
};

const ACTION_ROLE: Record<LoanAction, 'lender' | 'borrower'> = {
  approve: 'lender',
  decline: 'lender',
  cancel: 'borrower',
  return: 'lender',
};

export const canPerformLoanAction = (
  actor: Actor,
  loan: LoanRef,
  action: LoanAction,
) => {
  const allowedParty =
    ACTION_ROLE[action] === 'lender'
      ? canActAsLender(actor, loan)
      : canActAsBorrower(actor, loan);
  return allowedParty && canTransition(loan.status, ACTION_TARGET[action]);
};

// Throws the right error so callers can tell "not yours" from
// "wrong state". Returns the next status.
export const assertLoanAction = (
  actor: Actor,
  loan: LoanRef,
  action: LoanAction,
): LoanStatus => {
  const isParty =
    ACTION_ROLE[action] === 'lender'
      ? canActAsLender(actor, loan)
      : canActAsBorrower(actor, loan);
  if (!isParty) {
    throw appError(ErrorCode.FORBIDDEN, 'You cannot act on this request');
  }
  const next = ACTION_TARGET[action];
  if (!canTransition(loan.status, next)) {
    throw appError(
      ErrorCode.INVALID_LOAN_TRANSITION,
      `Cannot ${action} a ${loan.status} request`,
    );
  }
  return next;
};
