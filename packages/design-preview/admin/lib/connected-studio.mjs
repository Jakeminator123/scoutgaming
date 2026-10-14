import { videoFitsLine, validateVideoMetadata, kindForEvent, situationsForEvent, MAX_VIDEO_BYTES } from '../../../../lab/lib/video-intake.mjs';
import { upsertMediaVariantPolicy, mediaVariantPolicy } from '../../../../packages/presentation/runtime/media-family-policy.mjs';
import { createRegisteredIdlePolicy } from '../../../../packages/presentation/runtime/registered-idle-policy.mjs';
import { validateProject, allowedPathDescriptors, MAX_ALTERNATIVES } from '../../../../lab/lib/studio-model.mjs';
import { uploadNativeVideo } from '../../../../lab/lib/upload-native-video.mjs';
import { materialForAsset } from '../../../../web/public/material-catalog.mjs';
import { defaultCompositionSettings } from '../../../../web/public/composition-settings.mjs';
import { workspaceSurfacePath } from '../../../../lab/lib/workspace-surfaces.mjs';
import {rouletteClipSlots,rouletteClipMatches,rouletteConfiguredClipIds,bindRouletteClip} from './roulette-clip-map.mjs';
import {mediaClassification} from '../../../../lab/lib/dealer-media-library.mjs';
import {layerAssetFitsGame} from '../../../../web/layer-asset-contract.mjs';
import {bindSpeechSlotStandard,speechSlotStandard,speechSlotVariantId,speechSlotSituation,speechSlotVideoFits} from '../../../../web/public/speech-slot-bindings.mjs';

