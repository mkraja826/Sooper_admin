import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Activity,
  Building2,
  CalendarClock,
  Database,
  Download,
  Eye,
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
type ActiveView = 'overview' | 'clinics' | 'explorer' | 'access';
type TableName =
  | 'clinics'
  | 'profiles'
  | 'patients'
  | 'appointments'
  | 'patient_visits'
  | 'invoices'
  | 'payments'
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

type Dataset = Record<TableName, Row[]>;

const TABLES: { key: TableName; label: string; note: string }[] = [
  { key: 'clinics', label: 'Clinics', note: 'Clinic accounts and status' },
  { key: 'profiles', label: 'Staff profiles', note: 'Owners, doctors and receptionists' },
  { key: 'patients', label: 'Patients', note: 'Patient records by clinic' },
  { key: 'appointments', label: 'Appointments', note: 'Queue and follow-ups' },
  { key: 'patient_visits', label: 'Visits', note: 'Doctor visit history' },
  { key: 'payments', label: 'Payments', note: 'Collected money' },
  { key: 'invoices', label: 'Invoices', note: 'Paid and pending dues' },
  { key: 'files', label: 'Files', note: 'Clinical uploads audit' },
  { key: 'staff_invites', label: 'Staff invites', note: 'Pending and accepted invites' },
  { key: 'website_appointments', label: 'Website leads', note: 'Public website appointment requests' },
  { key: 'treatments', label: 'Treatments', note: 'Planned and completed treatments' },
  { key: 'medical_history', label: 'Medical history', note: 'Health flags and notes' },
  { key: 'charges', label: 'Charges', note: 'Charge records if used' },
  { key: 'patient_audit_logs', label: 'Audit logs', note: 'Patient edit tracking' },
];

const emptyDataset = TABLES.reduce((acc, item) => {
  acc[item.key] = [];
  return acc;
}, {} as Dataset);

