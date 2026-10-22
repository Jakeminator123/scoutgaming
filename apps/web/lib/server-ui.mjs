import {playerHandoffDestination} from '../../../packages/navigation/player-handoff.mjs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {platformConfiguration,platformBackendHeaders,gameLobbyDestination} from '../../../packages/navigation/server/platform-routing.mjs';
import {decorateGameEntryHtml} from '../../../services/game/public/game-entry-contract.mjs';
import {gameEntryEnabled, approvedGameQuery, playerLoginDestination, requestedGame, GAME_START_PATHS} from '../../../packages/navigation/game-entry.mjs';
import { OPERATOR_NOT_FOUND_HTML } from '../../../packages/navigation/operator-entry.mjs';

// /game is the only game document this frontend serves. /player-login is the
// player sign-in shell that the engine, the player area and roulette return to.
const LOGIN_PATHS = ['/player-login','/player-login/'];

function safeGameLocation(location) {
  if (typeof location !== 'string' || location.length > 2048 || !location.startsWith('/') || location.startsWith('//') || location.includes('\\') || /[\r\n]/.test(location)) return null;
  return location;
}

// Every authenticated blackjack start uses the engine document and its saved dealer/media context.
async function proxyOperatorGame(request, url, config, fetchImpl, headers) {
  const unavailable = () => new Response(request.method === 'HEAD' ? null : 'Spelet kunde inte öppnas. Försök igen om en stund.',
    {status:503,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  const approved = approvedGameQuery(url.searchParams,{origin:url.origin});
  approved.delete('game'); // The engine's blackjack document knows room selectors, not the public game selector.
  const query = approved.toString();
  const upstreamHeaders = platformBackendHeaders(new Headers({Accept:'text/html',
    ...(request.headers.get('cookie') ? {Cookie:request.headers.get('cookie')} : {})}),config);
  let upstream;
  try {
    upstream = await fetchImpl(`${config.backendOrigin}/blackjack${query ? `?${query}` : ''}`,{method:request.method,headers:upstreamHeaders,
      cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(10000)});
  } catch { return unavailable(); }
  if (upstream.status === 303 || upstream.status === 307) {
    const location = safeGameLocation(upstream.headers.get('location'));
    if (!location) return unavailable();
    return new Response(null,{status:upstream.status,headers:{...headers,Location:location}});
  }
  if (upstream.status === 404) {
    const body = request.method === 'HEAD' ? '' : await upstream.text();
    const html = body.includes('<title>Bolaget finns inte</title>') ? body : OPERATOR_NOT_FOUND_HTML;
    return new Response(request.method === 'HEAD' ? null : html,{status:404,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  }
  if (upstream.status !== 200) return unavailable();
  const html = request.method === 'HEAD' ? null : await upstream.text();
  if (request.method !== 'HEAD' && (typeof html !== 'string' || html.length > 2_000_000 || !/<html[\s>]/i.test(html))) return unavailable();
  return new Response(html,{status:200,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
}

export async function platformUiDocument(request, {env = process.env, directory = resolve(process.cwd(), 'runtime-ui'), fetchImpl = fetch} = {}) {
  const config = platformConfiguration(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const headers = {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
  const canonical = gameEntryEnabled(env);
  const gameStart = GAME_START_PATHS.includes(path);
  const file = gameStart ? 'game.html' : canonical && LOGIN_PATHS.includes(path) ? 'blackjack.html' : null;
  if (!config || !file) return new Response(null, {status: 404, headers});
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status: 405, headers: {...headers, Allow: 'GET, HEAD'}});
  if (gameStart) {
    const game = requestedGame(url.searchParams);
    if (game === null) return new Response(null, {status: 404, headers}); // An unknown game is no game.
    const lobby = gameLobbyDestination(url,config);
    if (lobby) return new Response(null,{status:303,headers:{...headers,Location:lobby}});
    // The roulette room document is the engine's; the platform middleware
    // rewrites /game?game=roulette there before this route can run.
    if (game === 'roulette') return new Response(null, {status: 404, headers});
  }
  if (canonical && gameStart) {
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
      if (session.backofficeHandoff===true) {
        const handoff=playerHandoffDestination(url.pathname+url.search,{origin:url.origin});
        if(handoff) return new Response(null,{status:303,headers:{...headers,Location:handoff}});
      }
      if (!session.authenticated) return new Response(null,{status:303,headers:{...headers,Location:playerLoginDestination(url)}});
      return proxyOperatorGame(request,url,config,fetchImpl,headers);
    } catch {
      return new Response(request.method === 'HEAD' ? null : 'Spelet kunde inte öppnas. Försök igen om en stund.',
        {status:503,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
    }
  }
  let html;
  try { html = await readFile(resolve(directory, file), 'utf8'); } catch { return new Response(null, {status: 503, headers}); }
  return new Response(request.method === 'HEAD' ? null : decorateGameEntryHtml(html,env), {headers: {...headers, 'Content-Type': 'text/html; charset=utf-8'}});
}