export function clipSlots(project, inventory, dealerId, game='blackjack') {
  if(game==='roulette')return rouletteClipSlots();
  if(game!=='blackjack')throw Error('Välj ett registrerat spel.');
  return project.events.flatMap(event => {
    const families = (inventory.families ?? []).filter(row => row.dealerId === dealerId && row.eventId === event.id);
    const situations = families.length ? families.map(row => row.situation) : situationsForEvent(event);
    return (situations.length ? [...new Set(situations)] : ['']).map(situation => ({
      id: `${event.id}/${situation}`, eventId: event.id, situation, title: event.label,
      description: event.description, sourceType: event.sourceType,
      family: families.find(row => row.situation === situation) ?? null,
    }));
  });
}
export function clipsForSlot(inventory, dealerId, slot) {
  if(slot.game==='roulette')return inventory.videos.filter(video=>rouletteClipMatches(video,dealerId,slot)).sort((a,b)=>a.id.localeCompare(b.id));
  return inventory.videos.filter(video => video.available === true && video.integrity !== 'unavailable'
    && !video.classification?.archived && videoFitsLine(video, dealerId, slot.eventId)
    && (slot.family ? video.familyId === slot.family.id && [...slot.family.standardIds, ...slot.family.variantIds].includes(video.id)
      : video.classification.situation === slot.situation));
}
function slotConditions(project, slot) {
  const event = project.events.find(row => row.id === slot.eventId);
  if (!event || !situationsForEvent(event).includes(slot.situation)) return null;
  if (event.sourceType === 'deal' && /^box[0-6]$/.test(slot.situation)) {
    const box = Number(slot.situation.slice(3)), action = box <= 1 ? 'deal-left' : box >= 5 ? 'deal-right' : 'deal-centre';
    if (event.match['clip.action'] !== action || event.exampleEvent.to !== 'box') return null;
    return [['event.type','deal'],['event.to','box'],['event.box',box]];
  }
  if (event.sourceType === 'deal' && ['dealer-up','dealer-hole'].includes(slot.situation)
    && event.match.to === 'dealer' && event.exampleEvent.to === 'dealer') {
    return [['event.type','deal'],['event.to','dealer'],['event.faceDown',slot.situation === 'dealer-hole']];
  }
  // Reveal publishes the dealer destination but has no faceDown field. Never
  // manufacture a hidden-card predicate that the server does not publish.
  if (event.sourceType === 'reveal' && slot.situation === 'dealer-hole' && event.exampleEvent.to === 'dealer') {
    return [['event.type','reveal'],['event.to','dealer']];
  }
  return null;
}
function slotVariantId(dealerId, slot) { return `${dealerId}.${slot.eventId}.slot.${slot.situation}`; }
function predicateAllows(trigger, value) {
  if (trigger.op==='eq') return value===trigger.value;
  if (trigger.op==='ne') return value!==trigger.value;
  if (trigger.op==='in') return Array.isArray(trigger.value)&&trigger.value.includes(value);
  if (trigger.op==='exists') return trigger.value===true;
  if (trigger.op==='gt') return value>trigger.value;
  if (trigger.op==='gte') return value>=trigger.value;
  if (trigger.op==='lt') return value<trigger.value;
  if (trigger.op==='lte') return value<=trigger.value;
  return false;
}
function exactSlotVariants(project, inventory, dealerId, slot, line) {
  if (!line) return [];
  if (inventory) {
    const available = new Set(clipsForSlot(inventory,dealerId,slot).map(row=>row.id));
    return line.variants.filter(row=>row.videoGenerationId && available.has(row.videoGenerationId));
  }
  const conditions = slotConditions(project,slot);
  if (!conditions) return [];
  return line.variants.filter(row=>row.id===slotVariantId(dealerId,slot) && row.videoGenerationId && conditions.every(([path,value])=>
    row.triggerIds.some(id=>project.triggers.some(trigger=>trigger.id===id && trigger.path===path && trigger.op==='eq' && trigger.value===value))));
}
function speechVariantFits(inventory, dealerId, slot, variant, requireRecordedSpeech=false) {
  const matches=inventory?.videos.filter(video=>video.id===variant?.videoGenerationId)??[];
  return matches.length===1&&matches[0].integrity!=='unavailable'
    &&speechSlotVideoFits(matches[0],{dealerId,eventId:slot.eventId,situation:slot.situation,requireRecordedSpeech});
}
function currentSpeechVariant(project, inventory, dealerId, slot, line, variantId) {
  const standardId=speechSlotVariantId(dealerId,slot.eventId,slot.situation);
  if(variantId&&variantId!==line?.baselineVariantId&&variantId!==standardId){
    const variant=line?.variants.find(row=>row.id===variantId);
    return variant&&!speechSlotSituation(line,variant)&&speechVariantFits(inventory,dealerId,slot,variant)?variant:null;
  }
  const standard=speechSlotStandard(project,dealerId,slot.eventId,slot.situation);
  if(standard)return !inventory||speechVariantFits(inventory,dealerId,slot,standard,slot.eventId==='speak.other')?standard:null;
  // Older shared baselines retain their exact sentence only when there is no
  // saved slot standard. A missing/bad explicit standard never adopts a fallback.
  const baseline=line?.variants.find(row=>row.id===line.baselineVariantId);
  return baseline&&speechVariantFits(inventory,dealerId,slot,baseline)?baseline:null;
}
export function currentClipId(project, dealerId, slot, variantId, inventory) {
  if(slot.game==='roulette')return rouletteConfiguredClipIds(project,dealerId,slot)[0]??'';
  const line = project.lines.find(row => row.dealerId === dealerId && row.eventId === slot.eventId);
  if (slot.eventId === 'idle.ready') return project.dealerIdlePolicies?.find(row => row.dealerId === dealerId)?.policy.base[0]?.videoId
    ?? (slot.family ? project.idlePolicy?.base[0]?.videoId : null)
    ?? line?.variants.find(row => row.id === line.baselineVariantId)?.videoGenerationId ?? '';
  if (slot.family) return project.mediaPolicy?.find(row => row.familyId === slot.family.id)?.variants
    .find(row => Object.values(row.selection).some(Boolean) || (row.frequencyPercent ?? 0) > 0)?.videoId ?? slot.family.standardIds[0] ?? '';
  if(slot.sourceType==='speak')return currentSpeechVariant(project,inventory,dealerId,slot,line,variantId)?.videoGenerationId??'';
  if (slot.situation) {
    const exact = exactSlotVariants(project,inventory,dealerId,slot,line);
    if (variantId && variantId!==line?.baselineVariantId) return exact.find(row=>row.id===variantId)?.videoGenerationId ?? '';
    return (exact.find(row=>row.id===slotVariantId(dealerId,slot)) ?? exact.find(row=>row.id!==line?.baselineVariantId && row.selection?.rules) ?? exact[0])?.videoGenerationId ?? '';
  }
  return line?.variants.find(row => row.id === (variantId || line.baselineVariantId))?.videoGenerationId ?? '';
}
export function configuredClipIds(project, dealerId, slot, variantId, inventory) {
  if(slot.game==='roulette')return rouletteConfiguredClipIds(project,dealerId,slot);
  if(!slot.family&&slot.sourceType==='speak'){
    const line=project.lines.find(row=>row.dealerId===dealerId&&row.eventId===slot.eventId);
    const standard=currentSpeechVariant(project,inventory,dealerId,slot,line);
    const alternatives=line?.variants.filter(row=>row.id!==line.baselineVariantId&&!speechSlotSituation(line,row)
      &&speechVariantFits(inventory,dealerId,slot,row))??[];
    return [...new Set([standard,...alternatives].filter(Boolean).map(row=>row.videoGenerationId))];
  }
  if (!slot.family && slot.situation && slot.eventId!=='idle.ready') {
    const line=project.lines.find(row=>row.dealerId===dealerId&&row.eventId===slot.eventId);
    return [...new Set(exactSlotVariants(project,inventory,dealerId,slot,line).map(row=>row.videoGenerationId))];
  }
  if (!slot.family || slot.eventId === 'idle.ready') return [currentClipId(project,dealerId,slot,variantId,inventory)].filter(Boolean);
  return [...slot.family.standardIds.slice(0,1), ...(project.mediaPolicy?.find(row=>row.familyId===slot.family.id)?.variants ?? [])
    .filter(row=>Object.values(row.selection).some(Boolean)||(row.frequencyPercent??0)>0).map(row=>row.videoId)];
}

