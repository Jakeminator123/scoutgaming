import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolveNativeRoomGameMaterial } from '../packages/presentation/server/native-room-game-material.mjs';
import { assertNativeRoomSequenceBudget, NATIVE_ROOM_PRESENTATION_CONTRACT } from '../packages/presentation/contracts/native-room-game-budget.mjs';
import { recordedSpeechIdentity } from '../packages/presentation/contracts/recorded-speech.mjs';
import { presentationEvents } from '../services/game/partner-presentation.mjs';
import { nativeRoomMaterialFixture, measuredFixtureRecord } from './fixtures/native-room-game-material.mjs';

const resolve = f => resolveNativeRoomGameMaterial(f.input);
const denied = reason => error => error?.code === 'studio_room_game_material_unavailable' && error.statusCode === 422 && (!reason || error.reason === reason);
const rebindSpeech = row => {
  const speech = row.classification.recordedSpeech, identity = recordedSpeechIdentity(speech);
  speech.recording.identity = structuredClone(identity); speech.review.identity = structuredClone(identity);
};
const guard = (material,steps,draws) => assertNativeRoomSequenceBudget({material,steps,draws,presentationContract:NATIVE_ROOM_PRESENTATION_CONTRACT});

test('native producer uses complete measured frozen Dragan and PAOW banks without changing inputs', () => {
  for (const dealerId of ['dragan','paow']) for (const language of ['sv','en']) {
    const f = nativeRoomMaterialFixture({dealerId,language}), before = structuredClone(f.input), result = resolve(f);
    assert.deepEqual(f.input,before);
    assert.equal(result.dealerId,dealerId); assert.equal(result.language,language);
    assert.match(result.revision,/^native-film-v1-[a-f0-9]{64}$/);
    assert.equal(result.media.length,46);
    assert.deepEqual(new Set(result.media.map(row => row.id)),new Set(f.records.map(row => row.id)));
    assert.equal(result.cardMs,dealerId === 'dragan' ? 2830 : 2580);
    assert.equal(result.leadMs,dealerId === 'dragan' ? 9205 : 9914);
    assert.deepEqual(resolve(f),result);
  }
});

test('branding-only republication preserves material revision; another room does not', () => {
  const f = nativeRoomMaterialFixture(), original = resolve(f);
  f.input.package.revision += 1;
  f.input.package.branding.theme = 'another-brand';
  assert.deepEqual(resolve(f),original);
  f.input.room.id = 'room-other'; f.input.package.tables = ['room-other'];
  assert.notEqual(resolve(f).revision,original.revision);
});

test('missing measurement and a foreign language refuse native publication', () => {
  const missing = nativeRoomMaterialFixture(); delete missing.records.find(row => row.classification.kind === 'speech').mediaTiming; missing.recapture();
  assert.throws(() => resolve(missing),denied('native_material_measurement_missing'));
  const language = nativeRoomMaterialFixture(); language.input.language = 'en';
  assert.throws(() => resolve(language),denied('native_material_speech_unbound'));
});

test('measurement hashes, frames, identity and approval cannot be substituted', () => {
  const mutations = [
    row => { row.mediaTiming.sha256 = 'f'.repeat(64); },
    row => { measuredFixtureRecord(row,{frames:49,audioEndUs:2_000_000}); },
    row => { row.mediaTiming.recordedSpeechIdentitySha256 = 'e'.repeat(64); },
    row => { row.classification.recordedSpeech.review = {status:'pending'}; },
  ];
  for (const mutate of mutations) {
    const f = nativeRoomMaterialFixture(); mutate(f.records.find(row => row.classification.kind === 'speech'));
    // Either the shared frozen-record validator or the producer must reject it.
    assert.throws(() => {f.recapture();resolve(f);});
  }
});

test('missing film take, substituted profile frames and cut action audio are rejected', () => {
  const f = nativeRoomMaterialFixture(), row = f.records.find(row => row.classification.kind === 'action');
  f.presentation.playback.media = f.records.filter(candidate => candidate.id !== row.id);
  for (const line of f.presentation.playback.lines) for (const variant of line.variants) if (variant.videoGenerationId === row.id) variant.videoGenerationId = null;
  f.recapture(); assert.throws(() => resolve(f),denied('native_material_bank_incomplete'));
  const frames = nativeRoomMaterialFixture(), action = frames.records.find(row => row.classification.kind === 'action');
  measuredFixtureRecord(action,{frames:action.mediaTiming.video.frameCount+1}); frames.recapture();
  assert.throws(() => resolve(frames),denied('native_material_take_mismatch'));
  const audio = nativeRoomMaterialFixture(), sound = audio.records.find(row => row.classification.kind === 'action');
  measuredFixtureRecord(sound,{frames:sound.mediaTiming.video.frameCount,audioEndUs:2_000_000}); audio.recapture();
  assert.throws(() => resolve(audio),denied('native_material_take_audio_truncated'));
});

