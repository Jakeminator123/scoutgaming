// Dealer Forge: from one still image to a reviewed dealer clip bank.
// Runway does the generation; this service owns anchors (poses), the job
// journal (migration 008), and the hand-off of finished bytes into the
// existing private-Blob + media_records / project.layerAssets contracts.
// Nothing here publishes: every committed clip lands as a review upload in
// its exact slot and follows the ordinary Dealers & klipp acceptance flow.
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StudioStorageError, validateActor, canonicalStudioJson } from '../../web/storage/studio-contract.mjs';
import { validateLayerAsset, layerAssetPath } from '../../web/layer-asset-contract.mjs';
import { SPEECH_LINES } from '../../web/public/speech-lines.mjs';
import { isDealerId } from '../../web/dealer-identity.mjs';
import { getPrivateMedia, mediaBlobPath, putPrivateMedia, validatePrivateMedia } from './cloud-media-store.mjs';
import { mediaHeaderMatches } from '../../packages/shared/media-file-types.mjs';
import { dealerLibraryVideos, mediaClassification, mediaMatchesSlot } from './dealer-media-library.mjs';
import { addDealer, normalizeProject } from './studio-model.mjs';
import { validateVideoMetadata } from './video-intake.mjs';
import { anchorsFor, forgeSlots, slotById, slotPlan, slotPrompt, validateProfile, FORGE_GROUPS, speechTextFor } from './dealer-forge-catalog.mjs';
import { backgroundGuide, backgroundLayer, markCardTarget, normalizeAnchor, poseFromGenerated, tableGuide, tableLayerFromMagenta } from './dealer-forge-images.mjs';
import { createDealerForgeStore, ACTIVE_STATUSES } from './dealer-forge-store.mjs';
import { createRunwayClient, runwayConfigured, RunwayError, TASK_ID } from './runway-client.mjs';

