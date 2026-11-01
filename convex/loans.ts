import { userMutation, userQuery } from './lib/functions';
import { loanIdArgs, requestLoanArgs } from './modules/loans/loan.dto';
import {
  applyLoanAction,
  listBorrowerLoans,
  listLenderLoans,
  requestLoan,
} from './modules/loans/loan.service';

// Controller for loans: validates arguments (DTOs), resolves the
// signed-in user (userMutation / userQuery act as the auth guard) and
// hands over to the service.

export const request = userMutation({
  args: requestLoanArgs,
  handler: (ctx, args) => requestLoan(ctx, ctx.user, args),
});

export const approve = userMutation({
  args: loanIdArgs,
  handler: (ctx, { loanId }) =>
    applyLoanAction(ctx, ctx.user, loanId, 'approve'),
});

export const decline = userMutation({
  args: loanIdArgs,
  handler: (ctx, { loanId }) =>
    applyLoanAction(ctx, ctx.user, loanId, 'decline'),
});

export const cancel = userMutation({
  args: loanIdArgs,
  handler: (ctx, { loanId }) =>
    applyLoanAction(ctx, ctx.user, loanId, 'cancel'),
});

export const markReturned = userMutation({
  args: loanIdArgs,
  handler: (ctx, { loanId }) =>
    applyLoanAction(ctx, ctx.user, loanId, 'return'),
});

export const mine = userQuery({
  args: {},
  handler: (ctx) => listBorrowerLoans(ctx, ctx.user),
});

export const incoming = userQuery({
  args: {},
  handler: (ctx) => listLenderLoans(ctx, ctx.user),
});
