type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, type: 'worker' }), {
        headers: { 'content-type': 'application/json;charset=utf-8' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
