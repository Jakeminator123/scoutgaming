import {validatePresentationPackage} from './presentation-layers.mjs';

// The ordinary archive contract: retain whole surviving frozen lanes and only
// their exact referenced records. Never recapture drafts or choose replacement
// media. Publication also uses this predicate to recognize that an unrelated
// lane's removal did not change an existing imported room's material.
export function withoutPresentationLanes(presentation,removedIds) {
  const next=structuredClone(presentation),removed=new Set(removedIds);
  next.lanes=next.lanes.filter(lane=>!removed.has(lane.id));
  if(!next.lanes.length)return null;
  const dealers=new Set(next.lanes.flatMap(lane=>[...lane.dealers,...lane.layers.dealer.allowed]));
  const layerAssets=new Set(next.lanes.flatMap(lane=>['background','table'].flatMap(role=>lane.layers[role].allowed)));
  next.assets=next.assets.filter(asset=>layerAssets.has(asset.id));
  if(next.registeredDealers)next.registeredDealers=next.registeredDealers.filter(dealer=>dealers.has(dealer.id));
  if(next.playback) {
    const playback=next.playback;
    playback.lines=playback.lines.filter(line=>dealers.has(line.dealerId));
    if(playback.dealerIdlePolicies)playback.dealerIdlePolicies=playback.dealerIdlePolicies.filter(row=>dealers.has(row.dealerId));
    const variants=playback.lines.flatMap(line=>line.variants);
    const assets=new Set(variants.map(row=>row.assetId)),triggers=new Set(variants.flatMap(row=>row.triggerIds));
    const media=new Set(variants.map(row=>row.videoGenerationId).filter(Boolean));
    for(const row of playback.dealerIdlePolicies??[])for(const item of [...row.policy.base,...row.policy.variants])media.add(item.videoId);
    playback.assets=playback.assets.filter(row=>assets.has(row.id));
    playback.triggers=playback.triggers.filter(row=>triggers.has(row.id));
    playback.media=playback.media.filter(row=>media.has(row.id));
  }
  return validatePresentationPackage(next);
}
