import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEDIA_FAMILY_DEFINITIONS, PRESENTATION_BANKS, PRESENTATION_BANK_DEALERS } from '../../presentation-runtime/media-families.mjs';
import { mediaDefinitionForPath, readLabVideoManifest, validateLabVideoManifest } from '../lib/lab-video-manifest.mjs';
import { buildLabVideoManifest, manifestJson } from '../../pipeline/build-lab-video-manifest.mjs';
import { loadVideoRegistry, getVideoResponse } from '../lib/video-registry.mjs';
import { presentationBankRoot } from '../../tools/media-layout.mjs';
import { resolveMediaFamily, resolveMediaFamilySelection } from '../../presentation-runtime/media-family-resolver.mjs';

const bankDirectory = (root, dealerId) => join(root, 'media/dealers', dealerId, 'runtime/presentation');

async function writeBank(root, dealerId, { extra = {} } = {}) {
  const bank = bankDirectory(root, dealerId);
  for (const definition of PRESENTATION_BANKS[dealerId].families) {
    for (const file of definition.standardPaths) {
      const path = join(bank, ...file.split('/'));
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${dealerId}:${file}`);
    }
    await mkdir(join(bank, ...definition.variantDirectory.split('/')), { recursive: true });
    await writeFile(join(bank, ...definition.variantDirectory.split('/'), '.gitkeep'), '');
  }
  for (const [file, bytes] of Object.entries(extra)) {
    const path = join(bank, ...file.split('/'));
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  }
  return bank;
}

async function repository(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'croupier-presentation-banks-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('Astrid keeps her catalogue; Dragge has deal and speech families, Paow deal families only and no hole take', () => {
  assert.deepEqual(PRESENTATION_BANK_DEALERS, ['astrid', 'dragge', 'paow']);
  assert.equal(PRESENTATION_BANKS.astrid.families, MEDIA_FAMILY_DEFINITIONS);
  assert.equal(PRESENTATION_BANKS.astrid.source, 'emil/dealklipp-v1');
  const deals = ['box0', 'box1', 'box2', 'box3', 'box4', 'box5', 'box6', 'dealer-up'];
  const speech = MEDIA_FAMILY_DEFINITIONS.filter(row => row.eventId.startsWith('speak.'));
  assert.equal(speech.length, 17);
  assert.deepEqual(PRESENTATION_BANKS.dragge.families.map(row => row.situation), [...deals, 'dealer-hole', ...speech.map(row => row.situation)]);
  assert.deepEqual(PRESENTATION_BANKS.dragge.families.slice(9).map(row => [row.id, row.eventId, row.standardPaths, row.variantDirectory]),
    speech.map(row => [row.id.replace(/^astrid\//, 'dragge/'), row.eventId, row.standardPaths, row.variantDirectory]));
  assert.deepEqual(PRESENTATION_BANKS.paow.families.map(row => row.situation), deals);
  for (const dealerId of ['dragge', 'paow']) {
    const families = PRESENTATION_BANKS[dealerId].families;
    assert.ok(families.every(row => row.dealerId === dealerId && row.id.startsWith(`${dealerId}/`) && row.playbackType === 'once'));
    assert.equal(families.some(row => row.eventId === 'reveal.dealer' || row.eventId === 'idle.ready'), false);
    assert.equal(mediaDefinitionForPath('deal/deal_pos1/deal_pos1.mp4', dealerId).definition.id, `${dealerId}/deal.player.left/box0`);
    assert.equal(mediaDefinitionForPath('deal/deal_flip/deal_flip.mp4', dealerId), null);
  }
  assert.equal(mediaDefinitionForPath('repliker/win/win.mp4', 'dragge').definition.id, 'dragge/speak.other/win');
  assert.equal(mediaDefinitionForPath('repliker/goodluck/goodluck.mp4', 'dragge').definition.id, 'dragge/speak.goodluck/goodluck');
  assert.equal(mediaDefinitionForPath('repliker/win/variant/win_2.mp4', 'dragge').role, 'variant');
  assert.equal(mediaDefinitionForPath('repliker/win/win.mp4', 'paow'), null);
  assert.equal(mediaDefinitionForPath('repliker/win/variant/win_2.mp4', 'paow'), null);
  assert.equal(mediaDefinitionForPath('deal/deal_hole/deal_hole.mp4', 'paow'), null);
  assert.equal(mediaDefinitionForPath('deal/deal_pos6/variant/deal_pos6b.mp4', 'paow').role, 'variant');
  assert.equal(mediaDefinitionForPath('deal/deal_pos1/deal_pos1.mp4', 'vera'), null);
  assert.equal(mediaDefinitionForPath('deal/deal_pos1/deal_pos1.mp4').definition.id, 'astrid/deal.player.left/box0');
  for (const dealerId of ['../astrid', 'Astrid', '', null]) assert.throws(() => presentationBankRoot('/repository', dealerId), /Unsafe presentation bank/);
  assert.equal(presentationBankRoot('/repository'), join('/repository', 'media/dealers/astrid/runtime/presentation'));
  assert.equal(presentationBankRoot('/repository', 'dragge'), join('/repository', 'media/dealers/dragge/runtime/presentation'));
});

test('the builder writes one manifest per dealer bank and the validator refuses a bank under another dealer', async t => {
  const root = await repository(t);
  const dragge = await writeBank(root, 'dragge');
  const paow = await writeBank(root, 'paow', { extra: { 'deal/deal_pos6/variant/deal_pos6b.mp4': 'paow:pos6b' } });
  const draggeManifest = await buildLabVideoManifest({ dealerId: 'dragge', root: dragge });
  assert.equal(draggeManifest.source, 'h3/klara-dragge');
  assert.equal(draggeManifest.items.length, 26);
  assert.ok(draggeManifest.families.every(row => row.dealerId === 'dragge' && row.standardIds.length === 1 && row.variantIds.length === 0));
  assert.throws(() => validateLabVideoManifest(draggeManifest), /Unsupported lab video manifest/);
  assert.throws(() => validateLabVideoManifest(draggeManifest, 'paow'), /Unsupported lab video manifest/);
  assert.throws(() => validateLabVideoManifest(draggeManifest, 'vera'), /Unknown presentation bank/);
  await writeFile(join(dragge, 'lab-video-manifest.json'), manifestJson(draggeManifest, 'dragge'));
  assert.deepEqual(await readLabVideoManifest(join(dragge, 'lab-video-manifest.json'), 'dragge'), draggeManifest);
  await assert.rejects(readLabVideoManifest(join(dragge, 'lab-video-manifest.json')), /Unsupported lab video manifest/);
  const paowManifest = await buildLabVideoManifest({ dealerId: 'paow', root: paow });
  assert.equal(paowManifest.source, 'h3/klara-paow');
  assert.equal(paowManifest.families.find(row => row.id === 'paow/deal.player.right/box5').variantIds.length, 1);
  await mkdir(join(paow, 'deal/deal_hole'), { recursive: true }); await writeFile(join(paow, 'deal/deal_hole/deal_hole.mp4'), 'paow:hole');
  await assert.rejects(buildLabVideoManifest({ dealerId: 'paow', root: paow }), /outside the allowed media roots/);
  await assert.rejects(buildLabVideoManifest({ dealerId: 'astrid', root: dragge }), /outside the allowed media roots|Required standard media is missing/);
  await assert.rejects(buildLabVideoManifest({ dealerId: 'vera', root: dragge }), /Unknown presentation bank/);
});

test('the registry merges every registered bank, keeps Astrid when another bank is missing or broken, and serves each bank from its own root', async t => {
  const root = await repository(t);
  await writeBank(root, 'astrid');
  const astrid = bankDirectory(root, 'astrid');
  await writeFile(join(astrid, 'lab-video-manifest.json'), manifestJson(await buildLabVideoManifest({ root: astrid })));
  const options = { repositoryRoot: root, env: {}, readUploads: async () => [], readClassifications: async () => [] };
  const alone = await loadVideoRegistry(options);
  assert.equal(alone.families.length, MEDIA_FAMILY_DEFINITIONS.length);
  assert.equal(alone.summary.archiveSource, 'emil-default');
  assert.equal(alone.videos.filter(row => row.available).length, 29);

  const dragge = await writeBank(root, 'dragge');
  const draggeManifest = await buildLabVideoManifest({ dealerId: 'dragge', root: dragge });
  await writeFile(join(dragge, 'lab-video-manifest.json'), manifestJson(draggeManifest, 'dragge'));
  await mkdir(bankDirectory(root, 'paow'), { recursive: true });
  await writeFile(join(bankDirectory(root, 'paow'), 'lab-video-manifest.json'), '{"schemaVersion":2}');
  const merged = await loadVideoRegistry(options);
  assert.deepEqual(merged.families.slice(0, alone.families.length), alone.families);
  const draggeFamilies = merged.families.filter(row => row.dealerId === 'dragge');
  assert.equal(draggeFamilies.length, 26);
  assert.equal(merged.families.some(row => row.dealerId === 'paow'), false);
  assert.ok(merged.summary.notes.some(note => /paow/.test(note)));
  const box0 = merged.videos.find(row => row.familyId === 'dragge/deal.player.left/box0');
  assert.deepEqual([box0.label, box0.dealer, box0.role, box0.available], ['Dragge · box0 · standard', 'dragge', 'standard', true]);
  assert.equal(merged.videos.find(row => row.familyId === 'astrid/deal.player.left/box0').label, 'Astrid · box0 · standard');
  const response = await getVideoResponse(box0.id, new Request(`http://localhost/api/videos/${box0.id}`), options);
  assert.equal(response.status, 200);
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'dragge:deal/deal_pos1/deal_pos1.mp4');
  const astridBox0 = merged.videos.find(row => row.familyId === 'astrid/deal.player.left/box0');
  assert.equal(await (await getVideoResponse(astridBox0.id, new Request(`http://localhost/api/videos/${astridBox0.id}`), options)).text(), 'astrid:deal/deal_pos1/deal_pos1.mp4');

  // An explicit archive or snapshot stays a single bank.
  const single = await loadVideoRegistry({ ...options, archiveDir: astrid, snapshotPath: join(astrid, 'lab-video-manifest.json') });
  assert.equal(single.families.some(row => row.dealerId === 'dragge'), false);
  await assert.rejects(loadVideoRegistry({ ...options, strict: true }), error => error.status === 503);
  assert.equal(await readFile(join(dragge, 'lab-video-manifest.json'), 'utf8'), manifestJson(draggeManifest, 'dragge'));
});

