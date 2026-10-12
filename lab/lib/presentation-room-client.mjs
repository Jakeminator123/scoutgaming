import { labUrl } from './lab-url.mjs';
import { workspaceSurfacePath } from './workspace-surfaces.mjs';
import { validatePresentationCapabilities } from '../../web/presentation-capability-contract.mjs';

const ENDPOINT = '/api/admin/presentation-room';
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const laneId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value) && !['original', 'constructor', 'prototype'].includes(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const revision = identifier;
const packageRevision = value => Number.isSafeInteger(value) && value > 0;
const roomName = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 100 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const reasons = new Set(['studio_presentation_runtime_update_required', 'presentation_lane_incompatible', 'presentation_package_conflict', 'presentation_package_too_large', 'presentation_room_environment_required']);
const conflictMessages = Object.freeze({
  presentation_shared_dealer_conflict: 'En dealer har olika sparade definitioner i paketets presentationer, till exempel klipp eller automatik. Granska hela bolagets nuvarande paketurval och publicera alla dessa presentationer tillsammans först. Behåll befintliga rum och dealers.',
  presentation_shared_layer_conflict: 'Ett bord eller en bakgrund skiljer sig från paketets frysta definition. Granska hela bolagets nuvarande paketurval och publicera alla dessa presentationer tillsammans först. Behåll befintliga rum och dealers.',
  presentation_legacy_package_conflict: 'Paketets äldre format kan inte uppdateras en presentation i taget. Granska hela bolagets nuvarande paketurval och publicera alla dessa presentationer tillsammans först. Behåll befintliga rum och dealers.',
  presentation_room_binding_conflict: 'Ett befintligt spelrum är kopplat till en annan startdealer eller spelkonfiguration. Kontrollera sammansättningens startdealer mot rummets inställningar i Administration. Rummets koppling ändras inte av publicering.',
  presentation_game_lane_conflict: 'Den tekniska spelkonfigurationen krockar med en befintlig definition. Kontrollera Bord & spelrum i Administration. Skapa inte ett extra rum för att kringgå konflikten.',
  presentation_room_environment_conflict: 'Sammansättningen används redan av publicerade rum med en annan miljö. Skapa en separat sammansättning för det nya rummets fasta bakgrund. Befintliga rum och deras publicerade miljöer ändras inte här.',
});
const sameKeys = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export class PresentationRoomError extends Error {
  constructor(message, { status = 0, uncertain = false } = {}) {
    super(message); this.name = 'PresentationRoomError'; this.status = status; this.uncertain = uncertain;
  }
}
const invalid = () => { throw new PresentationRoomError('Svaret kunde inte verifieras.'); };
function capability(value) {
  if (value === null) return null;
  try { return validatePresentationCapabilities(value); } catch { invalid(); }
}
export function presentationRoomContextKey(context) {
  return JSON.stringify([context?.operator?.id ?? null, context?.operator?.slug ?? null, context?.presentation?.id ?? null, context?.projectRevision ?? null]);
}
function validContext(context) {
  return object(context?.operator) && identifier(context.operator.id) && workspaceSurfacePath('partner', 'ops', context.operator.slug) !== null
    && laneId(context?.presentation?.id) && revision(context.projectRevision);
}
function preflight(value, context) {
  if (!object(value) || value.ok !== true || !object(value.operator) || value.operator.id !== context.operator.id
    || value.operator.slug !== context.operator.slug || typeof value.operator.name !== 'string'
    || value.presentationLaneId !== context.presentation.id || !revision(value.projectRevision) || !revision(value.administrationRevision)
    || !(value.packageRevision === null || packageRevision(value.packageRevision)) || typeof value.ready !== 'boolean'
    || !(value.reason === null || reasons.has(value.reason)) || !Object.hasOwn(value, 'capabilities') || !Array.isArray(value.rooms)) invalid();
  const conflictCode = value.conflictCode ?? null;
  if (conflictCode !== null && (typeof conflictCode !== 'string' || !Object.hasOwn(conflictMessages, conflictCode)
    || value.reason !== 'presentation_package_conflict' || value.ready)) invalid();
  const capabilities = capability(value.capabilities);
  const environment = value.environment ?? null;
  if (environment !== null && (!sameKeys(environment, ['kind', 'fixed', 'label'])
    || !['baked', 'image', 'video', 'variable'].includes(environment.kind) || typeof environment.fixed !== 'boolean'
    || !roomName(environment.label) || value.ready && !environment.fixed
    || environment.kind === 'variable' && environment.fixed)) invalid();
  if (value.ready && (value.reason !== null || ![2, 3, 4, 9].includes(capabilities?.schemaVersion))) invalid();
  const seen = new Set();
  const rooms = value.rooms.map(room => {
    if (!sameKeys(room, ['id', 'name', 'playUrl']) || !laneId(room.id) || !roomName(room.name) || seen.has(room.id)) invalid();
    seen.add(room.id);
    return Object.freeze({ id: room.id, name: room.name,
      playUrl: presentationRoomPlayUrl(room.playUrl, { operatorSlug: context.operator.slug, roomId: room.id }) });
  });
  if (rooms.length && !packageRevision(value.packageRevision)) invalid();
  return Object.freeze({ ok: true, operator: Object.freeze({ id: value.operator.id, slug: value.operator.slug, name: value.operator.name }),
    presentationLaneId: value.presentationLaneId, projectRevision: value.projectRevision, administrationRevision: value.administrationRevision,
    packageRevision: value.packageRevision, ready: value.ready, reason: value.reason, conflictCode, capabilities,
    environment: environment && Object.freeze({ ...environment }), rooms: Object.freeze(rooms) });
}
export function presentationRoomPlayUrl(value, { operatorSlug, roomId }) {
  if (typeof value !== 'string' || value.length > 500 || !/^\/play\/(blackjack|roulette)\?/.test(value) || /[#\\\u0000-\u0020\u007f]/u.test(value)) invalid();
  const url = new URL(value, 'https://studio.invalid');
  if (url.origin !== 'https://studio.invalid' || !['/play/blackjack','/play/roulette'].includes(url.pathname) || url.hash || url.searchParams.size !== 2
    || url.searchParams.getAll('operator').length !== 1 || url.searchParams.getAll('table').length !== 1
    || url.searchParams.get('operator') !== operatorSlug || url.searchParams.get('table') !== roomId) invalid();
  return url.pathname+'?' + new URLSearchParams({ operator: operatorSlug, table: roomId }).toString();
}
function receipt(value, context, payload) {
  const room = value?.room;
  if (!object(value) || value.ok !== true || typeof value.duplicate !== 'boolean' || !sameKeys(room, ['schemaVersion', 'id', 'name', 'operatorId', 'presentationLaneId', 'gameLaneId', 'state', ...(Object.hasOwn(room ?? {},'game')?['game']:[])])
    || (Object.hasOwn(room ?? {},'game') ? room.game : 'blackjack') !== (payload.game ?? 'blackjack')
    || room.schemaVersion !== 2 || !room.id?.startsWith('room-') || !uuid(room.id.slice(5)) || room.name !== payload.name
    || room.operatorId !== context.operator.id || room.presentationLaneId !== context.presentation.id || !laneId(room.gameLaneId) || room.state !== 'live'
    || !revision(value.administrationRevision) || !packageRevision(value.packageRevision)) invalid();
  const playUrl = presentationRoomPlayUrl(value.playUrl, { operatorSlug: context.operator.slug, roomId: room.id });
  if (!playUrl.startsWith(`/play/${payload.game ?? 'blackjack'}?`)) invalid();
  return Object.freeze({ ok: true, duplicate: value.duplicate, room: Object.freeze({ ...room }),
    administrationRevision: value.administrationRevision, packageRevision: value.packageRevision, playUrl });
}
function statusMessage(status) {
  return ({ 401: 'Logga in igen för att skapa spelrummet.', 403: 'Åtkomst nekad.', 409: 'Uppgifterna har ändrats. Uppdatera innan du skapar rummet.',
    422: 'Kontrollera rumsnamnet och presentationen.', 429: 'För många försök. Försök igen senare.', 503: 'Spelrumstjänsten är tillfälligt otillgänglig.' })[status] || 'Spelrummet kunde inte bekräftas.';
}
export function createPresentationRoomClient({ fetchImpl = fetch } = {}) {
  async function request(path, options, writing) {
    let response;
    try {
      response = await fetchImpl(path, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', ...options,
        headers: { Accept: 'application/json', ...(writing ? { 'Content-Type': 'application/json' } : {}) } });
    } catch { throw new PresentationRoomError(writing ? 'Svaret är osäkert. Försök igen med samma uppgifter.' : 'Uppgifterna kunde inte hämtas.', { uncertain: writing }); }
    if (!response.ok) throw new PresentationRoomError(statusMessage(response.status), { status: response.status, uncertain: writing && response.status >= 500 });
    try { return await response.json(); } catch { throw new PresentationRoomError('Svaret kunde inte verifieras.', { uncertain: writing }); }
  }
  return Object.freeze({
    async read(context, { signal } = {}) {
      if (!validContext(context)) invalid();
      const query = new URLSearchParams({ operatorId: context.operator.id, presentationLaneId: context.presentation.id });
      return preflight(await request(labUrl(ENDPOINT) + '?' + query, { method: 'GET', signal }, false), context);
    },
    async create(context, payload, { signal } = {}) {
      if (!validContext(context) || payload?.operatorId !== context.operator.id || payload?.presentationLaneId !== context.presentation.id
        || !roomName(payload.name) || !uuid(payload.idempotencyKey) || !revision(payload.expectedProjectRevision)
        || !revision(payload.expectedAdministrationRevision) || !(payload.expectedPackageRevision === null || packageRevision(payload.expectedPackageRevision))) invalid();
      const value = await request(labUrl(ENDPOINT), { method: 'POST', body: JSON.stringify(payload), signal }, true);
      try { return receipt(value, context, payload); } catch { throw new PresentationRoomError('Spelrummet kan ha skapats, men svaret kunde inte verifieras. Försök igen med samma uppgifter.', { uncertain: true }); }
    },
  });
}
function readinessMessage(prepared, context) {
  if (prepared.projectRevision !== context.projectRevision) return 'Presentationen har ändrats. Ladda om sidan.';
  if (prepared.reason === 'presentation_room_environment_required') return 'Ett nytt spelrum behöver en fast miljö. Välj en enda tillåten bakgrund som standard i Sammansättningar och spara. Använd en separat sammansättning om den nuvarande redan delas av publicerade rum. Inbakade miljöer för flera dealers kan inte räknas som samma rum.';
  if (prepared.reason === 'studio_presentation_runtime_update_required') return 'Spelservern behöver uppdateras innan rummet kan skapas.';
  if (prepared.reason === 'presentation_lane_incompatible') return 'Presentationen saknar en spelbar sammansättning. Kontrollera vald grundloop, dealer och lager i Sammansättning och spara.';
  if (prepared.reason === 'presentation_package_conflict' && prepared.conflictCode) return conflictMessages[prepared.conflictCode];
  if (prepared.reason === 'presentation_package_conflict') return 'Paketet kan inte uppdateras eftersom uppgifter har ändrats eller ett befintligt spelrum påverkas. Läs in bolagets aktuella paket och kontrollera presentationerna.';
  if (prepared.reason === 'presentation_package_too_large') return 'Paketet är för stort. Minska presentationens innehåll eller paketets urval och försök igen.';
  return prepared.ready ? null : 'Spelrummet kan inte skapas ännu.';
}
  const empty = Object.freeze({ key: null, name: '', game: 'blackjack', status: 'idle', preflight: null, receipt: null, message: null });
// One controller per mounted form. Attempts remain scoped to their original
// company/presentation/revision, including when a response is lost or ignored.
export function createPresentationRoomController({ client = createPresentationRoomClient(), newKey = () => crypto.randomUUID() } = {}) {
  const listeners = new Set(), attempts = new Map();
  let context = null, state = empty, generation = 0, active = null, locked = false;
  const notify = next => { state = Object.freeze({ ...state, ...next }); for (const listener of listeners) listener(); };
  const enabled = () => validContext(context) && context.projectSaved && context.storeAvailable && !context.disabled;
  const current = token => token === generation;
  function cancel() {
    generation++; active?.abort(); active = null; locked = false;
  }
  async function read(token, signal) {
    const prepared = await client.read(context, { signal });
    if (!current(token)) return null;
    return prepared;
  }
  async function refresh() {
    if (locked || !enabled()) return false;
    locked = true; const token = generation, controller = new AbortController(); active = controller;
    notify({ status: 'loading', message: null, receipt: null, preflight: null });
    try {
      const prepared = await read(token, controller.signal); if (!prepared) return false;
      const message = readinessMessage(prepared, context), attempt = attempts.get(state.key);
      notify({ preflight: prepared, status: attempt ? 'uncertain' : message ? 'unavailable' : 'ready',
        message: attempt ? 'Svaret är osäkert. Kontrollera det tidigare försöket med samma uppgifter innan du skapar något nytt.' : message });
      return !message;
    } catch (error) {
      if (current(token)) notify({ status: 'error', message: error.message });
      return false;
    } finally { if (current(token)) { locked = false; active = null; } }
  }
  return Object.freeze({
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    cancel,
    configure(next) {
      cancel(); context = structuredClone(next);
      const key = presentationRoomContextKey(context), attempt = attempts.get(key);
      const same = key === state.key;
      notify({ key, game: attempt?.payload.game ?? (same ? state.game : 'blackjack'), name: attempt?.payload.name ?? (same ? state.name : ''), preflight: null, receipt: null, status: 'idle',
        message: !context.storeAvailable ? 'Spelrum kräver en ansluten lagring.' : !context.projectSaved ? 'Spara presentationen först.' : !validContext(context) ? 'Välj bolag och presentation.' : null });
      return refresh();
    },
    setName(value) {
      if (locked || attempts.has(state.key)) return;
      const editable = state.preflight?.ready && state.preflight.projectRevision === context.projectRevision && !['conflict', 'unavailable'].includes(state.status);
      notify({ name: value, receipt: null, message: editable ? null : state.message, status: editable ? 'ready' : state.status });
    },
    setGame(value) {
      if (locked || attempts.has(state.key) || !['blackjack','roulette'].includes(value)) return;
      notify({game:value,receipt:null,status:state.preflight?.ready?'ready':state.status});
    },
    refresh,
    async create(expectedKey) {
      const previous = attempts.get(state.key);
      if (locked || !enabled() || expectedKey !== state.key || !previous && (!state.preflight?.ready || state.preflight.projectRevision !== context.projectRevision)
        || !['ready', 'uncertain', 'error'].includes(state.status)) return null;
      const key = state.key, chosen = structuredClone(context), name = state.name.trim();
      let attempt = attempts.get(key);
      if (!attempt && !roomName(name)) { notify({ message: 'Ange ett rumsnamn med högst 100 tecken.' }); return null; }
      locked = true; const token = generation, controller = new AbortController(); active = controller;
      notify({ status: 'busy', message: null, receipt: null });
      try {
        if (!attempt) {
          const prepared = await client.read(chosen, { signal: controller.signal }); if (!current(token)) return null;
          const message = readinessMessage(prepared, chosen);
          if (message) { notify({ preflight: prepared, status: 'unavailable', message }); return null; }
          const payload = Object.freeze({ operatorId: chosen.operator.id, presentationLaneId: chosen.presentation.id, name, idempotencyKey: newKey(), ...(state.game==='roulette'?{game:'roulette'}:{}),
            expectedProjectRevision: prepared.projectRevision, expectedAdministrationRevision: prepared.administrationRevision, expectedPackageRevision: prepared.packageRevision });
          attempt = { payload }; attempts.set(key, attempt); notify({ preflight: prepared });
        }
        const created = await client.create(chosen, attempt.payload, { signal: controller.signal });
        if (!current(token)) return null;
        attempts.delete(key); notify({ status: 'success', receipt: created, message: null });
        return created;
      } catch (error) {
        if (!current(token)) return null;
        if (error.status === 409) {
          attempts.delete(key); notify({ status: 'conflict', preflight: null, message: error.message });
        } else if (attempt && error.uncertain) notify({ status: 'uncertain', message: error.message });
        else { attempts.delete(key); notify({ status: 'error', message: error.message }); }
        return null;
      } finally { if (current(token)) { locked = false; active = null; } }
    },
  });
}
