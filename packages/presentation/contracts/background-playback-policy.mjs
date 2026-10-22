// Shared data-only policy: asset IDs are resolved through the caller's existing
// layer grants. No URLs, player outcomes, provider calls or executable predicates.
// The same policy shape drives the background layer and, since v24, the table layer.
export const BACKGROUND_EVENT_IDS = Object.freeze([
  'speak.blackjack', 'speak.win', 'speak.dealerblackjack', 'speak.dealerbust',
  'speak.push', 'speak.lose', 'speak.sidebet', 'speak.bust', 'speak.double',
  'speak.insurance', 'speak.goodluck', 'speak.placebets', 'speak.greeting',
]);
export const LAYER_PLAYBACK_ROLES = Object.freeze(['background', 'table']);
export const MAX_PLAYBACK_JITTER_MS = 120000;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ruleId = /^[a-z][a-z0-9-]{0,62}$/;
const baseTypes = { background: ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'],
  table: ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'] };
const fail = () => { throw new Error('Invalid background playback policy'); };
function exact(value, fields, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length) fail();
  const names = Object.getOwnPropertyNames(value);
  if (names.some(key => ![...fields, ...optional].includes(key))
    || fields.some(key => !names.includes(key))
    || names.some(key => !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) fail();
}
function integer(value, min, max) { if (!Number.isInteger(value) || value < min || value > max) fail(); }
// A timer trigger may carry jitterMs: each start is drawn uniformly from
// everyMs ± jitterMs. Older readers reject the field, so readiness gates it (v24).
export function validateLayerPlayback(value, { role = 'background', assets, allowed, defaultAssetId } = {}) {
  if (!LAYER_PLAYBACK_ROLES.includes(role)) fail();
  exact(value, ['schemaVersion', 'rules']);
  if (value.schemaVersion !== 1 || !Array.isArray(value.rules)
    || Object.getPrototypeOf(value.rules) !== Array.prototype || value.rules.length > 16
    || Object.getOwnPropertySymbols(value.rules).length
    || Object.keys(value.rules).length !== value.rules.length
    || Object.getOwnPropertyNames(value.rules).length !== value.rules.length + 1) fail();
  const ids = new Set();
  for (let index = 0; index < value.rules.length; index++) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value.rules, index) ?? {}, 'value')) fail();
    const rule = value.rules[index];
    exact(rule, ['id', 'assetId', 'trigger', 'maxDurationMs', 'cooldownMs', 'maxPerMinute', 'maxSecondsPerMinute']);
    if (typeof rule.id !== 'string' || !ruleId.test(rule.id) || ids.has(rule.id)
      || typeof rule.assetId !== 'string' || !uuid.test(rule.assetId)) fail();
    ids.add(rule.id);
    if (Object.hasOwn(rule.trigger ?? {}, 'eventId')) {
      exact(rule.trigger, ['eventId']);
      if (!BACKGROUND_EVENT_IDS.includes(rule.trigger.eventId)) fail();
    } else {
      exact(rule.trigger, ['everyMs'], ['jitterMs']);
      integer(rule.trigger.everyMs, 5000, 300000);
      if (Object.hasOwn(rule.trigger, 'jitterMs')) {
        integer(rule.trigger.jitterMs, 0, MAX_PLAYBACK_JITTER_MS);
        if (rule.trigger.jitterMs >= rule.trigger.everyMs) fail();
      }
    }
    integer(rule.maxDurationMs, 1000, 60000);
    integer(rule.cooldownMs, 0, 300000);
    integer(rule.maxPerMinute, 1, 12);
    integer(rule.maxSecondsPerMinute, 1, 60);
    if (rule.maxDurationMs > rule.maxSecondsPerMinute * 1000) fail();
  }
  if (assets !== undefined && !Array.isArray(assets) || allowed !== undefined && !Array.isArray(allowed)) fail();
  if (value.rules.length) {
    const referenced = [...new Set(value.rules.map(rule => rule.assetId))];
    if (defaultAssetId !== undefined) {
      if (typeof defaultAssetId !== 'string' || !uuid.test(defaultAssetId)) fail();
      if (allowed !== undefined && !allowed.includes(defaultAssetId)) fail();
      if (assets !== undefined && !assets.some(asset => asset.id === defaultAssetId && asset.role === role
        && baseTypes[role].includes(asset.contentType))) fail();
    } else if (assets !== undefined || allowed !== undefined) fail();
    for (const id of referenced) {
      if (allowed !== undefined && !allowed.includes(id)) fail();
      if (assets !== undefined && !assets.some(asset => asset.id === id && asset.role === role
        && ['video/mp4', 'video/webm'].includes(asset.contentType))) fail();
    }
  }
  return structuredClone(value);
}
export function validateBackgroundPlayback(value, options = {}) {
  return validateLayerPlayback(value, { ...options, role: 'background' });
}
export function playbackUsesJitter(value) {
  return Boolean(value && typeof value === 'object' && Array.isArray(value.rules)
    && value.rules.some(rule => rule && typeof rule === 'object' && rule.trigger && typeof rule.trigger === 'object'
      && Object.hasOwn(rule.trigger, 'jitterMs')));
}
export function backgroundRuleAssetIds(value) {
  return [...new Set(validateBackgroundPlayback(value).rules.map(rule => rule.assetId))];
}
export function layerRuleAssetIds(value, role = 'background') {
  return [...new Set(validateLayerPlayback(value, { role }).rules.map(rule => rule.assetId))];
}
export function defaultBackgroundRule(assetId, id) {
  return validateBackgroundPlayback({ schemaVersion: 1, rules: [{ id, assetId,
    trigger: { everyMs: 25000 }, maxDurationMs: 10000, cooldownMs: 25000,
    maxPerMinute: 2, maxSecondsPerMinute: 20 }] }).rules[0];
}
// A living layer: roughly every 3 min 15 s, drawn ± 74 s, one short silent clip.
export function defaultLayerRule(assetId, id, { role = 'background', everyMs = 195000, jitterMs = 74000 } = {}) {
  return validateLayerPlayback({ schemaVersion: 1, rules: [{ id, assetId,
    trigger: { everyMs, jitterMs }, maxDurationMs: 10000, cooldownMs: 60000,
    maxPerMinute: 1, maxSecondsPerMinute: 20 }] }, { role }).rules[0];
}