// The existing server still validates exact media bindings, role, scope, current
// session and expected revision. A local edit neither publishes nor creates a room.
export function bindClip(project, inventory, dealerId, slot, videoId, { variantId, durationMs } = {}) {
  validateProject(project);
  if(slot.game==='roulette')return validateProject(bindRouletteClip(project,inventory,dealerId,slot,videoId));
  const registeredSlot=clipSlots(project,inventory,dealerId).find(row=>row.id===slot.id);
  if (!registeredSlot || registeredSlot.eventId!==slot.eventId || registeredSlot.situation!==slot.situation
    || registeredSlot.sourceType!==slot.sourceType || registeredSlot.family?.id!==slot.family?.id) throw Error('Kortplatsen har ändrats. Välj den registrerade platsen igen.');
  const video = clipsForSlot(inventory, dealerId, slot).find(row => row.id === videoId);
  if (!video || !project.dealers.some(row => row.id === dealerId)) throw Error('Klippet passar inte denna dealer och kortplats.');
  const draft = structuredClone(project);
  const line = draft.lines.find(row => row.dealerId === dealerId && row.eventId === slot.eventId);
  if (!line) throw Error('Den registrerade klipplinjen saknas.');
  if (slot.eventId === 'idle.ready') {
    const old = slot.family ? draft.idlePolicy : draft.dealerIdlePolicies?.find(row => row.dealerId === dealerId)?.policy;
    if (old?.base.length > 1) throw Error('Grundloopen har flera basfilmer. Ändra poolen i den befintliga grundloopseditorn.');
    if (slot.family && !slot.family.standardIds.includes(videoId)) throw Error('Välj en registrerad basfilm; varianter hanteras i grundloopseditorn.');
    const policy = createRegisteredIdlePolicy({ dealerId, baselineVideoId: videoId, durationMs });
    if (old) policy.variants = structuredClone(old.variants);
    if (slot.family) { policy.familyId = slot.family.id; draft.idlePolicy = policy; }
    else draft.dealerIdlePolicies = [...(draft.dealerIdlePolicies ?? []).filter(row => row.dealerId !== dealerId), { dealerId, policy }];
    const baseline = line.variants.find(row => row.id === line.baselineVariantId);
    if (!baseline || baseline.triggerIds.length) throw Error('Grundloopens standardlinje kräver samordning i grundloopseditorn.');
    baseline.videoGenerationId = videoId;
  } else if (slot.family) {
    if (!slot.family.variantIds.includes(videoId)) throw Error('Registrerade familjers original är fasta. Välj ett alternativ eller förhandsvisa originalet.');
    const policy = mediaVariantPolicy(draft, slot.family, videoId);
    if (Object.hasOwn(policy, 'frequencyPercent')) throw Error('Denna kortplats använder frekvensstyrning. Ändra frekvensen i den befintliga klippeditorn.');
    draft.mediaPolicy = upsertMediaVariantPolicy(draft.mediaPolicy, slot.family.id, { ...policy, selection: { ...policy.selection, rules: true } });
  } else if (slot.sourceType==='speak') {
    if(!speechSlotVideoFits(video,{dealerId,eventId:slot.eventId,situation:slot.situation,requireRecordedSpeech:slot.eventId==='speak.other'}))
      throw Error('Talfacket kräver en tillgänglig film med exakt dealer, replik och inspelningsidentitet.');
    const standardId=speechSlotVariantId(dealerId,slot.eventId,slot.situation);
    if(!variantId||variantId===line.baselineVariantId||variantId===standardId)
      return validateProject(bindSpeechSlotStandard(draft,{dealerId,eventId:slot.eventId,situation:slot.situation,videoId}));
    const variant=line.variants.find(row=>row.id===variantId);
    if(!variant)throw Error('Välj en registrerad variant.');
    if(speechSlotSituation(line,variant)||variant.videoGenerationId&&!speechVariantFits(inventory,dealerId,slot,variant))
      throw Error('Den valda varianten tillhör ett annat exakt talfack. Välj fackets egen standard eller variant.');
    if([['event.type','speak'],['event.line',slot.situation]].some(([path,value])=>variant.triggerIds.some(id=>
      draft.triggers.some(trigger=>trigger.id===id&&trigger.path===path&&!predicateAllows(trigger,value)))))
      throw Error('Den valda variantens villkor hör till ett annat talfack.');
    variant.videoGenerationId=videoId;
  } else {
    const explicit = variantId && variantId!==line.baselineVariantId ? line.variants.find(row=>row.id===variantId) : null;
    if (variantId && !line.variants.some(row=>row.id===variantId)) throw Error('Välj en registrerad variant.');
    const conditions=slotConditions(draft,slot);
    if (conditions) {
      const id=slotVariantId(dealerId,slot);
      let variant=explicit ?? line.variants.find(row=>row.id===id)
        ?? exactSlotVariants(draft,inventory,dealerId,slot,line).find(row=>row.id!==line.baselineVariantId);
      if (variant?.videoGenerationId && !clipsForSlot(inventory,dealerId,slot).some(row=>row.id===variant.videoGenerationId)) {
        throw Error('Den valda varianten tillhör ett annat exakt fack. Välj fackets egen variant.');
      }
      if (variant && conditions.some(([path,value])=>variant.triggerIds.some(triggerId=>draft.triggers.some(trigger=>
        trigger.id===triggerId && trigger.path===path && !predicateAllows(trigger,value))))) {
        throw Error('Den valda variantens platsvillkor hör till ett annat fack.');
      }
      if (!variant) {
        if (line.variants.length>=MAX_ALTERNATIVES+1) throw Error('Högst fyra alternativ per eventgrupp. Frigör en variant innan du kopplar ett nytt fack.');
        const baseline=line.variants.find(row=>row.id===line.baselineVariantId);
        variant={id,label:slot.situation,priority:Math.min(100,baseline.priority+10),triggerIds:[],assetId:baseline.assetId,videoGenerationId:null};
        line.variants.push(variant);
      }
      for (const [path,value] of conditions) {
        const descriptor=allowedPathDescriptors.find(row=>row.path===path && row.category==='deterministic' && row.operators.includes('eq'));
        if (!descriptor) throw Error('Serverns eventkontrakt saknar detta exakta platsvillkor.');
        let trigger=draft.triggers.find(row=>row.path===path && row.op==='eq' && row.value===value);
        if (!trigger) {
          const triggerId=`studio.slot.${path}.${value}`;
          if (draft.triggers.some(row=>row.id===triggerId)) throw Error('Platsvillkorets sparade identitet används av ett annat villkor.');
          trigger={id:triggerId,label:`${descriptor.label}: ${value}`,category:'deterministic',path,op:'eq',value};
          draft.triggers.push(trigger);
        }
        if (!variant.triggerIds.includes(trigger.id)) variant.triggerIds.push(trigger.id);
      }
      variant.videoGenerationId=videoId;
      variant.selection={rules:true,model:false,random:false};
    } else {
      // Other shared catch-alls still need an authoritative per-slot condition.
      // Do not advertise per-slot binding by replacing a neighbour.
      const event=draft.events.find(row=>row.id===slot.eventId);
      const shared=situationsForEvent(event).length>1;
      if (shared && line.variants.some(row=>row.videoGenerationId && !clipsForSlot(inventory,dealerId,slot).some(video=>video.id===row.videoGenerationId))) {
        throw Error('Eventgruppen saknar ett verifierat servervillkor för separata fack. Den befintliga platsens koppling behålls.');
      }
      const variant=explicit ?? line.variants.find(row=>row.id===line.baselineVariantId);
      if (!variant) throw Error('Välj en registrerad variant.');
      if (variant.videoGenerationId && slot.situation && !clipsForSlot(inventory,dealerId,slot).some(video=>video.id===variant.videoGenerationId)) throw Error('Den valda varianten hör till en annan exakt situation.');
      variant.videoGenerationId=videoId;
    }
  }
  return validateProject(draft);
}

