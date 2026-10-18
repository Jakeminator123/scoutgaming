import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMovingSpeechPlan } from '../services/game/moving-speech-plan.mjs';

const sha = char => char.repeat(64);
function fixture(dealerId = 'paow', workerAvatar = dealerId) {
  const binding = { dealerId, workerAvatar, sessionId: 'session-1', talkId: 'reply-1', revision: 1,
    profileRevision: sha('a'), textSha256: sha('b'), audioSha256: sha('c'), avatarSha256: sha('d') };
  const clips = [
    { dealerId, take: 'pos4-iv', kind: 'video', sha256: sha('e'), fps: 24, frameCount: 200 },
    { dealerId, take: 'vila', kind: 'still', sha256: sha('f'), fps: 24, frameCount: 1 },
  ];
  const frames = [{ take: 'pos4-iv', frame: 40 }, { take: 'pos4-iv', frame: 41 },
    { take: 'pos4-iv', frame: 41 }, { take: 'vila', frame: 0 }, { take: 'vila', frame: 0 }];
  return { binding, clips, frames };
}
function renderInput(plan, speechFrame = 0) {
  const f = plan.timeline[speechFrame];
  return [{ id: plan.start.id, speechFrame, tag: { tagning: f.take, ruta: f.frame, rect: [.4, .2, .1, .1] } },
    { binding: { ...plan.binding }, planSha256: plan.planSha256, speechFrame,
      take: f.take, frame: f.frame, sourceSha256: f.sourceSha256 }];
}

test('Paow and Dragan prepare exact Kevin maps, held frames and vila for the dealer layer', () => {
  for (const [dealerId, avatar] of [['paow', 'paow'], ['dragan', 'dragge']]) {
    const plan = prepareMovingSpeechPlan(fixture(dealerId, avatar));
    assert.deepEqual(plan.start.karta, [['pos4-iv', 40, 2], ['pos4-iv', 41, 1], ['vila', 0, 2]]);
    assert.equal(plan.start.rate, 24000);
    assert.equal(plan.audioLeadMs, 220);
    assert.equal(plan.fps, 24);
    assert.equal(plan.binding.workerAvatar, avatar);
    assert.deepEqual(plan.end, { t: 'end', id: plan.start.id });
    const match = plan.matchFrame(...renderInput(plan));
    assert.equal(match.layer, 'dealer');
    assert.equal(match.stage, 'source-before-framing-and-keying');
    assert.deepEqual(match.rect, [.4, .2, .1, .1]);
    assert.ok(plan.matchFrame(...renderInput(plan, 4)), 'vila stays its exact still frame');
  }
});

test('reject missing provenance, mixed dealers, changed fps, guessed takes and out-of-range frames', () => {
  const changes = [
    f => { delete f.binding.avatarSha256; }, f => { f.binding.revision = 0; },
    f => { f.binding.audioSha256 = 'unknown'; }, f => { f.clips[0].dealerId = 'dragan'; },
    f => { f.clips[0].fps = 25; }, f => { f.frames[0].frame = 200; },
    f => { f.frames[0].frame = .5; }, f => { f.frames[0].take = 'pos4'; },
    f => { f.clips.push({ ...f.clips[0] }); }, f => { f.clips[1].kind = 'video'; },
    f => { f.frames[0] = null; }, f => { f.frames = Array(601).fill(f.frames[0]); },
    f => { f.frames = []; }, f => { f.fromFrame = 5; }, f => { f.fromFrame = -1; },
  ];
  for (const change of changes) {
    const input = fixture(); change(input);
    assert.throws(() => prepareMovingSpeechPlan(input), /invalid_moving_speech_plan/);
  }
});

test('wrong dealer/session/audio/voice/worker/avatar or map revision can never select a generated frame', () => {
  const plan = prepareMovingSpeechPlan(fixture());
  for (const malformed of [null, undefined, [], 'invalid']) assert.equal(plan.matchFrame(malformed), null);
  for (const key of Object.keys(plan.binding)) {
    const [packet, presented] = renderInput(plan);
    presented.binding[key] = key === 'revision' ? 2 : 'different';
    assert.equal(plan.matchFrame(packet, presented), null, key);
  }
  for (const mutate of [
    ([packet]) => { packet.id = 'old-job'; },
    ([packet]) => { packet.tag.tagning = 'pos4'; },
    ([packet]) => { packet.tag.ruta++; },
    ([, shown]) => { shown.take = 'vila'; },
    ([, shown]) => { shown.frame++; },
    ([, shown]) => { shown.sourceSha256 = sha('a'); },
    ([, shown]) => { shown.planSha256 = sha('a'); },
    ([, shown]) => { shown.speechFrame++; },
    ([packet]) => { packet.tag = null; },
  ]) {
    const args = renderInput(plan); mutate(args);
    assert.equal(plan.matchFrame(...args), null);
  }
  // The same held body frame at another audio time is not interchangeable.
  const [packet] = renderInput(plan, 1), [, shown] = renderInput(plan, 2);
  assert.equal(plan.matchFrame(packet, shown), null);
});

test('replan discards stale packets, respects the remaining-frame boundary and cancellation', () => {
  const input = fixture(), old = prepareMovingSpeechPlan(input);
  input.binding.revision++; input.fromFrame = 2;
  const current = prepareMovingSpeechPlan(input);
  assert.notEqual(current.start.id, old.start.id);
  assert.equal(current.start.fran_ruta, 2);
  assert.equal(current.matchFrame(renderInput(old, 2)[0], renderInput(current, 2)[1]), null);
  assert.equal(current.matchFrame(...renderInput(current, 1)), null);
  assert.ok(current.matchFrame(...renderInput(current, 2)));
  old.cancel(); current.cancel(); current.cancel();
  assert.equal(old.matchFrame(...renderInput(old)), null);
  assert.equal(current.matchFrame(...renderInput(current, 2)), null);
});

test('defensive snapshots bind changed media and reject invalid normalized patch rectangles', () => {
  const input = fixture(), plan = prepareMovingSpeechPlan(input);
  input.binding.dealerId = 'dragan'; input.frames[0].frame = 99; input.clips[0].sha256 = sha('a');
  assert.equal(plan.timeline[0].frame, 40);
  assert.equal(plan.binding.dealerId, 'paow');
  assert.throws(() => { plan.start.karta[0][1] = 90; }, TypeError);
  const changed = fixture(); changed.clips[0].sha256 = sha('a');
  assert.notEqual(prepareMovingSpeechPlan(changed).planSha256, plan.planSha256);
  for (const rect of [[0, 0, 0, .1], [0, 0, .1, 0], [.9, 0, .2, .1], [-.1, 0, .1, .1], [0, NaN, .1, .1], [0, 0, 1]]) {
    const [packet, shown] = renderInput(plan); packet.tag.rect = rect;
    assert.equal(plan.matchFrame(packet, shown), null);
  }
});
