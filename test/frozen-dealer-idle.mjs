import test from 'node:test';
import assert from 'node:assert/strict';
import { addDealer, createSeedProject } from '../lab/lib/studio-model.mjs';
import { BASE_DEALER_IDS } from '../web/dealer-identity.mjs';
import { buildPresentationPackage } from '../web/presentation-layers.mjs';
import { encodePresentationPackage, decodePresentationPackage } from '../web/storage/presentation-package.mjs';
import {
  captureFrozenRegisteredDealers, validateFrozenRegisteredDealers,
  resolveFrozenDealerIdle, assertFrozenMediaPreconditions,
} from '../web/storage/frozen-dealer-idle.mjs';

const JOHANNA_ID = '00000000-0000-4000-8000-000000000001';
const NORA_ID = '00000000-0000-4000-8000-000000000002';
const NEW_ID = '00000000-0000-4000-8000-000000000003';
const sameSourceHash = 'a'.repeat(64);
function media(dealerId, id, sha256 = sameSourceHash) {
  return { id, sha256, size: 4096, contentType: 'video/mp4',
    pathname: `croupier/media/dealers/${dealerId}/review/uploads/${id}/${sha256}.mp4`,
    classification: { dealerId, eventId: 'idle.ready', kind: 'idle', role: 'standard',
      situation: '', label: dealerId === 'johanna' ? 'Johannas grundloop' : 'Noras grundloop', notes: '', playback: 'once',
      compositing: { mode: 'green-screen', threshold: .23, softness: .15, despill: 0 } } };
}
function video(record) {
  return { id: record.id, dealer: record.classification.dealerId, sha256: record.sha256, bytes: record.size,
    classification: structuredClone(record.classification), available: true, integrity: 'verified', fileName: 'dealer-nora.mp4' };
}
function fixture() {
  const project = addDealer(addDealer(createSeedProject(), 'nora', 'Nora'), 'johanna', 'Johanna');
  const johanna = media('johanna', JOHANNA_ID), nora = media('nora', NORA_ID);
  for (const [dealerId, id] of [['johanna', JOHANNA_ID], ['nora', NORA_ID]]) {
    const line = project.lines.find(row => row.dealerId === dealerId && row.eventId === 'idle.ready');
    line.variants.find(row => row.id === line.baselineVariantId).videoGenerationId = id;
  }
  const lane = project.lanes[0]; lane.id = 'johns-johanna'; lane.label = 'Johns Johanna';
  lane.dealers = ['johanna']; lane.layers.dealer = { enabled: true, default: 'johanna', allowed: ['johanna'] };
  return { project, selectedLaneIds: [lane.id], inventory: { videos: [video(johanna), video(nora)], families: [] },
    mediaRows: [{ ...johanna, revision: 'media-johanna-1', updatedAt: '2026-10-09T00:00:00.000Z' },
      { ...nora, revision: 'media-nora-1', updatedAt: '2026-10-09T00:00:00.000Z' }], requiredIdleDealerIds: ['johanna'] };
}
const resolve = entries => resolveFrozenDealerIdle(entries, { dealerId: 'johanna', allowedDealerIds: ['johanna'] });
const code = (expected, status = 422) => error => error.code === expected && error.statusCode === status;

