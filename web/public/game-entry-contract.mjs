import { isGameLaneId } from './game-lanes.mjs';
const dealers = new Set(['vera','astrid','amira','mei']);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const gameEntryEnabled = env => env?.CROUPIER_STUDIO_NEON_POLICY === '1';
export function publicGamePath(env = {}) {
  if (gameEntryEnabled(env)) return '/blackjack';
  const value = env.CROUPIER_PUBLIC_GAME_PATH || '/';
  if (!['/','/game'].includes(value)) throw new Error('Invalid public game path');
  return value;
}

// Only public presentation/observation selectors survive an address alias.
// Neither a redirect target, an account identity nor a browser privilege is a
// game query. Duplicate values are ambiguous and are omitted as a whole.
export function approvedGameQuery(input,{origin,includeLaunch = true} = {}) {
  const source = input instanceof URLSearchParams ? input : new URLSearchParams(input);
  const result = new URLSearchParams();
  const one = key => source.getAll(key).length === 1 ? source.get(key) : null;
  const values = {dealer:value => dealers.has(value),presentation:value => ['local','original'].includes(value),lane:isGameLaneId,
    performance:value => value === 'staged',motion:value => value === 'smooth60',rehearsal:value => value === '1',
    table:value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)};
  for (const [key,valid] of Object.entries(values)) {const value = one(key);if (valid(value)) result.set(key,value);}
  const launch = one('launch');
  if (includeLaunch && typeof launch === 'string' && launch.length <= 16384 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(launch)) result.set('launch',launch);
  const observerOrigin = one('labObserverOrigin'),channel = one('labObserverChannel');
  try {
    const target = new URL(observerOrigin);
    const loopback = ['http:','https:'].includes(target.protocol) && ['localhost','127.0.0.1','[::1]'].includes(target.hostname);
    const sameCloud = target.protocol === 'https:' && target.origin === origin;
    if (observerOrigin === target.origin && !target.username && !target.password && (loopback || sameCloud) && uuid.test(channel || '')) {
      result.set('labObserverOrigin',observerOrigin);result.set('labObserverChannel',channel);
    }
  } catch { /* An incomplete/untrusted observer grants no channel. */ }
  return result;
}
export function canonicalGameDestination(input,options = {}) {
  const url = input instanceof URL ? input : new URL(input,'https://invalid.example');
  const query = approvedGameQuery(url.searchParams,{origin:url.origin,...options}).toString();
  return '/blackjack'+(query ? `?${query}` : '');
}
export function gameEntryRedirect(url,env) {
  if (!gameEntryEnabled(env)) return null;
  if (['/game','/game/'].includes(url.pathname)
    || url.pathname === '/' && ['dealer','presentation','lane','performance','motion','rehearsal','table','launch','labObserverOrigin','labObserverChannel'].some(key => url.searchParams.has(key))) return canonicalGameDestination(url);
  return null;
}
export function playerLoginDestination(url) {
  const query = approvedGameQuery(url.searchParams, { origin: url.origin, includeLaunch: false }).toString();
  return '/player-login' + (query ? `?${query}` : '');
}
export function decorateGameEntryHtml(html,env,selection) {
  if (!gameEntryEnabled(env)) return html;
  let attributes = ' data-game-path="/blackjack"';
  if (selection) {
    if (!isGameLaneId(selection.lane) || !dealers.has(selection.dealer) || !['local','original'].includes(selection.presentation)) throw Error('Invalid game presentation');
    attributes += ` data-game-lane="${selection.lane}" data-game-dealer="${selection.dealer}" data-game-presentation="${selection.presentation}"`;
  }
  return html.replace(/<html(?=[\s>])/i,'<html'+attributes);
}
