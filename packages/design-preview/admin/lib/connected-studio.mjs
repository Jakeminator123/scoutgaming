import { videoFitsLine, validateVideoMetadata, kindForEvent, situationsForEvent, MAX_VIDEO_BYTES } from '../../../../lab/lib/video-intake.mjs';
import { upsertMediaVariantPolicy, mediaVariantPolicy } from '../../../../presentation-runtime/media-family-policy.mjs';
import { createRegisteredIdlePolicy } from '../../../../presentation-runtime/registered-idle-policy.mjs';
import { validateProject } from '../../../../lab/lib/studio-model.mjs';
import { uploadNativeVideo } from '../../../../lab/lib/upload-native-video.mjs';

export function clipSlots(project, inventory, dealerId) {
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
  return inventory.videos.filter(video => video.available === true && video.integrity !== 'unavailable'
    && !video.classification?.archived && videoFitsLine(video, dealerId, slot.eventId)
    && (slot.family ? video.familyId === slot.family.id && [...slot.family.standardIds, ...slot.family.variantIds].includes(video.id)
      : video.classification.situation === slot.situation));
}
export function currentClipId(project, dealerId, slot, variantId) {
  const line = project.lines.find(row => row.dealerId === dealerId && row.eventId === slot.eventId);
  if (slot.eventId === 'idle.ready') return project.dealerIdlePolicies?.find(row => row.dealerId === dealerId)?.policy.base[0]?.videoId
    ?? (slot.family ? project.idlePolicy?.base[0]?.videoId : null)
    ?? line?.variants.find(row => row.id === line.baselineVariantId)?.videoGenerationId ?? '';
  if (slot.family) return project.mediaPolicy?.find(row => row.familyId === slot.family.id)?.variants
    .find(row => Object.values(row.selection).some(Boolean) || (row.frequencyPercent ?? 0) > 0)?.videoId ?? slot.family.standardIds[0] ?? '';
  return line?.variants.find(row => row.id === (variantId || line.baselineVariantId))?.videoGenerationId ?? '';
}
export function configuredClipIds(project, dealerId, slot, variantId) {
  if (!slot.family || slot.eventId === 'idle.ready') return [currentClipId(project,dealerId,slot,variantId)].filter(Boolean);
  return [...slot.family.standardIds.slice(0,1), ...(project.mediaPolicy?.find(row=>row.familyId===slot.family.id)?.variants ?? [])
    .filter(row=>Object.values(row.selection).some(Boolean)||(row.frequencyPercent??0)>0).map(row=>row.videoId)];
}

// The existing server still validates exact media bindings, role, scope, current
// session and expected revision. A local edit neither publishes nor creates a room.
export function bindClip(project, inventory, dealerId, slot, videoId, { variantId, durationMs } = {}) {
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
  } else {
    const variant = line.variants.find(row => row.id === (variantId || line.baselineVariantId));
    if (!variant) throw Error('Välj en registrerad variant.');
    variant.videoGenerationId = videoId;
  }
  return validateProject(draft);
}

export function selectLayer(project, room, role, assetId) {
  const draft = structuredClone(project);
  const lane = draft.lanes?.find(row => row.id === room.compositionId);
  if (!lane || !['background', 'table'].includes(role) || !lane.layers[role].enabled
    || !lane.layers[role].allowed.includes(assetId)) throw Error('Lagret är inte tillåtet i rummets sammansättning.');
  // The legacy table registry has no game tag. Do not infer that a blackjack
  // table is valid for roulette before Jakob supplies and accepts that design.
  if (role === 'table' && room.game !== 'blackjack') throw Error('Roulettens bord behöver separat designunderlag.');
  lane.layers[role].default = assetId;
  return validateProject(draft);
}

export function uploadMetadata(project, dealerId, slot, file, compositing) {
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
      const error = new Error(response.status === 409 ? 'En annan ändring har sparats. Ditt utkast finns kvar; läs in den nya revisionen innan du sparar igen.'
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
      const mode = await json('/studio/api/videos', { signal });
      if (mode.uploadMode !== 'private-client-blob') throw Error('Den skyddade uppladdningen är otillgänglig i denna miljö.');
      const contentType = /\.mp4$/i.test(file.name) ? 'video/mp4' : 'video/webm';
      const result = await uploadImpl(file, metadata, contentType, { signal, fetchImpl });
      const inventory = await json('/studio/api/videos', { signal });
      const video = inventory.videos?.find(row => row.id === result.id && row.available === true);
      if (!video || !videoFitsLine(video, metadata.dealerId, metadata.eventId)
        || video.classification.situation !== metadata.situation || video.classification.familyId !== metadata.familyId) {
        throw Error('Filen har sparats, men exakt kortplats kunde inte återläsas. Koppla inte filmen innan registret har uppdaterats.');
      }
      return { inventory, video };
    },
  };
}
