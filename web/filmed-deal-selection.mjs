import { randomUUID } from 'node:crypto';
import { planFilmedDealSequence, orderFilmedPresentationEvents } from '../packages/presentation/runtime/filmed-deal-sequence.mjs';
import { registeredFilmedProfile } from './public/dealer-filmed-profiles.mjs';

// Only explicit, saved media bindings can opt into a source-film sequence. The
// caller supplies committed server events and its already authorized inventory.
export function filmedDealSelection({project,inventory,dealerId,sourceEvent,published}) {
  const profile=registeredFilmedProfile(dealerId);
  if(!profile||!['deal','reveal'].includes(sourceEvent?.type))return null;
  const refs=new Set(project.lines.filter(line=>line.dealerId===dealerId).flatMap(line=>line.variants.map(row=>row.videoGenerationId)).filter(Boolean));
  const ownInventory={...inventory,videos:inventory.videos.filter(row=>refs.has(row.id))};
  const hashes=new Set(profile.takes.map(take=>take.sha256));
  if(!ownInventory.videos.some(video=>video.classification?.dealerId===dealerId&&hashes.has(video.sha256)))return null;
  const reserve=sequenceReason=>({video:null,filmedTake:null,result:{videoGenerationId:null,provider:'filmed-deal-sequence',
    decision:{requestId:randomUUID(),sourceEvent,media:{familyId:null,
      reason:sourceEvent.type==='deal'?'position_clip_missing':'frozen_clip_missing',sequenceReason,profileId:profile.id}}}});
  const plan=planFilmedDealSequence({profile,events:orderFilmedPresentationEvents(published),inventory:ownInventory,dealerId});
  if(!plan.complete)return reserve(plan.reason);
  const step=plan.steps.find(row=>row.type===sourceEvent.type&&row.shoeDraw===sourceEvent.shoeDraw&&row.to===sourceEvent.to&&(row.to==='dealer'||row.box===sourceEvent.box));
  if(!step)return reserve('committed_event_missing');
  const video=ownInventory.videos.find(row=>row.id===step.videoId&&row.sha256===step.sha256);
  if(!video)return reserve('exact_video_missing');
  return {video,filmedTake:{profileId:plan.profileId,takeKey:step.takeKey},
    result:{videoGenerationId:video.id,provider:'filmed-deal-sequence',decision:{requestId:randomUUID(),sourceEvent,
      media:{familyId:null,reason:'filmed_deal_sequence',profileId:plan.profileId,takeKey:step.takeKey}}}};
}
