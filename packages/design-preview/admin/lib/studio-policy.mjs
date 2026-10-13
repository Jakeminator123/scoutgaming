import { validateProject } from '../../../../lab/lib/studio-model.mjs';
import { validateIdlePolicy } from '../../../../presentation-runtime/idle-policy.mjs';
import { createRegisteredIdlePolicy } from '../../../../presentation-runtime/registered-idle-policy.mjs';
import { isAstridDealFamily, mediaVariantPolicy, upsertMediaVariantPolicy } from '../../../../presentation-runtime/media-family-policy.mjs';
import { clipSlots, clipsForSlot } from './connected-studio.mjs';

const fail = message => { throw Error(message); };
const uses = new Set(['idle', 'transition', 'deal', 'reveal', 'speak', 'turn', 'settle']);

export function studioPolicyContext(project, inventory, dealerId, slot) {
  const current = clipSlots(project, inventory, dealerId).find(row => row.id === slot.id);
  if (!project.dealers.some(row => row.id === dealerId) || !current || current.eventId !== slot.eventId
    || current.sourceType !== slot.sourceType || current.situation !== slot.situation
    || current.family?.id !== slot.family?.id || !uses.has(current.sourceType)) fail('Kortplatsen matchar inte den registrerade dealern.');
  const line = project.lines.find(row => row.dealerId === dealerId && row.eventId === slot.eventId);
  if (!line) fail('Den registrerade klipplinjen saknas.');
  const family = current.family;
  if (family && (!['once','idle-pool'].includes(family.playbackType) || family.dealerId !== dealerId
    || family.eventId !== slot.eventId || family.situation !== slot.situation)) fail('Mediefamiljen matchar inte kortplatsen.');
  const clips = clipsForSlot(inventory,dealerId,current).filter(video => !video.deletion);
  if (slot.eventId === 'idle.ready') {
    if (family && (family.playbackType !== 'idle-pool' || family.id !== `${dealerId}/idle.ready/ready`)) fail('Grundloopen behöver sin exakta idlefamilj.');
    const global = dealerId === 'astrid' && family?.playbackType === 'idle-pool';
    const policy = global ? project.idlePolicy ?? null : project.dealerIdlePolicies?.find(row => row.dealerId === dealerId)?.policy ?? null;
    return { kind:'idle', family, line, clips, policy, global, frequency:false };
  }
  if (family?.playbackType === 'idle-pool') fail('Grundloopspolicy kan bara redigeras i Grundloop.');
  return { kind:family ? 'family' : 'line',family,line,clips,policy:null,global:false,frequency:isAstridDealFamily(family) };
}

export function applyStudioIdlePolicy(project, inventory, dealerId, slot, nextPolicy) {
  const scope = studioPolicyContext(project,inventory,dealerId,slot);
  if (scope.kind !== 'idle') fail('Välj Grundloop för att ändra detta schema.');
  const policy = validateIdlePolicy(structuredClone(nextPolicy));
  if (policy.familyId !== `${dealerId}/idle.ready/ready`) fail('Schemat tillhör en annan dealer.');
  const available = new Set(scope.clips.map(row => row.id));
  for (const item of [...policy.base,...policy.variants]) if (!available.has(item.videoId)) fail('Ett schemaklipp saknas eller tillhör ett annat fack.');
  if (scope.global && scope.family) {
    if (policy.base.some(row => !scope.family.standardIds.includes(row.videoId))
      || policy.variants.some(row => !scope.family.variantIds.includes(row.videoId))) fail('Grundloopens bas och variationer måste behålla sina registrerade roller.');
  }
  const draft = structuredClone(project);
  if (scope.global) draft.idlePolicy = policy;
  else {
    const rows=draft.dealerIdlePolicies??[];
    draft.dealerIdlePolicies=rows.some(row=>row.dealerId===dealerId)
      ?rows.map(row=>row.dealerId===dealerId?{dealerId,policy}:row):[...rows,{dealerId,policy}];
  }
  const line = draft.lines.find(row => row.dealerId === dealerId && row.eventId === slot.eventId);
  const baseline = line.variants.find(row => row.id === line.baselineVariantId);
  if (!baseline || baseline.triggerIds.length) fail('Grundloopens standardvariant måste vara ovillkorlig.');
  baseline.videoGenerationId = policy.base[0].videoId;
  return validateProject(draft);
}

