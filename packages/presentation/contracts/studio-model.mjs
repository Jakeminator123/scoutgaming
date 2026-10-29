import { normalizeDealerSpeechProfile } from './dealer-speech-profile.mjs';
import { validateRegisteredIdlePolicies } from '../runtime/registered-idle-policy.mjs';
import { validateLayerAsset } from './layer-asset-contract.mjs';
import { isDealerId, isActiveDealerId, MAX_DEALERS } from './dealer-identity.mjs';
import { validateCompositionSettings } from './composition-settings.mjs';
import { validateBackgroundPlayback, validateLayerPlayback } from './background-playback-policy.mjs';
import seed from './policies/project.seed.json' with { type: 'json' };
import contract from './policies/studio-contract.json' with { type: 'json' };
import { createDefaultIdlePolicy, validateIdlePolicy, MAX_IDLE_VARIANTS } from '../runtime/idle-policy.mjs';
import { validateMediaPolicy } from '../runtime/media-family-policy.mjs';
import { PROBE_MODELS, createDefaultProbePolicy, validateProbePolicy } from './probe-policy.mjs';
import { validateLegacyClipPolicy } from '../runtime/legacy-clip-policy.mjs';
import { dealerSetErrors } from './dealer-sets.mjs';
import { validateRouletteIdleBinding } from './roulette-idle-contract.mjs';
import { validateRouletteStartBinding } from './roulette-start-contract.mjs';
import { OTHER_SPEECH_SLOT_IDS, speechSlotSituation, validateSpeechSlotLine } from './speech-slot-bindings.mjs';


// Pure, browser-safe policy model. This file never reads environment, network,
// player identities, game state or media files. JSON is the editable artefact.
export const DEALER_IDS = Object.freeze(contract.dealers);
export const SOURCE_TYPES = Object.freeze(Object.keys(contract.sourceTypes));
export const TRIGGER_CATEGORIES = Object.freeze(['deterministic', 'social', 'temperament']);
export const MAX_ALTERNATIVES = contract.limits.alternatives;
const filmedDealEvents = new Set(['deal.player.left','deal.player.centre','deal.player.right','deal.dealer']);
export function maxVariantsForEvent(eventId) {
  if (eventId === 'idle.ready') return MAX_IDLE_VARIANTS + 1;
  return filmedDealEvents.has(eventId) ? contract.limits.filmedDealVariants
    : MAX_ALTERNATIVES + 1 + (eventId === 'speak.other' ? OTHER_SPEECH_SLOT_IDS.length : 0);
}
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const VIDEO_GENERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const validVideoGenerationId = value => typeof value === 'string' && VIDEO_GENERATION_ID.test(value)
  && !value.includes('..') && !value.includes('\\') && !value.startsWith('/') && !value.includes('://') && !/^[A-Za-z]:\//.test(value);
const LABEL_MAX = 120;
export const LANE_ID = /^[a-z][a-z0-9-]{0,63}$/;
export const RESERVED_LANE_IDS = new Set(['original', 'constructor', 'prototype']);
export const OPENCLAW_MODES = new Set(['off', 'rules', 'random', 'shadow', 'active']);
export const OPENCLAW_PHASES = ['idle', 'deal', 'reveal', 'speak', 'probe'];
export const BACKGROUND_MODES = new Set(['baked', 'image', 'video']);
export const LANE_PROBE_MODES = Object.freeze(['off', 'shadow', 'active']);
export const OPERATOR_ADJUSTABLE = ['table.color', 'table', 'background', 'dealer', 'branding'];
export const MAX_LANES = 32;
// A lane stores zone identifiers only; zone assets have an independent lifecycle.
const ZONE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const MATERIAL_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const TABLE_COLOR = /^#[0-9a-f]{6}$/;
const PROBE_MODEL_IDS = new Set(PROBE_MODELS.map(model => model.id));
const MAX_CLIP_LABELS = 2048;
const VALUE_OPS = ['eq', 'ne', 'in', 'exists'];
const NUMBER_OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'exists'];
const ARRAY_OPS = ['includes', 'all_eq', 'exists'];
const path = (path, label, category, kind, extra = {}) => Object.freeze({ path, label, category, kind, operators: kind === 'array' ? ARRAY_OPS : kind === 'number' ? NUMBER_OPS : VALUE_OPS, ...extra });
export const allowedPathDescriptors = Object.freeze([
  path('event.type', 'Publicerad eventtyp', 'deterministic', 'enum', { values: SOURCE_TYPES }),
  path('event.line', 'Publicerat replik-ID', 'deterministic', 'string'),
  path('event.blocking', 'Blockerande replik', 'deterministic', 'boolean'),
  path('event.to', 'Kortets publicerade mottagare', 'deterministic', 'enum', { values: ['box', 'dealer'] }),
  path('event.box', 'Publicerad bordsplats', 'deterministic', 'number', { min: 0, max: 6 }),
  path('event.handIndex', 'Publicerat handindex', 'deterministic', 'number', { min: 0, max: 31 }),
  path('event.faceDown', 'Kortet ligger dolt', 'deterministic', 'boolean'),
  path('event.clip.action', 'Publicerad delningsriktning', 'deterministic', 'enum', { values: ['deal-left', 'deal-centre', 'deal-right', 'deal-dealer'] }),
  path('event.card.r', 'Redan synlig kortvalör', 'deterministic', 'enum', { values: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] }),
  path('event.card.s', 'Redan synlig kortfärg', 'deterministic', 'enum', { values: ['♠', '♥', '♦', '♣'] }),
  path('event.dealerTotal', 'Publicerad croupiersumma', 'deterministic', 'number', { min: 0, max: 200 }),
  path('event.dealerBlackjack', 'Publicerad croupier-blackjack', 'deterministic', 'boolean'),
  path('event.hands.outcome', 'Redan avgjorda handresultat', 'deterministic', 'array', { values: ['blackjack', 'win', 'push', 'lose'] }),
  path('event.hands.box', 'Resultatets bordsplats', 'deterministic', 'array', { values: [0, 1, 2, 3, 4, 5, 6] }),
  path('event.legalActions', 'Motorns tillåtna handlingar', 'deterministic', 'array', { values: ['hit', 'stand', 'double', 'split'] }),
  path('context.session.recentWins', 'Redan avgjorda vinster', 'deterministic', 'number', { min: 0, max: 100 }),
  path('context.session.recentLosses', 'Redan avgjorda förluster', 'deterministic', 'number', { min: 0, max: 100 }),
  path('context.chat.signal', 'Simulerad chattsignal', 'social', 'enum', { values: ['none', 'praise', 'inappropriate'] }),
  path('context.playerHistory.returning', 'Simulerad återkomst', 'social', 'boolean'),
  path('context.playerHistory.preferredLanguage', 'Godkänd språkpreferens (simulerad)', 'social', 'enum', { values: [null, 'en', 'sv', 'de', 'fr', 'es'] }),
  path('context.temperament.mood', 'Croupierns simulerade framtoning', 'temperament', 'enum', { values: ['calm', 'warm', 'playful', 'reserved'] })
]);
export const ALLOWED_PATH_DESCRIPTORS = allowedPathDescriptors;
const descriptorByPath = new Map(allowedPathDescriptors.map(item => [item.path, item]));
const animationNames = new Set(contract.animations);
const OPTIONAL_SEED_EVENT_IDS = new Set(['transition.shoe']);
const DIRECTOR_SOURCE_TYPES = new Set(['speak', 'deal', 'reveal', 'settle', 'turn', 'idle']);
export function isDirectorSourceType(sourceType) {
  return DIRECTOR_SOURCE_TYPES.has(sourceType);
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => JSON.stringify(value, function (key, value) {
  return record(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value;
});
const clone = value => structuredClone(value);
const textError = (value, max) => typeof value !== 'string' || !value.trim() || value.length > max ? `ska vara text med 1–${max} tecken` : '';
const exactFields = (value, allowed, at, fail, optional = []) => {
  if (!record(value)) { fail(at, 'ska vara ett objekt'); return false; }
  const known = new Set([...allowed, ...optional]);
  for (const key of Object.keys(value)) if (!known.has(key)) fail(at, `okänt fält ${key}`);
  for (const key of allowed) if (!Object.hasOwn(value, key)) fail(at, `fältet ${key} saknas`);
  return true;
};
const stringList = (value, at, max, fail) => {
  if (!Array.isArray(value) || value.length > 32) { fail(at, 'ska vara en lista med högst 32 texter'); return; }
  const seen = new Set();
  value.forEach((item, index) => {
    const message = textError(item, max);
    if (message) fail(`${at}[${index}]`, message);
    else if (seen.has(item)) fail(`${at}[${index}]`, `dubblerat värde ${item}`);
    else seen.add(item);
  });
};
const zoneIdList = (value, at, fail) => {
  if (!Array.isArray(value) || value.length > 32) { fail(at, 'ska vara en lista med högst 32 zon-id'); return; }
  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !ZONE_ID.test(item)) fail(`${at}[${index}]`, 'ska vara ett zon-id');
    else if (seen.has(item)) fail(`${at}[${index}]`, `dubblerat värde ${item}`);
    else seen.add(item);
  });
};
const colorList = (value, at, fail) => {
  if (!Array.isArray(value) || value.length > 16) { fail(at, 'ska vara en lista med högst 16 färger'); return; }
  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !TABLE_COLOR.test(item)) fail(`${at}[${index}]`, 'ska vara en färg #rrggbb');
    else if (seen.has(item)) fail(`${at}[${index}]`, `dubblerat värde ${item}`);
    else seen.add(item);
  });
};

