import { RequireUser } from '@/modules/common/components/RequireUser';
import ToolsView from '@/modules/tools/views/ToolsView';

export default function ToolsPage() {
  return (
    <RequireUser>
      <ToolsView />
    </RequireUser>
  );
}
