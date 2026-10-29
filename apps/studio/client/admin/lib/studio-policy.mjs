import { validateProject, allowedPathDescriptors, addVariant } from '../../../../../packages/presentation/contracts/studio-model.mjs';
import { validateIdlePolicy } from '../../../../../packages/presentation/runtime/idle-policy.mjs';
import { createRegisteredIdlePolicy, registeredIdleInventory } from '../../../../../packages/presentation/runtime/registered-idle-policy.mjs';
import { IDLE_ROTATION_DEALERS, prepareIdleRotation, savedIdleRotationSelection } from '../../../lib/idle-rotation-sources.mjs';
import { isAstridDealFamily, dealFrequencyPolicies, mediaVariantPolicy, upsertMediaVariantPolicy } from '../../../../../packages/presentation/runtime/media-family-policy.mjs';
import { selectionFor } from '../../../../../packages/presentation/contracts/video-intake.mjs';
import { clipSlots, clipsForSlot, configuredClipIds, currentClipId } from './connected-studio.mjs';

const fail = message => { throw Error(message); };
const uses = new Set(['idle', 'transition', 'deal', 'reveal', 'speak', 'turn', 'settle']);

// These presets write the existing, published event predicates. Media identity,
// idle scheduling and the game's authoritative event catalogue stay separate.
export const IDLE_EVENT_RULES = Object.freeze([
  {id:'turn',label:'Spelarens tur',type:'turn',conditions:[]},
  {id:'settle',label:'Efter rundans resultat',type:'settle',conditions:[]},
  {id:'blackjack',label:'Spelarens blackjack',type:'settle',conditions:[['event.hands.outcome','includes','blackjack']]},
  {id:'dealer-bust',label:'Dealern över 21',type:'settle',conditions:[['event.dealerTotal','gt',21]]},
  {id:'win',label:'Minst en vinnande hand',type:'settle',conditions:[['event.hands.outcome','includes','win']]},
  {id:'push',label:'Alla händer oavgjorda',type:'settle',conditions:[['event.hands.outcome','all_eq','push']]},
  {id:'lose',label:'Alla händer förlorade',type:'settle',conditions:[['event.hands.outcome','all_eq','lose']]},
]);

export function studioIdleEventRule(project,dealerId,videoId) {
  const variants=project.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready')?.variants??[];
  const variant=variants.find(row=>row.videoGenerationId===videoId&&row.selection?.rules&&row.triggerIds.length);
  return IDLE_EVENT_RULES.find(rule=>JSON.stringify(variant?.triggerIds)===JSON.stringify(
    [0,...rule.conditions.map((_,i)=>i+1)].map(i=>`idle.behavior.${rule.id}.${i}`)))?.id??'';
}

// What a clip shows, for OpenClaw to choose by: at most 80 characters, no control
// characters. An empty text removes the description.
export const IDLE_DESCRIPTION_MAX = 80;
export function idleDescription(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, IDLE_DESCRIPTION_MAX);
}
export function applyStudioIdleVariantPolicy(project,inventory,dealerId,slot,videoId,patch) {
  const scope=studioPolicyContext(project,inventory,dealerId,slot);
  if(scope.kind!=='idle'||!scope.policy?.variants.some(row=>row.videoId===videoId))fail('Välj ett kopplat beteendeklipp.');
  const definition=scope.line.variants.find(row=>row.id!==scope.line.baselineVariantId&&row.videoGenerationId===videoId&&row.triggerIds.length);
  if(patch.use==='rules'&&!definition)return applyStudioIdleEventRule(project,inventory,dealerId,slot,videoId,'turn');
  const change=row=>{
    const next={...row,...patch};
    if(Object.hasOwn(patch,'description')){next.description=idleDescription(patch.description);if(!next.description.trim())delete next.description;}
    return next;
  };
  return applyStudioIdlePolicy(project,inventory,dealerId,slot,{...scope.policy,
    variants:scope.policy.variants.map(row=>row.videoId===videoId?change(row):row)});
}

// A re-bound sequence keeps each clip's OpenClaw or rule choice and its description.
// A choice only stays on a clip that starts and ends at rest; others return to the sequence.
export function keepIdleRotationChoices(next,previous) {
  if(!next?.rotation||!previous)return next;
  const kept=structuredClone(next),rows=new Map(kept.rotation.clips.map(row=>[row.videoId,row]));
  for(const variant of kept.variants){
    const before=previous.variants?.find(row=>row.videoId===variant.videoId),row=rows.get(variant.videoId);
    if(!before)continue;
    if(Object.hasOwn(before,'description'))variant.description=before.description;else delete variant.description;
    if(['openclaw','rules'].includes(before.use)&&row?.from==='rest'&&row.to==='rest')variant.use=before.use;
  }
  return kept;
}

