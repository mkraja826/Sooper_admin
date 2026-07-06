import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Filter,
  HeartPulse,
  Loader2,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

type Props = { session: Session; onLogout: () => void };
type Row = Record<string, unknown>;
type View = 'dashboard' | 'clinics' | 'revenue' | 'usage' | 'access';
type TableName = 'clinics' | 'profiles' | 'patients' | 'appointments' | 'patient_visits' | 'payments' | 'invoices' | 'files' | 'staff_invites' | 'website_appointments';
type ClinicStatus = 'Active' | 'Trial' | 'Payment Due' | 'Suspended';
type DataSet = Record<TableName, Row[]>;

type ClinicModel = {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  city: string;
  address: string;
  plan: string;
  status: ClinicStatus;
  statusTone: string;
  monthlyVisits: number;
  todayVisits: number;
  amountDue: number;
  monthRevenue: number;
  staffCount: number;
  patientCount: number;
  lastActive: Date | null;
  createdAt: Date | null;
  trialDaysLeft: number | null;
};

const TABLES: TableName[] = ['clinics', 'profiles', 'patients', 'appointments', 'patient_visits', 'payments', 'invoices', 'files', 'staff_invites', 'website_appointments'];
const emptyData = TABLES.reduce((acc, table) => {
  acc[table] = [];
  return acc;
}, {} as DataSet);

function asNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function money(value: unknown) {
  return `₹${Math.round(asNumber(value)).toLocaleString('en-IN')}`;
}

