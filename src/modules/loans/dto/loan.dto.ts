import type { FunctionReturnType } from 'convex/server';
import type { loanApi } from '../api/loan.api';

export type LoanView = FunctionReturnType<typeof loanApi.mine>[number];
export type LoanActivity = LoanView['activity'][number];
