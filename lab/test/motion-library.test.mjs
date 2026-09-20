import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MOTION_CLIPS, SOCIAL_MOTION_CLIPS, MOTION_INDEX, MOTION_TARGETS, getMotionClip, validateMotionClip, motionAllowedForSource, stageBaseAnimation } from '../lib/motion-library.mjs';
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
  assert.match(source, /\[clip, durationMs, event\.id, dealer, shouldAnimate, playId, showVideo\]/);
  assert.match(source, /const shouldAnimate = hasResult \|\| previewing/);
  assert.match(source, /Förhandsvisa vald variant/);
  assert.match(source, /onClick=\{onPreview\}/);
  assert.match(source, /onClick=\{onPlay\}/);
  assert.match(source, /onEnded=\{onPlaybackEnd\}/);
  assert.match(source, /src=\{videoUrl\} controls autoPlay muted playsInline/);
  assert.doesNotMatch(source, /<video[^>]*\bloop\b/);
  assert.match(source, /Tyst 2D-exempel/);
});

test('social.ledsen is separate from all 64 game clips and saved project bindings', async () => {
  const social = getMotionClip('social.ledsen');
  const seed = JSON.parse(await readFile(new URL('../policies/project.seed.json', import.meta.url), 'utf8'));
  assert.equal(validateMotionClip(social), social);
  assert.equal(social.scope, 'social-lab');
  assert.equal(social.reactionId, 'ledsen');
  assert.equal(social.eventId, undefined);
  assert.equal(social.durationMs, 4200);
  assert.equal(MOTION_CLIPS.length, 64);
  assert.ok(!MOTION_CLIPS.includes(social));
  assert.deepEqual(SOCIAL_MOTION_CLIPS, [social]);
  assert.equal(MOTION_INDEX.socialClipCount, 1);
  assert.ok(!seed.assets.some(asset => asset.id === social.assetId));
  assert.ok(!seed.events.some(event => event.id.startsWith('social.')));
  const source = JSON.parse(await readFile(new URL(`../animations/${MOTION_INDEX.socialFiles[0]}`, import.meta.url), 'utf8'));
  assert.deepEqual(source.clips, SOCIAL_MOTION_CLIPS);
});

test('sad expression precedes two face-covering hands and every social track returns neutral', () => {
  const social = getMotionClip('social.ledsen');
  const sad = social.tracks.find(track => track.target === 'sadFace').frames;
  const hands = social.tracks.find(track => track.target === 'coverHands').frames;
  assert.ok(sad.find(frame => frame.opacity === 1).at < hands.find(frame => frame.opacity === 1).at);
  assert.ok(hands.some(frame => frame.opacity === 1 && frame.y === 0));
  for (const target of ['leftArm', 'rightArm']) {
    const frames = social.tracks.find(track => track.target === target).frames;
    assert.ok(frames.some(frame => frame.opacity === 0), 'Straight arms fade while bent arms cover the face; not four visible hands.');
    assert.equal(frames[0].opacity, 1); assert.equal(frames.at(-1).opacity, 1);
  }
  for (const track of social.tracks) {
    const { at: firstAt, ...first } = track.frames[0];
    const { at: lastAt, ...last } = track.frames.at(-1);
    assert.equal(firstAt, 0); assert.equal(lastAt, 1); assert.deepEqual(first, last);
  }
});

test('social motions cannot replace deal/reveal or other presentation facts', () => {
  const social = getMotionClip('social.ledsen');
  assert.equal(motionAllowedForSource(social, 'idle'), true);
  for (const sourceType of ['deal', 'reveal', 'speak', 'turn', 'settle']) assert.equal(motionAllowedForSource(social, sourceType), false);
  for (const direction of ['left', 'centre', 'right']) {
    const event = { id: `deal.player.${direction}`, sourceType: 'deal', exampleEvent: { clip: { action: `deal-${direction}` } } };
    assert.equal(stageBaseAnimation(event, 'idle'), `deal-${direction}`);
    assert.equal(stageBaseAnimation(event, 'celebrate'), `deal-${direction}`);
  }
  assert.equal(stageBaseAnimation({ id: 'reveal.dealer', sourceType: 'reveal', exampleEvent: {} }, 'idle'), 'reveal');
});

test('right-deal examples differ in broad gesture, not merely timing or card destination', () => {
  const clips = ['standard', 'contextual', 'motion3', 'motion4'].map(slot => getMotionClip(`deal.player.right.${slot}`));
  const minArm = clip => Math.min(...clip.tracks.find(track => track.target === 'rightArm').frames.map(frame => frame.rotate));
  assert.ok(minArm(clips[0]) < minArm(clips[1]) - 20, 'Calm is visibly lower than standard.');
  assert.ok(minArm(clips[3]) < minArm(clips[0]) - 20, 'Playful uses a visibly broader gesture.');
  assert.ok(clips[2].tracks.find(track => track.target === 'blush').frames.some(frame => frame.opacity >= .85));
  assert.ok(clips[3].tracks.find(track => track.target === 'leftArm').frames.some(frame => frame.rotate >= 75));
});

test('motion completion fires once; cancellation and reduced motion are bounded', async () => {
  const clip = getMotionClip('social.ledsen');
  const first = rig(); let completed = 0;
  const playback = playMotion(clip, first.targets, { onFinish: () => completed++ });
  const last = first.calls.at(-1).handle.onfinish;
  first.calls.forEach(call => call.handle.onfinish()); last();
  assert.equal(completed, 1); assert.equal(playback.status, 'finished');
  const second = rig();
  const cancelled = playMotion(clip, second.targets, { onFinish: () => completed++ });
  const stale = second.calls.map(call => call.handle.onfinish);
  cancelled.cancel(); stale.forEach(callback => callback());
  assert.equal(completed, 1);
  const reduced = rig();
  playMotion(clip, reduced.targets, { reducedMotion: true, onFinish: () => completed++ });
  await Promise.resolve();
  assert.equal(completed, 2); assert.equal(reduced.calls.length, 0);
  const abandoned = playMotion(clip, reduced.targets, { reducedMotion: true, onFinish: () => completed++ });
  abandoned.cancel(); await Promise.resolve();
  assert.equal(completed, 2);
});
