export type E2EUser = 'lender' | 'borrower' | 'admin';

// Created by scripts/e2e-setup.mjs. "+clerk_test" marks them as Clerk
// test identities.
export const emailFor = (user: E2EUser) => `e2e-${user}+clerk_test@example.com`;
