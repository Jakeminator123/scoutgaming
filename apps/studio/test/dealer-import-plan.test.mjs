import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { createSeedProject, addDealer } from '../../../packages/presentation/contracts/studio-model.mjs';
import { createFrozenKevinImportPlan, frozenKevinImportSource, reviewDealerImportFilenames, verifyImportSourceBytes } from '../lib/dealer-import-plan.mjs';
import { DRAGAN_KEVIN_PROFILE } from '../../../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
import { runDealerImportPlan } from '../../../tools/dealer-import-plan.mjs';

const project = addDealer(createSeedProject(), 'dragan', 'Dragan');
const args = { project, dealerId: 'dragan', sourceAlias: 'dragge' };
const source = frozenKevinImportSource();
const rowAt = (plan, tail) => plan.rows.find(row => row.provenance.path.endsWith('/' + tail));
const entryAt = tail => source.files.find(row => row.path.endsWith('/' + tail));
const proof = (tail, sha256 = 'a'.repeat(64)) => {
  const { path, gitBlobSha, size } = entryAt(tail);
  return { [path]: { gitBlobSha, size, sha256 } };
};
const plan = options => createFrozenKevinImportPlan({ ...args, ...options });
const media = (row, id = 'existing-1') => ({ id, sha256: row.sha256, available: true, classification: structuredClone(row.classification) });

test('explicit registered Dragan and explicit frozen alias are mandatory', () => {
  for (const bad of [{ dealerId: undefined }, { dealerId: 'missing' }, { sourceAlias: undefined }, { sourceAlias: 'paow' }, { dealerId: 'astrid' }])
    assert.throws(() => createFrozenKevinImportPlan({ ...args, ...bad }));
  assert.equal(plan().source.ref, '31f50618d071667476c9b7f4a85dfed951e23d53');
  assert.deepEqual(plan().source.languages, ['sv', 'en']);
  assert.ok(plan().rows.every(row => row.provenance.ref === source.ref && !row.provenance.path.includes('/pt/')));
});

test('catalogue, manifest, playback/fallback and worker-only preload remain separate', () => {
  const result = plan();
  for (const lang of ['sv', 'en']) {
    const speech = result.rows.filter(row => row.placement.speech?.language === lang);
    assert.equal(speech.length, 81);
    assert.equal(speech.filter(row => row.placement.runtimeUses.includes('manifest')).length, 11);
    assert.equal(speech.filter(row => row.placement.runtimeUses.includes('playback')).length, 56);
    assert.equal(speech.filter(row => row.placement.runtimeUses.includes('worker-preload')).length, 2);
    assert.equal(speech.filter(row => row.decision === 'excluded').length, 23);
  }
  assert.equal(rowAt(result, 'repliker/en/greeting_1.mp4').decision, 'excluded');
  assert.equal(rowAt(result, 'repliker/en/goodluck_2.mp4').placement.runtimeUses[0], 'worker-preload');
  assert.equal(rowAt(result, 'green/pos4.mp4').decision, 'excluded');
  assert.equal(rowAt(result, 'v2/vila.png').decision, 'reference-only');
  assert.equal(rowAt(result, 'v2/redo.png').decision, 'excluded');
});

test('all pose paths retain exact seats and necessary versions rather than optional variation', () => {
  const result = plan(), poses = result.rows.filter(row => row.placement.category === 'pose-version');
  assert.equal(poses.length, 56);
  for (let seat = 1; seat <= 7; seat++) {
    const row = rowAt(result, 'v2/pos' + seat + '-iv.mp4');
    assert.ok(row.placement.slotId.endsWith('/box' + (seat - 1)));
    assert.deepEqual(row.placement.pose, { entry: 'VILA', exit: 'VILA', version: 'iv' });
    assert.equal(row.placement.selection, 'required-pose-version');
    assert.ok(row.placement.runtimeUses.includes('playback'));
  }
  assert.equal(rowAt(result, 'v2/pos4.mp4').placement.pose.entry, 'REDO');
  assert.deepEqual(rowAt(result, 'v2/pos4-iu.mp4').placement.runtimeUses, ['preload', 'fallback']);
  assert.equal(rowAt(result, 'v2/hole.mp4').placement.pose.exit, 'VILA');
  assert.equal(rowAt(result, 'v2/flip-i.mp4').placement.pose.entry, 'VILA');
  assert.equal(rowAt(result, 'v2/posdealer.mp4').placement.slotId, 'deal.dealer/dealer-up');
  assert.equal(rowAt(result, 'v2/hole.mp4').placement.slotId, 'deal.dealer/dealer-hole');
  assert.equal(rowAt(result, 'v2/flip.mp4').placement.slotId, 'reveal.dealer/dealer-hole');
  assert.equal(rowAt(result, 'v2/flip.mp4').sourceByteAliases.length, 3);
  assert.equal(rowAt(result, 'idle-v2/breath.mp4').placement.selection, 'optional-variation');
});

