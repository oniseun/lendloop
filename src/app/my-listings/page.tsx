import { RequireUser } from '@/modules/common/components/RequireUser';
import MyListingsView from '@/modules/tools/views/MyListingsView';

export default function MyListingsPage() {
  return (
    <RequireUser>
      <MyListingsView />
    </RequireUser>
  );
}
