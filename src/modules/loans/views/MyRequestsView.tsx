'use client';

import { PageHeader } from '@/modules/common/components/PageHeader';
import { LoanList } from '../components/LoanList';
import { useMyRequests } from '../hooks';

export default function MyRequestsView() {
  const loans = useMyRequests();
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
