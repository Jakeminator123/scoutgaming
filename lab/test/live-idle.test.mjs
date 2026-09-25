import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveIdleController } from '../lib/live-idle.mjs';
import { createDefaultIdlePolicy } from '../lib/idle-policy.mjs';

function fixture(patch = () => {}, options = {}) {
  const policy = createDefaultIdlePolicy();
  policy.base = [{ ...policy.base[0], weight: 100, durationMs: 1000 }];
  for (const item of policy.variants) item.durationMs = 1000;
  policy.variants[0].automatic = { averageEveryMs: 5000, jitterMs: 0, cooldownMs: 0, maxPerMinute: 12 };
  patch(policy);
  const inventory = { families: [{ id: policy.familyId, dealerId: 'astrid', playbackType: 'idle-pool',
    standardIds: policy.base.map(item => item.videoId), variantIds: policy.variants.map(item => item.videoId) }],
    videos: [...policy.base.map(item => ({ id: item.videoId, familyId: policy.familyId, role: 'standard', available: true })),
      ...policy.variants.map(item => ({ id: item.videoId, familyId: policy.familyId, role: 'variant', available: true }))] };
  let clock = 0;
  const controller = createLiveIdleController({ policy, inventory, now: () => clock, initialScene: { active: true }, ...options });
  const starts = [];
  function start() {
    const current = controller.snapshot().clip;
    assert.ok(current);
    starts.push({ at: clock, ...current }); controller.started(current.playId); controller.presented(current.playId); return current;
  }
  function finish(duration = 1000) { const current = start(); clock += duration; return controller.completed(current.playId); }
  return { policy, inventory, controller, starts, start, finish, at: value => { clock = value; }, now: () => clock };
}

test('selection is not a presented standard pose; variants and alternate bases never prove it', () => {
  const h = fixture(), c = h.controller;
  assert.equal(c.snapshot().idleReady, false);
  const base = c.snapshot().clip;
  c.started(base.playId); assert.equal(c.snapshot().idleReady, false);
  c.presented(base.playId); assert.equal(c.snapshot().idleReady, true);
  h.at(5000); const variant = c.completed(base.playId).clip;
  assert.equal(variant.kind, 'variant'); assert.equal(variant.standardBase, false);
  c.presented(variant.playId); assert.equal(c.snapshot().idleReady, false);
  h.at(6000); assert.equal(c.completed(variant.playId).clip.kind, 'base');
  assert.equal(c.snapshot().idleReady, false);
  c.presented(base.playId); assert.equal(c.snapshot().idleReady, false);
});

test('actual clip boundaries choose deterministic weighted bases, not duration timers', () => {
  const configure = p => { p.base = createDefaultIdlePolicy().base.map(item => ({ ...item, durationMs: 1000, weight: 50 })); p.variants.forEach(item => { item.use = 'manual'; item.automatic = null; }); };
  const a = fixture(configure), b = fixture(configure);
  for (let i = 0; i < 100; i++) { a.finish(); b.finish(); }
  assert.deepEqual(a.starts, b.starts);
  assert.equal(new Set(a.starts.map(item => item.videoId)).size, 2);
  const primaryCount = a.starts.filter(item => item.standardBase).length;
  assert.ok(primaryCount > 30 && primaryCount < 70);
  const alternate = a.starts.find(item => !item.standardBase);
  assert.ok(alternate);
  const current = a.controller.snapshot(); a.at(1000000);
  assert.deepEqual(a.controller.snapshot(), current, 'time alone never chooses or starts a different clip');
});

test('automatic interval/jitter is deterministic and only automatic policy clips run', () => {
  const configure = p => { p.variants[0].automatic = { averageEveryMs: 10000, jitterMs: 4000, cooldownMs: 0, maxPerMinute: 12 }; };
  const a = fixture(configure), b = fixture(configure), d = fixture(configure, { seed: 7 });
  for (let i = 0; i < 100; i++) { a.finish(); b.finish(); d.finish(); }
  const times = h => h.starts.filter(item => item.kind === 'variant').map(item => item.at);
  assert.deepEqual(times(a), times(b)); assert.notDeepEqual(times(a), times(d));
  assert.ok(times(a).length > 3);
  assert.ok(a.starts.every(item => item.kind === 'base' || item.videoId === a.policy.variants[0].videoId));
  const v = times(a); for (let i = 1; i < v.length; i++) assert.ok(v[i] - v[i - 1] >= 6000 && v[i] - v[i - 1] <= 15000);
});