function money(value: unknown) {
  return `₹${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
}

function number(value: unknown) {
  return Number(value || 0).toLocaleString('en-IN');
}

function asNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asDate(value: unknown) {
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

function rowClinicId(row: Row) {
  return String(row.clinic_id || row.id || '');
}

function rowText(row: Row) {
  return Object.values(row).map((value) => String(value ?? '')).join(' ').toLowerCase();
}

function shortDate(value: unknown) {
  const date = asDate(value);
  if (!date) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text).toLocaleString('en-IN');
  if (text.length > 80) return `${text.slice(0, 80)}...`;

  return text;
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: Row[]) {
  if (!rows.length) return;

  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const content = [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function CompanyAdmin({ session, onLogout }: Props) {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [activeTable, setActiveTable] = useState<TableName>('clinics');
  const [dataset, setDataset] = useState<Dataset>(emptyDataset);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  async function readTable<T extends Row>(table: TableName, orderBy: string | null = 'created_at') {
    let query = supabase.from(table).select('*').limit(800);

    if (orderBy) {
      query = query.order(orderBy, { ascending: false });
    }

    const { data, error: tableError } = await query;

    if (tableError) {
      throw new Error(`${table}: ${tableError.message}`);
    }

    return (data || []) as T[];
  }

  async function loadAll() {
    setLoading(true);
    setError('');

    const nextWarnings: string[] = [];
    const nextData = { ...emptyDataset };

    await Promise.all(
      TABLES.map(async (item) => {
        try {
          const orderBy = item.key === 'clinics' ? 'created_at' : item.key === 'profiles' ? 'created_at' : 'created_at';
          nextData[item.key] = await readTable(item.key, orderBy);
        } catch (err) {
          nextData[item.key] = [];
          nextWarnings.push(err instanceof Error ? err.message : `${item.label} could not load`);
        }
      }),
    );

    setDataset(nextData);
    setWarnings(nextWarnings);

    if (!selectedClinicId && nextData.clinics[0]?.id) {
      setSelectedClinicId(String(nextData.clinics[0].id));
    }

    if (!nextData.clinics.length && nextWarnings.length) {
      setError('Could not load clinic data with the current logged-in access.');
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = startOfToday();
  const month = startOfMonth();

  const visibleTableRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = dataset[activeTable] || [];
    if (!term) return rows;
    return rows.filter((row) => rowText(row).includes(term));
  }, [activeTable, dataset, search]);

  const clinics = dataset.clinics as Clinic[];
  const selectedClinic = clinics.find((clinic) => String(clinic.id) === selectedClinicId) || clinics[0] || null;
  const selectedId = selectedClinic?.id || '';

  const clinicCards = useMemo(() => {
    return clinics.map((clinic) => {
      const clinicId = String(clinic.id || '');
      const clinicPatients = dataset.patients.filter((row) => rowClinicId(row) === clinicId).length;
      const clinicStaff = dataset.profiles.filter((row) => rowClinicId(row) === clinicId).length;
      const clinicVisits = dataset.patient_visits.filter((row) => rowClinicId(row) === clinicId).length;
      const clinicFiles = dataset.files.filter((row) => rowClinicId(row) === clinicId).length;
      const clinicPending = dataset.invoices
        .filter((row) => rowClinicId(row) === clinicId)
        .reduce((total, row) => total + asNumber(row.due_amount), 0);
      const clinicMonthRevenue = dataset.payments
        .filter((row) => rowClinicId(row) === clinicId)
        .filter((row) => {
          const date = asDate(row.created_at);
          return date ? date >= month : false;
        })
        .reduce((total, row) => total + asNumber(row.amount), 0);

      return {
        clinic,
        clinicId,
        patients: clinicPatients,
        staff: clinicStaff,
        visits: clinicVisits,
        files: clinicFiles,
        pending: clinicPending,
        monthRevenue: clinicMonthRevenue,
      };
    });
  }, [clinics, dataset, month]);

  const totals = useMemo(() => {
    const todayRevenue = dataset.payments
      .filter((row) => {
        const date = asDate(row.created_at);
        return date ? date >= today : false;
      })
      .reduce((total, row) => total + asNumber(row.amount), 0);

    const monthRevenue = dataset.payments
      .filter((row) => {
        const date = asDate(row.created_at);
        return date ? date >= month : false;
      })
      .reduce((total, row) => total + asNumber(row.amount), 0);

    const pendingDue = dataset.invoices.reduce((total, row) => total + asNumber(row.due_amount), 0);

    return {
      clinics: clinics.length,
      activeClinics: clinics.filter((clinic) => clinic.active !== false).length,
      staff: dataset.profiles.length,
      patients: dataset.patients.length,
      visits: dataset.patient_visits.length,
      files: dataset.files.length,
      todayRevenue,
      monthRevenue,
      pendingDue,
    };
  }, [clinics, dataset, month, today]);

  const selectedClinicRows = useMemo(() => {
    if (!selectedId) return null;

    return {
      profiles: dataset.profiles.filter((row) => rowClinicId(row) === selectedId),
      patients: dataset.patients.filter((row) => rowClinicId(row) === selectedId),
      visits: dataset.patient_visits.filter((row) => rowClinicId(row) === selectedId),
      payments: dataset.payments.filter((row) => rowClinicId(row) === selectedId),
      invoices: dataset.invoices.filter((row) => rowClinicId(row) === selectedId),
      files: dataset.files.filter((row) => rowClinicId(row) === selectedId),
      appointments: dataset.appointments.filter((row) => rowClinicId(row) === selectedId),
    };
  }, [dataset, selectedId]);

  const tableColumns = useMemo(() => {
    return Array.from(new Set(visibleTableRows.slice(0, 30).flatMap((row) => Object.keys(row)))).slice(0, 12);
  }, [visibleTableRows]);

  const accessLimited = clinics.length <= 1;

  const navItems: { key: ActiveView; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity size={17} /> },
    { key: 'clinics', label: 'Clinics', icon: <Building2 size={17} /> },
    { key: 'explorer', label: 'Data Explorer', icon: <Database size={17} /> },
    { key: 'access', label: 'Access Check', icon: <ShieldCheck size={17} /> },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">S</div>
          <div>
            <strong>SooperAdmin</strong>
            <span>{session.user.email}</span>
          </div>
        </div>

        <div className="safe-card">
          <ShieldCheck size={18} />
          <div>
            <strong>Read-only mode</strong>
            <span>No Supabase changes from this panel.</span>
          </div>
        </div>

        <p className="nav-label">Company workspace</p>
        <nav>
          {navItems.map((item) => (
            <button key={item.key} className={item.key === activeView ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView(item.key)}>
              <span>{item.icon}{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>MDMS Super Admin</span>
          <button className="ghost-button danger" onClick={onLogout}><LogOut size={16} /> Logout</button>
        </div>
      </aside>

      <main className="content">
        <header className="hero">
          <div>
            <p className="eyebrow">Company Control Room</p>
            <h1>MDMS business dashboard</h1>
            <p className="muted">Monitor clinics, revenue, usage and support data from one clean panel.</p>
          </div>
          <div className="hero-actions">
            <button className="ghost-button" onClick={loadAll} disabled={loading}>{loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Refresh</button>
            <button className="ghost-button danger" onClick={onLogout}><LogOut size={16} /> Logout</button>
          </div>
        </header>

        {accessLimited ? (
          <div className="notice warning">
            <ShieldAlert size={18} />
            <div>
              <strong>Frontend RLS visibility looks limited.</strong>
              <span>If you expected all clinics but see only one, the current Supabase RLS allows this browser app to read only the logged-in user&apos;s clinic. I did not change Supabase.</span>
            </div>
          </div>
        ) : null}

        {error ? <div className="notice danger"><ShieldAlert size={18} /><span>{error}</span></div> : null}

        {warnings.length ? (
          <details className="notice subtle">
            <summary>Some tables were blocked or empty ({warnings.length})</summary>
            <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </details>
        ) : null}

        {loading ? (
          <div className="state-card"><Loader2 className="spin" size={20} /> Loading company data...</div>
        ) : activeView === 'overview' ? (
          <Overview totals={totals} clinicCards={clinicCards} onOpenClinics={() => setActiveView('clinics')} />
        ) : activeView === 'clinics' ? (
          <ClinicsView clinicCards={clinicCards} selectedClinic={selectedClinic} selectedClinicRows={selectedClinicRows} selectedClinicId={selectedId} onSelect={setSelectedClinicId} />
        ) : activeView === 'explorer' ? (
          <ExplorerView activeTable={activeTable} setActiveTable={setActiveTable} rows={visibleTableRows} columns={tableColumns} search={search} setSearch={setSearch} />
        ) : (
          <AccessView totals={totals} warnings={warnings} accessLimited={accessLimited} />
        )}
      </main>
    </div>
  );
}

function Overview({ totals, clinicCards, onOpenClinics }: { totals: Record<string, number>; clinicCards: ReturnType<typeof buildNever>[]; onOpenClinics: () => void }) {
  const metrics = [
    { label: 'Clinics visible', value: number(totals.clinics), icon: <Building2 size={20} />, tone: 'blue' },
    { label: 'Active clinics', value: number(totals.activeClinics), icon: <ShieldCheck size={20} />, tone: 'green' },
    { label: 'Staff accounts', value: number(totals.staff), icon: <Users size={20} />, tone: 'purple' },
    { label: 'Patients', value: number(totals.patients), icon: <Users size={20} />, tone: 'blue' },
    { label: 'Visits', value: number(totals.visits), icon: <Stethoscope size={20} />, tone: 'orange' },
    { label: 'Files', value: number(totals.files), icon: <FileText size={20} />, tone: 'gray' },
    { label: 'Today revenue', value: money(totals.todayRevenue), icon: <WalletCards size={20} />, tone: 'green' },
    { label: 'Month revenue', value: money(totals.monthRevenue), icon: <WalletCards size={20} />, tone: 'green' },
    { label: 'Pending dues', value: money(totals.pendingDue), icon: <CalendarClock size={20} />, tone: 'red' },
  ];

  return (
    <>
      <section className="cards">
        {metrics.map((metric) => (
          <article className={`metric-card ${metric.tone}`} key={metric.label}>
            <div className="metric-icon">{metric.icon}</div>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="split-grid">
        <article className="panel-card wide-panel">
          <div className="panel-head">
            <div>
              <h2>Clinic overview</h2>
              <p>Quick look at all clinics visible to the current master login.</p>
            </div>
            <button className="ghost-button" onClick={onOpenClinics}><Eye size={16} /> View clinics</button>
          </div>
          <div className="clinic-mini-grid">
            {clinicCards.length ? clinicCards.map((card) => <ClinicMiniCard key={card.clinicId} card={card} />) : <div className="empty-card">No clinic records visible.</div>}
          </div>
        </article>

        <article className="panel-card">
          <h2>What this panel is for</h2>
          <div className="check-list">
            <span><ShieldCheck size={16} /> See clinics and owners</span>
            <span><WalletCards size={16} /> Track revenue and dues</span>
            <span><Users size={16} /> Review staff and usage</span>
            <span><Database size={16} /> Inspect support data safely</span>
          </div>
        </article>
      </section>
    </>
  );
}

function buildNever() {
  return { clinic: {}, clinicId: '', patients: 0, staff: 0, visits: 0, files: 0, pending: 0, monthRevenue: 0 };
}

function ClinicMiniCard({ card }: { card: ReturnType<typeof buildNever> }) {
  const clinic = card.clinic as Clinic;

  return (
    <div className="clinic-mini-card">
      <div>
        <strong>{clinic.name || 'Unnamed clinic'}</strong>
        <span>{clinic.active === false ? 'Inactive' : 'Active'} • Since {shortDate(clinic.created_at)}</span>
      </div>
      <div className="mini-stats">
        <b>{card.patients}<small>patients</small></b>
        <b>{card.visits}<small>visits</small></b>
        <b>{money(card.monthRevenue)}<small>month</small></b>
      </div>
    </div>
  );
}

function ClinicsView({
  clinicCards,
  selectedClinic,
  selectedClinicRows,
  selectedClinicId,
  onSelect,
}: {
  clinicCards: ReturnType<typeof buildNever>[];
  selectedClinic: Clinic | null;
  selectedClinicRows: { profiles: Row[]; patients: Row[]; visits: Row[]; payments: Row[]; invoices: Row[]; files: Row[]; appointments: Row[] } | null;
  selectedClinicId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="clinic-layout">
      <div className="clinic-list panel-card">
        <div className="panel-head compact">
          <div>
            <h2>Clinics</h2>
            <p>{clinicCards.length} visible clinics</p>
          </div>
        </div>

        {clinicCards.map((card) => {
          const clinic = card.clinic as Clinic;
          return (
            <button key={card.clinicId} className={card.clinicId === selectedClinicId ? 'clinic-row active' : 'clinic-row'} onClick={() => onSelect(card.clinicId)}>
              <strong>{clinic.name || 'Unnamed clinic'}</strong>
              <span>{card.patients} patients • {card.staff} staff • {money(card.monthRevenue)}</span>
            </button>
          );
        })}
      </div>

      <div className="panel-card clinic-detail">
        {selectedClinic && selectedClinicRows ? (
          <>
            <div className="clinic-detail-head">
              <div>
                <span className="status-pill">{selectedClinic.active === false ? 'Inactive' : 'Active'}</span>
                <h2>{selectedClinic.name || 'Unnamed clinic'}</h2>
                <p>{selectedClinic.address || 'No address recorded'}</p>
              </div>
              <div className="clinic-contact">
                <span>{selectedClinic.phone || 'No phone'}</span>
                <span>{selectedClinic.email || 'No email'}</span>
              </div>
            </div>

            <div className="cards compact-cards">
              <article className="metric-card"><span>Staff</span><strong>{selectedClinicRows.profiles.length}</strong></article>
              <article className="metric-card"><span>Patients</span><strong>{selectedClinicRows.patients.length}</strong></article>
              <article className="metric-card"><span>Visits</span><strong>{selectedClinicRows.visits.length}</strong></article>
              <article className="metric-card"><span>Files</span><strong>{selectedClinicRows.files.length}</strong></article>
              <article className="metric-card"><span>Pending</span><strong>{money(selectedClinicRows.invoices.reduce((sum, row) => sum + asNumber(row.due_amount), 0))}</strong></article>
              <article className="metric-card"><span>Payments</span><strong>{money(selectedClinicRows.payments.reduce((sum, row) => sum + asNumber(row.amount), 0))}</strong></article>
            </div>

            <div className="detail-grid">
              <MiniTable title="Staff" rows={selectedClinicRows.profiles} columns={['name', 'email', 'role', 'active']} />
              <MiniTable title="Recent payments" rows={selectedClinicRows.payments.slice(0, 8)} columns={['amount', 'payment_category', 'payment_method', 'created_at']} />
              <MiniTable title="Recent appointments" rows={selectedClinicRows.appointments.slice(0, 8)} columns={['appointment_time', 'status', 'reminder_status', 'op_fee_status']} />
              <MiniTable title="Recent visits" rows={selectedClinicRows.visits.slice(0, 8)} columns={['visit_date', 'chief_complaint', 'visit_status', 'next_appointment_date']} />
            </div>
          </>
        ) : <div className="empty-card">Select a clinic to inspect.</div>}
      </div>
    </section>
  );
}

function MiniTable({ title, rows, columns }: { title: string; rows: Row[]; columns: string[] }) {
  return (
    <div className="mini-table-card">
      <h3>{title}</h3>
      {rows.length ? (
        <div className="mini-table-wrap">
          <table>
            <thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={String(row.id || index)}>{columns.map((column) => <td key={column}>{displayValue(row[column])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : <div className="empty-card small">No rows visible.</div>}
    </div>
  );
}

function ExplorerView({
  activeTable,
  setActiveTable,
  rows,
  columns,
  search,
  setSearch,
}: {
  activeTable: TableName;
  setActiveTable: (table: TableName) => void;
  rows: Row[];
  columns: string[];
  search: string;
  setSearch: (value: string) => void;
}) {
  const tableMeta = TABLES.find((table) => table.key === activeTable);

  return (
    <section className="table-card">
      <div className="table-head">
        <div>
          <p className="eyebrow">Read-only data explorer</p>
          <h2>{tableMeta?.label || activeTable}</h2>
          <p>{tableMeta?.note || 'Company table'} • {rows.length} rows visible</p>
        </div>
        <div className="table-actions">
          <div className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visible rows" /></div>
          <button className="ghost-button" onClick={() => downloadCsv(`${activeTable}.csv`, rows)} disabled={!rows.length}><Download size={16} /> Export CSV</button>
        </div>
      </div>

      <div className="table-tabs">
        {TABLES.map((table) => <button key={table.key} className={table.key === activeTable ? 'active' : ''} onClick={() => { setActiveTable(table.key); setSearch(''); }}>{table.label}</button>)}
      </div>

      {rows.length && columns.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={String(row.id || index)}>{columns.map((column) => <td key={column}>{displayValue(row[column])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : <div className="state-card">No rows visible for this table.</div>}
    </section>
  );
}

function AccessView({ totals, warnings, accessLimited }: { totals: Record<string, number>; warnings: string[]; accessLimited: boolean }) {
  return (
    <section className="panel-card access-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Access diagnosis</p>
          <h2>Sooper admin readiness</h2>
          <p>This panel does not modify Supabase. It shows exactly what the logged-in master account can read from the browser.</p>
        </div>
      </div>

      <div className="access-grid">
        <div className={accessLimited ? 'access-item warning' : 'access-item ok'}>
          {accessLimited ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
          <div>
            <strong>{accessLimited ? 'Company-wide access limited' : 'Multiple clinics visible'}</strong>
            <span>{totals.clinics} clinic records visible from current login.</span>
          </div>
        </div>
        <div className="access-item ok">
          <ShieldCheck size={18} />
          <div><strong>Read-only frontend</strong><span>No activate, deactivate, delete or database mutation buttons added.</span></div>
        </div>
        <div className="access-item ok">
          <ShieldCheck size={18} />
          <div><strong>Master email gate</strong><span>Only configured master email can enter the UI.</span></div>
        </div>
        <div className={warnings.length ? 'access-item warning' : 'access-item ok'}>
          {warnings.length ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
          <div><strong>{warnings.length ? 'Some tables blocked' : 'Tables loaded'}</strong><span>{warnings.length ? `${warnings.length} table warnings found.` : 'No table load warnings.'}</span></div>
        </div>
      </div>

      <div className="explain-box">
        <h3>Important</h3>
        <p>If this panel still shows only one clinic, that is not a UI bug. The current Supabase RLS policies are clinic-scoped for browser users. True company-wide sooper admin needs either a safe backend API with service role or new database policies/RPC. You asked not to change Supabase, so this build stays read-only and RLS-respecting.</p>
      </div>
    </section>
  );
}