// Same id rule as packages/presentation/contracts/game-lane-id.mjs. The server catalogue is not imported or changed.
export function defaultPresentationLane(dealerId) {
  if (!isActiveDealerId(dealerId)) throw new StudioValidationError(['miljö: välj en aktiv dealer innan du skapar den']);
  return {
    id: 'mobile-phone',
    label: 'Standardsammansättning',
    renderer: 'layered',
    dealers: [dealerId],
    layers: {
      background: { enabled: true, mode: 'baked', default: null, allowed: [] },
      table: { enabled: true, default: null, allowed: [] },
      dealer: { enabled: true, default: dealerId, allowed: [dealerId] },
    },
    openclaw: { idle: 'active', deal: 'active', reveal: 'active', speak: 'active', probe: 'off' },
    operatorAdjustable: ['table.color', 'branding'],
  };
}

function laneErrors(lanes, projectDealerIds) {
  const errors = [];
  const fail = (at, message) => errors.push(`${at}: ${message}`);
  if (!Array.isArray(lanes) || lanes.length > MAX_LANES) return ['lanes: ska vara en lista med 0–32 lanes'];
  const ids = new Set();
  lanes.forEach((lane, index) => {
    const at = `lanes[${index}]`;
    // probe and idle may be absent. A missing probe leaves openclaw.probe in force; this check does not copy it.
    if (!exactFields(lane, ['id', 'label', 'dealers', 'layers', 'openclaw', 'operatorAdjustable'], at, fail, ['probe', 'idle', 'renderer', 'composition', 'backgroundPlayback', 'tablePlayback', 'illustration'])) return;
    if (Object.hasOwn(lane, 'illustration') && (typeof lane.illustration !== 'string' || !MATERIAL_ID.test(lane.illustration))) fail(`${at}.illustration`, 'ska vara ett material-id');
    if (Object.hasOwn(lane, 'backgroundPlayback')) {
      try { validateBackgroundPlayback(lane.backgroundPlayback); }
      catch { fail(`${at}.backgroundPlayback`, 'ogiltiga uppspelningsregler'); }
    }
    if (Object.hasOwn(lane, 'tablePlayback')) {
      try { validateLayerPlayback(lane.tablePlayback, { role: 'table' }); }
      catch { fail(`${at}.tablePlayback`, 'ogiltiga uppspelningsregler'); }
    }
    if (Object.hasOwn(lane, 'composition')) {
      try { validateCompositionSettings(lane.composition,{tableIds:lane.layers?.table?.allowed}); }
      catch { fail(`${at}.composition`, 'ogiltiga lagerplaceringar'); }
    }
    if (typeof lane.id !== 'string' || !LANE_ID.test(lane.id) || RESERVED_LANE_IDS.has(lane.id)) fail(`${at}.id`, 'ska vara ett lane-id (liten bokstav, siffror, bindestreck; inte original)');
    else if (ids.has(lane.id)) fail(`${at}.id`, `dubblerat ID ${lane.id}`);
    else ids.add(lane.id);
    if (lane.renderer !== undefined && !['layered', 'portrait-video'].includes(lane.renderer)) fail(`${at}.renderer`, 'okänd renderare');
    const labelMessage = textError(lane.label, 80);
    if (labelMessage) fail(`${at}.label`, labelMessage);
    const laneDealers = new Set();
    if (!Array.isArray(lane.dealers) || lane.dealers.length < 1 || lane.dealers.length > MAX_DEALERS) fail(`${at}.dealers`, `ska ha 1–${MAX_DEALERS} dealers`);
    else lane.dealers.forEach((dealerId, dealerIndex) => {
      if (typeof dealerId !== 'string' || !projectDealerIds.has(dealerId)) fail(`${at}.dealers[${dealerIndex}]`, `okänd dealer ${typeof dealerId === 'string' ? dealerId : ''}`);
      else if (laneDealers.has(dealerId)) fail(`${at}.dealers[${dealerIndex}]`, `dubblerat ID ${dealerId}`);
      else laneDealers.add(dealerId);
    });
    if (exactFields(lane.layers, ['background', 'table', 'dealer'], `${at}.layers`, fail)) {
      const background = lane.layers.background;
      if (exactFields(background, ['enabled', 'mode', 'default', 'allowed'], `${at}.layers.background`, fail, ['zones'])) {
        if (typeof background.enabled !== 'boolean') fail(`${at}.layers.background.enabled`, 'ska vara true eller false');
        if (!BACKGROUND_MODES.has(background.mode)) fail(`${at}.layers.background.mode`, 'ska vara baked, image eller video');
        if (background.default !== null) {
          const message = textError(background.default, 200);
          if (message) fail(`${at}.layers.background.default`, message);
        }
        stringList(background.allowed, `${at}.layers.background.allowed`, 200, fail);
        if (Object.hasOwn(background, 'zones')) zoneIdList(background.zones, `${at}.layers.background.zones`, fail);
      }
      const table = lane.layers.table;
      if (exactFields(table, ['enabled', 'default', 'allowed'], `${at}.layers.table`, fail, ['colors'])) {
        if (typeof table.enabled !== 'boolean') fail(`${at}.layers.table.enabled`, 'ska vara true eller false');
        if (table.default !== null) {
          const message = textError(table.default, 40);
          if (message) fail(`${at}.layers.table.default`, message);
        }
        stringList(table.allowed, `${at}.layers.table.allowed`, 40, fail);
        if (Object.hasOwn(table, 'colors')) colorList(table.colors, `${at}.layers.table.colors`, fail);
      }
      const dealer = lane.layers.dealer;
      if (exactFields(dealer, ['enabled', 'default', 'allowed'], `${at}.layers.dealer`, fail)) {
        if (typeof dealer.enabled !== 'boolean') fail(`${at}.layers.dealer.enabled`, 'ska vara true eller false');
        if (typeof dealer.default !== 'string' || !laneDealers.has(dealer.default)) fail(`${at}.layers.dealer.default`, 'ska vara en dealer i lane.dealers');
        if (!Array.isArray(dealer.allowed)) fail(`${at}.layers.dealer.allowed`, 'ska vara en lista');
        else {
          const seen = new Set();
          dealer.allowed.forEach((dealerId, dealerIndex) => {
            if (typeof dealerId !== 'string' || !laneDealers.has(dealerId)) fail(`${at}.layers.dealer.allowed[${dealerIndex}]`, 'ska vara en dealer i lane.dealers');
            else if (seen.has(dealerId)) fail(`${at}.layers.dealer.allowed[${dealerIndex}]`, `dubblerat ID ${dealerId}`);
            else seen.add(dealerId);
          });
        }
      }
    }
    if (exactFields(lane.openclaw, OPENCLAW_PHASES, `${at}.openclaw`, fail)) {
      for (const phase of OPENCLAW_PHASES) if (Object.hasOwn(lane.openclaw, phase) && !OPENCLAW_MODES.has(lane.openclaw[phase])) fail(`${at}.openclaw.${phase}`, 'okänt läge');
    }
    if (!Array.isArray(lane.operatorAdjustable) || lane.operatorAdjustable.length > OPERATOR_ADJUSTABLE.length) fail(`${at}.operatorAdjustable`, 'ska vara en lista av tillåtna justeringar');
    else {
      const seen = new Set();
      lane.operatorAdjustable.forEach((item, itemIndex) => {
        if (!OPERATOR_ADJUSTABLE.includes(item)) fail(`${at}.operatorAdjustable[${itemIndex}]`, 'okänd justering');
        else if (seen.has(item)) fail(`${at}.operatorAdjustable[${itemIndex}]`, `dubblerat ID ${item}`);
        else seen.add(item);
      });
    }
    if (Object.hasOwn(lane, 'probe') && exactFields(lane.probe, ['mode'], `${at}.probe`, fail, ['model'])) {
      if (Object.hasOwn(lane.probe, 'mode') && !LANE_PROBE_MODES.includes(lane.probe.mode)) fail(`${at}.probe.mode`, 'ska vara off, shadow eller active');
      if (Object.hasOwn(lane.probe, 'model') && !PROBE_MODEL_IDS.has(lane.probe.model)) fail(`${at}.probe.model`, 'okänd modell');
    }
    if (Object.hasOwn(lane, 'idle') && exactFields(lane.idle, [], `${at}.idle`, fail, ['frequencyPercent', 'variants'])) {
      if (Object.hasOwn(lane.idle, 'frequencyPercent') && (!Number.isInteger(lane.idle.frequencyPercent) || lane.idle.frequencyPercent < 0 || lane.idle.frequencyPercent > 100)) fail(`${at}.idle.frequencyPercent`, 'ska vara ett heltal 0–100');
      if (Object.hasOwn(lane.idle, 'variants')) stringList(lane.idle.variants, `${at}.idle.variants`, 200, fail);
    }
  });
  return errors;
}

