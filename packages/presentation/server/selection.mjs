// Server selection core. App composition supplies model, Director and media rules.
import { randomUUID, createHash } from 'node:crypto';
import { StudioError } from '../../shared/studio-error.mjs';
import { createVideoBindingValidator } from './video-bindings.mjs';
import { dealFrequencyPolicies, pickDealFrequency, mediaLineForEvent, mediaVideoForEvent } from '../runtime/media-family-policy.mjs';
import { mediaSituationForEvent } from '../runtime/media-family-resolver.mjs';

export function createPresentationSelection({ projectModel, director, videoRules, speechSlots }) {
  const { buildRuntimeCatalog, isDirectorSourceType, validateProject } = projectModel;
  const { prepareDecision, finalizeDecision, askDirector, remoteRequest } = director;
  const { selectionFor, videoFitsEvent } = videoRules;
  const { speechSlotSituation, speechSlotStandard, OTHER_SPEECH_SLOT_IDS } = speechSlots;
  const validateVideoBindings = createVideoBindingValidator({ videoRules, speechSlots });

  // All AI advice is scoped to the exact draft, not merely its last saved revision.
  function decisionCatalog(project, dealerId, mode = 'active') {
    const catalog = buildRuntimeCatalog(validateProject(project), dealerId);
    const variants = new Map(project.lines.filter(l => l.dealerId === dealerId).flatMap(l => l.variants).map(v => [v.id, v]));
    const method = mode === 'rules' ? 'rules' : mode === 'random' ? 'random' : 'model';
    for (const event of catalog.events) event.variants = event.variants.filter(v => v.id === event.baselineVariantId || selectionFor(variants.get(v.id))[method]);
    catalog.revision = `draft-${createHash('sha256').update(JSON.stringify({ project, dealerId, mode })).digest('hex')}`;
    return catalog;
  }

  async function selectPresentation(body, { settings = {}, fetchImpl = fetch, videoRegistry, random = Math.random } = {}) {
    if (!['off', 'rules', 'random', 'shadow', 'active'].includes(body?.mode)) throw new StudioError('Välj standard, regler, slump, shadow eller active.');
    const savedProject = validateProject(body.project);
    await validateVideoBindings(savedProject, { registry: videoRegistry });
    const event = savedProject.events.find(item => item.id === body.eventId);
    if (!event) throw new StudioError('Eventet finns inte i kontraktet.');
    if (!isDirectorSourceType(event.sourceType)) throw new StudioError('Övergångar är klippfack och väljs inte som spelmotorevent.');
    const observed = Object.hasOwn(body, 'sourceEvent');
    if (observed && Object.hasOwn(body, 'exampleEvent')) throw new StudioError('Välj ett mottaget event eller ett labbexempel.');
    // Both routes use the same input projection, matching and variant gate. A
    // recorded instruction must never be replaced by the editor's example.
    const input = { requestId: body.requestId ?? randomUUID(), event: observed ? body.sourceEvent : (body.exampleEvent ?? event.exampleEvent), context: body.context, mode: ['rules', 'random'].includes(body.mode) ? 'active' : body.mode };
    const slot = event.id === 'speak.other' && input.event?.type === 'speak' && OTHER_SPEECH_SLOT_IDS.includes(input.event.line)
      ? speechSlotStandard(savedProject, body.dealerId, event.id, input.event.line) : null;
    // Project-authored standards take precedence for this exact source line only.
    // No family or inventory lookup may fill an absent slot standard.
    const media = slot ? { managed: false } : mediaLineForEvent(savedProject, videoRegistry, body.dealerId, event.id, input.event);
    const frequency = dealFrequencyPolicies(savedProject, media.family);
    // Only explicit current bindings can select a clip. Historical variant names
    // never promote a clip into the standard line merely because a box matches.
    let project = media.managed
      ? { ...savedProject, lines: savedProject.lines.map(line => line.dealerId === body.dealerId && line.eventId === event.id ? media.line : line) }
      : savedProject;
    if (event.id === 'speak.other') project = { ...project, lines: project.lines.map(line => {
      if (line.dealerId !== body.dealerId || line.eventId !== event.id) return line;
      return { ...line, variants: line.variants.filter(variant => !speechSlotSituation(line, variant)).map(variant =>
        slot && variant.id === line.baselineVariantId ? { ...variant, label: slot.label, assetId: slot.assetId, videoGenerationId: slot.videoGenerationId } : variant) };
    }) };
    const catalog = decisionCatalog(project, body.dealerId, body.mode);
    let prepared = prepareDecision(catalog, input);
    if (prepared.node.id !== body.eventId) throw new StudioError('Källeventet matchar inte vald eventgrupp.');
    // Reject incompatible explicit alternatives BEFORE asking the adviser. The
    // unconditional baseline keeps its marked 2D fallback when media is missing.
    const lineForEvent = project.lines.find(item => item.eventId === event.id && item.dealerId === body.dealerId);
    const excluded = new Set(lineForEvent.variants.filter(variant => {
      if (variant.id === lineForEvent.baselineVariantId || !variant.videoGenerationId) return false;
      const video = videoRegistry?.videos.find(item => item.id === variant.videoGenerationId);
      return !video?.available || (media.managed ? !mediaVideoForEvent(videoRegistry, body.dealerId, event.id, prepared.event, video.id) : !videoFitsEvent(video, prepared.event));
    }).map(variant => variant.id));
    if (excluded.size) {
      catalog.events.find(item => item.id === event.id).variants = prepared.node.variants.filter(variant => !excluded.has(variant.id));
      catalog.revision = `draft-${createHash('sha256').update(JSON.stringify(catalog)).digest('hex')}`;
      prepared = prepareDecision(catalog, input);
    }
    prepared.trace.splice(2, 0, { stage: 'compatibility', status: excluded.size ? 'filtered' : 'checked', detail: `${excluded.size} alternativ uteslutna på grund av saknad eller felmatchad video. Obundna alternativ är endast 2D-prov; standardens reserv finns kvar.` });
    let reply = { advice: null, provider: { status: 'off' } };
    if (frequency && body.mode !== 'off') {
      const variantId = pickDealFrequency(frequency, lineForEvent, prepared.eligible.map(variant => variant.id), random);
      reply = { advice: { requestId: prepared.requestId, catalogRevision: prepared.catalogRevision, variantId }, provider: { status: 'local_deal_frequency' } };
    } else if (body.mode === 'rules' || body.mode === 'random') {
      const index = body.mode === 'random' ? Math.min(prepared.eligible.length - 1, Math.max(0, Math.floor(random() * prepared.eligible.length))) : 0;
      reply = { advice: { requestId: prepared.requestId, catalogRevision: prepared.catalogRevision, variantId: prepared.eligible[index].id }, provider: { status: body.mode === 'random' ? 'local_random' : 'deterministic_rules' } };
    } else if (media.managed && prepared.eligible.length === 1 && body.mode !== 'off') {
      reply = { advice: null, provider: { status: 'only_standard_no_model' } };
    } else if (body.mode !== 'off') {
      if (settings.remoteUrl) {
        try {
          reply = await remoteRequest('/api/studio/advice', { catalog, input: { ...input, event: prepared.event, context: prepared.context } }, settings, fetchImpl, Math.max(500, settings.adviceTimeoutMs + 1500));
          if (prepared.context.observedChat && (reply?.provider?.contextContractVersion !== 2 || reply.provider.observedChatMessages !== prepared.context.observedChat.messages.length)) {
            reply = { advice: null, provider: { status: 'remote_context_not_supported_baseline' } };
          }
        }
        catch { reply = { advice: null, provider: { status: 'remote_unavailable_baseline' } }; }
      } else reply = await askDirector(prepared, settings, fetchImpl);
    }
    const result = finalizeDecision(prepared, reply?.advice ?? null, input.mode);
    const line = project.lines.find(item => item.eventId === event.id && item.dealerId === body.dealerId);
    const variant = line.variants.find(item => item.id === result.selected.id);
    if (frequency && body.mode !== 'off') {
      result.trace = result.trace.map(step => step.stage === 'advice' ? { stage: 'frequency', status: 'selected', detail: 'Sparade procentandelar för exakt utdelningsplats. Återstående andel och saknade filmer ger standard. Inget modellanrop.' } : step);
      if (body.mode !== 'shadow') result.gate.reason = 'local_deal_frequency';
    } else if (body.mode === 'rules') {
      result.trace = result.trace.map(step => step.stage === 'advice' ? { stage: 'rules', status: 'selected', detail: 'Regelmotorn väljer högst prioriterade tillåtna variant. Inget modellanrop.' } : step);
      result.gate.reason = 'deterministic_rules';
    }
    if (!frequency && body.mode === 'random') {
      result.trace = result.trace.map(step => step.stage === 'advice' ? { stage: 'random', status: 'selected', detail: 'Lika sannolikhet bland standard och uttryckligen slumpaktiverade alternativ vars triggers matchar. Endast labbpresentation.' } : step);
      result.gate.reason = 'local_random';
    }
    let videoGenerationId = variant.videoGenerationId;
    if (videoGenerationId) {
      const video = videoRegistry.videos.find(v => v.id === videoGenerationId);
      const unavailablePosition = prepared.event.type === 'deal' && video?.available === false;
      if (unavailablePosition || (media.managed ? !mediaVideoForEvent(videoRegistry, body.dealerId, event.id, prepared.event, videoGenerationId) : !videoFitsEvent(video, prepared.event))) {
        videoGenerationId = null;
        result.trace.push({ stage: 'video', status: 'fallback', detail: 'Videons exakta situation/replik matchar inte exempel-eventet. Visar variantens 2D-reserv.' });
      }
    }
    const selectedVideo = videoRegistry.videos.find(video => video.id === videoGenerationId);
    const missingPosition = !videoGenerationId && prepared.event.type === 'deal'
      && mediaSituationForEvent(event.id, prepared.event) !== null;
    const mediaReceipt = media.managed || missingPosition ? { familyId: media.family?.id ?? null, situation: media.family?.situation ?? (missingPosition ? mediaSituationForEvent(event.id, prepared.event) : null),
      videoId: videoGenerationId, fileName: selectedVideo?.fileName ?? null, sha256: selectedVideo?.sha256 ?? null,
      standard: variant.id === media.line.baselineVariantId, reason: videoGenerationId ? 'exact_family' : missingPosition ? 'position_clip_missing' : 'no_exact_video_2d' } : null;
    if (mediaReceipt) result.trace.push({ stage: 'media-family', status: videoGenerationId ? 'selected' : missingPosition ? 'skipped' : 'fallback', detail: videoGenerationId ? `${mediaReceipt.familyId} → ${mediaReceipt.fileName}` : missingPosition ? 'Ingen video för exakt utdelningsposition. Händelsens video hoppas över; serverns kort visas utan dealerfilm.' : 'Ingen video för exakt situation. 2D-reserven används.' });
    return {
      decision: { requestId: prepared.requestId, variantId: variant.id, reason: result.gate.reason, mode: body.mode, sourceEvent: prepared.event, media: mediaReceipt, context: prepared.context, simulated: !observed, presentationReplay: observed },
      trace: result.trace, eligible: result.eligible, variant, asset: result.asset,
      videoGenerationId, provider: typeof reply?.provider?.status === 'string' ? reply.provider.status : 'unknown',
      contextReceipt: { contractVersion: reply?.provider?.contextContractVersion ?? null, observedChatMessages: reply?.provider?.observedChatMessages ?? null },
    };
  }
  return Object.freeze({ decisionCatalog, selectPresentation });
}
