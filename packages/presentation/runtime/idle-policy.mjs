// Both canonical and /presentation-runtime/ browser URLs resolve these package paths.
import { isDealerId } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import seedPolicy from '../../../packages/presentation/contracts/policies/idle-policy.seed.json' with { type: 'json' };

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const USES = new Set(['manual', 'automatic', 'rules', 'openclaw']);
const family = value => typeof value === 'string' && value.split('/').length === 3 && value.split('/')[1] === 'idle.ready' && value.split('/')[2] === 'ready' && isDealerId(value.split('/')[0]);
export const MAX_IDLE_VARIANTS = 30;
const clone = value => structuredClone(value);

export class IdlePolicyError extends Error {
  constructor(message) { super(`Ogiltig idlepolicy: ${message}`); this.name = 'IdlePolicyError'; }
}

function fail(message) { throw new IdlePolicyError(message); }
function object(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function exact(value, fields, at, optional = []) {
  if (!object(value)) fail(`${at} ska vara ett objekt`);
  const keys = Object.keys(value);
  if (fields.some(field => !Object.hasOwn(value, field)) || keys.some(key => !fields.includes(key) && !optional.includes(key))) fail(`${at} har fel fält`);
}
function integer(value, min, max, at) { if (!Number.isInteger(value) || value < min || value > max) fail(`${at} ska vara ett heltal ${min}–${max}`); }

export function validateIdlePolicy(value) {
  exact(value, ['schemaVersion', 'familyId', 'base', 'variants'], 'idlePolicy');
  if (value.schemaVersion !== 1 || !family(value.familyId)) fail('version eller mediefamilj stöds inte');
  if (!Array.isArray(value.base) || value.base.length < 1 || value.base.length > 4) fail('base ska innehålla 1–4 grundloopar');
  if (!Array.isArray(value.variants) || value.variants.length > MAX_IDLE_VARIANTS) fail(`variants får innehålla högst ${MAX_IDLE_VARIANTS} engångsklipp`);
  const ids = new Set();
  let weight = 0;
  for (const [index, item] of value.base.entries()) {
    exact(item, ['videoId', 'weight', 'durationMs'], `base[${index}]`);
    if (!UUID.test(item.videoId) || ids.has(item.videoId)) fail(`base[${index}].videoId är ogiltigt eller dubblerat`);
    ids.add(item.videoId); integer(item.weight, 1, 100, `base[${index}].weight`); integer(item.durationMs, 200, 60000, `base[${index}].durationMs`); weight += item.weight;
  }
  if (weight !== 100) fail('grundlooparnas vikter ska summera till 100');
  for (const [index, item] of value.variants.entries()) {
    exact(item, ['videoId', 'durationMs', 'use', 'automatic'], `variants[${index}]`, ['description']);
    if (Object.hasOwn(item, 'description') && (typeof item.description !== 'string' || item.description.length > 80
      || /[\u0000-\u001f\u007f-\u009f]/.test(item.description))) fail(`variants[${index}].description ska vara högst 80 tecken utan kontrolltecken`);
    if (!UUID.test(item.videoId) || ids.has(item.videoId)) fail(`variants[${index}].videoId är ogiltigt eller dubblerat`);
    ids.add(item.videoId); integer(item.durationMs, 200, 60000, `variants[${index}].durationMs`);
    if (!USES.has(item.use)) fail(`variants[${index}].use är okänt`);
    if (item.use === 'automatic') {
      exact(item.automatic, ['averageEveryMs', 'jitterMs', 'cooldownMs', 'maxPerMinute'], `variants[${index}].automatic`);
      integer(item.automatic.averageEveryMs, 5000, 300000, `variants[${index}].automatic.averageEveryMs`);
      integer(item.automatic.jitterMs, 0, 60000, `variants[${index}].automatic.jitterMs`);
      integer(item.automatic.cooldownMs, 0, 300000, `variants[${index}].automatic.cooldownMs`);
      integer(item.automatic.maxPerMinute, 1, 12, `variants[${index}].automatic.maxPerMinute`);
      if (item.automatic.jitterMs >= item.automatic.averageEveryMs) fail(`variants[${index}] jitter måste vara kortare än medelintervallet`);
    } else if (item.automatic !== null) fail(`variants[${index}].automatic ska vara null när användningen inte är automatisk`);
  }
  return value;
}

export function createDefaultIdlePolicy() { return validateIdlePolicy(clone(seedPolicy)); }

function automaticRate(item) {
  if (item.use !== 'automatic' || !item.automatic) return 0;
  const byInterval = 60000 / item.automatic.averageEveryMs;
  const byCooldown = item.automatic.cooldownMs ? 60000 / item.automatic.cooldownMs : Infinity;
  return Math.min(byInterval, byCooldown, item.automatic.maxPerMinute);
}

export function idleShareEstimate(input) {
  const policy = validateIdlePolicy(input);
  const shares = {};
  const occupied = policy.variants.reduce((total, item) => total + automaticRate(item) * item.durationMs, 0);
  const automaticShare = Math.min(0.9, occupied / 60000);
  const baseShare = 1 - automaticShare;
  for (const item of policy.base) shares[item.videoId] = baseShare * item.weight / 100;
  for (const item of policy.variants) shares[item.videoId] = item.use === 'automatic' ? automaticRate(item) * item.durationMs / 60000 : 0;
  return { shares, automaticShare, baseShare };
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => { value = value + 0x6D2B79F5 >>> 0; let next = value; next = Math.imul(next ^ next >>> 15, next | 1); next ^= next + Math.imul(next ^ next >>> 7, next | 61); return ((next ^ next >>> 14) >>> 0) / 4294967296; };
}
function chooseWeighted(items, random) {
  let value = random() * 100;
  for (const item of items) { value -= item.weight; if (value < 0) return item; }
  return items.at(-1);
}
function nextDue(item, from, random) {
  const jitter = item.automatic.jitterMs;
  return from + item.automatic.averageEveryMs + Math.round((random() * 2 - 1) * jitter);
}

export function createIdlePreviewPlan(input, { seed = 1, durationMs = 60000 } = {}) {
  const policy = validateIdlePolicy(input);
  integer(seed, 0, 0xffffffff, 'preview.seed'); integer(durationMs, 1000, 600000, 'preview.durationMs');
  const random = mulberry32(seed);
  const automatic = policy.variants.filter(item => item.use === 'automatic');
  const state = new Map(automatic.map(item => [item.videoId, { next: nextDue(item, 0, random), last: -Infinity, starts: [] }]));
  const plan = [];
  let now = 0;
  while (now < durationMs && plan.length < 1000) {
    const due = automatic
      .filter(item => {
        const current = state.get(item.videoId);
        current.starts = current.starts.filter(start => now - start < 60000);
        return current.next <= now && now - current.last >= item.automatic.cooldownMs && current.starts.length < item.automatic.maxPerMinute;
      })
      .sort((a, b) => state.get(a.videoId).next - state.get(b.videoId).next)[0];
    const item = due ?? chooseWeighted(policy.base, random);
    const endMs = Math.min(durationMs, now + item.durationMs);
    plan.push({ kind: due ? 'variant' : 'base', videoId: item.videoId, startMs: now, endMs, reason: due ? 'scheduled' : 'weighted-base' });
    if (due) {
      const current = state.get(due.videoId); current.last = now; current.starts.push(now); current.next = nextDue(due, now, random);
    }
    now = endMs;
  }
  return plan;
}
