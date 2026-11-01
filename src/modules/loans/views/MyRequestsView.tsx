'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { PageHeader } from '@/modules/common/components/PageHeader';
import { LoanList } from '../components/LoanList';

export default function MyRequestsView() {
  const loans = useQuery(api.loans.mine, {});
  return (
    <>
      <PageHeader
        title="My requests"
        subtitle="Things you've asked to borrow."
      />
      <LoanList
        loans={loans}
        emptyMessage="You haven't requested anything yet."
      />
    </>
  );
}
