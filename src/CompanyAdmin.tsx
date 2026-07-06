import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  | 'website_appointments';

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

const TABLES: { key: TableName; label: string; helper: string }[] = [
  { key: 'clinics', label: 'Clinics', helper: 'Clinic accounts' },
  { key: 'profiles', label: 'Staff', helper: 'Owners and staff' },
  { key: 'patients', label: 'Patients', helper: 'Only patient ID, name and phone are shown' },
  { key: 'appointments', label: 'Appointments', helper: 'Patient appointments without raw IDs' },
  { key: 'patient_visits', label: 'Visits', helper: 'Doctor visits without technical references' },
  { key: 'payments', label: 'Payments', helper: 'Collections and payment methods' },
  { key: 'invoices', label: 'Invoices', helper: 'Billing and dues' },
  { key: 'files', label: 'Files', helper: 'Upload audit with patient names' },
  { key: 'staff_invites', label: 'Invites', helper: 'Staff invite status' },
  { key: 'website_appointments', label: 'Website leads', helper: 'Website enquiries' },
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

function byId(rows: Row[]) {
  return new Map(rows.map((row) => [String(row.id || ''), row]));
}

function patientLabel(row: Row | undefined) {
  if (!row) return '—';
  const code = String(row.patient_code || row.code || '').trim();
  const name = String(row.name || 'Unnamed patient').trim();
  const phone = String(row.phone || '').trim();
  return [code || 'No patient ID', name, phone].filter(Boolean).join(' • ');
}

function clinicLabel(row: Row | undefined) {
  if (!row) return '—';
  return String(row.name || 'Unnamed clinic');
}

function staffLabel(row: Row | undefined) {
  if (!row) return '—';
  return String(row.name || row.email || 'Staff');
}

function humanRows(table: TableName, rows: Row[], data: DataSet) {
  const patients = byId(data.patients);
  const clinics = byId(data.clinics);
  const staff = byId(data.profiles);

  return rows.map((row) => {
    const patient = patients.get(String(row.patient_id || ''));
    const clinic = clinics.get(String(row.clinic_id || row.id || ''));
    const doctor = staff.get(String(row.doctor_id || ''));
    const collector = staff.get(String(row.collected_by || ''));
    const uploader = staff.get(String(row.uploaded_by || ''));

    if (table === 'clinics') {
      return {
        'Clinic Name': row.name,
        Phone: row.phone,
        Email: row.email,
        Address: row.address,
        Status: row.active === false ? 'Inactive' : 'Active',
        'Created On': row.created_at,
      };
    }

    if (table === 'profiles') {
      return {
        Name: row.name,
        Email: row.email,
        Phone: row.phone,
        Role: row.role,
        Clinic: clinicLabel(clinic),
        Status: row.active === false ? 'Inactive' : 'Active',
        'Created On': row.created_at,
      };
    }

    if (table === 'patients') {
      return {
        'Patient ID': row.patient_code || row.code || '—',
        Name: row.name,
        'Phone Number': row.phone,
      };
    }

    if (table === 'appointments') {
      return {
        Patient: patientLabel(patient),
        Clinic: clinicLabel(clinic),
        Doctor: staffLabel(doctor),
        'Appointment Time': row.appointment_time,
        Status: row.status,
        'Reminder Status': row.reminder_status,
        'OP Fee Status': row.op_fee_status,
        'OP Fee': row.op_fee_amount ? money(row.op_fee_amount) : '—',
        Notes: row.notes,
        'Created On': row.created_at,
      };
    }

    if (table === 'patient_visits') {
      return {
        Patient: patientLabel(patient),
        Clinic: clinicLabel(clinic),
        Doctor: staffLabel(doctor),
        'Visit Date': row.visit_date,
        Complaint: row.chief_complaint,
        Diagnosis: row.diagnosis,
        Notes: row.doctor_notes,
        'Next Follow-up': row.next_appointment_date,
        Status: row.visit_status,
        'Created On': row.created_at,
      };
    }

    if (table === 'payments') {
      return {
        Patient: patientLabel(patient),
        Clinic: clinicLabel(clinic),
        Amount: money(row.amount),
        Method: row.payment_method,
        Category: row.payment_category,
        'Collected By': staffLabel(collector),
        Notes: row.notes,
        'Collected On': row.created_at,
      };
    }

    if (table === 'invoices') {
      return {
        Patient: patientLabel(patient),
        Clinic: clinicLabel(clinic),
        Total: money(row.total_amount),
        Paid: money(row.paid_amount),
        Due: money(row.due_amount),
        Status: row.status,
        Type: row.invoice_type,
        Category: row.payment_category,
        Notes: row.notes,
        'Created On': row.created_at,
      };
    }

    if (table === 'files') {
      return {
        Patient: patientLabel(patient),
        Clinic: clinicLabel(clinic),
        'File Type': row.file_type,
        'File Name': row.file_name,
        Note: row.file_note,
        'X-ray Amount': row.xray_amount ? money(row.xray_amount) : '—',
        'X-ray Fee Status': row.xray_fee_status,
        'Uploaded By': staffLabel(uploader),
        'Uploaded On': row.created_at,
      };
    }

    if (table === 'staff_invites') {
      return {
        Clinic: clinicLabel(clinic),
        Name: row.name,
        Email: row.email,
        Role: row.role,
        'Invite Code': row.invite_code,
        Status: row.accepted_at ? 'Accepted' : 'Pending',
        'Created On': row.created_at,
      };
    }

    return {
      'Patient Name': row.patient_name,
      'Phone Number': row.phone,
      Treatment: row.treatment,
      'Preferred Date': row.preferred_date,
      'Preferred Time': row.preferred_time,
      Status: row.status,
      Source: row.source,
      Message: row.message,
      'Created On': row.created_at,
    };
  });
}

function TableIcon({ table }: { table: TableName }) {
  const size = 15;
  if (table === 'clinics') return <Building2 size={size} />;
  if (table === 'profiles') return <Users size={size} />;
  if (table === 'patients') return <Users size={size} />;
  if (table === 'appointments') return <CalendarClock size={size} />;
  if (table === 'patient_visits') return <Stethoscope size={size} />;
  if (table === 'payments') return <WalletCards size={size} />;
  if (table === 'invoices') return <FileText size={size} />;
  if (table === 'files') return <FileText size={size} />;
  if (table === 'staff_invites') return <ShieldCheck size={size} />;
  return <Activity size={size} />;
}

export default function CompanyAdmin({ session, onLogout }: Props) {
  const [view, setView] = useState<View>('overview');
  const [table, setTable] = useState<TableName>('clinics');
  const [data, setData] = useState<DataSet>(emptyData);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState('');

  async function adminApi(params: Record<string, string>) {
    const url = new URL('/api/admin', window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
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

    await Promise.all(TABLES.map(async (item) => {
      try {
        nextData[item.key] = await readTable(item.key);
      } catch (err) {
        nextData[item.key] = [];
        nextWarnings.push(err instanceof Error ? err.message : `${item.key} could not load`);
      }
    }));

    setData(nextData);
    setWarnings(nextWarnings.filter((warning) => !warning.toLowerCase().includes('unknown table')));

    const firstClinic = nextData.clinics[0] as Clinic | undefined;
    if (!selectedClinicId && firstClinic?.id) setSelectedClinicId(firstClinic.id);
    if (!nextData.clinics.length && nextWarnings.length) setError('No clinic data is visible from the Sooper Admin API yet. Check Cloudflare variables and redeploy.');
    setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    setRefreshing(false);
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

  const readableRows = useMemo(() => humanRows(table, visibleRows, data), [data, table, visibleRows]);
  const columns = Array.from(new Set(readableRows.slice(0, 30).flatMap((row) => Object.keys(row))));
  const accessLimited = clinics.length <= 1;

  return (
    <div className="layout smooth-page">
      <aside className="sidebar">
        <div className="brand"><div className="mark">S</div><div><strong>SooperAdmin</strong><span>{session.user.email}</span></div></div>
        <div className="safe-card"><ShieldCheck size={18} /><div><strong>Human view</strong><span>No raw database IDs shown.</span></div></div>
        <p className="nav-label">Company workspace</p>
        <nav>
          <button className={view === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setView('overview')}><span><Activity size={17} />Overview</span></button>
          <button className={view === 'clinics' ? 'nav-item active' : 'nav-item'} onClick={() => setView('clinics')}><span><Building2 size={17} />Clinics</span></button>
          <button className={view === 'explorer' ? 'nav-item active' : 'nav-item'} onClick={() => setView('explorer')}><span><Database size={17} />Explorer</span></button>
          <button className={view === 'access' ? 'nav-item active' : 'nav-item'} onClick={() => setView('access')}><span><ShieldAlert size={17} />Access</span></button>
        </nav>
        <div className="sidebar-footer"><span>{lastUpdated ? `Updated ${lastUpdated}` : 'MDMS Super Admin'}</span><button className="ghost-button danger" onClick={onLogout}><LogOut size={16} /> Logout</button></div>
      </aside>

      <main className="content">
        <header className="hero hero-glass">
          <div><p className="eyebrow">Company Control Room</p><h1>MDMS business dashboard</h1><p className="muted">Compact company view with readable clinic, patient, revenue and support data.</p></div>
          <div className="hero-actions"><button className="ghost-button" onClick={() => loadAll(true)} disabled={loading || refreshing}>{refreshing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Refresh</button></div>
        </header>

        {accessLimited && <div className="notice warning"><ShieldAlert size={18} /><div><strong>Only {clinics.length} clinic visible.</strong><span>If you expect more clinics, check Cloudflare variables and the admin API response.</span></div></div>}
        {error && <div className="notice danger"><ShieldAlert size={18} /><span>{error}</span></div>}
        {warnings.length > 0 && <details className="notice subtle"><summary>{warnings.length} table warnings</summary><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}

        {loading ? <LoadingGrid /> : null}

        {!loading && view === 'overview' && (
          <>
            <section className="cards fade-in">
              <Metric label="Clinics" value={count(totals.clinics)} icon={<Building2 size={20} />} />
              <Metric label="Active" value={count(totals.activeClinics)} icon={<ShieldCheck size={20} />} />
              <Metric label="Staff" value={count(totals.staff)} icon={<Users size={20} />} />
              <Metric label="Patients" value={count(totals.patients)} icon={<Users size={20} />} />
              <Metric label="Visits" value={count(totals.visits)} icon={<Stethoscope size={20} />} />
              <Metric label="Files" value={count(totals.files)} icon={<FileText size={20} />} />
              <Metric label="Today" value={money(totals.todayRevenue)} icon={<WalletCards size={20} />} />
              <Metric label="This month" value={money(totals.monthRevenue)} icon={<WalletCards size={20} />} />
              <Metric label="Pending" value={money(totals.pendingDue)} icon={<CalendarClock size={20} />} />
            </section>
            <section className="panel-card fade-in"><div className="panel-head"><div><h2><Building2 size={18} /> Clinic overview</h2><p>Readable company view across clinics.</p></div></div><div className="clinic-mini-grid">{clinicCards.map((card) => <ClinicCardView card={card} key={card.id} />)}</div></section>
          </>
        )}

        {!loading && view === 'clinics' && (
          <section className="clinic-layout fade-in">
            <div className="clinic-list panel-card"><h2><Building2 size={18} /> Clinics</h2>{clinicCards.map((card) => <button key={card.id} className={card.id === selectedId ? 'clinic-row active' : 'clinic-row'} onClick={() => setSelectedClinicId(card.id)}><strong>{card.clinic.name || 'Unnamed clinic'}</strong><span>{card.patients} patients • {card.staff} staff • {money(card.monthRevenue)}</span></button>)}</div>
            <div className="panel-card clinic-detail">{selectedClinic ? <><div className="clinic-detail-head"><div><span className="status-pill">{selectedClinic.active === false ? 'Inactive' : 'Active'}</span><h2>{selectedClinic.name || 'Unnamed clinic'}</h2><p>{selectedClinic.address || 'No address recorded'}</p></div><div className="clinic-contact"><span>{selectedClinic.phone || 'No phone'}</span><span>{selectedClinic.email || 'No email'}</span></div></div><div className="cards compact-cards"><Metric label="Staff" value={count(selectedRows.profiles.length)} icon={<Users size={18} />} /><Metric label="Patients" value={count(selectedRows.patients.length)} icon={<Users size={18} />} /><Metric label="Visits" value={count(selectedRows.visits.length)} icon={<Stethoscope size={18} />} /><Metric label="Payments" value={money(selectedRows.payments.reduce((sum, row) => sum + asNumber(row.amount), 0))} icon={<WalletCards size={18} />} /><Metric label="Pending" value={money(selectedRows.invoices.reduce((sum, row) => sum + asNumber(row.due_amount), 0))} icon={<CalendarClock size={18} />} /></div><div className="detail-grid"><MiniTable title="Staff" icon={<Users size={16} />} rows={humanRows('profiles', selectedRows.profiles, data)} /><MiniTable title="Recent payments" icon={<WalletCards size={16} />} rows={humanRows('payments', selectedRows.payments.slice(0, 8), data)} /><MiniTable title="Recent appointments" icon={<CalendarClock size={16} />} rows={humanRows('appointments', selectedRows.appointments.slice(0, 8), data)} /><MiniTable title="Recent visits" icon={<Stethoscope size={16} />} rows={humanRows('patient_visits', selectedRows.visits.slice(0, 8), data)} /></div></> : <div className="empty-card">No clinic selected.</div>}</div>
          </section>
        )}

        {!loading && view === 'explorer' && (
          <section className="table-card fade-in">
            <div className="table-head"><div><p className="eyebrow">Human-readable explorer</p><h2><TableIcon table={table} /> {TABLES.find((item) => item.key === table)?.label}</h2><p>{TABLES.find((item) => item.key === table)?.helper} • {readableRows.length} rows</p></div><div className="table-actions"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, status or amount" /></div><button className="ghost-button" disabled={!readableRows.length} onClick={() => exportCsv(table, readableRows)}><Download size={16} /> Export</button></div></div>
            <div className="table-tabs">{TABLES.map((item) => <button key={item.key} className={item.key === table ? 'active' : ''} onClick={() => { setTable(item.key); setSearch(''); }}><span><TableIcon table={item.key} />{item.label}</span></button>)}</div>
            {readableRows.length ? <DataTable rows={readableRows} columns={columns} /> : <div className="state-card">No rows visible.</div>}
          </section>
        )}

        {!loading && view === 'access' && <section className="panel-card access-panel fade-in"><h2><ShieldCheck size={18} /> Access diagnosis</h2><p>This panel calls Cloudflare Worker /api/admin with your Supabase login token.</p><div className="access-grid"><AccessItem ok={!accessLimited} title={accessLimited ? 'Limited result' : 'Multiple clinics visible'} text={`${totals.clinics} clinic records visible`} /><AccessItem ok title="Human readable tables" text="Raw IDs and internal references are hidden from UI and exports" /><AccessItem ok title="Patient privacy" text="Patients table shows only patient ID, name and phone" /><AccessItem ok={!warnings.length} title={warnings.length ? 'Warnings found' : 'Tables clean'} text={warnings.length ? `${warnings.length} warnings` : 'No table warnings'} /></div><div className="explain-box"><h3>Polished data view</h3><p>Sooper Admin now shows clinic, patient, staff and billing information in human terms instead of database references.</p></div></section>}
      </main>
    </div>
  );
}

function LoadingGrid() {
  return <section className="cards">{Array.from({ length: 9 }).map((_, index) => <article className="metric-card skeleton-card" key={index}><span /><strong /></article>)}</section>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <article className="metric-card"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

function ClinicCardView({ card }: { card: ClinicCard }) {
  return <div className="clinic-mini-card"><div><strong><Building2 size={15} /> {card.clinic.name || 'Unnamed clinic'}</strong><span>{card.clinic.active === false ? 'Inactive' : 'Active'} • Since {shortDate(card.clinic.created_at)}</span></div><div className="mini-stats"><b>{card.patients}<small>patients</small></b><b>{card.visits}<small>visits</small></b><b>{money(card.monthRevenue)}<small>month</small></b></div></div>;
}

function MiniTable({ title, rows, icon }: { title: string; rows: Row[]; icon?: ReactNode }) {
  const columns = Array.from(new Set(rows.slice(0, 8).flatMap((row) => Object.keys(row))));
  return <div className="mini-table-card"><h3>{icon}{title}</h3>{rows.length ? <DataTable rows={rows} columns={columns} /> : <div className="empty-card small">No rows visible.</div>}</div>;
}

function DataTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{show(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

function AccessItem({ ok, title, text }: { ok: boolean; title: string; text: string }) {
  return <div className={ok ? 'access-item ok' : 'access-item warning'}>{ok ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}<div><strong>{title}</strong><span>{text}</span></div></div>;
}