// This edits the shared template, never the choices of an individual room.
// Room choices use the existing scoped branding draft/review/publication API.
export function selectCompositionLayer(project, room, role, assetId) {
  const draft = structuredClone(project);
  const lane = draft.lanes?.find(row => row.id === room.compositionId);
  if (!lane || !['background', 'table'].includes(role) || !lane.layers[role].enabled
    || !lane.layers[role].allowed.includes(assetId)) throw Error('Lagret är inte tillåtet i rummets sammansättning.');
  if (role === 'table' && !layerAssetFitsGame(draft.layerAssets?.find(row=>row.id===assetId),room.game)) throw Error('Bordet tillhör ett annat spel eller saknar rätt speltyp.');
  const material=materialForAsset(draft.layerAssets?.find(row=>row.id===assetId));
  if(role==='table'&&material&&material.game!==room.game)throw Error('Bordet tillhör ett annat spel.');
  if(role==='table'&&material){lane.composition??=defaultCompositionSettings();lane.composition.tableFront=true;}
  lane.layers[role].default = assetId;
  return validateProject(draft);
}

export function roomChoicesPath(operator, room) {
  if (!operator || !room || room.operatorId !== operator.id || room.state !== 'live' || !room.published
    || !/^[a-z][a-z0-9-]{0,63}$/.test(room.id)) return null;
  const path = workspaceSurfacePath('partner', 'bj', operator.slug);
  return path ? `${path}?${new URLSearchParams({ room: room.id })}` : null;
}