test('recorded text/audio survives planning; unsupported speech cannot be silently imported as idle', () => {
  const result = plan(), row = rowAt(result, 'repliker/sv/twentyone_1.mp4');
  assert.equal(row.placement.category, 'recorded-speech');
  assert.equal(row.placement.speech.exactText, source.texts.sv.twentyone_1);
  assert.equal(row.placement.audioPolicy, 'preserve-recorded-audio');
  assert.equal(row.classification, null);
  assert.ok(row.reasons.includes('manual-placement-required'));
  assert.equal(row.placement.speech.audioSha256, null);
  assert.equal(result.dynamicSpeech.textSource, 'openclaw');
  assert.equal(result.dynamicSpeech.bank, 'external-unverified');
  assert.ok(result.rows.every(row => row.applyAllowed === false));
});

test('filename ambiguity, foreign dealer and unknown positions use existing manual-review contract', () => {
  const names = ['pos4.mp4', 'pos8.mp4', 'pos1-pos2.mp4', 'astrid-pos4.mp4', 'unknown.mp4'];
  const rows = reviewDealerImportFilenames({ project, dealerId: 'dragan',
    files: names.map((name, i) => ({ id: 'f' + i, name, type: 'video/mp4', size: 100 })) });
  assert.equal(rows[0].slotId, 'deal.player.centre/box3');
  for (const row of rows.slice(1)) assert.equal(row.slotId, null);
});

