import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIntakeProposals, collectDroppedFiles, intakeDescriptors, intakeDestination, intakeDropCheck, intakeRelativePath, intakeRole, intakeRowIssue, intakeSummary, intakeUploadRows, placeIntakeRow, planIntakeFiles, INTAKE_DRAG_TYPE } from './clip-intake.mjs';
import { importClassification } from './dealer-import.mjs';
import { createSeedProject } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { clipSlots } from './connected-studio.mjs';
import { groupSlots } from './studio-layout.mjs';

const catalog = { dealers: [{ id: 'paow', label: 'Paow' }], limits: { maxFiles: 30, maxFileBytes: 134217728 }, slots: [
  { id: 'idle.ready/', label: 'Grundloop', eventId: 'idle.ready', situation: '', kind: 'idle', category: 'idle' },
  { id: 'deal.player.left/box0', label: 'Plats 1', eventId: 'deal.player.left', situation: 'box0', kind: 'action', category: 'deal' },
  { id: 'deal.player.left/box1', label: 'Plats 2', eventId: 'deal.player.left', situation: 'box1', kind: 'action', category: 'deal' },
  { id: 'transition.shoe/to-shoe', label: 'Till skon', eventId: 'transition.shoe', situation: 'to-shoe', kind: 'action', category: 'transition' },
  { id: 'speak.goodluck/goodluck', label: 'Lycka till', eventId: 'speak.goodluck', situation: 'goodluck', kind: 'speech', category: 'speech' },
  { id: 'pose/vila', pose: 'vila', label: 'VILA · referensbild', category: 'pose', kind: 'pose' },
] };
const file = (name, extra = {}) => new File([new Uint8Array(64)], name, { type: '', lastModified: 7, ...extra });
let counter = 0;
const plan = (entries, rows = [], options = {}) => planIntakeFiles(entries, rows, catalog.limits, { id: () => `row-${++counter}`, ...options });

test('intake plans files with folder paths, dedupes, bounds the batch and explains unsupported files', () => {
  const clip = file('paow_pos1.mp4');
  const first = plan([{ file: clip, path: 'paow/utdelning/paow_pos1.mp4' }, { file: file('vila.png') }, { file: file('goodluck.wav') }, { file: file('odd.mov') }]);
  assert.equal(first.rows.length, 4); assert.equal(first.duplicates, 0);
  assert.equal(first.rows[0].path, 'paow/utdelning/paow_pos1.mp4'); assert.equal(first.rows[0].state, 'ready'); assert.equal(first.rows[0].kind, 'video');
  assert.equal(first.rows[0].label, 'paow_pos1'); assert.equal(first.rows[0].background, 'green-screen'); assert.equal(first.rows[0].slotId, '');
  for (const [index, kind] of [[1, 'image'], [2, 'audio'], [3, '']]) { assert.equal(first.rows[index].kind, kind); assert.equal(first.rows[index].state, 'error'); assert.equal(first.rows[index].blocked, true); assert.match(first.rows[index].message, /sparas inte|Bara MP4/); }
  // Same name, size and time in another folder is a different file; the same path again is a duplicate.
  const again = plan([{ file: clip, path: 'paow/utdelning/paow_pos1.mp4' }, { file: clip, path: 'annan/paow_pos1.mp4' }, clip], first.rows);
  assert.equal(again.duplicates, 1); assert.deepEqual(again.rows.map(row => row.path ?? null), ['annan/paow_pos1.mp4', null]);
  const many = Array.from({ length: 35 }, (_, i) => ({ file: file(`clip-${i}.mp4`) }));
  const bounded = plan(many, [{ file: file('old.mp4'), state: 'saved' }]);
  assert.equal(bounded.rows.length, 30); assert.equal(bounded.overflow, 5); assert.equal(bounded.maxFiles, 30);
  assert.equal(plan(many, [], { }).rows.length, 30);
  const oversized = plan([{ file: file('huge.mp4', {}) }]).rows[0];
  assert.equal(oversized.state, 'ready');
  const tiny = plan([new File([new Uint8Array(4)], 'tiny.mp4')]).rows[0];
  assert.equal(tiny.state, 'error'); assert.match(tiny.message, /mellan 16 byte/);
  const preset = plan([file('drop.mp4')], [], { slotId: 'deal.player.left/box0' }).rows[0];
  assert.equal(preset.slotId, 'deal.player.left/box0'); assert.equal(preset.confidence, 'user');
});

