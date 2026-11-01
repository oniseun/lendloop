'use client';

import { useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import type { ReactNode } from 'react';
import { env } from '../utils/env';

const convex = env.convexUrl ? new ConvexReactClient(env.convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <p style={{ padding: 24 }}>
        NEXT_PUBLIC_CONVEX_URL is not set. Copy .env.example to .env.local and
        run <code>npx convex dev</code>.
      </p>
    );
  }
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