test('source verification requires exact Git blob bytes and separately computes SHA-256', () => {
  const bytes = Buffer.from('local verification fixture');
  const gitBlobSha = createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
  const checked = verifyImportSourceBytes({ gitBlobSha, size: bytes.length }, bytes);
  assert.equal(checked.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.notEqual(checked.sha256, gitBlobSha);
  assert.throws(() => verifyImportSourceBytes({ gitBlobSha, size: bytes.length }, Buffer.from('another fixture')));
  assert.throws(() => plan({ verifiedFiles: { [entryAt('v2/pos4.mp4').path]: { sha256: 'a'.repeat(64), gitBlobSha, size: 10 } } }));
  assert.ok(plan().rows.every(row => row.sha256 === null && row.decision !== 'reuse'));
});

test('stable reruns reuse exact pose identity and retain existing standard classification', () => {
  const tail = 'v2/pos4-iv.mp4';
  const take = DRAGAN_KEVIN_PROFILE.takes.find(row => row.repositoryPath.endsWith('/' + tail));
  const verifiedFiles = proof(tail, take.sha256);
  const proposed = rowAt(plan({ verifiedFiles, inventory: { videos: [] } }), tail);
  assert.equal(proposed.decision, 'import');
  const existing = media(proposed);
  existing.classification.role = 'standard';
  const input = { verifiedFiles, inventory: { videos: [existing] } };
  const first = plan(input), second = plan(structuredClone(input));
  assert.equal(first.planId, second.planId);
  const reused = rowAt(first, tail);
  assert.equal(reused.decision, 'reuse'); assert.equal(reused.mediaId, existing.id);
  assert.equal(reused.classification.role, 'standard');
  assert.equal(reused.applyAllowed, false);
  assert.deepEqual(input.inventory.videos[0], existing);
});

test('unreadable, failed and partial inventory cannot propose import or reuse from unverified identities', () => {
  const tail = 'idle-v2/breath.mp4', verifiedFiles = proof(tail);
  const existing = media(rowAt(plan({ verifiedFiles, inventory: { videos: [] } }), tail));
  const failures = [
    [{ readable: false }, 'unreadable'],
    [{ summary: { readable: false } }, 'unreadable'],
    [{ summary: { readable: true, snapshotReadable: false } }, 'unreadable'],
    [{ status: 'unreadable' }, 'unreadable'],
    [{ status: 'error' }, 'error'],
    [{ error: 'raw-diagnostic-marker' }, 'error'],
    [{ coverage: 'partial' }, 'partial'],
    [{ status: 'partial' }, 'partial'],
    [{ complete: false }, 'partial'],
    [{ partial: true }, 'partial'],
    [{ summary: { status: 'partial' }, status: 'ok' }, 'partial'],
    [{ coverage: { complete: false } }, 'partial'],
    [{ status: 'unknown' }, 'unverified'],
  ];
  for (const [signals, coverage] of failures) for (const videos of [[], [existing]]) {
    const result = plan({ verifiedFiles, inventory: { videos, ...signals } });
    const row = rowAt(result, tail);
    assert.equal(result.targetCoverage, coverage);
    assert.equal(row.decision, 'review');
    assert.equal(row.mediaId, null); assert.deepEqual(row.candidateMediaIds, []);
    assert.ok(row.reasons.includes('target-inventory-' + coverage));
    assert.ok(result.blockers.includes('target-inventory-' + coverage));
    assert.ok(result.rows.every(r => !['import', 'reuse', 'correct-binding'].includes(r.decision)));
    assert.equal(JSON.stringify(result).includes('raw-diagnostic-marker'), false);
  }
});

test('missing optional inventory stays not-read while complete supplied exports retain working import and reuse', () => {
  const tail = 'idle-v2/breath.mp4', verifiedFiles = proof(tail);
  const absent = plan({ verifiedFiles });
  assert.equal(absent.targetCoverage, 'not-read');
  assert.equal(rowAt(absent, tail).decision, 'review');
  const supplied = plan({ verifiedFiles, inventory: { videos: [] } });
  assert.equal(supplied.targetCoverage, 'supplied-inventory');
  assert.equal(rowAt(supplied, tail).decision, 'import');
  const existing = media(rowAt(supplied, tail));
  const full = { videos: [existing], readable: true, status: 'ok', coverage: 'complete',
    summary: { readable: true, snapshotReadable: true, complete: true, partial: false } };
  assert.equal(rowAt(plan({ verifiedFiles, inventory: full }), tail).decision, 'reuse');
});

test('reuse never crosses dealer, unverified pose calibration, protected media or ambiguous IDs', () => {
  const tail = 'idle-v2/breath.mp4', verifiedFiles = proof(tail);
  const row = rowAt(plan({ verifiedFiles, inventory: { videos: [] } }), tail);
  const good = media(row);
  const foreign = { ...good, classification: { ...good.classification, dealerId: 'astrid' } };
  assert.equal(rowAt(plan({ verifiedFiles, inventory: { videos: [foreign] } }), tail).decision, 'keep-protected');
  const protectedRow = { ...good, retainedBank: true };
  assert.equal(rowAt(plan({ verifiedFiles, inventory: { videos: [protectedRow] } }), tail).decision, 'keep-protected');
  const wrong = { ...good, classification: { ...good.classification, eventId: 'deal.player.left', situation: 'box0', kind: 'action' } };
  assert.equal(rowAt(plan({ verifiedFiles, inventory: { videos: [wrong] } }), tail).decision, 'correct-binding');
  assert.equal(rowAt(plan({ verifiedFiles, inventory: { videos: [good, { ...good, id: 'second-id' }] } }), tail).decision, 'review');
  assert.notEqual(rowAt(plan({ verifiedFiles, inventory: { videos: [{ ...good, id: null }] } }), tail).decision, 'reuse');
  const pose = rowAt(plan({ verifiedFiles: proof('v2/pos4.mp4'), inventory: { videos: [] } }), 'v2/pos4.mp4');
  assert.equal(pose.decision, 'review'); assert.ok(pose.reasons.includes('pose-calibration-not-bound-to-verified-bytes'));
});

test('recorded speech reuse requires exact bound recording tuple and preserves it', () => {
  const tail = 'repliker/sv/blackjack_1.mp4', verifiedFiles = proof(tail);
  const row = rowAt(plan({ verifiedFiles, inventory: { videos: [] } }), tail), existing = media(row);
  const identity = { dealerId: 'dragan', lineId: 'blackjack', takeId: 'blackjack_1', language: 'sv',
    exactText: source.texts.sv.blackjack_1, videoSha256: row.sha256, audioSha256: 'b'.repeat(64), indexSha256: 'c'.repeat(64),
    fps: 24, frameCount: 48, audioDelayMs: 0, entryPose: 'VILA', exitPose: 'VILA', calibrationRevision: 'fixture-v1' };
  existing.classification.recordedSpeech = { schemaVersion: 1, ...identity,
    recording: { status: 'verified-recording', by: 'Fixture', at: '2026-10-17T00:00:00.000Z', identity }, review: { status: 'pending' } };
  const reused = rowAt(plan({ verifiedFiles, inventory: { videos: [existing] } }), tail);
  assert.equal(reused.decision, 'reuse');
  assert.equal(reused.placement.speech.audioSha256, identity.audioSha256);
  assert.equal(reused.classification.recordedSpeech.review.status, 'pending');
  const mismatched = structuredClone(existing); mismatched.classification.recordedSpeech.exactText = 'Wrong text';
  assert.equal(rowAt(plan({ verifiedFiles, inventory: { videos: [mismatched] } }), tail).decision, 'correct-binding');
});

test('CLI is a working read-only plan entry and rejects apply or moving source overrides', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dealer-import-plan-'));
  try {
    const path = join(dir, 'project.json'); await writeFile(path, JSON.stringify(project));
    const argv = ['--plan', '--project', path, '--dealer', 'dragan', '--source-alias', 'dragge'];
    const result = await runDealerImportPlan(argv);
    assert.equal(result.source.ref, source.ref); assert.equal(result.mode, 'plan');
    assert.equal(result.targetCoverage, 'not-read');
    const inventoryPath = join(dir, 'inventory.json');
    await writeFile(inventoryPath, JSON.stringify({ videos: [], summary: { readable: false } }));
    const unreadable = await runDealerImportPlan([...argv, '--inventory', inventoryPath]);
    assert.equal(unreadable.targetCoverage, 'unreadable');
    assert.ok(rowAt(unreadable, 'idle-v2/breath.mp4').reasons.includes('target-inventory-unreadable'));
    for (const extra of [['--apply'], ['--ref', 'kevin-staging'], ['--plan']])
      await assert.rejects(() => runDealerImportPlan([...argv, ...extra]));
  } finally {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep + 'dealer-import-plan-'));
    await rm(dir, { recursive: true, force: true });
  }
});

