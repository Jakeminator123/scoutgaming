import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MOTION_CLIPS, MOTION_INDEX, MOTION_TARGETS, getMotionClip, validateMotionClip } from '../lib/motion-library.mjs';
import { motionKeyframes, playMotion } from '../lib/motion-player.mjs';

const sourceClip = () => structuredClone(MOTION_CLIPS[0]);
function rig({ failAt } = {}) {
  const calls = [];
  const targets = Object.fromEntries(MOTION_TARGETS.map(target => [target, {
    animate(frames, options) {
      if (target === failAt) throw new Error('Unsupported test target');
      const handle = { onfinish: null, cancellations: 0, cancel() { this.cancellations++; } };
      calls.push({ target, frames, options, handle });
      return handle;
    },
  }]));
  return { calls, targets };
}

test('registry has 16 canonical lab events and exactly 4 finite clips per event', async () => {
  const seed = JSON.parse(await readFile(new URL('../policies/project.seed.json', import.meta.url), 'utf8'));
  assert.equal(MOTION_INDEX.synthetic, true);
  assert.equal(MOTION_INDEX.rig, 'astrid-2d-v1');
  assert.equal(MOTION_CLIPS.length, 64);
  assert.deepEqual([...new Set(MOTION_CLIPS.map(clip => clip.eventId))], seed.events.map(event => event.id));
  for (const event of seed.events) {
    assert.deepEqual(MOTION_CLIPS.filter(clip => clip.eventId === event.id).map(clip => clip.assetId), ['standard', 'contextual', 'motion3', 'motion4'].map(slot => `${event.id}.${slot}`));
  }
  for (const asset of seed.assets) assert.ok(getMotionClip(asset.id), `missing ${asset.id}`);
  assert.equal(getMotionClip('unknown'), undefined);
});

test('manifest lists exactly the source event files loaded in the registry', async () => {
  const fromFiles = [];
  for (const file of MOTION_INDEX.eventFiles) {
    const data = JSON.parse(await readFile(new URL(`../animations/${file}`, import.meta.url), 'utf8'));
    assert.equal(data.schemaVersion, 1);
    assert.equal(data.clips.length, 4);
    fromFiles.push(...data.clips);
  }
  assert.deepEqual(fromFiles, MOTION_CLIPS);
});

test('all clips validate, are immutable, return to neutral and have distinct pose sequences', () => {
  const silhouettes = new Set();
  for (const clip of MOTION_CLIPS) {
    assert.equal(validateMotionClip(clip), clip);
    assert.ok(Object.isFrozen(clip.tracks[0].frames[0]));
    const posesOnly = clip.tracks.map(track => ({ target: track.target, frames: track.frames.map(({ at, ...pose }) => pose) }));
    silhouettes.add(JSON.stringify(posesOnly));
    for (const track of clip.tracks) {
      const { at: firstAt, ...first } = track.frames[0];
      const { at: lastAt, ...last } = track.frames.at(-1);
      assert.equal(firstAt, 0);
      assert.equal(lastAt, 1);
      assert.deepEqual(first, last);
    }
  }
  assert.equal(silhouettes.size, 64, 'timing alone is not a distinct gesture');
});

test('validator rejects code/selectors, extra CSS fields, duplicate targets and malformed timing', () => {
  for (const alter of [
    clip => { clip.selector = 'body'; },
    clip => { clip.tracks[0].target = '__proto__'; },
    clip => { clip.tracks[0].frames[1].transform = 'url(https://example.invalid)'; },
    clip => { clip.tracks[1].target = clip.tracks[0].target; },
    clip => { clip.tracks[0].frames[1].at = 0; },
    clip => { clip.tracks[0].frames[2].x = Infinity; },
    clip => { clip.tracks[0].frames[0].rotate = 3; },
    clip => { clip.tracks[0].frames.at(-1).x = 3; },
    clip => { clip.tracks[2].frames[1].rotate = 900; },
    clip => { clip.durationMs = 0; },
    clip => { clip.durationMs = Infinity; },
    clip => { clip.tracks = []; },
  ]) {
    const clip = sourceClip(); alter(clip); assert.throws(() => validateMotionClip(clip), /Invalid lab motion/);
  }
});

test('player emits bounded numeric keyframes and one iteration, without persistent style writes', () => {
  const { calls, targets } = rig();
  const playback = playMotion(MOTION_CLIPS[0], targets, { durationMs: 1800 });
  assert.equal(playback.status, 'playing');
  assert.equal(calls.length, 5);
  for (const call of calls) {
    assert.equal(call.options.duration, 1800);
    assert.equal(call.options.iterations, 1);
    assert.equal(call.options.fill, 'none');
    assert.equal(call.frames[0].offset, 0);
    assert.equal(call.frames.at(-1).offset, 1);
    assert.deepEqual(call.frames, motionKeyframes(MOTION_CLIPS[0].tracks.find(track => track.target === call.target)));
    call.handle.onfinish();
  }
  assert.equal(playback.status, 'finished');
});

test('replay cancels the previous owner and cancellation is idempotent', () => {
  const { calls, targets } = rig();
  const first = playMotion(MOTION_CLIPS[0], targets);
  const second = playMotion(MOTION_CLIPS[1], targets);
  assert.equal(first.status, 'cancelled');
  assert.ok(calls.slice(0, 5).every(call => call.handle.cancellations === 1 && call.handle.onfinish === null));
  second.cancel(); second.cancel(); first.cancel();
  assert.ok(calls.every(call => call.handle.cancellations === 1));
});

test('reduced-motion cancels an old clip and creates no new animation', () => {
  const { calls, targets } = rig();
  const first = playMotion(MOTION_CLIPS[0], targets);
  const reduced = playMotion(MOTION_CLIPS[1], targets, { reducedMotion: true });
  assert.equal(first.status, 'cancelled');
  assert.equal(reduced.status, 'reduced-motion');
  assert.equal(calls.length, 5);
  assert.ok(calls.every(call => call.handle.cancellations === 1));
});

test('missing browser support and partial failures clean up rather than leaving half a pose', () => {
  const missing = rig();
  missing.targets.rightArm = null;
  assert.equal(playMotion(MOTION_CLIPS[0], missing.targets).status, 'unsupported');
  assert.equal(missing.calls.length, 0);
  const failing = rig({ failAt: 'leftArm' });
  assert.equal(playMotion(MOTION_CLIPS[0], failing.targets).status, 'unsupported');
  assert.equal(failing.calls.length, 2);
  assert.ok(failing.calls.every(call => call.handle.cancellations === 1));
  assert.throws(() => playMotion(MOTION_CLIPS[0], missing.targets, { durationMs: NaN }), /Invalid motion duration/);
});

test('Stage keeps exact videos separate and owns cleanup for selection, replay and reduced motion', async () => {
  const source = await readFile(new URL('../components/stage.tsx', import.meta.url), 'utf8');
  assert.match(source, /getMotionClip\(asset\?\.id\)/);
  assert.match(source, /preference\.removeEventListener\('change', reduce\); playback\.cancel\(\)/);
  assert.match(source, /\[clip, durationMs, event\.id, dealer, hasResult, playId, showVideo\]/);
  assert.match(source, /src=\{videoUrl\} controls autoPlay muted playsInline/);
  assert.doesNotMatch(source, /<video[^>]*\bloop\b/);
  assert.match(source, /Tyst 2D-exempel/);
});
