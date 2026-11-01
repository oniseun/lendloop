import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { sessionFor } from './support/auth';
import { runFixture } from './support/convex';
import { findEmail, mailpitUrl } from './support/mailpit';
import { cardFor, isoDay } from './support/ui';
import { emailFor } from './support/users';

// Regenerates docs/screenshots. Not part of the normal suite: needs the
// full local stack (Convex + n8n + Mailpit) and a freshly seeded
// deployment. Run with:
//
//   E2E_SCREENSHOTS=1 \
//   N8N_URL=http://localhost:5678 N8N_EMAIL=... N8N_PASSWORD=... \
//   OVERDUE_RUN_CMD="docker compose exec -T n8n n8n execute --id lendloopOverdueW" \
//   npx playwright test e2e/docs-screenshots.spec.ts

const OUT = process.env.SCREENSHOT_DIR ?? 'docs/screenshots';
const DRILL = 'Bosch cordless drill';
const SANDER = 'Orbital sander';
const LADDER = 'Aluminium step ladder';

test.skip(!process.env.E2E_SCREENSHOTS, 'Set E2E_SCREENSHOTS=1 to run');
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

const shot = async (page: Page, name: string, fullPage = true) => {
  mkdirSync(OUT, { recursive: true });
  // Hide the Next.js dev-mode badge; let MUI transitions and Convex
  // updates settle.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
};

const openEmail = async (page: Page, to: string, subject: string) => {
  let message: Awaited<ReturnType<typeof findEmail>> = null;
  await expect
    .poll(
      async () => {
        message = await findEmail(to, subject);
        return message?.Subject;
      },
      { timeout: 60_000 },
    )
    .toBe(subject);
  await page.goto(`${mailpitUrl()}/view/${message!.ID}`);
  await expect(page.getByText(subject).first()).toBeVisible();
};

