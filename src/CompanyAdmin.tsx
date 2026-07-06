import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Activity,
  Building2,
  CalendarClock,
  Database,
  Download,
  FileText,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Users,
  WalletCards,
} from 'lucide-react';
import { supabase } from './supabaseClient';

type Props = { session: Session; onLogout: () => void };
type Row = Record<string, unknown>;
type View = 'overview' | 'clinics' | 'explorer' | 'access';
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
  | 'website_appointments'
  | 'treatments'
  | 'medical_history'
  | 'charges'
  | 'patient_audit_logs';

type Clinic = Row & {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  active?: boolean;
  created_at?: string;
};

type DataSet = Record<TableName, Row[]>;

type ClinicCard = {
  clinic: Clinic;
  id: string;
  patients: number;
  staff: number;
  visits: number;
  files: number;
  pending: number;
  monthRevenue: number;
};

const TABLES: { key: TableName; label: string }[] = [
  { key: 'clinics', label: 'Clinics' },
  { key: 'profiles', label: 'Staff' },
  { key: 'patients', label: 'Patients' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'patient_visits', label: 'Visits' },
  { key: 'payments', label: 'Payments' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'files', label: 'Files' },
  { key: 'staff_invites', label: 'Invites' },
  { key: 'website_appointments', label: 'Website leads' },
  { key: 'treatments', label: 'Treatments' },
  { key: 'medical_history', label: 'Medical history' },
  { key: 'charges', label: 'Charges' },
  { key: 'patient_audit_logs', label: 'Audit logs' },
];

const emptyData = TABLES.reduce((acc, table) => {
  acc[table.key] = [];
  return acc;
}, {} as DataSet);

function asNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

function clinicId(row: Row) {
  return String(row.clinic_id || row.id || '');
}

function rowSearchText(row: Row) {
  return Object.values(row).map((value) => String(value ?? '')).join(' ').toLowerCase();
}

function show(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text).toLocaleString('en-IN');
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function shortDate(value: unknown) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
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

