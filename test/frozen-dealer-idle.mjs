import test from 'node:test';
import assert from 'node:assert/strict';
import { addDealer, createSeedProject, defaultPresentationLane } from '../lab/lib/studio-model.mjs';
import { BASE_DEALER_IDS } from '../web/dealer-identity.mjs';
import { buildPresentationPackage } from '../web/presentation-layers.mjs';
import { encodePresentationPackage, decodePresentationPackage } from '../web/storage/presentation-package.mjs';
import {captureFrozenPresentation} from '../web/storage/frozen-presentation-capture.mjs';
import {validateRouletteIdleBinding,validateRouletteForegroundPolygons} from '../web/public/roulette-idle-contract.mjs';
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
  project.lanes = [defaultPresentationLane('johanna')];
  const lane = project.lanes[0]; lane.id = 'johns-johanna'; lane.label = 'Johns Johanna';
  lane.dealers = ['johanna']; lane.layers.dealer = { enabled: true, default: 'johanna', allowed: ['johanna'] };
  return { project, selectedLaneIds: [lane.id], inventory: { videos: [video(johanna), video(nora)], families: [] },
    mediaRows: [{ ...johanna, revision: 'media-johanna-1', updatedAt: '2026-10-09T00:00:00.000Z' },
      { ...nora, revision: 'media-nora-1', updatedAt: '2026-10-09T00:00:00.000Z' }], requiredIdleDealerIds: ['johanna'] };
}
const resolve = entries => resolveFrozenDealerIdle(entries, { dealerId: 'johanna', allowedDealerIds: ['johanna'] });
const code = (expected, status = 422) => error => error.code === expected && error.statusCode === status;

function rouletteFixture() {
  const input=fixture(),dealer=input.project.dealers.find(row=>row.id==='johanna');
  const records=['breathing','glasses-clean'].map((action,i)=>{
    const id=`20000000-0000-4000-8000-00000000000${i+1}`,sha256=String(i+3).repeat(64);
    return {id,sha256,size:4096,contentType:'video/webm',pathname:`croupier/media/dealers/johanna/review/uploads/${id}/${sha256}.webm`,
      classification:{dealerId:'johanna',eventId:'roulette.idle',kind:'idle',role:'standard',situation:action,label:action,notes:'',playback:'once',
        game:'roulette',action,startPose:'VILA',endPose:'VILA',compositing:{mode:'alpha'},framing:{scale:1,x:0,y:0}}};
  });
  dealer.rouletteIdle={videoId:records[0].id,variantVideoIds:[records[1].id],foregroundPolygons:[[[.2,.2],[.4,.2],[.4,.4]]]};
  input.inventory.videos.push(...records.map(video));input.mediaRows.push(...records.map((row,i)=>({...row,revision:'roulette-'+i})));
  input.requiredRouletteIdleDealerIds=['johanna'];return {input,records,dealer};
}

