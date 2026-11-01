import { clerkSetup } from '@clerk/testing/playwright';

// Fetches a Clerk testing token with CLERK_SECRET_KEY so sign-ins from
// the suite skip Clerk's bot protection.
export default async function globalSetup() {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('Clerk keys missing. Run: npm run e2e:setup');
  }
  await clerkSetup();
}
