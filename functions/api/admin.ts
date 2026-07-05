import { createClient } from '@supabase/supabase-js';

type Env = {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_MASTER_EMAIL?: string;
  MASTER_EMAIL?: string;
};

type TableConfig = {
  select: string;
  order: string;
  search: string[];
};

const TABLES: Record<string, TableConfig> = {
  clinics: { select: 'id,name,phone,email,address,active,created_at', order: 'created_at', search: ['name', 'phone', 'email', 'address'] },
  profiles: { select: 'id,clinic_id,name,email,phone,role,active,created_at', order: 'created_at', search: ['name', 'email', 'phone', 'role'] },
  patients: { select: 'id,clinic_id,patient_code,name,phone,age,gender,email,created_at', order: 'created_at', search: ['patient_code', 'name', 'phone', 'email'] },
  appointments: { select: 'id,clinic_id,patient_id,doctor_id,appointment_time,status,op_fee_status,op_fee_amount,notes,created_at', order: 'appointment_time', search: ['status', 'op_fee_status', 'notes'] },
  patient_visits: { select: 'id,clinic_id,patient_id,doctor_id,visit_date,chief_complaint,diagnosis,doctor_notes,next_appointment_date,visit_status,created_at', order: 'visit_date', search: ['chief_complaint', 'diagnosis', 'doctor_notes', 'visit_status'] },
  invoices: { select: 'id,clinic_id,patient_id,visit_id,total_amount,paid_amount,due_amount,status,invoice_type,payment_category,created_at', order: 'created_at', search: ['status', 'invoice_type', 'payment_category'] },
  payments: { select: 'id,clinic_id,patient_id,invoice_id,amount,payment_method,payment_category,collected_by,created_at', order: 'created_at', search: ['payment_method', 'payment_category', 'notes'] },
  files: { select: 'id,clinic_id,patient_id,visit_id,file_type,file_name,file_url,file_note,xray_amount,xray_fee_status,created_at', order: 'created_at', search: ['file_type', 'file_name', 'file_note', 'xray_fee_status'] },
  staff_invites: { select: 'id,clinic_id,email,name,role,invite_code,accepted_at,created_at', order: 'created_at', search: ['email', 'name', 'role', 'invite_code'] },
  website_appointments: { select: 'id,patient_name,phone,treatment,preferred_date,preferred_time,status,source,created_at', order: 'created_at', search: ['patient_name', 'phone', 'treatment', 'status', 'source'] },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json;charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function getEnv(env: Env) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://mzjtdcpbvoximdukpukd.supabase.co';
  const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || 'sb_publishable_3krFoyWgVzrZP1g_pUy32g_iIn1AdYb';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const masterEmail = (env.VITE_MASTER_EMAIL || env.MASTER_EMAIL || 'karthikraja826@gmail.com').toLowerCase();
  return { supabaseUrl, anonKey, serviceKey, masterEmail };
}

async function requireMaster(request: Request, env: Env) {
  const { supabaseUrl, anonKey, masterEmail } = getEnv(env);
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();

  if (!token) return { ok: false as const, response: json({ error: 'Missing auth token' }, 401) };

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) return { ok: false as const, response: json({ error: 'Invalid auth token' }, 401) };
  if (data.user.email?.toLowerCase() !== masterEmail) return { ok: false as const, response: json({ error: 'Master access only' }, 403) };

  return { ok: true as const };
}

async function countRows(admin: ReturnType<typeof createClient>, table: string) {
  const { count } = await admin.from(table).select('*', { count: 'exact', head: true });
  return count || 0;
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const auth = await requireMaster(context.request, context.env);
  if (!auth.ok) return auth.response;

  const { supabaseUrl, serviceKey } = getEnv(context.env);
  if (!serviceKey) return json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY in Cloudflare Pages environment variables' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const url = new URL(context.request.url);
  const mode = url.searchParams.get('mode') || 'summary';

  if (mode === 'table') {
    const table = url.searchParams.get('table') || 'clinics';
    const config = TABLES[table];
    if (!config) return json({ error: 'Unknown table' }, 400);

    let query: any = admin.from(table).select(config.select).limit(250).order(config.order, { ascending: false });
    const search = (url.searchParams.get('search') || '').trim();
    if (search) query = query.or(config.search.map((column) => `${column}.ilike.%${search}%`).join(','));

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 400);
    return json({ rows: data || [] });
  }

  const { start, end } = todayBounds();
  const [clinics, staff, patients, visits, appointmentsToday, paymentsToday, pendingInvoices, activeClinics] = await Promise.all([
    countRows(admin, 'clinics'),
    countRows(admin, 'profiles'),
    countRows(admin, 'patients'),
    countRows(admin, 'patient_visits'),
    admin.from('appointments').select('*', { count: 'exact', head: true }).gte('appointment_time', start).lt('appointment_time', end),
    admin.from('payments').select('amount').gte('created_at', start).lt('created_at', end).limit(2000),
    admin.from('invoices').select('due_amount').gt('due_amount', 0).limit(2000),
    admin.from('clinics').select('*', { count: 'exact', head: true }).eq('active', true),
  ]);

  const revenueToday = (paymentsToday.data || []).reduce((sum, row: any) => sum + Number(row.amount || 0), 0);
  const pendingDue = (pendingInvoices.data || []).reduce((sum, row: any) => sum + Number(row.due_amount || 0), 0);

  return json({
    summary: {
      clinics,
      activeClinics: activeClinics.count || 0,
      staff,
      patients,
      visits,
      appointmentsToday: appointmentsToday.count || 0,
      revenueToday,
      pendingDue,
    },
    tables: Object.keys(TABLES),
  });
}
