import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import CompanyAdmin from './CompanyAdmin';
import { MASTER_EMAIL, supabase } from './supabaseClient';

function allowed(session: Session | null) {
  return session?.user.email?.toLowerCase() === MASTER_EMAIL;
}

export default function MasterGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(MASTER_EMAIL);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;

      if (allowed(data.session)) setSession(data.session);
      else {
        if (data.session) await supabase.auth.signOut();
        setSession(null);
      }

      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (allowed(nextSession)) setSession(nextSession);
      else {
        if (nextSession) await supabase.auth.signOut();
        setSession(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setSigningIn(true);
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== MASTER_EMAIL) {
      setError(`Only ${MASTER_EMAIL} can access this company panel.`);
      setSigningIn(false);
      return;
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setSigningIn(false);
      return;
    }

    if (!allowed(data.session)) {
      await supabase.auth.signOut();
      setError(`Only ${MASTER_EMAIL} can access this company panel.`);
      setSigningIn(false);
      return;
    }

    setSession(data.session);
    setSigningIn(false);
  }

  if (loading && !session) {
    return (
      <div className="state-screen">
        <div className="state-box elevated"><Loader2 className="spin" size={20} /> Checking master access...</div>
      </div>
    );
  }

  if (session) return <CompanyAdmin session={session} onLogout={logout} />;

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={login}>
        <div className="login-logo-row">
          <div className="mark">S</div>
          <span className="status-pill"><ShieldCheck size={14} /> Master only</span>
        </div>

        <p className="eyebrow">MDMS Company Control</p>
        <h1>SooperAdmin</h1>
        <p className="muted">Minimal company dashboard for clinics, usage, staff and support visibility.</p>

        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>

        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>

        {error ? <div className="error-box">{error}</div> : null}

        <button className="primary-button" disabled={signingIn} type="submit">
          {signingIn ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
          Company master sign in
        </button>

        <p className="fine-print">Uses current Supabase RLS. No service-role key is stored in this frontend.</p>
      </form>
    </div>
  );
}
