import type { AuthConfig } from 'convex/server';

// Clerk issues the JWT (template name "convex"), Convex verifies it.
// CLERK_JWT_ISSUER_DOMAIN is set on the Convex deployment, not in Next.js.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