export function applyStudioIdleEventRule(project,inventory,dealerId,slot,videoId,ruleId) {
  const scope=studioPolicyContext(project,inventory,dealerId,slot), rule=IDLE_EVENT_RULES.find(row=>row.id===ruleId);
  if(scope.kind!=='idle'||!rule||!scope.policy?.variants.some(row=>row.videoId===videoId)
    ||!scope.clips.some(row=>row.id===videoId))fail('Välj ett kopplat beteendeklipp och en spelhändelse.');
  let draft=structuredClone(project);
  let line=draft.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready');
  let variant=line.variants.find(row=>row.id!==line.baselineVariantId&&row.videoGenerationId===videoId);
  if(!variant){
    draft=addVariant(draft,dealerId,'idle.ready',scope.clips.find(row=>row.id===videoId).label.slice(0,80));
    line=draft.lines.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready');variant=line.variants.at(-1);
  }
  const predicates=[['event.type','eq',rule.type],...rule.conditions];
  variant.triggerIds=predicates.map(([path,op,value],i)=>{
    const trigger={id:`idle.behavior.${rule.id}.${i}`,label:rule.label,category:'deterministic',path,op,value};
    const existing=draft.triggers.find(row=>row.id===trigger.id);
    if(existing&&(existing.path!==path||existing.op!==op||JSON.stringify(existing.value)!==JSON.stringify(value)))fail('Ett befintligt villkor har samma ID men annan betydelse.');
    if(!existing)draft.triggers.push(trigger);
    return trigger.id;
  });
  Object.assign(variant,{videoGenerationId:videoId,selection:{rules:true,random:false,model:false},priority:50+rule.conditions.length});
  const policy=structuredClone(scope.policy);
  Object.assign(policy.variants.find(row=>row.videoId===videoId),{use:'rules',automatic:null});
  return applyStudioIdlePolicy(draft,inventory,dealerId,slot,policy);
}

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

// The dealer's frozen idle source bound to its registered originals. Without a
// selection the whole source is proposed; a saved sequence keeps its own subset.
export function prepareStudioIdleRotation(project,inventory,dealerId,slot,selection=null) {
  if(!IDLE_ROTATION_DEALERS.includes(dealerId)||slot.eventId!=='idle.ready')return null;
  const scope=studioPolicyContext(project,inventory,dealerId,slot);
  return scope.kind==='idle'&&scope.policy?prepareIdleRotation(scope.policy,registeredIdleInventory(inventory,{dealerId,policy:scope.policy}),{selection}):null;
}
export { savedIdleRotationSelection };

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


