import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegacyProject } from './fixtures/legacy-project.mjs';
import { addDealer, buildRuntimeCatalog, createSeedProject, normalizeProject, validateProject } from '../lib/studio-model.mjs';
import { clipSituationLabel } from '../lib/clip-label.mjs';
import { validateVideoMetadata, videoFitsEvent } from '../lib/video-intake.mjs';
import { transitionClipsForDealer } from '../../packages/presentation/runtime/shoe-transitions.mjs';
import { selectPresentation } from '../lib/presentation-selection.mjs';
import { prepareDecision, validateCatalog } from '../../open-claw/lab/src/engine.mjs';

const registry = { videos: [], families: [] };
const metadata = (situation, role = 'standard') => ({
  label: situation === 'to-shoe' ? 'Till skon' : 'Från skon', dealerId: 'astrid', eventId: 'transition.shoe',
  kind: 'action', role, situation, notes: '',
});

test('a saved 16-event project gains the shoe slots without dropping existing lines', () => {
  const legacy = createLegacyProject();
  assert.equal(validateProject(legacy).events.length, 16);
  const upgraded = normalizeProject(structuredClone(legacy));
  assert.equal(upgraded.events.at(-1).id, 'transition.shoe');
  assert.equal(upgraded.events.length, 17);
  assert.equal(upgraded.lines.length, legacy.lines.length + legacy.dealers.length);
  assert.equal(upgraded.lines.find(line => line.dealerId === 'astrid' && line.eventId === 'speak.goodluck').variants.length, 4);
  assert.equal(upgraded.lines.find(line => line.dealerId === 'mei' && line.eventId === 'transition.shoe').variants.length, 1);
  assert.equal(validateProject(upgraded), upgraded);
  const again = normalizeProject(structuredClone(upgraded));
  assert.deepEqual(again.events, upgraded.events);
  assert.deepEqual(again.lines, upgraded.lines);
  assert.deepEqual(again.assets, upgraded.assets);
});

test('only the optional shoe event is appended on read; a document missing a mandatory event is rejected, never repaired', () => {
  const legacy = createLegacyProject();
  const corrupt = structuredClone(legacy);
  const dropped = corrupt.events.findIndex(event => event.id === 'speak.goodluck');
  corrupt.events.splice(dropped, 1);
  corrupt.lines = corrupt.lines.filter(line => line.eventId !== 'speak.goodluck');
  assert.throws(() => normalizeProject(structuredClone(corrupt)), /events|lines/);
  assert.throws(() => validateProject(structuredClone(corrupt)), /events|lines/);
  // Same shape but with the optional slot missing too: still a corrupt document, still refused.
  assert.equal(corrupt.events.some(event => event.id === 'transition.shoe'), false);
  assert.throws(() => normalizeProject(structuredClone(corrupt)));
  // A 17-event project that lost only a mandatory event is refused as well.
  const upgraded = normalizeProject(structuredClone(legacy));
  const broken = structuredClone(upgraded);
  broken.events = broken.events.filter(event => event.id !== 'deal.dealer');
  broken.lines = broken.lines.filter(line => line.eventId !== 'deal.dealer');
  assert.throws(() => normalizeProject(broken));
});

test('the current seed, a new dealer and an archived dealer all receive the shoe line once', () => {
  const seed = createSeedProject();
  assert.equal(seed.events.length, 17);
  assert.equal(normalizeProject(seed), seed);
  const added = addDealer(seed, 'nora', 'Nora');
  assert.equal(added.lines.filter(line => line.dealerId === 'nora' && line.eventId === 'transition.shoe').length, 1);
  const stale = structuredClone(added);
  stale.events = stale.events.filter(event => event.id !== 'transition.shoe');
  stale.lines = stale.lines.filter(line => line.eventId !== 'transition.shoe');
  stale.assets = stale.assets.filter(asset => asset.id !== 'transition.shoe.standard');
  const noraLines = stale.lines.filter(line => line.dealerId === 'nora');
  stale.lines = stale.lines.filter(line => line.dealerId !== 'nora');
  stale.dealers = stale.dealers.filter(dealer => dealer.id !== 'nora');
  stale.dealerTrash = [{ schemaVersion: 1, dealer: { id: 'nora', label: 'Nora' }, lines: noraLines, idlePolicy: null, activeMediaIds: [], archivedAt: '2026-10-12T00:00:00.000Z' }];
  assert.equal(validateProject(stale).events.length, 16);
  const upgraded = normalizeProject(structuredClone(stale));
  assert.equal(upgraded.dealerTrash[0].lines.filter(line => line.eventId === 'transition.shoe').length, 1);
  assert.equal(upgraded.lines.filter(line => line.dealerId === 'astrid' && line.eventId === 'transition.shoe').length, 1);
  assert.equal(validateProject(upgraded), upgraded);
  assert.deepEqual(normalizeProject(structuredClone(upgraded)).dealerTrash[0].lines, upgraded.dealerTrash[0].lines);
});