test('maxPerMinute is rolling across long sessions and automatic variants return to base', () => {
  const h = fixture(p => { p.variants[0].automatic.maxPerMinute = 1; });
  for (let i = 0; i < 190; i++) h.finish();
  const variants = h.starts.filter(item => item.kind === 'variant');
  assert.ok(variants.length >= 3);
  for (let i = 1; i < variants.length; i++) assert.ok(variants[i].at - variants[i - 1].at >= 60000);
  for (let i = 0; i < h.starts.length - 1; i++) if (h.starts[i].kind === 'variant') assert.equal(h.starts[i + 1].kind, 'base');
});

test('quota begins on actual started, not selection, and duplicate receipts do not consume it twice', () => {
  const h = fixture(p => { p.variants[0].automatic.maxPerMinute = 1; }), c = h.controller;
  const base = h.start(); h.at(5000); const variant = c.completed(base.playId).clip;
  h.at(9000); c.started(variant.playId); c.started(variant.playId); c.presented(variant.playId);
  h.at(10000); c.completed(variant.playId); c.completed(variant.playId);
  for (let i = 0; i < 59; i++) h.finish();
  assert.equal(h.now(), 69000); assert.equal(c.snapshot().clip.kind, 'variant');
  assert.equal(h.starts.some(item => item.kind === 'variant'), false, 'the new slot is selected only at 69s, not before');
});

test('actions interrupt immediately, preserve cooldown and resume without catching up missed blinks', () => {
  const h = fixture(), c = h.controller;
  for (let i = 0; i < 5; i++) h.finish();
  const variant = c.snapshot().clip; c.presented(variant.playId);
  assert.equal(c.updateScene({ actionBusy: true }).clip, null);
  assert.equal(c.completed(variant.playId).clip, null);
  h.at(100000); assert.equal(c.updateScene({ actionBusy: false }).clip.kind, 'base');
  for (let i = 0; i < 4; i++) { h.finish(); assert.equal(c.snapshot().clip.kind, 'base'); }
  h.finish(); assert.equal(c.snapshot().clip.kind, 'variant');
  const guarded = fixture(p => { p.variants[0].automatic.cooldownMs = 60000; }), g = guarded.controller;
  for (let i = 0; i < 5; i++) guarded.finish();
  g.started(g.snapshot().clip.playId); g.updateScene({ actionBusy: true }); guarded.at(20000); g.updateScene({ actionBusy: false });
  for (let i = 0; i < 44; i++) { guarded.finish(); assert.equal(g.snapshot().clip.kind, 'base'); }
  guarded.finish(); assert.equal(g.snapshot().clip.kind, 'variant');
});

test('ready speech preempts idle with fresh primary proof; playing speech and deal never wait', () => {
  const h = fixture(), c = h.controller;
  const old = h.start(); assert.equal(c.snapshot().idleReady, true);
  const held = c.updateScene({ speechReady: true });
  assert.notEqual(held.clip.playId, old.playId); assert.equal(held.clip.standardBase, true); assert.equal(held.clip.repeat, true); assert.equal(held.idleReady, false);
  c.presented(old.playId); assert.equal(c.snapshot().idleReady, false);
  c.presented(held.clip.playId); assert.equal(c.snapshot().idleReady, true);
  h.at(100000); assert.equal(c.completed(held.clip.playId).clip.playId, held.clip.playId, 'no variations while ready speech owns next slot');
  assert.equal(c.updateScene({ speechPlaying: true }).clip, null);
  assert.equal(c.updateScene({ actionBusy: true }).clip, null);
  c.updateScene({ speechReady: false, speechPlaying: false }); assert.equal(c.snapshot().clip, null);
  const resumed = c.updateScene({ actionBusy: false }); assert.equal(resumed.clip.repeat, false); assert.equal(resumed.idleReady, false);
});

test('text-only/silence completion exits held loop, and preparing generation does not freeze idle', () => {
  const h = fixture(), c = h.controller;
  const held = c.updateScene({ speechReady: true }); c.presented(held.clip.playId);
  const resumed = c.updateScene({ speechReady: false }); assert.equal(resumed.clip.repeat, false); assert.equal(resumed.idleReady, false);
  for (let i = 0; i < 5; i++) h.finish();
  assert.equal(c.snapshot().clip.kind, 'variant');
});

