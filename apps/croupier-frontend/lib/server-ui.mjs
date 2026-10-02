import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {platformConfiguration, platformBackendHeaders} from './platform-routing.mjs';

const DOCUMENTS = new Map([
  ['/game', 'game.html'], ['/game/', 'game.html'], ['/blackjack', 'blackjack.html'], ['/blackjack/', 'blackjack.html'],
  ['/v2', 'game.html'], ['/v2/', 'game.html'], ['/casino.html', 'casino.html'],
  ['/bo', 'bo.html'], ['/bo/', 'bo.html'], ['/bo/index.html', 'bo.html'],
  ['/bo/login.html', 'bo-login.html'], ['/bo/set-password.html', 'bo-password.html'],
]);

export async function platformUiDocument(request, {env = process.env, fetchImpl = fetch, directory = resolve(process.cwd(), 'runtime-ui')} = {}) {
  const config = platformConfiguration(env);
  const path = new URL(request.url).pathname, file = DOCUMENTS.get(path);
  const headers = {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
  if (!config || !file) return new Response(null, {status: 404, headers});
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status: 405, headers: {...headers, Allow: 'GET, HEAD'}});
  if (file === 'bo.html') {
    let response;
    try { response = await fetchImpl(`${config.backendOrigin}/api/bo/me`, {headers: platformBackendHeaders(request.headers, config), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000)}); }
    catch { return new Response(null, {status: 503, headers}); }
    let account;
    try { account = response.ok ? await response.json() : null; } catch { account = null; }
    if (!response.ok && response.status !== 401) return new Response(null, {status: 503, headers});
    if (!account?.user || !['reader', 'staff', 'admin', 'superadmin'].includes(account.role)) return new Response(null, {status: 302, headers: {...headers, Location: '/bo/login.html'}});
  }
  let html;
  try { html = await readFile(resolve(directory, file), 'utf8'); } catch { return new Response(null, {status: 503, headers}); }
  return new Response(request.method === 'HEAD' ? null : html, {headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'}});
}
