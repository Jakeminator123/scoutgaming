import { BASE_DEALER_IDS, isDealerId, validatePublicRegisteredDealers } from './dealer-identity.mjs';
import {validateComposition} from './presentation-composition.mjs';
import { assertGameChoices, isGameLaneId, isOperatorSlug } from './game-lanes.mjs';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function validateStudioPreview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'expiresAt,presentationLaneId,projectRevision,sessionId'
    || !uuid.test(value.sessionId) || !isGameLaneId(value.presentationLaneId)
    || typeof value.projectRevision !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value.projectRevision)
    || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
    || new Date(value.expiresAt).toISOString() !== value.expiresAt) throw Error('Invalid studio preview');
  return Object.freeze({...value});
}
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
  const values = {dealer:isDealerId,presentation:value => ['local','original','layered'].includes(value),lane:isGameLaneId,
    performance:value => value === 'staged',motion:value => value === 'smooth60',rehearsal:value => value === '1',
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
const attributeText = value => value.replace(/[&"'<>]/g,character => ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'})[character]);
// Branding is operator-written JSON. It is escaped data for the client, never markup.
function brandingAttribute(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid game presentation');
  const text = JSON.stringify(value);
  if (typeof text !== 'string' || text.length > 8000) throw Error('Invalid game presentation');
  return attributeText(text);
}
export function decorateGameEntryHtml(html,env,selection,{offline = false} = {}) {
  if (!gameEntryEnabled(env) && offline !== true) return html;
  let attributes = gameEntryEnabled(env) ? ' data-game-path="/blackjack"' : '';
  if (selection) {
    if (selection.studioPreview !== undefined) {
      const preview = validateStudioPreview(selection.studioPreview);
      if (selection.lane !== preview.presentationLaneId || ['operator','roomId','packageRevision','branding'].some(key => selection[key] !== undefined)) throw Error('Invalid game presentation');
      attributes += ' data-studio-preview="' + attributeText(JSON.stringify(preview)) + '"';
    }
    if (!isGameLaneId(selection.lane) || !isDealerId(selection.dealer) || !['local','original','layered'].includes(selection.presentation)) throw Error('Invalid game presentation');
    attributes += ` data-game-lane="${selection.lane}" data-game-dealer="${selection.dealer}" data-game-presentation="${selection.presentation}"`;
    const registry = validatePublicRegisteredDealers(selection.registeredDealers ?? []);
    const extra = !BASE_DEALER_IDS.includes(selection.dealer) && !['paow','dragge'].includes(selection.dealer);
    if (extra && (selection.presentation !== 'local' || selection.localDealer !== selection.dealer || !registry.some(row => row.id === selection.dealer))) throw Error('Invalid game presentation');
    if (selection.localDealer !== undefined) {
      if (selection.presentation !== 'local' || selection.localDealer !== selection.dealer) throw Error('Invalid game presentation');
      attributes += ` data-game-local-dealer="${selection.localDealer}"`;
    }
    if (registry.length) attributes += ` data-game-registered-dealers="${attributeText(JSON.stringify(registry))}"`;
    const packaged = selection.packageRevision !== undefined || selection.branding !== undefined;
    if (selection.operator !== undefined) {
      if (!isOperatorSlug(selection.operator)) throw Error('Invalid game presentation');
      attributes += ` data-game-operator="${selection.operator}"`;
      if (packaged) {
        if (!Number.isSafeInteger(selection.packageRevision) || selection.packageRevision < 1) throw Error('Invalid game presentation');
        attributes += ` data-game-package-revision="${selection.packageRevision}" data-game-branding="${brandingAttribute(selection.branding)}"`;
      }
    } else if (packaged) throw Error('Invalid game presentation');
    if (selection.roomId !== undefined) {
      if (!isGameLaneId(selection.roomId) || !selection.operator || !Number.isSafeInteger(selection.packageRevision)) throw Error('Invalid game presentation');
      attributes += ` data-game-room-id="${selection.roomId}"`;
    }
    if (selection.composition !== undefined) {
      const text=JSON.stringify(validateComposition(selection.composition));
      if(text.length>32000)throw Error('Invalid game presentation');
      attributes+=` data-game-composition="${attributeText(text)}"`;
    }
    if (selection.choices !== undefined) {
      assertGameChoices(selection.choices, { registeredDealerIds: registry.map(row => row.id) });
      const text = JSON.stringify(selection.choices);
      if (text.length > 8000) throw Error('Invalid game presentation');
      attributes += ` data-game-choices="${attributeText(text)}"`;
    }
  }
  // A replacer function: attribute text must never be read as a $-pattern.
  return html.replace(/<html(?=[\s>])/i,() => '<html'+attributes);
}
