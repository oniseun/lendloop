'use client';

import { PageHeader } from '@/modules/common/components/PageHeader';
import { LoanList } from '../components/LoanList';
import { useIncomingRequests } from '../hooks';

export default function IncomingRequestsView() {
  const loans = useIncomingRequests();
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
