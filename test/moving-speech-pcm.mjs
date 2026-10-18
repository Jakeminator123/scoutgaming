import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareMovingSpeechPcmInput } from '../services/game/moving-speech-pcm.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function fixture(dealerId = 'paow', workerAvatar = dealerId) {
  const pcm = Buffer.alloc(48000);
  for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 20) * 2000), i * 2);
  return {
    binding: { dealerId, workerAvatar, sessionId: 'session-1', talkId: 'reply-1', revision: 1,
      profileRevision: hash('profile'), textSha256: hash('text'), audioSha256: hash(pcm), avatarSha256: hash('avatar') },
    clips: [{ dealerId, take: 'vila', kind: 'still', sha256: hash('vila'), fps: 24, frameCount: 1 }],
    frames: Array.from({ length: 30 }, () => ({ take: 'vila', frame: 0 })),
    audio: { pcm, sampleRate: 24000, channels: 1, format: 's16le' },
  };
}
function frameMatches(input) {
  const p = input.plan, f = p.timeline[0];
  return p.matchFrame({ id: p.start.id, speechFrame: 0, tag: { tagning: f.take, ruta: f.frame, rect: [0, 0, .2, .2] } },
    { binding: p.binding, planSha256: p.planSha256, speechFrame: 0, take: f.take, frame: f.frame, sourceSha256: f.sourceSha256 });
}

test('Paow and Dragan send the hash-bound playback PCM between exactly one start/end pair', () => {
  for (const [dealer, avatar] of [['paow', 'paow'], ['dragan', 'dragge']]) {
    const f = fixture(dealer, avatar), input = prepareMovingSpeechPcmInput(f), messages = [...input.messages()];
    assert.deepEqual(JSON.parse(messages[0]), input.plan.start);
    assert.equal(input.plan.binding.workerAvatar, avatar);
    assert.deepEqual(JSON.parse(messages.at(-1)), input.plan.end);
    const chunks = messages.slice(1, -1);
    assert.ok(chunks.every(b => Buffer.isBuffer(b) && b.length <= 32768 && b.length % 2 === 0));
    assert.equal(hash(Buffer.concat(chunks)), f.binding.audioSha256);
    assert.deepEqual(Buffer.concat(chunks), input.playbackPcm());
    assert.equal(input.durationMs, 1000);
    assert.ok(frameMatches(input), 'end completes input without cancelling the generated output');
    assert.throws(() => [...input.messages()], /already_consumed/);
  }
});

test('caller and transport mutations cannot change the immutable PCM or plan', () => {
  const f = fixture(), expected = Buffer.from(f.audio.pcm), input = prepareMovingSpeechPcmInput(f);
  f.audio.pcm.fill(9); f.binding.audioSha256 = hash('changed'); f.frames[0].frame = 99;
  input.playbackPcm().fill(8);
  const chunks = [...input.messages()].slice(1, -1);
  chunks[0].fill(7);
  assert.deepEqual(input.playbackPcm(), expected);
  assert.equal(input.plan.timeline[0].frame, 0);
});

test('wrong PCM identity, unsupported format, empty/odd/oversized audio fail before any transfer', () => {
  const wrong = fixture(); wrong.audio.pcm[0] ^= 1;
  assert.throws(() => prepareMovingSpeechPcmInput(wrong), /hash_mismatch/);
  for (const patch of [{ sampleRate: 22050 }, { channels: 2 }, { format: 'wav' },
    { pcm: Buffer.alloc(0) }, { pcm: Buffer.alloc(3) }, { pcm: Buffer.alloc(1200002) }]) {
    const f = fixture(); Object.assign(f.audio, patch);
    assert.throws(() => prepareMovingSpeechPcmInput(f), /invalid_moving_speech_pcm/);
  }
});

test('the map must cover audio plus leading silence, with exact sample boundaries', () => {
  const f = fixture(); f.frames = f.frames.slice(0, 24);
  assert.throws(() => prepareMovingSpeechPcmInput(f), /exceeds_plan/);
  f.audio.pcm = Buffer.alloc((24000 - 5280) * 2); f.binding.audioSha256 = hash(f.audio.pcm);
  assert.equal(prepareMovingSpeechPcmInput(f).durationMs, 780);
  f.audio.pcm = Buffer.concat([f.audio.pcm, Buffer.alloc(2)]); f.binding.audioSha256 = hash(f.audio.pcm);
  assert.throws(() => prepareMovingSpeechPcmInput(f), /exceeds_plan/);
});

test('replanning preserves full PCM while binding output to the new map and revision', () => {
  const first = fixture(), old = prepareMovingSpeechPcmInput(first);
  const next = fixture(); next.fromFrame = 12; next.binding.revision = 2;
  const input = prepareMovingSpeechPcmInput(next), messages = [...input.messages()];
  old.cancel();
  assert.notEqual(input.plan.start.id, old.plan.start.id);
  assert.equal(JSON.parse(messages[0]).fran_ruta, 12);
  assert.deepEqual(Buffer.concat(messages.slice(1, -1)), next.audio.pcm);
  assert.equal(frameMatches(old), null);
});

test('an aborted signal stops remaining PCM/end and invalidates the old plan immediately', () => {
  const input = prepareMovingSpeechPcmInput(fixture()), c = new AbortController();
  const iterator = input.messages({ signal: c.signal });
  assert.equal(JSON.parse(iterator.next().value).t, 'start');
  assert.ok(Buffer.isBuffer(iterator.next().value));
  c.abort();
  assert.equal(frameMatches(input), null);
  assert.throws(() => iterator.next(), /cancelled/);
  assert.throws(() => input.playbackPcm(), /cancelled/);
});

test('pre-abort, explicit plan cancel and transport early-return cannot complete an input', () => {
  const c = new AbortController(); c.abort();
  const pre = prepareMovingSpeechPcmInput(fixture());
  assert.throws(() => pre.messages({ signal: c.signal }).next(), /cancelled/);
  const explicit = prepareMovingSpeechPcmInput(fixture()), ei = explicit.messages();
  ei.next(); explicit.plan.cancel();
  assert.throws(() => ei.next(), /cancelled/);
  const returned = prepareMovingSpeechPcmInput(fixture()), ri = returned.messages();
  ri.next(); ri.return();
  assert.equal(frameMatches(returned), null);
  assert.throws(() => returned.playbackPcm(), /cancelled/);
});

test('stopping one dealer cannot invalidate another dealer transfer', () => {
  const paow = prepareMovingSpeechPcmInput(fixture()), dragge = prepareMovingSpeechPcmInput(fixture('dragan', 'dragge'));
  const pending = paow.messages(); pending.next(); paow.cancel();
  assert.throws(() => pending.next(), /cancelled/);
  assert.ok([...dragge.messages()].length > 2);
  assert.ok(frameMatches(dragge));
});
