import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mzjtdcpbvoximdukpukd.supabase.co';
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_3krFoyWgVzrZP1g_pUy32g_iIn1AdYb';
export const MASTER_EMAIL = (import.meta.env.VITE_MASTER_EMAIL || 'karthikraja826@gmail.com').toLowerCase();

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