test('hidden/inactive/identity boundaries invalidate proofs; ordinary actions do not reset quota', () => {
  const h = fixture(p => { p.variants[0].automatic.maxPerMinute = 1; }), c = h.controller;
  for (let i = 0; i < 5; i++) h.finish();
  c.started(c.snapshot().clip.playId); c.updateScene({ visible: false }); h.at(7000);
  assert.equal(c.updateScene({ visible: true }).idleReady, false);
  for (let i = 0; i < 10; i++) h.finish();
  assert.equal(c.snapshot().clip.kind, 'base');
  c.updateScene({ identity: 'new-observation' });
  for (let i = 0; i < 5; i++) h.finish();
  assert.equal(c.snapshot().clip.kind, 'variant');
  assert.equal(c.updateScene({ active: false }).clip, null);
});

test('policy updates preserve same-media recent starts and cannot sneak in wrong-family or missing files', () => {
  const h = fixture(p => { p.variants[0].automatic.maxPerMinute = 1; }), c = h.controller;
  for (let i = 0; i < 5; i++) h.finish(); c.started(c.snapshot().clip.playId);
  const changed = structuredClone(h.policy); changed.base[0].durationMs = 2000;
  assert.equal(c.updatePolicy(changed, h.inventory).clip.kind, 'base');
  for (let i = 0; i < 20; i++) h.finish(); assert.equal(c.snapshot().clip.kind, 'base');
  const wrong = structuredClone(h.inventory); wrong.videos[0].familyId = 'other/idle.ready/ready';
  assert.equal(c.updatePolicy(changed, wrong).state, 'unavailable');
  assert.equal(c.snapshot().idleReady, false);
  const anotherDealer = fixture(() => {}, { dealerId: 'vera' }); assert.equal(anotherDealer.controller.snapshot().clip, null);
});

test('failed variant falls back once to a real base; failed primary uses another known standard, never another family', () => {
  const h = fixture(p => { p.base = createDefaultIdlePolicy().base; }), c = h.controller;
  let primary;
  c.updateScene({ speechReady: true }); primary = c.snapshot().clip;
  const fallback = c.failed(primary.playId); assert.equal(fallback.clip.standardBase, true); assert.notEqual(fallback.clip.videoId, primary.videoId);
  assert.equal(fallback.idleReady, false); c.presented(fallback.clip.playId); assert.equal(c.snapshot().idleReady, true);
  assert.equal(c.failed(fallback.clip.playId).state, 'unavailable');
  const variantCase = fixture(), v = variantCase.controller;
  for (let i = 0; i < 5; i++) variantCase.finish();
  assert.equal(v.failed(v.snapshot().clip.playId).clip.kind, 'base');
  for (let i = 0; i < 20; i++) variantCase.finish(); assert.ok(variantCase.starts.every(item => item.kind === 'base'));
});

test('OpenClaw offers are bounded, exact-policy, one-shot and wait for a base boundary', () => {
  const h = fixture(), c = h.controller, id = h.policy.variants[3].videoId;
  assert.equal(c.offerVariant({ videoId: id, requestId: 'advice-1', expiresAt: 30000 }), true);
  assert.equal(c.snapshot().clip.kind, 'base');
  assert.equal(c.offerVariant({ videoId: id, requestId: 'advice-2', expiresAt: 30000 }), false);
  const selected = h.finish().clip; assert.equal(selected.reason, 'openclaw'); assert.equal(selected.requestId, 'advice-1');
  c.started(selected.playId); c.presented(selected.playId); assert.equal(c.snapshot().idleReady, false);
  h.at(2000); c.completed(selected.playId);
  assert.equal(c.offerVariant({ videoId: id, requestId: 'advice-1', expiresAt: 30000 }), false);
  assert.equal(c.offerVariant({ videoId: id, requestId: 'advice-3', expiresAt: 30000 }), false);
  h.at(31000); assert.equal(c.offerVariant({ videoId: id, requestId: 'advice-4', expiresAt: 50000 }), false, 'rolling max1/min remains after 30s cooldown');
  h.at(61000); assert.equal(c.offerVariant({ videoId: id, requestId: 'advice-5', expiresAt: 90000 }), true);
  for (const item of h.policy.variants.slice(0, 3)) assert.equal(c.offerVariant({ videoId: item.videoId, requestId: `wrong-${item.videoId}`, expiresAt: 80000 }), false);
});

