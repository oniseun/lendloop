import { describe, expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import {
  assertLoanAction,
  canEditTool,
  canPerformLoanAction,
  canRemoveTool,
  canRequestTool,
  canTransition,
  canViewLoan,
  type Actor,
} from '../../convex/lib/permissions';

const id = (value: string) => value as Id<'users'>;
const owner: Actor = { _id: id('owner'), role: 'user' };
const borrower: Actor = { _id: id('borrower'), role: 'user' };
const stranger: Actor = { _id: id('stranger'), role: 'user' };
const admin: Actor = { _id: id('admin'), role: 'admin' };

const tool = { ownerId: owner._id, removedAt: undefined };
const removedTool = { ownerId: owner._id, removedAt: 1 };
const loan = (status: 'pending' | 'approved' | 'returned' = 'pending') => ({
  lenderId: owner._id,
  borrowerId: borrower._id,
  status,
});

describe('tool permissions', () => {
  it('only the owner can edit a listing', () => {
    expect(canEditTool(owner, tool)).toBe(true);
    expect(canEditTool(stranger, tool)).toBe(false);
    expect(canEditTool(admin, tool)).toBe(false);
  });

  it('owner and admin can remove, nobody else', () => {
    expect(canRemoveTool(owner, tool)).toBe(true);
    expect(canRemoveTool(admin, tool)).toBe(true);
    expect(canRemoveTool(stranger, tool)).toBe(false);
  });

  it('removed listings cannot be edited, removed or requested', () => {
    expect(canEditTool(owner, removedTool)).toBe(false);
    expect(canRemoveTool(admin, removedTool)).toBe(false);
    expect(canRequestTool(borrower, removedTool)).toBe(false);
  });

  it('owners cannot borrow their own tool', () => {
    expect(canRequestTool(owner, tool)).toBe(false);
    expect(canRequestTool(borrower, tool)).toBe(true);
  });
});

describe('loan permissions', () => {
  it('parties and admins can view a loan', () => {
    expect(canViewLoan(owner, loan())).toBe(true);
    expect(canViewLoan(borrower, loan())).toBe(true);
    expect(canViewLoan(admin, loan())).toBe(true);
    expect(canViewLoan(stranger, loan())).toBe(false);
  });

  it('only the lender approves, declines and marks returned', () => {
    expect(canPerformLoanAction(owner, loan(), 'approve')).toBe(true);
    expect(canPerformLoanAction(owner, loan(), 'decline')).toBe(true);
    expect(canPerformLoanAction(owner, loan('approved'), 'return')).toBe(true);
    for (const actor of [borrower, stranger, admin]) {
      expect(canPerformLoanAction(actor, loan(), 'approve')).toBe(false);
      expect(canPerformLoanAction(actor, loan('approved'), 'return')).toBe(
        false,
      );
    }
  });

  it('only the borrower cancels', () => {
    expect(canPerformLoanAction(borrower, loan(), 'cancel')).toBe(true);
    expect(canPerformLoanAction(owner, loan(), 'cancel')).toBe(false);
  });

  it('follows the status machine', () => {
    expect(canTransition('pending', 'approved')).toBe(true);
    expect(canTransition('approved', 'returned')).toBe(true);
    expect(canTransition('pending', 'returned')).toBe(false);
    expect(canTransition('returned', 'approved')).toBe(false);
    expect(canTransition('declined', 'approved')).toBe(false);
  });

  it('assertLoanAction separates "not yours" from "wrong state"', () => {
    expect(() => assertLoanAction(stranger, loan(), 'approve')).toThrow(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
    expect(() => assertLoanAction(owner, loan('returned'), 'approve')).toThrow(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_LOAN_TRANSITION' }),
      }),
    );
    expect(assertLoanAction(owner, loan(), 'approve')).toBe('approved');
  });
});
