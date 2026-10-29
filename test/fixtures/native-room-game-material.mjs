import { createHash } from 'node:crypto';
import { requiredNativeFilmedTakes } from '../../packages/presentation/runtime/filmed-deal-coverage.mjs';
import { cloudPresentationFixture } from '../../apps/studio/test/fixtures/cloud-presentation.mjs';
import { defaultPresentationLane } from '../../packages/presentation/contracts/studio-model.mjs';
import { bindFilmedBank } from '../../packages/presentation/contracts/filmed-bank-bindings.mjs';
import { registeredFilmedProfile } from '../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import { expandStudioFilmedProfile } from '../../packages/presentation/contracts/filmed-profiles/studio-profile.mjs';
import { bindSpeechSlotStandard, speechSlotEventId, SPEECH_SLOT_IDS } from '../../packages/presentation/contracts/speech-slot-bindings.mjs';
import { recordedSpeechIdentity } from '../../packages/presentation/contracts/recorded-speech.mjs';
import { mediaTimingSpeechIdentity } from '../../packages/presentation/contracts/media-timing.mjs';
import { NATIVE_ROOM_SPEECH_SLOTS } from '../../packages/presentation/contracts/native-room-game-budget.mjs';
import { serialize } from 'node:v8';
import { withPackagePresentation, PRESENTATION_PACKAGE_KEY } from '../../packages/presentation/server/presentation-package.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
/** Test-only memo of the product writer. Brotli q11 makes each call ~0.5 s and
 * fixtures re-encode identical inputs many times. The key is the exact structured
 * input (undefined values and key order included), so each distinct input still
 * runs the real writer once; failures are never cached, and every result is a
 * fresh copy whose envelope is frozen exactly as the writer returns it. */
const packageCache = new Map();
export function capturePackagePresentation(branding, presentation, options) {
  let key;
  try { key = hash(serialize([branding ?? null, presentation, options ?? null])); }
  catch { return withPackagePresentation(branding, presentation, options); }
  if (!packageCache.has(key)) packageCache.set(key, withPackagePresentation(branding, presentation, options));
  const copy = structuredClone(packageCache.get(key));
  Object.freeze(copy[PRESENTATION_PACKAGE_KEY]);
  return copy;
}
const uuid = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function measuredFixtureRecord(row,{frames=48,fps=24,audioEndUs=null} = {}) {
  const endUs = Math.ceil(frames*1e6/fps), speech = row.classification.recordedSpeech;
  row.mediaTiming = {schemaVersion:1,mediaId:row.id,sha256:row.sha256,size:row.size,
    recordedSpeechIdentitySha256:speech ? hash(mediaTimingSpeechIdentity(speech)) : null,
    video:{trackId:1,frameCount:frames,fps,firstPtsUs:0,lastPtsUs:Math.round((frames-1)*1e6/fps),endUs},
    audio:audioEndUs === null ? [] : [{trackId:2,firstPtsUs:0,endUs:audioEndUs}],
    endUs:Math.max(endUs,audioEndUs??0),audioTailUs:Math.max(0,(audioEndUs??0)-endUs)};
  return row;
}

/** Synthetic declared unit-test records only: no files, databases or approvals
 * of real material. Profile hashes describe the checked-in source contract. */
/** copyOf: a new dealer whose frozen studio profile copies that code profile's
 * landings onto its own synthetic clips (same poses and frame counts). */
