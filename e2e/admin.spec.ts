import { expect, test } from '@playwright/test';
import { sessionFor, signIn } from './support/auth';

test('admins get the admin area, other users do not', async ({
  browser,
  page,
}) => {
  await signIn(page, 'borrower');
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

  const { page: admin } = await sessionFor(browser, 'admin');
  await admin.getByRole('link', { name: 'Admin' }).click();
  await expect(admin.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(admin.getByRole('tab', { name: 'All loans' })).toBeVisible();
  await admin.getByRole('tab', { name: 'Lenders' }).click();
  await expect(
    admin.getByRole('cell', { name: 'Ben Borrower', exact: true }),
  ).toBeVisible();
  await admin.context().close();
});