export function validateLanes(lanes, dealerIds) {
  return laneErrors(lanes, dealerIds);
}

function clipLabelErrors(value) {
  if (!record(value)) return ['clipLabels: ska vara ett objekt'];
  const errors = [];
  const keys = Object.keys(value);
  if (keys.length > MAX_CLIP_LABELS) errors.push('clipLabels: ska ha högst 2048 namn');
  for (const key of keys) {
    if (!ID.test(key)) errors.push(`clipLabels: ogiltigt klipp-id ${key}`);
    const message = textError(value[key], 80);
    if (message) errors.push(`clipLabels.${key}: ${message}`);
  }
  return errors;
}

export class StudioValidationError extends Error {
  constructor(errors) {
    super(`Ogiltigt labbprojekt: ${errors.join('; ')}`);
    this.name = 'StudioValidationError'; this.errors = errors; this.statusCode = 400;
  }
}

function contractEventsFor(events) {
  const present = new Set(Array.isArray(events) ? events.map(event => event?.id) : []);
  return seed.events.filter(event => !OPTIONAL_SEED_EVENT_IDS.has(event.id) || present.has(event.id));
}

function seedEventsMissing(project) {
  if (!Array.isArray(project.events) || !Array.isArray(project.lines) || !Array.isArray(project.assets)) return false;
  const present = new Set(project.events.map(event => event?.id));
  if ([...present].some(id => !seed.events.some(event => event.id === id))) return false;
  const ordered = seed.events.map(event => event.id).filter(id => present.has(id));
  if (project.events.map(event => event?.id).join('\0') !== ordered.join('\0')) return false;
  const missing = seed.events.filter(event => !present.has(event.id));
  // Only deployment-optional slots may be appended on read. A document missing a mandatory
  // event (e.g. a speech line) is corrupt and must fail validation, never be silently repaired.
  return missing.length > 0 && missing.every(event => OPTIONAL_SEED_EVENT_IDS.has(event.id));
}

