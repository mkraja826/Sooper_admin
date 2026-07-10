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
  FileImage,
  FileText,
  Filter,
  HeartPulse,
  Image,
  IndianRupee,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

type Props = { session: Session; onLogout: () => void };
type Row = Record<string, unknown>;
type View = 'dashboard' | 'clinics' | 'revenue' | 'usage' | 'access';
type TableName =
  | 'clinics'
  | 'profiles'
  | 'patients'
  | 'appointments'
  | 'patient_visits'
  | 'payments'
  | 'invoices'
  | 'files'
  | 'staff_invites'
  | 'website_appointments';
type ClinicStatus = 'Active' | 'Trial' | 'Payment Due' | 'Suspended';
type DataSet = Record<TableName, Row[]>;

type ClinicModel = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  logoUrl: string;
  brandColor: string;
  active: boolean;
  patientPhotosEnabled: boolean;
  medicationsEnabled: boolean;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerRole: string;
  plan: string;
  status: ClinicStatus;
  statusTone: string;
  monthlyVisits: number;
  todayVisits: number;
  totalVisits: number;
  appointmentCount: number;
  todayAppointments: number;
  upcomingAppointments: number;
  amountDue: number;
  totalBilled: number;
  totalPaid: number;
  monthRevenue: number;
  totalRevenue: number;
  staffCount: number;
  activeStaffCount: number;
  patientCount: number;
  fileCount: number;
  inviteCount: number;
  pendingInviteCount: number;
  lastActive: Date | null;
  createdAt: Date | null;
  trialDaysLeft: number | null;
};

const TABLES: TableName[] = [
  'clinics',
  'profiles',
  'patients',
  'appointments',
  'patient_visits',
  'payments',
  'invoices',
  'files',
  'staff_invites',
  'website_appointments',
];

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

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
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

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
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

function formatDateTime(value: Date | null) {
  return value ? value.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
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
  return 'Not configured';
}

function buildClinics(data: DataSet) {
  const month = startOfMonth();
  const today = startOfToday();
  const tomorrow = endOfToday();
  const now = new Date();

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
    const fileRows = data.files.filter((row) => rowClinicId(row) === id);
    const inviteRows = data.staff_invites.filter((row) => rowClinicId(row) === id);

    const monthlyVisits = visitRows.filter((row) => {
      const date = parseDate(row.visit_date || row.created_at);
      return date ? date >= month : false;
    }).length;

    const todayVisits = visitRows.filter((row) => {
      const date = parseDate(row.visit_date || row.created_at);
      return date ? date >= today && date < tomorrow : false;
    }).length;

    const todayAppointments = appointmentRows.filter((row) => {
      const date = parseDate(row.appointment_time || row.created_at);
      return date ? date >= today && date < tomorrow : false;
    }).length;

    const upcomingAppointments = appointmentRows.filter((row) => {
      const date = parseDate(row.appointment_time);
      return date ? date >= now : false;
    }).length;

    const monthRevenue = paymentRows
      .filter((row) => {
        const date = parseDate(row.created_at);
        return date ? date >= month : false;
      })
      .reduce((sum, row) => sum + asNumber(row.amount), 0);

    const totalRevenue = paymentRows.reduce((sum, row) => sum + asNumber(row.amount), 0);
    const amountDue = invoiceRows.reduce((sum, row) => sum + asNumber(row.due_amount), 0);
    const totalBilled = invoiceRows.reduce((sum, row) => sum + asNumber(row.total_amount), 0);
    const totalPaid = invoiceRows.reduce((sum, row) => sum + asNumber(row.paid_amount), 0);
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
      ...fileRows.map((row) => parseDate(row.created_at)),
    ].filter((date): date is Date => Boolean(date));
    const lastActive = activityDates.length ? new Date(Math.max(...activityDates.map((date) => date.getTime()))) : createdAt;

    return {
      id,
      name: asText(clinic.name, 'Unnamed clinic'),
      email: asText(clinic.email, '—'),
      phone: asText(clinic.phone || owner?.phone, '—'),
      address: asText(clinic.address, '—'),
      city: cityFrom(clinic),
      logoUrl: asText(clinic.logo_url, ''),
      brandColor: asText(clinic.brand_color, '#2563eb'),
      active: asBoolean(clinic.active, true),
      patientPhotosEnabled: asBoolean(clinic.enable_patient_photos),
      medicationsEnabled: asBoolean(clinic.enable_prescription_medications),
      ownerName: asText(owner?.name || owner?.email, 'Owner not added'),
      ownerEmail: asText(owner?.email, '—'),
      ownerPhone: asText(owner?.phone, '—'),
      ownerRole: asText(owner?.role, '—'),
      plan: derivePlan(clinic, status),
      status,
      statusTone: toneForStatus(status),
      monthlyVisits,
      todayVisits,
      totalVisits: visitRows.length,
      appointmentCount: appointmentRows.length,
      todayAppointments,
      upcomingAppointments,
      amountDue,
      totalBilled,
      totalPaid,
      monthRevenue,
      totalRevenue,
      staffCount: staffRows.length,
      activeStaffCount: staffRows.filter((row) => row.active !== false).length,
      patientCount: patientRows.length,
      fileCount: fileRows.length,
      inviteCount: inviteRows.length,
      pendingInviteCount: inviteRows.filter((row) => !row.accepted_at).length,
      lastActive,
      createdAt,
      trialDaysLeft,
    } as ClinicModel;
  }).sort((a, b) => (b.lastActive?.getTime() || 0) - (a.lastActive?.getTime() || 0));
}

