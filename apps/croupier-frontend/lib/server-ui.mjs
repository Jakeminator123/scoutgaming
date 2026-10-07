import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {platformConfiguration,platformBackendHeaders} from './platform-routing.mjs';
import {gameEntryEnabled,gameEntryRedirect,decorateGameEntryHtml,playerLoginDestination} from '../../../web/public/game-entry-contract.mjs';
import {gameLaneSelection} from '../../../web/public/game-lanes.mjs';

const DOCUMENTS = new Map([
  ['/game', 'game.html'], ['/game/', 'game.html'], ['/blackjack', 'blackjack.html'], ['/blackjack/', 'blackjack.html'],
  ['/v2', 'game.html'], ['/v2/', 'game.html'], ['/casino.html', 'casino.html'],
]);

const HANDOFF = /^\/api\/bo\/(?:game|lab)-login\?state=[a-f0-9]{64}$/;
function legacyStudioLocation(url) {
  if (['/bo','/bo/','/bo/index.html'].includes(url.pathname)) return '/control/administration';
  if (url.pathname === '/bo/login.html') {
    const returnTo = url.searchParams.get('returnTo');
    const allowed = ['/studio','/studio/administration','/control','/control/administration'];
    return returnTo && (allowed.includes(returnTo) || HANDOFF.test(returnTo))
      ? `/control/login?returnTo=${encodeURIComponent(returnTo)}` : '/control/login';
  }
  if (url.pathname === '/bo/set-password.html') {
    const token = url.searchParams.get('t');
    return token && /^[A-Za-z0-9_-]{32,128}$/.test(token) ? `/control/set-password?t=${encodeURIComponent(token)}` : '/control/set-password';
  }
  return null;
}

export async function platformUiDocument(request, {env = process.env, directory = resolve(process.cwd(), 'runtime-ui'), fetchImpl = fetch} = {}) {
  const config = platformConfiguration(env);
  const url = new URL(request.url);
  // The public address changes; the existing session/lane/media contract does not.
  const path = config?.unifiedUi && url.pathname === '/play/blackjack' ? '/blackjack' : url.pathname;
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
  let selection;
  if (canonical && ['/blackjack','/blackjack/'].includes(path)) {
    // The public UI uses the same live account session and saved policy as the
    // engine. No cached/default player shell is served while access is unknown.
    const upstreamHeaders = platformBackendHeaders(new Headers({Accept:'application/json',
      ...(request.headers.get('cookie') ? {Cookie:request.headers.get('cookie')} : {})}),config);
    const read = async endpoint => {
      const response = await fetchImpl(config.backendOrigin+endpoint,{headers:upstreamHeaders,
        cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error('Game entry unavailable');
      return response.json();
    };
    try {
      const session = await read('/api/auth/session');
      if (typeof session?.authenticated !== 'boolean') throw Error('Invalid session');
      if (!session.authenticated) return new Response(null,{status:303,headers:{...headers,Location:playerLoginDestination(url)}});
      const policy = await read('/api/bo/config');
      selection = gameLaneSelection(url.searchParams,policy?.gameLane === undefined ? 'mobile-phone' : policy.gameLane,policy?.gameLanes);
    } catch {
      return new Response(request.method === 'HEAD' ? null : 'Spelet kunde inte öppnas. Försök igen om en stund.',
        {status:503,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
    }
  }
  let html;
  try { html = await readFile(resolve(directory, file), 'utf8'); } catch { return new Response(null, {status: 503, headers}); }
  return new Response(request.method === 'HEAD' ? null : decorateGameEntryHtml(html,env,selection), {headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'}});
}
