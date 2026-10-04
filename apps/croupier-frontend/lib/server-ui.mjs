import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {platformConfiguration} from './platform-routing.mjs';
import {gameEntryEnabled,gameEntryRedirect,decorateGameEntryHtml} from '../../../web/public/game-entry-contract.mjs';

const DOCUMENTS = new Map([
  ['/game', 'game.html'], ['/game/', 'game.html'], ['/blackjack', 'blackjack.html'], ['/blackjack/', 'blackjack.html'],
  ['/v2', 'game.html'], ['/v2/', 'game.html'], ['/casino.html', 'casino.html'],
]);

const HANDOFF = /^\/api\/bo\/(?:game|lab)-login\?state=[a-f0-9]{64}$/;
function legacyStudioLocation(url) {
  if (['/bo','/bo/','/bo/index.html'].includes(url.pathname)) return '/studio/administration';
  if (url.pathname === '/bo/login.html') {
    const returnTo = url.searchParams.get('returnTo');
    return returnTo && (['/studio','/studio/administration'].includes(returnTo) || HANDOFF.test(returnTo))
      ? `/studio/login?returnTo=${encodeURIComponent(returnTo)}` : '/studio/login';
  }
  if (url.pathname === '/bo/set-password.html') {
    const token = url.searchParams.get('t');
    return token && /^[A-Za-z0-9_-]{32,128}$/.test(token) ? `/studio/set-password?t=${encodeURIComponent(token)}` : '/studio/set-password';
  }
  return null;
}

export async function platformUiDocument(request, {env = process.env, directory = resolve(process.cwd(), 'runtime-ui')} = {}) {
  const config = platformConfiguration(env);
  const url = new URL(request.url),path = url.pathname;
  const legacy = legacyStudioLocation(url);
  const headers = {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
  if (legacy) {
    if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
    return new Response(null,{status:308,headers:{...headers,Location:legacy}});
  }
  const canonical = gameEntryEnabled(env);
  const file = canonical && ['/blackjack','/blackjack/'].includes(path) ? 'game.html'
    : canonical && ['/player-login','/player-login/'].includes(path) ? 'blackjack.html' : DOCUMENTS.get(path);
  if (!config || !file) return new Response(null, {status: 404, headers});
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status: 405, headers: {...headers, Allow: 'GET, HEAD'}});
  const destination = gameEntryRedirect(url,env);
  if (destination) return new Response(null,{status:307,headers:{...headers,Location:destination}});
  let html;
  try { html = await readFile(resolve(directory, file), 'utf8'); } catch { return new Response(null, {status: 503, headers}); }
  return new Response(request.method === 'HEAD' ? null : decorateGameEntryHtml(html,env), {headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'}});
}
