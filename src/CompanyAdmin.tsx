import type { Session } from '@supabase/supabase-js';
import AdminControlCenter from './AdminControlCenter';
import ControlPanelDashboard from './ControlPanelDashboard';
import './control-panel.css';

type Props = { session: Session; onLogout: () => void };

export default function CompanyAdmin(props: Props) {
  return (
    <>
      <ControlPanelDashboard {...props} />
      <AdminControlCenter session={props.session} />
    </>
  );
}
