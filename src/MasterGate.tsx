import { useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { Loader2, LockKeyhole } from 'lucide-react';
import App from './App';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mzjtdcpbvoximdukpukd.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_3krFoyWgVzrZP1g_pUy32g_iIn1AdYb';
const MASTER_EMAIL = (import.meta.env.VITE_MASTER_EMAIL || 'karthikraja826@gmail.com').toLowerCase();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function allowed(session: Session | null) {
  return session?.user.email?.toLowerCase() === MASTER_EMAIL;
}

export default function MasterGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(MASTER_EMAIL);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (allowed(data.session)) {
        setSession(data.session);
      } else {
        if (data.session) await supabase.auth.signOut();
        setSession(null);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (allowed(nextSession)) {
        setSession(nextSession);
      } else {
        if (nextSession) await supabase.auth.signOut();
        setSession(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== MASTER_EMAIL) {
      setError(`Only ${MASTER_EMAIL} can access this panel.`);
      setLoading(false);
      return;
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    if (!allowed(data.session)) {
      await supabase.auth.signOut();
      setError(`Only ${MASTER_EMAIL} can access this panel.`);
      setLoading(false);
      return;
    }

    setSession(data.session);
    setLoading(false);
  }

  if (loading && !session) {
    return <div className="state-box"><Loader2 className="spin" size={20} /> Checking master access...</div>;
  }

  if (session) return <App />;

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={login}>
        <div className="mark">M</div>
        <p className="eyebrow">Master access only</p>
        <h1>MDMS Super Admin</h1>
        <p className="muted">Only the master email can open this admin panel.</p>

        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>

        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>

        {error ? <div className="error-box">{error}</div> : null}

        <button className="primary-button" disabled={loading} type="submit">
          {loading ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
          Master sign in
        </button>
      </form>
    </div>
  );
}