test('relative paths are only forwarded when they are safe, slash separated and end with the file name', () => {
  const clip = file('goodluck_1.mp4');
  assert.equal(intakeRelativePath(clip, 'paow/repliker/sv/goodluck_1.mp4'), 'paow/repliker/sv/goodluck_1.mp4');
  for (const bad of ['goodluck_1.mp4', '/paow/goodluck_1.mp4', 'paow\\goodluck_1.mp4', 'paow/../goodluck_1.mp4', 'paow//goodluck_1.mp4', 'paow/other.mp4', 'a'.repeat(240) + '/goodluck_1.mp4', '', undefined, 'paow/./goodluck_1.mp4', 'paow/\u0001/goodluck_1.mp4'])
    assert.equal(intakeRelativePath(clip, bad), null, String(bad));
  const descriptors = intakeDescriptors([...plan([{ file: clip, path: 'paow/repliker/sv/goodluck_1.mp4' }, { file: file('x.png') }]).rows, { id: 'saved', file: file('done.mp4'), state: 'saved' }]);
  assert.deepEqual(descriptors, [{ id: descriptors[0].id, name: 'goodluck_1.mp4', size: 64, type: 'video/mp4', path: 'paow/repliker/sv/goodluck_1.mp4' }]);
  assert.ok(Object.keys(descriptors[0]).every(key => ['id', 'name', 'size', 'type', 'path'].includes(key)));
});

test('proposals place confident rows, keep uncertain rows unassigned with quick choices, and validate display advice', () => {
  const rows = plan([file('paow_pos1.mp4'), file('paow_unknown.mp4'), file('paow_goodluck_sv_2.mp4'), file('vila.png')]).rows;
  const [sure, unsure, speech, image] = rows.map(row => row.id);
  const proposals = [
    { fileId: sure, slotId: 'deal.player.left/box0', confidence: 'high', reason: 'Filnamnet matchar.', role: 'variant', group: 'players', poses: { start: 'VILA', end: 'REDO' }, alternatives: [{ slotId: 'deal.player.left/box1', reason: 'Granne.' }, { slotId: 'pose/vila', reason: 'ogiltig' }, { slotId: 'invented', reason: 'x' }, { slotId: 'transition.shoe/to-shoe', reason: 'tredje' }] },
    { fileId: unsure, slotId: 'deal.player.left/box1', confidence: 'low', reason: 'Osäkert.', role: 'standard', alternatives: [{ slotId: 'speak.goodluck/goodluck', reason: 'Kan vara tal.' }] },
    { fileId: speech, slotId: 'speak.goodluck/goodluck', confidence: 'medium', reason: 'Replik.', role: 'nonsense', group: 'speech', language: 'sv', take: 2 },
    { fileId: image, slotId: 'deal.player.left/box0', confidence: 'high', reason: 'fel' },
  ];
  const next = applyIntakeProposals(rows, proposals, catalog);
  assert.equal(next[0].slotId, 'deal.player.left/box0'); assert.equal(next[0].role, 'variant'); assert.equal(next[0].group, 'players'); assert.deepEqual(next[0].poses, { start: 'VILA', end: 'REDO' });
  assert.deepEqual(next[0].alternatives, [{ slotId: 'deal.player.left/box1', reason: 'Granne.' }, { slotId: 'transition.shoe/to-shoe', reason: 'tredje' }]);
  assert.equal(next[1].slotId, ''); assert.equal(next[1].confidence, 'low'); assert.equal(next[1].role, undefined);
  assert.deepEqual(next[1].alternatives, [{ slotId: 'deal.player.left/box1', reason: 'Osäkert.' }, { slotId: 'speak.goodluck/goodluck', reason: 'Kan vara tal.' }]);
  assert.equal(next[2].slotId, 'speak.goodluck/goodluck'); assert.equal(next[2].role, undefined); assert.equal(next[2].language, 'sv'); assert.equal(next[2].take, 2);
  assert.equal(next[3], rows[3], 'blocked image rows ignore proposals');
  assert.equal(rows[0].slotId, '', 'input rows are not mutated');
  // A second proposal replaces old advice instead of accumulating it.
  const replaced = applyIntakeProposals(next, [{ fileId: sure, slotId: 'deal.player.left/box1', confidence: 'medium', reason: 'Ny.' }], catalog);
  assert.equal(replaced[0].slotId, 'deal.player.left/box1'); assert.equal(replaced[0].role, undefined); assert.deepEqual(replaced[0].alternatives, []); assert.equal(replaced[0].poses, undefined);
  assert.deepEqual(applyIntakeProposals(rows, null, catalog), rows);
});

