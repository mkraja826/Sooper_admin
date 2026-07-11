import { createClient, type User } from '@supabase/supabase-js';

export type AdminEnv = {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_MASTER_EMAIL?: string;
  MASTER_EMAIL?: string;
};

export type MasterIdentity = { user: User; email: string };
export type AdminClient = ReturnType<typeof createClient>;

export const STAFF_ROLES = ['head_doctor', 'working_doctor', 'receptionist', 'owner', 'doctor'] as const;
export const INVITE_ROLES = ['working_doctor', 'receptionist', 'doctor'] as const;
export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'expired', 'cancelled', 'grace_period'] as const;
export const BILLING_PROVIDERS = ['google_play', 'manual'] as const;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store' },
  });
}

function environment(env: AdminEnv) {
  return {
    url: env.VITE_SUPABASE_URL || env.SUPABASE_URL || '',
    anonKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '',
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    masterEmail: (env.VITE_MASTER_EMAIL || env.MASTER_EMAIL || '').toLowerCase(),
  };
}

export async function requireMaster(request: Request, env: AdminEnv) {
  const values = environment(env);
  if (!values.url || !values.anonKey || !values.masterEmail) {
    return { ok: false as const, response: json({ error: 'Admin authentication environment is incomplete' }, 500) };
  }

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false as const, response: json({ error: 'Missing auth token' }, 401) };

  const authClient = createClient(values.url, values.anonKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return { ok: false as const, response: json({ error: 'Invalid auth token' }, 401) };

  const email = data.user.email?.toLowerCase() || '';
  if (email !== values.masterEmail) return { ok: false as const, response: json({ error: 'Master access only' }, 403) };

  return { ok: true as const, identity: { user: data.user, email } satisfies MasterIdentity };
}

export function getAdmin(env: AdminEnv) {
  const values = environment(env);
  if (!values.url || !values.serviceKey) throw new Error('Admin database environment is incomplete');
  return createClient(values.url, values.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function cleanText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function requiredText(value: unknown, label: string, max = 500) {
  const result = cleanText(value, max);
  if (!result) throw new Error(`${label} is required`);
  return result;
}

export function optionalNumber(value: unknown, label: string) {
  if (value === '' || value === null || value === undefined) return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new Error(`${label} must be a valid positive number`);
  return result;
}

export function optionalDate(value: unknown, label: string) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid`);
  return date.toISOString();
}

export function randomInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint8Array(8);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

export async function writeAudit(
  admin: AdminClient,
  identity: MasterIdentity,
  action: string,
  targetType: string,
  targetId: string | null,
  clinicId: string | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await admin.from('admin_audit_logs').insert({
    actor_user_id: identity.user.id,
    actor_email: identity.email,
    action,
    target_type: targetType,
    target_id: targetId,
    clinic_id: clinicId,
    details,
  });
  if (error) console.error('Admin audit insert failed', error.message);
}
