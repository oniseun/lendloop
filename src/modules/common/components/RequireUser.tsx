'use client';

import { SignInButton } from '@clerk/nextjs';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import type { ReactNode } from 'react';
import { useCurrentUser } from '@/modules/users/context/CurrentUserContext';

interface RequireUserProps {
  children: ReactNode;
  adminOnly?: boolean;
}

// UI gate only. The real checks are in the Convex functions; this just
// avoids rendering screens that would error.
export function RequireUser({ children, adminOnly = false }: RequireUserProps) {
  const { isLoading, isAuthenticated, user } = useCurrentUser();

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Alert
        severity="info"
        action={
          <SignInButton mode="modal">
            <Button color="inherit" size="small">
              Sign in
            </Button>
          </SignInButton>
        }
      >
        Sign in to lend or borrow.
      </Alert>
    );
  }

  if (adminOnly && user.role !== 'admin') {
    return <Alert severity="warning">This page is for admins.</Alert>;
  }

  return <>{children}</>;
}
