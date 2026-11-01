import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { LoanStatus } from '../../lib/constants';

// Data access for the loans table.

type NewLoan = Omit<Doc<'loans'>, '_id' | '_creationTime'>;
type LoanPatch = Partial<Omit<NewLoan, 'toolId' | 'lenderId' | 'borrowerId'>>;

export const loanRepository = {
  getById: (ctx: QueryCtx, loanId: Id<'loans'>) => ctx.db.get(loanId),

  // Accepts an untrusted string id (e.g. from an n8n payload).
  findByRawId: async (ctx: QueryCtx, rawId: string) => {
    const loanId = ctx.db.normalizeId('loans', rawId);
    return loanId ? ctx.db.get(loanId) : null;
  },

  listByTool: (ctx: QueryCtx, toolId: Id<'tools'>) =>
    ctx.db
      .query('loans')
      .withIndex('by_tool', (q) => q.eq('toolId', toolId))
      .collect(),

  listByBorrower: (ctx: QueryCtx, borrowerId: Id<'users'>) =>
    ctx.db
      .query('loans')
      .withIndex('by_borrower', (q) => q.eq('borrowerId', borrowerId))
      .order('desc')
      .collect(),

  listByLender: (ctx: QueryCtx, lenderId: Id<'users'>) =>
    ctx.db
      .query('loans')
      .withIndex('by_lender', (q) => q.eq('lenderId', lenderId))
      .order('desc')
      .collect(),

  // Filters through the index before limiting, so older matches aren't
  // dropped.
  listRecent: (ctx: QueryCtx, limit: number, status?: LoanStatus) =>
    status
      ? ctx.db
          .query('loans')
          .withIndex('by_status_end', (q) => q.eq('status', status))
          .order('desc')
          .take(limit)
      : ctx.db.query('loans').order('desc').take(limit),

  // Approved loans whose end date is before `today`, streamed so callers
  // can stop early.
  streamApprovedEndingBefore: (ctx: QueryCtx, today: string) =>
    ctx.db
      .query('loans')
      .withIndex('by_status_end', (q) =>
        q.eq('status', 'approved').lt('endDate', today),
      ),

  insert: (ctx: MutationCtx, loan: NewLoan) => ctx.db.insert('loans', loan),

  patch: (ctx: MutationCtx, loanId: Id<'loans'>, patch: LoanPatch) =>
    ctx.db.patch(loanId, patch),
};