test('CLI local path map verifies bytes, rejects unknown paths and keeps reads inside its explicit root', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dealer-import-plan-'));
  try {
    const projectPath = join(dir, 'project.json'), mapPath = join(dir, 'map.json');
    await writeFile(projectPath, JSON.stringify(project));
    const argv = ['--plan', '--project', projectPath, '--dealer', 'dragan', '--source-alias', 'dragge', '--source-map', mapPath];
    const map = { schemaVersion: 1, root: dir, files: {} };
    await writeFile(mapPath, JSON.stringify(map));
    assert.equal((await runDealerImportPlan(argv)).planId, plan().planId);
    await assert.rejects(() => runDealerImportPlan([...argv, '--source-root', dir]), { code: 'conflicting_source_options' });
    await writeFile(mapPath, JSON.stringify({ ...map, files: { unknown: 'project.json' } }));
    await assert.rejects(() => runDealerImportPlan(argv), { code: 'invalid_source_map' });
    const path = entryAt('v2/pos4.mp4').path;
    await writeFile(mapPath, JSON.stringify({ ...map, files: { [path]: 'project.json' } }));
    await assert.rejects(() => runDealerImportPlan(argv), { code: 'import_source_bytes_mismatch' });
    await writeFile(mapPath, JSON.stringify({ ...map, root: join(dir, 'missing'), files: {} }));
    await assert.rejects(() => runDealerImportPlan(argv), { code: 'ENOENT' });
    await writeFile(mapPath, JSON.stringify({ ...map, root: '.', files: {} }));
    await assert.rejects(() => runDealerImportPlan(argv), { code: 'invalid_source_map' });
    await writeFile(mapPath, JSON.stringify({ ...map, files: { [path]: import.meta.filename } }));
    await assert.rejects(() => runDealerImportPlan(argv), { code: 'source_path_outside_root' });
  } finally {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep + 'dealer-import-plan-'));
    await rm(dir, { recursive: true, force: true });
  }
});

