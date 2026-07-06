import { onRequestGet } from '../functions/api/admin';

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_MASTER_EMAIL?: string;
  MASTER_EMAIL?: string;
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, type: 'worker' }), {
        headers: { 'content-type': 'application/json;charset=utf-8' },
      });
    }

    if (url.pathname === '/api/admin') {
      return onRequestGet({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
};