test('offers expire or disappear on scene/policy change; ignored/stale requests never replay', () => {
  for (const change of ['expiry', 'action', 'held', 'policy', 'identity', 'revision']) {
    const h = fixture(), c = h.controller, id = h.policy.variants[3].videoId;
    assert.equal(c.offerVariant({ videoId: id, requestId: 'advice-1', expiresAt: 1000 }), true);
    if (change === 'expiry') h.at(1000);
    if (change === 'action') { c.updateScene({ actionBusy: true }); c.updateScene({ actionBusy: false }); }
    if (change === 'held') { c.updateScene({ speechReady: true }); c.updateScene({ speechReady: false }); }
    if (change === 'identity') c.updateScene({ identity: 'new-session' });
    if (change === 'revision') c.updateScene({ revision: 'new-round' });
    if (change === 'policy') { const p = structuredClone(h.policy); p.base[0].durationMs = 2000; c.updatePolicy(p, h.inventory); }
    assert.notEqual(h.finish().clip.reason, 'openclaw');
    assert.equal(c.offerVariant({ videoId: id, requestId: 'advice-1', expiresAt: h.now() + 30000 }), false);
  }
  const h = fixture(), id = h.policy.variants[3].videoId;
  for (const expiresAt of [-1, 0, 30001, Infinity]) assert.equal(h.controller.offerVariant({ videoId: id, requestId: 'invalid', expiresAt }), false);
});

test('advice expires during loading and changed round cancels selected advice without clearing automatic quotas', () => {
  const h = fixture(), c = h.controller, id = h.policy.variants[3].videoId;
  c.offerVariant({ videoId: id, requestId: 'expires-loading', expiresAt: 2000 });
  const selected = h.finish().clip; assert.equal(selected.reason, 'openclaw');
  h.at(2000); assert.equal(c.started(selected.playId).clip.kind, 'base');
  assert.equal(c.presented(selected.playId).idleReady, false);
  assert.equal(c.offerVariant({ videoId: id, requestId: 'new-valid', expiresAt: 30000 }), true, 'expired unplayed offer consumed no playback quota');
  const next = h.finish().clip; assert.equal(next.reason, 'openclaw');
  assert.equal(c.updateScene({ revision: '2' }).clip.kind, 'base');
  c.started(next.playId); assert.equal(c.snapshot().clip.kind, 'base');
});

test('OpenClaw rolling one-per-minute quota is shared across all eligible reaction clips and policy changes', () => {
  const h = fixture(p => { p.variants[1].use = 'openclaw'; }), c = h.controller;
  const first = h.policy.variants[3].videoId, second = h.policy.variants[1].videoId;
  c.offerVariant({ videoId: first, requestId: 'first', expiresAt: 30000 }); h.finish(); h.start();
  c.updateScene({ actionBusy: true }); h.at(31000); c.updateScene({ actionBusy: false });
  assert.equal(c.offerVariant({ videoId: second, requestId: 'different-file', expiresAt: 50000 }), false);
  const updated = structuredClone(h.policy); updated.base[0].durationMs = 2000; c.updatePolicy(updated, h.inventory);
  assert.equal(c.offerVariant({ videoId: second, requestId: 'updated-policy', expiresAt: 50000 }), false);
  h.at(61000); assert.equal(c.offerVariant({ videoId: second, requestId: 'after-minute', expiresAt: 90000 }), true);
});

test('snapshots/policies are defensive, clocks and scenes bounded, close is terminal', () => {
  const h = fixture(), c = h.controller; const snapshot = c.snapshot(); snapshot.clip.videoId = 'untrusted';
  assert.notEqual(c.snapshot().clip.videoId, 'untrusted');
  h.policy.base[0].videoId = 'untrusted'; assert.notEqual(c.snapshot().clip.videoId, 'untrusted');
  assert.throws(() => c.updateScene({ actionBusy: 'yes' }), /scene/);
  assert.throws(() => c.updateScene({ gameCommand: 'deal' }), /scene/);
  c.close(); assert.equal(c.updateScene({ active: true }).state, 'closed'); assert.equal(c.snapshot().clip, null);
  assert.equal(c.offerVariant({ videoId: h.policy.variants[3].videoId, requestId: 'closed', expiresAt: 30000 }), false);
  const other = fixture(); other.at(-1); assert.throws(() => other.controller.started(1), /monotonic/);
});
