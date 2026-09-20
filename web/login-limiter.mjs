// Failed-login limiter shared by the player and backoffice logins.
// Keyed by client IP (first X-Forwarded-For hop behind Caddy) and by account name,
// so one attacker cannot lock everyone out and one account cannot be hammered from many IPs.
// Only failures count; a success clears both keys. Stale entries are swept on every call.
export function loginLimiter({ max = 10, windowMs = 15 * 60_000 } = {}) {
  const fails = new Map();
  const sweep = now => { for (const [k, v] of fails) if (now - v.at > windowMs) fails.delete(k); };
  const ipOf = req => (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  const keys = (req, user) => ['ip:' + ipOf(req), ...(user ? ['user:' + String(user).toLowerCase()] : [])];
  return {
    ipOf,
    blocked(req, user) { const now = Date.now(); sweep(now); return keys(req, user).some(k => (fails.get(k)?.n ?? 0) >= max); },
    fail(req, user) { const now = Date.now(); for (const k of keys(req, user)) { const v = fails.get(k) ?? { n: 0, at: now }; v.n++; v.at = now; fails.set(k, v); } },
    ok(req, user) { for (const k of keys(req, user)) fails.delete(k); },
    size() { return fails.size; },
  };
}
