import { randomUUID } from 'node:crypto';

// The only runtime event types verified in web/partner-presentation.mjs.
export const SOURCE_TYPES = Object.freeze(['speak', 'deal', 'reveal', 'settle', 'turn', 'idle']);
export const MODES = Object.freeze(['off', 'shadow', 'active']);
export const ANIMATIONS = Object.freeze(['wave', 'nod', 'deal-left', 'deal-centre', 'deal-right', 'deal-dealer', 'reveal', 'point', 'celebrate', 'reassure', 'neutral', 'idle']);
export const CONDITION_OPERATORS = Object.freeze(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'includes', 'all_eq', 'in', 'exists']);
const EVENT_PATHS = Object.freeze(['type', 'line', 'blocking', 'to', 'box', 'handIndex', 'faceDown', 'shoeDraw', 'clip.action', 'card.r', 'card.s', 'dealerTotal', 'dealerBlackjack', 'hands.outcome', 'hands.box', 'legalActions']);
export const CONDITION_PATHS = Object.freeze([...EVENT_PATHS.map(p => `event.${p}`), 'context.chat.signal', 'context.playerHistory.returning', 'context.playerHistory.preferredLanguage', 'context.session.recentWins', 'context.session.recentLosses']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const ACTIONS = ['hit', 'stand', 'double', 'split'];
const OUTCOMES = ['blackjack', 'win', 'push', 'lose'];
const SIGNALS = ['none', 'praise', 'inappropriate'];
const LANGUAGES = ['en', 'sv', 'de', 'fr', 'es'];
const own = (value, key) => Object.hasOwn(value, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const scalar = value => value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value));
const boundedScalar = value => scalar(value) && (typeof value !== 'string' || value.length <= 100);
const clone = value => structuredClone(value);

export class LabInputError extends Error {
  constructor(code, message) { super(message); this.name = 'LabInputError'; this.code = code; this.statusCode = 400; }
}
function requireInput(ok, message, code = 'invalid_input') { if (!ok) throw new LabInputError(code, message); }
function optionalInteger(source, target, key, min, max, nullable = false) {
  if (!own(source, key)) return;
  const value = source[key];
  requireInput((nullable && value === null) || (Number.isInteger(value) && value >= min && value <= max), `${key} must be ${nullable ? 'null or ' : ''}an integer between ${min} and ${max}.`);
  target[key] = value;
}
function visibleCard(card) {
  requireInput(record(card) && RANKS.includes(card.r) && SUITS.includes(card.s), 'A visible card needs a valid r and s.');
  return { r: card.r, s: card.s };
}