// Paow: Kevin's kevin-staging head, frozen with every language and the K05 selection.
const paowSource = frozenKevinImportSource('paow');
const paowProject = addDealer(createSeedProject(), 'paow', 'Paow');
const paowPlan = options => createFrozenKevinImportPlan({ project: paowProject, dealerId: 'paow', sourceAlias: 'paow', ...options });
const paowEntry = tail => paowSource.files.find(row => row.path.endsWith('/' + tail));
const paowProof = tail => { const { path, gitBlobSha, size, sha256 } = paowEntry(tail); return { [path]: { gitBlobSha, size, sha256 } }; };

test('Paow source freezes kevin-staging c7138759 with declared SHA-256, K05 selection, Kevin runtime constants and all four languages', () => {
  assert.equal(paowSource.id, 'kevin-paow-c7138759'); assert.equal(paowSource.branch, 'kevin-staging');
  assert.equal(paowSource.ref, 'c713875923cd854b26f89c1db0d0f47064619c1d');
  assert.equal(paowSource.sourceDealerId, 'paow'); assert.equal(paowSource.targetDealerId, 'paow');
  assert.equal(paowSource.files.length, 414);
  assert.ok(paowSource.files.every(row => /^[a-f0-9]{64}$/.test(row.sha256) && /^[a-f0-9]{40}$/.test(row.gitBlobSha) && Number.isSafeInteger(row.size)));
  assert.equal(new Set(paowSource.files.map(row => row.path)).size, 414);
  assert.equal(paowSource.k05.matrixSha256, 'f00a8c2d275cd584809e6a9668269ac3c99383ada7d32ff987178bf9733ce319');
  assert.equal(paowSource.k05.ref, '5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc');
  assert.deepEqual(paowSource.languages, ['sv', 'en']); assert.deepEqual(paowSource.additionalLanguages, ['pt', 'ko']);
  for (const language of ['sv', 'en', 'pt', 'ko']) assert.equal(Object.keys(paowSource.texts[language]).length, 81);
  assert.equal(paowSource.runtime.idles.length, 23); assert.equal(paowSource.runtime.ready.in, 21); assert.equal(paowSource.runtime.lipsyncAvatar, 'paow_vila2x');
  assert.equal(paowSource.files.filter(row => row.k05?.selection === 'vald').length, 157);
  assert.equal(paowSource.files.filter(row => row.clipList?.status === 'ej-godkand').length, 324);
  assert.throws(() => frozenKevinImportSource('marten'), { code: 'unknown_source_alias' });
  assert.throws(() => createFrozenKevinImportPlan({ project: paowProject, dealerId: 'paow', sourceAlias: 'dragge' }), { code: 'import_source_dealer_mismatch' });
  assert.throws(() => createFrozenKevinImportPlan({ project, dealerId: 'dragan', sourceAlias: 'paow' }), { code: 'import_source_dealer_mismatch' });
  assert.throws(() => createFrozenKevinImportPlan({ project, dealerId: 'astrid', sourceAlias: 'paow' }), { code: 'import_source_dealer_mismatch' });
});

