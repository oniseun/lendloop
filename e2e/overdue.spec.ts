import { expect, test } from '@playwright/test';
import { sessionFor } from './support/auth';
import { runFixture } from './support/convex';
import {
  claimReminder,
  fetchOverdue,
  hasN8nSecret,
  recordReminder,
} from './support/n8n';
import { cardFor, isoDay, runId } from './support/ui';
import { emailFor } from './support/users';

// The overdue reminder contract n8n relies on: an overdue loan is
// listed, the first claim wins, a second claim the same day is refused,
// the write-back shows on the loan and the loan drops off the list.

const ladder = `E2E Ladder ${runId()}`;

test.describe.configure({ mode: 'serial' });
test.skip(!hasN8nSecret(), 'E2E_N8N_TO_CONVEX_SECRET not set');

test('overdue loan gets exactly one reminder per day', async ({ browser }) => {
  // Both users must exist in Convex before the fixture can link them.
  const { page: lenderPage } = await sessionFor(browser, 'lender');
  const { page } = await sessionFor(browser, 'borrower');

  const { loanId } = runFixture<{ loanId: string }>('createOverdueLoan', {
    lenderEmail: emailFor('lender'),
    borrowerEmail: emailFor('borrower'),
    toolName: ladder,
    daysOverdue: 2,
  });

  await page.getByRole('link', { name: 'My requests' }).click();
  const card = cardFor(page, ladder);
  await expect(card.getByText('Overdue')).toBeVisible();

  const today = isoDay(0);
  const listed = await fetchOverdue();
  expect(listed.status).toBe(200);
  const entry = listed.json.data.loans.find(
    (loan: { loanId: string }) => loan.loanId === loanId,
  );
  expect(entry).toMatchObject({
    daysOverdue: 2,
    tool: { name: ladder },
    borrower: { firstName: 'Ben', email: emailFor('borrower') },
  });

  const first = await claimReminder(loanId, today);
  expect(first.json.data).toEqual({ claimed: true });
  // Signatures carry a seconds timestamp; a new one is a new request.
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const second = await claimReminder(loanId, today);
  expect(second.json).toMatchObject({
    message: 'ALREADY_CLAIMED',
    data: { claimed: false },
  });
  await expect(card.getByText(/Reminder queued/)).toBeVisible();

  // The claim row is updated to sent; a late "failed" can't undo it.
  const written = await recordReminder(loanId, today, 'sent');
  expect(written.json.message).toBe('UPDATED');
  await expect(card.getByText(/Reminder sent/)).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const late = await recordReminder(loanId, today, 'failed');
  expect(late.json.message).toBe('UNCHANGED');

  // Done for today: no longer handed to n8n.
  const after = await fetchOverdue();
  expect(
    after.json.data.loans.some(
      (loan: { loanId: string }) => loan.loanId === loanId,
    ),
  ).toBe(false);

  // The lender sees the same overdue loan from their side.
  await lenderPage.getByRole('link', { name: 'Incoming' }).click();
  await expect(cardFor(lenderPage, ladder).getByText('Overdue')).toBeVisible();

  await page.context().close();
  await lenderPage.context().close();
});