export class ForgeError extends Error {
  constructor(message, { status = 422, code = 'forge_invalid_request' } = {}) { super(message); this.name = 'ForgeError'; this.statusCode = status; this.code = code; }
}
const fail = (message, status = 422, code = 'forge_invalid_request') => { throw new ForgeError(message, { status, code }); };
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
// Leases are bounded by the route's maxDuration (120 s): a lease older than this belongs to a dead worker.
const SUBMIT_LEASE_MS = 3 * 60_000;
const COMMIT_LEASE_MS = 5 * 60_000;
const MAX_ANCHOR_UPLOAD = 24 * 1024 * 1024;
const MAX_REFERENCE_VIDEO = 60 * 1024 * 1024;
const REQUEST_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const FINGERPRINT_FIELDS = ['slotId', 'quality', 'duration', 'mode', 'expression', 'referenceMediaId', 'audioMediaId', 'speechSeconds', 'speechText', 'prompt', 'seed', 'maxCredits'];
const requestFingerprint = (dealerId, body) => createHash('sha256').update(JSON.stringify([dealerId, ...FINGERPRINT_FIELDS.map(key => body[key] ?? null)])).digest('hex');
/** Same job + purpose → same UUID, so a retried commit targets the record an earlier attempt may already have written. */
function forgeUuid(jobId, purpose) {
  const hex = createHash('sha256').update(`dealer-forge:${jobId}:${purpose}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((Number.parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function createDealerForgeService({ repository, scope, env = process.env, mutationTransaction, gamePolicy, videoRegistry, validateProjectBindings,
  now = Date.now, runwayFactory = options => createRunwayClient(options), fetchImpl = fetch, store = createDealerForgeStore({ repository, scope, now }),
  images = { normalizeAnchor, markCardTarget, tableGuide, backgroundGuide, tableLayerFromMagenta, backgroundLayer, poseFromGenerated },
  privateMedia = { get: getPrivateMedia, put: putPrivateMedia } } = {}) {
  if (!repository?.readDocument || !repository?.registerMedia || typeof mutationTransaction !== 'function' || typeof videoRegistry !== 'function') fail('Forge-tjänsten saknar repository, transaktion eller mediaregister.', 503, 'forge_configuration');
  const mediaOptions = { env: Object.freeze({ ...env }), cacheDir: join(tmpdir(), 'croupier-private-media') };
  const runway = () => runwayFactory({ env, fetchImpl });

  async function ensureReady() {
    if (!(await store.ready())) fail('Dealer Forge väntar på Studio-migration 008 (forge_dealers/forge_jobs). Kör den granskade migrationen mot databasen först.', 503, 'forge_migration_pending');
  }
  async function project() {
    const saved = await repository.readDocument('project');
    if (!saved) fail('Projektdokumentet saknas.', 503, 'studio_document_missing');
    return { revision: saved.revision, value: normalizeProject(saved.value) };
  }
  function dealerOf(projectValue, dealerId) {
    if (!isDealerId(dealerId)) fail('Ogiltigt dealer-id.', 422, 'forge_invalid_dealer');
    const dealer = projectValue.dealers.find(row => row.id === dealerId);
    if (!dealer) fail('Dealern är inte registrerad i projektet.', 404, 'forge_dealer_unknown');
    return dealer;
  }
  async function profileOf(dealerId) {
    const saved = await store.getProfile(dealerId);
    return saved ? { revision: saved.revision, profile: validateProfile(saved.profile) } : { revision: null, profile: validateProfile({}) };
  }
  async function saveProfile(dealerId, current, next, actor) {
    const checked = validateProfile(next);
    return store.saveProfile(dealerId, checked, { expectedRevision: current.revision, actor });
  }
  // The provider download happens outside SQL. Recheck the exact lease and
  // dealer under the same scope lock as every resulting database write.
  async function withCommit(job, work) {
    return repository.transaction(async () => {
      const current = await store.getJob(job.jobId);
      const saved = await repository.readDocument('project');
      if (!current || current.status !== 'committing' || canonicalStudioJson(current) !== canonicalStudioJson(job)) {
        throw new StudioStorageError('studio_forge_conflict', 409);
      }
      if (!saved?.value.dealers?.some(row => row.id === job.dealerId)) {
        throw new StudioStorageError('studio_dealer_inactive', 409);
      }
      await store.assertJobReferences(job);
      return work();
    });
  }
  async function readPrivate(record) {
    const storage = validatePrivateMedia({ provider: 'vercel-blob', pathname: record.pathname, sha256: record.sha256, size: record.size, contentType: record.contentType });
    const response = await privateMedia.get(storage, new Request('https://dealer-forge.internal/read', { method: 'GET' }), mediaOptions);
    if (!response.ok) { await response.body?.cancel?.(); fail('Ankaret kunde inte läsas från privat lagring.', 503, 'forge_anchor_unreadable'); }
    return Buffer.from(await response.arrayBuffer());
  }
  async function readMedia(id, references) {
    const record = await repository.getMedia(id);
    if (!record || record.deletion || record.classification.archived) fail('Mediafilen finns inte längre.', 404, 'forge_reference_missing');
    if (references) references.push(Object.fromEntries(['id', 'sha256', 'pathname', 'revision'].map(key => [key, record[key]])));
    return [await readPrivate(record), record.contentType];
  }
  /** Blob paths are immutable and content-addressed: when a retry finds the object already written with the same
   *  hash, the earlier attempt succeeded and the write counts as done. */
  async function putImmutable(pathname, bytes, { sha256, size, contentType }) {
    try { await privateMedia.put(pathname, bytes, { sha256, size, contentType, env: mediaOptions.env, cacheDir: mediaOptions.cacheDir }); }
    catch (cause) {
      let present = false;
      try {
        const response = await privateMedia.get(validatePrivateMedia({ provider: 'vercel-blob', pathname, sha256, size, contentType }), new Request('https://dealer-forge.internal/verify', { method: 'HEAD' }), mediaOptions);
        await response.body?.cancel?.(); present = response.ok;
      } catch { present = false; }
      if (!present) throw cause;
    }
  }
  async function storeAnchor(dealerId, normalized, id = randomUUID()) {
    const pathname = mediaBlobPath(`dealers/${dealerId}/source/anchors`, id, normalized.sha256, 'png');
    await putImmutable(pathname, normalized.bytes, { sha256: normalized.sha256, size: normalized.size, contentType: 'image/png' });
    return { pathname, sha256: normalized.sha256, size: normalized.size, contentType: 'image/png', width: normalized.width, height: normalized.height };
  }
  /** Record the outcome of a submit on the leased row. The paid POST already happened, so a lost write must
   *  not be mistaken for "nothing started": retry, read back, and if the journal stays unreachable surface
   *  the task-ID so the operator can attach it once the lease expires into submit_unknown. */
  async function persistOutcome(jobId, outcome) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return await store.updateJob(jobId, { expectedStatus: 'submitting', ...outcome }); } catch (cause) { lastError = cause; }
      const seen = await store.getJob(jobId).catch(() => null);
      if (!seen || seen.status === 'submitting') continue;
      if (seen.status === outcome.status && (seen.taskId ?? null) === (outcome.taskId ?? null)) return seen;
      if (seen.status === 'submit_unknown' && outcome.taskId) {
        try { return await store.updateJob(jobId, { expectedStatus: 'submit_unknown', status: 'running', taskId: outcome.taskId, error: null }); } catch (cause) { lastError = cause; continue; }
      }
      return seen;
    }
    if (outcome.status === 'failed') throw lastError;
    fail(outcome.taskId
      ? `Runway startade jobbet (task-ID ${outcome.taskId}) men journalen kunde inte uppdateras. Skicka inte om; koppla task-ID:t när jobbet visas som okänt.`
      : 'Runway-svaret kunde inte journalföras. Skicka inte om; kontrollera Runway-portalen när jobbet visas som okänt.', 503, 'forge_submit_unrecorded');
  }
  /** The job row is already `submitting` (CAS from prepared or queued). Pay exactly once and record the outcome:
   *  running (task-ID), submit_unknown (no definite answer, operator resolves) or failed (definite rejection). */
  async function submitLeased(jobId, endpoint, params, client, result) {
    let taskId = null, status = 'running', error = null;
    try {
      taskId = endpoint === 'text_to_image' ? await client.textToImage(params) : endpoint === 'avatar_videos' ? await client.avatarVideo(params) : await client.imageToVideo(params);
    } catch (cause) {
      if (cause instanceof RunwayError && cause.submitUnknown) { status = 'submit_unknown'; error = cause.message; }
      else {
        await persistOutcome(jobId, { status: 'failed', error: String(cause?.message ?? 'Runway avvisade anropet.').slice(0, 2000) }).catch(() => {});
        throw cause;
      }
    }
    return persistOutcome(jobId, { status, taskId, error, ...(result ? { result } : {}) });
  }
  const slotMedia = (projectValue, inventory, dealerId, slot) => slot.eventId
    ? dealerLibraryVideos(projectValue, inventory, dealerId).filter(video => mediaMatchesSlot(video, { eventId: slot.eventId, situation: slot.situation }))
    : [];
  const publicJob = job => ({ ...job, request: job.request ? { ...job.request, params: undefined } : job.request });

  function slotStatus(slot, media, jobs, profile, projectValue) {
    const active = jobs.some(job => ACTIVE_STATUSES.includes(job.status));
    if (slot.kind === 'pose') {
      const has = Boolean(profile.anchors[slot.pose]);
      return has ? { level: 'ready', label: 'Finns' } : active ? { level: 'pending', label: 'Genereras…' } : { level: 'required', label: slot.pose === 'vila' ? 'Krävs · ladda upp bild' : 'Krävs · generera från VILA' };
    }
    if (slot.kind === 'table' || slot.kind === 'background') {
      const count = (projectValue.layerAssets ?? []).filter(asset => asset.role === slot.role && asset.label.startsWith('Forge ·')).length;
      return active ? { level: 'pending', label: 'Genereras…' } : count ? { level: 'ready', label: `${count} i biblioteket` } : { level: 'optional', label: 'Valfritt · generera' };
    }
    if (slot.needsEvent) return { level: 'blocked', label: 'Facket saknas i projektet' };
    const usable = media.filter(row => row.available !== false && row.classification?.mediaType !== 'audio' && !row.classification?.archived);
    if (active) return { level: 'pending', label: usable.length ? `${usable.length} klipp · fler genereras` : 'Genereras…' };
    if (usable.length) return { level: 'ready', label: `${usable.length} klipp`, count: usable.length };
    if (slot.required || slot.group === 'deal' || slot.group === 'transition') return { level: slot.required ? 'required' : 'recommended', label: slot.required ? 'Krävs · saknas' : 'Rekommenderas · saknas' };
    return { level: 'optional', label: 'Valfritt · tomt' };
  }

  async function buildRunwayParams(client, slot, plan, profile, projectValue, inventory, dealerId, options) {
    const prompt = options.prompt?.trim() || slotPrompt(slot, profile, { expression: plan.expression, speechText: slot.kind === 'speech' ? speechTextFor(slot.line, SPEECH_LINES, profile.language) : '' });
    if (prompt.length > (plan.model === 'gen4_turbo' ? 1000 : 4000)) fail('Prompten är för lång.', 422, 'forge_prompt_too_long');
    const seed = Number.isSafeInteger(options.seed) && options.seed >= 0 && options.seed <= 4294967295 ? options.seed : Math.floor(Math.random() * 4294967295);
    const need = anchorsFor(slot, plan);
    for (const pose of need) if (!profile.anchors[pose]) fail(pose === 'vila' ? 'Ladda upp VILA-bilden först.' : 'Skapa REDO-posen (handen vid skon) först.', 422, 'forge_anchor_missing');
    const anchorBytes = {};
    for (const pose of need) anchorBytes[pose] = await readPrivate(profile.anchors[pose]);
    const uri = async (bytes, type, name) => client.asset(bytes, type, name);
    const summary = { prompt, seed, model: plan.model, mode: plan.mode, quality: plan.quality, duration: plan.duration, anchors: Object.fromEntries(need.map(pose => [pose, profile.anchors[pose].sha256])), mediaReferences: [] };
    if (plan.endpoint === 'text_to_image') {
      const reference = slot.kind === 'pose' ? { bytes: anchorBytes.vila, tag: 'reference' } : slot.kind === 'table' ? { bytes: await images.tableGuide(profile), tag: 'layout' } : { bytes: await images.backgroundGuide(), tag: 'layout' };
      return { params: { model: plan.model, promptText: prompt, ratio: plan.ratio, referenceImages: [{ uri: await uri(reference.bytes, 'image/png', `${reference.tag}.png`), tag: reference.tag }], seed }, summary };
    }
    if (plan.endpoint === 'avatar_videos') {
      if (!profile.avatar?.id) fail('Avataren är inte skapad ännu.', 409, 'forge_avatar_missing');
      const text = options.speechText?.trim() || speechTextFor(slot.line, SPEECH_LINES, profile.language);
      if (!text) fail('Repliken saknar text.', 422, 'forge_speech_text_missing');
      const audio = options.audioMediaId ? inventory.videos.find(row => row.id === options.audioMediaId && row.classification?.mediaType === 'audio') : null;
      const speech = audio ? { type: 'audio', audio: await uri(...(await readMedia(audio.id, summary.mediaReferences)), 'line') }
        : { type: 'text', text, voice: { type: 'preset', presetId: profile.voice.presetId } };
      if (audio) { summary.audioMediaId = audio.id; summary.audioSha256 = summary.mediaReferences.at(-1).sha256; }
      return { params: { model: 'gwm1_avatars', avatar: { type: 'custom', avatarId: profile.avatar.id }, speech }, summary: { ...summary, speechText: text, speechSource: audio ? 'audio' : 'tts' } };
    }
    const first = slot.start === 'REDO' ? 'redo' : 'vila', last = slot.end === 'REDO' ? 'redo' : 'vila';
    let firstBytes = anchorBytes[first], lastBytes = anchorBytes[last] ?? anchorBytes[first];
    if (slot.group === 'deal' && !plan.model.startsWith('gen4')) {
      const point = profile.positions[slot.target];
      if (slot.reveal) { firstBytes = await images.markCardTarget(firstBytes, point, { faceDown: true }); lastBytes = await images.markCardTarget(anchorBytes[last] ?? anchorBytes[first], point, { faceDown: false }); }
      else lastBytes = await images.markCardTarget(lastBytes, point, { faceDown: Boolean(slot.faceDown) });
    }
    if (plan.model === 'gen4_turbo') {
      return { params: { model: 'gen4_turbo', promptImage: await uri(firstBytes, 'image/png', 'first.png'), promptText: prompt, ratio: plan.ratio, duration: plan.duration, seed }, summary };
    }
    const params = { model: 'wan3', promptText: prompt, duration: plan.duration, audio: Boolean(plan.audio) };
    if (plan.mode === 'reference') {
      const reference = slotMedia(projectValue, inventory, dealerId, slot).find(row => row.id === options.referenceMediaId && row.classification?.mediaType !== 'audio');
      if (!reference) fail('Referensklippet finns inte i samma fack.', 422, 'forge_reference_missing');
      const [referenceBytes, referenceType] = await readMedia(reference.id, summary.mediaReferences);
      if (referenceBytes.byteLength > MAX_REFERENCE_VIDEO) fail('Referensklippet är för stort för Runway.', 422, 'forge_reference_too_large');
      params.promptImage = [{ uri: await uri(firstBytes, 'image/png', 'first.png') }];
      params.referenceVideos = [{ type: 'video', uri: await uri(referenceBytes, referenceType, 'reference.mp4') }];
      params.ratio = plan.ratio;
      summary.referenceMediaId = reference.id; summary.referenceSha256 = summary.mediaReferences.at(-1).sha256;
    } else {
      params.promptImage = [{ uri: await uri(firstBytes, 'image/png', 'first.png'), position: 'first' }, { uri: await uri(lastBytes, 'image/png', 'last.png'), position: 'last' }];
      params.ratio = plan.ratio;
      if (slot.kind === 'speech') {
        summary.speechText = options.speechText?.trim() || speechTextFor(slot.line, SPEECH_LINES, profile.language);
        const audio = options.audioMediaId ? inventory.videos.find(row => row.id === options.audioMediaId && row.classification?.mediaType === 'audio') : null;
        if (audio) { params.referenceAudio = [{ type: 'audio', uri: await uri(...(await readMedia(audio.id, summary.mediaReferences)), 'line') }]; summary.audioMediaId = audio.id; summary.audioSha256 = summary.mediaReferences.at(-1).sha256; }
      }
    }
    return { params, summary };
  }

  /** A previous attempt may have registered the output before its journal write failed. Detect that by the
   *  job's deterministic ID and finish from the stored record instead of registering a second copy. */
  async function committedResult(job, slot, credits) {
    if (slot.kind === 'clip' || slot.kind === 'speech') {
      const record = await repository.getMedia(forgeUuid(job.jobId, 'clip'));
      return record ? { mediaId: record.id, sha256: record.sha256, size: record.size, credits, role: record.classification?.role ?? 'standard', label: record.classification?.label ?? '' } : null;
    }
    if (slot.kind === 'table' || slot.kind === 'background') {
      const saved = await repository.readDocument('project');
      const asset = (saved?.value?.layerAssets ?? []).find(row => row.id === forgeUuid(job.jobId, 'layer'));
      return asset ? { assetId: asset.id, sha256: asset.sha256, size: asset.size, width: asset.width, height: asset.height, credits, label: asset.label } : null;
    }
    return null;
  }

  async function commitClip(job, bytes, slot, projectValue, inventory, credits) {
    if (!mediaHeaderMatches('video/mp4', bytes.subarray(0, 32))) fail('Runway levererade inte en MP4-fil.', 415, 'forge_output_not_mp4');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const existing = slotMedia(projectValue, inventory, job.dealerId, slot);
    const label = `Forge · ${slot.label}${existing.length ? ` · variant ${existing.length + 1}` : ''}`.slice(0, 80);
    let classification = mediaClassification(projectValue, { dealerId: job.dealerId, slotId: `${slot.eventId}/${slot.situation}`, label, contentType: 'video/mp4' });
    classification = validateVideoMetadata({ ...classification, role: existing.length ? 'alternative' : 'standard', notes: `Dealer Forge · Runway ${job.request.model} · job ${job.jobId}`.slice(0, 500),
      compositing: { mode: 'green-screen', threshold: 0.23, softness: 0.15, despill: 0 } });
    const id = forgeUuid(job.jobId, 'clip');
    const record = { id, sha256, size: bytes.byteLength, contentType: 'video/mp4', classification, pathname: mediaBlobPath(`dealers/${job.dealerId}/review/uploads`, id, sha256, 'mp4') };
    await putImmutable(record.pathname, bytes, { sha256, size: bytes.byteLength, contentType: 'video/mp4' });
    await mutationTransaction(() => withCommit(job, () => repository.registerMedia(record, { actor: job.actor })), { presentationMutation: { metadata: classification } });
    return { mediaId: id, sha256, size: bytes.byteLength, credits, role: classification.role, label };
  }

  async function commitLayer(job, bytes, slot, profile, credits) {
    const layer = slot.kind === 'table' ? await images.tableLayerFromMagenta(bytes, profile) : await images.backgroundLayer(bytes);
    const id = forgeUuid(job.jobId, 'layer');
    const draft = { schemaVersion: 1, id, role: slot.role, label: `Forge · ${slot.kind === 'table' ? 'bord' : 'bakgrund'} · ${job.dealerId} · ${new Date(job.createdAt ?? now()).toISOString().slice(0, 10)}`.slice(0, 80),
      sha256: layer.sha256, size: layer.size, contentType: layer.contentType, width: layer.width, height: layer.height };
    const record = validateLayerAsset({ ...draft, pathname: layerAssetPath(draft) });
    await putImmutable(record.pathname, layer.bytes, { sha256: record.sha256, size: record.size, contentType: record.contentType });
    const captured = await repository.readDocument('project');
    if (!captured) fail('Projektdokumentet saknas.', 503, 'studio_document_missing');
    const withAsset = value => (value.layerAssets ?? []).some(row => row.id === id) ? null : { ...value, layerAssets: [...(value.layerAssets ?? []), record] };
    if (withAsset(captured.value)) {
      const presentationMutation = { kind: 'project', value: withAsset(captured.value) };
      await mutationTransaction(async () => withCommit(job, async () => {
        const saved = await repository.readDocument('project');
        // Inside the repository transaction only StudioStorageError codes survive sanitization.
        if (!saved || saved.revision !== captured.revision) throw new StudioStorageError('studio_forge_conflict', 409);
        const next = withAsset(saved.value);
        return next ? repository.saveDocument('project', { expectedRevision: saved.revision, value: next, actor: job.actor }) : saved;
      }), { presentationMutation });
    }
    return { assetId: id, sha256: record.sha256, size: record.size, width: record.width, height: record.height, credits, label: record.label };
  }

  async function commitPose(job, bytes, profile, current, credits) {
    const normalized = await images.poseFromGenerated(bytes);
    const anchor = await storeAnchor(job.dealerId, normalized, forgeUuid(job.jobId, 'pose'));
    let adopted = profile.anchors.redo?.pathname === anchor.pathname;
    if (!profile.anchors.redo) {
      await withCommit(job, () => saveProfile(job.dealerId, current, { ...profile, anchors: { ...profile.anchors, redo: anchor } }, job.actor));
      adopted = true;
    }
    return { anchor, adopted, credits };
  }

  const api = Object.freeze({
    async status() { return { migrationReady: await store.ready(), runwayConfigured: runwayConfigured(env), priceChecked: '2026-10-12' }; },

    async listDealers() {
      const { value } = await project();
      const trash = new Set((value.dealerTrash ?? []).map(row => row.dealer.id));
      return value.dealers.filter(row => !trash.has(row.id)).map(row => ({ id: row.id, label: row.label }));
    },

    async createDealer({ dealerId, label }, { actor, stillAuthorized }) {
      actor = validateActor(actor);
      if (!isDealerId(dealerId)) fail('Dealer-id ska vara små bokstäver/siffror med bindestreck, högst 40 tecken.', 422, 'forge_invalid_dealer');
      if (typeof label !== 'string' || !label.trim() || label.length > 120) fail('Ange ett visningsnamn (1–120 tecken).', 422, 'forge_invalid_dealer');
      const { revision, value } = await project();
      let next;
      try { next = addDealer(value, dealerId, label.trim()); } catch (error) { fail(error?.errors?.join(' ') || error.message || 'Dealern kunde inte läggas till.', 422, 'forge_invalid_dealer'); }
      if (typeof validateProjectBindings === 'function') await validateProjectBindings(next);
      const saved = await mutationTransaction(async () => {
        if (typeof stillAuthorized === 'function' && await stillAuthorized() !== true) fail('Behörigheten har ändrats.', 403, 'studio_request_rejected');
        return gamePolicy.projectStore({ actor }).save(next, revision);
      }, { presentationMutation: { kind: 'project', value: next } });
      return { dealer: { id: dealerId, label: label.trim() }, revision: saved?.revision ?? null };
    },

    async state(dealerId) {
      const [{ value, revision }, status] = await Promise.all([project(), api.status()]);
      const dealer = dealerOf(value, dealerId);
      const { profile, revision: profileRevision } = await profileOf(dealerId);
      const inventory = await videoRegistry();
      const jobs = status.migrationReady ? await store.listJobs(dealerId, { limit: 300 }) : [];
      const slots = forgeSlots(value).map(slot => {
        const media = slotMedia(value, inventory, dealerId, slot).map(video => ({ id: video.id, label: video.label ?? video.classification?.label ?? '', role: video.classification?.role ?? video.role ?? 'standard',
          previewUrl: video.previewUrl ?? null, available: video.available !== false, archived: Boolean(video.classification?.archived), mediaType: video.classification?.mediaType ?? 'video', sha256: video.sha256, addedAt: video.addedAt ?? null }));
        const slotJobs = jobs.filter(job => job.slotId === slot.id).map(publicJob);
        return { ...slot, media, jobs: slotJobs, status: slotStatus(slot, media, slotJobs, profile, value) };
      });
      const layers = (value.layerAssets ?? []).filter(asset => asset.label.startsWith('Forge ·')).map(asset => ({ id: asset.id, role: asset.role, label: asset.label, width: asset.width, height: asset.height, contentType: asset.contentType, sha256: asset.sha256 }));
      return { dealer, projectRevision: revision, profile: { ...profile, revision: profileRevision }, groups: FORGE_GROUPS, slots, jobs: jobs.slice(0, 60).map(publicJob), layers, speechLines: SPEECH_LINES, ...status };
    },

    async saveProfile(dealerId, patch, { actor }) {
      actor = validateActor(actor);
      await ensureReady();
      const { value } = await project(); dealerOf(value, dealerId);
      const current = await profileOf(dealerId);
      const allowed = ['subject', 'theme', 'tableStyle', 'positions', 'voice', 'language'];
      if (!patch || typeof patch !== 'object' || Object.keys(patch).some(key => !allowed.includes(key))) fail('Ogiltiga profilfält.', 400, 'forge_invalid_request');
      const saved = await saveProfile(dealerId, current, { ...current.profile, ...patch, voice: patch.voice ? { type: 'runway-live-preset', presetId: patch.voice.presetId } : current.profile.voice }, actor);
      return { profile: { ...saved.profile, revision: saved.revision } };
    },

    /** Upload a still pose (VILA, or a real REDO photo). Body carries base64 bytes. */
    async uploadAnchor(dealerId, { pose, contentType, dataBase64 }, { actor }) {
      actor = validateActor(actor);
      await ensureReady();
      if (!['vila', 'redo'].includes(pose)) fail('Posen ska vara vila eller redo.', 422, 'forge_invalid_pose');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) fail('Bilden ska vara PNG, JPEG eller WebP.', 415, 'forge_invalid_image');
      if (typeof dataBase64 !== 'string' || !dataBase64 || dataBase64.length > MAX_ANCHOR_UPLOAD * 4 / 3) fail('Bilden är tom eller större än 24 MB.', 413, 'forge_invalid_image');
      let bytes; try { bytes = Buffer.from(dataBase64, 'base64'); } catch { fail('Bilden kunde inte avkodas.', 422, 'forge_invalid_image'); }
      if (!bytes.byteLength || bytes.byteLength > MAX_ANCHOR_UPLOAD) fail('Bilden är tom eller större än 24 MB.', 413, 'forge_invalid_image');
      const { value } = await project(); dealerOf(value, dealerId);
      const current = await profileOf(dealerId);
      const normalized = await images.normalizeAnchor(bytes);
      const anchor = await storeAnchor(dealerId, normalized);
      const saved = await saveProfile(dealerId, current, { ...current.profile, anchors: { ...current.profile.anchors, [pose]: anchor } }, actor);
      return { anchor, profile: { ...saved.profile, revision: saved.revision } };
    },

    /** Stream an anchor image for the matrix. Caller already authenticated. */
    async anchorResponse(dealerId, pose, request) {
      const { profile } = await profileOf(dealerId);
      const anchor = profile.anchors[pose];
      if (!anchor) return Response.json({ error: 'forge_anchor_missing' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
      return privateMedia.get(validatePrivateMedia({ provider: 'vercel-blob', pathname: anchor.pathname, sha256: anchor.sha256, size: anchor.size, contentType: anchor.contentType }), request, mediaOptions);
    },

    async adoptPose(dealerId, { jobId }, { actor }) {
      actor = validateActor(actor); await ensureReady();
      const job = await store.getJob(jobId);
      if (!job || job.dealerId !== dealerId || job.kind !== 'pose' || job.status !== 'succeeded' || !job.result?.anchor) fail('Jobbet har ingen färdig pose.', 404, 'forge_job_unknown');
      const current = await profileOf(dealerId);
      const saved = await saveProfile(dealerId, current, { ...current.profile, anchors: { ...current.profile.anchors, redo: job.result.anchor } }, actor);
      return { profile: { ...saved.profile, revision: saved.revision } };
    },

    estimate(projectValue, slotId, options = {}) {
      const slot = slotById(projectValue, slotId);
      const plan = slotPlan(slot, options);
      return { slot: { id: slot.id, label: slot.label, kind: slot.kind, group: slot.group }, plan, anchors: anchorsFor(slot, plan) };
    },

    async preview(dealerId, { slotId, quality, duration, mode, expression, hasReference, speechSeconds }) {
      const { value } = await project(); dealerOf(value, dealerId);
      const { profile } = await profileOf(dealerId);
      const slot = slotById(value, slotId);
      const plan = slotPlan(slot, { quality, duration, mode, expression, hasReference, speechSeconds });
      const prompt = slotPrompt(slot, profile, { expression: plan.expression, speechText: slot.kind === 'speech' ? speechTextFor(slot.line, SPEECH_LINES, profile.language) : '' });
      return { slot: { id: slot.id, label: slot.label, kind: slot.kind, group: slot.group, needsEvent: Boolean(slot.needsEvent) }, plan, prompt, anchors: anchorsFor(slot, plan), anchorsPresent: Object.keys(profile.anchors) };
    },

    /** Submit one paid generation, idempotent on body.requestId (the job ID). A repeated request returns the
     *  journaled job and never pays again; only a `prepared` row (no POST started) is resumed. */
    async createJob(dealerId, body, { actor }) {
      actor = validateActor(actor);
      if (!body || typeof body !== 'object' || typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId)) fail('requestId (UUID) krävs så att ett nytt försök aldrig betalar två gånger.', 422, 'forge_request_id_required');
      await ensureReady();
      const jobId = body.requestId, fingerprint = requestFingerprint(dealerId, body);
      const sameRequest = job => {
        if (job.dealerId !== dealerId || job.slotId !== body.slotId || job.request?.fingerprint !== fingerprint) fail('requestId används redan för ett annat jobb.', 409, 'forge_request_reused');
        return job;
      };
      const prior = await store.getJob(jobId);
      if (prior && sameRequest(prior).status !== 'prepared') return publicJob(prior);
      if (!runwayConfigured(env)) fail('RUNWAY_API_KEY saknas i miljön.', 503, 'runway_key_missing');
      const { value } = await project(); dealerOf(value, dealerId);
      const slot = slotById(value, body.slotId);
      if (slot.needsEvent) fail('Facket finns inte i det sparade projektet (eventet transition.shoe saknas).', 409, 'forge_slot_needs_event');
      if (slot.kind === 'pose' && slot.pose === 'vila') fail('VILA laddas upp som bild.', 422, 'forge_slot_upload_only');
      const inventory = await videoRegistry();
      const existing = slotMedia(value, inventory, dealerId, slot);
      const plan = slotPlan(slot, { quality: body.quality, duration: body.duration, mode: body.mode, expression: body.expression, hasReference: Boolean(body.referenceMediaId) && existing.some(row => row.id === body.referenceMediaId), speechSeconds: body.speechSeconds });
      const maxCredits = Number.isSafeInteger(body.maxCredits) ? body.maxCredits : 200;
      if (plan.credits > maxCredits) fail(`Beräknat ${plan.credits} krediter överstiger gränsen ${maxCredits}.`, 422, 'forge_budget_exceeded');
      const current = await profileOf(dealerId); let profile = current.profile;
      const client = runway();
      if (plan.endpoint === 'avatar_videos' && !profile.avatar?.id) {
        if (!profile.anchors.vila) fail('Ladda upp VILA-bilden först.', 422, 'forge_anchor_missing');
        const avatar = await client.createAvatar({ name: `${dealerId}`.slice(0, 60), personality: `Professional, warm blackjack dealer named ${dealerId}. Speaks clearly and briefly.`,
          referenceImage: await client.asset(await readPrivate(profile.anchors.vila), 'image/png', 'vila.png'), voice: { type: 'runway-live-preset', presetId: profile.voice.presetId }, imageProcessing: 'optimize' });
        const saved = await saveProfile(dealerId, current, { ...profile, avatar: { id: avatar.id, status: avatar.status ?? 'PROCESSING', presetId: profile.voice.presetId } }, actor);
        profile = saved.profile; current.revision = saved.revision;
      }
      if (plan.endpoint === 'avatar_videos' && profile.avatar.status !== 'READY') {
        const fresh = await client.avatar(profile.avatar.id);
        if (fresh?.status === 'FAILED') fail(`Runway kunde inte skapa avataren: ${fresh.failureReason ?? 'okänt fel'}`, 422, 'forge_avatar_failed');
        if (fresh?.status === 'READY') { const saved = await saveProfile(dealerId, current, { ...profile, avatar: { ...profile.avatar, status: 'READY' } }, actor); profile = saved.profile; }
        else {
          const request = { plan, prompt: '', slotLabel: slot.label, awaitingAvatar: true, fingerprint, options: { speechText: body.speechText ?? '', audioMediaId: body.audioMediaId ?? null, maxCredits } };
          const queued = await store.insertJob({ jobId, dealerId, slotId: slot.id, kind: slot.kind, status: 'queued', request, actor });
          return publicJob(queued.created ? queued.job : sameRequest(queued.job));
        }
      }
      // Whoever pays sends the journaled seed and prompt, so the stored request describes the generated output.
      const journaled = recorded => ({ ...body, seed: recorded.seed ?? body.seed, ...(typeof recorded.prompt === 'string' && recorded.prompt ? { prompt: recorded.prompt } : {}) });
      let built = await buildRunwayParams(client, slot, plan, profile, value, inventory, dealerId, prior ? journaled(prior.request) : body);
      if (!prior) {
        // Journal first, pay second: the row exists (prepared) before any Runway POST can start.
        const request = { plan, ...built.summary, slotLabel: slot.label, fingerprint, options: { maxCredits, referenceMediaId: built.summary.referenceMediaId ?? null, audioMediaId: built.summary.audioMediaId ?? null } };
        const inserted = await store.insertJob({ jobId, dealerId, slotId: slot.id, kind: slot.kind, status: 'prepared', request, actor });
        if (!inserted.created) {
          if (sameRequest(inserted.job).status !== 'prepared') return publicJob(inserted.job);
          // A concurrent request with the same key inserted first: its row, not our own random draw, is what gets paid.
          built = await buildRunwayParams(client, slot, plan, profile, value, inventory, dealerId, journaled(inserted.job.request));
        }
      }
      // Lease: exactly one request moves prepared → submitting and pays; a concurrent duplicate gets the row back.
      try { await store.updateJob(jobId, { expectedStatus: 'prepared', status: 'submitting' }); }
      catch (cause) {
        const current = cause?.statusCode === 409 ? await store.getJob(jobId) : null;
        if (current && current.status !== 'prepared') return publicJob(current);
        throw cause;
      }
      return publicJob(await submitLeased(jobId, plan.endpoint, built.params, client));
    },

    /** Advance one job: read the Runway task; on success download, verify and commit into the exact slot. */
    async pollJob(dealerId, jobId, { actor }) {
      actor = validateActor(actor);
      await ensureReady();
      let job = await store.getJob(jobId);
      if (!job || job.dealerId !== dealerId) fail('Jobbet finns inte.', 404, 'forge_job_unknown');
      if (!ACTIVE_STATUSES.includes(job.status) || job.status === 'submit_unknown') return publicJob(job);
      if (job.status === 'prepared') {
        // The POST only starts after the prepared → submitting lease, so an expired prepared row never reached Runway.
        if (now() - job.updatedAt < SUBMIT_LEASE_MS) return publicJob(job);
        return publicJob(await store.updateJob(jobId, { expectedStatus: 'prepared', status: 'failed', error: 'Startades aldrig; inget skickades till Runway och inget debiterades.' }));
      }
      const { value } = await project();
      const slot = slotById(value, job.slotId);
      const client = runway();
      if (job.status === 'submitting') {
        // A submitter that died mid-POST: we cannot know whether Runway received it. Never resubmit;
        // after the lease expires the operator resolves it against the Runway portal (task-ID or cancel).
        if (now() - job.updatedAt < SUBMIT_LEASE_MS) return publicJob(job);
        return publicJob(await store.updateJob(jobId, { expectedStatus: 'submitting', status: 'submit_unknown', error: 'Inskicket avbröts utan svar från Runway. Kontrollera portalen: koppla task-ID eller avbryt.' }));
      }
      if (job.status === 'queued' && job.request?.awaitingAvatar) {
        const current = await profileOf(dealerId); let profile = current.profile;
        const fresh = profile.avatar?.id ? await client.avatar(profile.avatar.id) : null;
        if (!fresh || fresh.status === 'FAILED') return publicJob(await store.updateJob(jobId, { expectedStatus: 'queued', status: 'failed', error: `Runway kunde inte skapa avataren: ${fresh?.failureReason ?? 'avatar saknas'}`.slice(0, 2000) }));
        if (fresh.status !== 'READY') return publicJob(job);
        // Take the lease before any paid call: a concurrent poller fails this CAS and cannot submit twice.
        job = await store.updateJob(jobId, { expectedStatus: 'queued', status: 'submitting' });
        let built;
        try {
          if (profile.avatar.status !== 'READY') profile = (await saveProfile(dealerId, current, { ...profile, avatar: { ...profile.avatar, status: 'READY' } }, actor)).profile;
          const inventory = await videoRegistry();
          built = await buildRunwayParams(client, slot, job.request.plan, profile, value, inventory, dealerId, job.request.options ?? {});
        } catch (cause) {
          // Nothing was paid yet; hand the lease back so the next poll retries the preparation.
          await store.updateJob(jobId, { expectedStatus: 'submitting', status: 'queued', error: String(cause?.message ?? 'Förberedelsen misslyckades.').slice(0, 2000) }).catch(() => {});
          throw cause;
        }
        return publicJob(await submitLeased(jobId, 'avatar_videos', built.params, client, { ...built.summary, awaitingAvatar: false }));
      }
      if (job.status === 'committing') {
        // A commit lease older than the function budget belongs to a dead worker. The paid output URL is
        // still in result, so reclaim and register it instead of leaving the job stuck.
        if (now() - job.updatedAt < COMMIT_LEASE_MS) return publicJob(job);
        job = await withCommit(job, () => store.updateJob(jobId, { expectedStatus: 'committing', status: 'generated', error: 'Registreringen avbröts; försöker igen.' }));
      }
      if (job.status !== 'generated') {
        if (!job.taskId) return publicJob(job);
        const task = await client.task(job.taskId);
        if (['PENDING', 'THROTTLED'].includes(task.status)) return publicJob(job.status === 'queued' ? job : await store.updateJob(jobId, { expectedStatus: job.status, status: 'queued' }));
        if (task.status === 'RUNNING') return publicJob(await store.updateJob(jobId, { expectedStatus: job.status, status: 'running', result: { progress: task.progress } }));
        if (task.status === 'FAILED') return publicJob(await store.updateJob(jobId, { expectedStatus: job.status, status: 'failed', error: `${task.failureCode ? `${task.failureCode}: ` : ''}${task.failure}`.slice(0, 2000), result: { credits: task.credits } }));
        if (task.status === 'CANCELLED') return publicJob(await store.updateJob(jobId, { expectedStatus: job.status, status: 'cancelled', result: { credits: task.credits } }));
        if (task.status !== 'SUCCEEDED' || !task.output.length) return publicJob(job);
        job = await store.updateJob(jobId, { expectedStatus: job.status, status: 'generated', result: { output: task.output, credits: task.credits, progress: 1 } });
      }
      // Exactly one poller commits: CAS generated → committing.
      job = await store.updateJob(jobId, { expectedStatus: 'generated', status: 'committing' });
      if (!job.result?.output?.[0]) return publicJob(await store.updateJob(jobId, { expectedStatus: 'committing', status: 'failed', error: 'Resultatadress saknas; jobbet kan inte registreras.' }));
      try {
        let result = await committedResult(job, slot, job.result.credits);
        if (!result) {
          const bytes = await client.download(job.result.output[0], { maxBytes: MAX_OUTPUT_BYTES });
          const inventory = await videoRegistry();
          const current = await profileOf(dealerId);
          result = slot.kind === 'clip' || slot.kind === 'speech' ? await commitClip(job, bytes, slot, value, inventory, job.result.credits)
            : slot.kind === 'pose' ? await commitPose(job, bytes, current.profile, current, job.result.credits)
              : await commitLayer(job, bytes, slot, current.profile, job.result.credits);
        }
        return publicJob(await withCommit(job, () => store.updateJob(jobId, { expectedStatus: 'committing', status: 'succeeded', error: null, result: { ...job.result, ...result, output: undefined, committedAt: new Date(now()).toISOString() } })));
      } catch (cause) {
        // Keep the task output reference so the next poll retries the commit instead of paying again. If this
        // write fails too, the commit lease expires and the next poll reclaims the job.
        const message = (cause instanceof ForgeError || cause instanceof RunwayError || cause?.statusCode) ? cause.message : 'Efterarbetet misslyckades; nästa pollning försöker igen.';
        await withCommit(job, () => store.updateJob(jobId, { expectedStatus: 'committing', status: 'generated', error: String(message).slice(0, 2000) })).catch(() => {});
        throw cause;
      }
    },

    async cancelJob(dealerId, jobId, { actor }) {
      actor = validateActor(actor); await ensureReady();
      const job = await store.getJob(jobId);
      if (!job || job.dealerId !== dealerId) fail('Jobbet finns inte.', 404, 'forge_job_unknown');
      if (!ACTIVE_STATUSES.includes(job.status)) return publicJob(job);
      // A live submit/commit lease must finish (or expire) first; cancelling it would hide a paid task.
      if (['submitting', 'committing'].includes(job.status)) fail('Jobbet skickas eller registreras just nu; vänta på svar innan du avbryter.', 409, 'forge_job_busy');
      if (job.taskId && ['queued', 'running'].includes(job.status)) { try { await runway().cancelTask(job.taskId); } catch { /* Local cancel still records intent; Runway may have finished. */ } }
      return publicJob(await store.updateJob(jobId, { expectedStatus: job.status, status: 'cancelled', error: 'Avbrutet av operatör.' }));
    },

    async resolveUnknown(dealerId, jobId, { taskId }, { actor }) {
      actor = validateActor(actor); await ensureReady();
      const job = await store.getJob(jobId);
      if (!job || job.dealerId !== dealerId || job.status !== 'submit_unknown') fail('Jobbet väntar inte på ett task-ID.', 409, 'forge_job_unknown');
      if (typeof taskId !== 'string' || !TASK_ID.test(taskId)) fail('Ogiltigt task-ID.', 422, 'forge_invalid_request');
      return publicJob(await store.updateJob(jobId, { expectedStatus: 'submit_unknown', status: 'running', taskId, error: null }));
    },
  });
  return api;
}
