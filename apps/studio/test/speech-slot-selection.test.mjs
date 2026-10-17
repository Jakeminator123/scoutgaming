import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyProject, addDealer, addVariant, validateProject } from '../../../packages/presentation/contracts/studio-model.mjs';
import { selectPresentation, decisionCatalog } from '../lib/presentation-selection.mjs';
import { SPEECH_SLOT_IDS, speechSlotEventId, bindSpeechSlotStandard, speechSlotStandard } from '../../../packages/presentation/contracts/speech-slot-bindings.mjs';
import { recordedSpeechIdentity } from '../../../packages/presentation/contracts/recorded-speech.mjs';
import { gateRecordedSpeechSelection } from '../../../packages/presentation/runtime/recorded-speech-selection.mjs';
import { frozenPlaybackProject } from '../../../packages/presentation/contracts/frozen-dealer-playback.mjs';

const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const noFetch = () => { throw Error('Unexpected network request'); };
function fixture() {
  let project = addDealer(createEmptyProject(), 'dragan', 'Dragan');
  const videos = SPEECH_SLOT_IDS.map((situation, index) => {
    const eventId = speechSlotEventId(situation), videoId = id(index + 1);
    project = bindSpeechSlotStandard(project, { dealerId: 'dragan', eventId, situation, videoId });
    return { id: videoId, available: true, dealer: 'dragan', bytes: 64, sha256: 'a'.repeat(64), contentType: 'video/mp4',
      classification: { dealerId: 'dragan', eventId, situation, kind: 'speech', role: 'standard', label: situation, notes: '', playback: 'once',
        recordedSpeech: { schemaVersion: 1, dealerId: 'dragan', lineId: situation, takeId: `${situation}_1`, language: 'sv', exactText: 'En testreplik.',
          videoSha256: 'a'.repeat(64), audioSha256: 'b'.repeat(64), indexSha256: 'c'.repeat(64), fps: 24, frameCount: 72, audioDelayMs: 0,
          entryPose: 'VILA', exitPose: 'VILA', calibrationRevision: 'test-v1', recording: { status: 'pending' }, review: { status: 'pending' } } } };
  });
  return { project: validateProject(project), videoRegistry: { videos, families: [] } };
}
function choose(f, situation, mode, options = {}) {
  return selectPresentation({ project: f.project, dealerId: 'dragan', eventId: speechSlotEventId(situation),
    sourceEvent: { type: 'speak', line: situation }, mode, context: {} }, { videoRegistry: f.videoRegistry, settings: {}, fetchImpl: noFetch, ...options });
}

test('every exact slot resolves its saved UUID in off, shadow and unavailable adviser modes without mutating saved bindings', async () => {
  const f = fixture(), before = structuredClone(f.project);
  for (const mode of ['off', 'shadow', 'active']) for (const [index, situation] of SPEECH_SLOT_IDS.entries()) {
    const result = await choose(f, situation, mode, mode === 'active'
      ? { settings: { remoteUrl: 'https://unavailable.example.invalid', remoteToken: 'fixture-token', adviceTimeoutMs: 10 }, fetchImpl: async () => { throw Error('offline'); } } : {});
    assert.equal(result.videoGenerationId, id(index + 1), `${mode}/${situation}`);
    assert.equal(result.decision.sourceEvent.line, situation);
    assert.equal(result.variant.id, `dragan.${speechSlotEventId(situation)}.standard`);
  }
  assert.deepEqual(f.project, before);
  assert.equal(decisionCatalog(f.project, 'dragan').events.find(event => event.id === 'speak.other').variants.length, 1);
});

test('all 17 standards survive the frozen playback reader and resolve the same exact UUIDs', async () => {
  const f = fixture(), assetIds = new Set(f.project.lines.flatMap(line => line.variants.map(variant => variant.assetId)));
  const playback = { lines: f.project.lines, triggers: [], assets: f.project.assets.filter(asset => assetIds.has(asset.id)),
    media: f.videoRegistry.videos.map(video => ({ id: video.id, sha256: video.sha256, size: video.bytes, contentType: video.contentType,
      pathname: `croupier/media/dealers/dragan/review/uploads/${video.id}/${video.sha256}.mp4`, classification: video.classification })) };
  f.project = frozenPlaybackProject(JSON.parse(JSON.stringify(playback)), { registeredDealers: f.project.dealers, projectRevision: 'frozen-speech-v1' });
  for (const [index, situation] of SPEECH_SLOT_IDS.entries()) assert.equal((await choose(f, situation, 'off')).videoGenerationId, id(index + 1));
});