function standardLineFor(dealerId, eventId) {
  const exact = seed.lines.find(line => line.dealerId === dealerId && line.eventId === eventId);
  if (exact) return clone(exact);
  const template = seed.lines.find(line => line.eventId === eventId);
  const baseline = template.variants.find(variant => variant.id === template.baselineVariantId);
  const id = `${dealerId}.${eventId}.standard`;
  return { dealerId, eventId, label: template.label, baselineVariantId: id,
    variants: [{ id, label: baseline.label, priority: baseline.priority, triggerIds: [], assetId: baseline.assetId, videoGenerationId: null }] };
}

function insertSeedLine(lines, line) {
  const eventIndex = seed.events.findIndex(event => event.id === line.eventId);
  let insertAt = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    const row = lines[index];
    if (row?.dealerId !== line.dealerId) continue;
    const rowIndex = seed.events.findIndex(event => event.id === row.eventId);
    if (rowIndex > eventIndex) { insertAt = index; break; }
    insertAt = index + 1;
  }
  lines.splice(insertAt, 0, line);
}

function upgradeSeedEvents(project) {
  const present = new Set(project.events.map(event => event?.id));
  const missing = seed.events.filter(event => !present.has(event.id));
  project.events = seed.events.map(event => present.has(event.id) ? project.events.find(row => row.id === event.id) : clone(event));
  for (const event of missing) {
    const template = seed.lines.find(line => line.eventId === event.id);
    const baseline = template.variants.find(variant => variant.id === template.baselineVariantId);
    const asset = seed.assets.find(item => item.id === baseline.assetId);
    if (asset && !project.assets.some(item => item.id === asset.id)) project.assets.push(clone(asset));
    const dealers = [
      ...(project.dealers ?? []).map(dealer => dealer?.id),
      ...(project.dealerTrash ?? []).map(entry => entry?.dealer?.id),
    ];
    for (const dealerId of dealers) {
      if (typeof dealerId !== 'string') continue;
      const lines = (project.dealers ?? []).some(dealer => dealer?.id === dealerId)
        ? project.lines
        : project.dealerTrash?.find(entry => entry?.dealer?.id === dealerId)?.lines;
      if (!Array.isArray(lines) || lines.some(line => line?.dealerId === dealerId && line?.eventId === event.id)) continue;
      insertSeedLine(lines, standardLineFor(dealerId, event.id));
    }
  }
}

export function normalizeProject(project, options) {
  const preserveMissingLanes = options?.preserveMissingLanes === true;
  const validation = options ? { ...options } : undefined;
  if (validation) delete validation.preserveMissingLanes;
  if (!record(project)) return validateProject(project, validation);

  const addLanes = !preserveMissingLanes && !Object.hasOwn(project, 'lanes');
  const addEvents = seedEventsMissing(project);
  if (!addLanes && !addEvents) return validateProject(project, validation);
  const next = clone(project);
  if (addLanes) next.lanes = [];
  if (addEvents) upgradeSeedEvents(next);
  return validateProject(next, validation);
}

// Fresh installations have no implicit dealer or composition. Event contracts
// and neutral animation primitives remain available for explicit registration.
export function createEmptyProject() {
  return normalizeProject({...clone(seed), dealers:[], lines:[], lanes:[], probePolicy:createDefaultProbePolicy()});
}

// Historical demo/fixture profile. Production empty-state readers use createEmptyProject.
export function createSeedProject() {
  return normalizeProject({ ...clone(seed), idlePolicy: createDefaultIdlePolicy(), probePolicy: createDefaultProbePolicy() });
}

// Registration creates empty bindings for each existing event. Animation-only
// fallbacks are shared; another dealer's recorded film or speech never is.
export function addDealer(project, dealerId, dealerLabel) {
  validateProject(project);
  if (!isActiveDealerId(dealerId) || (project.dealers.some(row => row.id === dealerId) || project.dealerTrash?.some(row => row.dealer.id === dealerId))) throw new StudioValidationError(['dealers: ogiltigt eller upptaget dealer-id']);
  const next = clone(project);
  next.dealers.push({id: dealerId, label: dealerLabel});
  for (const event of next.events) {
    const template = seed.lines.find(line => line.eventId === event.id);
    const baseline = template.variants.find(variant => variant.id === template.baselineVariantId);
    const id = `${dealerId}.${event.id}.standard`;
    next.lines.push({dealerId, eventId:event.id, label:template.label, baselineVariantId:id,
      variants:[{id,label:'Standard',priority:0,triggerIds:[],assetId:baseline.assetId,videoGenerationId:null}]});
  }
  return validateProject(next);
}

// Illustration choices must not reverse a published deal or hide a reveal.
// This is NOT media acceptance: exact dealer/line/take validation belongs to
// a separately reviewed production adapter, not this synthetic motion layer.
export function isAssetCompatible(event, asset) {
  if (!event || !asset || typeof asset.animation !== 'string') return false;
  if (event.sourceType === 'deal') return asset.animation === event.exampleEvent.clip?.action;
  if (event.sourceType === 'reveal') return asset.animation === 'reveal';
  return !asset.animation.startsWith('deal-') && asset.animation !== 'reveal';
}

