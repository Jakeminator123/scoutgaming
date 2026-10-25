import {defaultPresentationLane,normalizeProject} from '../contracts/studio-model.mjs';
import {validatePresentationPackage} from '../contracts/presentation-layers.mjs';
import {registeredIdlePolicy} from '../runtime/registered-idle-policy.mjs';
import {captureFrozenRegisteredDealers,captureFrozenDealerPlayback} from './frozen-dealer-idle.mjs';
import {StudioStorageError} from '../../studio-registry/server/document-contract.mjs';

const fail=()=>{throw new StudioStorageError('studio_dealer_idle_policy_mismatch',422);};
// Refresh only the saved idle selection. Published geometry, choices, speech,
// actions and other dealers remain byte-for-byte equivalent as JSON values.
export function refreshFrozenDealerIdle({presentation,snapshot,inventory,dealerId}) {
  const next=structuredClone(validatePresentationPackage(presentation));
  const dealer=next.registeredDealers?.find(row=>row.id===dealerId);
  if(!dealer?.idle||!next.playback)fail();
  const source=structuredClone(normalizeProject(snapshot.projectDocument.value)),policy=registeredIdlePolicy(source,dealerId);
  if(!policy?.rotation||policy.base[0].videoId!==dealer.idle.id)fail();
  const savedIdle=source.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready');
  if(savedIdle?.variants.find(row=>row.id===savedIdle.baselineVariantId)?.videoGenerationId!==dealer.idle.id)fail();
  // The capture validates registered original bytes without pulling new speech
  // or game bindings out of the draft. Its temporary lane is never published.
  source.lanes=[defaultPresentationLane(dealerId)];
  source.lines=source.lines.map(line=>line.dealerId!==dealerId?line:{...line,variants:line.variants.map(variant=>({...variant,
    videoGenerationId:line.eventId==='idle.ready'&&variant.id===line.baselineVariantId?dealer.idle.id:null}))});
  const input={project:source,selectedLaneIds:[source.lanes[0].id],inventory,mediaRows:snapshot.mediaRows,requiredIdleDealerIds:[dealerId]};
  const registered=captureFrozenRegisteredDealers(input);
  const captured=captureFrozenDealerPlayback({...input,registeredDealers:registered.registeredDealers});
  const ids=new Set([...policy.base,...policy.variants].map(row=>row.videoId));
  const fresh=captured.playback.media.filter(row=>ids.has(row.id));
  if(fresh.length!==ids.size||fresh.some(row=>row.classification?.compositing?.mode==='opaque'))fail();
  const freshBase=fresh.find(row=>row.id===dealer.idle.id);
  if(['id','sha256','size','contentType','pathname'].some(key=>freshBase[key]!==dealer.idle[key]))fail();
  const policies=next.playback.dealerIdlePolicies??[],oldPolicy=policies.find(row=>row.dealerId===dealerId)?.policy;
  const oldIds=new Set(oldPolicy?[...oldPolicy.base,...oldPolicy.variants].map(row=>row.videoId):[]);
  const replacement={dealerId,policy:structuredClone(policy)};
  next.playback.dealerIdlePolicies=oldPolicy?policies.map(row=>row.dealerId===dealerId?replacement:row):[...policies,replacement];
  const used=new Set(next.playback.lines.flatMap(line=>line.variants.map(row=>row.videoGenerationId)).filter(Boolean));
  for(const {policy} of next.playback.dealerIdlePolicies)for(const row of [...policy.base,...policy.variants])used.add(row.videoId);
  const media=new Map(next.playback.media.map(row=>[row.id,row]));
  for(const row of fresh) {
    // Existing frozen metadata (including framing and restored source notes)
    // stays frozen; current media identity must still match its exact bytes.
    const previous=media.get(row.id);
    if(previous&&['sha256','size','contentType','pathname'].some(key=>row[key]!==previous[key]))fail();
    if(!previous)media.set(row.id,row);
  }
  next.playback.media=[...media.values()].filter(row=>!oldIds.has(row.id)||used.has(row.id));
  return {presentation:validatePresentationPackage(next),mediaPreconditions:captured.mediaPreconditions.filter(row=>ids.has(row.id))};
}
