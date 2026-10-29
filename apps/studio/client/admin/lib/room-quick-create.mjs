// Nytt spelbord på ett steg (plan-enkel-vag §1–2): standardval och kedjan som gör resten med dagens
// åtgärder. Miljö (lås eller kopiera) → mät omätta klipp → skapa spelbordet (publicerar tilldelningen)
// → spelinställningar (spara + publicera). Stannar kedjan blir det en mening och en knapp (stopView).
import {defaultPresentationLane} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {createStudioClient} from './connected-studio.mjs';
import {dealerCoverage} from './dealer-coverage.mjs';
import {measureClipsInOrder,unmeasuredClips} from './media-timing.mjs';
import {materialReasonText} from './room-release.mjs';
import {createPresentationRoomClient} from '../../../lib/presentation-room-client.mjs';
import {createRoomGameConfigClient,ROOM_GAME_DEFAULTS} from '../../../lib/room-game-config-client.mjs';
import {roomLimitProfiles} from '../../../lib/room-limit-profiles.mjs';

export const PAOW_DEALER_ID = 'paow';
export const QUICK_CREATE_STEPS = Object.freeze([['miljo','Miljö'],['matning','Mät klipp'],['spelbord','Spelbord och tilldelning'],['spel','Spelinställningar']]);
const GAMES = {blackjack:'Blackjack',roulette:'Roulette'};
const live = room => room.state !== 'archived';
const companyRooms = (catalog, operatorId) => (catalog?.administration.rooms ?? []).filter(room => room.operatorId === operatorId);
/** Spelbordets dealer: miljöns standarddealer, annars den första tillåtna. */
export function roomDealer(catalog, room) {
  return catalog.administration.compositions.find(row => row.id === room.compositionId)?.defaultDealerId || room.dealerIds?.[0] || '';
}
const complete = (project, inventory, dealerId) => { try { return dealerCoverage(project, inventory, dealerId).complete; } catch { return false; } };
/** Dealers att välja bland, med om klippen räcker för spel. */
export const dealerChoices = (project, inventory) => project.dealers.map(row => ({id:row.id, label:row.label, complete:complete(project, inventory, row.id)}));
/** Miljöer med dealern som standard; den bolaget senast använde först. */
export function laneChoices({catalog, project, operatorId, dealerId}) {
  const lanes = (project.lanes ?? []).filter(lane => lane.layers.dealer.default === dealerId);
  const used = companyRooms(catalog, operatorId).filter(live).map(room => room.compositionId).reverse();
  const rank = lane => { const index = used.indexOf(lane.id); return index < 0 ? used.length : index; };
  return lanes.map((lane, order) => ({lane, order})).sort((a, b) => rank(a.lane) - rank(b.lane) || a.order - b.order).map(row => ({id:row.lane.id, label:row.lane.label}));
}
/** `<Dealer> Blackjack N`: N = bolagets spelbord med samma dealer och spel + 1, och aldrig ett namn som finns. */
export function roomName({catalog, operatorId, dealerId, dealerLabel, game = 'blackjack'}) {
  const own = companyRooms(catalog, operatorId), names = new Set(own.map(room => room.name));
  let n = own.filter(room => live(room) && (room.game ?? 'blackjack') === game && roomDealer(catalog, room) === dealerId).length + 1;
  const name = () => `${dealerLabel} ${GAMES[game] ?? 'Blackjack'} ${n}`.slice(0, 100).trim();
  while (names.has(name())) n++;
  return name();
}
/** Standardvalen (§2). Språket läses separat (defaultLanguage) eftersom det kräver en läsning. */
export function quickCreateDefaults({catalog, project, inventory, operatorId, isComplete = id => complete(project, inventory, id)}) {
  const active = project.dealers.map(row => row.id), ok = id => active.includes(id) && isComplete(id);
  const last = companyRooms(catalog, operatorId).filter(live).map(room => roomDealer(catalog, room)).reverse().find(id => active.includes(id));
  const dealerId = last && ok(last) ? last : active.includes(PAOW_DEALER_ID) ? PAOW_DEALER_ID : active.find(ok) ?? last ?? active[0] ?? '';
  const dealerLabel = project.dealers.find(row => row.id === dealerId)?.label ?? dealerId;
  return {game:'blackjack', dealerId, laneId:laneChoices({catalog, project, operatorId, dealerId})[0]?.id ?? '', ...ROOM_GAME_DEFAULTS,
    name:dealerId ? roomName({catalog, operatorId, dealerId, dealerLabel}) : ''};
}
/** Språket på bolagets senaste blackjackbord (publicerat, annars utkast); annars `en`. */
export async function defaultLanguage({catalog, operatorId}, {fetchImpl = fetch, gameClient = createRoomGameConfigClient({fetchImpl}), signal} = {}) {
  const room = companyRooms(catalog, operatorId).filter(row => live(row) && row.published && (row.game ?? 'blackjack') === 'blackjack').at(-1);
  if (!room) return ROOM_GAME_DEFAULTS.language;
  try { const value = await gameClient.read({operatorId, roomId:room.id}, {signal}); return value.published?.gameConfig.language ?? value.draft?.gameConfig.language ?? ROOM_GAME_DEFAULTS.language; }
  catch { return ROOM_GAME_DEFAULTS.language; }
}