test('optional wheel start freezes its own profile and CAS bytes without changing legacy or roulette idle',()=>{
  const {input,records,dealer}=rouletteFixture(),clip=structuredClone(records[0]);
  clip.id='30000000-0000-4000-8000-000000000001';clip.sha256='9'.repeat(64);
  clip.pathname=`croupier/media/dealers/johanna/review/uploads/${clip.id}/${clip.sha256}.webm`;
  Object.assign(clip.classification,{eventId:'roulette.wheel-start',kind:'action',action:'wheel-start',situation:'wheel-start',framing:{scale:1.2,x:.1,y:0}});
  dealer.rouletteStart={videoId:clip.id,tableDesignId:'roulette-anna-v1',durationMs:10042,wheelImpulseMs:2200,ballReleaseMs:4000};
  input.inventory.videos.push(video(clip));input.mediaRows.push({...clip,revision:'wheel-one'});
  const result=captureFrozenRegisteredDealers(input),entry=result.registeredDealers[0];
  assert.deepEqual(entry.rouletteStart.clip,clip);assert.equal(entry.rouletteStart.wheelImpulseMs,2200);
  assert.equal(entry.idle.id,JOHANNA_ID);assert.equal(entry.rouletteIdle.base.id,records[0].id);
  const capture=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:input.project.revision,value:input.project},
    administrationDocument:{kind:'administration',revision:'admin-one',value:{rooms:[]}},mediaRows:input.mediaRows},inventory:input.inventory,selectedLaneIds:input.selectedLaneIds});
  assert.deepEqual(decodePresentationPackage(encodePresentationPackage(capture.presentation)).registeredDealers[0].rouletteStart,entry.rouletteStart);
  assert.ok(capture.mediaPreconditions.some(row=>row.id===clip.id));
  const changed=structuredClone(input.mediaRows);changed.at(-1).classification.framing.x=.2;
  assert.throws(()=>assertFrozenMediaPreconditions(capture.mediaPreconditions,changed),code('studio_conflict',409));
  input.inventory.videos.at(-1).available=false;assert.throws(()=>captureFrozenRegisteredDealers(input));
  input.inventory.videos.at(-1).available=true;delete dealer.rouletteIdle;assert.throws(()=>captureFrozenRegisteredDealers(input));
});
test('explicit roulette base and glasses variant freeze separately from blackjack with every media CAS precondition',()=>{
  const {input,records,dealer}=rouletteFixture(),before=structuredClone(input);
  const result=captureFrozenRegisteredDealers(input),entry=result.registeredDealers[0];
  assert.equal(entry.idle.id,JOHANNA_ID);assert.deepEqual(entry.rouletteIdle.base,records[0]);assert.deepEqual(entry.rouletteIdle.variants,[records[1]]);
  assert.equal(resolveFrozenDealerIdle(result.registeredDealers,{dealerId:'johanna',allowedDealerIds:['johanna'],game:'roulette'}).id,records[0].id);
  assert.equal(resolve(result.registeredDealers).id,JOHANNA_ID);
  assert.equal(resolveFrozenDealerIdle(result.registeredDealers,{dealerId:'johanna',allowedDealerIds:['nora'],game:'roulette'}),null);
  const capture=captureFrozenPresentation({snapshot:{projectDocument:{kind:'project',revision:input.project.revision,value:input.project},
    administrationDocument:{kind:'administration',revision:'admin-one',value:{rooms:[]}},mediaRows:input.mediaRows},
    inventory:input.inventory,selectedLaneIds:input.selectedLaneIds,requiredRouletteIdleDealerIds:['johanna']});
  assert.deepEqual(capture.mediaPreconditions.map(row=>row.id).sort(),[JOHANNA_ID,...records.map(row=>row.id)].sort());
  assert.deepEqual(decodePresentationPackage(encodePresentationPackage(capture.presentation)).registeredDealers[0].rouletteIdle,entry.rouletteIdle);
  const changed=structuredClone(input.mediaRows);changed.find(row=>row.id===records[1].id).revision='changed';
  assert.throws(()=>assertFrozenMediaPreconditions(capture.mediaPreconditions,changed),code('studio_conflict',409));
  assert.deepEqual(input,before);dealer.rouletteIdle.videoId=records[1].id;assert.equal(entry.rouletteIdle.base.id,records[0].id);
});
test('roulette capture never substitutes inventory, blackjack, a different dealer or a non-idle action',()=>{
  for(const mutate of [
    ({dealer})=>delete dealer.rouletteIdle,
    ({dealer})=>dealer.rouletteIdle.videoId=JOHANNA_ID,
    ({input,records})=>input.inventory.videos.find(row=>row.id===records[0].id).available=false,
    ({input,records})=>input.mediaRows.find(row=>row.id===records[1].id).classification.dealerId='nora',
    ({input,records})=>{for(const row of [input.mediaRows.find(row=>row.id===records[1].id),input.inventory.videos.find(row=>row.id===records[1].id)])row.classification.framing.x=.1;},
    ({dealer,records})=>dealer.rouletteIdle.variantVideoIds=[records[0].id],
  ]) {const f=rouletteFixture();mutate(f);assert.throws(()=>captureFrozenRegisteredDealers(f.input));}
  const f=rouletteFixture();delete f.dealer.rouletteIdle;f.input.requiredRouletteIdleDealerIds=[];
  const captured=captureFrozenRegisteredDealers(f.input);
  assert.equal(resolveFrozenDealerIdle(captured.registeredDealers,{dealerId:'johanna',allowedDealerIds:['johanna'],game:'roulette'}),null);
});
test('roulette binding and foreground parser reject decorated, oversized, duplicate and unsafe data',()=>{
  const {dealer}=rouletteFixture();assert.deepEqual(validateRouletteIdleBinding(dealer.rouletteIdle),dealer.rouletteIdle);
  for(const change of [v=>v.variantVideoIds=Array(4).fill(NEW_ID),v=>v.unknown=true,v=>v.videoId='anna.webm',v=>v.foregroundPolygons=[[[0,0],[1,1],[2,0]]]]) {
    const value=structuredClone(dealer.rouletteIdle);change(value);assert.throws(()=>validateRouletteIdleBinding(value));
  }
  let called=false;const getter={get videoId(){called=true;return NEW_ID;}};assert.throws(()=>validateRouletteIdleBinding(getter));assert.equal(called,false);
  for(const value of [[],Array(5).fill([[0,0],[1,0],[1,1]]),[[[0,0],[0,0],[1,1]]],[[[0,0],[.5,.5],[1,1]]]])assert.throws(()=>validateRouletteForegroundPolygons(value));
});

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
test('historical registries remain readable without granting local playback authority', () => {
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
test('historical v1 package remains readable but a new capture requires saved cloud media', () => {
  const project = createSeedProject(); project.lanes=[defaultPresentationLane('astrid')];
  const selectedLaneIds = [project.lanes[0].id], before = structuredClone(project);
  const packageBefore = buildPresentationPackage(project, selectedLaneIds, []), envelopeBefore = encodePresentationPackage(packageBefore);
  assert.throws(() => captureFrozenRegisteredDealers({ project, selectedLaneIds, inventory: null, mediaRows: null }));
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
