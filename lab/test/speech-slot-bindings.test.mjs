import test from 'node:test';
import assert from 'node:assert/strict';
import contract from '../policies/studio-contract.json' with { type: 'json' };
import { createEmptyProject, addDealer, addVariant, validateProject, normalizeProject } from '../lib/studio-model.mjs';
import { createStudioProjectBindings } from '../lib/studio-project-bindings.mjs';
import { SPEECH_SLOT_IDS, OTHER_SPEECH_SLOT_IDS, speechSlotEventId, speechSlotVariantId, speechSlotStandard,
  bindSpeechSlotStandard, speechSlotVideoFits } from '../../web/public/speech-slot-bindings.mjs';

const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const slot = situation => ({ dealerId: 'dragan', eventId: speechSlotEventId(situation), situation });
const project = () => addDealer(createEmptyProject(), 'dragan', 'Dragan');
const recording = situation => ({ schemaVersion: 1, dealerId: 'dragan', lineId: situation, takeId: `${situation}_1`, language: 'sv', exactText: 'En testreplik.',
  videoSha256: 'a'.repeat(64), audioSha256: 'b'.repeat(64), indexSha256: 'c'.repeat(64), fps: 24, frameCount: 72, audioDelayMs: 0,
  entryPose: 'VILA', exitPose: 'VILA', calibrationRevision: 'test-v1', recording: { status: 'pending' }, review: { status: 'pending' } });
const video = (situation = 'greeting', n = 1) => ({ id: id(n), dealer: 'dragan', sha256: 'a'.repeat(64), bytes: 32,
  available: true, integrity: 'verified', contentType: 'video/mp4', classification: { ...slot(situation), kind: 'speech', role: 'standard',
    label: situation, notes: '', playback: 'once', compositing: { mode: 'opaque' }, recordedSpeech: recording(situation) } });
const rejected = error => error.code === 'invalid_speech_slot_binding';

test('all 17 exact slots round-trip in the same project rows with 14 reserved standards and four normal alternatives', () => {
  assert.equal(SPEECH_SLOT_IDS.length, 17); assert.equal(OTHER_SPEECH_SLOT_IDS.length, 14);
  for (const situation of SPEECH_SLOT_IDS) assert.ok(contract.events.find(event => event.id === speechSlotEventId(situation)).situations.includes(situation));
  const original = project(); let saved = original;
  for (const [index, situation] of SPEECH_SLOT_IDS.entries()) saved = bindSpeechSlotStandard(saved, { ...slot(situation), videoId: id(index + 1) });
  for (let index = 0; index < 4; index++) saved = addVariant(saved, 'dragan', 'speak.other');
  assert.equal(saved.lines.find(line => line.eventId === 'speak.other').variants.length, 19);
  assert.throws(() => addVariant(saved, 'dragan', 'speak.other'), /fyra/);
  assert.deepEqual(normalizeProject(JSON.parse(JSON.stringify(saved))), saved);
  for (const [index, situation] of SPEECH_SLOT_IDS.entries()) {
    assert.equal(speechSlotStandard(saved, 'dragan', speechSlotEventId(situation), situation).videoGenerationId, id(index + 1));
    assert.equal(speechSlotStandard(original, 'dragan', speechSlotEventId(situation), situation), null);
  }
  assert.equal(speechSlotVariantId('dragan', 'speak.goodluck', 'goodluck'), 'dragan.speak.goodluck.standard');
  assert.equal(speechSlotStandard(saved, 'absent', 'speak.other', 'greeting'), null);
  const detached = bindSpeechSlotStandard(saved, { ...slot('greeting'), videoId: null });
  assert.equal(speechSlotStandard(detached, 'dragan', 'speak.other', 'greeting'), null);
  assert.equal(speechSlotStandard(detached, 'dragan', 'speak.other', 'blackjack').videoGenerationId,
    speechSlotStandard(saved, 'dragan', 'speak.other', 'blackjack').videoGenerationId);
  assert.equal(speechSlotStandard(bindSpeechSlotStandard(saved, { ...slot('goodluck'), videoId: null }), 'dragan', 'speak.goodluck', 'goodluck'), null);
});

