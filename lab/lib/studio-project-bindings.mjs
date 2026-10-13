import { validateDealerSpeechReference } from '../../web/public/dealer-speech-profile.mjs';
import { StudioStorageError } from '../../web/storage/studio-contract.mjs';
import { validateProject } from './studio-model.mjs';
import { validateVideoBindings } from '../../presentation-runtime/selection.mjs';
import { resolveLegacyClipPolicy } from '../../presentation-runtime/legacy-clip-policy.mjs';
import { validateDealerSetBindings } from './dealer-sets.mjs';

const fail = (code, statusCode = 422) => {throw new StudioStorageError(code,statusCode);};
function checkedVideo(videos,id,dealerId,eventId) {
  const video = videos.get(id);
  if (!video || (video.classification?.mediaType === 'audio' || video.classification?.archived) || video.available !== true || video.dealer !== dealerId || !/^[a-f0-9]{64}$/.test(video.sha256)
    || !Number.isSafeInteger(video.bytes) || video.bytes < 1 || video.integrity === 'unavailable') fail('studio_media_binding_invalid');
  if (video.familyId && video.eventId !== eventId) fail('studio_media_binding_invalid');
  return video;
}
export function createStudioProjectBindings({videoRegistry,legacyControls} = {}) {
  if (typeof videoRegistry !== 'function') fail('studio_media_verifier_required',503);
  return async function validateProjectBindings(input) {
    let project;
    try {project = validateProject(structuredClone(input));}
    catch {fail('studio_invalid_document');}
    const registry = await videoRegistry();
    if (!registry || !Array.isArray(registry.videos) || !Array.isArray(registry.families)) fail('studio_media_registry_unavailable',503);
    const videos = new Map(registry.videos.map(video => [video.id,video]));
    const families = new Map(registry.families.map(family => [family.id,family]));
    for (const dealer of project.dealers) if (dealer.speechProfile?.reference) {
      try { validateDealerSpeechReference(dealer.speechProfile,videos.get(dealer.speechProfile.reference.videoId),dealer.id); }
      catch { fail('studio_speech_reference_invalid'); }
    }
    if (videos.size !== registry.videos.length || families.size !== registry.families.length) fail('studio_media_registry_unavailable',503);
    try { validateDealerSetBindings(project, registry); }
    catch { fail('studio_media_binding_invalid'); }
    try {await validateVideoBindings(project,{registry});}
    catch {fail('studio_media_binding_invalid');}
    // Even manifest-owned dealers cannot persist hidden references to another
    // dealer, event or unavailable upload in their saved legacy lines.
    for (const line of project.lines) for (const variant of line.variants) if (variant.videoGenerationId !== null) {
      checkedVideo(videos,variant.videoGenerationId,line.dealerId,line.eventId);
    }
    for (const row of project.mediaPolicy ?? []) {
      const family = families.get(row.familyId);
      if (!family || !project.dealers.some(dealer => dealer.id === family.dealerId)
        || !project.events.some(event => event.id === family.eventId)) fail('studio_media_binding_invalid');
      for (const variant of row.variants) {
        const video = checkedVideo(videos,variant.videoId,family.dealerId,family.eventId);
        if (video.familyId !== family.id || video.role !== 'variant' || !family.variantIds.includes(video.id)) fail('studio_media_binding_invalid');
      }
    }
    if (project.idlePolicy) {
      const family = families.get(project.idlePolicy.familyId);
      if (!family || family.dealerId !== 'astrid' || family.eventId !== 'idle.ready' || family.playbackType !== 'idle-pool') fail('studio_idle_binding_invalid');
      for (const [role,rows,ids] of [['standard',project.idlePolicy.base,family.standardIds],['variant',project.idlePolicy.variants,family.variantIds]]) {
        for (const row of rows) {
          const video = checkedVideo(videos,row.videoId,'astrid','idle.ready');
          if (video.familyId !== family.id || video.role !== role || !ids.includes(video.id)) fail('studio_idle_binding_invalid');
        }
      }
    }
    if (project.legacyClipPolicy?.length) {
      if (typeof legacyControls !== 'function') fail('studio_legacy_media_verifier_required',503);
      const inventory = await legacyControls(project);
      if (!inventory || !Array.isArray(inventory.clips) || inventory.reviewSafetyVerified !== true) fail('studio_legacy_review_safety_unavailable',503);
      if (resolveLegacyClipPolicy(project,inventory).conflicts.length) fail('studio_legacy_binding_invalid');
    }
  };
}