test('shoe clips require an exact situation and never satisfy a deal or speech event', () => {
  assert.equal(clipSituationLabel('transition.shoe', 'to-shoe'), 'Till skon');
  assert.equal(clipSituationLabel('transition.shoe', 'from-shoe'), 'Från skon');
  for (const situation of ['to-shoe', 'from-shoe']) {
    const value = validateVideoMetadata(metadata(situation));
    assert.equal(value.kind, 'action');
    assert.equal(value.situation, situation);
    assert.doesNotThrow(() => validateVideoMetadata(metadata(situation, 'alternative')));
  }
  assert.throws(() => validateVideoMetadata(metadata('')), /situation|fack/i);
  assert.throws(() => validateVideoMetadata(metadata('box0')), /Situationen/);
  assert.throws(() => validateVideoMetadata({ ...metadata('to-shoe'), kind: 'speech' }), /Videotypen/);
  const project = createSeedProject();
  const clip = { classification: metadata('to-shoe') };
  assert.equal(videoFitsEvent(clip, project.events.find(event => event.id === 'deal.player.left').exampleEvent), false);
  assert.equal(videoFitsEvent(clip, project.events.find(event => event.id === 'speak.goodluck').exampleEvent), false);
  assert.equal(videoFitsEvent({ classification: metadata('from-shoe') }, project.events.find(event => event.id === 'reveal.dealer').exampleEvent), false);
});

test('the resolver returns available shoe clips and the director still ignores the slot', async () => {
  const project = createSeedProject();
  const video = (situation, patch = {}) => ({ id: situation, available: true, classification: metadata(situation), ...patch });
  const empty = transitionClipsForDealer(project, { videos: [] }, 'astrid');
  assert.deepEqual(empty, { toShoe: null, fromShoe: null });
  const toShoe = video('to-shoe');
  const fromShoe = video('from-shoe', { classification: metadata('from-shoe', 'alternative') });
  const picked = transitionClipsForDealer(project, { videos: [video('to-shoe', { available: false }), { ...toShoe, classification: { ...toShoe.classification, archived: true } }, toShoe, fromShoe, video('to-shoe', { classification: { ...metadata('to-shoe'), dealerId: 'vera' } })] }, 'astrid');
  assert.equal(picked.toShoe.id, 'to-shoe');
  assert.equal(picked.fromShoe.classification.situation, 'from-shoe');
  const catalog = buildRuntimeCatalog(project, 'astrid');
  assert.equal(validateCatalog(catalog).valid, true);
  assert.equal(catalog.events.some(event => event.id === 'transition.shoe'), false);
  assert.equal(prepareDecision(catalog, { requestId: 'shoe-audit', event: project.events.find(event => event.id === 'deal.dealer').exampleEvent, mode: 'off' }).node.id, 'deal.dealer');
  await assert.rejects(selectPresentation({ project, dealerId: 'astrid', eventId: 'transition.shoe', mode: 'off' }, { videoRegistry: registry }), /Övergångar/);
  const deal = await selectPresentation({ project, dealerId: 'astrid', eventId: 'deal.player.left', mode: 'off' }, { videoRegistry: registry });
  assert.equal(deal.variant.id, 'astrid.deal.player.left.standard');
});
