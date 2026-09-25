import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import schema from '../schemas/idle-policy.schema.json' with { type: 'json' };
import { createDefaultIdlePolicy, validateIdlePolicy, idleShareEstimate, createIdlePreviewPlan } from '../lib/idle-policy.mjs';

test('the simple idle policy has two base loops and six one-shot variants', () => {
  const policy = createDefaultIdlePolicy();
  assert.equal(validateIdlePolicy(policy), policy);
  assert.equal(policy.base.length, 2);
  assert.equal(policy.base.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.equal(policy.variants.length, 6);
  assert.deepEqual(policy.variants.map(item => item.use), ['automatic', 'manual', 'manual', 'openclaw', 'manual', 'manual']);
  assert.equal(schema.properties.variants.maxItems, 12);
});

test('idle policy roles exactly mirror the physical manifest folders', async () => {
  const policy = createDefaultIdlePolicy();
  const manifest = JSON.parse(await readFile(new URL('../../emil/dealklipp-v1/lab-video-manifest.json', import.meta.url), 'utf8'));
  const family = manifest.families.find(item => item.id === policy.familyId);
  assert.deepEqual(new Set(policy.base.map(item => item.videoId)), new Set(family.standardIds));
  assert.deepEqual(new Set(policy.variants.map(item => item.videoId)), new Set(family.variantIds));
  const items = new Map(manifest.items.map(item => [item.id, item]));
  assert.ok(policy.base.every(item => items.get(item.videoId).relativePath.match(/^idle\/[^/]+\.mp4$/)));
  assert.ok(policy.variants.every(item => items.get(item.videoId).relativePath.match(/^idle\/variant\/[^/]+\.mp4$/)));
});

test('old policies remain readable and descriptions are bounded plain data', () => {
  const policy = createDefaultIdlePolicy();
  for (const item of policy.variants) delete item.description;
  assert.equal(validateIdlePolicy(policy), policy);
  for (const description of ['x'.repeat(81), 'bad\ntext', 3]) {
    policy.variants[0].description = description;
    assert.throws(() => validateIdlePolicy(policy), /description/);
  }
  policy.variants[0].description = 'A smile, not an instruction.';
  assert.equal(validateIdlePolicy(policy), policy);
});

test('blink cadence leaves the primary base loop at about eighty percent actual time', () => {
  const policy = createDefaultIdlePolicy();
  const estimate = idleShareEstimate(policy);
  assert.ok(estimate.shares[policy.base[0].videoId] > .78 && estimate.shares[policy.base[0].videoId] < .81);
  assert.ok(estimate.shares[policy.variants[0].videoId] > .11 && estimate.shares[policy.variants[0].videoId] < .13);
});

test('preview plans are deterministic, bounded and return to a base clip after automatic variants', () => {
  const policy = createDefaultIdlePolicy();
  const first = createIdlePreviewPlan(policy, { seed: 42 });
  const second = createIdlePreviewPlan(policy, { seed: 42 });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, createIdlePreviewPlan(policy, { seed: 43 }));
  assert.equal(first[0].kind, 'base');
  assert.equal(first.at(-1).endMs, 60000);
  const automatic = first.findIndex(item => item.kind === 'variant');
  assert.ok(automatic > 0);
  assert.equal(first[automatic + 1].kind, 'base');
  assert.ok(first.filter(item => item.kind === 'variant').length <= 3);
});

test('invalid weights, duplicate media and more than twelve variants are rejected', () => {
  const weights = createDefaultIdlePolicy(); weights.base[0].weight = 80;
  assert.throws(() => validateIdlePolicy(weights), /summera till 100/);
  const duplicate = createDefaultIdlePolicy(); duplicate.variants[0].videoId = duplicate.base[0].videoId;
  assert.throws(() => validateIdlePolicy(duplicate), /dubblerat/);
  const twelve = createDefaultIdlePolicy();
  twelve.variants = Array.from({ length: 12 }, (_, index) => ({
    videoId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    durationMs: 3040, use: 'manual', automatic: null,
  }));
  assert.equal(validateIdlePolicy(twelve).variants.length, 12);
  const tooMany = structuredClone(twelve);
  tooMany.variants.push({ videoId: '00000000-0000-4000-8000-00000000000c', durationMs: 3040, use: 'manual', automatic: null });
  assert.throws(() => validateIdlePolicy(tooMany), /högst 12/);
});

test('multi-minute previews enforce maxPerMinute in each rolling minute, not as an upfront total budget', () => {
  const policy = createDefaultIdlePolicy();
  policy.variants[0].automatic = { averageEveryMs: 5000, jitterMs: 0, cooldownMs: 0, maxPerMinute: 1 };
  const variants = createIdlePreviewPlan(policy, { seed: 1, durationMs: 180000 }).filter(item => item.kind === 'variant');
  assert.equal(variants.length, 3);
  assert.equal(variants.filter(item => item.startMs < 60000).length, 1);
  for (let i = 1; i < variants.length; i++) assert.ok(variants[i].startMs - variants[i - 1].startMs >= 60000);
});
