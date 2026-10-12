// Kevin 12 Oct: the Play demo is really password protected, and there is one path. The website's /demo posts the
// password to POST /demo/unlock; the right one signs the visitor in to Table Studio as the shared Test Player back
// office account (server.mjs). The game page is served only for a Table Studio table or a signed-in back office
// account; everyone else goes to the password page. Off when DEMO_PASSWORD is unset.
import { timingSafeEqual } from 'node:crypto';

export function createDemoGate({ password = process.env.DEMO_PASSWORD ?? '', passwordPage = 'https://scoutgaminggroup.com/demo' } = {}) {
  const on = !!password;
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
  const rightPassword = given => on && same(String(given ?? '').trim(), password);
  return { on, rightPassword, passwordPage };
}