// Samma bedömning som servern (presentation-room-api.mjs roomEnvironment): fast miljö eller inte.
export function laneEnvironmentFixed(project, lane) {
  const background = lane.layers.background, dealers = new Set([...(lane.dealers ?? []), ...lane.layers.dealer.allowed]);
  if (background.mode === 'baked' && !background.allowed.length && background.default === null) return dealers.size === 1;
  const asset = (project.layerAssets ?? []).some(row => row.id === background.default && row.role === 'background');
  return background.enabled && ['image','video'].includes(background.mode) && background.allowed.length === 1 && background.allowed[0] === background.default
    && asset && (lane.backgroundPlayback?.rules ?? []).every(rule => rule.assetId === background.default);
}
/** Låser miljön till en bakgrund (och en dealer i en inbakad miljö); null när ingen standardbakgrund finns. */
function lockLane(project, lane, dealerId) {
  const next = structuredClone(lane), background = next.layers.background;
  if (background.mode === 'baked' && !background.allowed.length && background.default === null) {
    next.dealers = [dealerId]; next.layers.dealer = {...next.layers.dealer, default:dealerId, allowed:[dealerId]};
  } else if (['image','video'].includes(background.mode) && background.enabled && (project.layerAssets ?? []).some(row => row.id === background.default && row.role === 'background')) {
    background.allowed = [background.default];
    if (next.backgroundPlayback) next.backgroundPlayback = {...next.backgroundPlayback, rules:next.backgroundPlayback.rules.filter(rule => rule.assetId === background.default)};
  } else return null;
  return next;
}
const newLaneId = (project, label, newKey) => {
  const normalized = label.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const stem = ((/^[a-z]/.test(normalized) ? normalized : 'miljo-' + normalized).slice(0, 26).replace(/-+$/g, '')) || 'miljo';
  for (let attempt = 0; attempt < 8; attempt++) { const id = stem + '-' + newKey(); if (!project.lanes?.some(lane => lane.id === id)) return id; }
  throw Error('Ett unikt id för miljön kunde inte skapas.');
};
/**
 * Vad miljösteget gör: använder en fast miljö som den är, låser en miljö som inget spelbord använder,
 * kopierar en delad miljö (andra spelbord rörs inte) eller skapar dealerns standardmiljö.
 * @returns {{action:'use'|'lock'|'copy'|'create', laneId:string, project:object|null} | {stop:string, laneId:string}}
 */
