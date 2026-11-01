import { ClerkProvider } from '@clerk/nextjs';
import Container from '@mui/material/Container';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppHeader } from '@/modules/common/components/AppHeader';
import { CurrentUserProvider } from '@/modules/users/context/CurrentUserContext';
import { ConvexClientProvider } from '@/modules/common/providers/ConvexClientProvider';
import { ThemeRegistry } from '@/modules/common/providers/ThemeRegistry';

export const metadata: Metadata = {
  title: 'LendLoop',
  description: "Borrow what you need. Lend what you don't.",
};

// Every page depends on the signed-in user, so nothing is prerendered.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            <CurrentUserProvider>
              <ThemeRegistry>
                <AppHeader />
                <Container component="main" maxWidth="lg" sx={{ py: 4 }}>
                  {children}
                </Container>
              </ThemeRegistry>
            </CurrentUserProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