export function addStudioIdleClip(project,inventory,dealerId,slot,videoId,durationMs,asBase=false) {
  const scope=studioPolicyContext(project,inventory,dealerId,slot);
  if(scope.kind!=='idle'||!scope.clips.some(row=>row.id===videoId))fail('Välj en tillgänglig video från detta grundloopsfack.');
  if(!Number.isInteger(durationMs)||durationMs<200||durationMs>60000)fail('Läs klippets verkliga längd: 0,2–60 sekunder.');
  let policy=scope.policy?structuredClone(scope.policy):createRegisteredIdlePolicy({dealerId,baselineVideoId:videoId,durationMs});
  if(!scope.policy)return applyStudioIdlePolicy(project,inventory,dealerId,slot,policy);
  if([...policy.base,...policy.variants].some(row=>row.videoId===videoId))fail('Klippet finns redan i schemat.');
  if(asBase){
    if(policy.base.length>=4)fail('Högst fyra basklipp.');
    const donor=policy.base.find(row=>row.weight>1);if(!donor)fail('Basklippen behöver minst en procent var.');
    donor.weight-=1;policy.base.push({videoId,durationMs,weight:1});
  }else policy.variants.push({videoId,durationMs,use:'manual',automatic:null});
  return applyStudioIdlePolicy(project,inventory,dealerId,slot,policy);
}

export function setStudioBaseWeight(policy,videoId,weight) {
  const next=structuredClone(policy), item=next.base.find(row=>row.videoId===videoId);
  if(!item||!Number.isInteger(weight)||weight<1||weight>100-next.base.length+1)fail('Ogiltig andel för basklippet.');
  if(next.base.length===1){item.weight=100;return validateIdlePolicy(next);}
  let difference=weight-item.weight;
  for(const other of next.base.filter(row=>row.videoId!==videoId)){
    const change=difference>0?Math.min(difference,other.weight-1):difference;
    other.weight-=change;difference-=change;if(difference===0)break;
  }
  if(difference!==0)fail('Basklippen behöver minst en procent var.');
  item.weight=weight;return validateIdlePolicy(next);
}

export function applyStudioVariantPolicy(project,inventory,dealerId,slot,variantId,patch) {
  const scope=studioPolicyContext(project,inventory,dealerId,slot);
  if(scope.kind==='idle')fail('Grundloopens variationer ändras i dess schema.');
  if(!patch||Object.keys(patch).some(key=>!['selection','priority','triggerIds','frequencyPercent'].includes(key)))fail('Okända policyfält.');
  const draft=structuredClone(project);
  if(scope.family){
    if(!scope.family.variantIds.includes(variantId)||!scope.clips.some(row=>row.id===variantId))fail('Välj ett tillgängligt alternativ i den exakta mediefamiljen.');
    if(Object.hasOwn(patch,'frequencyPercent')&&!scope.frequency)fail('Frekvens hör bara till Astrids exakta utdelningsfack.');
    const current=mediaVariantPolicy(project,scope.family,variantId);
    if(scope.frequency&&Object.hasOwn(patch,'selection'))fail('Utdelningsfackets urval styrs av dess frekvenser.');
    const policy={...structuredClone(current),...structuredClone(patch)};
    draft.mediaPolicy=upsertMediaVariantPolicy(draft.mediaPolicy,scope.family.id,policy);
  }else{
    if(Object.hasOwn(patch,'frequencyPercent'))fail('Frekvens behöver en registrerad Astridfamilj.');
    const line=draft.lines.find(row=>row.dealerId===dealerId&&row.eventId===slot.eventId);
    const variant=line.variants.find(row=>row.id===variantId);
    if(!variant||variant.id===line.baselineVariantId||!scope.clips.some(row=>row.id===variant.videoGenerationId))fail('Välj en kopplad klippvariant i detta fack. Standardvarianten är fast.');
    Object.assign(variant,structuredClone(patch));
  }
  return validateProject(draft);
}
