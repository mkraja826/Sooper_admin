import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Building2, CheckCircle2, Loader2, Mail, ShieldAlert, UserPlus, X } from 'lucide-react';
import './owner-invite-control.css';

type Props = { session: Session };
type Clinic = { id: string; name: string; active?: boolean | null };

export default function OwnerInviteControl({ session }: Props) {
  const [open, setOpen] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ clinic_id: '', name: '', email: '', phone: '' });

  async function request(method: 'GET' | 'POST', body?: Record<string, unknown>) {
    const response = await fetch('/api/admin-control', {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Owner invitation failed');
    return payload;
  }

  async function loadClinics() {
    setLoading(true);
    setError('');
    try {
      const payload = await request('GET');
      setClinics((payload.clinics || []).filter((clinic: Clinic) => clinic.active !== false));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load clinics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function openModal() {
      setOpen(true);
      setSuccess('');
      if (!clinics.length) loadClinics();
    }
    window.addEventListener('sooperadmin:invite-owner', openModal);
    return () => window.removeEventListener('sooperadmin:invite-owner', openModal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinics.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = await request('POST', { action: 'invite_clinic_owner', ...form });
      setSuccess(payload.invitation_sent ? 'Owner invitation sent and head-doctor access created.' : 'Existing user linked as clinic owner and head doctor.');
      setForm((value) => ({ ...value, name: '', email: '', phone: '' }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Owner invitation failed');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="ac-backdrop ac-owner-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="ac-owner-modal" onMouseDown={(event) => event.stopPropagation()} aria-label="Invite clinic owner">
        <header>
          <div><span><UserPlus size={19} /></span><div><small>Protected account provisioning</small><h2>Invite clinic owner</h2><p>Creates or links the Supabase user and assigns head-doctor access.</p></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close owner invitation"><X size={19} /></button>
        </header>

        {error ? <div className="ac-message error"><ShieldAlert size={17} />{error}</div> : null}
        {success ? <div className="ac-message success"><CheckCircle2 size={17} />{success}</div> : null}

        {loading ? <div className="ac-loading"><Loader2 className="spin" size={21} /> Loading clinics…</div> : <form className="ac-form" onSubmit={submit}>
          <label>Clinic<select required value={form.clinic_id} onChange={(event) => setForm({ ...form, clinic_id: event.target.value })}><option value="">Select clinic</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>
          <div className="ac-grid two"><label>Owner / head doctor name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>
          <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <div className="ac-owner-note"><Building2 size={17} /><span><strong>Clinic access</strong><small>The account will be active and assigned the head_doctor role for the selected clinic.</small></span></div>
          <button className="ac-primary" disabled={saving} type="submit">{saving ? <Loader2 className="spin" size={17} /> : <Mail size={17} />} Invite and grant owner access</button>
        </form>}
      </section>
    </div>
  );
}
