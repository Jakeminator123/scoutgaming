import {isActiveDealerId as isDealerId} from '../presentation/contracts/dealer-identity.mjs';
import {isGameLaneId} from '../presentation/contracts/game-lane-id.mjs';
import {isOperatorSlug} from './operator-slug.mjs';
import {playerLobbyPath} from './player-lobby.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
// One public game start. The lobby links here; the engine documents stay behind it.
export const GAME_START_PATH = '/game';
export const GAME_START_PATHS = Object.freeze(['/game', '/game/']);
export const GAMES = Object.freeze(['blackjack', 'roulette']);
// Selectors that make a game start an actual room/presentation choice rather than a lobby entry.
export const GAME_CONTEXT_KEYS = Object.freeze(['dealer','presentation','lane','rehearsal','table','launch','labObserverOrigin','labObserverChannel']);
export const gameEntryEnabled = env => env?.CROUPIER_STUDIO_NEON_POLICY === '1';
export function publicGamePath(env = {}) {
  if (gameEntryEnabled(env)) return GAME_START_PATH;
  const value = env.CROUPIER_PUBLIC_GAME_PATH || '/';
  if (!['/','/game'].includes(value)) throw new Error('Invalid public game path');
  return value;
}

// The game selector is strict: absent means blackjack, one known value selects
// that game, and an unknown or repeated value is null so no route can default
// a player into another game.
export function requestedGame(input) {
  const source = input instanceof URLSearchParams ? input : new URLSearchParams(input);
  const values = source.getAll('game');
  if (!values.length) return 'blackjack';
  return values.length === 1 && GAMES.includes(values[0]) ? values[0] : null;
}

// Only public presentation/observation selectors survive an address alias.
// Neither a redirect target, an account identity nor a browser privilege is a
// game query. Duplicate values are ambiguous and are omitted as a whole.
export function approvedGameQuery(input,{origin,includeLaunch = true} = {}) {
  const source = input instanceof URLSearchParams ? input : new URLSearchParams(input);
  const result = new URLSearchParams();
  const one = key => source.getAll(key).length === 1 ? source.get(key) : null;
  const values = {game:value => GAMES.includes(value),dealer:isDealerId,presentation:value => ['local','layered'].includes(value),lane:isGameLaneId,
    rehearsal:value => value === '1',
    table:value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value),operator:isOperatorSlug};
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
  return GAME_START_PATH+(query ? `?${query}` : '');
}
// The lobby and Studio build their launch links from a published room; the
// game is explicit so a roulette room never opens the blackjack document.
export function gameStartPath({game = 'blackjack',operator,table,dealer,lane} = {}) {
  if (!GAMES.includes(game)) throw new Error('Unknown game');
  const query = new URLSearchParams({game});
  for (const [key,value] of [['operator',operator],['table',table],['dealer',dealer],['lane',lane]]) {
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || !value) throw new Error(`Invalid game start ${key}`);
    query.set(key,value);
  }
  return `${GAME_START_PATH}?${query}`;
}
// The engine's roulette document accepts the room selectors only, each at most once.
export function rouletteRoomSearch(input,{origin} = {}) {
  const approved = approvedGameQuery(input,{origin,includeLaunch:false});
  const query = new URLSearchParams();
  for (const key of ['operator','table','dealer']) if (approved.has(key)) query.set(key,approved.get(key));
  const text = query.toString();
  return text ? `?${text}` : '';
}
// The roulette document stays on the engine's /play/roulette behind the /game
// start: its client posts the page's own query as the room context and the
// engine rejects any key but operator/table/dealer, so the document address
// cannot carry game=roulette until services/game filters that context.
export const ROULETTE_DOCUMENT_PATH = '/play/roulette';
export const ROULETTE_DOCUMENT_PATHS = Object.freeze(['/play/roulette', '/play/roulette/']);
export function rouletteDocumentPath(input,{origin} = {}) {
  return ROULETTE_DOCUMENT_PATH + rouletteRoomSearch(input,{origin});
}
// Retired document addresses keep working for one release as a permanent
// redirect; the path names the game and only approved selectors survive.
const LEGACY_GAME_STARTS = new Map([['/play/blackjack','blackjack'],['/blackjack','blackjack'],['/roulette','roulette']]);
export function legacyGameStartRedirect(url) {
  const game = LEGACY_GAME_STARTS.get(url.pathname.length > 1 ? url.pathname.replace(/\/$/,'') : url.pathname);
  if (!game) return null;
  const query = approvedGameQuery(url.searchParams,{origin:url.origin});
  query.delete('game');
  const text = query.toString();
  return `${GAME_START_PATH}?game=${game}${text ? `&${text}` : ''}`;
}
export function gameEntryRedirect(url,env) {
  if (!gameEntryEnabled(env)) return null;
  if (GAME_START_PATHS.includes(url.pathname) && !GAME_CONTEXT_KEYS.some(key => url.searchParams.has(key))) return playerLobbyPath(url.searchParams,url.hash);
  if (url.pathname === '/' && [...GAME_CONTEXT_KEYS,'performance','motion'].some(key => url.searchParams.has(key))) return canonicalGameDestination(url);
  return null;
}
export function playerLoginDestination(url) {
  const query = approvedGameQuery(url.searchParams, { origin: url.origin, includeLaunch: false }).toString();
  return '/player-login' + (query ? `?${query}` : '');
}
