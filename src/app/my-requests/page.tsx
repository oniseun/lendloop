import { RequireUser } from '@/modules/common/components/RequireUser';
import MyRequestsView from '@/modules/loans/views/MyRequestsView';

export default function MyRequestsPage() {
  return (
    <RequireUser>
      <MyRequestsView />
    </RequireUser>
  );
}
