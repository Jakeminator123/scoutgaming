// Dealer Forge: from one still image to a reviewed dealer clip bank.
// Runway does the generation; this service owns anchors (poses), the job
// journal (migration 008), and the hand-off of finished bytes into the
// existing private-Blob + media_records / project.layerAssets contracts.
// Nothing here publishes: every committed clip lands as a review upload in
// its exact slot and follows the ordinary Dealers & klipp acceptance flow.
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StudioStorageError, validateActor } from '../../web/storage/studio-contract.mjs';
import { validateLayerAsset, layerAssetPath } from '../../web/layer-asset-contract.mjs';
import { SPEECH_LINES } from '../../web/public/speech-lines.mjs';
import { isDealerId } from '../../web/dealer-identity.mjs';
import { getPrivateMedia, mediaBlobPath, putPrivateMedia, validatePrivateMedia } from './cloud-media-store.mjs';
import { mediaHeaderMatches } from './media-file-types.mjs';
import { dealerLibraryVideos, mediaClassification, mediaMatchesSlot } from './dealer-media-library.mjs';
import { addDealer, normalizeProject } from './studio-model.mjs';
import { validateVideoMetadata } from './video-intake.mjs';
import { anchorsFor, forgeSlots, slotById, slotPlan, slotPrompt, validateProfile, FORGE_GROUPS, speechTextFor } from './dealer-forge-catalog.mjs';
import { backgroundGuide, backgroundLayer, markCardTarget, normalizeAnchor, poseFromGenerated, tableGuide, tableLayerFromMagenta } from './dealer-forge-images.mjs';
import { createDealerForgeStore, ACTIVE_STATUSES } from './dealer-forge-store.mjs';
import { createRunwayClient, runwayConfigured, RunwayError } from './runway-client.mjs';

