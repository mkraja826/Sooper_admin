import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import {
  Activity,
  CalendarDays,
  Database,
  Download,
  FileText,
  IndianRupee,
  Loader2,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mzjtdcpbvoximdukpukd.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_3krFoyWgVzrZP1g_pUy32g_iIn1AdYb';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type Row = Record<string, unknown>;

type TableConfig = {
  key: string;
  label: string;
  description: string;
  select: string;
  order: string;
  search: string[];
};

type Summary = {
  clinics: number;
  staff: number;
  patients: number;
  appointmentsToday: number;
  revenueToday: number;
  pendingDue: number;
};

const TABLES: TableConfig[] = [
  {
    key: 'clinics',
    label: 'Clinics',
    description: 'Clinic registry, branding and active status.',
    select: 'id,name,phone,email,address,active,created_at',
    order: 'created_at',
    search: ['name', 'phone', 'email', 'address'],
  },
  {
    key: 'profiles',
    label: 'Staff',
    description: 'Owners, head doctors, working doctors and receptionists.',
    select: 'id,clinic_id,name,email,phone,role,active,created_at',
    order: 'created_at',
    search: ['name', 'email', 'phone', 'role'],
  },
  {
    key: 'patients',
    label: 'Patients',
    description: 'Patient records visible through current MDMS RLS policies.',
    select: 'id,clinic_id,patient_code,name,phone,age,gender,email,created_at',
    order: 'created_at',
    search: ['patient_code', 'name', 'phone', 'email'],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    description: 'Scheduled, waiting, checked-in and completed appointments.',
    select: 'id,clinic_id,patient_id,doctor_id,appointment_time,status,op_fee_status,op_fee_amount,notes,created_at',
    order: 'appointment_time',
    search: ['status', 'op_fee_status', 'notes'],
  },
  {
    key: 'patient_visits',
    label: 'Visits',
    description: 'Doctor visit entries, complaints and next appointments.',
    select: 'id,clinic_id,patient_id,doctor_id,visit_date,chief_complaint,diagnosis,doctor_notes,next_appointment_date,visit_status,created_at',
    order: 'visit_date',
    search: ['chief_complaint', 'diagnosis', 'doctor_notes', 'visit_status'],
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Billing, paid amount, due amount and payment category.',
    select: 'id,clinic_id,patient_id,visit_id,total_amount,paid_amount,due_amount,status,invoice_type,payment_category,created_at',
    order: 'created_at',
    search: ['status', 'invoice_type', 'payment_category'],
  },
  {
    key: 'payments',
    label: 'Payments',
    description: 'Collected payments by category and method.',
    select: 'id,clinic_id,patient_id,invoice_id,amount,payment_method,payment_category,collected_by,created_at',
    order: 'created_at',
    search: ['payment_method', 'payment_category', 'notes'],
  },
  {
    key: 'files',
    label: 'Files',
    description: 'Prescriptions, X-rays and patient file references.',
    select: 'id,clinic_id,patient_id,visit_id,file_type,file_name,file_url,file_note,xray_amount,xray_fee_status,created_at',
    order: 'created_at',
    search: ['file_type', 'file_name', 'file_note', 'xray_fee_status'],
  },
  {
    key: 'staff_invites',
    label: 'Invites',
    description: 'Staff invite codes and accepted status.',
    select: 'id,clinic_id,email,name,role,invite_code,accepted_at,created_at',
    order: 'created_at',
    search: ['email', 'name', 'role', 'invite_code'],
  },
  {
    key: 'website_appointments',
    label: 'Website Leads',
    description: 'Appointment requests submitted from website forms.',
    select: 'id,patient_name,phone,treatment,preferred_date,preferred_time,status,source,created_at',
    order: 'created_at',
    search: ['patient_name', 'phone', 'treatment', 'status', 'source'],
  },
];

const numberFormatter = new Intl.NumberFormat('en-IN');
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function valueToText(value: unknown, key = '') {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (key.includes('amount') || key.includes('revenue') || key.includes('due')) {
      return currencyFormatter.format(value);
    }
    return numberFormatter.format(value);
  }
  if (typeof value === 'string') {
    const looksDate = key.includes('date') || key.includes('time') || key.includes('created') || value.endsWith('+00:00');
    if (looksDate) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      }
    }
    return value;
  }
  return String(value);
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsv(table: string, rows: Row[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mdms-${table}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTable, setActiveTable] = useState('patients');
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<Summary>({
    clinics: 0,
    staff: 0,
    patients: 0,
    appointmentsToday: 0,
    revenueToday: 0,
    pendingDue: 0,
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');

  const config = useMemo(() => TABLES.find((table) => table.key === activeTable) || TABLES[0], [activeTable]);

  const getCount = useCallback(async (table: string) => {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    return count || 0;
  }, []);

  const fetchSummary = useCallback(async () => {
    const { start, end } = todayBounds();

    const [clinics, staff, patients, appointmentsToday, paymentsToday, pendingInvoices] = await Promise.all([
      getCount('clinics'),
      getCount('profiles'),
      getCount('patients'),
      supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('appointment_time', start).lt('appointment_time', end),
      supabase.from('payments').select('amount,created_at').gte('created_at', start).lt('created_at', end).limit(1000),
      supabase.from('invoices').select('due_amount').gt('due_amount', 0).limit(1000),
    ]);

    setSummary({
      clinics,
      staff,
      patients,
      appointmentsToday: appointmentsToday.count || 0,
      revenueToday: (paymentsToday.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0),
      pendingDue: (pendingInvoices.data || []).reduce((sum, row) => sum + Number(row.due_amount || 0), 0),
    });

    const nextCounts: Record<string, number> = {};
    for (const table of TABLES) {
      nextCounts[table.key] = await getCount(table.key);
    }
    setCounts(nextCounts);
  }, [getCount]);

  const fetchRows = useCallback(async () => {
    setTableLoading(true);
    setError('');

    let query: any = supabase.from(config.key).select(config.select).limit(200);
    if (config.order) {
      query = query.order(config.order, { ascending: false });
    }

    const term = search.trim();
    if (term && config.search.length) {
      query = query.or(config.search.map((column) => `${column}.ilike.%${term}%`).join(','));
    }

    const { data, error: queryError } = await query;
    if (queryError) {
      setRows([]);
      setError(queryError.message);
    } else {
      setRows((data || []) as Row[]);
    }
    setTableLoading(false);
  }, [config, search]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    await fetchSummary();
    await fetchRows();
    setLoading(false);
  }, [fetchRows, fetchSummary]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) bootstrap();
  }, [session, bootstrap]);

  useEffect(() => {
    if (!session) return;
    const timeout = window.setTimeout(fetchRows, 350);
    return () => window.clearTimeout(timeout);
  }, [fetchRows, session]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }
    setSession(data.session);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setRows([]);
    setCounts({});
  }

  const cards = [
    { label: 'Clinics', value: numberFormatter.format(summary.clinics), icon: Database },
    { label: 'Staff', value: numberFormatter.format(summary.staff), icon: Users },
    { label: 'Patients', value: numberFormatter.format(summary.patients), icon: Stethoscope },
    { label: 'Today Appts', value: numberFormatter.format(summary.appointmentsToday), icon: CalendarDays },
    { label: 'Today Revenue', value: currencyFormatter.format(summary.revenueToday), icon: IndianRupee },
    { label: 'Pending Due', value: currencyFormatter.format(summary.pendingDue), icon: Activity },
  ];

  if (!session) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="mark">M</div>
          <p className="eyebrow">Read-only panel</p>
          <h1>MDMS Super Admin</h1>
          <p className="muted">Login with an existing MDMS account. The panel respects current Supabase RLS and never uses a service-role key in the browser.</p>

          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="admin@clinic.com" required />
          </label>

          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="••••••••" required />
          </label>

          {error ? <div className="error-box">{error}</div> : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">M</div>
          <div>
            <strong>MDMS Admin</strong>
            <span>{session.user.email}</span>
          </div>
        </div>

        <div className="safe-card">
          <ShieldCheck size={18} />
          <div>
            <strong>Read-only mode</strong>
            <span>No insert, update, delete, write RPC, or service-role key.</span>
          </div>
        </div>

        <p className="nav-label">Data tables</p>
        <nav>
          {TABLES.map((table) => (
            <button
              key={table.key}
              className={table.key === activeTable ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setActiveTable(table.key);
                setSearch('');
              }}
            >
              <span>{table.label}</span>
              <em>{counts[table.key] ?? '—'}</em>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="hero">
          <div>
            <p className="eyebrow">Super Admin Overview</p>
            <h1>MDMS control room</h1>
            <p className="muted">Minimal monitoring for clinics, patients, staff, appointments, visits, payments, invoices, files and website leads.</p>
          </div>
          <div className="hero-actions">
            <button className="ghost-button" onClick={bootstrap} disabled={loading || tableLoading}>
              <RefreshCw size={17} /> Refresh
            </button>
            <button className="ghost-button danger" onClick={handleLogout}>
              <LogOut size={17} /> Logout
            </button>
          </div>
        </header>

        <section className="cards">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="metric-card" key={card.label}>
                <Icon size={18} />
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            );
          })}
        </section>

        <section className="table-card">
          <div className="table-head">
            <div>
              <h2>{config.label}</h2>
              <p>{config.description}</p>
            </div>
            <div className="table-actions">
              <div className="search-box">
                <Search size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.label.toLowerCase()}`} />
              </div>
              <button className="ghost-button" onClick={() => downloadCsv(config.key, rows)} disabled={!rows.length}>
                <Download size={17} /> CSV
              </button>
            </div>
          </div>

          {tableLoading ? (
            <div className="state-box"><Loader2 className="spin" size={20} /> Loading data...</div>
          ) : error ? (
            <div className="state-box error-text">{error}</div>
          ) : rows.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0]).map((column) => (
                      <th key={column}>{column.replaceAll('_', ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={String(row.id || index)}>
                      {Object.keys(rows[0]).map((column) => {
                        const raw = row[column];
                        const value = valueToText(raw, column);
                        const isStatus = ['status', 'role', 'payment_category', 'op_fee_status', 'xray_fee_status'].includes(column);
                        const isUrl = column.includes('url') && typeof raw === 'string' && raw.startsWith('http');
                        return (
                          <td key={column} title={value}>
                            {isUrl ? (
                              <a href={raw} target="_blank" rel="noreferrer">Open file</a>
                            ) : isStatus ? (
                              <span className="pill">{value}</span>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="state-box"><FileText size={20} /> No rows found. This may be empty data or RLS-limited visibility.</div>
          )}
        </section>
      </main>
    </div>
  );
}
