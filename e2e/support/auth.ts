import { clerk } from '@clerk/testing/playwright';
import { expect, type Browser, type Page } from '@playwright/test';
import { emailFor, type E2EUser } from './users';

// Real Clerk session, no UI typing: @clerk/testing mints a sign-in
// ticket for the user with CLERK_SECRET_KEY and completes it in the
// page (testing token included, so bot protection doesn't block it).
// Then waits for the Convex user to be synced.
export const signIn = async (page: Page, user: E2EUser) => {
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: emailFor(user) });
  await page.goto('/tools');
  await expect(page.getByRole('heading', { name: 'The board' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My listings' })).toBeVisible();
};

// One browser context per person, so lender and borrower can be signed
// in side by side.
export const sessionFor = async (browser: Browser, user: E2EUser) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user);
  return { context, page };
};
