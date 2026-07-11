import { onRequestGet as onAdminRead } from '../functions/api/admin';
import { onRequestGet as onControlRead, onRequestPost as onControlWrite } from '../functions/api/admin-control';

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
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      return onAdminRead({ request, env });
    }

    if (url.pathname === '/api/admin-control') {
      if (request.method === 'GET') return onControlRead({ request, env });
      if (request.method === 'POST') return onControlWrite({ request, env });
      return new Response('Method not allowed', { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};