test('whole spoken audio tail is budgeted and the material limit never trims it', () => {
  const f = nativeRoomMaterialFixture(), before = resolve(f), speech = f.records.find(row => row.classification.situation === 'placebets');
  measuredFixtureRecord(speech,{audioEndUs:3_000_000}); f.recapture();
  const after = resolve(f);
  assert.equal(after.leadMs-before.leadMs,3000); assert.notEqual(after.revision,before.revision);
  measuredFixtureRecord(speech,{audioEndUs:30_000_000}); f.recapture();
  assert.throws(() => resolve(f),denied('native_material_timing_limit'));
});

test('every extra selected speech variant is admitted and budgeted or explicitly rejected', () => {
  const f = nativeRoomMaterialFixture(), before = resolve(f), original = f.records.find(row => row.classification.situation === 'goodluck');
  const extra = structuredClone(original); extra.id = '20000000-0000-4000-8000-000000000001';
  extra.sha256 = createHash('sha256').update('synthetic additional speech').digest('hex');
  extra.pathname = `croupier/media/dealers/dragan/review/uploads/${extra.id}/${extra.sha256}.mp4`;
  extra.classification.recordedSpeech.videoSha256 = extra.sha256;
  extra.classification.recordedSpeech.takeId = 'goodluck_2';
  extra.classification.recordedSpeech.frameCount = 96; rebindSpeech(extra);
  measuredFixtureRecord(extra,{frames:96,audioEndUs:4_000_000}); f.records.push(extra);
  const line = f.presentation.playback.lines.find(row => row.eventId === 'speak.goodluck');
  line.variants.push({...structuredClone(line.variants[0]),id:'dragan.speak.goodluck.extra',videoGenerationId:extra.id,selection:{rules:true,random:true,model:true}});
  f.recapture(); const result = resolve(f);
  assert.equal(result.media.length,47); assert.ok(result.media.some(row => row.id === extra.id));
  assert.equal(result.leadMs-before.leadMs,4000);
  extra.classification.recordedSpeech.review = {status:'pending'}; f.recapture();
  assert.throws(() => resolve(f),denied('native_material_speech_unbound'));
});

test('native sequence guard rejects new unsupported events, counts and contracts', () => {
  const material = resolve(nativeRoomMaterialFixture());
  const deal = {type:'deal',to:'box',box:0,faceDown:false,shoeDraw:1};
  const reveal = {type:'reveal',to:'dealer',shoeDraw:2};
  assert.equal(guard(material,[reveal,{type:'speak',line:'win'}],0),true);
  assert.equal(guard(material,[{type:'speak',line:'double'},deal,reveal,{type:'speak',line:'win'}],1),true);
  for (const [steps,draws] of [
    [[deal],0], [[deal,deal],2], [[reveal,reveal],0], [[{type:'speak',line:'placebets'}],0],
    [[{type:'speak',line:'goodluck'},{type:'speak',line:'insurance'},{type:'speak',line:'win'}],0],
    [[{type:'speak',line:'insurance'},{type:'speak',line:'win'}],0], [[{type:'new-timed-media'}],0],
    [[{...deal,box:7}],1], [[{type:'idle'}],0],
  ]) assert.throws(() => guard(material,steps,draws),{code:'native_room_sequence_unsupported'});
  assert.throws(() => assertNativeRoomSequenceBudget({material,steps:[],draws:0,presentationContract:'blackjack-presentation/2'}),{code:'native_room_sequence_unsupported'});
  assert.equal(assertNativeRoomSequenceBudget({material:{revision:'existing-format'},steps:[{type:'old-event'}],draws:0}),false);
});

test('real presentation generator satisfies native bounds for start, insurance and double settlement', () => {
  const material = resolve(nativeRoomMaterialFixture());
  const card = (r,shoeDraw) => ({r,s:'h',shoeDraw});
  const initial = {round:{phase:'decisions',holeDraw:4,hands:[{box:0,stake:10,cards:[card('8',1),card('9',3)],result:0}],dealer:[card('6',2)]}};
  const insured = structuredClone(initial); insured.round.phase = 'insurance'; insured.round.dealer[0].r = 'A';
  const settled = structuredClone(initial); settled.round.phase = 'settled'; settled.round.dealer.push(card('K',4),card('7',5)); settled.round.hands[0].result=20;
  for (const [before,after,op,action] of [[null,initial,'start',null],[null,insured,'start',null],[null,settled,'start',null],[initial,settled,'act','double'],[insured,settled,'insurance',null]]) {
    const steps = presentationEvents(before,after,op,{action});
    assert.equal(guard(material,steps,steps.filter(row => row.type === 'deal').length),true);
  }
});