export function validateProject(project, { allowIncompatibleAnimations = false } = {}) {
  const errors = [];
  const error = (at, message) => errors.push(`${at}: ${message}`);
  const keys = (value, allowed, at, optional = []) => {
    if (!record(value)) { error(at, 'ska vara ett objekt'); return false; }
    for (const key of Object.keys(value)) if (!allowed.includes(key) && !optional.includes(key)) error(at, `okänt fält ${key}`);
    for (const key of allowed) if (!Object.hasOwn(value, key)) error(at, `fältet ${key} saknas`);
    return true;
  };
  const id = (value, at) => { if (typeof value !== 'string' || !ID.test(value)) error(at, 'ska vara ett stabilt ID (1–100 bokstäver, siffror, punkt, kolon, bindestreck eller understreck)'); };
  const label = (value, at, max = LABEL_MAX) => { if (typeof value !== 'string' || !value.trim() || value.length > max) error(at, `ska vara text med 1–${max} tecken`); };
  const array = (value, at, min, max) => { if (!Array.isArray(value) || value.length < min || value.length > max) { error(at, `ska ha ${min}–${max} poster`); return false; } return true; };
  const duplicate = (set, value, at) => { if (set.has(value)) error(at, `dubblerat ID ${value}`); set.add(value); };
  if (!keys(project, ['schemaVersion', 'revision', 'gameId', 'dealers', 'events', 'triggers', 'lines', 'assets'], 'project', ['idlePolicy', 'dealerIdlePolicies', 'mediaPolicy', 'probePolicy', 'legacyClipPolicy', 'lanes', 'clipLabels', 'layerAssets', 'dealerTrash', 'layerAssetTrash', 'dealerSets'])) throw new StudioValidationError(errors);
  if (Object.hasOwn(project, 'legacyClipPolicy')) {
    try { validateLegacyClipPolicy(project.legacyClipPolicy); }
    catch (cause) { error('legacyClipPolicy', cause.message); }
  }
  if (Object.hasOwn(project, 'probePolicy')) {
    try { validateProbePolicy(project.probePolicy); }
    catch (cause) { error('probePolicy', cause.message); }
  }
  if (Object.hasOwn(project, 'mediaPolicy')) {
    try { validateMediaPolicy(project.mediaPolicy, Array.isArray(project.triggers) ? project.triggers.map(trigger => trigger?.id) : []); }
    catch (cause) { error('mediaPolicy', cause.message); }
  }
  if (project.schemaVersion !== 1) error('schemaVersion', 'ska vara 1');
  if (Object.hasOwn(project, 'idlePolicy')) {
    try { validateIdlePolicy(project.idlePolicy); if (project.idlePolicy.familyId !== 'astrid/idle.ready/ready') throw Error('idlePolicy tillhör Astrid; använd dealerIdlePolicies för andra dealers.'); }
    catch (cause) { error('idlePolicy', cause instanceof Error ? cause.message : 'ogiltig policy'); }
  }
  id(project.revision, 'revision');
  if (project.gameId !== 'blackjack') error('gameId', 'endast blackjack är implementerat; roulette är en platshållare');
  const dealerIds = new Set();
  if (array(project.dealers, 'dealers', 0, MAX_DEALERS)) project.dealers.forEach((dealer, i) => {
    const at = `dealers[${i}]`;
    if (!keys(dealer, ['id', 'label'], at, ['speechProfile','rouletteIdle','rouletteStart'])) return;
    if (Object.hasOwn(dealer,'rouletteStart')) {
      try { validateRouletteStartBinding(dealer.rouletteStart); if(!dealer.rouletteIdle)throw Error('kräver roulette-idle för återgång'); }
      catch (cause) { error(at + '.rouletteStart', cause.message); }
    }
    if (Object.hasOwn(dealer,'rouletteIdle')) {
      try { validateRouletteIdleBinding(dealer.rouletteIdle); }
      catch (cause) { error(at + '.rouletteIdle', cause.message); }
    }
    if (Object.hasOwn(dealer, 'speechProfile')) {
      try { normalizeDealerSpeechProfile(dealer.speechProfile); }
      catch (cause) { error(at + '.speechProfile', cause.message); }
    }
    if (!isDealerId(dealer.id)) error(`${at}.id`, 'ogiltigt croupier-id');
    duplicate(dealerIds, dealer.id, `${at}.id`); label(dealer.label, `${at}.label`);
  });
  const eventIds = new Set();
  const contractEvents = contractEventsFor(project.events);
  if (array(project.events, 'events', contractEvents.length, contractEvents.length)) project.events.forEach((event, i) => {
    const at = `events[${i}]`;
    if (!keys(event, ['id', 'label', 'description', 'sourceType', 'sourceRef', 'sourceStatus', 'match', 'exampleEvent'], at)) return;
    duplicate(eventIds, event.id, `${at}.id`); label(event.label, `${at}.label`); label(event.description, `${at}.description`, 600);
    // Ordered matches are an executable contract. Moving a catch-all ahead of
    // specific matches changes meaning even if every source field is intact.
    for (const key of ['id', 'sourceType', 'sourceRef', 'sourceStatus', 'match', 'exampleEvent']) {
      if (canonical(event[key]) !== canonical(contractEvents[i][key])) error(`${at}.${key}`, 'källkontrakt och eventordning är låsta; ändra visningsnamnet i stället');
    }
  });
  const triggerIds = new Set();
  if (array(project.triggers, 'triggers', 0, 128)) project.triggers.forEach((trigger, i) => {
    const at = `triggers[${i}]`;
    if (!keys(trigger, ['id', 'label', 'category', 'path', 'op', 'value'], at)) return;
    id(trigger.id, `${at}.id`); duplicate(triggerIds, trigger.id, `${at}.id`); label(trigger.label, `${at}.label`);
    const descriptor = descriptorByPath.get(trigger.path);
    if (!descriptor) { error(`${at}.path`, 'fältet är inte tillåtet: bara publicerade events, historik, chattsignal och framtoning'); return; }
    if (trigger.category !== descriptor.category) error(`${at}.category`, `fältet tillhör kategorin ${descriptor.category}`);
    if (!descriptor.operators.includes(trigger.op)) { error(`${at}.op`, 'operatorn stöds inte för fältet'); return; }
    const validValue = value => {
      if (descriptor.values) return descriptor.values.includes(value);
      if (descriptor.kind === 'boolean') return typeof value === 'boolean';
      if (descriptor.kind === 'number') return Number.isInteger(value) && value >= descriptor.min && value <= descriptor.max;
      return typeof value === 'string' && value.length > 0 && value.length <= 100 && (descriptor.path !== 'event.line' || /^[a-z][a-z0-9_-]{0,63}$/.test(value));
    };
    if (trigger.op === 'exists') { if (typeof trigger.value !== 'boolean') error(`${at}.value`, 'exists kräver true eller false'); }
    else if (trigger.op === 'in') { if (!Array.isArray(trigger.value) || !trigger.value.length || trigger.value.length > 32 || !trigger.value.every(validValue)) error(`${at}.value`, 'in kräver 1–32 tillåtna värden'); }
    else if (!validValue(trigger.value)) error(`${at}.value`, 'värdet är inte tillåtet för detta fält');
  });
  const assetIds = new Set();
  if (array(project.assets, 'assets', 1, 1024)) project.assets.forEach((asset, i) => {
    const at = `assets[${i}]`;
    if (!keys(asset, ['id', 'label', 'kind', 'animation', 'color', 'durationMs'], at)) return;
    id(asset.id, `${at}.id`); duplicate(assetIds, asset.id, `${at}.id`); label(asset.label, `${at}.label`);
    if (asset.kind !== 'animation') error(`${at}.kind`, 'labbassets är animationer; video binds separat via generationId');
    if (!animationNames.has(asset.animation)) error(`${at}.animation`, 'okänd labbanimation');
    if (typeof asset.color !== 'string' || !/^#[a-f0-9]{6}$/i.test(asset.color)) error(`${at}.color`, 'ska vara en sexsiffrig hex-färg');
    if (!Number.isInteger(asset.durationMs) || asset.durationMs < 200 || asset.durationMs > 10000) error(`${at}.durationMs`, 'ska vara 200–10000 millisekunder');
  });
  const lineIds = new Set(), variantIds = new Set();
  if (array(project.lines, 'lines', dealerIds.size * contractEvents.length, dealerIds.size * contractEvents.length)) project.lines.forEach((line, i) => {
    const at = `lines[${i}]`;
    if (!keys(line, ['dealerId', 'eventId', 'label', 'baselineVariantId', 'variants'], at)) return;
    if (!dealerIds.has(line.dealerId)) error(`${at}.dealerId`, 'okänd croupierreferens');
    if (!eventIds.has(line.eventId)) error(`${at}.eventId`, 'okänd eventreferens');
    duplicate(lineIds, `${line.dealerId}/${line.eventId}`, at); label(line.label, `${at}.label`);
    const expectedBaseline = `${line.dealerId}.${line.eventId}.standard`;
    if (line.baselineVariantId !== expectedBaseline) error(`${at}.baselineVariantId`, 'standardvariantens stabila ID får inte ändras');
    if (!array(line.variants, `${at}.variants`, 1, maxVariantsForEvent(line.eventId))) return;
    try { validateSpeechSlotLine(line); }
    catch { error(`${at}.variants`, 'talfack kräver unika, ovillkorliga standardval för exakt replik och högst fyra vanliga alternativ'); }
    line.variants.forEach((variant, vi) => {
      const vp = `${at}.variants[${vi}]`;
      if (!keys(variant, ['id', 'label', 'priority', 'triggerIds', 'assetId', 'videoGenerationId'], vp, ['selection'])) return;
      if (Object.hasOwn(variant, 'selection')) {
        if (keys(variant.selection, ['rules', 'model', 'random'], `${vp}.selection`)) {
          for (const value of Object.values(variant.selection)) if (typeof value !== 'boolean') error(`${vp}.selection`, 'urvalsval ska vara booleska');
        }
        if (variant.id === expectedBaseline) error(`${vp}.selection`, 'standarden är alltid tillgänglig och ska inte ha urvalsbegränsningar');
      }
      id(variant.id, `${vp}.id`); duplicate(variantIds, variant.id, `${vp}.id`); label(variant.label, `${vp}.label`);
      if (typeof variant.id !== 'string' || !variant.id.startsWith(`${line.dealerId}.${line.eventId}.`)) error(`${vp}.id`, 'variantens ID ska höra till samma croupier/event');
      if (!Number.isInteger(variant.priority) || variant.priority < -100 || variant.priority > 100) error(`${vp}.priority`, 'ska vara ett heltal från -100 till 100');
      if (!assetIds.has(variant.assetId)) error(`${vp}.assetId`, 'okänd animationsreferens');
      else if (!allowIncompatibleAnimations && !isAssetCompatible(project.events.find(event => event.id === line.eventId), project.assets.find(asset => asset.id === variant.assetId))) error(`${vp}.assetId`, 'labbanimationen måste behålla eventets delningsriktning eller kortvändning; repliker/resultat får inte lägga till en kortoperation');
      if (variant.videoGenerationId !== null && !validVideoGenerationId(variant.videoGenerationId)) error(`${vp}.videoGenerationId`, 'ska vara null, ett generationId eller ett legacy-klipp-id, aldrig en sökväg/URL');
      if (array(variant.triggerIds, `${vp}.triggerIds`, 0, 16)) {
        if (new Set(variant.triggerIds).size !== variant.triggerIds.length) error(`${vp}.triggerIds`, 'samma trigger är vald flera gånger');
        variant.triggerIds.forEach(triggerId => { if (!triggerIds.has(triggerId)) error(`${vp}.triggerIds`, `okänd trigger ${triggerId}`); });
      }
    });
    const baseline = line.variants.find(variant => variant?.id === expectedBaseline);
    if (!baseline || !Array.isArray(baseline.triggerIds) || baseline.triggerIds.length) error(`${at}.baselineVariantId`, 'standardvarianten måste finnas och vara ovillkorlig (utan triggers)');
  });
  for (const dealerId of dealerIds) for (const event of contractEvents) if (!lineIds.has(`${dealerId}/${event.id}`)) error('lines', `standardlinje saknas för ${dealerId}/${event.id}`);
  if (Object.hasOwn(project, 'lanes')) errors.push(...laneErrors(project.lanes, dealerIds));
  if (Object.hasOwn(project, 'layerAssets')) {
    if (!Array.isArray(project.layerAssets) || project.layerAssets.length > 128) errors.push('layerAssets: högst 128 lagerfiler');
    else {
      const ids = new Set();
      for (const asset of project.layerAssets) {
        try { validateLayerAsset(asset); if (ids.has(asset.id)) throw new Error(); ids.add(asset.id); }
        catch { errors.push('layerAssets: ogiltig eller dubblerad lagerfil'); }
      }
    }
  }
  // Miljöbild: a lane's illustration is an `illustration` material in the library, and such a material is
  // never a layer. It cannot be allowed, selected or played as a background or a table.
  const libraryRoles = new Map((Array.isArray(project.layerAssets) ? project.layerAssets : []).map(asset => [asset?.id, asset?.role]));
  for (const [index, lane] of (Array.isArray(project.lanes) ? project.lanes : []).entries()) {
    if (Object.hasOwn(lane ?? {}, 'illustration') && libraryRoles.get(lane.illustration) !== 'illustration') error(`lanes[${index}].illustration`, 'ska vara en miljöbild i materialbiblioteket');
    const layerIds = ['background', 'table'].flatMap(role => [lane?.layers?.[role]?.default, ...(Array.isArray(lane?.layers?.[role]?.allowed) ? lane.layers[role].allowed : [])])
      .concat([lane?.backgroundPlayback, lane?.tablePlayback].flatMap(policy => Array.isArray(policy?.rules) ? policy.rules.map(rule => rule?.assetId) : []));
    if (layerIds.some(id => typeof id === 'string' && libraryRoles.get(id) === 'illustration')) error(`lanes[${index}].layers`, 'en miljöbild kan aldrig väljas som bakgrund eller bord');
  }
  for (const [index, lane] of (Array.isArray(project.lanes) ? project.lanes : []).entries()) {
    if(lane?.composition){
      try{validateCompositionSettings(lane.composition,{tableIds:lane.layers?.table?.allowed??[],assets:project.layerAssets??[]});}
      catch{error(`lanes[${index}].composition`,'kortplatser kräver ett tillåtet blackjackbord i biblioteket');}
    }
    if (Object.hasOwn(lane ?? {}, 'tablePlayback')) {
      try {
        const table = lane.layers?.table;
        const policy = validateLayerPlayback(lane.tablePlayback, { role: 'table', assets: project.layerAssets ?? [],
          allowed: table?.allowed, defaultAssetId: table?.default });
        if (policy.rules.length && table?.enabled !== true) throw Error();
      } catch { error(`lanes[${index}].tablePlayback`, 'kräver aktiverat bord med tillåten basbild eller basvideo och regelvideor'); }
    }
    if (!Object.hasOwn(lane ?? {}, 'backgroundPlayback')) continue;
    try {
      const background = lane.layers?.background;
      const policy = validateBackgroundPlayback(lane.backgroundPlayback, { assets: project.layerAssets ?? [],
        allowed: background?.allowed, defaultAssetId: background?.default });
      if (policy.rules.length && background?.enabled !== true) throw Error();
    } catch { error(`lanes[${index}].backgroundPlayback`, 'kräver aktiverad bakgrund med tillåten basbild eller basvideo och regelvideor'); }
  }
  if (Object.hasOwn(project, 'clipLabels')) errors.push(...clipLabelErrors(project.clipLabels));
  if (Object.hasOwn(project, 'dealerSets')) errors.push(...dealerSetErrors(project.dealerSets, dealerIds));
  if (Object.hasOwn(project, 'dealerIdlePolicies')) {
    try { validateRegisteredIdlePolicies(project.dealerIdlePolicies,project); }
    catch (cause) { error('dealerIdlePolicies', cause.message); }
  }
  if (Object.hasOwn(project, 'layerAssetTrash')) {
    const seen=new Set((project.layerAssets??[]).map(asset=>asset.id));
    if(array(project.layerAssetTrash,'layerAssetTrash',0,128))for(const entry of project.layerAssetTrash){
      try{
        if(!keys(entry,['asset','archivedAt'],'layerAssetTrash'))continue;
        validateLayerAsset(entry.asset);
        if(seen.has(entry.asset.id)||typeof entry.archivedAt!=='string'||!Number.isFinite(Date.parse(entry.archivedAt))||new Date(entry.archivedAt).toISOString()!==entry.archivedAt)throw Error();
        seen.add(entry.asset.id);
        for(const lane of [...(project.lanes??[]),...(project.dealerTrash??[]).flatMap(row=>row.compositions??[])]){
          if(['table','background'].some(role=>lane.layers[role].default===entry.asset.id||lane.layers[role].allowed.includes(entry.asset.id))||lane.illustration===entry.asset.id)throw Error();
        }
      }catch{error('layerAssetTrash','ogiltig, dubblerad eller fortfarande ansluten lagerfil');}
    }
  }
  if (Object.hasOwn(project, 'dealerTrash')) {
    const trash = project.dealerTrash, seen = new Set(dealerIds);
    if (array(trash, 'dealerTrash', 0, MAX_DEALERS)) {
      if (dealerIds.size + trash.length > MAX_DEALERS) error('dealerTrash', 'för många registrerade och arkiverade dealers');
      for (const [i, entry] of trash.entries()) {
        const at = `dealerTrash[${i}]`;
        const cascade=entry?.schemaVersion===2;
        if (!keys(entry, ['schemaVersion','dealer','lines','idlePolicy','activeMediaIds','archivedAt',...(cascade?['compositions']:[])], at, ['deletion',...(cascade?['legacyClipPolicy','mediaPolicy','globalIdlePolicy','dealerSets']:[])])) continue;
        if(entry.deletion!==undefined){
          const deletion=entry.deletion;
          if(!keys(deletion,['state','requestedAt','mediaIds'],at+'.deletion') || deletion.state!=='pending'
            || typeof deletion.requestedAt!=='string' || !Number.isFinite(Date.parse(deletion.requestedAt)) || new Date(deletion.requestedAt).toISOString()!==deletion.requestedAt
            || !Array.isArray(deletion.mediaIds) || deletion.mediaIds.length>5000 || new Set(deletion.mediaIds).size!==deletion.mediaIds.length
            || deletion.mediaIds.some(id=>typeof id!=='string'||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/).test(id)))error(at,'ogiltig pågående dealerradering');
        }
        const dealerId = entry.dealer?.id;
        if (![1,2].includes(entry.schemaVersion) || !isDealerId(dealerId) || seen.has(dealerId)) error(at, 'ogiltig eller upptagen arkiverad dealer');
        seen.add(dealerId);
        if (entry.dealer?.speechProfile?.state === 'enabled') error(at, 'arkiverat tal ska vara avstängt');
        if (typeof entry.archivedAt !== 'string' || !Number.isFinite(Date.parse(entry.archivedAt)) || new Date(entry.archivedAt).toISOString() !== entry.archivedAt) error(at, 'ogiltig arkiveringstid');
        if (!Array.isArray(entry.activeMediaIds) || entry.activeMediaIds.length > 5000 || new Set(entry.activeMediaIds).size !== entry.activeMediaIds.length
          || entry.activeMediaIds.some(value => typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value))) error(at, 'ogiltig lista med arkiverade klipp');
        // Validate the saved snapshot against the same semantics as an active dealer.
        // Shared triggers/assets cannot disappear while an archived snapshot needs them.
        try {
          if (!Array.isArray(entry.lines) || entry.lines.some(line => line.dealerId !== dealerId)) throw Error();
          if(entry.dealerSets!==undefined && (dealerSetErrors(entry.dealerSets,new Set([dealerId])).length || entry.dealerSets.some(row=>row.dealerId!==dealerId)))throw Error();
          const restored = {...project,
            dealers:[...project.dealers,...trash.map(row=>row.dealer)],
            lines:[...project.lines,...trash.flatMap(row=>Array.isArray(row.lines)?row.lines:[])],
            lanes:entry.compositions??[]};
          if(entry.legacyClipPolicy!==undefined)validateLegacyClipPolicy(entry.legacyClipPolicy);
          if(entry.mediaPolicy!==undefined)validateMediaPolicy(entry.mediaPolicy,project.triggers.map(row=>row.id));
          if(entry.globalIdlePolicy!==undefined){validateIdlePolicy(entry.globalIdlePolicy);if(entry.globalIdlePolicy.familyId!=='astrid/idle.ready/ready')throw Error();}
          delete restored.dealerTrash;
          restored.dealerIdlePolicies = [...(project.dealerIdlePolicies ?? []),...trash.filter(row=>row.idlePolicy!==null).map(row=>({dealerId:row.dealer.id,policy:row.idlePolicy}))];
          validateProject(restored, {allowIncompatibleAnimations});
        } catch { error(at, 'ogiltigt dealersnapshot eller saknade gemensamma inställningar'); }
      }
    }
  }
  if (errors.length) throw new StudioValidationError(errors);
  return project;
}

