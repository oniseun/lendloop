import { RequireUser } from '@/modules/common/components/RequireUser';
import IncomingRequestsView from '@/modules/loans/views/IncomingRequestsView';

export default function IncomingPage() {
  return (
    <RequireUser>
      <IncomingRequestsView />
    </RequireUser>
  );
}
