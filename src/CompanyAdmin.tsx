import type { Session } from '@supabase/supabase-js';
import './admin-action-bridge';
import './admin-runtime-copy';
import AdminControlCenter from './AdminControlCenter';
import ControlPanelDashboard from './ControlPanelDashboard';
import OwnerInviteControl from './OwnerInviteControl';
import './control-panel.css';

type Props = { session: Session; onLogout: () => void };

export default function CompanyAdmin(props: Props) {
  return (
    <>
      <ControlPanelDashboard {...props} />
      <AdminControlCenter session={props.session} />
      <OwnerInviteControl session={props.session} />
    </>
  );
}