export function buildRuntimeCatalog(project, dealerId) {
  validateProject(project);
  if (!project.dealers.some(row => row.id === dealerId)) throw new StudioValidationError(['dealerId: okänd croupier']);
  const triggers = new Map(project.triggers.map(trigger => [trigger.id, trigger]));
  const lines = new Map(project.lines.filter(line => line.dealerId === dealerId).map(line => [line.eventId, line]));
  return clone({
    schemaVersion: 1, revision: project.revision,
    sourceNote: `Studio: ${project.events.length} låsta semantiska mappningar. Sex riktiga presentationstyper går till presentationsregissören. Övergångar mellan vilopositioner är klippfack och är inte spelmotorevent.`,
    triggerSources: [
      { id: 'deterministic', label: 'Deterministiskt', description: 'Publicerade events och simulerad historik över redan avgjorda händer.', status: 'lab' },
      { id: 'social', label: 'Socialt', description: 'Simulerad chattklassificering och godkända spelarpreferenser; ingen produktionskoppling.', status: 'lab' },
      { id: 'temperament', label: 'Framtoning', description: 'Simulerad croupierframtoning, aldrig en diagnos av spelaren.', status: 'lab' }
    ],
    events: project.events.filter(event => isDirectorSourceType(event.sourceType)).map(event => {
      const line = lines.get(event.id);
      return { ...event, baselineVariantId: line.baselineVariantId, variants: line.variants.map(variant => ({
        id: variant.id, label: variant.label, priority: variant.priority, assetId: variant.assetId,
        when: { all: variant.triggerIds.map(id => { const { path, op, value } = triggers.get(id); return { path, op, value }; }) }
      })) };
    }), assets: project.assets
  });
}