test('unknown extra action bytes and foreign room ownership cannot enter the material', () => {
  const wrong = nativeRoomMaterialFixture(); wrong.input.package.operatorId = 'another-operator';
  assert.throws(() => resolve(wrong),denied('native_material_room_mismatch'));
  const f = nativeRoomMaterialFixture(), source = f.records.find(row => row.classification.kind === 'action');
  const extra = structuredClone(source); extra.id = '30000000-0000-4000-8000-000000000001';
  extra.sha256 = createHash('sha256').update('unknown action bytes').digest('hex');
  extra.pathname = `croupier/media/dealers/dragan/review/uploads/${extra.id}/${extra.sha256}.mp4`;
  measuredFixtureRecord(extra,{frames:source.mediaTiming.video.frameCount}); f.records.push(extra);
  const line = f.presentation.playback.lines.find(row => row.eventId === source.classification.eventId);
  line.variants.push({...structuredClone(line.variants[0]),id:'dragan.'+line.eventId+'.unknown-extra',videoGenerationId:extra.id});
  f.recapture(); assert.throws(() => resolve(f),denied('native_material_take_unrecognized'));
});

test('explicit measured shoe transitions contribute their entire durations to every shot bound', () => {
  const f = nativeRoomMaterialFixture(), before = resolve(f);
  const line = f.presentation.playback.lines.find(row => row.eventId === 'transition.shoe');
  for (const [index,situation,frames,startPose,endPose] of [[1,'to-shoe',48,'VILA','REDO'],[2,'from-shoe',24,'REDO','VILA']]) {
    const row = structuredClone(f.records.find(item => item.classification.kind === 'action'));
    row.id = `40000000-0000-4000-8000-00000000000${index}`;
    row.sha256 = createHash('sha256').update('synthetic '+situation).digest('hex');
    row.pathname = `croupier/media/dealers/dragan/review/uploads/${row.id}/${row.sha256}.mp4`;
    Object.assign(row.classification,{eventId:'transition.shoe',situation,startPose,endPose});
    measuredFixtureRecord(row,{frames}); f.records.push(row);
    line.variants.push({...structuredClone(line.variants[0]),id:`dragan.transition.shoe.slot.${situation}`,videoGenerationId:row.id});
  }
  f.recapture(); const after = resolve(f);
  assert.equal(after.leadMs-before.leadMs,3000); assert.equal(after.cardMs-before.cardMs,3000);
  delete f.records.at(-1).classification.startPose; delete f.records.at(-1).classification.endPose;
  f.recapture(); assert.throws(() => resolve(f),denied('native_material_transition_pose_missing'));
});

test('actual betting-window instructions are bounded to one placebets and idle', () => {
  // This unit exercises the independent instruction contract, not publication.
  const material = {revision:'native-film-v1-'+'a'.repeat(64),dealerId:'dragan',language:'sv',leadMs:10000,cardMs:3000,
    media:[{id:'10000000-0000-4000-8000-000000000001',sha256:'b'.repeat(64)}]};
  const steps = presentationEvents(null,null,'collect');
  const window = values => assertNativeRoomSequenceBudget({material,steps,draws:0,kind:'window',presentationContract:NATIVE_ROOM_PRESENTATION_CONTRACT,...values});
  assert.equal(window({}),true);
  for (const change of [{draws:1},{steps:[...steps,{type:'speak',line:'goodluck'}]},
    {steps:[{type:'speak',line:'win'},{type:'idle'}]},{steps:[...steps].reverse()},
    {steps:[{type:'idle'}]},{kind:'collect'},{presentationContract:'blackjack-presentation/2'}]) {
    assert.throws(() => window(change),{code:'native_room_sequence_unsupported'});
  }
});

test('additional approved Admin speech slots stay frozen and bounded alongside the runtime core',()=>{
  const core=resolve(nativeRoomMaterialFixture()),full=nativeRoomMaterialFixture({allSpeechSlots:true});
  const material=resolve(full);
  assert.equal(material.media.length,53);assert.equal(material.leadMs,core.leadMs);
  assert.equal(material.cardMs,core.cardMs);assert.notEqual(material.revision,core.revision);
  const greeting=full.records.find(row=>row.classification.situation==='greeting');
  assert.ok(material.media.some(row=>row.id===greeting.id&&row.sha256===greeting.sha256));
  greeting.classification.recordedSpeech.review={status:'pending'};full.recapture();
  assert.throws(()=>resolve(full),denied('native_material_speech_unbound'));
});