// Projection, not spreading: private state, money, free-form chat and user IDs
// never enter the director request, even when accidentally supplied by a caller.
function projectEvent(source) {
  requireInput(record(source), 'event must be an object.');
  requireInput(SOURCE_TYPES.includes(source.type), 'Unknown runtime event type. Expected speak, deal, reveal, settle, turn or idle.', 'invalid_event_type');
  const event = { type: source.type };
  if (source.type === 'speak') {
    requireInput(typeof source.line === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(source.line), 'speak.line must be a source line key.');
    event.line = source.line;
    if (own(source, 'blocking')) { requireInput(typeof source.blocking === 'boolean', 'blocking must be boolean.'); event.blocking = source.blocking; }
  }
  if (source.type === 'deal') {
    requireInput(['box', 'dealer'].includes(source.to), 'deal.to must be box or dealer.');
    requireInput(typeof source.faceDown === 'boolean', 'deal.faceDown must be boolean.');
    event.to = source.to; event.faceDown = source.faceDown;
    optionalInteger(source, event, 'box', 0, 6, true);
    optionalInteger(source, event, 'handIndex', 0, 31, true);
    requireInput(source.to === 'dealer' ? source.box === null : Number.isInteger(source.box) && source.box >= 0 && source.box <= 6, 'deal.box must agree with its destination.');
    const action = source.to === 'dealer' ? 'deal-dealer' : source.box <= 1 ? 'deal-left' : source.box >= 5 ? 'deal-right' : 'deal-centre';
    requireInput(record(source.clip) && source.clip.action === action, 'deal.clip.action must agree with the published box/destination.');
    event.clip = { action };
    // Never pass a supplied face-down rank/suit on to the model or renderer.
    event.card = source.faceDown ? null : visibleCard(source.card);
    optionalInteger(source, event, 'shoeDraw', 0, 100000);
  }
  if (source.type === 'reveal') {
    requireInput(source.to === 'dealer', 'reveal.to must be dealer.');
    event.to = 'dealer'; event.card = visibleCard(source.card);
    optionalInteger(source, event, 'shoeDraw', 0, 100000);
  }
  if (source.type === 'settle') {
    requireInput(Number.isInteger(source.dealerTotal) && source.dealerTotal >= 0 && source.dealerTotal <= 200, 'settle.dealerTotal must be a published integer total.');
    requireInput(typeof source.dealerBlackjack === 'boolean', 'settle.dealerBlackjack must be boolean.');
    requireInput(Array.isArray(source.hands) && source.hands.length <= 32, 'settle.hands must contain at most 32 public hand results.');
    event.dealerTotal = source.dealerTotal; event.dealerBlackjack = source.dealerBlackjack;
    event.hands = source.hands.map(hand => {
      requireInput(record(hand) && Number.isInteger(hand.box) && hand.box >= 0 && hand.box <= 6 && OUTCOMES.includes(hand.outcome), 'Each settlement hand needs a box and public outcome.');
      return { box: hand.box, outcome: hand.outcome };
    });
  }
  if (source.type === 'turn') {
    optionalInteger(source, event, 'box', 0, 6, true);
    optionalInteger(source, event, 'handIndex', 0, 31, true);
    requireInput(own(event, 'box') && own(event, 'handIndex'), 'turn needs box and handIndex.');
    requireInput(Array.isArray(source.legalActions) && source.legalActions.length <= ACTIONS.length && source.legalActions.every(a => ACTIONS.includes(a)), 'turn.legalActions contains an unknown action.');
    event.legalActions = [...new Set(source.legalActions)];
  }
  return event;
}

function projectContext(value) {
  requireInput(value === undefined || record(value), 'context must be an object.');
  const source = value ?? {};
  const context = { chat: { signal: 'none' }, playerHistory: { returning: false, preferredLanguage: null }, session: { recentWins: 0, recentLosses: 0 } };
  for (const key of ['chat', 'playerHistory', 'session']) requireInput(!own(source, key) || record(source[key]), `context.${key} must be an object.`);
  if (own(source.chat ?? {}, 'signal')) {
    requireInput(SIGNALS.includes(source.chat.signal), 'context.chat.signal must be none, praise or inappropriate.');
    context.chat.signal = source.chat.signal;
  }
  if (own(source.playerHistory ?? {}, 'returning')) {
    requireInput(typeof source.playerHistory.returning === 'boolean', 'context.playerHistory.returning must be boolean.');
    context.playerHistory.returning = source.playerHistory.returning;
  }
  if (own(source.playerHistory ?? {}, 'preferredLanguage')) {
    const language = source.playerHistory.preferredLanguage;
    requireInput(language === null || LANGUAGES.includes(language), 'preferredLanguage must be null, en, sv, de, fr or es.');
    context.playerHistory.preferredLanguage = language;
  }
  for (const key of ['recentWins', 'recentLosses']) optionalInteger(source.session ?? {}, context.session, key, 0, 100);
  return context;
}

export function normalizeInput(body) {
  requireInput(record(body), 'Request body must be an object.');
  const requestId = body.requestId ?? randomUUID();
  requireInput(typeof requestId === 'string' && ID.test(requestId), 'requestId must be a bounded identifier.');
  const mode = body.mode ?? 'off';
  requireInput(MODES.includes(mode), 'mode must be off, shadow or active.');
  return { requestId, event: projectEvent(body.event), context: projectContext(body.context), mode };
}

function valueAt(value, path) {
  const parts = path.split('.');
  function walk(current, remaining) {
    if (!remaining.length) return current;
    if (Array.isArray(current)) return current.flatMap(item => walk(item, remaining));
    if (!record(current) || !own(current, remaining[0])) return undefined;
    return walk(current[remaining[0]], remaining.slice(1));
  }
  return walk(value, parts);
}
function compare(actual, op, expected) {
  switch (op) {
    case 'eq': return actual === expected;
    case 'ne': return actual !== undefined && actual !== expected;
    case 'gt': return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt': return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'includes': return Array.isArray(actual) && actual.includes(expected);
    case 'all_eq': return Array.isArray(actual) && actual.length > 0 && actual.every(item => item === expected);
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'exists': return (actual !== undefined && actual !== null) === expected;
    default: return false;
  }
}
function matchEvent(event, match) {
  return Object.entries(match).every(([path, rule]) => {
    const actual = valueAt(event, path);
    if (!record(rule)) return compare(actual, 'eq', rule);
    return Object.entries(rule).every(([op, value]) => compare(actual, op, value));
  });
}

