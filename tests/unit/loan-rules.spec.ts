import { describe, expect, it } from 'vitest';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import {
  clashingPendingRequests,
  EVENT_FOR_STATUS,
  hasApprovedOverlap,
  hasPendingRequestFrom,
} from '../../convex/modules/loans/loan.rules';

const ben = 'users_ben' as Id<'users'>;
const ada = 'users_ada' as Id<'users'>;

const loan = (
  id: string,
  status: Doc<'loans'>['status'],
  startDate: string,
  endDate: string,
  borrowerId = ben,
) =>
  ({
    _id: id as Id<'loans'>,
    _creationTime: 0,
    toolId: 'tools_drill' as Id<'tools'>,
    lenderId: 'users_lena' as Id<'users'>,
    borrowerId,
    startDate,
    endDate,
    status,
  }) satisfies Doc<'loans'>;

describe('loan rules', () => {
  it('only counts approved loans as blocking dates', () => {
    const loans = [
      loan('l1', 'pending', '2026-11-02', '2026-11-04'),
      loan('l2', 'returned', '2026-11-02', '2026-11-04'),
    ];
    const range = { startDate: '2026-11-03', endDate: '2026-11-05' };
    expect(hasApprovedOverlap(loans, range)).toBe(false);
    loans.push(loan('l3', 'approved', '2026-11-05', '2026-11-06'));
    expect(hasApprovedOverlap(loans, range)).toBe(true);
    expect(hasApprovedOverlap(loans, range, 'l3' as Id<'loans'>)).toBe(false);
  });

  it('spots a pending request from the same borrower only', () => {
    const loans = [loan('l1', 'pending', '2026-11-02', '2026-11-04', ada)];
    expect(hasPendingRequestFrom(loans, ben)).toBe(false);
    expect(hasPendingRequestFrom(loans, ada)).toBe(true);
  });

  it('finds pending requests that clash with an approval', () => {
    const approved = loan('a', 'approved', '2026-11-03', '2026-11-05');
    const loans = [
      approved,
      loan('clash', 'pending', '2026-11-05', '2026-11-07', ada),
      loan('later', 'pending', '2026-11-06', '2026-11-07', ada),
      loan('done', 'declined', '2026-11-04', '2026-11-04', ada),
    ];
    expect(clashingPendingRequests(loans, approved).map((l) => l._id)).toEqual([
      'clash',
    ]);
  });

  it('raises a notification for every decision but not for pending', () => {
    expect(EVENT_FOR_STATUS.pending).toBeUndefined();
    expect(EVENT_FOR_STATUS.approved).toBe('loan.approved');
    expect(EVENT_FOR_STATUS.returned).toBe('loan.returned');
  });
});
