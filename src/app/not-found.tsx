'use client';

import Button from '@mui/material/Button';
import Link from 'next/link';
import { EmptyState } from '@/modules/common/components/EmptyState';

export default function NotFound() {
  return (
    <EmptyState
      message="That page doesn't exist."
      action={
        <Button component={Link} href="/">
          Back home
        </Button>
      }
    />
  );
}
