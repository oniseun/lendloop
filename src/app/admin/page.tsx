import { RequireUser } from '@/modules/common/components/RequireUser';
import AdminView from '@/modules/admin/views/AdminView';

export default function AdminPage() {
  return (
    <RequireUser adminOnly>
      <AdminView />
    </RequireUser>
  );
}