test('borrow flow screenshots', async ({ browser }) => {
  const visitor = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await visitor.goto('/');
  await expect(visitor.getByRole('heading', { name: DRILL })).toHaveCount(0);
  await expect(visitor.getByText('Hedge trimmer')).toBeVisible();
  await shot(visitor, '01-public-board-signed-out');
  await visitor.close();

  const { page: lender } = await sessionFor(browser, 'lender');
  const { page: borrower } = await sessionFor(browser, 'borrower');

  // Lender lists two tools.
  await lender.getByRole('link', { name: 'My listings' }).click();
  for (const [name, description, condition] of [
    [SANDER, '125mm, with a pack of 80 and 120 grit pads.', 'Good'],
    [DRILL, '18V, two batteries, charger and a 30-piece bit set.', 'New'],
  ]) {
    await lender.getByRole('button', { name: 'List a tool' }).click();
    const dialog = lender.getByRole('dialog', { name: 'List a tool' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByRole('combobox', { name: 'Condition' }).click();
    await lender.getByRole('option', { name: condition }).click();
    await dialog.getByLabel('Short description').fill(description);
    if (name === DRILL) await shot(lender, '02-lender-list-a-tool', false);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(cardFor(lender, DRILL)).toBeVisible();
  await shot(lender, '03-lender-my-listings');

  // Borrower browses the board and requests both.
  await borrower.getByRole('link', { name: 'Board' }).click();
  await expect(cardFor(borrower, DRILL)).toBeVisible();
  await shot(borrower, '04-borrower-board');

  for (const [name, note] of [
    [SANDER, 'Sanding down an old door, two days at most.'],
    [DRILL, 'Putting up shelves on Saturday. Happy to drop it back Monday.'],
  ]) {
    await cardFor(borrower, name)
      .getByRole('button', { name: 'Request to borrow' })
      .click();
    const dialog = borrower.getByRole('dialog', { name: `Borrow ${name}` });
    await dialog.getByLabel('From').fill(isoDay(0));
    await dialog.getByLabel('Until').fill(isoDay(2));
    await dialog.getByLabel('Note to the owner (optional)').fill(note);
    if (name === DRILL)
      await shot(borrower, '05-borrower-request-dialog', false);
    await dialog.getByRole('button', { name: 'Send request' }).click();
    await expect(dialog).toBeHidden();
  }

  await borrower.getByRole('link', { name: 'My requests' }).click();
  await expect(cardFor(borrower, DRILL).getByText('Pending')).toBeVisible();
  await shot(borrower, '06-borrower-my-requests-pending');

  // Lender gets the request, in the app and by email via n8n.
  await lender.getByRole('link', { name: 'Incoming' }).click();
  await expect(
    cardFor(lender, DRILL).getByText(/Notification sent/),
  ).toBeVisible({ timeout: 30_000 });
  await shot(lender, '07-lender-incoming-request');

  const mail = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await openEmail(mail, emailFor('lender'), `New request for your ${DRILL}`);
  await shot(mail, '08-email-new-request-to-lender', false);

  // Approve the drill, decline the sander.
  await cardFor(lender, DRILL).getByRole('button', { name: 'Approve' }).click();
  await expect(cardFor(lender, DRILL).getByText('Approved')).toBeVisible();
  await cardFor(lender, SANDER)
    .getByRole('button', { name: 'Decline' })
    .click();
  await expect(cardFor(lender, SANDER).getByText('Declined')).toBeVisible();
  await shot(lender, '09-lender-approved-and-declined');

  await openEmail(mail, emailFor('borrower'), `Approved: ${DRILL}`);
  await shot(mail, '10-email-approved-to-borrower', false);

  await borrower.getByRole('link', { name: 'Board' }).click();
  await expect(cardFor(borrower, DRILL).getByText('On loan')).toBeVisible();
  await shot(borrower, '11-board-drill-on-loan');

  // Overdue: a loan due two days ago, then the real n8n reminder run.
  runFixture('createOverdueLoan', {
    lenderEmail: emailFor('lender'),
    borrowerEmail: emailFor('borrower'),
    toolName: LADDER,
    daysOverdue: 2,
  });
  if (process.env.OVERDUE_RUN_CMD) {
    execSync(process.env.OVERDUE_RUN_CMD, { stdio: 'inherit' });
  }
  await borrower.getByRole('link', { name: 'My requests' }).click();
  const ladder = cardFor(borrower, LADDER);
  await expect(ladder.getByText('Overdue')).toBeVisible();
  await expect(ladder.getByText(/Reminder sent/)).toBeVisible({
    timeout: 60_000,
  });
  await shot(borrower, '12-borrower-overdue-with-reminder');

  await openEmail(
    mail,
    emailFor('borrower'),
    `Reminder: please return the ${LADDER}`,
  );
  await shot(mail, '13-email-overdue-reminder', false);

  await mail.goto(mailpitUrl()!);
  await expect(
    mail.getByText(`Reminder: please return the ${LADDER}`),
  ).toBeVisible();
  await shot(mail, '14-mailpit-inbox', false);

  // Lender marks the drill returned.
  await lender.getByRole('link', { name: 'Incoming' }).click();
  await cardFor(lender, DRILL)
    .getByRole('button', { name: 'Mark returned' })
    .click();
  await expect(cardFor(lender, DRILL).getByText('Returned')).toBeVisible();
  await shot(lender, '15-lender-marked-returned');

  // Admin overview.
  const { page: admin } = await sessionFor(browser, 'admin');
  await admin.getByRole('link', { name: 'Admin' }).click();
  await expect(
    admin.getByRole('heading', { name: DRILL }).first(),
  ).toBeVisible();
  await shot(admin, '16-admin-all-loans');
});

test('n8n workflow screenshots', async ({ browser }) => {
  test.skip(!process.env.N8N_URL, 'N8N_URL not set');
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
  });
  await page.goto(`${process.env.N8N_URL}/signin`);
  await page.getByLabel('Email').fill(process.env.N8N_EMAIL!);
  await page.getByLabel('Password').fill(process.env.N8N_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/home|\/workflows|\/projects/);

  for (const [id, name] of [
    ['lendloopRequestW', '17-n8n-request-notification-workflow'],
    ['lendloopOverdueW', '18-n8n-overdue-reminder-workflow'],
    ['lendloopErrorWf1', '19-n8n-error-workflow'],
  ]) {
    await page.goto(`${process.env.N8N_URL}/workflow/${id}`);
    await expect(page.locator('.vue-flow__node').first()).toBeVisible();
    // n8n shows a "Production checklist" popover on published workflows.
    const checklist = page
      .getByRole('dialog')
      .filter({ hasText: 'Production Checklist' });
    if (await checklist.isVisible()) {
      await checklist
        .getByLabel('Close')
        .click({ force: true, timeout: 5_000 })
        .catch(() => page.mouse.click(800, 800));
    }
    // Fit the whole workflow on screen.
    await page.keyboard.press('1');
    await page.waitForTimeout(1_000);
    await shot(page, name, false);
  }

  await page.goto(`${process.env.N8N_URL}/home/executions`);
  await page.waitForTimeout(2_000);
  await shot(page, '20-n8n-executions', false);
});
