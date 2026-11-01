'use client';

import { SignInButton, UserButton } from '@clerk/nextjs';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/modules/users/context/CurrentUserContext';

const NAV = [
  { href: '/tools', label: 'Board' },
  { href: '/my-listings', label: 'My listings' },
  { href: '/my-requests', label: 'My requests' },
  { href: '/incoming', label: 'Incoming' },
];

export function AppHeader() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useCurrentUser();
  const links =
    user?.role === 'admin' ? [...NAV, { href: '/admin', label: 'Admin' }] : NAV;

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Typography
            component={Link}
            href="/"
            variant="h3"
            sx={{ color: 'primary.main', textDecoration: 'none', mr: 2 }}
          >
            LendLoop
          </Typography>

          {isAuthenticated && (
            <Box component="nav" sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
              {links.map((link) => (
                <Button
                  key={link.href}
                  component={Link}
                  href={link.href}
                  size="small"
                  color={pathname === link.href ? 'primary' : 'inherit'}
                  aria-current={pathname === link.href ? 'page' : undefined}
                >
                  {link.label}
                </Button>
              ))}
            </Box>
          )}

          <Box sx={{ ml: 'auto' }}>
            {isAuthenticated ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/tools">
                <Button variant="contained">Sign in</Button>
              </SignInButton>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