export class ForgeError extends Error {
  constructor(message, { status = 422, code = 'forge_invalid_request' } = {}) { super(message); this.name = 'ForgeError'; this.statusCode = status; this.code = code; }
}
const fail = (message, status = 422, code = 'forge_invalid_request') => { throw new ForgeError(message, { status, code }); };
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
const MAX_ANCHOR_UPLOAD = 24 * 1024 * 1024;
const MAX_REFERENCE_VIDEO = 60 * 1024 * 1024;

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
  async function readPrivate(record) {
    const storage = validatePrivateMedia({ provider: 'vercel-blob', pathname: record.pathname, sha256: record.sha256, size: record.size, contentType: record.contentType });
    const response = await privateMedia.get(storage, new Request('https://dealer-forge.internal/read', { method: 'GET' }), mediaOptions);
    if (!response.ok) { await response.body?.cancel?.(); fail('Ankaret kunde inte läsas från privat lagring.', 503, 'forge_anchor_unreadable'); }
    return Buffer.from(await response.arrayBuffer());
  }
  async function readMedia(id) {
    const record = await repository.getMedia(id);
    if (!record || record.deletion) fail('Mediafilen finns inte längre.', 404, 'forge_reference_missing');
    return [await readPrivate(record), record.contentType];
  }
  async function storeAnchor(dealerId, normalized) {
    const id = randomUUID();
    const pathname = mediaBlobPath(`dealers/${dealerId}/source/anchors`, id, normalized.sha256, 'png');
    await privateMedia.put(pathname, normalized.bytes, { sha256: normalized.sha256, size: normalized.size, contentType: 'image/png', env: mediaOptions.env, cacheDir: mediaOptions.cacheDir });
    return { pathname, sha256: normalized.sha256, size: normalized.size, contentType: 'image/png', width: normalized.width, height: normalized.height };
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
    if (slot.needsEvent) return { level: 'blocked', label: 'Facket saknas i projektet (väntar på PR)' };
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
    const summary = { prompt, seed, model: plan.model, mode: plan.mode, quality: plan.quality, duration: plan.duration, anchors: Object.fromEntries(need.map(pose => [pose, profile.anchors[pose].sha256])) };
    if (plan.endpoint === 'text_to_image') {
      const reference = slot.kind === 'pose' ? { bytes: anchorBytes.vila, tag: 'reference' } : slot.kind === 'table' ? { bytes: await images.tableGuide(profile), tag: 'layout' } : { bytes: await images.backgroundGuide(), tag: 'layout' };
      return { params: { model: plan.model, promptText: prompt, ratio: plan.ratio, referenceImages: [{ uri: await uri(reference.bytes, 'image/png', `${reference.tag}.png`), tag: reference.tag }], seed }, summary };
    }
    if (plan.endpoint === 'avatar_videos') {
      if (!profile.avatar?.id) fail('Avataren är inte skapad ännu.', 409, 'forge_avatar_missing');
      const text = options.speechText?.trim() || speechTextFor(slot.line, SPEECH_LINES, profile.language);
      if (!text) fail('Repliken saknar text.', 422, 'forge_speech_text_missing');
      const audio = options.audioMediaId ? inventory.videos.find(row => row.id === options.audioMediaId && row.classification?.mediaType === 'audio') : null;
      const speech = audio ? { type: 'audio', audio: await uri(...(await readMedia(audio.id)), 'line') }
        : { type: 'text', text, voice: { type: 'preset', presetId: profile.voice.presetId } };
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
      const [referenceBytes, referenceType] = await readMedia(reference.id);
      if (referenceBytes.byteLength > MAX_REFERENCE_VIDEO) fail('Referensklippet är för stort för Runway.', 422, 'forge_reference_too_large');
      params.promptImage = [{ uri: await uri(firstBytes, 'image/png', 'first.png') }];
      params.referenceVideos = [{ type: 'video', uri: await uri(referenceBytes, referenceType, 'reference.mp4') }];
      params.ratio = plan.ratio;
      summary.referenceMediaId = reference.id; summary.referenceSha256 = reference.sha256;
    } else {
      params.promptImage = [{ uri: await uri(firstBytes, 'image/png', 'first.png'), position: 'first' }, { uri: await uri(lastBytes, 'image/png', 'last.png'), position: 'last' }];
      params.ratio = plan.ratio;
      if (slot.kind === 'speech') {
        summary.speechText = options.speechText?.trim() || speechTextFor(slot.line, SPEECH_LINES, profile.language);
        const audio = options.audioMediaId ? inventory.videos.find(row => row.id === options.audioMediaId && row.classification?.mediaType === 'audio') : null;
        if (audio) { params.referenceAudio = [{ type: 'audio', uri: await uri(...(await readMedia(audio.id)), 'line') }]; summary.audioMediaId = audio.id; }
      }
    }
    return { params, summary };
  }

  async function commitClip(job, bytes, slot, projectValue, inventory, credits) {
    if (!mediaHeaderMatches('video/mp4', bytes.subarray(0, 32))) fail('Runway levererade inte en MP4-fil.', 415, 'forge_output_not_mp4');
    const { createHash } = await import('node:crypto');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const existing = slotMedia(projectValue, inventory, job.dealerId, slot);
    const label = `Forge · ${slot.label}${existing.length ? ` · variant ${existing.length + 1}` : ''}`.slice(0, 80);
    let classification = mediaClassification(projectValue, { dealerId: job.dealerId, slotId: `${slot.eventId}/${slot.situation}`, label, contentType: 'video/mp4' });
    classification = validateVideoMetadata({ ...classification, role: existing.length ? 'alternative' : 'standard', notes: `Dealer Forge · Runway ${job.request.model} · job ${job.jobId}`.slice(0, 500),
      compositing: { mode: 'green-screen', threshold: 0.23, softness: 0.15, despill: 0 } });
    const id = randomUUID();
    const record = { id, sha256, size: bytes.byteLength, contentType: 'video/mp4', classification, pathname: mediaBlobPath(`dealers/${job.dealerId}/review/uploads`, id, sha256, 'mp4') };
    await privateMedia.put(record.pathname, bytes, { sha256, size: bytes.byteLength, contentType: 'video/mp4', env: mediaOptions.env, cacheDir: mediaOptions.cacheDir });
    await mutationTransaction(async () => repository.registerMedia(record, { actor: job.actor }), { presentationMutation: { metadata: classification } });
    return { mediaId: id, sha256, size: bytes.byteLength, credits, role: classification.role, label };
  }

  async function commitLayer(job, bytes, slot, profile, credits) {
    const layer = slot.kind === 'table' ? await images.tableLayerFromMagenta(bytes, profile) : await images.backgroundLayer(bytes);
    const id = randomUUID();
    const draft = { schemaVersion: 1, id, role: slot.role, label: `Forge · ${slot.kind === 'table' ? 'bord' : 'bakgrund'} · ${job.dealerId} · ${new Date(now()).toISOString().slice(0, 10)}`.slice(0, 80),
      sha256: layer.sha256, size: layer.size, contentType: layer.contentType, width: layer.width, height: layer.height };
    const record = validateLayerAsset({ ...draft, pathname: layerAssetPath(draft) });
    await privateMedia.put(record.pathname, layer.bytes, { sha256: record.sha256, size: record.size, contentType: record.contentType, env: mediaOptions.env, cacheDir: mediaOptions.cacheDir });
    const captured = await repository.readDocument('project');
    if (!captured) fail('Projektdokumentet saknas.', 503, 'studio_document_missing');
    const presentationMutation = { kind: 'project', value: { ...captured.value, layerAssets: [...(captured.value.layerAssets ?? []), record] } };
    await mutationTransaction(async () => repository.transaction(async () => {
      const saved = await repository.readDocument('project');
      // Inside the repository transaction only StudioStorageError codes survive sanitization.
      if (!saved || saved.revision !== captured.revision) throw new StudioStorageError('studio_forge_conflict', 409);
      return repository.saveDocument('project', { expectedRevision: saved.revision, value: { ...saved.value, layerAssets: [...(saved.value.layerAssets ?? []), record] }, actor: job.actor });
    }, { presentationMutation }), { presentationMutation });
    return { assetId: id, sha256: record.sha256, size: record.size, width: record.width, height: record.height, credits, label: record.label };
  }

  async function commitPose(job, bytes, profile, current, credits) {
    const normalized = await images.poseFromGenerated(bytes);
    const anchor = await storeAnchor(job.dealerId, normalized);
    let adopted = false;
    if (!profile.anchors.redo) {
      await saveProfile(job.dealerId, current, { ...profile, anchors: { ...profile.anchors, redo: anchor } }, job.actor);
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

    /** Submit one paid generation. Never retries a POST; an ambiguous timeout is journaled as submit_unknown. */
    async createJob(dealerId, body, { actor }) {
      actor = validateActor(actor);
      await ensureReady();
      if (!runwayConfigured(env)) fail('RUNWAY_API_KEY saknas i miljön.', 503, 'runway_key_missing');
      const { value } = await project(); dealerOf(value, dealerId);
      const slot = slotById(value, body.slotId);
      if (slot.needsEvent) fail('Facket finns inte i det sparade projektet ännu (väntar på eventet transition.shoe). Generera när PR:en är inne.', 409, 'forge_slot_needs_event');
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
          const request = { plan, prompt: '', slotLabel: slot.label, awaitingAvatar: true, options: { speechText: body.speechText ?? '', audioMediaId: body.audioMediaId ?? null, maxCredits } };
          return publicJob(await store.insertJob({ dealerId, slotId: slot.id, kind: slot.kind, status: 'queued', request, actor }));
        }
      }
      const { params, summary } = await buildRunwayParams(client, slot, plan, profile, value, inventory, dealerId, body);
      const request = { plan, ...summary, slotLabel: slot.label, options: { maxCredits, referenceMediaId: body.referenceMediaId ?? null, audioMediaId: body.audioMediaId ?? null } };
      let taskId = null, status = 'running', error = null;
      try {
        taskId = plan.endpoint === 'text_to_image' ? await client.textToImage(params) : plan.endpoint === 'avatar_videos' ? await client.avatarVideo(params) : await client.imageToVideo(params);
      } catch (cause) {
        if (cause instanceof RunwayError && cause.submitUnknown) { status = 'submit_unknown'; error = cause.message; }
        else throw cause;
      }
      return publicJob(await store.insertJob({ dealerId, slotId: slot.id, kind: slot.kind, status, taskId, request, error, actor }));
    },

    /** Advance one job: read the Runway task; on success download, verify and commit into the exact slot. */
    async pollJob(dealerId, jobId, { actor }) {
      actor = validateActor(actor);
      await ensureReady();
      let job = await store.getJob(jobId);
      if (!job || job.dealerId !== dealerId) fail('Jobbet finns inte.', 404, 'forge_job_unknown');
      if (!ACTIVE_STATUSES.includes(job.status) || job.status === 'submit_unknown') return publicJob(job);
      const { value } = await project();
      const slot = slotById(value, job.slotId);
      const client = runway();
      if (job.status === 'queued' && job.request?.awaitingAvatar) {
        const current = await profileOf(dealerId); const profile = current.profile;
        const fresh = profile.avatar?.id ? await client.avatar(profile.avatar.id) : null;
        if (!fresh || fresh.status === 'FAILED') return publicJob(await store.updateJob(jobId, { expectedStatus: 'queued', status: 'failed', error: `Runway kunde inte skapa avataren: ${fresh?.failureReason ?? 'avatar saknas'}`.slice(0, 2000) }));
        if (fresh.status !== 'READY') return publicJob(job);
        const saved = await saveProfile(dealerId, current, { ...profile, avatar: { ...profile.avatar, status: 'READY' } }, actor);
        const inventory = await videoRegistry();
        const { params, summary } = await buildRunwayParams(client, slot, job.request.plan, saved.profile, value, inventory, dealerId, job.request.options ?? {});
        let taskId = null, status = 'running', error = null;
        try { taskId = await client.avatarVideo(params); } catch (cause) { if (cause instanceof RunwayError && cause.submitUnknown) { status = 'submit_unknown'; error = cause.message; } else throw cause; }
        return publicJob(await store.updateJob(jobId, { expectedStatus: 'queued', status, taskId, error, result: { ...summary, awaitingAvatar: false } }));
      }
      if (job.status === 'committing') return publicJob(job);
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
      try {
        const bytes = await client.download(job.result.output[0], { maxBytes: MAX_OUTPUT_BYTES });
        const inventory = await videoRegistry();
        const current = await profileOf(dealerId);
        const result = slot.kind === 'clip' || slot.kind === 'speech' ? await commitClip(job, bytes, slot, value, inventory, job.result.credits)
          : slot.kind === 'pose' ? await commitPose(job, bytes, current.profile, current, job.result.credits)
            : await commitLayer(job, bytes, slot, current.profile, job.result.credits);
        return publicJob(await store.updateJob(jobId, { expectedStatus: 'committing', status: 'succeeded', error: null, result: { ...job.result, ...result, output: undefined, committedAt: new Date(now()).toISOString() } }));
      } catch (cause) {
        // Keep the task output reference so the next poll retries the commit instead of paying again.
        const message = (cause instanceof ForgeError || cause instanceof RunwayError || cause?.statusCode) ? cause.message : 'Efterarbetet misslyckades; nästa pollning försöker igen.';
        await store.updateJob(jobId, { expectedStatus: 'committing', status: 'generated', error: String(message).slice(0, 2000) });
        throw cause;
      }
    },

    async cancelJob(dealerId, jobId, { actor }) {
      actor = validateActor(actor); await ensureReady();
      const job = await store.getJob(jobId);
      if (!job || job.dealerId !== dealerId) fail('Jobbet finns inte.', 404, 'forge_job_unknown');
      if (!ACTIVE_STATUSES.includes(job.status)) return publicJob(job);
      if (job.taskId && ['queued', 'running'].includes(job.status)) { try { await runway().cancelTask(job.taskId); } catch { /* Local cancel still records intent; Runway may have finished. */ } }
      return publicJob(await store.updateJob(jobId, { expectedStatus: job.status, status: 'cancelled', error: 'Avbrutet av operatör.' }));
    },

    async resolveUnknown(dealerId, jobId, { taskId }, { actor }) {
      actor = validateActor(actor); await ensureReady();
      const job = await store.getJob(jobId);
      if (!job || job.dealerId !== dealerId || job.status !== 'submit_unknown') fail('Jobbet väntar inte på ett task-ID.', 409, 'forge_job_unknown');
      if (typeof taskId !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(taskId)) fail('Ogiltigt task-ID.', 422, 'forge_invalid_request');
      return publicJob(await store.updateJob(jobId, { expectedStatus: 'submit_unknown', status: 'running', taskId, error: null }));
    },
  });
  return api;
}
