import { expect, test } from '@playwright/test';

test('signed-out visitors see the public board and are sent to sign in', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  // App pages need a session: the proxy redirects to Clerk sign-in.
  await page.goto('/my-requests');
  await expect(page).not.toHaveURL(/\/my-requests$/);
});