export function studioCopyProfile(dealerId,copyOf) {
  const base=registeredFilmedProfile(copyOf);
  return {schemaVersion:1,id:`studio-${dealerId}-${hash('copy:'+dealerId).slice(0,8)}`,kind:'copy',base:base.id,
    takes:Object.fromEntries(base.takes.map(take=>[take.key,{sha256:hash(`synthetic ${dealerId} ${take.key}`)}]))};
}
/** copyFrames: per take key, a longer own clip's frame count kept in the copy (dealer-fabriken's -iu takes). */
export function nativeRoomMaterialFixture({dealerId='dragan',copyOf=null,copyFrames={},language='sv',capture=true,allSpeechSlots=false,idOffset=0,speechSchemaVersion=1} = {}) {
  if (![1,2].includes(speechSchemaVersion)) throw new TypeError('Unsupported synthetic speech schema');
  const fixture = cloudPresentationFixture({lanes:[defaultPresentationLane(dealerId)]});
  const filmedProfile = copyOf ? studioCopyProfile(dealerId,copyOf) : null;
  for (const [key,frames] of Object.entries(copyFrames)) filmedProfile.takes[key].frames = frames;
  const profile = filmedProfile ? expandStudioFilmedProfile(filmedProfile,{dealerId}) : registeredFilmedProfile(dealerId), presentation = fixture.presentation;
  if (filmedProfile) presentation.registeredDealers[0].filmedProfile = filmedProfile;
  let project = fixture.project, n = 1 + idOffset;
  const idle = presentation.playback.media[0]; measuredFixtureRecord(idle);
  presentation.registeredDealers[0].idle = structuredClone(idle);
  const rows = [idle];
  const record = ({sha256,id=uuid(n++),classification}) => ({id,sha256,size:4096,contentType:'video/mp4',
    pathname:`croupier/media/dealers/${dealerId}/review/uploads/${id}/${sha256}.mp4`,
    classification:{dealerId,role:'alternative',label:'Synthetic contract fixture',notes:'Unit test only',compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0},...classification}});
  for (const take of profile.takes) {
    const box = Number(take.target)-1;
    const eventId = take.target === 'flip' ? 'reveal.dealer' : ['dealer','hole'].includes(take.target) ? 'deal.dealer'
      : `deal.player.${box<2?'left':box<5?'centre':'right'}`;
    const situation = ['hole','flip'].includes(take.target) ? 'dealer-hole' : take.target === 'dealer' ? 'dealer-up' : `box${box}`;
    rows.push(measuredFixtureRecord(record({sha256:take.sha256,classification:{eventId,situation,kind:'action',startPose:take.startPose,endPose:take.endPose}}),{frames:take.frames,fps:profile.plane.fps}));
  }
  const inventory = () => ({videos:rows.map(row => ({...row,dealer:dealerId,available:true,integrity:'verified',bytes:row.size})),families:[]});
  if (!filmedProfile) project = bindFilmedBank(project,inventory(),dealerId);
  // The same variants bindFilmedBank writes, from the dealer's own studio profile.
  else for (const take of profile.takes) {
    const row = rows.find(item => item.sha256 === take.sha256), line = project.lines.find(item => item.dealerId === dealerId && item.eventId === row.classification.eventId);
    line.variants.push({id:`${dealerId}.${line.eventId}.filmed.${take.target}.${take.variant||'base'}`,label:take.key,priority:0,triggerIds:[],
      assetId:line.variants.find(item => item.id === line.baselineVariantId).assetId,videoGenerationId:row.id,selection:{rules:false,model:false,random:false}});
  }
  for (const lineId of allSpeechSlots ? SPEECH_SLOT_IDS : NATIVE_ROOM_SPEECH_SLOTS) {
    const sha256 = hash(`synthetic:${dealerId}:${language}:${lineId}`), eventId = speechSlotEventId(lineId);
    const speech = {schemaVersion:speechSchemaVersion,dealerId,lineId,takeId:lineId+'_1',language,exactText:'Synthetic unit test line.',
      videoSha256:sha256,fps:24,frameCount:48,entryPose:'VILA',exitPose:'VILA',
      ...(speechSchemaVersion===2?{sourceKind:'embedded-mp4-av',videoTrackId:1,audioTrackId:2,source:{status:'pending'}}
        :{audioSha256:hash(`audio:${lineId}`),indexSha256:hash(`index:${lineId}`),audioDelayMs:0,calibrationRevision:'synthetic-fixture-1',recording:{status:'pending'}}),
      review:{status:'pending'}};
    const proof = {by:'unit-test-fixture',at:'2026-10-26T00:00:00.000Z',identity:recordedSpeechIdentity(speech)};
    if(speechSchemaVersion===2)speech.source = {status:'verified-embedded-av',...structuredClone(proof)};
    else speech.recording = {status:'verified-recording',...structuredClone(proof)};
    speech.review = {status:'approved',...structuredClone(proof)};
    const row = measuredFixtureRecord(record({sha256,classification:{kind:'speech',eventId,situation:lineId,recordedSpeech:speech}}),{audioEndUs:2_000_000});
    rows.push(row);
    project = bindSpeechSlotStandard(project,{dealerId,eventId,situation:lineId,videoId:row.id});
  }
  presentation.playback.lines = structuredClone(project.lines);
  presentation.playback.media = rows;
  const room = {schemaVersion:2,id:'room-native-fixture',name:'Fixture',operatorId:'operator-fixture',presentationLaneId:presentation.lanes[0].id,gameLaneId:'fixture-lane',state:'live'};
  const pack = {operatorId:room.operatorId,revision:7,tables:[room.id],games:['blackjack'],lanes:[room.presentationLaneId],branding:{}};
  const recapture = () => { pack.branding = capturePackagePresentation({},presentation,{allowExtended:true}); };
  if (capture) recapture();
  return {input:{package:pack,room,language},presentation,project,records:rows,profile,recapture};
}

