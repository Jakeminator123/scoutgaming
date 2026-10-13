import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedProject, createEmptyProject, addDealer } from '../lab/lib/studio-model.mjs';
import { ownDealerIdle } from '../packages/presentation/runtime/registered-idle.mjs';

const VIDEO_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';
function fixture() {
  const project = addDealer(createEmptyProject(), 'nora', 'Nora');
  const line = project.lines.find(row => row.dealerId === 'nora' && row.eventId === 'idle.ready');
  const baseline = line.variants.find(row => row.id === line.baselineVariantId);
  baseline.videoGenerationId = VIDEO_ID;
  const video = {
    id: VIDEO_ID, dealer: 'nora', fileName: 'dealer-nora.mp4', sha256: 'a'.repeat(64),
    available: true, duration: 10.041667, bytes: 1024, retainedBank: true, source: 'emil',
    classification: {
      dealerId: 'nora', eventId: 'idle.ready', kind: 'idle', role: 'standard',
      situation: '', label: 'Nora idle', notes: 'Explicit own baseline', playback: 'once',
      compositing: { mode: 'green-screen', threshold: .23, softness: .15, despill: 0 },
    },
  };
  return { project, line, baseline, video, inventory: { videos: [video], families: [] } };
}
const resolve = ({ project, inventory }) => ownDealerIdle(project, inventory, 'nora');

test('own idle is an exact detached inventory record preserving classification and retained provenance', () => {
  const input = fixture(), before = structuredClone(input);
  const result = resolve(input);
  assert.deepEqual(result, input.video);
  assert.notEqual(result, input.video);
  assert.notEqual(result.classification, input.video.classification);
  result.classification.compositing.threshold = .8;
  result.source = 'changed';
  assert.deepEqual(input, before);
});

test('ten-second baseline selection ignores timing, priority, family and alternative candidates', () => {
  const input = fixture();
  input.inventory.videos.unshift({ ...structuredClone(input.video), id: OTHER_ID, duration: .2 });
  input.line.variants.push({ ...input.baseline, id: 'nora.idle.ready.variant1', priority: 100, videoGenerationId: OTHER_ID });
  input.inventory.families.push({ id: 'astrid/idle.ready/ready', dealerId: 'astrid', eventId: 'idle.ready', standardIds: [OTHER_ID] });
  assert.equal(resolve(input).id, VIDEO_ID);
  assert.equal(resolve(input).duration, 10.041667);
  input.inventory.videos = input.inventory.videos.filter(row => row.id !== VIDEO_ID);
  assert.equal(resolve(input), null, 'another available candidate never substitutes for a missing bound ID');
});

test('the saved dealer roster authorizes access and malformed registries fail closed', () => {
  const explicit=fixture();assert.deepEqual(explicit.project.dealers,[{id:'nora',label:'Nora'}]);assert.deepEqual(resolve(explicit),explicit.video,'other historical dealers are not prerequisites');
  for (const change of [
    input => input.project.dealers = input.project.dealers.filter(row => row.id !== 'nora'),
    input => input.project.dealers.push({ id: 'nora', label: 'Duplicate' }),
    input => input.project.dealers.push({ id: '../other', label: 'Invalid' }),
    input => input.project.dealers = [],
  ]) {
    const input = fixture(); change(input); assert.equal(resolve(input), null);
  }
  assert.equal(ownDealerIdle(fixture().project, fixture().inventory, '../nora'), null);
});

test('idle line and stable unconditional baseline must exist exactly once', () => {
  for (const change of [
    input => input.project.lines = input.project.lines.filter(row => row !== input.line),
    input => input.project.lines.push(structuredClone(input.line)),
    input => input.line.eventId = 'speak.goodluck',
    input => input.line.dealerId = 'astrid',
    input => input.line.baselineVariantId = 'nora.idle.ready.variant1',
    input => input.line.variants = [],
    input => input.line.variants.push(structuredClone(input.baseline)),
    input => input.baseline.triggerIds = ['some-trigger'],
    input => delete input.baseline.triggerIds,
  ]) {
    const input = fixture(); change(input); assert.equal(resolve(input), null);
  }
});

test('the binding requires a known UUID with exactly one inventory record', () => {
  for (const value of [null, undefined, OTHER_ID, 'https://invalid.example/video.mp4', '../video', 'legacy:nora:idle']) {
    const input = fixture(); input.baseline.videoGenerationId = value; assert.equal(resolve(input), null);
  }
  const duplicate = fixture();
  duplicate.inventory.videos.push(structuredClone(duplicate.video));
  assert.equal(resolve(duplicate), null);
});

test('unavailable, corrupt and inconsistent inventory records cannot become idle playback', () => {
  for (const change of [
    input => input.video.available = false,
    input => input.video.available = 'true',
    input => delete input.video.available,
    input => input.video.sha256 = 'invalid',
    input => input.video.sha256 = 'A'.repeat(64),
    input => delete input.video.sha256,
    input => input.video.dealer = 'astrid',
    input => delete input.video.dealer,
    input => input.video.eventId = 'speak.goodluck',
    input => input.video.playbackType = 'idle-pool',
  ]) {
    const input = fixture(); change(input); assert.equal(resolve(input), null);
  }
});

test('full exact idle classification is required; speech, wrong dealer/event and looping fail closed', () => {
  for (const change of [
    input => delete input.video.classification,
    input => input.video.classification.dealerId = 'astrid',
    input => input.video.classification.eventId = 'speak.goodluck',
    input => input.video.classification.kind = 'speech',
    input => input.video.classification.playback = 'loop',
    input => input.video.classification.label = '',
    input => input.video.classification.role = 'variant',
    input => input.video.classification.situation = 'goodluck',
    input => input.video.classification.compositing.softness = 0,
    input => input.video.classification.untrustedField = true,
  ]) {
    const input = fixture(); change(input); assert.equal(resolve(input), null);
  }
});

test('schema defaults preserve opaque once playback without inventing compositing or audio evidence', () => {
  const input = fixture();
  delete input.video.classification.playback;
  delete input.video.classification.compositing;
  const result = resolve(input);
  assert.deepEqual(result, input.video);
  assert.equal(Object.hasOwn(result.classification, 'compositing'), false);
  assert.equal(Object.hasOwn(result, 'silent'), false);
  assert.equal(Object.hasOwn(result, 'hasAudio'), false);
});

test('all four existing dealers retain their exact saved bindings when this helper is queried', () => {
  const project = createSeedProject(), previous = structuredClone(project);
  for (const dealerId of ['vera', 'astrid', 'amira', 'mei']) {
    assert.equal(ownDealerIdle(project, { videos: [] }, dealerId), null);
  }
  assert.deepEqual(project, previous);
});

test('missing project, lines or inventory fails closed without throwing', () => {
  const input = fixture();
  for (const [project, inventory] of [
    [null, input.inventory], [input.project, null], [input.project, { videos: null }],
    [{ dealers: input.project.dealers }, input.inventory],
  ]) assert.equal(ownDealerIdle(project, inventory, 'nora'), null);
});