test('Paow plan places poses, H3 idles and K05-selected speech; deferred, unselected and pt/ko rows are excluded with their reasons', () => {
  const result = paowPlan();
  assert.equal(result.rows.length, 414); assert.equal(result.source.filmedProfile, null); assert.equal(result.source.k05.review, '6329902583');
  assert.equal(result.dynamicSpeech.sourceAvatar, 'paow_vila2x');
  assert.deepEqual(result.counts, { catalogSpeechPerLanguage: 81, manifestSpeechIds: 0, playbackOrFallbackSpeechIds: 37, additionalWorkerPreloadSpeechIds: 0, posePaths: 56 });
  const poses = result.rows.filter(row => row.placement.category === 'pose-version');
  assert.equal(poses.length, 56);
  assert.ok(poses.every(row => row.decision === 'review' && row.reasons.includes('pose-calibration-not-bound-to-verified-bytes') && row.placement.calibration.runtimeProfile === null));
  assert.equal(rowAt(result, 'v2/pos4-iv.mp4').placement.slotId, 'deal.player.centre/box3');
  assert.equal(rowAt(result, 'v2/pos4-iv.mp4').placement.calibration.frameCount, 60);
  assert.deepEqual(rowAt(result, 'v2/hole.mp4').placement.pose, { entry: 'REDO', exit: 'VILA', version: 'base' });
  assert.equal(rowAt(result, 'v2/flip.mp4').sourceByteAliases.length, 3);
  const idles = result.rows.filter(row => row.placement.category === 'idle');
  assert.equal(idles.length, 23);
  assert.ok(idles.every(row => row.placement.slotId === 'idle.ready/' && row.placement.runtimeUses.includes('playback') && row.k05.selection === 'vald'));
  assert.equal(rowAt(result, 'v2/andas.mp4').placement.idle.calm, true); assert.equal(rowAt(result, 'v2/nick6101.mp4').placement.idle.calm, false);
  assert.equal(rowAt(result, 'idle-v2/breath.mp4').decision, 'excluded'); assert.ok(rowAt(result, 'idle-v2/breath.mp4').reasons.includes('not-referenced-by-frozen-runtime'));
  for (const language of ['sv', 'en']) {
    const speech = result.rows.filter(row => row.placement.speech?.language === language);
    assert.equal(speech.length, 81);
    assert.equal(speech.filter(row => row.placement.runtimeUses.includes('playback')).length, 37);
    assert.equal(speech.filter(row => row.reasons.includes('deferred-by-k05-review-6329902583')).length, 22);
    assert.equal(speech.filter(row => row.reasons.includes('not-in-k05-activation-set')).length, 22);
    assert.ok(speech.every(row => row.placement.speech.exactText === paowSource.texts[language][row.placement.speech.takeId]));
  }
  for (const language of ['pt', 'ko']) {
    const speech = result.rows.filter(row => row.placement.speech?.language === language);
    assert.equal(speech.length, 81);
    assert.ok(speech.every(row => row.decision === 'excluded' && row.reasons.includes('language-outside-k05-selection')));
  }
  const deferred = rowAt(result, 'repliker/sv/twentyone_1.mp4');
  assert.equal(deferred.placement.slotId, null); assert.equal(deferred.placement.proposedSlotId, 'speak.other/twentyone');
  assert.equal(deferred.k05.selection, 'uppskjuten:G13'); assert.equal(deferred.kevinClipList.status, 'ej-godkand');
  assert.equal(rowAt(result, 'repliker/sv/goodluck_1.mp4').placement.slotId, 'speak.goodluck/goodluck');
  assert.equal(rowAt(result, 'repliker/sv/goodluck_1.mp4').classification.role, 'alternative');
  assert.equal(rowAt(result, 'v2/vila.png').decision, 'reference-only'); assert.equal(rowAt(result, 'v2/redo.png').decision, 'excluded');
  assert.equal(rowAt(result, 'faces/paow.jpg').decision, 'reference-only'); assert.equal(rowAt(result, 'repliker/ko/texter.json').decision, 'reference-only');
  assert.ok(result.rows.every(row => row.applyAllowed === false && row.sha256 === null && row.provenance.declaredSha256 === paowEntry(row.provenance.path.split('/').slice(-2).join('/')).sha256));
  assert.equal(result.applyAllowed, false);
});

