import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';

export type LoanView = FunctionReturnType<typeof api.loans.mine>[number];
export type LoanActivity = LoanView['activity'][number];
