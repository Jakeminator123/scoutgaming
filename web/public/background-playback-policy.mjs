// Shared data-only policy: asset IDs are resolved through the caller's existing
// layer grants. No URLs, player outcomes, provider calls or executable predicates.
export const BACKGROUND_EVENT_IDS = Object.freeze([
  'speak.blackjack', 'speak.win', 'speak.dealerblackjack', 'speak.dealerbust',
  'speak.push', 'speak.lose', 'speak.sidebet', 'speak.bust', 'speak.double',
  'speak.insurance', 'speak.goodluck', 'speak.placebets', 'speak.greeting',
]);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ruleId = /^[a-z][a-z0-9-]{0,62}$/;
const fail = () => { throw new Error('Invalid background playback policy'); };
function exact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length
    || Object.getOwnPropertyNames(value).length !== fields.length
    || fields.some(key => !Object.hasOwn(value, key)
      || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) fail();
}
function integer(value, min, max) { if (!Number.isInteger(value) || value < min || value > max) fail(); }
export function validateBackgroundPlayback(value, { assets, allowed, defaultAssetId } = {}) {
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
      exact(rule.trigger, ['everyMs']);
      integer(rule.trigger.everyMs, 5000, 300000);
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
      if (assets !== undefined && !assets.some(asset => asset.id === defaultAssetId && asset.role === 'background'
        && ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'].includes(asset.contentType))) fail();
    } else if (assets !== undefined || allowed !== undefined) fail();
    for (const id of referenced) {
      if (allowed !== undefined && !allowed.includes(id)) fail();
      if (assets !== undefined && !assets.some(asset => asset.id === id && asset.role === 'background'
        && ['video/mp4', 'video/webm'].includes(asset.contentType))) fail();
    }
  }
  return structuredClone(value);
}
export function backgroundRuleAssetIds(value) {
  return [...new Set(validateBackgroundPlayback(value).rules.map(rule => rule.assetId))];
}
export function defaultBackgroundRule(assetId, id) {
  return validateBackgroundPlayback({ schemaVersion: 1, rules: [{ id, assetId,
    trigger: { everyMs: 25000 }, maxDurationMs: 10000, cooldownMs: 25000,
    maxPerMinute: 2, maxSecondsPerMinute: 20 }] }).rules[0];
}
