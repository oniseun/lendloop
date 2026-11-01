'use client';

import { SignInButton } from '@clerk/nextjs';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { api } from '@convex/_generated/api';
import { CardGrid } from '@/modules/common/components/CardGrid';
import { EmptyState } from '@/modules/common/components/EmptyState';
import { Loading } from '@/modules/common/components/Loading';
import { useCurrentUser } from '@/modules/common/context/CurrentUserContext';
import { ToolCard } from '../components/ToolCard';

export default function PublicToolsView() {
  const tools = useQuery(api.tools.listPublic, {});
  const { isAuthenticated } = useCurrentUser();

  return (
    <>
      <Box component="section" sx={{ py: { xs: 4, md: 8 }, maxWidth: 640 }}>
        <Typography variant="h1">
          Borrow what you need. Lend what you don&apos;t.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 2, mb: 3 }}>
          LendLoop is a tool-lending board for your street. List the drill that
          sits in your shed, borrow a pressure washer for a weekend.
        </Typography>
        {isAuthenticated ? (
          <Button
            component={Link}
            href="/tools"
            variant="contained"
            size="large"
          >
            Go to the board
          </Button>
        ) : (
          <SignInButton mode="modal" forceRedirectUrl="/tools">
            <Button variant="contained" size="large">
              Sign in to lend or borrow
            </Button>
          </SignInButton>
        )}
      </Box>

      <Typography variant="h2" sx={{ mb: 2 }}>
        Available in the neighbourhood
      </Typography>
      {tools === undefined ? (
        <Loading />
      ) : tools.length === 0 ? (
        <EmptyState message="Nothing listed yet. Be the first." />
      ) : (
        <CardGrid>
          {tools.map((tool) => (
            <ToolCard
              key={tool._id}
              name={tool.name}
              category={tool.category}
            />
          ))}
        </CardGrid>
      )}
    </>
  );
}