function clinicExportRows(clinics: ClinicModel[]) {
  return clinics.map((clinic) => ({
    'Clinic ID': clinic.id,
    'Clinic Name': clinic.name,
    'Clinic Email': clinic.email,
    'Clinic Phone': clinic.phone,
    Address: clinic.address,
    City: clinic.city,
    'Owner Name': clinic.ownerName,
    'Owner Email': clinic.ownerEmail,
    'Owner Phone': clinic.ownerPhone,
    'Owner Role': clinic.ownerRole,
    Active: clinic.active ? 'Yes' : 'No',
    Plan: clinic.plan,
    Status: clinic.status,
    'Patient Photos': clinic.patientPhotosEnabled ? 'Enabled' : 'Disabled',
    'Prescription Medications': clinic.medicationsEnabled ? 'Enabled' : 'Disabled',
    Staff: clinic.staffCount,
    Patients: clinic.patientCount,
    'Total Visits': clinic.totalVisits,
    'Monthly Visits': clinic.monthlyVisits,
    Appointments: clinic.appointmentCount,
    Files: clinic.fileCount,
    'Total Billed': clinic.totalBilled,
    'Total Collected': clinic.totalRevenue,
    'Amount Due': clinic.amountDue,
    'Created At': clinic.createdAt?.toISOString() || '',
    'Last Active': clinic.lastActive?.toISOString() || '',
  }));
}

function patientLabel(row: Row | undefined) {
  if (!row) return '—';
  return [asText(row.patient_code || row.code, 'No patient ID'), asText(row.name, 'Unnamed patient'), asText(row.phone, '')].filter(Boolean).join(' • ');
}