test('reserved names reject malformed mappings, duplicate IDs, reused slot UUIDs and accidental adviser eligibility', () => {
  const saved = bindSpeechSlotStandard(project(), { ...slot('greeting'), videoId: id(1) });
  assert.throws(() => bindSpeechSlotStandard(saved, { ...slot('greeting'), eventId: 'settle.win', videoId: id(2) }), rejected);
  assert.throws(() => bindSpeechSlotStandard(saved, { ...slot('greeting'), videoId: 'file.mp4' }), rejected);
  assert.throws(() => bindSpeechSlotStandard(saved, { ...slot('blackjack'), videoId: id(1) }), rejected);
  for (const edit of [
    line => line.variants.push(structuredClone(line.variants.at(-1))),
    line => { line.variants.at(-1).id = 'dragan.speak.other.slot-goodluck'; },
    line => { line.variants.at(-1).id = 'vera.speak.other.slot-greeting'; },
    line => { line.variants.at(-1).selection.random = true; },
    line => { line.variants.at(-1).triggerIds = ['missing']; },
    line => { line.variants.at(-1).videoGenerationId = null; },
  ]) {
    const broken = structuredClone(saved); edit(broken.lines.find(line => line.eventId === 'speak.other'));
    assert.throws(() => validateProject(broken));
    assert.throws(() => bindSpeechSlotStandard(broken, { ...slot('greeting'), videoId: id(2) }), rejected);
  }
  const duplicate = structuredClone(saved); duplicate.lines.push(duplicate.lines.find(line => line.eventId === 'speak.other'));
  assert.throws(() => speechSlotStandard(duplicate, 'dragan', 'speak.other', 'greeting'), rejected);
});

test('a slot binding is persisted only for its exact dealer, speech event, situation and immutable tuple', async () => {
  const draft = bindSpeechSlotStandard(project(), { ...slot('greeting'), videoId: id(1) });
  const checked = async rows => createStudioProjectBindings({ videoRegistry: async () => ({ videos: rows, families: [] }) })(draft);
  await checked([video()]);
  for (const mutate of [
    row => { row.dealer = 'vera'; }, row => { row.classification.dealerId = 'vera'; },
    row => { row.classification.eventId = 'speak.goodluck'; }, row => { row.classification.situation = 'blackjack'; },
    row => { row.available = false; }, row => { row.deletion = { state: 'pending' }; },
    row => { row.deletion = { state: 'deleted' }; }, row => { row.classification.archived = true; },
    row => { row.classification.mediaType = 'audio'; }, row => { row.sha256 = 'invalid'; },
    row => { row.classification.recordedSpeech.videoSha256 = 'b'.repeat(64); },
    row => { delete row.classification.recordedSpeech; },
  ]) {
    const wrong = video(); mutate(wrong);
    assert.equal(speechSlotVideoFits(wrong, { ...slot('greeting'), requireRecordedSpeech: true }), false);
    await assert.rejects(checked([wrong]), error => error.code === 'studio_media_binding_invalid');
  }
  await assert.rejects(checked([video(), video()]), error => error.code === 'studio_media_registry_unavailable');
});

test('dedicated speech baselines keep legacy support but cannot persist an incorrect exact situation', async () => {
  for (const situation of ['goodluck', 'insurance', 'double']) {
    const draft = bindSpeechSlotStandard(project(), { ...slot(situation), videoId: id(1) }), row = video(situation);
    delete row.classification.recordedSpeech;
    const verify = createStudioProjectBindings({ videoRegistry: async () => ({ videos: [row], families: [] }) });
    await verify(draft);
    row.classification.situation = 'greeting';
    await assert.rejects(verify(draft), error => error.code === 'studio_media_binding_invalid');
  }
});
