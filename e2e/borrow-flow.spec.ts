import { expect, test, type Page } from '@playwright/test';
import { sessionFor } from './support/auth';
import { findEmail, mailpitUrl } from './support/mailpit';
import { cardFor, isoDay, runId } from './support/ui';
import { emailFor } from './support/users';

// One loan from listing to return, with both people signed in side by
// side: lender lists, borrower requests, lender approves, lender marks
// returned. A second request is declined.

const id = runId();
const drill = `E2E Drill ${id}`;
const sander = `E2E Sander ${id}`;

let lender: Page;
let borrower: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  lender = (await sessionFor(browser, 'lender')).page;
  borrower = (await sessionFor(browser, 'borrower')).page;
});

test.afterAll(async () => {
  await lender?.context().close();
  await borrower?.context().close();
});

const listTool = async (page: Page, name: string) => {
  await page.getByRole('link', { name: 'My listings' }).click();
  await page.getByRole('button', { name: 'List a tool' }).click();
  const dialog = page.getByRole('dialog', { name: 'List a tool' });
  await dialog.getByLabel('Name').fill(name);
  await dialog
    .getByLabel('Short description')
    .fill('Charged, with spare bits.');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(cardFor(page, name)).toBeVisible();
};

const requestTool = async (page: Page, name: string, note: string) => {
  await page.getByRole('link', { name: 'Board' }).click();
  const card = cardFor(page, name);
  await expect(card.getByText('Available')).toBeVisible();
  await card.getByRole('button', { name: 'Request to borrow' }).click();
  const dialog = page.getByRole('dialog', { name: `Borrow ${name}` });
  await dialog.getByLabel('From').fill(isoDay(0));
  await dialog.getByLabel('Until').fill(isoDay(2));
  await dialog.getByLabel('Note to the owner (optional)').fill(note);
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog).toBeHidden();
  await expect(card.getByRole('button', { name: 'Requested' })).toBeDisabled();
};

test('lender lists two tools', async () => {
  await listTool(lender, drill);
  await listTool(lender, sander);
  // Own listings are marked on the board and can't be borrowed.
  await lender.getByRole('link', { name: 'Board' }).click();
  const own = cardFor(lender, drill);
  await expect(own.getByText('Your listing')).toBeVisible();
  await expect(
    own.getByRole('button', { name: 'Request to borrow' }),
  ).toHaveCount(0);
});

test('borrower requests both tools', async () => {
  await requestTool(borrower, drill, 'Putting up shelves on Saturday.');
  await requestTool(borrower, sander, 'Sanding a door.');

  await borrower.getByRole('link', { name: 'My requests' }).click();
  for (const name of [drill, sander]) {
    const card = cardFor(borrower, name);
    await expect(card.getByText('Pending')).toBeVisible();
    await expect(card.getByText('From Lena')).toBeVisible();
  }
});

test('lender sees the requests and the request notification goes out', async () => {
  await lender.getByRole('link', { name: 'Incoming' }).click();
  const card = cardFor(lender, drill);
  await expect(card.getByText('Requested by Ben')).toBeVisible();
  await expect(card.getByText('Putting up shelves on Saturday.')).toBeVisible();

  test.skip(!mailpitUrl(), 'E2E_MAILPIT_URL not set: n8n email not checked');
  await expect(card.getByText(/Notification sent/)).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(() => findEmail(emailFor('lender'), drill), { timeout: 30_000 })
    .toMatchObject({ Subject: `New request for your ${drill}` });
});

test('lender approves one request and declines the other', async () => {
  await lender.getByRole('link', { name: 'Incoming' }).click();
  const drillCard = cardFor(lender, drill);
  await drillCard.getByRole('button', { name: 'Approve' }).click();
  await expect(drillCard.getByText('Approved')).toBeVisible();

  const sanderCard = cardFor(lender, sander);
  await sanderCard.getByRole('button', { name: 'Decline' }).click();
  await expect(sanderCard.getByText('Declined')).toBeVisible();

  await borrower.getByRole('link', { name: 'My requests' }).click();
  await expect(cardFor(borrower, drill).getByText('Approved')).toBeVisible();
  await expect(cardFor(borrower, sander).getByText('Declined')).toBeVisible();

  // Out on loan from today, so the board shows it as unavailable.
  await borrower.getByRole('link', { name: 'Board' }).click();
  await expect(cardFor(borrower, drill).getByText('On loan')).toBeVisible();
});

test('borrower cannot act on the lender side', async () => {
  await borrower.getByRole('link', { name: 'My requests' }).click();
  const card = cardFor(borrower, drill);
  await expect(card.getByRole('button', { name: 'Mark returned' })).toHaveCount(
    0,
  );
  await expect(card.getByRole('button', { name: 'Approve' })).toHaveCount(0);
});

test('lender marks the tool returned and it is available again', async () => {
  await lender.getByRole('link', { name: 'Incoming' }).click();
  const card = cardFor(lender, drill);
  await card.getByRole('button', { name: 'Mark returned' }).click();
  await expect(card.getByText('Returned')).toBeVisible();

  await borrower.getByRole('link', { name: 'Board' }).click();
  await expect(cardFor(borrower, drill).getByText('Available')).toBeVisible();
});
