/**
 * Decap CMS OAuth Proxy — Cloudflare Worker
 * ------------------------------------------
 * Lets Decap CMS (hosted on GitHub Pages at /admin/) complete the
 * GitHub OAuth flow without needing a full backend.
 *
 * Routes:
 *   GET /auth         → redirects to GitHub's authorize URL
 *   GET /callback     → receives GitHub code, exchanges for token, posts to opener
 *
 * Environment vars required (configured in Cloudflare dashboard):
 *   GITHUB_CLIENT_ID      — OAuth App's Client ID
 *   GITHUB_CLIENT_SECRET  — OAuth App's Client Secret
 *
 * Optional:
 *   ALLOWED_ORIGIN        — origin allowed to call this worker (default: https://jan166.github.io)
 */

const DEFAULT_ORIGIN = 'https://jan166.github.io';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;

    // Step 1: /auth — Decap CMS opens this in a popup
    if (url.pathname === '/auth' || url.pathname === '/auth/') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/callback`,
        scope: 'repo,user',
        state: crypto.randomUUID(),
      });
      return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
    }

    // Step 2: /callback — GitHub redirects back with ?code=...
    if (url.pathname === '/callback' || url.pathname === '/callback/') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('Missing code', { status: 400 });

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const data = await tokenRes.json();

      const status = data.access_token ? 'success' : 'error';
      const payload = JSON.stringify({
        token: data.access_token || null,
        provider: 'github',
        error: data.error || null,
      });

      // Decap CMS listens for postMessage from the popup
      return new Response(
        `<!doctype html>
<html><body>
<script>
  (function() {
    function receive(e) {
      if (e.data !== 'authorizing:github') return;
      window.removeEventListener('message', receive, false);
      e.source.postMessage('authorization:github:${status}:${payload.replace(/'/g, "\\'")}', e.origin);
    }
    window.addEventListener('message', receive, false);
    window.opener && window.opener.postMessage('authorizing:github', '${origin}');
  })();
</script>
Authenticating…
</body></html>`,
        {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('Decap CMS OAuth proxy — OK', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
