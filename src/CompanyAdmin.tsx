import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

type Props = { session: Session; onLogout: () => void };
type Row = Record<string, unknown>;

const tables = ['clinics','profiles','patients','appointments','patient_visits','invoices','payments','files','staff_invites','website_appointments'];

export default function CompanyAdmin({ session, onLogout }: Props) {
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [table, setTable] = useState('clinics');
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function api(params: Record<string, string>) {
    const url = new URL('/api/admin', window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${session.access_token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API error');
    return data;
  }

  async function loadSummary() {
    const data = await api({ mode: 'summary' });
    setSummary(data.summary || {});
  }

  async function loadRows() {
    const data = await api({ mode: 'table', table, search });
    setRows(data.rows || []);
  }

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      await loadSummary();
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [table]);
  useEffect(() => { const timer = setTimeout(loadRows, 400); return () => clearTimeout(timer); }, [search]);

  const cards = [
    ['Clinics', summary.clinics || 0],
    ['Active Clinics', summary.activeClinics || 0],
    ['Staff', summary.staff || 0],
    ['Patients', summary.patients || 0],
    ['Visits', summary.visits || 0],
    ['Pending Due', summary.pendingDue || 0],
  ];

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><div className="mark">S</div><div><strong>SooperAdmin</strong><span>{session.user.email}</span></div></div>
        <div className="safe-card"><strong>Company admin</strong><span>All MDMS clinics through secure server API.</span></div>
        <p className="nav-label">Company database</p>
        <nav>{tables.map((item) => <button key={item} className={item === table ? 'nav-item active' : 'nav-item'} onClick={() => setTable(item)}><span>{item.replaceAll('_',' ')}</span></button>)}</nav>
      </aside>

      <main className="content">
        <header className="hero"><div><p className="eyebrow">Company Control Room</p><h1>MDMS business dashboard</h1><p className="muted">Manage the company database, all clinics, usage, revenue and support data.</p></div><div className="hero-actions"><button className="ghost-button" onClick={refresh}>Refresh</button><button className="ghost-button danger" onClick={onLogout}>Logout</button></div></header>

        <section className="cards">{cards.map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{String(value)}</strong></article>)}</section>

        <section className="table-card">
          <div className="table-head"><div><h2>{table.replaceAll('_',' ')}</h2><p>Company-wide data table</p></div><div className="table-actions"><div className="search-box"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" /></div></div></div>
          {loading ? <div className="state-box">Loading...</div> : error ? <div className="state-box error-text">{error}</div> : rows.length ? <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id || index)}>{columns.map((column) => <td key={column}>{String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div> : <div className="state-box">No rows found.</div>}
        </section>
      </main>
    </div>
  );
}