export default function CompanyAdmin({ session, onLogout }: Props) {
  const [view, setView] = useState<View>('overview');
  const [table, setTable] = useState<TableName>('clinics');
  const [data, setData] = useState<DataSet>(emptyData);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  async function readTable(tableName: TableName) {
    const { data: rows, error: readError } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(800);

    if (readError) throw new Error(`${tableName}: ${readError.message}`);
    return (rows || []) as Row[];
  }

  async function loadAll() {
    setLoading(true);
    setError('');

    const nextData = { ...emptyData };
    const nextWarnings: string[] = [];

    await Promise.all(TABLES.map(async (item) => {
      try {
        nextData[item.key] = await readTable(item.key);
      } catch (err) {
        nextData[item.key] = [];
        nextWarnings.push(err instanceof Error ? err.message : `${item.key} could not load`);
      }
    }));

    setData(nextData);
    setWarnings(nextWarnings);

    const firstClinic = nextData.clinics[0] as Clinic | undefined;
    if (!selectedClinicId && firstClinic?.id) setSelectedClinicId(firstClinic.id);
    if (!nextData.clinics.length && nextWarnings.length) setError('No clinic data is visible for this login.');

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = startOfToday();
  const month = startOfMonth();
  const clinics = data.clinics as Clinic[];

  const clinicCards = useMemo<ClinicCard[]>(() => clinics.map((clinic) => {
    const id = String(clinic.id || '');
    const payments = data.payments.filter((row) => clinicId(row) === id);
    return {
      clinic,
      id,
      patients: data.patients.filter((row) => clinicId(row) === id).length,
      staff: data.profiles.filter((row) => clinicId(row) === id).length,
      visits: data.patient_visits.filter((row) => clinicId(row) === id).length,
      files: data.files.filter((row) => clinicId(row) === id).length,
      pending: data.invoices.filter((row) => clinicId(row) === id).reduce((sum, row) => sum + asNumber(row.due_amount), 0),
      monthRevenue: payments.filter((row) => {
        const date = parseDate(row.created_at);
        return date ? date >= month : false;
      }).reduce((sum, row) => sum + asNumber(row.amount), 0),
    };
  }), [clinics, data, month]);

  const totals = useMemo(() => ({
    clinics: clinics.length,
    activeClinics: clinics.filter((clinic) => clinic.active !== false).length,
    staff: data.profiles.length,
    patients: data.patients.length,
    visits: data.patient_visits.length,
    files: data.files.length,
    todayRevenue: data.payments.filter((row) => {
      const date = parseDate(row.created_at);
      return date ? date >= today : false;
    }).reduce((sum, row) => sum + asNumber(row.amount), 0),
    monthRevenue: data.payments.filter((row) => {
      const date = parseDate(row.created_at);
      return date ? date >= month : false;
    }).reduce((sum, row) => sum + asNumber(row.amount), 0),
    pendingDue: data.invoices.reduce((sum, row) => sum + asNumber(row.due_amount), 0),
  }), [clinics, data, month, today]);

  const selectedClinic = clinics.find((clinic) => clinic.id === selectedClinicId) || clinics[0] || null;
  const selectedId = String(selectedClinic?.id || '');
  const selectedRows = {
    profiles: data.profiles.filter((row) => clinicId(row) === selectedId),
    patients: data.patients.filter((row) => clinicId(row) === selectedId),
    visits: data.patient_visits.filter((row) => clinicId(row) === selectedId),
    payments: data.payments.filter((row) => clinicId(row) === selectedId),
    invoices: data.invoices.filter((row) => clinicId(row) === selectedId),
    appointments: data.appointments.filter((row) => clinicId(row) === selectedId),
  };

  const visibleRows = useMemo(() => {
    const rows = data[table] || [];
    const term = search.trim().toLowerCase();
    return term ? rows.filter((row) => rowSearchText(row).includes(term)) : rows;
  }, [data, search, table]);

  const columns = Array.from(new Set(visibleRows.slice(0, 30).flatMap((row) => Object.keys(row)))).slice(0, 12);
  const accessLimited = clinics.length <= 1;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><div className="mark">S</div><div><strong>SooperAdmin</strong><span>{session.user.email}</span></div></div>
        <div className="safe-card"><ShieldCheck size={18} /><div><strong>Read-only</strong><span>No Supabase changes from this panel.</span></div></div>
        <p className="nav-label">Company workspace</p>
        <nav>
          <button className={view === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setView('overview')}><span><Activity size={17} />Overview</span></button>
          <button className={view === 'clinics' ? 'nav-item active' : 'nav-item'} onClick={() => setView('clinics')}><span><Building2 size={17} />Clinics</span></button>
          <button className={view === 'explorer' ? 'nav-item active' : 'nav-item'} onClick={() => setView('explorer')}><span><Database size={17} />Data Explorer</span></button>
          <button className={view === 'access' ? 'nav-item active' : 'nav-item'} onClick={() => setView('access')}><span><ShieldAlert size={17} />Access Check</span></button>
        </nav>
        <div className="sidebar-footer"><span>MDMS Super Admin</span><button className="ghost-button danger" onClick={onLogout}><LogOut size={16} /> Logout</button></div>
      </aside>

      <main className="content">
        <header className="hero">
          <div><p className="eyebrow">Company Control Room</p><h1>MDMS business dashboard</h1><p className="muted">Clinics, revenue, staff, usage and support data in one moderate panel.</p></div>
          <div className="hero-actions"><button className="ghost-button" onClick={loadAll} disabled={loading}>{loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Refresh</button><button className="ghost-button danger" onClick={onLogout}><LogOut size={16} /> Logout</button></div>
        </header>

        {accessLimited && <div className="notice warning"><ShieldAlert size={18} /><div><strong>Company-wide visibility may be limited.</strong><span>If only one clinic appears, current browser access is being limited by existing RLS. Supabase was not changed.</span></div></div>}
        {error && <div className="notice danger"><ShieldAlert size={18} /><span>{error}</span></div>}
        {warnings.length > 0 && <details className="notice subtle"><summary>{warnings.length} table warnings</summary><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}

        {loading ? <div className="state-card"><Loader2 className="spin" size={20} /> Loading company data...</div> : null}

        {!loading && view === 'overview' && (
          <>
            <section className="cards">
              <Metric label="Clinics" value={count(totals.clinics)} icon={<Building2 size={20} />} />
              <Metric label="Active" value={count(totals.activeClinics)} icon={<ShieldCheck size={20} />} />
              <Metric label="Staff" value={count(totals.staff)} icon={<Users size={20} />} />
              <Metric label="Patients" value={count(totals.patients)} icon={<Users size={20} />} />
              <Metric label="Visits" value={count(totals.visits)} icon={<Stethoscope size={20} />} />
              <Metric label="Files" value={count(totals.files)} icon={<FileText size={20} />} />
              <Metric label="Today revenue" value={money(totals.todayRevenue)} icon={<WalletCards size={20} />} />
              <Metric label="Month revenue" value={money(totals.monthRevenue)} icon={<WalletCards size={20} />} />
              <Metric label="Pending dues" value={money(totals.pendingDue)} icon={<CalendarClock size={20} />} />
            </section>
            <section className="panel-card"><div className="panel-head"><div><h2>Clinic overview</h2><p>Visible clinics from current master login.</p></div></div><div className="clinic-mini-grid">{clinicCards.map((card) => <ClinicCardView card={card} key={card.id} />)}</div></section>
          </>
        )}

        {!loading && view === 'clinics' && (
          <section className="clinic-layout">
            <div className="clinic-list panel-card"><h2>Clinics</h2>{clinicCards.map((card) => <button key={card.id} className={card.id === selectedId ? 'clinic-row active' : 'clinic-row'} onClick={() => setSelectedClinicId(card.id)}><strong>{card.clinic.name || 'Unnamed clinic'}</strong><span>{card.patients} patients • {card.staff} staff • {money(card.monthRevenue)}</span></button>)}</div>
            <div className="panel-card clinic-detail">{selectedClinic ? <><div className="clinic-detail-head"><div><span className="status-pill">{selectedClinic.active === false ? 'Inactive' : 'Active'}</span><h2>{selectedClinic.name || 'Unnamed clinic'}</h2><p>{selectedClinic.address || 'No address recorded'}</p></div><div className="clinic-contact"><span>{selectedClinic.phone || 'No phone'}</span><span>{selectedClinic.email || 'No email'}</span></div></div><div className="cards compact-cards"><Metric label="Staff" value={count(selectedRows.profiles.length)} /><Metric label="Patients" value={count(selectedRows.patients.length)} /><Metric label="Visits" value={count(selectedRows.visits.length)} /><Metric label="Payments" value={money(selectedRows.payments.reduce((sum, row) => sum + asNumber(row.amount), 0))} /><Metric label="Pending" value={money(selectedRows.invoices.reduce((sum, row) => sum + asNumber(row.due_amount), 0))} /></div><div className="detail-grid"><MiniTable title="Staff" rows={selectedRows.profiles} columns={['name', 'email', 'role', 'active']} /><MiniTable title="Recent payments" rows={selectedRows.payments.slice(0, 8)} columns={['amount', 'payment_category', 'payment_method', 'created_at']} /><MiniTable title="Recent appointments" rows={selectedRows.appointments.slice(0, 8)} columns={['appointment_time', 'status', 'reminder_status']} /><MiniTable title="Recent visits" rows={selectedRows.visits.slice(0, 8)} columns={['visit_date', 'chief_complaint', 'visit_status']} /></div></> : <div className="empty-card">No clinic selected.</div>}</div>
          </section>
        )}

        {!loading && view === 'explorer' && (
          <section className="table-card">
            <div className="table-head"><div><p className="eyebrow">Read-only data explorer</p><h2>{TABLES.find((item) => item.key === table)?.label}</h2><p>{visibleRows.length} visible rows</p></div><div className="table-actions"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visible rows" /></div><button className="ghost-button" disabled={!visibleRows.length} onClick={() => exportCsv(table, visibleRows)}><Download size={16} /> Export CSV</button></div></div>
            <div className="table-tabs">{TABLES.map((item) => <button key={item.key} className={item.key === table ? 'active' : ''} onClick={() => { setTable(item.key); setSearch(''); }}>{item.label}</button>)}</div>
            {visibleRows.length ? <DataTable rows={visibleRows} columns={columns} /> : <div className="state-card">No rows visible.</div>}
          </section>
        )}

        {!loading && view === 'access' && <section className="panel-card access-panel"><h2>Access diagnosis</h2><p>This panel is intentionally read-only and uses current Supabase access rules.</p><div className="access-grid"><AccessItem ok={!accessLimited} title={accessLimited ? 'Limited visibility' : 'Multiple clinics visible'} text={`${totals.clinics} clinic records visible`} /><AccessItem ok title="No database mutation" text="No activate, deactivate, delete or update actions added" /><AccessItem ok title="Master email gate" text="Only the configured master email can login" /><AccessItem ok={!warnings.length} title={warnings.length ? 'Warnings found' : 'Tables loaded'} text={warnings.length ? `${warnings.length} warnings` : 'No table warnings'} /></div><div className="explain-box"><h3>Important</h3><p>True all-clinic company control needs either existing database rules that allow this master account, or a separate safe backend. Because you said not to change Supabase, this build respects current RLS.</p></div></section>}
      </main>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: JSX.Element }) {
  return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

function ClinicCardView({ card }: { card: ClinicCard }) {
  return <div className="clinic-mini-card"><div><strong>{card.clinic.name || 'Unnamed clinic'}</strong><span>{card.clinic.active === false ? 'Inactive' : 'Active'} • Since {shortDate(card.clinic.created_at)}</span></div><div className="mini-stats"><b>{card.patients}<small>patients</small></b><b>{card.visits}<small>visits</small></b><b>{money(card.monthRevenue)}<small>month</small></b></div></div>;
}

function MiniTable({ title, rows, columns }: { title: string; rows: Row[]; columns: string[] }) {
  return <div className="mini-table-card"><h3>{title}</h3>{rows.length ? <DataTable rows={rows} columns={columns} /> : <div className="empty-card small">No rows visible.</div>}</div>;
}

function DataTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id || index)}>{columns.map((column) => <td key={column}>{show(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

function AccessItem({ ok, title, text }: { ok: boolean; title: string; text: string }) {
  return <div className={ok ? 'access-item ok' : 'access-item warning'}>{ok ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}<div><strong>{title}</strong><span>{text}</span></div></div>;
}
