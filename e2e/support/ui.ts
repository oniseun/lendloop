import type { Page } from '@playwright/test';

// MUI cards have no role; find the card whose heading is `name`.
export const cardFor = (page: Page, name: string) =>
  page
    .locator('.MuiCard-root')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });

export const isoDay = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

export const runId = () => Date.now().toString(36).slice(-5).toUpperCase();
