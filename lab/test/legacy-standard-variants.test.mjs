import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSeedProject, normalizeProject, validateProject } from '../lib/studio-model.mjs';
import { createProjectStore } from '../lib/project-store.mjs';
import { LEGACY_CLIP_PARTS } from '../../presentation-runtime/legacy-clip-policy.mjs';
import { LEGACY_PART_PLACEMENTS, legacySituationLine } from '../../presentation-runtime/legacy-standard-variants.mjs';

const clip = (dealer, part) => `${dealer}:legacy/${part}`;
const policyFor = dealer => LEGACY_CLIP_PARTS.map(part => ({ dealerId: dealer, part, clipId: clip(dealer, part) }));

function line(project, dealerId, eventId) {
  return project.lines.find(item => item.dealerId === dealerId && item.eventId === eventId);
}
function baseline(project, dealerId, eventId) {
  const row = line(project, dealerId, eventId);
  return row.variants.find(variant => variant.id === row.baselineVariantId);
}

test('every legacy part has one placement and Astrid is not migrated', () => {
  assert.deepEqual(Object.keys(LEGACY_PART_PLACEMENTS).sort(), [...LEGACY_CLIP_PARTS].sort());
  const before = createSeedProject();
  const astridBefore = structuredClone(before.lines.filter(row => row.dealerId === 'astrid'));
  const project = normalizeProject({ ...structuredClone(before), legacyClipPolicy: [
    ...policyFor('vera'), ...policyFor('amira'), ...policyFor('mei'),
    { dealerId: 'astrid', part: 'idle', clipId: 'astrid:legacy/idle' },
  ] });
  assert.deepEqual(project.lines.filter(row => row.dealerId === 'astrid'), astridBefore);
  assert.deepEqual(project.legacyClipPolicy.at(-1), { dealerId: 'astrid', part: 'idle', clipId: 'astrid:legacy/idle' });
  assert.equal(baseline(project, 'vera', 'idle.ready').videoGenerationId, clip('vera', 'idle'));
  assert.equal(baseline(project, 'amira', 'turn.player').videoGenerationId, clip('amira', 'think'));
  for (const eventId of ['settle.blackjack', 'settle.dealerBust', 'settle.win', 'settle.push', 'settle.other']) {
    assert.equal(baseline(project, 'mei', eventId).videoGenerationId, clip('mei', 'gest'));
  }
  const centre = line(project, 'vera', 'deal.player.centre');
  const box3 = centre.variants.find(variant => variant.id === 'vera.deal.player.centre.legacy-box3');
  assert.equal(box3.videoGenerationId, clip('vera', 'box3'));
  assert.deepEqual(box3.selection, { rules: true, model: true, random: false });
  assert.deepEqual(box3.triggerIds.map(id => project.triggers.find(trigger => trigger.id === id)), [
    { id: 'legacy.box.3', label: 'Plats 4', category: 'deterministic', path: 'event.box', op: 'eq', value: 3 },
  ]);
  assert.equal(baseline(project, 'vera', 'deal.player.centre').videoGenerationId, null);
  assert.equal(baseline(project, 'vera', 'reveal.dealer').videoGenerationId, clip('vera', 'dealer-hole'));
  const hole = line(project, 'vera', 'deal.dealer').variants.find(variant => variant.id === 'vera.deal.dealer.legacy-dealer-hole');
  assert.equal(hole.triggerIds[0], 'legacy.face-down.true');
  const tilt = line(project, 'vera', 'idle.ready').variants.find(variant => variant.id === 'vera.idle.ready.legacy-headTilt');
  assert.deepEqual(tilt.selection, { rules: false, model: false, random: false });
  assert.deepEqual(tilt.triggerIds, []);
  for (const eventId of ['deal.player.left', 'deal.player.centre', 'deal.player.right', 'deal.dealer']) {
    assert.ok(line(project, 'vera', eventId).variants.length <= 5);
  }
  assert.deepEqual(normalizeProject(structuredClone(project)), project);
});

test('a saved standard video is kept and a read does not rewrite the file', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'c5b-legacy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const draft = createSeedProject();
  baseline(draft, 'vera', 'idle.ready').videoGenerationId = '11111111-1111-4111-8111-111111111111';
  draft.legacyClipPolicy = [{ dealerId: 'vera', part: 'idle', clipId: clip('vera', 'idle') }, { dealerId: 'vera', part: 'box3', clipId: clip('vera', 'box3') }];
  const file = join(directory, 'project.json');
  const bytes = JSON.stringify(draft);
  await writeFile(file, bytes);
  const loaded = await createProjectStore(directory).load();
  assert.equal(await readFile(file, 'utf8'), bytes);
  assert.equal(baseline(loaded, 'vera', 'idle.ready').videoGenerationId, '11111111-1111-4111-8111-111111111111');
  const played = legacySituationLine(line(loaded, 'vera', 'deal.player.centre'), { type: 'deal', to: 'box', box: 3, faceDown: false });
  assert.equal(played.variants.find(variant => variant.id === played.baselineVariantId).videoGenerationId, clip('vera', 'box3'));
  assert.equal(baseline(loaded, 'vera', 'deal.player.centre').videoGenerationId, null);
  assert.throws(() => validateProject({ ...createSeedProject(), lines: createSeedProject().lines.map(row => row.dealerId === 'vera' && row.eventId === 'idle.ready'
    ? { ...row, variants: [{ ...row.variants[0], videoGenerationId: '../secret' }] } : row) }), /sökväg/);
});