test('unbinding never chooses another slot, an unselected alternative, or an unbound inventory take', async () => {
  const f = fixture();
  f.project = bindSpeechSlotStandard(f.project, { dealerId: 'dragan', eventId: 'speak.other', situation: 'greeting', videoId: null });
  f.project = addVariant(f.project, 'dragan', 'speak.other');
  const line = f.project.lines.find(line => line.eventId === 'speak.other');
  line.variants.at(-1).videoGenerationId = id(1); // Exact greeting remains manual.
  for (const mode of ['off', 'rules', 'random', 'shadow', 'active']) assert.equal((await choose(f, 'greeting', mode)).videoGenerationId, null);
  // An older authored baseline still works for its exact line and no other.
  line.variants.find(variant => variant.id === line.baselineVariantId).videoGenerationId = id(1);
  assert.equal((await choose(f, 'greeting', 'off')).videoGenerationId, id(1));
  f.project = bindSpeechSlotStandard(f.project, { dealerId: 'dragan', eventId: 'speak.other', situation: 'blackjack', videoId: null });
  assert.equal((await choose(f, 'blackjack', 'off')).videoGenerationId, null);
});

test('rules only consider explicitly enabled alternatives matching the current speech line', async () => {
  const f = fixture(); f.project = addVariant(f.project, 'dragan', 'speak.other');
  const line = f.project.lines.find(line => line.eventId === 'speak.other'), alternative = line.variants.at(-1);
  alternative.videoGenerationId = id(1); alternative.selection.rules = true;
  const blackjack = speechSlotStandard(f.project, 'dragan', 'speak.other', 'blackjack');
  const result = await choose(f, 'blackjack', 'rules');
  assert.equal(result.videoGenerationId, blackjack.videoGenerationId);
  assert.ok(!result.eligible.some(variant => variant.id === alternative.id));
});

test('a new explicit slot cannot enter the legacy playback path without an exact recorded tuple', async () => {
  const f = fixture(), row = f.videoRegistry.videos[0];
  delete row.classification.recordedSpeech;
  await assert.rejects(choose(f, 'greeting', 'off'), /exakt dealer och talfack/);
  // Older authored baseline files remain readable as before; no implicit
  // promotion or metadata migration creates a newly approved recording.
  f.project = bindSpeechSlotStandard(f.project, { dealerId: 'dragan', eventId: 'speak.other', situation: 'greeting', videoId: null });
  const line = f.project.lines.find(line => line.eventId === 'speak.other');
  line.variants.find(variant => variant.id === line.baselineVariantId).videoGenerationId = row.id;
  assert.equal((await choose(f, 'greeting', 'off')).videoGenerationId, row.id);
});

test('saving an exact standard grants no recording/review/hash approval and approved playback still uses the saved tuple', async () => {
  const f = fixture(), row = f.videoRegistry.videos[0];
  const tuple = { schemaVersion: 1, dealerId: 'dragan', lineId: 'greeting', takeId: 'greeting_1', language: 'sv',
    exactText: 'Välkommen till bordet.', videoSha256: row.sha256, audioSha256: 'b'.repeat(64), indexSha256: 'c'.repeat(64),
    fps: 24, frameCount: 72, audioDelayMs: 0, entryPose: 'VILA', exitPose: 'VILA', calibrationRevision: 'fixture-v1',
    recording: { status: 'pending' }, review: { status: 'pending' } };
  row.classification.recordedSpeech = tuple;
  const context = { project: f.project, dealerId: 'dragan', eventId: 'speak.other', sourceEvent: { type: 'speak', line: 'greeting' } };
  const result = await choose(f, 'greeting', 'off'); assert.equal(result.videoGenerationId, row.id);
  assert.equal(gateRecordedSpeechSelection({ video: row, standard: row }, context).blocked, true);
  const proof = status => ({ status, by: 'isolated-test', at: '2026-10-14T00:00:00.000Z', identity: recordedSpeechIdentity(tuple) });
  tuple.recording = proof('verified-recording');
  assert.equal(gateRecordedSpeechSelection({ video: row, standard: row }, context).blocked, true);
  tuple.review = proof('rejected');
  assert.equal(gateRecordedSpeechSelection({ video: row, standard: row }, { ...context, preview: true }).blocked, true);
  tuple.review = proof('approved');
  assert.equal(gateRecordedSpeechSelection({ video: row, standard: row }, context).blocked, false);
  row.sha256 = 'd'.repeat(64);
  await assert.rejects(choose(f, 'greeting', 'off'), /exakt dealer och talfack/);
  assert.equal(gateRecordedSpeechSelection({ video: row, standard: row }, context).blocked, true);
});