test('re-placing rows follows compatibility: video to any clip slot, audio to speech, images nowhere', () => {
  const rows = plan([file('clip.mp4'), file('line.wav'), file('still.png')]).rows;
  const [video, audio, image] = rows;
  assert.equal(intakeDropCheck(video, catalog.slots[1]).accepted, true);
  assert.equal(intakeDropCheck(video, catalog.slots[4]).accepted, true);
  assert.match(intakeDropCheck(video, catalog.slots[4]).reason, /talgranskning sker separat/);
  assert.equal(intakeDropCheck(video, catalog.slots[5]).accepted, false);
  assert.equal(intakeDropCheck(audio, catalog.slots[1]).accepted, false, 'audio rows are blocked before placement');
  assert.equal(intakeDropCheck(image, catalog.slots[1]).accepted, false);
  assert.equal(intakeDropCheck(video, undefined).accepted, false);
  assert.equal(intakeDropCheck({ ...video, state: 'saved' }, catalog.slots[1]).accepted, false);
  const chained = { ...video, slotId: 'deal.player.left/box0', poses: { start: 'VILA', end: 'REDO' }, alternatives: [{ slotId: 'x', reason: '' }], confidence: 'high', warnings: ['w'] };
  const moved = placeIntakeRow([chained, audio], video.id, 'deal.player.left/box1', catalog);
  assert.equal(moved[0].slotId, 'deal.player.left/box1'); assert.deepEqual(moved[0].poses, { start: 'VILA', end: 'REDO' }); assert.equal(moved[0].confidence, 'user'); assert.equal(moved[0].alternatives, undefined); assert.deepEqual(moved[0].warnings, []);
  assert.equal(moved[1], audio);
  assert.equal(placeIntakeRow([chained], video.id, 'speak.goodluck/goodluck', catalog)[0].poses, undefined, 'speech never carries a pose chain');
  assert.equal(placeIntakeRow([chained], video.id, 'transition.shoe/to-shoe', catalog)[0].poses, undefined, 'shoe transitions use their fixed chain');
  assert.equal(placeIntakeRow([chained], video.id, 'pose/vila', catalog)[0], chained);
  assert.equal(placeIntakeRow([chained], video.id, 'missing', catalog)[0], chained);
  assert.equal(INTAKE_DRAG_TYPE, 'application/x-scout-intake');
});

test('roles come from the server, then saved standards, then the map; placed rows upload as alternatives through the catalogue', () => {
  const row = { ...plan([file('clip.mp4')]).rows[0], slotId: 'deal.player.left/box0' };
  assert.equal(intakeRole({ ...row, role: 'variant' }, catalog, 'paow'), 'variant');
  assert.equal(intakeRole(row, { ...catalog, standards: { paow: { 'deal.player.left/box0': 'video-1' } } }, 'paow'), 'variant');
  assert.equal(intakeRole(row, { ...catalog, standards: { paow: { 'deal.player.left/box0': null } } }, 'paow'), 'standard');
  assert.equal(intakeRole(row, catalog, 'paow', () => true), 'variant');
  assert.equal(intakeRole(row, catalog, 'paow'), 'standard');
  assert.equal(intakeRole({ ...row, slotId: '' }, catalog, 'paow'), null);
  const classification = importClassification(row, 'paow', catalog);
  assert.equal(classification.role, 'alternative'); assert.equal(classification.situation, 'box0'); assert.equal(classification.compositing.mode, 'green-screen');
  assert.throws(() => importClassification({ ...row, background: 'alpha' }, 'paow', catalog), /transparent material/);
  assert.match(intakeRowIssue({ ...row, background: 'alpha' }, 'paow', catalog), /spärrad för import/);
  assert.match(intakeRowIssue({ ...row, slotId: '' }, 'paow', catalog), /Osäker · välj fack/);
  assert.equal(intakeRowIssue(row, 'paow', catalog), '');
  assert.equal(intakeRowIssue({ ...row, state: 'saving' }, 'paow', catalog), '');
  assert.match(intakeRowIssue(plan([file('still.png')]).rows[0], 'paow', catalog), /Bilder sparas inte/);
  const speech = { ...row, slotId: 'speak.goodluck/goodluck' };
  assert.equal(importClassification(speech, 'paow', catalog).kind, 'speech');
  const summary = intakeSummary([row, { ...row, id: 'b', slotId: '' }, { ...row, id: 'c', state: 'saved' }, plan([file('still.png')]).rows[0]], 'paow', catalog);
  assert.equal(summary.ready, 1); assert.equal(summary.unplaced, 1); assert.equal(summary.saved, 1); assert.equal(summary.issues.length, 2); assert.equal(summary.total, 4);
  assert.deepEqual(intakeUploadRows([row, { ...row, id: 'b', slotId: '' }, { ...row, id: 'c', state: 'saved' }]).map(item => item.id), [row.id]);
});