export function navigationKeepsStudioTab(event, anchor) {
  const target = anchor.target?.toLowerCase();
  return Boolean(event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || anchor.hasAttribute('download') || target && !['_self', '_top', '_parent'].includes(target));
}

export function compositionUses(catalog, compositionId) {
  if (!compositionId) return [];
  return catalog.administration.rooms.filter(room => room.compositionId === compositionId && room.state !== 'archived')
    .map(room => ({ roomId: room.id, roomName: room.name,
      operatorName: catalog.administration.operators.find(operator => operator.id === room.operatorId)?.name ?? room.operatorId }));
}

export function uploadMetadata(project, dealerId, slot, file, compositing) {
  if(slot.game==='roulette'){
    if(slot.eventId==='roulette.reference')throw Error('PNG kan provas lokalt. Dealerregistrets beständiga PNG-stöd är ännu inte aktiverat.');
    const registered=rouletteClipSlots().find(row=>!row.planned&&row.id===slot.id&&row.eventId===slot.eventId&&row.situation===slot.situation);
    if(!registered)throw Error('Detta roulettefack är planerat och har ännu inget uppladdningskontrakt.');
    const image=slot.eventId==='roulette.reference';
    if(!file||file.size<16||file.size>MAX_VIDEO_BYTES||!(image?/\.png$/i:/\.(mp4|webm)$/i).test(file.name))throw Error(image?'Välj PNG med alfa, högst 128 MB.':'Välj MP4 eller WebM, högst 128 MB.');
    const contentType=image?'image/png':/\.mp4$/i.test(file.name)?'video/mp4':'video/webm';
    const metadata=mediaClassification(project,{dealerId,slotId:slot.id,label:file.name.replace(/\.[^.]+$/,'').slice(0,120),contentType});
    return validateVideoMetadata({...metadata,compositing:image?{mode:'alpha'}:compositing},{forWrite:true});
  }
  const event = project.events.find(row => row.id === slot.eventId);
  if (!event || !project.dealers.some(row => row.id === dealerId)) throw Error('Välj en registrerad dealer och kortplats.');
  if (!file || file.size < 16 || file.size > MAX_VIDEO_BYTES || !/\.(mp4|webm)$/i.test(file.name)) throw Error('Välj MP4 eller WebM, högst 128 MB.');
  if (event.sourceType === 'speak') throw Error('Talmedia kräver exakt text, ljud, video och separat acceptans. Använd den befintliga taleditorn.');
  return validateVideoMetadata({ label: file.name.replace(/\.[^.]+$/, '').slice(0, 120), dealerId,
    eventId: slot.eventId, kind: kindForEvent(event), role: slot.family ? 'alternative' : 'standard',
    situation: slot.family?.playbackType === 'idle-pool' ? '' : slot.situation, playback: 'once', notes: '',
    ...(slot.family ? { familyId: slot.family.id } : {}), compositing,
  }, { forWrite: true });
}

