import { createHash } from 'node:crypto';
import { cloudPresentationFixture } from '../../apps/studio/test/fixtures/cloud-presentation.mjs';
import { defaultPresentationLane } from '../../packages/presentation/contracts/studio-model.mjs';
import { bindFilmedBank } from '../../packages/presentation/contracts/filmed-bank-bindings.mjs';
import { registeredFilmedProfile } from '../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import { bindSpeechSlotStandard, speechSlotEventId, SPEECH_SLOT_IDS } from '../../packages/presentation/contracts/speech-slot-bindings.mjs';
import { recordedSpeechIdentity } from '../../packages/presentation/contracts/recorded-speech.mjs';
import { mediaTimingSpeechIdentity } from '../../packages/presentation/contracts/media-timing.mjs';
import { NATIVE_ROOM_SPEECH_SLOTS } from '../../packages/presentation/contracts/native-room-game-budget.mjs';
import { withPackagePresentation } from '../../packages/presentation/server/presentation-package.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
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
export function nativeRoomMaterialFixture({dealerId='dragan',language='sv',capture=true,allSpeechSlots=false} = {}) {
  const fixture = cloudPresentationFixture({lanes:[defaultPresentationLane(dealerId)]});
  const profile = registeredFilmedProfile(dealerId), presentation = fixture.presentation;
  let project = fixture.project, n = 1;
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
  project = bindFilmedBank(project,inventory(),dealerId);
  for (const lineId of allSpeechSlots ? SPEECH_SLOT_IDS : NATIVE_ROOM_SPEECH_SLOTS) {
    const sha256 = hash(`synthetic:${dealerId}:${language}:${lineId}`), eventId = speechSlotEventId(lineId);
    const speech = {schemaVersion:1,dealerId,lineId,takeId:lineId+'_1',language,exactText:'Synthetic unit test line.',
      videoSha256:sha256,audioSha256:hash(`audio:${lineId}`),indexSha256:hash(`index:${lineId}`),fps:24,frameCount:48,audioDelayMs:0,
      entryPose:'VILA',exitPose:'VILA',calibrationRevision:'synthetic-fixture-1',recording:{status:'pending'},review:{status:'pending'}};
    const proof = {by:'unit-test-fixture',at:'2026-10-26T00:00:00.000Z',identity:recordedSpeechIdentity(speech)};
    speech.recording = {status:'verified-recording',...structuredClone(proof)};
    speech.review = {status:'approved',...structuredClone(proof)};
    const row = measuredFixtureRecord(record({sha256,classification:{kind:'speech',eventId,situation:lineId,recordedSpeech:speech}}),{audioEndUs:2_000_000});
    rows.push(row);
    project = bindSpeechSlotStandard(project,{dealerId,eventId,situation:lineId,videoId:row.id});
  }
  presentation.playback.lines = structuredClone(project.lines);
  presentation.playback.media = rows;
  const room = {schemaVersion:2,id:'room-native-fixture',name:'Fixture',operatorId:'operator-fixture',presentationLaneId:presentation.lanes[0].id,gameLaneId:'fixture-lane',state:'live'};
  const pack = {operatorId:room.operatorId,revision:7,tables:[room.id],games:['blackjack'],lanes:[room.presentationLaneId],branding:{}};
  const recapture = () => { pack.branding = withPackagePresentation({},presentation,{allowExtended:true}); };
  if (capture) recapture();
  return {input:{package:pack,room,language},presentation,project,records:rows,profile,recapture};
}
