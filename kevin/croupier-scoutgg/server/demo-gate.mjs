// Kevin 12 Oct: the Play demo must really be password protected, not just a page in front of an open game.
// The game page (/ with a query) is served only to a visitor with a valid demo pass (a signed cookie set by
// POST /demo/unlock with the right password), a signed-in back office account, or a link to a Table Studio table
// (aggregators share those). Everyone else goes to the password page on the website. Off when DEMO_PASSWORD is unset.
import { createHmac, timingSafeEqual } from 'node:crypto';

const DAY = 86400;
export function createDemoGate({ password = process.env.DEMO_PASSWORD ?? '', secret = process.env.DEMO_GATE_SECRET ?? '',
  passwordPage = 'https://scoutgaminggroup.com/demo', days = 30, now = () => Date.now() } = {}) {
  const on = !!password && secret.length >= 16;
  const sign = exp => createHmac('sha256', secret).update(`demo:${exp}`).digest('base64url');
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
  const cookieOf = headers => /(?:^|;\s*)demo_pass=([0-9]+)\.([A-Za-z0-9_-]+)(?:;|$)/.exec(headers.cookie ?? '');
  function hasPass(headers) {
    if (!on) return true;
    const m = cookieOf(headers);
    return !!m && Number(m[1]) * 1000 > now() && same(m[2], sign(m[1]));
  }
  function passCookie(secure = true) {
    const exp = Math.floor(now() / 1000) + days * DAY;
    return `demo_pass=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * DAY}${secure ? '; Secure' : ''}`;
  }
  const rightPassword = given => on && same(String(given ?? '').trim(), password);
  return { on, hasPass, passCookie, rightPassword, passwordPage };
}
