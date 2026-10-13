import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSceneJoin,validateSceneJoin} from '../web/public/scene-join.mjs';
import {PerformancePlayer} from '../web/public/performance-player.mjs';
const hash = 'a'.repeat(64);
const idle = { sha256: hash, matteSha256: hash };
const take = { id: 'take-1', camera: { width: 1920, height: 1080 }, media: { sha256: hash }, calibrationSha256: hash };
const join = {
  status: 'review', calibrationSha256: hash,
  media: { src: 'dealers/astrid/performance/joins/exit.mp4', sha256: hash, width: 1920, height: 1080, fps: 60, frames: 2 },
  camera: { width: 1920, height: 1080 },
  idle: { rgbSha256: hash, maskSha256: hash },
  bindings: ['entry', 'exit'].map(edge => ({ edge, takeId: 'take-1', mediaSha256: hash, calibrationSha256: hash })),
};
const manifest = { joins: [join] };
test('a bound join is selected only for the matching take, edge and idle', () => {
  assert.deepEqual(validateSceneJoin(join), []);
  for (const edge of ['entry', 'exit']) assert.equal(selectSceneJoin(manifest, take, edge, idle), join);
  assert.equal(selectSceneJoin(manifest, take, 'exit', { ...idle, matteSha256: '1'.repeat(64) }), null);
  const changed = structuredClone(take); changed.media.sha256 = '1'.repeat(64);
  assert.equal(selectSceneJoin(manifest, changed, 'exit', idle), null);
  const regraded = structuredClone(take); regraded.calibrationSha256 = '2'.repeat(64);
  assert.equal(selectSceneJoin(manifest, regraded, 'entry', idle), null);
  assert.equal(selectSceneJoin(manifest, take, 'unknown', idle), null);
});
test('the actor is not released until the return and matched idle have both finished', async () => {
  const events = []; let returnDone, idleDone;
  const actor = { staged: true, joins: manifest, idle, held: { take },
    playJoin: () => { events.push('return'); return new Promise(r => returnDone = r); },
    prepareIdle: () => { events.push('idle'); return new Promise(r => idleDone = r); }, release: () => events.push('release') };
  const finished = PerformancePlayer.prototype.finish.call(actor);
  assert.deepEqual(events, ['return']); returnDone(); await Promise.resolve();
  assert.deepEqual(events, ['return', 'idle']); idleDone(); await finished;
  assert.deepEqual(events, ['return', 'idle', 'release']);
});
test('an interrupted return cleans up instead of freezing the actor over decisions', async () => {
  let released = false;
  const actor = { staged: true, joins: manifest, idle, held: { take }, playJoin: async () => { throw new Error('Interrupted'); }, prepareIdle: async () => assert.fail('No idle preparation after failure'), release: () => released = true };
  await assert.rejects(PerformancePlayer.prototype.finish.call(actor), /Interrupted/); assert.equal(released, true);
});
test('recorded speech waits across the entire dealing sequence, including media loading', async () => {
  const actor = { sequence: true, active: null, held: null, releaseWaiters: new Set(), host: { classList: { remove() {} } } };
  let speech = false;
  const ready = PerformancePlayer.prototype.whenReleased.call(actor).then(() => speech = true);
  await Promise.resolve(); assert.equal(speech, false);
  PerformancePlayer.prototype.release.call(actor); await ready; assert.equal(speech, true); assert.equal(actor.releaseWaiters.size, 0);
});
test('cancelled speech leaves no waiting callback on a dealing sequence', async () => {
  const actor = { sequence: true, releaseWaiters: new Set() }, controller = new AbortController();
  const ready = PerformancePlayer.prototype.whenReleased.call(actor, controller.signal); controller.abort();
  await assert.rejects(ready, { name: 'AbortError' }); assert.equal(actor.releaseWaiters.size, 0);
});