export function validateCatalog(catalog) {
  const errors = [];
  const error = (path, detail) => errors.push(`${path}: ${detail}`);
  const keys = (value, allowed, path) => {
    if (!record(value)) { error(path, 'must be an object'); return false; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) error(path, `unknown field ${key}`);
    return true;
  };
  const text = (value, path, max = 600) => { if (typeof value !== 'string' || !value.trim() || value.length > max) error(path, `must be a nonempty string, max ${max}`); };
  const id = (value, path) => { if (typeof value !== 'string' || !ID.test(value)) error(path, 'must be a bounded identifier'); };
  const rule = (op, value, path) => {
    if (!CONDITION_OPERATORS.includes(op)) { error(path, 'unknown operator'); return; }
    if (op === 'in') { if (!Array.isArray(value) || !value.length || value.length > 32 || !value.every(boundedScalar)) error(path, 'in expects 1–32 bounded scalar values'); }
    else if (op === 'exists') { if (typeof value !== 'boolean') error(path, 'exists expects boolean'); }
    else if (['gt', 'gte', 'lt', 'lte'].includes(op)) { if (typeof value !== 'number' || !Number.isFinite(value)) error(path, 'numeric comparison expects a number'); }
    else if (!boundedScalar(value)) error(path, 'expects a bounded scalar value');
  };
  if (!keys(catalog, ['schemaVersion', 'revision', 'sourceNote', 'triggerSources', 'events', 'assets'], 'catalog')) return { valid: false, errors };
  if (catalog.schemaVersion !== 1) error('schemaVersion', 'must be 1');
  id(catalog.revision, 'revision');
  if (own(catalog, 'sourceNote')) text(catalog.sourceNote, 'sourceNote', 1000);
  if (own(catalog, 'triggerSources')) {
    if (!Array.isArray(catalog.triggerSources) || catalog.triggerSources.length > 16) error('triggerSources', 'must be an array with at most 16 entries');
    else catalog.triggerSources.forEach((source, index) => {
      const p = `triggerSources[${index}]`;
      if (!keys(source, ['id', 'label', 'description', 'status'], p)) return;
      id(source.id, `${p}.id`); text(source.label, `${p}.label`, 100); text(source.description, `${p}.description`);
      if (!['verified', 'lab', 'proposed'].includes(source.status)) error(`${p}.status`, 'unknown status');
    });
  }
  const assetIds = new Set();
  if (!Array.isArray(catalog.assets) || !catalog.assets.length || catalog.assets.length > 1024) error('assets', 'must contain 1–1024 assets');
  else catalog.assets.forEach((asset, index) => {
    const p = `assets[${index}]`;
    if (!keys(asset, ['id', 'label', 'kind', 'animation', 'color', 'durationMs'], p)) return;
    id(asset.id, `${p}.id`); text(asset.label, `${p}.label`, 120);
    if (assetIds.has(asset.id)) error(`${p}.id`, 'duplicate asset id'); assetIds.add(asset.id);
    if (asset.kind !== 'animation') error(`${p}.kind`, 'this lab version accepts animation assets only');
    if (!ANIMATIONS.includes(asset.animation)) error(`${p}.animation`, 'unknown lab animation');
    if (typeof asset.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(asset.color)) error(`${p}.color`, 'must be a six-digit hex color');
    if (own(asset, 'durationMs') && (!Number.isInteger(asset.durationMs) || asset.durationMs < 200 || asset.durationMs > 10000)) error(`${p}.durationMs`, 'must be an integer from 200 to 10000');
  });
  const eventIds = new Set(), variantIds = new Set(), coveredTypes = new Set();
  if (!Array.isArray(catalog.events) || !catalog.events.length || catalog.events.length > 128) error('events', 'must contain 1–128 semantic nodes');
  else catalog.events.forEach((node, index) => {
    const p = `events[${index}]`;
    if (!keys(node, ['id', 'label', 'description', 'sourceType', 'sourceRef', 'sourceStatus', 'match', 'exampleEvent', 'baselineVariantId', 'variants'], p)) return;
    id(node.id, `${p}.id`); text(node.label, `${p}.label`, 120); text(node.description, `${p}.description`); text(node.sourceRef, `${p}.sourceRef`, 300);
    if (eventIds.has(node.id)) error(`${p}.id`, 'duplicate semantic node id'); eventIds.add(node.id);
    if (!SOURCE_TYPES.includes(node.sourceType)) error(`${p}.sourceType`, 'unknown runtime type'); else coveredTypes.add(node.sourceType);
    if (own(node, 'sourceStatus') && !['verified', 'proposed'].includes(node.sourceStatus)) error(`${p}.sourceStatus`, 'unknown source status');
    if (!record(node.match)) error(`${p}.match`, 'must be an object');
    else for (const [path, value] of Object.entries(node.match)) {
      if (!EVENT_PATHS.includes(path)) error(`${p}.match`, `field is not public/allowlisted: ${path}`);
      if (record(value)) {
        if (!Object.keys(value).length) error(`${p}.match.${path}`, 'empty comparison');
        for (const [op, expected] of Object.entries(value)) rule(op, expected, `${p}.match.${path}`);
      } else rule('eq', value, `${p}.match.${path}`);
    }
    if (own(node, 'exampleEvent')) {
      try {
        const projected = projectEvent(node.exampleEvent);
        if (projected.type !== node.sourceType || (record(node.match) && !matchEvent(projected, node.match))) error(`${p}.exampleEvent`, 'must match this node');
        if (JSON.stringify(projected) !== JSON.stringify(node.exampleEvent)) {
          // Key order is immaterial, but examples may contain only projected data.
          const canonical = v => Array.isArray(v) ? v.map(canonical) : record(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
          if (JSON.stringify(canonical(projected)) !== JSON.stringify(canonical(node.exampleEvent))) error(`${p}.exampleEvent`, 'contains fields outside the public projection');
        }
      } catch (e) { error(`${p}.exampleEvent`, e.message); }
    }
    id(node.baselineVariantId, `${p}.baselineVariantId`);
    if (!Array.isArray(node.variants) || !node.variants.length || node.variants.length > 32) { error(`${p}.variants`, 'must contain 1–32 variants'); return; }
    node.variants.forEach((variant, vi) => {
      const vp = `${p}.variants[${vi}]`;
      if (!keys(variant, ['id', 'label', 'priority', 'when', 'assetId'], vp)) return;
      id(variant.id, `${vp}.id`); text(variant.label, `${vp}.label`, 120);
      if (variantIds.has(variant.id)) error(`${vp}.id`, 'duplicate variant id'); variantIds.add(variant.id);
      if (!Number.isInteger(variant.priority) || variant.priority < -100 || variant.priority > 100) error(`${vp}.priority`, 'must be an integer from -100 to 100');
      if (!assetIds.has(variant.assetId)) error(`${vp}.assetId`, 'unknown asset');
      if (!keys(variant.when, ['all'], `${vp}.when`)) return;
      if (!Array.isArray(variant.when.all) || variant.when.all.length > 16) { error(`${vp}.when.all`, 'must contain at most 16 predicates'); return; }
      variant.when.all.forEach((predicate, pi) => {
        const pp = `${vp}.when.all[${pi}]`;
        if (!keys(predicate, ['path', 'op', 'value'], pp)) return;
        if (!CONDITION_PATHS.includes(predicate.path)) error(`${pp}.path`, 'not an allowlisted public/context path');
        if (!own(predicate, 'value')) error(`${pp}.value`, 'required');
        rule(predicate.op, predicate.value, pp);
      });
    });
    const baseline = node.variants.find(v => v?.id === node.baselineVariantId);
    if (!baseline || !Array.isArray(baseline.when?.all) || baseline.when.all.length !== 0) error(`${p}.baselineVariantId`, 'must reference an unconditional baseline variant');
  });
  for (const type of SOURCE_TYPES) if (!coveredTypes.has(type)) error('events', `missing runtime type ${type}`);
  return { valid: errors.length === 0, errors };
}

function fallbackNode(type) {
  const id = 'unmapped.standard';
  return { id: `unmapped.${type}`, label: 'Saknar mappning', description: 'Känd källtyp utan matchande redigerad nod. Visar neutral labbmarkering.', sourceType: type, sourceRef: 'built-in-safe-fallback', match: {}, baselineVariantId: id, variants: [{ id, label: 'Neutral standard', priority: 0, when: { all: [] }, assetId: id }] };
}

export function prepareDecision(catalog, input) {
  const validation = validateCatalog(catalog);
  requireInput(validation.valid, `Invalid catalog: ${validation.errors.join('; ')}`, 'invalid_catalog');
  const normalized = normalizeInput(input);
  const found = catalog.events.find(node => node.sourceType === normalized.event.type && matchEvent(normalized.event, node.match));
  const node = clone(found ?? fallbackNode(normalized.event.type));
  const eligible = node.variants.filter(variant => variant.when.all.every(p => compare(valueAt(normalized, p.path), p.op, p.value))).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const baseline = node.variants.find(v => v.id === node.baselineVariantId);
  const assets = found ? catalog.assets.filter(a => node.variants.some(v => v.assetId === a.id)) : [{ id: 'unmapped.standard', label: 'Neutral standard', kind: 'animation', animation: 'neutral', color: '#9eb2c7', durationMs: 1000 }];
  return {
    ...normalized, catalogRevision: catalog.revision, node, eligible, baseline, assets: clone(assets),
    trace: [
      { stage: 'event', status: 'accepted', detail: `Publicerad källtyp: ${normalized.event.type}. Övriga fält är borttagna.` },
      { stage: 'mapping', status: found ? 'matched' : 'fallback', detail: `${node.id} · ${node.label}` },
      { stage: 'triggers', status: 'evaluated', detail: `${eligible.length}/${node.variants.length} varianter tillåtna: ${eligible.map(v => v.id).join(', ')}` },
      { stage: 'baseline', status: 'ready', detail: `${baseline.id} är alltid tillgänglig.` }
    ]
  };
}

export function finalizeDecision(prepared, advice, mode = prepared.mode ?? 'off') {
  requireInput(MODES.includes(mode), 'mode must be off, shadow or active.');
  let reason = 'no_advice', validAdvice = null, candidate = null;
  const expectedKeys = ['catalogRevision', 'requestId', 'variantId'];
  if (mode === 'off') reason = 'ai_disabled';
  else if (advice != null) {
    if (!record(advice) || Object.keys(advice).sort().join(',') !== expectedKeys.join(',') || typeof advice.requestId !== 'string' || typeof advice.catalogRevision !== 'string' || (advice.variantId !== null && typeof advice.variantId !== 'string')) reason = 'invalid_advice_shape';
    else if (advice.requestId !== prepared.requestId) reason = 'request_mismatch';
    else if (advice.catalogRevision !== prepared.catalogRevision) reason = 'catalog_mismatch';
    else if (advice.variantId === null) reason = 'abstained';
    else if (!(candidate = prepared.eligible.find(v => v.id === advice.variantId))) reason = 'ineligible_variant';
    else { validAdvice = { requestId: advice.requestId, catalogRevision: advice.catalogRevision, variantId: advice.variantId }; reason = mode === 'shadow' ? 'shadow_only' : 'accepted'; }
  }
  const accepted = reason === 'accepted';
  const selected = accepted ? candidate : prepared.baseline;
  const asset = prepared.assets.find(a => a.id === selected.assetId);
  return {
    requestId: prepared.requestId, nodeId: prepared.node.id, catalogRevision: prepared.catalogRevision, mode,
    event: clone(prepared.event), context: clone(prepared.context), eligible: clone(prepared.eligible), baseline: clone(prepared.baseline), selected: clone(selected), asset: clone(asset), advice: validAdvice,
    gate: { accepted, reason },
    trace: [...clone(prepared.trace),
      { stage: 'advice', status: mode === 'off' ? 'skipped' : validAdvice ? 'valid' : 'unavailable', detail: validAdvice ? `OpenClaw föreslog ${validAdvice.variantId}.` : `Inget tillämpbart råd: ${reason}.` },
      { stage: 'gate', status: accepted ? 'accepted' : reason === 'shadow_only' ? 'shadow' : 'fallback', detail: reason === 'shadow_only' ? 'Rådet är giltigt; shadow spelar standardvarianten.' : reason },
      { stage: 'animation', status: 'selected', detail: `${selected.label} · ${asset?.animation ?? 'neutral'}` }
    ]
  };
}
