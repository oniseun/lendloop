'use client';

import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { PageHeader } from '@/modules/common/components/PageHeader';
import { LoanList } from '../components/LoanList';

export default function IncomingRequestsView() {
  const loans = useQuery(api.loans.incoming, {});
  return (
    <>
      <PageHeader
        title="Incoming requests"
        subtitle="Neighbours asking to borrow your tools."
      />
      <LoanList loans={loans} emptyMessage="No requests for your tools yet." />
    </>
  );
}