export function planEnvironment({catalog, project, dealerId, laneId, dealerLabel = project.dealers.find(row => row.id === dealerId)?.label ?? dealerId, roomLabel = '', forceCopy = false, newKey = () => crypto.randomUUID()}) {
  const lane = (project.lanes ?? []).find(row => row.id === laneId);
  const add = next => ({...structuredClone(project), lanes:[...(project.lanes ?? []), next]});
  if (!lane) {
    const next = defaultPresentationLane(dealerId); next.label = `${dealerLabel} standard`.slice(0, 80); next.id = newLaneId(project, next.label, newKey);
    return {action:'create', laneId:next.id, project:add(next)};
  }
  if (lane.layers.dealer.default !== dealerId) return {stop:'environment_dealer', laneId};
  if (laneEnvironmentFixed(project, lane) && !forceCopy) return {action:'use', laneId, project:null};
  const locked = lockLane(project, lane, dealerId);
  if (!locked) return {stop:'environment_choice', laneId};
  const shared = forceCopy || (catalog?.administration.rooms ?? []).some(room => room.compositionId === laneId);
  if (!shared) return {action:'lock', laneId, project:{...structuredClone(project), lanes:project.lanes.map(row => row.id === laneId ? locked : row)}};
  locked.label = `${lane.label} · ${roomLabel || dealerLabel}`.slice(0, 80); locked.id = newLaneId(project, locked.label, newKey);
  return {action:'copy', laneId:locked.id, project:add(locked)};
}

const companyHref = (operatorId, flik) => `/admin/companies/${encodeURIComponent(operatorId)}?flik=${flik}`;
const dealerHref = (dealerId, flik) => `/admin/dealers/${encodeURIComponent(dealerId)}?flik=${flik}`;
const laneHref = laneId => `/admin/scenes?tab=mallar&composition=${encodeURIComponent(laneId)}`;
const roomHref = (roomId, flik) => `/admin/rooms/${encodeURIComponent(roomId)}?flik=${flik}`;
/**
 * En mening och en knapp per stopp (#642/#655): `href` öppnar platsen där det rättas, `action` gör om
 * kedjan ('retry', samma spelbord) eller läser in allt igen ('reload').
 * @returns {{text:string, href?:string, label?:string, action?:'retry'|'reload'}}
 */
export function stopView(code, {operatorId = '', dealerId = '', laneId = '', roomId = '', detail = ''} = {}) {
  const lane = {href:laneHref(laneId), label:'Öppna miljön'}, assignment = {href:companyHref(operatorId, 'tilldelning'), label:'Öppna tilldelningen'};
  const reload = {action:'reload', label:'Läs in igen'}, retry = {action:'retry', label:'Försök igen'};
  if (/^native_material_/.test(code)) {
    const text = `Spelinställningarna kan inte publiceras: ${materialReasonText(code)}.`;
    if (/measurement/.test(code)) return {text, href:dealerHref(dealerId, 'klipp'), label:'Mät omätta klipp'};
    if (/speech/.test(code)) return {text, href:dealerHref(dealerId, 'tal'), label:'Öppna Röst och tal'};
    if (code === 'native_material_profile_missing') return {text, href:dealerHref(dealerId, 'landningar'), label:'Öppna Landningar'};
    return {text, href:dealerHref(dealerId, 'klipp'), label:'Öppna Klippkartan'};
  }
  switch (code) {
    case 'appearance_draft': return {text:'Bolaget har ett opublicerat utseendeutkast; publicera eller släng det först så att det inte blir inaktuellt.', href:companyHref(operatorId, 'journal'), label:'Öppna bolagets journal'};
    case 'no_dealer': return {text:'Det finns ingen dealer att skapa spelbordet med.', href:'/admin/dealers', label:'Öppna Dealers'};
    case 'environment_dealer': return {text:'Miljön har en annan dealer som standard.', ...lane};
    case 'environment_choice': case 'presentation_room_environment_required': return {text:'Miljön har flera bakgrunder. Välj en som standard.', ...lane};
    case 'presentation_lane_incompatible': return {text:'Miljön saknar en spelbar dealer eller bakgrund.', ...lane};
    case 'presentation_room_environment_conflict': return {text:'Miljön används redan av spelbord med en annan bakgrund.', ...lane};
    case 'presentation_shared_dealer_conflict': case 'presentation_shared_layer_conflict': case 'presentation_legacy_package_conflict': case 'presentation_package_conflict':
      return {text:'Bolagets tilldelning behöver publiceras igen innan ett nytt spelbord kan läggas till.', ...assignment};
    case 'presentation_package_too_large': return {text:'Tilldelningen blir för stor med det här spelbordet.', ...assignment};
    case 'presentation_room_binding_conflict': case 'presentation_game_lane_conflict': return {text:'Spelbordet krockar med ett äldre spelbord. Läs in igen.', ...reload};
    case 'studio_presentation_runtime_update_required': return {text:'Spelservern behöver uppdateras innan spelbordet kan skapas.'};
    case 'measure_failed': return {text:`${detail} kunde inte mätas.`, href:dealerHref(dealerId, 'klipp'), label:'Öppna Klippkartan'};
    case 'conflict': return {text:'Någon annan sparade just. Läs in igen.', ...reload};
    case 'uncertain': return {text:'Svaret kom inte fram; försök igen så används samma spelbord.', ...retry};
    case 'aborted': return {text:'Avbrutet. Det som hann bli klart står kvar.', ...retry};
    case 'game_settings': return {text:'Spelinställningarna kan inte publiceras ännu.', href:roomHref(roomId, 'spel'), label:'Öppna Spelinställningar'};
    default: return {text:detail || 'Åtgärden kunde inte bekräftas.', ...retry};
  }
}

