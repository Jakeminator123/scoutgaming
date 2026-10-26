import { createHash } from 'node:crypto';
import { canonicalStudioJson, StudioStorageError } from '../../studio-registry/server/document-contract.mjs';
import { readPackagePresentation } from './presentation-package.mjs';
import { isPresentationRoom, roomGame } from '../contracts/presentation-room.mjs';
import { frozenPlaybackProject } from '../contracts/frozen-dealer-playback.mjs';
import { registeredFilmedProfile } from '../contracts/filmed-profiles/registry.mjs';
import { validateFilmedDealProfile } from '../contracts/filmed-profile.mjs';
import { normalizeMediaTiming, mediaTimingSpeechIdentity } from '../contracts/media-timing.mjs';
import { recordedSpeechForVideo } from '../contracts/recorded-speech.mjs';
import { SPEECH_SLOT_IDS, speechSlotEventId, speechSlotStandard } from '../contracts/speech-slot-bindings.mjs';
import { transitionClipsForDealer } from '../runtime/shoe-transitions.mjs';
import { FILMED_OPEN_LEAD_MS, FILMED_TAKE_GAP_MS, FILMED_HANDOVER_FRAMES } from '../runtime/filmed-deal-timeline.mjs';
import { validateRoomGameMaterial } from '../contracts/room-game-config.mjs';
import { NATIVE_ROOM_MATERIAL_PREFIX, NATIVE_ROOM_PRESENTATION_CONTRACT, NATIVE_ROOM_SPEECH_SLOTS } from '../contracts/native-room-game-budget.mjs';

export { NATIVE_ROOM_MATERIAL_PREFIX } from '../contracts/native-room-game-budget.mjs';
const requiredSpeechSlots = NATIVE_ROOM_SPEECH_SLOTS;
const speechSlots = Object.freeze(['blackjack','bust','chatter1','chatter2','dealerblackjack','dealerbust','double','farewell','goodluck','greeting','insurance','lose','peek','placebets','push','sidebet','win']);
const expectedTakes = [...['1','2','3','4','5','6','7','dealer'].flatMap(target => ['', 'i', 'v', 'iv'].map(variant => `${target}:${variant}`)), 'hole:', 'hole:i', 'flip:'].sort();
const digest = value => createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = reason => { const error = new StudioStorageError('studio_room_game_material_unavailable', 422); error.reason = reason; throw error; };
const same = (a,b) => canonicalStudioJson(a) === canonicalStudioJson(b);
const max = values => Math.max(0, ...values);

// Versioned assumptions for the existing shared-table producer, not arbitrary
// fixture timings. A changed contract/topology must be reviewed before publishing.
function compatible(profile) {
  if (NATIVE_ROOM_PRESENTATION_CONTRACT !== 'blackjack-presentation/1'
    || !same([...SPEECH_SLOT_IDS].sort(), speechSlots)
    || FILMED_OPEN_LEAD_MS.deal !== 700 || FILMED_OPEN_LEAD_MS.reveal !== 1500
    || FILMED_TAKE_GAP_MS !== 80 || FILMED_HANDOVER_FRAMES !== 1.5
    || !same(profile.takes.map(t => `${t.target}:${t.variant}`).sort(), expectedTakes)) fail('native_material_contract_unsupported');
}
function placement(take) {
  const box = Number(take.target) - 1;
  return {eventId:take.target === 'flip' ? 'reveal.dealer' : ['dealer','hole'].includes(take.target) ? 'deal.dealer'
    : `deal.player.${box < 2 ? 'left' : box < 5 ? 'centre' : 'right'}`,
  situation:['hole','flip'].includes(take.target) ? 'dealer-hole' : take.target === 'dealer' ? 'dealer-up' : `box${box}`};
}

/** Pure producer from the already validated, immutable native publication.
 * No catalog/filename matching, provider calls, registry reads, approval writes,
 * or outer package revision in the semantic material fingerprint.
 * The caller still owns current-record/CAS checks and runtime readiness.
 */
