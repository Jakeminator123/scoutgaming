// Table Studio signs in with the back office's own accounts (scout-gg/croupier web/server.mjs, on this
// host). The game server only relays: the sign-in to /api/bo/login, the session check to /api/bo/me.
// Any BO role may build demo tables; a partner launch token (same signing key, no role) may not.
const ROLES = ['reader', 'staff', 'admin', 'superadmin'];
const boCookie = headers => /(?:^|;\s*)bo_jwt=([A-Za-z0-9._-]+)(?:;|$)/.exec(headers.cookie ?? '')?.[1] ?? null;

export function createBoSession({ base = process.env.BO_AUTH_URL ?? process.env.BO_DESIGN_URL ?? 'http://127.0.0.1:4173', fetcher = fetch } = {}) {
  const origin = new URL(base);
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.username || origin.password)
    throw Error('BO auth must use a local service');

  // The signed-in BO user for a request, or null. Throws when the BO cannot be reached (callers fail closed).
  async function user(headers) {
    const jwt = boCookie(headers);
    if (!jwt) return null;
    const r = await fetcher(new URL('/api/bo/me', origin), { headers: { cookie: `bo_jwt=${jwt}` }, redirect: 'error', signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw Error('Back office unavailable');
    const me = await r.json();
    return typeof me?.user === 'string' && ROLES.includes(me.role) ? { user: me.user, role: me.role } : null;
  }

  // Relays a sign-in. The BO's own limiter sees the visitor's address (it reads the first forwarded hop).
  async function login({ user: name, pass }, address) {
    const r = await fetcher(new URL('/api/bo/login', origin), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
      // Emil 11 Oct: 'Emil@…' failed where 'emil@…' worked, the BO matches user and e-mail case-sensitively and every
      // stored account is lower case, so the name goes over trimmed and in lower case. The password is untouched.
      body: JSON.stringify({ user: String(name ?? '').trim().toLowerCase().slice(0, 200), pass: String(pass ?? '').slice(0, 200) }),
    });
    const cookie = r.headers.get('set-cookie');
    const jwt = cookie && /(?:^|;\s*)bo_jwt=([A-Za-z0-9._-]+)/.exec(cookie)?.[1];
    return { status: r.status, cookie: r.ok ? cookie : null, who: r.ok && jwt ? await user({ cookie: `bo_jwt=${jwt}` }) : null };
  }

  // Clears the shared BO cookie on this host (the BO has no logout route), which also signs out of /bo/.
  const logoutCookie = secure => `bo_jwt=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;

  return { user, login, logoutCookie };
}
