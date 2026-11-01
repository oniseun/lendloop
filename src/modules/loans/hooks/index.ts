'use client';

import { useMutation, useQuery } from 'convex/react';
import { loanApi } from '../api/loan.api';

export const useMyRequests = () => useQuery(loanApi.mine, {});

export const useIncomingRequests = () => useQuery(loanApi.incoming, {});

export const useRequestLoan = () => useMutation(loanApi.request);

export const useLoanActions = () => ({
  approve: useMutation(loanApi.approve),
  decline: useMutation(loanApi.decline),
  cancel: useMutation(loanApi.cancel),
  markReturned: useMutation(loanApi.markReturned),
});