export function resolveNativeRoomGameMaterial({package:pack, room, language} = {}) {
  try {
    if (!['en','sv'].includes(language) || !isPresentationRoom(room) || room.state !== 'live' || roomGame(room) !== 'blackjack'
      || pack?.operatorId !== room.operatorId || !Number.isSafeInteger(pack.revision) || pack.revision < 1
      || !pack.tables?.includes(room.id) || !pack.games?.includes('blackjack') || !pack.lanes?.includes(room.presentationLaneId)) fail('native_material_room_mismatch');
    const presentation = readPackagePresentation(pack);
    if (presentation?.schemaVersion !== 3 || !presentation.playback) fail('native_material_frozen_v3_required');
    const lane = presentation.lanes.find(value => value.id === room.presentationLaneId), dealerId = lane?.layers?.dealer?.default;
    if (!dealerId || !lane.layers.dealer.allowed.includes(dealerId)
      || !presentation.registeredDealers.some(row => row.id === dealerId && row.idle)) fail('native_material_dealer_missing');
    const profile = registeredFilmedProfile(dealerId);
    if (!profile) fail('native_material_profile_missing');
    validateFilmedDealProfile(profile); compatible(profile);
    const project = frozenPlaybackProject(presentation.playback, {registeredDealers:presentation.registeredDealers, projectRevision:presentation.projectRevision});
    const records = presentation.playback.media.filter(row => row.classification.dealerId === dealerId);
    if (!records.length || records.length > 256) fail('native_material_media_limit');
    const byId = new Map(records.map(row => [row.id,row])), byTake = new Map(), durations = new Map(), speeches = new Map();
    const inventory = {videos:records.map(row => ({...row, dealer:dealerId, available:true, integrity:'verified', bytes:row.size}))};
    const transitions = transitionClipsForDealer(project, inventory, dealerId);
    const selectedTransitions = new Set(Object.values(transitions).filter(Boolean).map(row => row.id));
    const takeByHash = new Map(profile.takes.map(take => [take.sha256,take]));
    const sizes = new Map();
    for (const row of records) {
      const metadata = row.classification;
      if (row.deletion || metadata.archived || metadata.game === 'roulette' || metadata.mediaType
        || !['video/mp4','video/webm'].includes(row.contentType)) fail('native_material_video_unavailable');
      if (sizes.has(row.sha256) && sizes.get(row.sha256) !== row.size) fail('native_material_size_mismatch');
      sizes.set(row.sha256,row.size);
      const speech = metadata.kind === 'speech' ? recordedSpeechForVideo(row, {dealerId,language,lineId:metadata.situation,takeId:metadata.recordedSpeech?.takeId}) : null;
      if (metadata.kind === 'speech' && (!speech || !speechSlots.includes(metadata.situation)
        || metadata.eventId !== speechSlotEventId(metadata.situation))) fail('native_material_speech_unbound');
      if (speech && (speech.entryPose !== 'VILA' || speech.exitPose !== 'VILA')) fail('native_material_speech_pose_unsupported');
      if (!row.mediaTiming) fail('native_material_measurement_missing');
      let timing;
      try { timing = normalizeMediaTiming(row.mediaTiming, {mediaId:row.id,sha256:row.sha256,size:row.size,
        recordedSpeechIdentitySha256:speech ? hash(mediaTimingSpeechIdentity(speech)) : null}); }
      catch { fail('native_material_measurement_mismatch'); }
      durations.set(row.id,timing.endUs);
      if (speech) {
        if (timing.video.fps !== speech.fps || timing.video.frameCount !== speech.frameCount || !timing.audio.length) fail('native_material_speech_timing_mismatch');
        speeches.set(row.id,speech);
      } else if (metadata.kind === 'action') {
        const take = takeByHash.get(row.sha256);
        if (take) {
          const slot = placement(take);
          if (metadata.eventId !== slot.eventId || metadata.situation !== slot.situation
            || metadata.startPose !== undefined && metadata.startPose !== take.startPose
            || metadata.endPose !== undefined && metadata.endPose !== take.endPose
            || timing.video.fps !== profile.plane.fps || timing.video.frameCount !== take.frames) fail('native_material_take_mismatch');
          // The actual player hands over on the last frames. A sound that would
          // be cut there is not admitted merely because its container was read.
          const handoverUs = Math.floor(Math.min(take.frames,Math.max(take.frames-FILMED_HANDOVER_FRAMES,take.clearFrame+1))*1e6/profile.plane.fps);
          if (timing.audio.some(track => track.endUs > handoverUs)) fail('native_material_take_audio_truncated');
          byTake.set(take.key,take);
        } else {
          if (!selectedTransitions.has(row.id) || metadata.eventId !== 'transition.shoe') fail('native_material_take_unrecognized');
          const expected = metadata.situation === 'to-shoe' ? ['VILA','REDO'] : ['REDO','VILA'];
          if (metadata.startPose !== expected[0] || metadata.endPose !== expected[1]) fail('native_material_transition_pose_missing');
        }
      } else if (metadata.kind !== 'idle' || metadata.eventId !== 'idle.ready') fail('native_material_slot_unsupported');
    }
    if (byTake.size !== profile.takes.length) fail('native_material_bank_incomplete');
    for (const lineId of requiredSpeechSlots) {
      const variant = speechSlotStandard(project,dealerId,speechSlotEventId(lineId),lineId);
      if (!variant || !speeches.has(variant.videoGenerationId) || speeches.get(variant.videoGenerationId).lineId !== lineId) fail('native_material_speech_slot_missing');
    }
    const idleId = presentation.registeredDealers.find(row => row.id === dealerId).idle.id;
    if (!byId.has(idleId)) fail('native_material_idle_missing');
    const transitionUs = Object.values(transitions).reduce((sum,row) => sum + (row ? durations.get(row.id) : 0),0);
    const dealUs = max(records.filter(row => takeByHash.has(row.sha256) && takeByHash.get(row.sha256).target !== 'flip').map(row => durations.get(row.id)));
    const revealUs = max(records.filter(row => takeByHash.get(row.sha256)?.target === 'flip').map(row => durations.get(row.id)));
    const speechUs = max([...speeches.keys()].map(id => durations.get(id)));
    const placebetsUs = max([...speeches].filter(([,speech]) => speech.lineId === 'placebets').map(([id]) => durations.get(id)));
    // At most two spoken lines and one reveal per committed plan in v1.
    // Include a whole preceding window's placebets because the browser serializes
    // it before a prompt ready/start. Each shot conservatively includes both
    // selected shoe transitions and a gap, even when this particular join omits them.
    const leadMs = Math.ceil((max(Object.values(FILMED_OPEN_LEAD_MS))*1000 + revealUs + transitionUs
      + FILMED_TAKE_GAP_MS*1000 + 2*speechUs + placebetsUs)/1000);
    const cardMs = Math.ceil((dealUs + transitionUs + FILMED_TAKE_GAP_MS*1000)/1000);
    if (leadMs > 60000 || cardMs > 60000) fail('native_material_timing_limit');
    const media = records.map(({id,sha256}) => ({id,sha256})).sort((a,b) => a.id.localeCompare(b.id));
    const revision = NATIVE_ROOM_MATERIAL_PREFIX + digest({contract:NATIVE_ROOM_PRESENTATION_CONTRACT,
      room:{id:room.id,operatorId:room.operatorId,presentationLaneId:room.presentationLaneId,gameLaneId:room.gameLaneId},
      presentationSha256:digest(presentation), profileSha256:digest(profile), language, leadMs,cardMs});
    return validateRoomGameMaterial({revision,dealerId,language,leadMs,cardMs,media},{dealerId,language});
  } catch (error) {
    if (error?.code === 'studio_room_game_material_unavailable') throw error;
    fail('native_material_invalid_publication');
  }
}