/** Two complete synthetic banks in one frozen lane, with distinct media IDs. */
export function nativeRoomMaterialChoicesFixture({language='sv',speechSchemaVersion=1,allSpeechSlots=false}={}) {
  const options={language,speechSchemaVersion,allSpeechSlots,capture:false};
  const primary=nativeRoomMaterialFixture(options);
  const alternate=nativeRoomMaterialFixture({...options,dealerId:'paow',idOffset:1000});
  const lane=primary.presentation.lanes[0];
  lane.dealers=['dragan','paow'];lane.layers.dealer.allowed=[...lane.dealers];
  primary.presentation.registeredDealers.push(...alternate.presentation.registeredDealers);
  primary.presentation.playback.lines.push(...alternate.presentation.playback.lines);
  primary.records.push(...alternate.records);
  primary.project.dealers.push(...alternate.project.dealers.filter(row=>!primary.project.dealers.some(item=>item.id===row.id)));
  primary.project.lines.push(...alternate.project.lines);
  primary.recapture();
  return primary;
}

/** Add explicitly selected, measured synthetic shoe clips; optionally retain
 * only the native producer's reachable exact takes. Never a real-media proof. */
export function withNativeFilmTransitions(f,{toShoe=true,fromShoe=true,reduce=true}={}) {
  const dealerId=f.profile.dealerId??f.input.package?.dealerId??f.presentation.registeredDealers[0].id;
  const line=f.presentation.playback.lines.find(row=>row.dealerId===dealerId&&row.eventId==='transition.shoe');
  const transitions={toShoe:null,fromShoe:null};
  for(const [direction,situation,frames,startPose,endPose,n] of [
    ['toShoe','to-shoe',48,'VILA','REDO',1],['fromShoe','from-shoe',24,'REDO','VILA',2]]) {
    if(!(direction==='toShoe'?toShoe:fromShoe))continue;
    const row=structuredClone(f.records.find(item=>item.classification.kind==='action'));
    row.id=`40000000-0000-4000-8000-00000000000${n}`;
    row.sha256=hash('synthetic native transition '+dealerId+situation);
    row.pathname=`croupier/media/dealers/${dealerId}/review/uploads/${row.id}/${row.sha256}.mp4`;
    Object.assign(row.classification,{eventId:'transition.shoe',situation,startPose,endPose});
    measuredFixtureRecord(row,{frames}); f.records.push(row);
    line.variants.push({...structuredClone(line.variants[0]),id:`${dealerId}.transition.shoe.slot.${situation}`,videoGenerationId:row.id});
    transitions[direction]=row;
  }
  if(reduce) {
    const coverage=requiredNativeFilmedTakes({profile:f.profile,dealerId,transitions});
    if(!coverage.complete)throw Error(coverage.reason);
    const required=new Set(coverage.requiredTakeKeys),excluded=new Set(f.profile.takes.filter(t=>!required.has(t.key)).map(t=>t.sha256));
    f.records.splice(0,f.records.length,...f.records.filter(row=>!excluded.has(row.sha256)));
    const ids=new Set(f.records.map(row=>row.id));
    for(const item of f.presentation.playback.lines)for(const variant of item.variants)
      if(variant.videoGenerationId&&!ids.has(variant.videoGenerationId))variant.videoGenerationId=null;
  }
  f.recapture();return f;
}
