import test from 'node:test';
import { syntheticJpeg } from './fixtures/synthetic-jpeg.mjs';
import assert from 'node:assert/strict';
import { createAstridCameraSession } from '../services/game/public/astrid-camera-session.mjs';
import { normalizeAstridObservation } from '../packages/director/astrid-observation.mjs';

function trace(samples, stopAt = null) {
  let now = 0, captures = 0, ended;
  const session = createAstridCameraSession({ clock: () => now, capture: () => `frame-${++captures}`, onEnd: result => { ended = result; } });
  for (const [time, speech] of samples) { now = time; session.sample(speech); }
  if (stopAt !== null) { now = stopAt; ended = session.stop(); }
  return { session, ended, captures };
}

test('VAD captures no frame for silence and only an ending frame for short speech', () => {
  const silence = trace([[0, false], [1000, false], [5000, false]], 5000);
  assert.deepEqual(silence.ended.images, []);
  const short = trace([[0, true], [100, true], [800, true], [1200, false], [1900, false]]);
  assert.deepEqual(short.ended.images, ['frame-1']);
  assert.equal(short.ended.reason, 'speech_end');
});

test('VAD accumulates speech through pauses and never exceeds two frames', () => {
  const events = [[0, true]];
  for (let time = 100; time <= 1700; time += 100) events.push([time, true]);
  for (let time = 1800; time <= 2100; time += 100) events.push([time, false]);
  for (let time = 2200; time <= 4000; time += 100) events.push([time, true]);
  const result = trace(events, 4100);
  assert.equal(result.captures, 2);
  assert.deepEqual(result.ended.images, ['frame-1', 'frame-2']);
  result.session.sample(true, 6000);
  assert.equal(result.captures, 2, 'late VAD callback cannot capture a third frame');
});

test('early stop captures the final frame and is idempotent', () => {
  const result = trace([[0, true], [100, true]], 200);
  assert.deepEqual(result.ended.images, ['frame-1']);
  result.session.stop();
  assert.equal(result.captures, 1);
});

const url = (width, height) => `data:image/jpeg;base64,${syntheticJpeg(width, height).toString('base64')}`;
const profileRevision = 'a'.repeat(64);
const valid = (images = [url(1, 1)]) => ({ version: 1, turnId: 'turn-1', consentTurnId: 'turn-1', profileRevision, images });

test('image contract binds one turn, selected dealer, consent, MIME, bytes and dimensions', () => {
  assert.deepEqual(normalizeAstridObservation(valid(), 'turn-1').images, [url(1, 1)]);
  for (const observation of [
    valid([url(1, 1), url(1, 1), url(1, 1)]),
    { ...valid(), consentTurnId: 'another-turn' },
    valid(['https://example.invalid/image.jpg']),
    valid([url(385, 1)]),
    valid([url(1, 1).replace('image/jpeg', 'image/png')]),
    valid([`data:image/jpeg;base64,${Buffer.alloc(65537).toString('base64')}`]),
  ]) assert.throws(() => normalizeAstridObservation(observation, 'turn-1'));
  assert.throws(() => normalizeAstridObservation(valid(), 'turn-2'));
  for(const dealer of ['vera','amira','mei','paow','dragge']) assert.deepEqual(normalizeAstridObservation(valid(), 'turn-1', dealer).images,[url(1,1)]);
  for(const dealer of ['', '../astrid', 'Invalid Dealer']) assert.throws(() => normalizeAstridObservation(valid(), 'turn-1', dealer));
  assert.throws(() => normalizeAstridObservation(valid(), 'turn-1', 'astrid', 'b'.repeat(64)));
});