test('Johanna captures her own UUID/path with unchanged Nora source bytes and no borrowed metadata', () => {
  const input = fixture(), before = structuredClone(input), result = captureFrozenRegisteredDealers(input);
  assert.equal(result.registeredDealers.length, 1);
  const johanna = result.registeredDealers[0];
  assert.deepEqual(Object.keys(johanna).sort(), ['id', 'idle', 'label']);
  assert.equal(johanna.id, 'johanna'); assert.equal(johanna.label, 'Johanna');
  assert.equal(johanna.idle.id, JOHANNA_ID); assert.equal(johanna.idle.sha256, sameSourceHash);
  assert.equal(input.mediaRows[1].sha256, johanna.idle.sha256); assert.notEqual(input.mediaRows[1].id, johanna.idle.id);
  assert.match(johanna.idle.pathname, /dealers\/johanna\/review\/uploads/);
  assert.equal(johanna.idle.classification.dealerId, 'johanna');
  assert.deepEqual(result.mediaPreconditions, [{ id: JOHANNA_ID, revision: 'media-johanna-1', record: johanna.idle }]);
  assert.equal(Object.hasOwn(johanna.idle, 'revision'), false); assert.equal(Object.hasOwn(johanna.idle, 'updatedAt'), false);
  assert.deepEqual(input, before);
});
test('a published capture survives later Studio idle replacement, metadata edits and inventory changes', () => {
  const input = fixture(), published = captureFrozenRegisteredDealers(input);
  const replacement = media('johanna', NEW_ID, 'b'.repeat(64));
  input.project.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'idle.ready').variants[0].videoGenerationId = NEW_ID;
  input.inventory.videos[0] = video(replacement); input.mediaRows[0] = { ...replacement, revision: 'media-johanna-2' };
  input.project.dealers.find(row => row.id === 'johanna').label = 'Ny etikett';
  const decoded = JSON.parse(JSON.stringify(published.registeredDealers));
  const idle = resolve(decoded);
  assert.equal(idle.id, JOHANNA_ID); assert.equal(idle.sha256, sameSourceHash); assert.equal(idle.classification.compositing.threshold, .23);
  assert.equal(decoded[0].label, 'Johanna');
  const newCapture = captureFrozenRegisteredDealers(input);
  assert.equal(newCapture.registeredDealers[0].idle.id, NEW_ID);
});
test('captured records, shader metadata and preconditions are detached and recursively frozen', () => {
  const input = fixture(), result = captureFrozenRegisteredDealers(input);
  assert.notEqual(result.registeredDealers[0].idle.classification, input.mediaRows[0].classification);
  assert.throws(() => result.registeredDealers[0].idle.classification.compositing.threshold = .8, TypeError);
  assert.throws(() => result.mediaPreconditions[0].revision = 'changed', TypeError);
  assert.throws(() => result.registeredDealers.push({ id: 'foreign' }), TypeError);
});
test('the existing selected Grundloop accepts alternative intake role and default once playback', () => {
  for (const omitPlayback of [false, true]) {
    const input = fixture();
    for (const metadata of [input.mediaRows[0].classification, input.inventory.videos[0].classification]) {
      metadata.role = 'alternative'; if (omitPlayback) delete metadata.playback;
    }
    const result = captureFrozenRegisteredDealers(input), idle = resolve(result.registeredDealers);
    assert.equal(idle.id, JOHANNA_ID); assert.equal(idle.classification.role, 'alternative');
    assert.equal(Object.hasOwn(idle.classification, 'playback'), !omitPlayback, 'no default field is fabricated in the stored record');
  }
});
test('missing optional idle remains null; a new room requires its selected own idle before any write', () => {
  for (const mutate of [
    input => input.project.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'idle.ready').variants[0].videoGenerationId = null,
    input => input.inventory.videos[0].available = false,
    input => input.inventory.videos = input.inventory.videos.filter(row => row.id !== JOHANNA_ID),
  ]) {
    const input = fixture(); mutate(input); input.requiredIdleDealerIds = [];
    const result = captureFrozenRegisteredDealers(input);
    assert.deepEqual(result.registeredDealers, [{ id: 'johanna', label: 'Johanna', idle: null }]); assert.deepEqual(result.mediaPreconditions, []);
    assert.equal(resolve(result.registeredDealers), null);
    input.requiredIdleDealerIds = ['johanna']; assert.throws(() => captureFrozenRegisteredDealers(input), code('studio_dealer_idle_required'));
  }
});
test('every exact card slot may remain empty while the selected dealer idle is frozen', () => {
  const input = fixture();
  assert.equal(input.project.lines.filter(row => row.dealerId === 'johanna' && row.eventId.startsWith('deal.')).every(row => row.variants.every(v => v.videoGenerationId === null)), true);
  const result = captureFrozenRegisteredDealers(input);
  assert.equal(resolve(result.registeredDealers).id, JOHANNA_ID);
});
test('no timing, higher-priority variant, other family or Nora baseline can substitute for missing Johanna idle', () => {
  const input = fixture(), line = input.project.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'idle.ready');
  line.variants[0].videoGenerationId = null;
  line.variants.push({ ...structuredClone(line.variants[0]), id: 'johanna.idle.ready.variant1', priority: 100, videoGenerationId: JOHANNA_ID });
  input.inventory.videos[0].duration = .01; input.inventory.videos[1].duration = .01;
  input.inventory.families.push({ id: 'borrowed', dealerId: 'johanna', eventId: 'idle.ready', standardIds: [NORA_ID] });
  assert.throws(() => captureFrozenRegisteredDealers(input), code('studio_dealer_idle_required'));
  line.variants[0].videoGenerationId = NORA_ID;
  assert.throws(() => captureFrozenRegisteredDealers(input), code('studio_dealer_idle_required'));
});
test('inventory and captured SQL records must describe the same exact media snapshot', () => {
  for (const mutate of [
    input => input.mediaRows.shift(),
    input => input.inventory.videos[0].sha256 = 'b'.repeat(64),
    input => input.inventory.videos[0].bytes++,
    input => input.inventory.videos[0].classification.compositing.threshold = .6,
    input => input.inventory.videos[0].classification.label = 'Other metadata',
    input => input.inventory.videos[0].integrity = 'unavailable',
  ]) {
    const input = fixture(); mutate(input);
    assert.throws(() => captureFrozenRegisteredDealers(input), code('studio_media_binding_invalid'));
  }
});
test('an unavailable registry, duplicate identity or malformed SQL record cannot silently freeze an empty idle', () => {
  for (const mutate of [
    input => input.inventory.summary = { readable: false },
    input => input.inventory.summary = { snapshotReadable: false },
    input => input.inventory.videos.push(structuredClone(input.inventory.videos[0])),
    input => input.mediaRows.push(structuredClone(input.mediaRows[0])),
    input => input.mediaRows[0].pathname = input.mediaRows[1].pathname,
    input => input.mediaRows[0].revision = '',
  ]) {
    const input = fixture(); input.requiredIdleDealerIds = []; mutate(input);
    assert.throws(() => captureFrozenRegisteredDealers(input));
  }
});
test('selection and registration authority reject unsaved dealer IDs, unknown lanes and duplicate selection', () => {
  for (const mutate of [
    input => input.project.dealers = input.project.dealers.filter(row => row.id !== 'johanna'),
    input => input.selectedLaneIds = ['other'],
    input => input.selectedLaneIds = [input.selectedLaneIds[0], input.selectedLaneIds[0]],
    input => input.requiredIdleDealerIds = ['unknown'],
    input => input.requiredIdleDealerIds = ['nora'],
    input => input.project.lanes[0].layers.dealer.allowed.push('unknown'),
  ]) {
    const input = fixture(); mutate(input); assert.throws(() => captureFrozenRegisteredDealers(input));
  }
});
test('frozen registry is all and only selected extras; original dealers keep their legacy authority', () => {
  const input = fixture(), entries = captureFrozenRegisteredDealers(input).registeredDealers;
  assert.deepEqual(validateFrozenRegisteredDealers(entries, { dealerIds: [...BASE_DEALER_IDS, 'johanna'] }), entries);
  assert.deepEqual(validateFrozenRegisteredDealers([], { dealerIds: BASE_DEALER_IDS }), []);
  for (const malformed of [[], [...entries, entries[0]], [...entries, { id: 'nora', label: 'Nora', idle: null }],
    [{ ...entries[0], id: 'astrid' }], [{ ...entries[0], extra: true }], [{ ...entries[0], label: '' }]]) {
    assert.throws(() => validateFrozenRegisteredDealers(malformed, { dealerIds: ['johanna'] }));
  }
});
test('only the frozen lane allowed list permits a dealer lookup; unknown and original IDs never get borrowed idle', () => {
  const entries = captureFrozenRegisteredDealers(fixture()).registeredDealers;
  for (const [dealerId, allowedDealerIds] of [['nora', ['johanna']], ['johanna', ['nora']], ['astrid', ['astrid']], ['unknown', ['unknown']], ['../johanna', ['johanna']]]) {
    assert.equal(resolveFrozenDealerIdle(entries, { dealerId, allowedDealerIds }), null);
  }
  assert.equal(resolveFrozenDealerIdle([{ id: 'johanna', label: 'Johanna', idle: null }], { dealerId: 'johanna', allowedDealerIds: ['johanna'] }), null);
});
test('foreign owner, wrong event, mutable URL, invalid bytes and metadata corruption are rejected during decode', () => {
  const valid = captureFrozenRegisteredDealers(fixture()).registeredDealers;
  for (const mutate of [
    entry => entry.idle = media('nora', NORA_ID),
    entry => entry.idle.classification.eventId = 'speak.goodluck',
    entry => entry.idle.classification.kind = 'speech',
    entry => entry.idle.classification.playback = 'loop',
    entry => entry.idle.classification.compositing.threshold = 2,
    entry => entry.idle.pathname = 'https://foreign.example/idle.mp4',
    entry => entry.idle.sha256 = 'broken',
    entry => entry.idle.size = 0,
    entry => entry.idle.src = '/api/presentation/videos/foreign',
  ]) {
    const entries = structuredClone(valid); mutate(entries[0]); assert.throws(() => resolve(entries));
  }
});
test('write CAS detects record/revision replacement, reclassification and deletion after media I/O', () => {
  const input = fixture(), result = captureFrozenRegisteredDealers(input);
  assert.doesNotThrow(() => assertFrozenMediaPreconditions(result.mediaPreconditions, input.mediaRows));
  for (const mutate of [
    rows => rows.shift(),
    rows => rows[0].revision = 'media-johanna-2',
    rows => rows[0].classification.compositing.threshold = .8,
    rows => rows[0].classification.label = 'Changed',
    rows => rows[0].size++,
    rows => rows[0].pathname = 'foreign',
  ]) {
    const current = structuredClone(input.mediaRows); mutate(current);
    assert.throws(() => assertFrozenMediaPreconditions(result.mediaPreconditions, current), code('studio_conflict', 409));
  }
});
test('unrelated media changes and audit timestamp updates do not change the frozen idle precondition', () => {
  const input = fixture(), result = captureFrozenRegisteredDealers(input), current = structuredClone(input.mediaRows);
  current[0].updatedAt = '2026-10-10T00:00:00.000Z'; current[1].revision = 'other-media-2';
  current[1].classification.notes = 'Unrelated Nora edit';
  assert.doesNotThrow(() => assertFrozenMediaPreconditions(result.mediaPreconditions, current));
});
test('corrupt or duplicated preconditions cannot bypass the media CAS guard', () => {
  const input = fixture(), result = captureFrozenRegisteredDealers(input), one = result.mediaPreconditions[0];
  for (const value of [[one, one], [{ ...one, id: NORA_ID }], [{ ...one, revision: '' }], [{ ...one, extra: true }]]) {
    assert.throws(() => assertFrozenMediaPreconditions(value, input.mediaRows));
  }
});
test('legacy v1 package/envelope and original-four behavior remain byte-for-byte unchanged', () => {
  const project = createSeedProject(), selectedLaneIds = [project.lanes[0].id], before = structuredClone(project);
  const packageBefore = buildPresentationPackage(project, selectedLaneIds, []), envelopeBefore = encodePresentationPackage(packageBefore);
  const capture = captureFrozenRegisteredDealers({ project, selectedLaneIds, inventory: null, mediaRows: null });
  assert.deepEqual(capture, { registeredDealers: [], mediaPreconditions: [] });
  assert.deepEqual(project, before);
  assert.deepEqual(encodePresentationPackage(buildPresentationPackage(project, selectedLaneIds, [])), envelopeBefore);
  assert.deepEqual(decodePresentationPackage(envelopeBefore), packageBefore);
  assert.equal(packageBefore.schemaVersion, 1); assert.equal(Object.hasOwn(packageBefore, 'registeredDealers'), false);
  assert.doesNotThrow(() => assertFrozenMediaPreconditions([], null));
});
test('valid existing dealer labels retain their full model length and own display name', () => {
  const input = fixture(); input.project.dealers.find(row => row.id === 'johanna').label = 'J'.repeat(120);
  const captured = captureFrozenRegisteredDealers(input);
  assert.equal(captured.registeredDealers[0].label.length, 120);
  assert.equal(validateFrozenRegisteredDealers(captured.registeredDealers, { dealerIds: ['johanna'] })[0].label, 'J'.repeat(120));
});