function count(value: unknown) {
  return asNumber(value).toLocaleString('en-IN');
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysBetween(from: Date | null, to = new Date()) {
  if (!from) return null;
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function rowClinicId(row: Row) {
  return String(row.clinic_id || '');
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv(name: string, rows: Row[]) {
  if (!rows.length) return;
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function cityFrom(row: Row) {
  const explicit = asText(row.city, '');
  if (explicit) return explicit;
  const address = asText(row.address, '');
  if (!address) return '—';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const city = parts.find((part) => /hyderabad|secunderabad|chennai|bangalore|bengaluru|mumbai|pune|delhi|guntur|vijayawada/i.test(part));
  return city || parts[Math.max(0, parts.length - 2)] || parts[0] || '—';
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function formatRelative(value: Date | null) {
  if (!value) return 'No activity';
  const diff = daysBetween(value);
  if (diff === null) return 'No activity';
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

function toneForStatus(status: ClinicStatus) {
  if (status === 'Active') return 'green';
  if (status === 'Trial') return 'blue';
  if (status === 'Payment Due') return 'amber';
  return 'red';
}

function derivePlan(row: Row, status: ClinicStatus) {
  const plan = asText(row.plan || row.subscription_plan || row.billing_plan, '');
  if (plan) return plan;
  if (status === 'Trial') return 'Trial';
  return 'Basic';
}

function buildClinics(data: DataSet) {
  const month = startOfMonth();
  const today = startOfToday();

  return data.clinics.map((clinic) => {
    const id = String(clinic.id || '');
    const createdAt = parseDate(clinic.created_at);
    const staffRows = data.profiles.filter((row) => rowClinicId(row) === id);
    const owner = staffRows.find((row) => /owner|head|admin/i.test(String(row.role || ''))) || staffRows[0];
    const patientRows = data.patients.filter((row) => rowClinicId(row) === id);
    const visitRows = data.patient_visits.filter((row) => rowClinicId(row) === id);
    const invoiceRows = data.invoices.filter((row) => rowClinicId(row) === id);
    const paymentRows = data.payments.filter((row) => rowClinicId(row) === id);
    const appointmentRows = data.appointments.filter((row) => rowClinicId(row) === id);

    const monthlyVisits = visitRows.filter((row) => {
      const date = parseDate(row.visit_date || row.created_at);
      return date ? date >= month : false;
    }).length;

    const todayVisits = visitRows.filter((row) => {
      const date = parseDate(row.visit_date || row.created_at);
      return date ? date >= today : false;
    }).length;

    const monthRevenue = paymentRows.filter((row) => {
      const date = parseDate(row.created_at);
      return date ? date >= month : false;
    }).reduce((sum, row) => sum + asNumber(row.amount), 0);

    const amountDue = invoiceRows.reduce((sum, row) => sum + asNumber(row.due_amount), 0);
    const trialAge = daysBetween(createdAt);
    const trialDaysLeft = trialAge !== null && trialAge <= 90 ? Math.max(0, 90 - trialAge) : null;

    let status: ClinicStatus = 'Active';
    if (clinic.active === false) status = 'Suspended';
    else if (amountDue > 0) status = 'Payment Due';
    else if (trialDaysLeft !== null) status = 'Trial';

    const activityDates = [
      createdAt,
      ...visitRows.map((row) => parseDate(row.visit_date || row.created_at)),
      ...paymentRows.map((row) => parseDate(row.created_at)),
      ...appointmentRows.map((row) => parseDate(row.appointment_time || row.created_at)),
      ...patientRows.map((row) => parseDate(row.created_at)),
    ].filter((date): date is Date => Boolean(date));
    const lastActive = activityDates.length ? new Date(Math.max(...activityDates.map((date) => date.getTime()))) : createdAt;

    return {
      id,
      name: asText(clinic.name, 'Unnamed clinic'),
      ownerName: asText(owner?.name || owner?.email, 'Owner not added'),
      phone: asText(clinic.phone || owner?.phone, '—'),
      city: cityFrom(clinic),
      address: asText(clinic.address, '—'),
      plan: derivePlan(clinic, status),
      status,
      statusTone: toneForStatus(status),
      monthlyVisits,
      todayVisits,
      amountDue,
      monthRevenue,
      staffCount: staffRows.length,
      patientCount: patientRows.length,
      lastActive,
      createdAt,
      trialDaysLeft,
    } as ClinicModel;
  }).sort((a, b) => (b.lastActive?.getTime() || 0) - (a.lastActive?.getTime() || 0));
}

function clinicExportRows(clinics: ClinicModel[]) {
  return clinics.map((clinic) => ({
    'Clinic Name': clinic.name,
    'Owner Name': clinic.ownerName,
    Phone: clinic.phone,
    City: clinic.city,
    Plan: clinic.plan,
    Status: clinic.status,
    'Monthly Visits': clinic.monthlyVisits,
    'Amount Due': clinic.amountDue,
    'Last Active': formatRelative(clinic.lastActive),
  }));
}

function patientLabel(row: Row | undefined) {
  if (!row) return '—';
  return [asText(row.patient_code || row.code, 'No patient ID'), asText(row.name, 'Unnamed patient'), asText(row.phone, '')].filter(Boolean).join(' • ');
}

function buildDetailExport(clinic: ClinicModel, data: DataSet) {
  const patients = new Map<string, Row>(data.patients.map((row): [string, Row] => [String(row.id || ''), row]));
  return data.patient_visits.filter((row) => rowClinicId(row) === clinic.id).slice(0, 250).map((row) => ({
    Clinic: clinic.name,
    Patient: patientLabel(patients.get(String(row.patient_id || ''))),
    Complaint: row.chief_complaint,
    Status: row.visit_status,
    'Visit Date': row.visit_date || row.created_at,
  }));
}

export default function SuperAdminDashboard({ session, onLogout }: Props) {
  const [view, setView] = useState<View>('dashboard');
  const [data, setData] = useState<DataSet>(emptyData);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [cityFilter, setCityFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [trialEndingSoon, setTrialEndingSoon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState('');

  async function adminApi(params: Record<string, string>) {
    const url = new URL('/api/admin', window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${session.access_token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Sooper admin API failed');
    return payload;
  }

  async function readTable(tableName: TableName) {
    const payload = await adminApi({ mode: 'table', table: tableName });
    return (payload.rows || []) as Row[];
  }

  async function loadAll(soft = false) {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    const nextData = { ...emptyData };
    const nextWarnings: string[] = [];
    await Promise.all(TABLES.map(async (table) => {
      try {
        nextData[table] = await readTable(table);
      } catch (err) {
        nextData[table] = [];
        nextWarnings.push(err instanceof Error ? err.message : `${table} could not load`);
      }
    }));
    setData(nextData);
    setWarnings(nextWarnings.filter((warning) => !warning.toLowerCase().includes('unknown table')));
    setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    setRefreshing(false);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clinics = useMemo(() => buildClinics(data), [data]);
  const selectedClinic = clinics.find((clinic) => clinic.id === selectedClinicId) || null;
  const cities = useMemo(() => ['All', ...Array.from(new Set(clinics.map((clinic) => clinic.city).filter(Boolean))).sort()], [clinics]);
  const plans = useMemo(() => ['All', ...Array.from(new Set(clinics.map((clinic) => clinic.plan).filter(Boolean))).sort()], [clinics]);

  const filteredClinics = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clinics.filter((clinic) => {
      const searchOk = !term || [clinic.name, clinic.ownerName, clinic.phone, clinic.city].join(' ').toLowerCase().includes(term);
      const statusOk = statusFilter === 'All' || clinic.status === statusFilter;
      const planOk = planFilter === 'All' || clinic.plan === planFilter;
      const cityOk = cityFilter === 'All' || clinic.city === cityFilter;
      const paymentOk = paymentFilter === 'All' || (paymentFilter === 'Due' ? clinic.amountDue > 0 : clinic.amountDue <= 0);
      const trialOk = !trialEndingSoon || (clinic.trialDaysLeft !== null && clinic.trialDaysLeft <= 14);
      return searchOk && statusOk && planOk && cityOk && paymentOk && trialOk;
    });
  }, [clinics, search, statusFilter, planFilter, cityFilter, paymentFilter, trialEndingSoon]);

  const totals = useMemo(() => {
    const active = clinics.filter((clinic) => clinic.status === 'Active').length;
    const trials = clinics.filter((clinic) => clinic.status === 'Trial').length;
    const monthlyRevenue = clinics.reduce((sum, clinic) => sum + clinic.monthRevenue, 0);
    const todayVisits = clinics.reduce((sum, clinic) => sum + clinic.todayVisits, 0);
    const pending = clinics.reduce((sum, clinic) => sum + clinic.amountDue, 0);
    const expiring = clinics.filter((clinic) => clinic.trialDaysLeft !== null && clinic.trialDaysLeft <= 14).length;
    const support = warnings.length + clinics.filter((clinic) => clinic.status === 'Payment Due' || clinic.status === 'Suspended').length;
    const paid = clinics.filter((clinic) => clinic.status === 'Active' && clinic.monthRevenue > 0).length;
    return { active, trials, monthlyRevenue, todayVisits, pending, expiring, support, paid };
  }, [clinics, warnings.length]);

  const usageLists = useMemo(() => {
    const highUsage = [...clinics].sort((a, b) => b.monthlyVisits - a.monthlyVisits).slice(0, 5);
    const inactive = clinics.filter((clinic) => {
      const days = daysBetween(clinic.lastActive);
      return days !== null && days >= 14;
    }).sort((a, b) => (daysBetween(b.lastActive) || 0) - (daysBetween(a.lastActive) || 0)).slice(0, 5);
    const nearingLimit = clinics.filter((clinic) => clinic.monthlyVisits >= 80).sort((a, b) => b.monthlyVisits - a.monthlyVisits).slice(0, 5);
    const paymentDue = clinics.filter((clinic) => clinic.amountDue > 0).sort((a, b) => b.amountDue - a.amountDue).slice(0, 5);
    const trialEnding = clinics.filter((clinic) => clinic.trialDaysLeft !== null && clinic.trialDaysLeft <= 14).sort((a, b) => (a.trialDaysLeft || 0) - (b.trialDaysLeft || 0)).slice(0, 5);
    return { highUsage, inactive, nearingLimit, paymentDue, trialEnding };
  }, [clinics]);

  const recentPayments = useMemo(() => data.payments.slice(0, 8), [data.payments]);
  const patientMap = useMemo(() => new Map<string, Row>(data.patients.map((row): [string, Row] => [String(row.id || ''), row])), [data.patients]);

  return (
    <div className="saas-shell">
      <aside className="saas-sidebar">
        <div className="saas-brand"><div className="saas-mark">M</div><div><strong>MDMS Admin</strong><span>Company console</span></div></div>
        <nav className="saas-nav">
          <NavButton active={view === 'dashboard'} icon={<Activity size={17} />} label="Dashboard" onClick={() => setView('dashboard')} />
          <NavButton active={view === 'clinics'} icon={<Building2 size={17} />} label="Clinics" onClick={() => setView('clinics')} />
          <NavButton active={view === 'revenue'} icon={<WalletCards size={17} />} label="Revenue" onClick={() => setView('revenue')} />
          <NavButton active={view === 'usage'} icon={<HeartPulse size={17} />} label="Usage" onClick={() => setView('usage')} />
          <NavButton active={view === 'access'} icon={<ShieldCheck size={17} />} label="Access" onClick={() => setView('access')} />
        </nav>
        <div className="saas-sidebar-foot"><span>{lastUpdated ? `Updated ${lastUpdated}` : session.user.email}</span><button className="saas-ghost danger" onClick={onLogout}><LogOut size={16} /> Logout</button></div>
      </aside>

      <main className="saas-main">
        <header className="saas-topbar">
          <div><p className="saas-kicker">Super Admin</p><h1>{view === 'dashboard' ? 'Hospital network health' : view === 'clinics' ? 'Clinic management' : view === 'revenue' ? 'Revenue overview' : view === 'usage' ? 'Usage monitoring' : 'Access diagnosis'}</h1><span>Manage 100+ dental hospitals without visual noise.</span></div>
          <button className="saas-ghost" onClick={() => loadAll(true)} disabled={loading || refreshing}>{refreshing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Refresh</button>
        </header>

        {error && <StateNotice tone="danger" icon={<ShieldAlert size={18} />} title="Unable to load dashboard" text={error} />}
        {warnings.length > 0 && <StateNotice tone="warning" icon={<AlertTriangle size={18} />} title={`${warnings.length} data warning${warnings.length > 1 ? 's' : ''}`} text="Some optional sections may be unavailable. Core clinic view is still usable." />}
        {loading && <LoadingState />}

        {!loading && view === 'dashboard' && (
          <section className="saas-stack">
            <div className="saas-kpi-grid">
              <Kpi icon={<Building2 size={19} />} label="Total Clinics" value={count(clinics.length)} />
              <Kpi icon={<CheckCircle2 size={19} />} label="Active Clinics" value={count(totals.active)} tone="green" />
              <Kpi icon={<CalendarClock size={19} />} label="Trial Clinics" value={count(totals.trials)} tone="blue" />
              <Kpi icon={<WalletCards size={19} />} label="Monthly Revenue" value={money(totals.monthlyRevenue)} />
              <Kpi icon={<Stethoscope size={19} />} label="Today’s Visits" value={count(totals.todayVisits)} />
              <Kpi icon={<AlertTriangle size={19} />} label="Pending Payments" value={money(totals.pending)} tone="amber" />
              <Kpi icon={<CalendarClock size={19} />} label="Expiring Trials" value={count(totals.expiring)} tone="amber" />
              <Kpi icon={<ShieldAlert size={19} />} label="Support Issues" value={count(totals.support)} tone="red" />
            </div>
            <div className="saas-action-grid">
              <ActionCard icon={<Building2 size={20} />} title="Review clinics" text="Search, filter and open clinic profiles." action="Open Clinics" onClick={() => setView('clinics')} />
              <ActionCard icon={<WalletCards size={20} />} title="Check revenue" text="MRR, dues and recent payments." action="View Revenue" onClick={() => setView('revenue')} />
              <ActionCard icon={<HeartPulse size={20} />} title="Monitor usage" text="Find inactive, high-usage and trial-ending clinics." action="View Usage" onClick={() => setView('usage')} />
            </div>
          </section>
        )}

        {!loading && view === 'clinics' && (
          <section className="saas-stack">
            <Filters search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} planFilter={planFilter} setPlanFilter={setPlanFilter} cityFilter={cityFilter} setCityFilter={setCityFilter} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter} trialEndingSoon={trialEndingSoon} setTrialEndingSoon={setTrialEndingSoon} cities={cities} plans={plans} />
            <div className="saas-card"><div className="saas-card-head"><div><h2><Building2 size={18} /> Clinic Management</h2><p>{filteredClinics.length} clinics match the current view.</p></div><button className="saas-ghost" onClick={() => exportCsv('clinics', clinicExportRows(filteredClinics))}><Download size={16} /> Export</button></div>{filteredClinics.length ? <ClinicTable clinics={filteredClinics} onOpen={setSelectedClinicId} /> : <EmptyState icon={<Search size={22} />} title="No clinics found" text="Try clearing filters or searching by another owner, phone, city or clinic name." />}</div>
          </section>
        )}

        {!loading && view === 'revenue' && (
          <section className="saas-stack"><div className="saas-kpi-grid compact"><Kpi icon={<TrendingUp size={19} />} label="MRR" value={money(totals.monthlyRevenue)} /><Kpi icon={<CheckCircle2 size={19} />} label="Paid Clinics" value={count(totals.paid)} tone="green" /><Kpi icon={<AlertTriangle size={19} />} label="Pending Dues" value={money(totals.pending)} tone="amber" /><Kpi icon={<CalendarClock size={19} />} label="Trial → Paid" value={`${clinics.length ? Math.round((totals.paid / clinics.length) * 100) : 0}%`} tone="blue" /></div><div className="saas-two-col"><div className="saas-card"><div className="saas-card-head"><div><h2><TrendingUp size={18} /> Revenue chart</h2><p>Simple monthly collection signal.</p></div></div><RevenueBars clinics={clinics} /></div><div className="saas-card"><div className="saas-card-head"><div><h2><WalletCards size={18} /> Recent payments</h2><p>Latest collected payments.</p></div></div><PaymentList rows={recentPayments} patients={patientMap} /></div></div></section>
        )}

        {!loading && view === 'usage' && (
          <section className="saas-usage-grid"><UsageCard title="High usage" icon={<TrendingUp size={18} />} clinics={usageLists.highUsage} getMeta={(clinic) => `${clinic.monthlyVisits} visits this month`} onOpen={setSelectedClinicId} /><UsageCard title="Inactive clinics" icon={<AlertTriangle size={18} />} clinics={usageLists.inactive} getMeta={(clinic) => formatRelative(clinic.lastActive)} onOpen={setSelectedClinicId} /><UsageCard title="Nearing visit limit" icon={<Stethoscope size={18} />} clinics={usageLists.nearingLimit} getMeta={(clinic) => `${clinic.monthlyVisits}/100 visits`} onOpen={setSelectedClinicId} /><UsageCard title="Pending payments" icon={<WalletCards size={18} />} clinics={usageLists.paymentDue} getMeta={(clinic) => money(clinic.amountDue)} onOpen={setSelectedClinicId} /><UsageCard title="Trial ending soon" icon={<CalendarClock size={18} />} clinics={usageLists.trialEnding} getMeta={(clinic) => `${clinic.trialDaysLeft ?? 0} days left`} onOpen={setSelectedClinicId} /></section>
        )}

        {!loading && view === 'access' && (
          <section className="saas-card access-clean"><h2><ShieldCheck size={18} /> System access</h2><p>This panel uses the secure Cloudflare admin API with your master Supabase session. Service keys stay server-side.</p><div className="saas-kpi-grid compact"><Kpi icon={<ShieldCheck size={19} />} label="Master login" value="Active" tone="green" /><Kpi icon={<Building2 size={19} />} label="Clinics visible" value={count(clinics.length)} /><Kpi icon={<FileText size={19} />} label="Warnings" value={count(warnings.length)} tone={warnings.length ? 'amber' : 'green'} /></div></section>
        )}
      </main>

      {selectedClinic && <ClinicDrawer clinic={selectedClinic} data={data} onClose={() => setSelectedClinicId('')} />}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={active ? 'saas-nav-item active' : 'saas-nav-item'} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function Kpi({ icon, label, value, tone = 'default' }: { icon: ReactNode; label: string; value: string; tone?: string }) {
  return <article className={`saas-kpi ${tone}`}><div className="saas-kpi-icon">{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

function StateNotice({ icon, title, text, tone }: { icon: ReactNode; title: string; text: string; tone: 'warning' | 'danger' }) {
  return <div className={`saas-notice ${tone}`}>{icon}<div><strong>{title}</strong><span>{text}</span></div></div>;
}

function LoadingState() {
  return <div className="saas-kpi-grid">{Array.from({ length: 8 }).map((_, index) => <div className="saas-kpi skeleton-card" key={index}><span /><strong /></div>)}</div>;
}

function ActionCard({ icon, title, text, action, onClick }: { icon: ReactNode; title: string; text: string; action: string; onClick: () => void }) {
  return <button className="saas-action-card" onClick={onClick}><div>{icon}</div><strong>{title}</strong><span>{text}</span><em>{action}<ChevronRight size={15} /></em></button>;
}

function Filters(props: { search: string; setSearch: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; planFilter: string; setPlanFilter: (value: string) => void; cityFilter: string; setCityFilter: (value: string) => void; paymentFilter: string; setPaymentFilter: (value: string) => void; trialEndingSoon: boolean; setTrialEndingSoon: (value: boolean) => void; cities: string[]; plans: string[] }) {
  return <div className="saas-filter-card"><div className="saas-search"><Search size={18} /><input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Search clinic, owner, phone or city" /></div><div className="saas-filters"><label><Filter size={14} />Status<select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value)}><option>All</option><option>Active</option><option>Trial</option><option>Payment Due</option><option>Suspended</option></select></label><label>Plan<select value={props.planFilter} onChange={(event) => props.setPlanFilter(event.target.value)}>{props.plans.map((plan) => <option key={plan}>{plan}</option>)}</select></label><label>City<select value={props.cityFilter} onChange={(event) => props.setCityFilter(event.target.value)}>{props.cities.map((city) => <option key={city}>{city}</option>)}</select></label><label>Payment<select value={props.paymentFilter} onChange={(event) => props.setPaymentFilter(event.target.value)}><option>All</option><option value="Due">Due</option><option value="Clear">Clear</option></select></label><button className={props.trialEndingSoon ? 'saas-chip active' : 'saas-chip'} onClick={() => props.setTrialEndingSoon(!props.trialEndingSoon)} type="button"><CalendarClock size={14} /> Trial ending soon</button></div></div>;
}

function ClinicTable({ clinics, onOpen }: { clinics: ClinicModel[]; onOpen: (id: string) => void }) {
  return <div className="clinic-table-wrap"><table className="clinic-table"><thead><tr><th>Clinic Name</th><th>Owner Name</th><th>Phone</th><th>City</th><th>Plan</th><th>Status</th><th>Monthly Visits</th><th>Amount Due</th><th>Last Active</th><th>Actions</th></tr></thead><tbody>{clinics.map((clinic) => <tr key={clinic.id}><td data-label="Clinic Name"><strong>{clinic.name}</strong></td><td data-label="Owner Name">{clinic.ownerName}</td><td data-label="Phone"><Phone size={13} /> {clinic.phone}</td><td data-label="City"><MapPin size={13} /> {clinic.city}</td><td data-label="Plan">{clinic.plan}</td><td data-label="Status"><Badge tone={clinic.statusTone}>{clinic.status}</Badge></td><td data-label="Monthly Visits">{count(clinic.monthlyVisits)}</td><td data-label="Amount Due">{money(clinic.amountDue)}</td><td data-label="Last Active">{formatRelative(clinic.lastActive)}</td><td data-label="Actions"><button className="saas-link-button" onClick={() => onOpen(clinic.id)}>View details</button></td></tr>)}</tbody></table></div>;
}

function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`saas-badge ${tone}`}>{children}</span>;
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="saas-empty">{icon}<strong>{title}</strong><span>{text}</span></div>;
}

function RevenueBars({ clinics }: { clinics: ClinicModel[] }) {
  const top = [...clinics].sort((a, b) => b.monthRevenue - a.monthRevenue).slice(0, 6);
  const max = Math.max(1, ...top.map((clinic) => clinic.monthRevenue));
  if (!top.length) return <EmptyState icon={<WalletCards size={22} />} title="No revenue yet" text="Payments will appear here after clinics start collecting." />;
  return <div className="revenue-bars">{top.map((clinic) => <div className="revenue-bar-row" key={clinic.id}><span>{clinic.name}</span><div><i style={{ width: `${Math.max(6, (clinic.monthRevenue / max) * 100)}%` }} /></div><strong>{money(clinic.monthRevenue)}</strong></div>)}</div>;
}

function PaymentList({ rows, patients }: { rows: Row[]; patients: Map<string, Row> }) {
  if (!rows.length) return <EmptyState icon={<WalletCards size={22} />} title="No recent payments" text="Recent collections will appear here." />;
  return <div className="simple-list">{rows.map((row, index) => <div key={String(row.id || index)}><span>{patientLabel(patients.get(String(row.patient_id || '')))}</span><strong>{money(row.amount)}</strong><small>{formatDate(parseDate(row.created_at))}</small></div>)}</div>;
}

function UsageCard({ title, icon, clinics, getMeta, onOpen }: { title: string; icon: ReactNode; clinics: ClinicModel[]; getMeta: (clinic: ClinicModel) => string; onOpen: (id: string) => void }) {
  return <div className="saas-card"><div className="saas-card-head"><div><h2>{icon}{title}</h2></div></div>{clinics.length ? <div className="simple-list clickable">{clinics.map((clinic) => <button key={clinic.id} onClick={() => onOpen(clinic.id)}><span>{clinic.name}</span><strong>{getMeta(clinic)}</strong><small>{clinic.city}</small></button>)}</div> : <EmptyState icon={icon} title="Nothing to review" text="This group is currently clean." />}</div>;
}

function ClinicDrawer({ clinic, data, onClose }: { clinic: ClinicModel; data: DataSet; onClose: () => void }) {
  const exportRows = buildDetailExport(clinic, data);
  const activity = [
    ...data.patient_visits.filter((row) => rowClinicId(row) === clinic.id).map((row) => ({ label: 'Visit added', text: asText(row.chief_complaint, 'Visit recorded'), date: parseDate(row.visit_date || row.created_at) })),
    ...data.payments.filter((row) => rowClinicId(row) === clinic.id).map((row) => ({ label: 'Payment collected', text: money(row.amount), date: parseDate(row.created_at) })),
    ...data.appointments.filter((row) => rowClinicId(row) === clinic.id).map((row) => ({ label: 'Appointment', text: asText(row.status, 'Scheduled'), date: parseDate(row.appointment_time || row.created_at) })),
  ].filter((item) => item.date).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)).slice(0, 6);

  return <div className="drawer-backdrop" onClick={onClose}><aside className="clinic-drawer" onClick={(event) => event.stopPropagation()}><header><div><Badge tone={clinic.statusTone}>{clinic.status}</Badge><h2>{clinic.name}</h2><p>{clinic.city} • {clinic.plan}</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><section className="drawer-section"><h3>Clinic profile</h3><div className="profile-grid"><span>Owner<strong>{clinic.ownerName}</strong></span><span>Phone<strong>{clinic.phone}</strong></span><span>Address<strong>{clinic.address}</strong></span><span>Last active<strong>{formatRelative(clinic.lastActive)}</strong></span></div></section><section className="drawer-metrics"><Kpi icon={<Users size={18} />} label="Staff" value={count(clinic.staffCount)} /><Kpi icon={<Users size={18} />} label="Patients" value={count(clinic.patientCount)} /><Kpi icon={<Stethoscope size={18} />} label="Monthly visits" value={count(clinic.monthlyVisits)} /><Kpi icon={<WalletCards size={18} />} label="Revenue" value={money(clinic.monthRevenue)} /></section><section className="drawer-section"><h3>Subscription</h3><div className="profile-grid"><span>Plan<strong>{clinic.plan}</strong></span><span>Amount due<strong>{money(clinic.amountDue)}</strong></span><span>Trial status<strong>{clinic.trialDaysLeft === null ? 'Not on trial' : `${clinic.trialDaysLeft} days left`}</strong></span><span>Created<strong>{formatDate(clinic.createdAt)}</strong></span></div></section><section className="drawer-section"><h3>Recent activity</h3>{activity.length ? <div className="activity-list">{activity.map((item, index) => <div key={index}><span>{item.label}</span><strong>{item.text}</strong><small>{formatDate(item.date)}</small></div>)}</div> : <EmptyState icon={<Activity size={20} />} title="No recent activity" text="Nothing recent to show for this clinic." />}</section><footer><button className="saas-ghost" onClick={() => exportCsv(`${clinic.name}-visits`, exportRows)}><Download size={16} /> Export data</button><button className="saas-ghost danger" title="Connect write API before enabling this action"><ShieldAlert size={16} /> {clinic.status === 'Suspended' ? 'Reactivate' : 'Suspend'}</button></footer></aside></div>;
}
