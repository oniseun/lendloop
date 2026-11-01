import { api } from '@convex/_generated/api';

// Convex function references for the loans module.
export const loanApi = {
  request: api.loans.request,
  approve: api.loans.approve,
  decline: api.loans.decline,
  cancel: api.loans.cancel,
  markReturned: api.loans.markReturned,
  mine: api.loans.mine,
  incoming: api.loans.incoming,
};