export default function SuperAdminDashboardV2({ session, onLogout }: Props) {
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
        nextWarnings.push(err instanceof Error ? `${table}: ${err.message}` : `${table} could not load`);
      }
    }));

    setData(nextData);
    setWarnings(nextWarnings.filter((warning) => !warning.toLowerCase().includes('unknown table')));
    setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    setRefreshing(false);
    setLoading(false);
  }

  useEffect(() => {
    loadAll().catch((err) => {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard');
      setLoading(false);
    });
  }, []);

  const clinics = useMemo(() => buildClinics(data), [data]);
  const selectedClinic = clinics.find((clinic) => clinic.id === selectedClinicId) || null;
  const cities = useMemo(() => ['All', ...Array.from(new Set(clinics.map((clinic) => clinic.city).filter(Boolean))).sort()], [clinics]);
  const plans = useMemo(() => ['All', ...Array.from(new Set(clinics.map((clinic) => clinic.plan).filter(Boolean))).sort()], [clinics]);

  const filteredClinics = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clinics.filter((clinic) => {
      const searchOk = !term || [clinic.name, clinic.ownerName, clinic.email, clinic.phone, clinic.city, clinic.address].join(' ').toLowerCase().includes(term);
      const statusOk = statusFilter === 'All' || clinic.status === statusFilter;
      const planOk = planFilter === 'All' || clinic.plan === planFilter;
      const cityOk = cityFilter === 'All' || clinic.city === cityFilter;
      const paymentOk = paymentFilter === 'All' || (paymentFilter === 'Due' ? clinic.amountDue > 0 : clinic.amountDue <= 0);
      const trialOk = !trialEndingSoon || (clinic.trialDaysLeft !== null && clinic.trialDaysLeft <= 14);
      return searchOk && statusOk && planOk && cityOk && paymentOk && trialOk;
    });
  }, [clinics, search, statusFilter, planFilter, cityFilter, paymentFilter, trialEndingSoon]);

  const totals = useMemo(() => {
    const active = clinics.filter((clinic) => clinic.active).length;
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
          <div><p className="saas-kicker">Super Admin</p><h1>{view === 'dashboard' ? 'Hospital network health' : view === 'clinics' ? 'Complete clinic directory' : view === 'revenue' ? 'Revenue overview' : view === 'usage' ? 'Usage monitoring' : 'Access diagnosis'}</h1><span>Every clinic, owner, feature, usage and financial detail in one place.</span></div>
          <button className="saas-ghost" onClick={() => loadAll(true)} disabled={loading || refreshing}>{refreshing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Refresh</button>
        </header>

        {error && <StateNotice tone="danger" icon={<ShieldAlert size={18} />} title="Unable to load dashboard" text={error} />}
        {warnings.length > 0 && <StateNotice tone="warning" icon={<AlertTriangle size={18} />} title={`${warnings.length} data warning${warnings.length > 1 ? 's' : ''}`} text="Some optional sections may be unavailable. Core clinic data is still shown." />}
        {loading && <LoadingState />}

        {!loading && view === 'dashboard' && (
          <section className="saas-stack">
            <div className="saas-kpi-grid">
              <Kpi icon={<Building2 size={19} />} label="Total Clinics" value={count(clinics.length)} />
              <Kpi icon={<CheckCircle2 size={19} />} label="Active Clinics" value={count(totals.active)} tone="green" />
              <Kpi icon={<CalendarClock size={19} />} label="Trial Clinics" value={count(totals.trials)} tone="blue" />
              <Kpi icon={<WalletCards size={19} />} label="Monthly Revenue" value={money(totals.monthlyRevenue)} />
              <Kpi icon={<Stethoscope size={19} />} label="Today’s Visits" value={count(totals.todayVisits)} />
              <Kpi icon={<AlertTriangle size={19} />} label="Patient Dues" value={money(totals.pending)} tone="amber" />
              <Kpi icon={<CalendarClock size={19} />} label="Expiring Trials" value={count(totals.expiring)} tone="amber" />
              <Kpi icon={<ShieldAlert size={19} />} label="Support Signals" value={count(totals.support)} tone="red" />
            </div>
            <div className="saas-action-grid">
              <ActionCard icon={<Building2 size={20} />} title="Review every clinic" text="Open complete profiles with owner, features, staff, usage and finance." action="Open Clinics" onClick={() => setView('clinics')} />
              <ActionCard icon={<WalletCards size={20} />} title="Check revenue" text="Collections, patient dues and recent payments." action="View Revenue" onClick={() => setView('revenue')} />
              <ActionCard icon={<HeartPulse size={20} />} title="Monitor usage" text="Find inactive, high-usage and trial-ending clinics." action="View Usage" onClick={() => setView('usage')} />
            </div>
          </section>
        )}

        {!loading && view === 'clinics' && (
          <section className="saas-stack">
            <Filters search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} planFilter={planFilter} setPlanFilter={setPlanFilter} cityFilter={cityFilter} setCityFilter={setCityFilter} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter} trialEndingSoon={trialEndingSoon} setTrialEndingSoon={setTrialEndingSoon} cities={cities} plans={plans} />
            <div className="saas-card">
              <div className="saas-card-head"><div><h2><Building2 size={18} /> Clinic Management</h2><p>{filteredClinics.length} clinics match the current view. Select a clinic to see its complete details.</p></div><button className="saas-ghost" onClick={() => exportCsv('all-clinic-details', clinicExportRows(filteredClinics))}><Download size={16} /> Export all details</button></div>
              {filteredClinics.length ? <ClinicTable clinics={filteredClinics} onOpen={setSelectedClinicId} /> : <EmptyState icon={<Search size={22} />} title="No clinics found" text="Try clearing filters or searching by clinic, owner, email, phone, city or address." />}
            </div>
          </section>
        )}

        {!loading && view === 'revenue' && (
          <section className="saas-stack"><div className="saas-kpi-grid compact"><Kpi icon={<TrendingUp size={19} />} label="Monthly Collections" value={money(totals.monthlyRevenue)} /><Kpi icon={<CheckCircle2 size={19} />} label="Collecting Clinics" value={count(totals.paid)} tone="green" /><Kpi icon={<AlertTriangle size={19} />} label="Patient Dues" value={money(totals.pending)} tone="amber" /><Kpi icon={<CalendarClock size={19} />} label="Trial → Collecting" value={`${clinics.length ? Math.round((totals.paid / clinics.length) * 100) : 0}%`} tone="blue" /></div><div className="saas-two-col"><div className="saas-card"><div className="saas-card-head"><div><h2><TrendingUp size={18} /> Clinic collections</h2><p>Current month collections by clinic.</p></div></div><RevenueBars clinics={clinics} /></div><div className="saas-card"><div className="saas-card-head"><div><h2><WalletCards size={18} /> Recent payments</h2><p>Latest patient collections.</p></div></div><PaymentList rows={recentPayments} patients={patientMap} /></div></div></section>
        )}

        {!loading && view === 'usage' && (
          <section className="saas-usage-grid"><UsageCard title="High usage" icon={<TrendingUp size={18} />} clinics={usageLists.highUsage} getMeta={(clinic) => `${clinic.monthlyVisits} visits this month`} onOpen={setSelectedClinicId} /><UsageCard title="Inactive clinics" icon={<AlertTriangle size={18} />} clinics={usageLists.inactive} getMeta={(clinic) => formatRelative(clinic.lastActive)} onOpen={setSelectedClinicId} /><UsageCard title="Nearing visit limit" icon={<Stethoscope size={18} />} clinics={usageLists.nearingLimit} getMeta={(clinic) => `${clinic.monthlyVisits}/100 visits`} onOpen={setSelectedClinicId} /><UsageCard title="Patient dues" icon={<WalletCards size={18} />} clinics={usageLists.paymentDue} getMeta={(clinic) => money(clinic.amountDue)} onOpen={setSelectedClinicId} /><UsageCard title="Trial ending soon" icon={<CalendarClock size={18} />} clinics={usageLists.trialEnding} getMeta={(clinic) => `${clinic.trialDaysLeft ?? 0} days left`} onOpen={setSelectedClinicId} /></section>
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
  return <div className="saas-filter-card"><div className="saas-search"><Search size={18} /><input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Search clinic, owner, email, phone, city or address" /></div><div className="saas-filters"><label><Filter size={14} />Status<select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value)}><option>All</option><option>Active</option><option>Trial</option><option>Payment Due</option><option>Suspended</option></select></label><label>Plan<select value={props.planFilter} onChange={(event) => props.setPlanFilter(event.target.value)}>{props.plans.map((plan) => <option key={plan}>{plan}</option>)}</select></label><label>City<select value={props.cityFilter} onChange={(event) => props.setCityFilter(event.target.value)}>{props.cities.map((city) => <option key={city}>{city}</option>)}</select></label><label>Payment<select value={props.paymentFilter} onChange={(event) => props.setPaymentFilter(event.target.value)}><option>All</option><option value="Due">Due</option><option value="Clear">Clear</option></select></label><button className={props.trialEndingSoon ? 'saas-chip active' : 'saas-chip'} onClick={() => props.setTrialEndingSoon(!props.trialEndingSoon)} type="button"><CalendarClock size={14} /> Trial ending soon</button></div></div>;
}

function ClinicLogo({ clinic, compact = false }: { clinic: ClinicModel; compact?: boolean }) {
  const initials = clinic.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C';
  return <div className={compact ? 'clinic-logo compact' : 'clinic-logo'} style={{ background: clinic.brandColor }}>{clinic.logoUrl ? <img src={clinic.logoUrl} alt="" /> : <span>{initials}</span>}</div>;
}

function ClinicTable({ clinics, onOpen }: { clinics: ClinicModel[]; onOpen: (id: string) => void }) {
  return <div className="clinic-table-wrap"><table className="clinic-table clinic-table-complete"><thead><tr><th>Clinic</th><th>Owner</th><th>Contact</th><th>Status</th><th>Features</th><th>Staff</th><th>Patients</th><th>Visits</th><th>Collected</th><th>Due</th><th>Action</th></tr></thead><tbody>{clinics.map((clinic) => <tr key={clinic.id}><td data-label="Clinic"><button className="clinic-name-cell" onClick={() => onOpen(clinic.id)}><ClinicLogo clinic={clinic} compact /><span><strong>{clinic.name}</strong><small>{clinic.city} • {clinic.email}</small></span></button></td><td data-label="Owner"><strong>{clinic.ownerName}</strong><small>{clinic.ownerRole}</small></td><td data-label="Contact"><span className="inline-detail"><Phone size={13} />{clinic.phone}</span><small>{clinic.address}</small></td><td data-label="Status"><Badge tone={clinic.statusTone}>{clinic.status}</Badge><small>{clinic.plan}</small></td><td data-label="Features"><div className="feature-mini"><Badge tone={clinic.patientPhotosEnabled ? 'green' : 'muted'}>Photos</Badge><Badge tone={clinic.medicationsEnabled ? 'green' : 'muted'}>Medicines</Badge></div></td><td data-label="Staff">{count(clinic.activeStaffCount)}/{count(clinic.staffCount)}</td><td data-label="Patients">{count(clinic.patientCount)}</td><td data-label="Visits"><strong>{count(clinic.monthlyVisits)}</strong><small>{count(clinic.totalVisits)} total</small></td><td data-label="Collected">{money(clinic.totalRevenue)}</td><td data-label="Due">{money(clinic.amountDue)}</td><td data-label="Action"><button className="saas-link-button" onClick={() => onOpen(clinic.id)}>View all details</button></td></tr>)}</tbody></table></div>;
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

function InfoItem({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return <span>{icon ? <i>{icon}</i> : null}<small>{label}</small><strong>{value}</strong></span>;
}

function FeatureCard({ enabled, icon, title, text }: { enabled: boolean; icon: ReactNode; title: string; text: string }) {
  return <div className={enabled ? 'feature-card enabled' : 'feature-card'}><div>{icon}</div><span><strong>{title}</strong><small>{text}</small></span><Badge tone={enabled ? 'green' : 'muted'}>{enabled ? 'Enabled' : 'Disabled'}</Badge></div>;
}

function ClinicDrawer({ clinic, data, onClose }: { clinic: ClinicModel; data: DataSet; onClose: () => void }) {
  const staff = data.profiles.filter((row) => rowClinicId(row) === clinic.id).sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')));
  const patients = data.patients.filter((row) => rowClinicId(row) === clinic.id);
  const visits = data.patient_visits.filter((row) => rowClinicId(row) === clinic.id);
  const appointments = data.appointments.filter((row) => rowClinicId(row) === clinic.id);
  const payments = data.payments.filter((row) => rowClinicId(row) === clinic.id);
  const invoices = data.invoices.filter((row) => rowClinicId(row) === clinic.id);
  const files = data.files.filter((row) => rowClinicId(row) === clinic.id);
  const invites = data.staff_invites.filter((row) => rowClinicId(row) === clinic.id);
  const patientMap = new Map<string, Row>(patients.map((row): [string, Row] => [String(row.id || ''), row]));

  const activity = [
    ...visits.map((row) => ({ label: 'Visit added', text: asText(row.chief_complaint, 'Visit recorded'), date: parseDate(row.visit_date || row.created_at) })),
    ...payments.map((row) => ({ label: 'Payment collected', text: `${money(row.amount)} • ${asText(row.payment_category, 'Payment')}`, date: parseDate(row.created_at) })),
    ...appointments.map((row) => ({ label: 'Appointment', text: `${asText(row.status, 'Scheduled')} • ${patientLabel(patientMap.get(String(row.patient_id || '')))}`, date: parseDate(row.appointment_time || row.created_at) })),
    ...files.map((row) => ({ label: 'File uploaded', text: `${asText(row.file_type, 'File')} • ${asText(row.file_name, '')}`, date: parseDate(row.created_at) })),
  ].filter((item) => item.date).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)).slice(0, 10);

  const exportRows: Row[] = [{
    'Clinic ID': clinic.id,
    'Clinic Name': clinic.name,
    'Clinic Email': clinic.email,
    'Clinic Phone': clinic.phone,
    Address: clinic.address,
    City: clinic.city,
    'Brand Color': clinic.brandColor,
    'Logo URL': clinic.logoUrl,
    Active: clinic.active ? 'Yes' : 'No',
    'Owner Name': clinic.ownerName,
    'Owner Email': clinic.ownerEmail,
    'Owner Phone': clinic.ownerPhone,
    'Owner Role': clinic.ownerRole,
    'Patient Photos': clinic.patientPhotosEnabled ? 'Enabled' : 'Disabled',
    'Prescription Medications': clinic.medicationsEnabled ? 'Enabled' : 'Disabled',
    'Staff Count': clinic.staffCount,
    'Active Staff': clinic.activeStaffCount,
    Patients: clinic.patientCount,
    'Total Visits': clinic.totalVisits,
    'Monthly Visits': clinic.monthlyVisits,
    'Today Visits': clinic.todayVisits,
    Appointments: clinic.appointmentCount,
    'Today Appointments': clinic.todayAppointments,
    'Upcoming Appointments': clinic.upcomingAppointments,
    Files: clinic.fileCount,
    Invites: clinic.inviteCount,
    'Pending Invites': clinic.pendingInviteCount,
    'Total Billed': clinic.totalBilled,
    'Invoice Paid': clinic.totalPaid,
    'Actual Collections': clinic.totalRevenue,
    'Current Month Collections': clinic.monthRevenue,
    'Patient Due': clinic.amountDue,
    'Created At': clinic.createdAt?.toISOString() || '',
    'Last Active': clinic.lastActive?.toISOString() || '',
  }];

  return <div className="drawer-backdrop" onClick={onClose}><aside className="clinic-drawer clinic-drawer-wide" onClick={(event) => event.stopPropagation()}>
    <header className="clinic-detail-header"><div className="clinic-detail-identity"><ClinicLogo clinic={clinic} /><div><div className="clinic-status-row"><Badge tone={clinic.statusTone}>{clinic.status}</Badge><Badge tone={clinic.active ? 'green' : 'red'}>{clinic.active ? 'Database active' : 'Database inactive'}</Badge></div><h2>{clinic.name}</h2><p>{clinic.city} • {clinic.plan} • ID {clinic.id.slice(0, 8)}</p></div></div><button className="icon-button" onClick={onClose} aria-label="Close clinic details"><X size={18} /></button></header>

    <section className="drawer-section"><div className="section-title"><div><h3>Clinic profile</h3><p>All fields stored on the clinic record.</p></div></div><div className="profile-grid profile-grid-detailed"><InfoItem icon={<Building2 size={15} />} label="Clinic name" value={clinic.name} /><InfoItem icon={<Mail size={15} />} label="Clinic email" value={clinic.email} /><InfoItem icon={<Phone size={15} />} label="Clinic phone" value={clinic.phone} /><InfoItem icon={<MapPin size={15} />} label="City" value={clinic.city} /><InfoItem icon={<MapPin size={15} />} label="Full address" value={clinic.address} /><InfoItem label="Clinic ID" value={clinic.id} /><InfoItem label="Brand colour" value={<span className="brand-value"><i style={{ background: clinic.brandColor }} />{clinic.brandColor}</span>} /><InfoItem label="Created" value={formatDateTime(clinic.createdAt)} /><InfoItem label="Last activity" value={`${formatRelative(clinic.lastActive)} • ${formatDateTime(clinic.lastActive)}`} /></div></section>

    <section className="drawer-section"><div className="section-title"><div><h3>Owner / head doctor</h3><p>Primary clinic owner resolved from the staff profiles.</p></div></div><div className="owner-card"><div className="owner-avatar"><UserRound size={22} /></div><div><strong>{clinic.ownerName}</strong><span>{clinic.ownerRole}</span></div><div className="owner-contact"><span><Mail size={14} />{clinic.ownerEmail}</span><span><Phone size={14} />{clinic.ownerPhone}</span></div></div></section>

    <section className="drawer-section"><div className="section-title"><div><h3>Optional clinic features</h3><p>Settings selected by the clinic owner.</p></div></div><div className="feature-grid"><FeatureCard enabled={clinic.patientPhotosEnabled} icon={<Image size={19} />} title="Patient photos" text="Reception can view and capture patient profile photos." /><FeatureCard enabled={clinic.medicationsEnabled} icon={<Pill size={19} />} title="Prescription medications" text="Reception can enter and reuse prescribed tablet names." /></div></section>

    <section className="drawer-section"><div className="section-title"><div><h3>Operational totals</h3><p>Counts across this clinic only.</p></div></div><div className="detail-metric-grid"><DetailMetric icon={<Users size={18} />} label="Staff" value={count(clinic.staffCount)} meta={`${clinic.activeStaffCount} active`} /><DetailMetric icon={<UserRound size={18} />} label="Patients" value={count(clinic.patientCount)} meta="Registered" /><DetailMetric icon={<Stethoscope size={18} />} label="Visits" value={count(clinic.totalVisits)} meta={`${clinic.monthlyVisits} this month • ${clinic.todayVisits} today`} /><DetailMetric icon={<CalendarClock size={18} />} label="Appointments" value={count(clinic.appointmentCount)} meta={`${clinic.todayAppointments} today • ${clinic.upcomingAppointments} upcoming`} /><DetailMetric icon={<FileImage size={18} />} label="Patient files" value={count(clinic.fileCount)} meta="Prescriptions, X-rays and photos" /><DetailMetric icon={<Mail size={18} />} label="Staff invites" value={count(clinic.inviteCount)} meta={`${clinic.pendingInviteCount} pending`} /></div></section>

    <section className="drawer-section"><div className="section-title"><div><h3>Clinic finance</h3><p>Patient billing and collections recorded by this clinic.</p></div></div><div className="detail-metric-grid"><DetailMetric icon={<FileText size={18} />} label="Total billed" value={money(clinic.totalBilled)} meta={`${invoices.length} invoices`} /><DetailMetric icon={<IndianRupee size={18} />} label="Invoice paid" value={money(clinic.totalPaid)} meta="Paid amount on invoices" /><DetailMetric icon={<WalletCards size={18} />} label="Actual collections" value={money(clinic.totalRevenue)} meta={`${payments.length} payment entries`} /><DetailMetric icon={<TrendingUp size={18} />} label="This month" value={money(clinic.monthRevenue)} meta="Current month collections" /><DetailMetric icon={<AlertTriangle size={18} />} label="Patient due" value={money(clinic.amountDue)} meta="Outstanding invoice amount" tone={clinic.amountDue > 0 ? 'amber' : 'green'} /><DetailMetric icon={<CalendarClock size={18} />} label="Trial" value={clinic.trialDaysLeft === null ? 'Completed' : `${clinic.trialDaysLeft} days`} meta={clinic.trialDaysLeft === null ? 'Not in first 90 days' : 'Remaining in inferred trial'} /></div></section>

    <section className="drawer-section"><div className="section-title"><div><h3>Staff directory</h3><p>Every owner, doctor and receptionist linked to this clinic.</p></div><Badge tone="blue">{staff.length} staff</Badge></div>{staff.length ? <div className="staff-list">{staff.map((person, index) => <div key={String(person.id || index)}><div className="staff-avatar"><UserRound size={17} /></div><div><strong>{asText(person.name, 'Unnamed staff')}</strong><span>{asText(person.role, 'No role')}</span></div><div className="staff-contact"><span>{asText(person.email)}</span><small>{asText(person.phone)}</small></div><Badge tone={person.active === false ? 'red' : 'green'}>{person.active === false ? 'Inactive' : 'Active'}</Badge></div>)}</div> : <EmptyState icon={<Users size={20} />} title="No staff profiles" text="No staff record is currently linked to this clinic." />}</section>

    <section className="drawer-section"><div className="section-title"><div><h3>Recent clinic activity</h3><p>Visits, appointments, payments and file uploads.</p></div></div>{activity.length ? <div className="activity-list clinic-activity-list">{activity.map((item, index) => <div key={index}><span>{item.label}</span><strong>{item.text}</strong><small>{formatDateTime(item.date)}</small></div>)}</div> : <EmptyState icon={<Activity size={20} />} title="No recent activity" text="Nothing recent to show for this clinic." />}</section>

    <section className="drawer-section"><div className="section-title"><div><h3>Data coverage</h3><p>Raw records currently loaded for this clinic.</p></div></div><div className="coverage-row"><span>{patients.length} patients</span><span>{visits.length} visits</span><span>{appointments.length} appointments</span><span>{invoices.length} invoices</span><span>{payments.length} payments</span><span>{files.length} files</span><span>{invites.length} invites</span></div></section>

    <footer><button className="saas-ghost" onClick={() => exportCsv(`${clinic.name}-complete-details`, exportRows)}><Download size={16} /> Export clinic details</button><button className="saas-ghost danger" title="Write access is intentionally disabled until a protected admin mutation endpoint is added"><ShieldAlert size={16} /> {clinic.status === 'Suspended' ? 'Reactivate' : 'Suspend'}</button></footer>
  </aside></div>;
}

function DetailMetric({ icon, label, value, meta, tone = '' }: { icon: ReactNode; label: string; value: string; meta: string; tone?: string }) {
  return <div className={`detail-metric ${tone}`}><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div>;
}