const sameConfig = (a, b) => a?.language === b?.language && a?.limitPreset === b?.limitPreset;
/**
 * Kedjan. `memo` lever mellan försök i samma dialog så att Försök igen återanvänder miljön och
 * spelbordets idempotensnyckel (servern svarar duplicate). `onStep(id, status, text)` ritar raderna.
 * @returns {Promise<{ok:true, room:object, playUrl:string, roomHref:string} | {ok:false, step:string, text:string, href?:string, label?:string, action?:string}>}
 */
export async function runQuickCreate(choice, {operator, memo = {}, onStep = () => {}, signal, fetchImpl = fetch, newKey = () => crypto.randomUUID(),
  studio = createStudioClient({fetchImpl}), rooms = createPresentationRoomClient({fetchImpl}), gameClient = createRoomGameConfigClient({fetchImpl})} = {}) {
  const {dealerId, game = 'blackjack', name} = choice, refs = {operatorId:operator.id, dealerId, laneId:memo.laneId || choice.laneId};
  const stop = (step, code, detail = '') => { const view = stopView(signal?.aborted ? 'aborted' : code, {...refs, detail}); onStep(step, 'stopped', view.text); return {ok:false, step, ...view}; };
  if (operator.appearanceDraft) return stop('miljo', 'appearance_draft');
  if (!dealerId) return stop('miljo', 'no_dealer');
  let workspace, project, forceCopy = false;
  async function environment() {
    onStep('miljo', 'running', 'Kontrollerar miljön…');
    try { workspace = await studio.load(signal); } catch (error) { return stop('miljo', error?.statusCode === 409 ? 'conflict' : 'failed', error?.message); }
    const dealerLabel = workspace.project.dealers.find(row => row.id === dealerId)?.label ?? dealerId;
    const plan = planEnvironment({catalog:workspace.catalog, project:workspace.project, dealerId, laneId:refs.laneId, dealerLabel, roomLabel:name, forceCopy, newKey});
    if (plan.stop) return stop('miljo', plan.stop);
    project = workspace.project;
    if (plan.project) {
      try { project = await studio.save(plan.project, signal); } catch (error) { return stop('miljo', error?.statusCode === 409 ? 'conflict' : 'failed', error?.message); }
    }
    refs.laneId = memo.laneId = plan.laneId;
    const label = project.lanes.find(row => row.id === plan.laneId)?.label ?? plan.laneId;
    onStep('miljo', 'done', {use:`${label} används som den är.`, lock:`${label} låstes till en bakgrund.`, copy:`${label} skapades som kopia, så andra spelbord rörs inte.`, create:`${label} skapades.`}[plan.action]);
    return null;
  }
  const stopped = await environment(); if (stopped) return stopped;
  if (game === 'blackjack') {
    const clips = unmeasuredClips(workspace.inventory, dealerId);
    if (clips.length) {
      onStep('matning', 'running', `0 av ${clips.length} klipp`);
      const result = await measureClipsInOrder(clips, {fetchImpl, signal, onProgress:p => onStep('matning', 'running', `${p.done} av ${p.total} klipp`)});
      if (signal?.aborted) return stop('matning', 'aborted');
      if (result.failed.length) return stop('matning', 'measure_failed', `${result.failed.length} av ${clips.length} klipp (${result.failed[0].label}: ${result.failed[0].message.replace(/\.$/, '')})`);
      onStep('matning', 'done', `${clips.length} klipp mättes.`);
    } else onStep('matning', 'done', 'Alla klipp är redan mätta.');
  } else onStep('matning', 'skipped', 'Behövs inte för roulette.');
  let created;
  for (;;) {
    onStep('spelbord', 'running', 'Skapar spelbordet…');
    const lane = project.lanes.find(row => row.id === refs.laneId);
    const context = {operator:{id:operator.id, slug:operator.slug, name:operator.name}, presentation:{id:refs.laneId, label:lane?.label ?? refs.laneId}, projectRevision:project.revision};
    let prepared;
    try { prepared = await rooms.read(context, {signal, game}); } catch (error) { return stop('spelbord', error?.status === 409 ? 'conflict' : 'failed', error?.message); }
    const same = memo.payload && memo.payload.presentationLaneId === refs.laneId && memo.payload.name === name && (memo.payload.game ?? 'blackjack') === game;
    if (!prepared.ready && !same) {
      // En publicerad miljö som ändrats sedan: kopian får den nya bakgrunden, de gamla spelborden behåller sin (en gång).
      if (prepared.conflictCode === 'presentation_room_environment_conflict' && !forceCopy) { forceCopy = true; const again = await environment(); if (again) return again; continue; }
      return stop('spelbord', prepared.conflictCode ?? prepared.reason ?? 'failed');
    }
    const payload = {operatorId:operator.id, presentationLaneId:refs.laneId, name, idempotencyKey:same ? memo.payload.idempotencyKey : newKey(), ...(game === 'roulette' ? {game} : {}),
      expectedProjectRevision:prepared.projectRevision, expectedAdministrationRevision:prepared.administrationRevision, expectedPackageRevision:prepared.packageRevision};
    memo.payload = payload;
    try { created = await rooms.create(context, payload, {signal}); }
    catch (error) { return stop('spelbord', error?.status === 409 ? 'conflict' : error?.uncertain ? 'uncertain' : 'failed', error?.message); }
    break;
  }
  memo.room = created.room; refs.roomId = created.room.id;
  onStep('spelbord', 'done', `${created.room.name} är öppet och tilldelningen publicerad (version ${created.packageRevision}).`);
  const done = () => ({ok:true, room:created.room, playUrl:created.playUrl, roomHref:roomHref(created.room.id, 'spel')});
  if (game !== 'blackjack') { onStep('spel', 'skipped', 'Roulette har inga spelinställningar.'); return done(); }
  onStep('spel', 'running', 'Sparar och publicerar…');
  const wanted = {language:choice.language, limitPreset:choice.limitPreset}, context = {operatorId:operator.id, roomId:created.room.id};
  try {
    let current = await gameClient.read(context, {signal});
    if (!(sameConfig(current.published?.gameConfig, wanted) && !current.draft)) {
      if (!sameConfig(current.draft?.gameConfig, wanted)) current = await gameClient.save(context, current, wanted, {signal});
      if (!current.publication.ready) return stop('spel', current.publication.materialReason ?? 'game_settings');
      current = await gameClient.publish(context, current, {signal});
    }
    onStep('spel', 'done', `Språk ${wanted.language === 'sv' ? 'svenska' : 'engelska'}, insatsprofil ${roomLimitProfiles().find(row => row.id === wanted.limitPreset)?.label ?? wanted.limitPreset} · version ${current.packageRevision}.`);
  } catch (error) { return stop('spel', error?.status === 409 ? 'conflict' : 'failed', error?.message); }
  return done();
}