test('Paow declared SHA-256 must agree with verified bytes; verified idle takes become importable and same bytes elsewhere stay protected', () => {
  const tail = 'v2/andas.mp4', entry = paowEntry(tail), verifiedFiles = paowProof(tail);
  assert.throws(() => paowPlan({ verifiedFiles: { [entry.path]: { ...verifiedFiles[entry.path], sha256: 'a'.repeat(64) } } }), { code: 'import_source_bytes_mismatch' });
  const bytes = Buffer.from('paow verification fixture');
  const gitBlobSha = createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.throws(() => verifyImportSourceBytes({ gitBlobSha, size: bytes.length, sha256: 'b'.repeat(64) }, bytes), { code: 'import_source_bytes_mismatch' });
  assert.equal(verifyImportSourceBytes({ gitBlobSha, size: bytes.length, sha256: digest }, bytes).sha256, digest);
  const row = rowAt(paowPlan({ verifiedFiles, inventory: { videos: [] } }), tail);
  assert.equal(row.decision, 'import'); assert.equal(row.sha256, entry.sha256); assert.equal(row.provenance.declaredSha256, entry.sha256);
  const archivedOwner = { id: 'paow-kevin-media', sha256: entry.sha256, available: true, classification: { ...row.classification, dealerId: 'paow-kevin' } };
  assert.equal(rowAt(paowPlan({ verifiedFiles, inventory: { videos: [archivedOwner] } }), tail).decision, 'keep-protected');
  const pose = rowAt(paowPlan({ verifiedFiles: paowProof('v2/pos4.mp4'), inventory: { videos: [] } }), 'v2/pos4.mp4');
  assert.equal(pose.decision, 'review'); assert.ok(pose.reasons.includes('pose-calibration-not-bound-to-verified-bytes'));
  const speech = rowAt(paowPlan({ verifiedFiles: paowProof('repliker/sv/goodluck_1.mp4'), inventory: { videos: [] } }), 'repliker/sv/goodluck_1.mp4');
  assert.equal(speech.decision, 'review'); assert.ok(speech.reasons.includes('recorded-audio-index-calibration-required'));
  assert.equal(speech.placement.speech.videoSha256, speech.sha256);
});

test('CLI verifies local bytes against the chosen alias and offers a summary, never Dragan\'s list for Paow', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dealer-import-plan-'));
  try {
    const projectPath = join(dir, 'project.json'); await writeFile(projectPath, JSON.stringify(paowProject));
    const argv = ['--plan', '--project', projectPath, '--dealer', 'paow', '--source-alias', 'paow'];
    await assert.rejects(() => runDealerImportPlan([...argv.slice(0, -1), 'marten']), { code: 'unknown_source_alias' });
    await assert.rejects(() => runDealerImportPlan([...argv, '--summary', '--summary']), { code: 'duplicate_option' });
    const result = await runDealerImportPlan([...argv, '--source-root', dir]);
    assert.equal(result.source.id, paowSource.id); assert.equal(result.targetCoverage, 'not-read'); assert.equal(result.planId, paowPlan().planId);
    const summary = await runDealerImportPlan([...argv, '--summary']);
    assert.equal(summary.planId, paowPlan().planId); assert.equal(summary.rows, 414); assert.equal(summary.verifiedBytes, 0);
    assert.equal(summary.decisions.excluded, paowPlan().rows.filter(row => row.decision === 'excluded').length);
    assert.equal(summary.missingSlots['speak.other/twentyone'], 28);
    const entry = paowEntry('v2/andas.mp4'), local = join(dir, ...entry.path.split('/'));
    await mkdir(dirname(local), { recursive: true }); await writeFile(local, 'not the frozen bytes');
    await assert.rejects(() => runDealerImportPlan([...argv, '--source-root', dir]), { code: 'import_source_bytes_mismatch' });
  } finally {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep + 'dealer-import-plan-'));
    await rm(dir, { recursive: true, force: true });
  }
});
