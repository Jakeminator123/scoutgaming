import { createHash } from 'node:crypto';
import { StudioError } from '../../shared/studio-error.mjs';

export const IDLE_ADVICE_LIMITS = Object.freeze({ ttlMs: 30000, capacity: 256, ledgerMs: 60000,
  channelIntervalMs: 10000, channelPerMinute: 6, concurrency: 2 });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) => record(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const id = (value, max = 100) => typeof value === 'string' && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const timestamp = value => typeof value === 'string' && value.length <= 35
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const canonical = value => JSON.stringify(value, (_key, item) => record(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const fail = (code, status = 400) => { throw new StudioError(code, status); };

// Apps bind their own settings and registry; each request may override its snapshot.
export function createIdleAdviceService({ director, projectModel, settings, settingsProvider, videoRegistry, registryLoader, fetchImpl = fetch, now = Date.now }) {
  const { normalizeInput, prepareDecision, finalizeDecision, SOURCE_TYPES, askDirector, remoteRequest } = director;
  const { buildRuntimeCatalog, validateProject, registeredIdlePolicy, isDealerId } = projectModel;
  function validateBody(body, now) {
    if (!exact(body, ['requestId', 'project', 'dealerId', 'mode', 'sourceRef', 'observedChat'])
      || !id(body.requestId) || !isDealerId(body.dealerId)
      || !['active', 'shadow'].includes(body.mode)) fail('idle_advice_invalid_request');
    const source = body.sourceRef;
    if (!exact(source, ['kind', 'channel', 'revision', 'messageId', 'at']) || source.kind !== 'renderer-idle'
      || !id(source.channel, 200) || !id(source.messageId, 200)
      || !Number.isSafeInteger(source.revision) || source.revision < 0 || !timestamp(source.at)) fail('idle_advice_invalid_source');
    const at = Date.parse(source.at);
    if (at > now || at + IDLE_ADVICE_LIMITS.ttlMs <= now) fail('idle_advice_expired_source', 409);
    const chat = body.observedChat;
    if (!exact(chat, ['source', 'before', 'messages']) || chat.source !== 'native-observation' || chat.before !== source.at
      || !Array.isArray(chat.messages) || !chat.messages.length || chat.messages.length > 8) fail('idle_advice_invalid_observation');
    let previousAt = -Infinity, latestUser = null;
    for (const message of chat.messages) {
      if (!exact(message, ['role', 'text', 'at']) || !['user', 'assistant'].includes(message.role)
        || typeof message.text !== 'string' || !message.text.trim() || message.text.length > 600
        || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(message.text) || !timestamp(message.at)
        || Date.parse(message.at) < previousAt || Date.parse(message.at) > at) fail('idle_advice_invalid_observation');
      previousAt = Date.parse(message.at);
      if (message.role === 'user') latestUser = message;
    }
    if (!latestUser || Date.parse(latestUser.at) + IDLE_ADVICE_LIMITS.ttlMs <= now) fail('idle_advice_no_recent_user', 409);
    // Browser observation is not authoritative player memory. The native-message
    // identity must be bound by the existing source/channel guard in the caller;
    // only its bounded, redacted text projection goes to the existing Director.
    let project, input;
    try { project = validateProject(body.project); } catch { fail('idle_advice_invalid_project'); }
    if (!project.dealers.some(dealer => dealer.id === body.dealerId)) fail('idle_advice_invalid_request');
    try { input = normalizeInput({ requestId: body.requestId, event: { type: 'idle' }, mode: body.mode, context: { observedChat: chat } }); }
    catch { fail('idle_advice_invalid_observation'); }
    return { body: structuredClone({ ...body, project }), input, expiresAt: at + IDLE_ADVICE_LIMITS.ttlMs };
  }

  function idleCatalog(project, dealerId, registry) {
    const policy = registeredIdlePolicy(project, dealerId);
    const family = registry?.families?.find(item => item.id === policy?.familyId && item.dealerId === dealerId
      && item.eventId === 'idle.ready' && item.situation === 'ready' && item.playbackType === 'idle-pool');
    if (!family || !Array.isArray(registry.videos) || !Array.isArray(family.standardIds) || !Array.isArray(family.variantIds)) {
      return { reason: 'idle_family_unavailable_baseline' };
    }
    const known = new Map(registry.videos.map(video => [video.id, video]));
    const member = (videoId, role) => {
      const video = known.get(videoId);
      return uuid(videoId) && video?.available === true && video.familyId === family.id && video.role === role
        && (role === 'standard' ? family.standardIds : family.variantIds).includes(videoId)
        && typeof video.fileName === 'string' && /^[^/\\\u0000-\u001f\u007f]{1,116}\.(?:mp4|webm)$/i.test(video.fileName) ? video : null;
    };
    const primary = member(policy.base[0].videoId, 'standard');
    if (!primary) return { reason: 'idle_primary_unavailable_baseline' };
    const videos = policy.variants.filter(item => item.use === 'openclaw')
      .flatMap(item => {
        const video = member(item.videoId, 'variant');
        if (!video) return [];
        // Reuse the deployed catalog's bounded label field. Descriptions remain
        // untrusted candidate data; no Gateway prompt/config restart is needed.
        const description = item.description?.trim();
        const sourceLabel = typeof video.label === 'string' && /^[^\u0000-\u001f\u007f]{1,116}$/.test(video.label) ? video.label : video.fileName;
        const label = description ? `${sourceLabel.slice(0, 117 - description.length)} · ${description}` : sourceLabel;
        return [{ ...video, adviceLabel: label }];
      });
    if (!videos.length) return { reason: 'only_standard_no_model' };

    // The old catalog schema requires all six source types. These five inert
    // compatibility nodes have no file candidates, project labels or triggers.
    // Only renderer-idle is matched; no other media family leaves this adapter.
    const template = buildRuntimeCatalog(project, dealerId).events.find(node => node.id === 'idle.ready');
    const assetId = 'renderer-idle.noop';
    const baselineId = `${dealerId}.idle.ready.standard`;
    const variants = [{ id: baselineId, label: primary.fileName, priority: 0, when: { all: [] }, assetId },
      // The existing Director prefers an applicable contextual candidate with
      // higher priority. This is advice, not a rule match: baseline/abstention
      // remain valid and finalizeDecision never forces an alternative.
      ...videos.map(video => ({ id: `${dealerId}.idle.ready.file-${video.id}`, label: video.adviceLabel,
        priority: 10, when: { all: [] }, assetId }))];
    const idle = { id: `renderer-idle.${dealerId}`, label: 'Local renderer idle',
      description: 'Local renderer-idle opportunity, not a published native game instruction. Baseline means no action.',
      sourceType: 'idle', sourceRef: 'local-renderer-idle-not-native-game-event', sourceStatus: 'proposed',
      match: template.match, exampleEvent: { type: 'idle' }, baselineVariantId: baselineId, variants };
    const catalog = { schemaVersion: 1, revision: 'renderer-idle.pending',
      sourceNote: 'Renderer-idle only. Not a native game event, playback receipt, player memory or permission to speak.',
      triggerSources: [],
      events: [...SOURCE_TYPES.filter(type => type !== 'idle').map(type => {
        const variantId = `renderer-idle-compat.${type}.standard`;
        return { id: `renderer-idle-compat.${type}`, label: 'Unused schema placeholder',
          description: 'No media candidates; this source type is not selectable by this endpoint.',
          sourceType: type, sourceRef: 'unused-schema-placeholder', sourceStatus: 'proposed', match: { type },
          baselineVariantId: variantId, variants: [{ id: variantId, label: 'No media / no-op', priority: 0, when: { all: [] }, assetId }] };
      }), idle],
      assets: [{ id: assetId, label: 'No playback', kind: 'animation', animation: 'idle', color: '#000000', durationMs: 1000 }] };
    catalog.revision = `renderer-idle.${hash(catalog)}`;
    return { catalog, baselineId, videos: new Map(videos.map(video => [`${dealerId}.idle.ready.file-${video.id}`, video.id])) };
  }

  const publicProvider = status => typeof status === 'string'
    && (/^openclaw_http_[1-5]\d\d$/.test(status) || ['responded', 'openclaw_not_configured', 'invalid_gateway_url',
      'empty_response', 'response_too_large', 'invalid_json', 'invalid_completion', 'invalid_advice_json',
      'invalid_advice_shape', 'openclaw_timeout', 'openclaw_unreachable', 'openclaw_error'].includes(status))
    ? status : 'provider_error_baseline';

  // Process-local and bounded: one provider attempt per request/message while the
  // observation is fresh. Failures are retained, never retried. Restarts are not a
  // distributed exactly-once guarantee; the client also consumes each native ID.
  const jobs = new Map();
  let active = 0;
  return async function advise(body, { signal, fetchImpl: requestFetch = fetchImpl, cacheScope, videoRegistry: requestRegistry } = {}) {
    if (cacheScope !== undefined && (typeof cacheScope !== 'string' || !/^[a-f0-9]{64}$/.test(cacheScope))) fail('idle_advice_invalid_owner_scope');
    const checked = validateBody(body, now());
    const { body: inputBody, input, expiresAt } = checked;
    const scoped = value => cacheScope === undefined ? value : canonical([cacheScope, value]);
    const jobKey = scoped(inputBody.requestId),channel = scoped(inputBody.sourceRef.channel);
    const fingerprint = hash(inputBody), messageKey = canonical([channel, inputBody.sourceRef.messageId]);
    for (const [key, entry] of jobs) if (entry.settled && entry.until <= now()) jobs.delete(key);
    const prior = jobs.get(jobKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) fail('idle_advice_request_conflict', 409);
      const reused = structuredClone(await prior.promise);
      return signal?.aborted ? { ...reused, videoId: null, wouldChooseId: null, provider: 'idle_advice_cancelled_baseline' } : reused;
    }
    if ([...jobs.values()].some(entry => entry.messageKey === messageKey)) fail('idle_advice_message_already_considered', 409);
    if (jobs.size >= IDLE_ADVICE_LIMITS.capacity) fail('idle_advice_capacity', 429);
    const job = { fingerprint, messageKey, channel, started: now(), attempted: false,
      until: now() + IDLE_ADVICE_LIMITS.ledgerMs, settled: false, promise: null };
    jobs.set(jobKey, job);
    const result = (provider, contextReceipt = { contractVersion: null, observedChatMessages: null }, videoId = null, wouldChooseId = null) => ({
      requestId: inputBody.requestId, sourceRef: inputBody.sourceRef, videoId, wouldChooseId, provider, contextReceipt,
      expiresAt: new Date(expiresAt).toISOString(),
    });
    job.promise = Promise.resolve().then(async () => {
      if (signal?.aborted) return result('idle_advice_cancelled_baseline');
      let selection;
      try { selection = idleCatalog(inputBody.project, inputBody.dealerId, requestRegistry ?? videoRegistry ?? await registryLoader()); }
      catch { return result('idle_catalog_unavailable_baseline'); }
      if (signal?.aborted) return result('idle_advice_cancelled_baseline');
      if (selection.reason) return result(selection.reason);
      if (now() >= expiresAt) return result('idle_advice_expired_baseline');
      const channelJobs = [...jobs.values()].filter(entry => entry !== job && entry.attempted && entry.channel === job.channel
        && entry.started > now() - 60000);
      if (active >= IDLE_ADVICE_LIMITS.concurrency || channelJobs.length >= IDLE_ADVICE_LIMITS.channelPerMinute
        || channelJobs.some(entry => entry.started > now() - IDLE_ADVICE_LIMITS.channelIntervalMs)) return result('idle_advice_rate_limited_baseline');
      let configured, prepared;
      try {
        configured = settings ?? settingsProvider();
        prepared = prepareDecision(selection.catalog, input);
      } catch { return result('idle_configuration_unavailable_baseline'); }
      const deadline = Math.max(1, Math.min(30000, expiresAt - now()));
      const timeout = Number.isFinite(configured.adviceTimeoutMs) ? configured.adviceTimeoutMs : 2500;
      const deadlineSignal = AbortSignal.timeout(deadline);
      const boundedFetch = (url, options = {}) => requestFetch(url, { ...options,
        signal: AbortSignal.any([deadlineSignal, ...(options.signal ? [options.signal] : []), ...(signal ? [signal] : [])]) });
      let reply;
      active++; job.attempted = true;
      try {
        if (configured.remoteUrl) {
          reply = await remoteRequest('/api/studio/advice', { catalog: selection.catalog, input }, configured, boundedFetch,
            Math.min(deadline, Math.max(500, timeout + 1500)));
        } else reply = await askDirector(prepared, { ...configured, adviceTimeoutMs: Math.min(deadline, Math.max(1, timeout)) }, boundedFetch);
      } catch { return result(signal?.aborted ? 'idle_advice_cancelled_baseline'
        : configured.remoteUrl ? 'remote_unavailable_baseline' : 'provider_error_baseline'); }
      finally { active--; }
      if (signal?.aborted) return result('idle_advice_cancelled_baseline');
      if (now() >= expiresAt) return result('idle_advice_expired_baseline');
      const status = publicProvider(reply?.provider?.status);
      if (status !== 'responded') return result(status);
      const count = prepared.context.observedChat.messages.length;
      if (reply.provider.contextContractVersion !== 2 || reply.provider.observedChatMessages !== count) {
        return result(configured.remoteUrl ? 'remote_context_not_supported_baseline' : 'context_not_supported_baseline');
      }
      const receipt = { contractVersion: 2, observedChatMessages: count };
      const finalized = finalizeDecision(prepared, reply.advice ?? null, input.mode);
      const chosen = selection.videos.get(finalized.advice?.variantId) ?? null;
      if (!['accepted', 'shadow_only', 'abstained'].includes(finalized.gate.reason)) return result('invalid_advice_baseline', receipt);
      return result(status, receipt, input.mode === 'active' ? chosen : null, chosen);
    }).catch(() => result('idle_advice_unavailable_baseline')).finally(() => { job.settled = true; });
    const completed = structuredClone(await job.promise);
    return signal?.aborted ? { ...completed, videoId: null, wouldChooseId: null, provider: 'idle_advice_cancelled_baseline' } : completed;
  };
}