export function createStudioClient({ fetchImpl = fetch, uploadImpl = uploadNativeVideo } = {}) {
  async function json(url, init = {}) {
    const response = await fetchImpl(url, { ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { ...init.headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      const error = new Error(data?.error === 'studio_presentation_runtime_update_required' ? 'Spelmotorn behöver uppdateras för uppsättningskategorier innan de kan sparas. Ditt utkast finns kvar.'
        : response.status === 409 ? 'En annan ändring har sparats. Ditt utkast finns kvar; läs in den nya revisionen innan du sparar igen.'
        : [401, 403].includes(response.status) ? 'N1-behörigheten saknas eller har gått ut. Logga in igen.'
          : 'Riktiga Studio-data är otillgängliga. Försök igen.');
      error.statusCode = response.status; throw error;
    }
    return data;
  }
  return {
    async load(signal) {
      const [catalog, saved, inventory] = await Promise.all([
        json('/admin/_data/catalog', { signal }), json('/studio/api/project', { signal }), json('/studio/api/videos', { signal }),
      ]);
      if (catalog.source !== 'registered' || !saved.project || !Array.isArray(inventory.videos)
        || catalog.administration?.revisions?.project !== saved.project.revision) throw Error('Registren ändrades under läsningen. Läs om för att få samma revision.');
      validateProject(saved.project);
      return { catalog, project: saved.project, inventory };
    },
    async save(project, signal) {
      const submitted = validateProject(structuredClone(project));
      const result = await json('/studio/api/project', { method: 'PUT', body: JSON.stringify({ project: submitted, expectedRevision: submitted.revision }), signal });
      if (!result.project) throw Error('Den sparade revisionen kunde inte verifieras. Behåll utkastet och läs om.');
      return validateProject(result.project);
    },
    async upload(file, metadata, signal) {
      if(metadata.mediaType==='image')throw Error('PNG kan provas lokalt. Dealerregistrets beständiga PNG-stöd är ännu inte aktiverat.');
      const mode = await json('/studio/api/videos', { signal });
      if (mode.uploadMode !== 'private-client-blob') throw Error('Den skyddade uppladdningen är otillgänglig i denna miljö.');
      const contentType = /\.png$/i.test(file.name) ? 'image/png' : /\.mp4$/i.test(file.name) ? 'video/mp4' : 'video/webm';
      const result = await uploadImpl(file, metadata, contentType, { signal, fetchImpl });
      const inventory = await json('/studio/api/videos', { signal });
      const video = inventory.videos?.find(row => row.id === result.id && row.available === true);
      const rouletteSlot=metadata.game==='roulette'?rouletteClipSlots().find(slot=>slot.eventId===metadata.eventId&&slot.situation===metadata.situation):null;
      if (!video || !(rouletteSlot?rouletteClipMatches(video,metadata.dealerId,rouletteSlot):videoFitsLine(video, metadata.dealerId, metadata.eventId))
        || video.classification.situation !== metadata.situation || video.classification.familyId !== metadata.familyId) {
        throw Error('Filen har sparats, men exakt kortplats kunde inte återläsas. Koppla inte filmen innan registret har uppdaterats.');
      }
      return { inventory, video };
    },
  };
}
