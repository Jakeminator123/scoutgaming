import test from 'node:test';
import assert from 'node:assert/strict';
import schema from '../../../packages/presentation/contracts/schemas/idle-policy.schema.json' with { type: 'json' };
import { createDefaultIdlePolicy, validateIdlePolicy, idleShareEstimate, createIdlePreviewPlan, MAX_IDLE_VARIANTS } from '../../../packages/presentation/runtime/idle-policy.mjs';

test('the simple idle policy has two base loops and thirteen one-shot variants', () => {
  const policy = createDefaultIdlePolicy();
  assert.equal(validateIdlePolicy(policy), policy);
  assert.equal(policy.base.length, 2);
  assert.equal(policy.base.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.equal(policy.variants.length, 13);
  assert.deepEqual(policy.variants.map(item => item.use), ['automatic', 'manual', 'manual', 'openclaw', ...Array(9).fill('manual')]);
  assert.equal(schema.properties.variants.maxItems, MAX_IDLE_VARIANTS);
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

test('invalid weights, duplicate media and more than thirty variants are rejected', () => {
  const weights = createDefaultIdlePolicy(); weights.base[0].weight = 80;
  assert.throws(() => validateIdlePolicy(weights), /summera till 100/);
  const duplicate = createDefaultIdlePolicy(); duplicate.variants[0].videoId = duplicate.base[0].videoId;
  assert.throws(() => validateIdlePolicy(duplicate), /dubblerat/);
  const thirty = createDefaultIdlePolicy();
  thirty.variants = Array.from({ length: MAX_IDLE_VARIANTS }, (_, index) => ({
    videoId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    durationMs: 3040, use: 'manual', automatic: null,
  }));
  assert.equal(validateIdlePolicy(thirty).variants.length, MAX_IDLE_VARIANTS);
  const tooMany = structuredClone(thirty);
  tooMany.variants.push({ videoId: '00000000-0000-4000-8000-000000000030', durationMs: 3040, use: 'manual', automatic: null });
  assert.throws(() => validateIdlePolicy(tooMany), /högst 30/);
});

test('multi-minute previews enforce maxPerMinute in each rolling minute, not as an upfront total budget', () => {
  const policy = createDefaultIdlePolicy();
  policy.variants[0].automatic = { averageEveryMs: 5000, jitterMs: 0, cooldownMs: 0, maxPerMinute: 1 };
  const variants = createIdlePreviewPlan(policy, { seed: 1, durationMs: 180000 }).filter(item => item.kind === 'variant');
  assert.equal(variants.length, 3);
  assert.equal(variants.filter(item => item.startMs < 60000).length, 1);
  for (let i = 1; i < variants.length; i++) assert.ok(variants[i].startMs - variants[i - 1].startMs >= 60000);
});