test('destinations read "Kategori › Situation" from server captions or from the map groups', () => {
  const slots = clipSlots(createSeedProject(), { videos: [] }, 'astrid'), groups = groupSlots(slots);
  const fromMap = intakeDestination('deal.player.left/box0', catalog, groups);
  assert.deepEqual([fromMap.title, fromMap.caption, fromMap.label, fromMap.group], ['Dela till spelare', 'Plats 1', 'Dela till spelare › Plats 1', 'players']);
  assert.equal(intakeDestination('idle.ready/', catalog, groups).label, 'Vila › Basloop och beteendeklipp');
  assert.equal(intakeDestination('transition.shoe/to-shoe', catalog, groups).label, 'Redo › Till skon');
  assert.equal(intakeDestination('speak.goodluck/goodluck', catalog, groups).label, 'Talade repliker › Lycka till');
  const served = { ...catalog, groups: [{ id: 'players', title: 'Dela till spelare', subtitle: 'Plats 1–7' }],
    slots: catalog.slots.map(slot => slot.id === 'deal.player.left/box0' ? { ...slot, group: 'players', caption: 'Spelarplats 1', explanation: 'Kort till plats 1.' } : slot) };
  const fromServer = intakeDestination('deal.player.left/box0', served, []);
  assert.equal(fromServer.label, 'Dela till spelare › Spelarplats 1'); assert.equal(fromServer.explanation, 'Kort till plats 1.');
  assert.equal(intakeDestination('pose/vila', catalog, groups).label, 'Referensbild › VILA · referensbild');
  assert.equal(intakeDestination('unknown/slot', catalog, groups).label, 'Övrigt › unknown/slot');
  assert.equal(intakeDestination('', catalog, groups), null);
});

test('dropped folders are read recursively with their relative paths and bounded', async () => {
  const fileEntry = (name, path) => ({ isFile: true, isDirectory: false, name, fullPath: path, file: resolve => resolve(file(name)) });
  const directory = (name, children) => ({ isFile: false, isDirectory: true, name, createReader: () => { let served = false; return { readEntries: (resolve) => { if (served) resolve([]); else { served = true; resolve(children); } } }; } });
  const tree = directory('paow', [fileEntry('idle.mp4', '/paow/idle.mp4'), directory('repliker', [directory('sv', [fileEntry('goodluck_1.mp4', '/paow/repliker/sv/goodluck_1.mp4')])])]);
  const loose = file('loose.mp4');
  const transfer = { items: [{ webkitGetAsEntry: () => tree }, { webkitGetAsEntry: () => null, getAsFile: () => loose }], files: [] };
  const result = await collectDroppedFiles(transfer);
  assert.deepEqual(result.files.map(entry => entry.path ?? null), ['paow/idle.mp4', 'paow/repliker/sv/goodluck_1.mp4', null]);
  assert.equal(result.files[2].file, loose); assert.equal(result.truncated, false);
  const bounded = await collectDroppedFiles(transfer, { limit: 2 });
  assert.equal(bounded.files.length, 2); assert.equal(bounded.truncated, true);
  const plain = Object.assign(file('chosen.mp4'), {});
  const fallback = await collectDroppedFiles({ items: [], files: [plain] });
  assert.equal(fallback.files.length, 1); assert.equal(fallback.files[0].path, undefined);
  assert.deepEqual(await collectDroppedFiles(null), { files: [], truncated: false });
});


test('a delayed folder read is discarded after the target context cancels it',async()=>{
  const abort=new AbortController();let release;
  const entry={isFile:true,file:resolve=>{release=resolve;}};
  const pending=collectDroppedFiles({items:[{webkitGetAsEntry:()=>entry}]},{signal:abort.signal});
  const rejected=assert.rejects(pending,{name:'AbortError'});
  abort.abort();release(file('dealer-a.mp4'));await rejected;
  const next=await collectDroppedFiles({files:[file('dealer-b.mp4')]});
  assert.equal(next.files[0].file.name,'dealer-b.mp4');
});

test('folder pagination stops after reaching the file limit',async()=>{
  let reads=0;
  const entry={isDirectory:true,name:'clips',createReader:()=>({readEntries(resolve){
    reads++;
    resolve(reads<=5?[0,1].map(i=>({isFile:true,file:done=>done(file(`clip-${reads}-${i}.mp4`))})):[]);
  }})};
  const result=await collectDroppedFiles({items:[{webkitGetAsEntry:()=>entry}]},{limit:2});
  assert.equal(result.files.length,2);assert.equal(result.truncated,true);
  assert.ok(reads<=2,`read ${reads} directory pages although the queue was already full`);
});