// Read-only authoring summary. It never treats the current project as a frozen room package.
export function studioClipUsage(project, inventory, dealerId, slot, videoId, variantId) {
  const event = project.events.find(row => row.id === slot.eventId);
  const when = slot.game === 'roulette' ? slot.description : event?.description || slot.description || slot.title;
  const result = (configured, rules) => ({ configured, when, rules });
  if (!videoId) return result(false, [slot.planned ? 'Ingen tagning eller sparad klippregel i detta fack.' : 'Välj en tagning för att se dess körregel.']);
  if (!clipsForSlot(inventory,dealerId,slot).some(row => row.id === videoId)) return result(false, ['Tagningen är inte tillgänglig i denna situation.']);
  if (slot.game === 'roulette') {
    const configured = configuredClipIds(project,dealerId,slot,variantId,inventory).includes(videoId);
    if (!configured) return result(false, [slot.localOnly ? 'Lokal referens, ingen spelkoppling.' : 'Vald för prov; inte kopplad i projektutkastet.']);
    return result(true, [slot.eventId === 'roulette.wheel-start' ? 'Startfilm efter serverns sparade kvitto; filmens kalibrering styr kulsläppet.'
      : slot.situation === 'breathing' ? 'Grundloop medan roulette väntar.' : 'Glasögonvariant i grundloopen; inget tidsintervall är sparat i denna koppling.']);
  }
  let scope;
  try { scope = studioPolicyContext(project,inventory,dealerId,slot); }
  catch { return result(false, ['Körregeln kunde inte läsas för denna exakta situation.']); }
  const conditions = ids => ids.map(id => {
    const trigger = project.triggers.find(row => row.id === id);
    if (!trigger) return `Saknat villkor: ${id}`;
    const label = allowedPathDescriptors.find(row => row.path === trigger.path)?.label || trigger.path;
    const op = {eq:'är',ne:'är inte',gt:'över',gte:'minst',lt:'under',lte:'högst',includes:'innehåller',all_eq:'alla är',in:'är något av',exists:'finns'}[trigger.op] || trigger.op;
    const value = item => typeof item === 'boolean' ? item ? 'ja' : 'nej' : item === null ? 'tomt' : String(item);
    return `${label} ${op} ${Array.isArray(trigger.value) ? trigger.value.map(value).join(', ') : value(trigger.value)}`;
  });
  if (scope.kind === 'idle' && scope.policy) {
    const base = scope.policy.base.find(row => row.videoId === videoId);
    if (base) return result(true, [`Grundloop · ${base.weight} % av basurvalet · ${(base.durationMs/1000).toLocaleString('sv-SE')} s.`]);
    const variation = scope.policy.variants.find(row => row.videoId === videoId);
    if (!variation) return result(false, ['Tagningen finns i biblioteket men ingår inte i grundloopens schema.']);
    if (variation.use === 'automatic' && variation.automatic) {
      const a = variation.automatic;
      return result(true, [`Automatisk variation: i snitt var ${a.averageEveryMs/1000} s, variation ±${a.jitterMs/1000} s.`, `Minsta paus ${a.cooldownMs/1000} s; högst ${a.maxPerMinute} starter/minut. Spelhändelser kan skjuta upp starten.`]);
    }
    if (variation.use === 'manual') return result(true, ['Endast manuellt prov; startar inte automatiskt.']);
    const description = variation.description?.trim() ? [`Beskrivning för OpenClaw: ${variation.description.trim()}`] : [];
    if (variation.use === 'rotation') return result(true, ['Ingår i vilosekvensen.', ...description]);
    if (variation.use === 'openclaw') return result(true, [`OpenClaw kan föreslå klippet vid tur eller resultat när scenmallens vila står på OpenClaw.${scope.policy.rotation ? ' Det ingår också i vilosekvensen.' : ''}`, ...description]);
    const definitions = scope.line.variants.filter(row => row.videoGenerationId === videoId && selectionFor(row).rules && row.triggerIds.length);
    return result(true, definitions.length ? definitions.map(row => `Sparade villkor (alla): ${conditions(row.triggerIds).join('; ')}.${row.triggerIds.every(id=>project.triggers.find(trigger=>trigger.id===id)?.path.startsWith('event.'))?' Händelseregel vid utdelning, vändning, tur eller resultat; kräver publicerat regelläge.':' Grundloopens speltrigger stöder endast händelsevillkor; denna kombination är inte ansluten.'}`)
      : ['Regelurval valt, men inga kopplade händelsevillkor finns för tagningen.']);
  }
  const frequency = scope.family && dealFrequencyPolicies(project,scope.family);
  const policies = scope.family ? project.mediaPolicy?.find(row => row.familyId === scope.family.id)?.variants ?? [] : [];
  const familyPolicy = policies.find(row => row.videoId === videoId);
  const configured = scope.family ? configuredClipIds(project,dealerId,slot,variantId,inventory).includes(videoId) || Boolean(familyPolicy)
    : scope.line.variants.some(row=>row.videoGenerationId===videoId);
  if (!configured) return result(false, ['Vald för prov; inte kopplad i projektutkastet.']);
  if (slot.eventId === 'transition.shoe') return result(true, ['Det publicerade standardklippet används i filmsekvenser med känd poskedja när rörelsen behövs. Sparade alternativ väljs inte automatiskt.']);
  const exactVariant=scope.line.variants.find(row=>row.id===variantId&&row.videoGenerationId===videoId);
  const standard = scope.family ? scope.family.standardIds[0] === videoId
    : (!exactVariant||exactVariant.id===scope.line.baselineVariantId) && (slot.sourceType==='speak'?currentClipId(project,dealerId,slot,scope.line.baselineVariantId,inventory):scope.line.variants.find(row=>row.id===scope.line.baselineVariantId)?.videoGenerationId) === videoId;
  if (frequency) return result(true, [standard
    ? `Standard/reserv · minst ${100-frequency.reduce((sum,row)=>sum+(row.frequencyPercent??0),0)} % av urvalet. Otillgängliga alternativ faller tillbaka till standard.`
    : (familyPolicy?.frequencyPercent ?? 0) > 0 ? `${familyPolicy.frequencyPercent} % vid denna utdelningsplats; övriga regler styr inte frekvensurvalet.` : '0 % · endast manuellt prov.']);
  if (standard) return result(true, ['Standard/reserv när situationen inträffar.']);
  const variant = familyPolicy ?? exactVariant
    ?? scope.line.variants.find(row => row.videoGenerationId === videoId);
  if (!variant) return result(true, ['Ingen separat urvalsregel är sparad för tagningen.']);
  const selection = selectionFor(variant), rules = [];
  if (selection.rules) rules.push(variant.triggerIds.length ? `Regelurval, alla villkor: ${conditions(variant.triggerIds).join('; ')}.` : 'Regelurval utan extra villkor.');
  if (selection.random) rules.push('Tillåten i slumpurval.');
  if (selection.model) rules.push('OpenClaw-urval tillåtet i utkastet; faktisk triggeranslutning är inte verifierad i denna vy.');
  if (!rules.length) rules.push('Endast manuellt prov; inget automatiskt urval är aktiverat.');
  else rules.push(`Prioritet ${variant.priority}. Rummets publicerade automatikläge avgör vilket urval som används.`);
  return result(true, rules);
}