test("Dragge's English speech in the repository: every line resolves to its own standard film and two variants, Paow has none", async () => {
  const bank = presentationBankRoot(fileURLToPath(new URL('../../', import.meta.url)), 'dragge');
  const manifest = await readLabVideoManifest(join(bank, 'lab-video-manifest.json'), 'dragge');
  const texts = JSON.parse(await readFile(join(bank, 'repliker/bank.json'), 'utf8'));
  const registry = await loadVideoRegistry();
  const lines = PRESENTATION_BANKS.dragge.families.filter(row => row.eventId.startsWith('speak.'));
  assert.deepEqual(Object.keys(texts).sort(), lines.map(row => row.situation).sort());
  const item = path => manifest.items.find(row => row.relativePath === path);
  for (const { eventId, situation: line } of lines) {
    assert.ok(typeof texts[line].text === 'string' && texts[line].text.length > 0, line);
    const event = { type: 'speak', line };
    const family = resolveMediaFamily(registry, { dealerId: 'dragge', eventId, event });
    assert.equal(family?.id, `dragge/${eventId}/${line}`);
    assert.deepEqual(family.standardIds, [item(`repliker/${line}/${line}.mp4`).id]);
    assert.deepEqual([...family.variantIds].sort(), [2, 3].map(n => item(`repliker/${line}/variant/${line}_${n}.mp4`).id).sort());
    const chosen = resolveMediaFamilySelection(registry, family);
    assert.deepEqual([chosen.reason, chosen.selected.id], ['standard', family.standardIds[0]]);
    assert.equal(resolveMediaFamily(registry, { dealerId: 'paow', eventId, event }), null);
  }
});
