import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Activity,
  BadgeIndianRupee,
  Building2,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import './admin-control-center.css';

type Props = { session: Session };
type Tab = 'clinics' | 'staff' | 'subscriptions' | 'audit';

type Clinic = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  brand_color?: string | null;
  active?: boolean | null;
  enable_patient_photos?: boolean;
  enable_prescription_medications?: boolean;
  op_fee_amount?: number | string | null;
  created_at?: string;
};

type Profile = {
  id: string;
  clinic_id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  active: boolean;
  created_at?: string;
};

type Invite = {
  id: string;
  clinic_id: string;
  name: string;
  email: string;
  role: string;
  invite_code?: string | null;
  accepted_at?: string | null;
  created_at?: string;
};

type Subscription = {
  id: string;
  clinic_id: string;
  plan_name: string;
  status: string;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  monthly_price?: number | string | null;
  visit_limit?: number | string | null;
  billing_provider?: string | null;
  google_play_status?: string | null;
  google_play_auto_renewing?: boolean;
  updated_at?: string | null;
};

type AuditItem = {
  id: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  clinic_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
};

type ControlData = {
  clinics: Clinic[];
  profiles: Profile[];
  invites: Invite[];
  subscriptions: Subscription[];
  audits: AuditItem[];
};

const EMPTY: ControlData = { clinics: [], profiles: [], invites: [], subscriptions: [], audits: [] };
const STAFF_ROLES = ['head_doctor', 'working_doctor', 'receptionist', 'owner', 'doctor'];
const INVITE_ROLES = ['working_doctor', 'receptionist', 'doctor'];
const SUBSCRIPTION_STATUSES = ['trial', 'active', 'grace_period', 'expired', 'cancelled'];

function inputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminControlCenter({ session }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('clinics');
  const [data, setData] = useState<ControlData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [showCreateClinic, setShowCreateClinic] = useState(false);

  const [clinicForm, setClinicForm] = useState({
    name: '', phone: '', email: '', address: '', brand_color: '#0F766E', op_fee_amount: '300',
    enable_patient_photos: false, enable_prescription_medications: false,
  });
  const [newClinic, setNewClinic] = useState({
    name: '', phone: '', email: '', address: '', op_fee_amount: '300', monthly_price: '799', trial_days: '90',
    enable_patient_photos: false, enable_prescription_medications: false,
  });
  const [inviteForm, setInviteForm] = useState({ clinic_id: '', name: '', email: '', role: 'working_doctor' });
  const [subscriptionForm, setSubscriptionForm] = useState({
    clinic_id: '', plan_name: 'trial', status: 'trial', monthly_price: '799', visit_limit: '',
    billing_provider: 'manual', trial_ends_at: '', current_period_end: '',
  });

  const clinicMap = useMemo(() => new Map(data.clinics.map((clinic) => [clinic.id, clinic])), [data.clinics]);
  const subscriptionMap = useMemo(() => new Map(data.subscriptions.map((item) => [item.clinic_id, item])), [data.subscriptions]);
  const selectedClinic = clinicMap.get(selectedClinicId) || null;

  const filteredClinics = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data.clinics;
    return data.clinics.filter((clinic) => [clinic.name, clinic.email, clinic.phone, clinic.address].join(' ').toLowerCase().includes(term));
  }, [data.clinics, search]);

  async function api(method: 'GET' | 'POST', body?: Record<string, unknown>) {
    const response = await fetch('/api/admin-control', {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Admin control request failed');
    return payload;
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const payload = await api('GET');
      setData({
        clinics: payload.clinics || [],
        profiles: payload.profiles || [],
        invites: payload.invites || [],
        subscriptions: payload.subscriptions || [],
        audits: payload.audits || [],
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load full admin controls');
    } finally {
      setLoading(false);
    }
  }

  function triggerDashboardRefresh() {
    const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.trim().startsWith('Refresh'));
    button?.click();
  }

  async function perform(body: Record<string, unknown>, success: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api('POST', body);
      setNotice(success);
      await load();
      triggerDashboardRefresh();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Admin action failed');
      return false;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (open && !data.clinics.length && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const clinic = selectedClinic;
    if (!clinic) return;
    setClinicForm({
      name: clinic.name || '',
      phone: clinic.phone || '',
      email: clinic.email || '',
      address: clinic.address || '',
      brand_color: clinic.brand_color || '#0F766E',
      op_fee_amount: String(clinic.op_fee_amount ?? 300),
      enable_patient_photos: clinic.enable_patient_photos === true,
      enable_prescription_medications: clinic.enable_prescription_medications === true,
    });

    const subscription = subscriptionMap.get(clinic.id);
    setSubscriptionForm({
      clinic_id: clinic.id,
      plan_name: subscription?.plan_name || 'trial',
      status: subscription?.status || 'trial',
      monthly_price: String(subscription?.monthly_price ?? 799),
      visit_limit: subscription?.visit_limit == null ? '' : String(subscription.visit_limit),
      billing_provider: subscription?.billing_provider || 'manual',
      trial_ends_at: inputDate(subscription?.trial_ends_at),
      current_period_end: inputDate(subscription?.current_period_end),
    });
  }, [selectedClinic, subscriptionMap]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  async function createClinic(event: FormEvent) {
    event.preventDefault();
    const ok = await perform({ action: 'create_clinic', ...newClinic }, 'Clinic created with a protected trial subscription.');
    if (ok) {
      setNewClinic({
        name: '', phone: '', email: '', address: '', op_fee_amount: '300', monthly_price: '799', trial_days: '90',
        enable_patient_photos: false, enable_prescription_medications: false,
      });
      setShowCreateClinic(false);
    }
  }

  async function saveClinic(event: FormEvent) {
    event.preventDefault();
    if (!selectedClinic) return;
    await perform({ action: 'update_clinic', clinic_id: selectedClinic.id, ...clinicForm }, 'Clinic settings updated.');
  }

  async function toggleClinic(clinic: Clinic) {
    const nextActive = clinic.active === false;
    let confirmation = '';
    let reason = '';
    if (!nextActive) {
      confirmation = window.prompt(`Type SUSPEND to disable ${clinic.name}. Patient records will remain محفوظ and the clinic can be reactivated later.`) || '';
      if (confirmation !== 'SUSPEND') return;
      reason = window.prompt('Optional suspension reason') || '';
    }
    await perform(
      { action: 'set_clinic_active', clinic_id: clinic.id, active: nextActive, confirmation, reason },
      nextActive ? 'Clinic reactivated.' : 'Clinic access suspended.',
    );
  }

  async function inviteStaff(event: FormEvent) {
    event.preventDefault();
    const ok = await perform({ action: 'create_staff_invite', ...inviteForm }, 'Staff invitation code created.');
    if (ok) setInviteForm((value) => ({ ...value, name: '', email: '' }));
  }

  async function updateStaff(profile: Profile, changes: Record<string, unknown>) {
    await perform({ action: 'update_staff', staff_id: profile.id, ...changes }, 'Staff access updated.');
  }

  async function saveSubscription(event: FormEvent) {
    event.preventDefault();
    if (!subscriptionForm.clinic_id) return;
    await perform({ action: 'update_subscription', ...subscriptionForm }, 'Subscription controls updated.');
  }

  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: 'clinics', label: 'Clinics', icon: Building2 },
    { id: 'staff', label: 'Staff & invites', icon: Users },
    { id: 'subscriptions', label: 'Subscriptions', icon: BadgeIndianRupee },
    { id: 'audit', label: 'Admin audit', icon: ClipboardList },
  ];

  return (
    <>
      <button className="ac-launcher" type="button" onClick={() => setOpen(true)} title="Ctrl/⌘ + Shift + A">
        <ShieldCheck size={19} />
        <span>Full admin</span>
      </button>

      {open ? <div className="ac-backdrop" onMouseDown={() => setOpen(false)}>
        <section className="ac-shell" onMouseDown={(event) => event.stopPropagation()} aria-label="SooperAdmin full controls">
          <header className="ac-header">
            <div><span><KeyRound size={18} /></span><div><small>Master-only controls</small><h2>Full administration</h2><p>Protected clinic, staff and subscription mutations.</p></div></div>
            <div className="ac-header-actions"><button type="button" onClick={load} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={17} /> Reload</button><button type="button" onClick={() => setOpen(false)} aria-label="Close admin controls"><X size={19} /></button></div>
          </header>

          <nav className="ac-tabs" aria-label="Admin control sections">
            {tabs.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={17} />{item.label}</button>; })}
          </nav>

          {error ? <div className="ac-message error"><ShieldAlert size={17} />{error}</div> : null}
          {notice ? <div className="ac-message success"><CheckCircle2 size={17} />{notice}</div> : null}
          {loading ? <div className="ac-loading"><Loader2 className="spin" size={21} /> Loading protected controls…</div> : null}

          {!loading && tab === 'clinics' ? <div className="ac-layout">
            <aside className="ac-list-panel">
              <div className="ac-list-head"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clinics" /></label><button type="button" onClick={() => setShowCreateClinic((value) => !value)}><Building2 size={16} /> New</button></div>
              <div className="ac-clinic-list">
                {filteredClinics.map((clinic) => <button type="button" key={clinic.id} className={selectedClinicId === clinic.id ? 'active' : ''} onClick={() => { setSelectedClinicId(clinic.id); setShowCreateClinic(false); }}><i style={{ background: clinic.brand_color || '#0F766E' }}>{clinic.name.slice(0, 1).toUpperCase()}</i><span><strong>{clinic.name}</strong><small>{clinic.email || clinic.phone || 'No contact'}</small></span><em className={clinic.active === false ? 'danger' : 'ok'}>{clinic.active === false ? 'Suspended' : 'Active'}</em></button>)}
              </div>
            </aside>

            <div className="ac-detail-panel">
              {showCreateClinic || !selectedClinic ? <form className="ac-form" onSubmit={createClinic}>
                <div className="ac-section-title"><div><Building2 size={18} /><span><h3>Create clinic</h3><p>Creates the tenant and its initial trial subscription.</p></span></div></div>
                <div className="ac-grid two"><label>Clinic name<input required value={newClinic.name} onChange={(event) => setNewClinic({ ...newClinic, name: event.target.value })} /></label><label>Clinic email<input type="email" value={newClinic.email} onChange={(event) => setNewClinic({ ...newClinic, email: event.target.value })} /></label><label>Phone<input value={newClinic.phone} onChange={(event) => setNewClinic({ ...newClinic, phone: event.target.value })} /></label><label>OP fee<input type="number" min="0" value={newClinic.op_fee_amount} onChange={(event) => setNewClinic({ ...newClinic, op_fee_amount: event.target.value })} /></label><label>Monthly price<input type="number" min="0" value={newClinic.monthly_price} onChange={(event) => setNewClinic({ ...newClinic, monthly_price: event.target.value })} /></label><label>Trial days<input type="number" min="1" max="365" value={newClinic.trial_days} onChange={(event) => setNewClinic({ ...newClinic, trial_days: event.target.value })} /></label></div>
                <label>Address<textarea rows={3} value={newClinic.address} onChange={(event) => setNewClinic({ ...newClinic, address: event.target.value })} /></label>
                <div className="ac-toggle-row"><label><input type="checkbox" checked={newClinic.enable_patient_photos} onChange={(event) => setNewClinic({ ...newClinic, enable_patient_photos: event.target.checked })} /> Patient photos</label><label><input type="checkbox" checked={newClinic.enable_prescription_medications} onChange={(event) => setNewClinic({ ...newClinic, enable_prescription_medications: event.target.checked })} /> Medication module</label></div>
                <button className="ac-primary" disabled={saving} type="submit">{saving ? <Loader2 className="spin" size={17} /> : <Building2 size={17} />} Create clinic</button>
              </form> : <form className="ac-form" onSubmit={saveClinic}>
                <div className="ac-section-title"><div><Building2 size={18} /><span><h3>{selectedClinic.name}</h3><p>{selectedClinic.id}</p></span></div><button type="button" className={selectedClinic.active === false ? 'ac-reactivate' : 'ac-danger'} onClick={() => toggleClinic(selectedClinic)}>{selectedClinic.active === false ? 'Reactivate' : 'Suspend clinic'}</button></div>
                <div className="ac-grid two"><label>Clinic name<input required value={clinicForm.name} onChange={(event) => setClinicForm({ ...clinicForm, name: event.target.value })} /></label><label>Email<input type="email" value={clinicForm.email} onChange={(event) => setClinicForm({ ...clinicForm, email: event.target.value })} /></label><label>Phone<input value={clinicForm.phone} onChange={(event) => setClinicForm({ ...clinicForm, phone: event.target.value })} /></label><label>OP fee<input type="number" min="0" value={clinicForm.op_fee_amount} onChange={(event) => setClinicForm({ ...clinicForm, op_fee_amount: event.target.value })} /></label><label>Brand color<input type="color" value={clinicForm.brand_color} onChange={(event) => setClinicForm({ ...clinicForm, brand_color: event.target.value })} /></label></div>
                <label>Address<textarea rows={3} value={clinicForm.address} onChange={(event) => setClinicForm({ ...clinicForm, address: event.target.value })} /></label>
                <div className="ac-toggle-row"><label><input type="checkbox" checked={clinicForm.enable_patient_photos} onChange={(event) => setClinicForm({ ...clinicForm, enable_patient_photos: event.target.checked })} /> Patient photos</label><label><input type="checkbox" checked={clinicForm.enable_prescription_medications} onChange={(event) => setClinicForm({ ...clinicForm, enable_prescription_medications: event.target.checked })} /> Medication module</label></div>
                <button className="ac-primary" disabled={saving} type="submit">{saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Save clinic settings</button>
              </form>}
            </div>
          </div> : null}

          {!loading && tab === 'staff' ? <div className="ac-stack">
            <form className="ac-card ac-form" onSubmit={inviteStaff}>
              <div className="ac-section-title"><div><UserPlus size={18} /><span><h3>Create staff invite</h3><p>Generates a fresh clinic invite code using the existing onboarding flow.</p></span></div></div>
              <div className="ac-grid four"><label>Clinic<select required value={inviteForm.clinic_id} onChange={(event) => setInviteForm({ ...inviteForm, clinic_id: event.target.value })}><option value="">Select clinic</option>{data.clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label><label>Name<input required value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} /></label><label>Email<input required type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} /></label><label>Role<select value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })}>{INVITE_ROLES.map((role) => <option key={role} value={role}>{pretty(role)}</option>)}</select></label></div>
              <button className="ac-primary" disabled={saving} type="submit"><UserPlus size={17} /> Generate invite</button>
            </form>

            <section className="ac-card"><div className="ac-section-title"><div><UserCog size={18} /><span><h3>Staff access control</h3><p>Change roles or immediately disable and restore access.</p></span></div></div><div className="ac-table-wrap"><table><thead><tr><th>Staff</th><th>Clinic</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.profiles.map((profile) => <tr key={profile.id}><td><strong>{profile.name}</strong><small>{profile.email}</small></td><td>{clinicMap.get(profile.clinic_id)?.name || 'Unknown clinic'}</td><td><select value={profile.role} onChange={(event) => updateStaff(profile, { role: event.target.value })}>{STAFF_ROLES.map((role) => <option key={role} value={role}>{pretty(role)}</option>)}</select></td><td><span className={profile.active === false ? 'ac-status danger' : 'ac-status ok'}>{profile.active === false ? 'Inactive' : 'Active'}</span></td><td><button type="button" className={profile.active === false ? 'ac-reactivate small' : 'ac-danger small'} onClick={() => updateStaff(profile, { active: profile.active === false })}>{profile.active === false ? 'Enable' : 'Disable'}</button></td></tr>)}</tbody></table></div></section>

            <section className="ac-card"><div className="ac-section-title"><div><KeyRound size={18} /><span><h3>Pending invitation codes</h3><p>Revoke unused invitations when necessary.</p></span></div></div><div className="ac-invite-grid">{data.invites.filter((invite) => !invite.accepted_at).map((invite) => <article key={invite.id}><span><strong>{invite.name}</strong><small>{invite.email}</small></span><code>{invite.invite_code || '—'}</code><em>{clinicMap.get(invite.clinic_id)?.name || 'Unknown clinic'} • {pretty(invite.role)}</em><button type="button" onClick={() => perform({ action: 'revoke_staff_invite', invite_id: invite.id }, 'Invitation revoked.')}>Revoke</button></article>)}</div></section>
          </div> : null}

          {!loading && tab === 'subscriptions' ? <div className="ac-layout">
            <aside className="ac-list-panel"><div className="ac-list-head"><strong>Clinic subscriptions</strong></div><div className="ac-clinic-list">{data.clinics.map((clinic) => { const subscription = subscriptionMap.get(clinic.id); return <button type="button" key={clinic.id} className={selectedClinicId === clinic.id ? 'active' : ''} onClick={() => setSelectedClinicId(clinic.id)}><i style={{ background: clinic.brand_color || '#0F766E' }}>{clinic.name.slice(0, 1).toUpperCase()}</i><span><strong>{clinic.name}</strong><small>{subscription ? pretty(subscription.status) : 'No subscription row'}</small></span><em>{subscription ? `₹${subscription.monthly_price ?? 0}` : '—'}</em></button>; })}</div></aside>
            <div className="ac-detail-panel">{selectedClinic ? <form className="ac-form" onSubmit={saveSubscription}><div className="ac-section-title"><div><BadgeIndianRupee size={18} /><span><h3>{selectedClinic.name}</h3><p>Plan, trial and billing controls</p></span></div><button type="button" onClick={() => perform({ action: 'reset_trial', clinic_id: selectedClinic.id, days: 90 }, 'A fresh 90-day trial has been applied.')}>Reset 90-day trial</button></div><div className="ac-grid two"><label>Plan name<input value={subscriptionForm.plan_name} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, plan_name: event.target.value })} /></label><label>Status<select value={subscriptionForm.status} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, status: event.target.value })}>{SUBSCRIPTION_STATUSES.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></label><label>Monthly price<input type="number" min="0" value={subscriptionForm.monthly_price} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, monthly_price: event.target.value })} /></label><label>Visit limit<input type="number" min="0" placeholder="Unlimited" value={subscriptionForm.visit_limit} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, visit_limit: event.target.value })} /></label><label>Billing provider<select value={subscriptionForm.billing_provider} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, billing_provider: event.target.value })}><option value="manual">Manual</option><option value="google_play">Google Play</option></select></label><label>Trial ends<input type="date" value={subscriptionForm.trial_ends_at} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, trial_ends_at: event.target.value })} /></label><label>Current period ends<input type="date" value={subscriptionForm.current_period_end} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, current_period_end: event.target.value })} /></label></div><button className="ac-primary" disabled={saving} type="submit"><Save size={17} /> Save subscription</button></form> : <div className="ac-empty"><BadgeIndianRupee size={24} /><strong>Select a clinic</strong><p>Choose a clinic to manage its trial and subscription.</p></div>}</div>
          </div> : null}

          {!loading && tab === 'audit' ? <section className="ac-card ac-audit"><div className="ac-section-title"><div><Activity size={18} /><span><h3>Administrative audit trail</h3><p>Every protected mutation performed by the master account.</p></span></div></div><div className="ac-audit-list">{data.audits.map((item) => <article key={item.id}><span><ClipboardList size={16} /></span><div><strong>{pretty(item.action)}</strong><p>{item.target_type}{item.clinic_id ? ` • ${clinicMap.get(item.clinic_id)?.name || item.clinic_id}` : ''}</p><small>{item.actor_email}</small></div><time>{formatDate(item.created_at)}</time></article>)}</div></section> : null}
        </section>
      </div> : null}
    </>
  );
}