function editProject(project, edit) { validateProject(project); const next = clone(project); edit(next); return validateProject(next); }
function findLine(project, dealerId, eventId) {
  const line = project.lines.find(item => item.dealerId === dealerId && item.eventId === eventId);
  if (!line) throw new StudioValidationError(['lines: standardlinjen finns inte']);
  return line;
}
export function addVariant(project, dealerId, eventId, label = 'Ny variant') {
  return editProject(project, next => {
    const line = findLine(next, dealerId, eventId);
    const limit = maxVariantsForEvent(eventId);
    const ordinaryLimit = eventId === 'speak.other' ? MAX_ALTERNATIVES + 1 : limit;
    if (line.variants.filter(variant => !speechSlotSituation(line, variant)).length >= ordinaryLimit) throw new StudioValidationError([`variants: högst ${ordinaryLimit === 5 ? 'fyra' : ordinaryLimit - 1} alternativ utöver standardvarianten`]);
    let serial = 1;
    while (line.variants.some(variant => variant.id === `${dealerId}.${eventId}.variant${serial}`)) serial++;
    line.variants.push({ id: `${dealerId}.${eventId}.variant${serial}`, label, priority: 10, triggerIds: [], assetId: line.variants.find(variant => variant.id === line.baselineVariantId).assetId, videoGenerationId: null, selection: { rules: false, model: false, random: false } });
  });
}
export function removeVariant(project, dealerId, eventId, variantId) {
  return editProject(project, next => {
    const line = findLine(next, dealerId, eventId);
    if (variantId === line.baselineVariantId) throw new StudioValidationError(['variants: standardvarianten får inte tas bort']);
    if (!line.variants.some(variant => variant.id === variantId)) throw new StudioValidationError(['variants: varianten finns inte']);
    line.variants = line.variants.filter(variant => variant.id !== variantId);
  });
}
export function removeTrigger(project, triggerId) {
  return editProject(project, next => {
    if (!next.triggers.some(trigger => trigger.id === triggerId)) throw new StudioValidationError(['triggers: triggern finns inte']);
    const references = next.lines.flatMap(line => line.variants.filter(variant => variant.triggerIds.includes(triggerId)).map(variant => `${line.dealerId}/${line.eventId}/${variant.label}`));
    references.push(...(next.mediaPolicy ?? []).flatMap(family => family.variants.filter(variant => variant.triggerIds.includes(triggerId)).map(variant => `${family.familyId}/${variant.videoId}`)));
    if (references.length) throw new StudioValidationError([`triggers: triggern används av ${references.length} variant(er). Koppla först bort den uttryckligen från berörda varianter: ${references.slice(0, 4).join(', ')}${references.length > 4 ? ', …' : ''}`]);
    next.triggers = next.triggers.filter(trigger => trigger.id !== triggerId);
  });
}
export function renameEvent(project, eventId, label) {
  return editProject(project, next => {
    const event = next.events.find(event => event.id === eventId);
    if (!event) throw new StudioValidationError(['events: eventet finns inte']);
    event.label = label;
  });
}
export function renameLine(project, dealerId, eventId, label) {
  return editProject(project, next => { findLine(next, dealerId, eventId).label = label; });
}
