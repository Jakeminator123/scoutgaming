import { MOVING_SPEECH_LIMITS } from './moving-speech-limits.mjs';
import { createMovingWorkerChannel } from '../astrid-gpu-worker/gateway/moving-transport.mjs';
import { verifyMovingSpeechBinding as verifyBinding, MOVING_ATTESTATION_KEYS as ATTESTATION_KEYS } from './moving-speech-binding.mjs';

const IMAGE = /^ghcr\.io\/emacodehero\/croupier-lipsync-worker:[a-f0-9]{40}$/;
const OWN_IMAGE = /^ghcr\.io\/jakeminator123\/moving-gpu-worker@sha256:[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const fail = code => { throw Error(code); };

// Supplied only by our server's admitted attempt + verified bank receipt.
// These declarations are compared with the callback, not trusted from it.
function verifyAttestation(value, binding, jobId) {
  if (!ID.test(jobId) || !value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== ATTESTATION_KEYS.length + 1
    || ATTESTATION_KEYS.some(key => !Object.hasOwn(value, key) || value[key] !== binding[key])
    || !Object.hasOwn(value, 'jobId') || value.jobId !== jobId) fail('moving_worker_attestation_mismatch');
  return Object.freeze({ ...binding, jobId });
}

/** Internal control-plane receipt from GET endpoint + workers, never browser
 * input. This is a deployment gate, NOT a runtime or avatar-byte attestation.
 * No environment fallback and no provider mutations or paid requests here.
 * A worker row may carry `state`: only rows that occupy a GPU (`active`, or
 * `unknown`/absent, which is treated as active) must run the exact release;
 * `scaled-down` and `terminated` rows are provider bookkeeping, not capacity,
 * so they never satisfy `requireWorkers` and may be outdated.
 */
const WORKER_STATES = new Set(['active', 'unknown', 'scaled-down', 'terminated']);
const occupiesGpu = worker => worker.state === undefined || worker.state === 'active' || worker.state === 'unknown';
export function verifyMovingWorkerRelease(receipt, now = Date.now(), { requireWorkers = false } = {}) {
  const { expectedImage, endpoint, workers, observedAtMs } = receipt || {};
  if (!(IMAGE.test(expectedImage || '') || OWN_IMAGE.test(expectedImage || '')) || !/^[a-z0-9]{6,64}$/.test(endpoint?.id || '')
    || !Number.isSafeInteger(observedAtMs) || observedAtMs > now || now - observedAtMs > 60000
    || !Number.isSafeInteger(workers?.endpointVersion) || workers.endpointVersion < 0
    || !Array.isArray(workers.workers) || workers.workers.length > 100
    || workers.workers.some(worker => !worker || typeof worker !== 'object' || (worker.state !== undefined && !WORKER_STATES.has(worker.state)))
    || (workers.workersMax !== undefined && (!Number.isSafeInteger(workers.workersMax) || workers.workersMax < 0))) fail('moving_worker_release_unverified');
  const active = workers.workers.filter(occupiesGpu);
  if ((!OWN_IMAGE.test(expectedImage || '') || requireWorkers) && !active.length) fail('moving_worker_release_unverified');
  if (workers.workersMax !== undefined && active.length > workers.workersMax) fail('moving_worker_release_unverified');
  if (endpoint.image !== expectedImage || active.some(worker => worker.image !== expectedImage
    || worker.version !== workers.endpointVersion || worker.isStale !== false)) fail('moving_worker_release_mismatch');
  return Object.freeze({ image: expectedImage, endpointId: endpoint.id, endpointVersion: workers.endpointVersion, observedAtMs,
    activeWorkers: active.length, inactiveWorkers: workers.workers.length - active.length });
}

function json(item) {
  if (item.binary) fail('moving_worker_expected_metadata');
  let value;
  try { value = JSON.parse(item.data.toString('utf8')); } catch { fail('moving_worker_invalid_json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('moving_worker_invalid_json');
  return value;
}

/** Opt-in application adapter; no HTTP route is installed automatically.
 * `authorize` must recheck our durable admission, owner, published package,
 * current dealer/profile/revision and budget. During phase `send` it must also
 * verify that OUR paid job was accepted for this endpoint and return a fresh
 * `release` receipt. Later checks must return the same jobId. `finalize`
 * reconciles the job using our journal, retaining uncertain ownership on abort.
 * Append-only cost reservations are never refunded by transport completion.
 * It must be bound to the already reserved attempt by the caller: owner is
 * null until prepare succeeds; binding/release identify the attempted plan,
 * not an authenticated owner. Authorizers must honor the supplied signal.
 * onChunk receives paired metadata/bytes for the existing browser layer; it
 * must deliver only to the authenticated owner and honor the supplied signal.
 */
export async function createMovingSpeechTransport({ input, origin, release, authorize, onChunk, finalize,
  signal, idleMs, lifetimeMs, startupMs, attestationBinding } = {}) {
  return movingConnection({ input, origin, release, authorize, onChunk, finalize,
    signal, idleMs, lifetimeMs, startupMs, attestationBinding });
}

/** Two phases: authenticate the callback before generating any paid voice.
 * ready() attests the accepted job and sends only the binding acknowledgement.
 * dispatch() then accepts the exact PCM/plan. The capability never leaves the
 * server/provider boundary; no route or provider call is installed here.
 */
export async function createMovingSpeechConnection(options = {}) {
  verifyBinding(options.attestationBinding);
  if (!OWN_IMAGE.test(verifyMovingWorkerRelease(options.release).image)) fail('moving_worker_binding_requires_owned_release');
  return movingConnection(options);
}

async function movingConnection({ input, origin, release, authorize, onChunk, finalize,
  signal, idleMs, lifetimeMs, startupMs, attestationBinding, chunkAcknowledgements = false } = {}) {
  if ((input !== undefined && (!input?.plan || typeof input.messages !== 'function' || typeof onChunk !== 'function'))
    || (!input && !attestationBinding) || typeof authorize !== 'function' || typeof finalize !== 'function'
    || (signal !== undefined && !(signal instanceof AbortSignal))) fail('invalid_moving_speech_transport');
  let plan = input?.plan ?? { binding: attestationBinding, audioLeadMs: 220 };
  function validateInput(next) {
    if (!next?.plan || typeof next.messages !== 'function' || typeof next.cancel !== 'function') fail('invalid_moving_speech_transport');
    if (binding) {
      verifyBinding(binding, next.plan);
      if (!Number.isSafeInteger(next.byteLength) || next.byteLength <= 0 || next.byteLength % 2
        || Math.floor((next.byteLength / 2 + 18000) / 1000) !== next.plan.timeline.length) fail('moving_worker_plan_padding_mismatch');
    }
  }
  // Start lifetime/abort handling BEFORE the first asynchronous admission.
  // The capability remains private until prepare has actually succeeded.
  let pin = null, channel, binding = null;
  try {
    pin = verifyMovingWorkerRelease(release);
    if (chunkAcknowledgements && !OWN_IMAGE.test(pin.image)) fail('moving_worker_binding_requires_owned_release');
    if (OWN_IMAGE.test(pin.image)) {
      binding = verifyBinding(attestationBinding, plan);
      // The owned engine includes both leading and trailing silence. Supplying
      // fewer source frames would silently hold its last pose in the vendor core.
      if (input) validateInput(input);
    }
    else if (attestationBinding !== undefined) fail('moving_worker_binding_requires_owned_release');
    channel = createMovingWorkerChannel({ origin, avatar: plan.binding.workerAvatar,
      verifiedAvatar: binding?.workerAvatar, idleMs,
      lifetimeMs: lifetimeMs ?? (binding ? MOVING_SPEECH_LIMITS.lifetimeMs : undefined),
      coldStartGraceMs: binding ? MOVING_SPEECH_LIMITS.coldStartGraceMs : 0,
      startupMs: binding ? (startupMs ?? Math.min(MOVING_SPEECH_LIMITS.startupMs,
        lifetimeMs ?? MOVING_SPEECH_LIMITS.lifetimeMs)) : undefined });
  } catch (error) {
    input?.cancel();
    await finalize({ owner: null, binding: plan.binding, release: pin, jobId: undefined, reason: 'prepare_failed' });
    throw error;
  }
  let owned = null, used = false, finished = false, started = false, cancelling = false, finalization, jobId, readiness;
  let resolveClosed, rejectClosed;
  const closed = new Promise((resolve, reject) => { resolveClosed = resolve; rejectClosed = reject; });
  closed.catch(() => {});
  const check = async phase => {
    const current = await channel.bounded(Promise.resolve().then(() => {
      if (channel.signal.aborted || cancelling) fail('moving_speech_cancelled');
      return authorize({ phase, binding: plan.binding, release: pin, signal: channel.signal });
    }), 'moving_speech_authorization_timeout');
    if (!current || current.userId !== owned.userId || current.sessionId !== owned.sessionId
      || current.endpointId !== owned.endpointId || typeof current.jobId !== 'string' || !current.jobId || current.jobId.length > 128
      || (jobId !== undefined && current.jobId !== jobId)) fail('moving_speech_not_authorized');
    if (phase === 'send') {
      const fresh = verifyMovingWorkerRelease(current.release, Date.now(), { requireWorkers: true });
      if (fresh.image !== pin.image || fresh.endpointId !== pin.endpointId || fresh.endpointVersion !== pin.endpointVersion) fail('moving_worker_release_changed');
      jobId = current.jobId;
    }
    if (channel.signal.aborted || cancelling) fail('moving_speech_cancelled');
  };
  const finish = reason => {
    if (finalization) return finalization;
    finished = true;
    signal?.removeEventListener('abort', abort);
    channel.signal.removeEventListener('abort', disconnected);
    if (reason !== 'complete') input?.cancel();
    channel.close();
    // Cleanup errors are returned to the caller, not silently turned into a
    // successful/cancelled job. No remote credential or diagnostic is exposed.
    finalization = Promise.resolve().then(() => finalize({ owner: owned, binding: plan.binding, release: pin, jobId, reason }));
    finalization.then(resolveClosed, rejectClosed);
    return finalization;
  };
  const abort = () => { void cancel().catch(() => {}); };
  const disconnected = () => { void finish('disconnected').catch(() => {}); };
  async function cancel() {
    if (finished) return finalization;
    if (cancelling) return closed;
    cancelling = true;
    input?.cancel();
    try { if (started) await channel.send(JSON.stringify({ t: 'avbryt', id: plan.start.id })); }
    catch { /* A broken connection is also cancelled by the owning journal. */ }
    return finish('cancelled');
  }
  signal?.addEventListener('abort', abort, { once: true });
  channel.signal.addEventListener('abort', disconnected, { once: true });
  if (signal?.aborted) { await cancel(); fail('moving_speech_cancelled'); }

  try {
    const owner = await channel.bounded(Promise.resolve().then(() => {
      if (channel.signal.aborted || cancelling) fail('moving_speech_cancelled');
      return authorize({ phase: 'prepare', binding: plan.binding, release: pin, signal: channel.signal });
    }), 'moving_speech_authorization_timeout');
    if (channel.signal.aborted || cancelling || finished) fail('moving_speech_cancelled');
    if (!owner || typeof owner.userId !== 'string' || !owner.userId || owner.userId.length > 128
      || owner.sessionId !== plan.binding.sessionId || owner.endpointId !== pin.endpointId) fail('moving_speech_not_authorized');
    owned = Object.freeze({ userId: owner.userId, sessionId: owner.sessionId, endpointId: owner.endpointId });
  } catch (error) {
    await cancel();
    throw error;
  }

  function ready() {
    if (readiness) return readiness;
    readiness = (async () => {
      if (finished) fail('moving_speech_transport_consumed');
      try {
        const hello = json(await channel.next());
        if (hello.t !== 'pong' || hello.avatar !== plan.binding.workerAvatar
          || !Number.isFinite(hello.rutor_per_s) || hello.rutor_per_s < 30
          || hello.ljud_fore_s !== plan.audioLeadMs / 1000 || hello.del_rutor !== 12
          || (binding && (hello.pad_after_s !== .53 || hello.fps !== 24))
          || (chunkAcknowledgements && hello.chunk_ack !== true)) fail('moving_worker_incompatible');
        await check('send');
        if (binding) {
          const attestation = verifyAttestation(hello.attestation, binding, jobId);
          await channel.send(JSON.stringify({ t: 'bind', attestation }));
        }
        return Object.freeze({ jobId, binding, release: pin });
      } catch (error) { await cancel(); throw error; }
    })();
    return readiness;
  }

  const api = {
    // Internal server-only capability, supplied to the accepted job by our
    // budgeted session manager. It must never point to Emil's staging server.
    callbackUrl: channel.callbackUrl, handleUpgrade: channel.handleUpgrade,
    release: pin, cancel, closed, ready,
    async dispatch(next, { onChunk: consume } = {}) {
      if (used || finished) fail('moving_speech_transport_consumed');
      used = true;
      try {
        await ready();
        validateInput(next);
        if (typeof consume !== 'function') fail('invalid_moving_speech_transport');
        input = next; plan = next.plan; onChunk = consume;
        for (const message of input.messages({ signal: channel.signal })) {
          if (signal?.aborted || finished) fail('moving_speech_cancelled');
          await check('transfer');
          started = true;
          await channel.send(message);
        }
        let nextFrame = plan.start.fran_ruta, chunks = 0;
        const parts = new Set();
        for (;;) {
          const meta = json(await channel.next());
          if (meta.id !== plan.start.id) fail('moving_worker_wrong_reply');
          if (meta.t === 'error') fail('moving_worker_reported_error');
          if (meta.t === 'done') {
            if (!chunks) fail('moving_worker_empty_result');
            if (binding && nextFrame !== plan.timeline.length) fail('moving_worker_incomplete_result');
            await check('complete');
            await finish('complete');
            return Object.freeze({ chunks, frames: nextFrame - plan.start.fran_ruta, planSha256: plan.planSha256 });
          }
          if (meta.t !== 'lapp' || !Number.isSafeInteger(meta.del) || meta.del < 0 || parts.has(meta.del)
            || meta.fran !== nextFrame || !Array.isArray(meta.rutor) || !meta.rutor.length || meta.rutor.length > 12
            || nextFrame + meta.rutor.length > plan.timeline.length) fail('moving_worker_invalid_chunk');
          for (const [index, tag] of meta.rutor.entries()) {
            if (tag === null) continue;
            const expected = plan.timeline[nextFrame + index];
            if (!tag || tag.tagning !== expected.take || tag.ruta !== expected.frame
              || !Array.isArray(tag.rect) || tag.rect.length !== 4
              || tag.rect.some(n => !Number.isFinite(n) || n < 0 || n > 16384)
              || tag.rect[2] === 0 || tag.rect[3] === 0) fail('moving_worker_wrong_frame');
          }
          const binary = await channel.next();
          if (!binary.binary || !binary.data.length) fail('moving_worker_expected_binary');
          await check('output');
          // Pass only protocol fields; provider diagnostic strings/extra fields
          // cannot escape into the browser relay or application logs.
          const paired = { t: 'lapp', id: plan.start.id, del: meta.del, fran: meta.fran,
            rutor: meta.rutor.map(tag => tag === null ? null : { tagning: tag.tagning, ruta: tag.ruta, rect: [...tag.rect] }) };
          await channel.bounded(Promise.resolve().then(() => {
            if (channel.signal.aborted || cancelling) fail('moving_speech_cancelled');
            return onChunk(paired, binary.data, { signal: channel.signal, binding: plan.binding, planSha256: plan.planSha256 });
          }), 'moving_speech_consumer_timeout');
          parts.add(meta.del); nextFrame += meta.rutor.length; chunks++;
          // Owned worker waits here. Browser credit therefore bounds the
          // producer too, instead of merely filling the raw callback queue.
          if (chunkAcknowledgements) await channel.send(JSON.stringify({ t: 'ack', id: plan.start.id, del: meta.del }));
        }
      } catch (error) {
        next?.cancel?.();
        await cancel();
        throw error;
      }
    },
    run() { return api.dispatch(input, { onChunk }); },
  };
  return Object.freeze(api);
}
