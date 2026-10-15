import { createMovingWorkerChannel } from '../services/astrid-gpu-worker/gateway/moving-transport.mjs';

const IMAGE = /^ghcr\.io\/emacodehero\/croupier-lipsync-worker:[a-f0-9]{40}$/;
const fail = code => { throw Error(code); };

/** Internal control-plane receipt from GET endpoint + workers, never browser
 * input. This is a deployment gate, NOT a runtime or avatar-byte attestation.
 * No environment fallback and no provider mutations or paid requests here.
 */
export function verifyMovingWorkerRelease(receipt, now = Date.now()) {
  const { expectedImage, endpoint, workers, observedAtMs } = receipt || {};
  if (!IMAGE.test(expectedImage || '') || !/^[a-z0-9]{6,64}$/.test(endpoint?.id || '')
    || !Number.isSafeInteger(observedAtMs) || observedAtMs > now || now - observedAtMs > 60000
    || !Number.isSafeInteger(workers?.endpointVersion) || workers.endpointVersion < 1
    || !Array.isArray(workers.workers) || !workers.workers.length || workers.workers.length > 100) fail('moving_worker_release_unverified');
  if (endpoint.image !== expectedImage || workers.workers.some(worker => worker.image !== expectedImage
    || worker.version !== workers.endpointVersion || worker.isStale !== false)) fail('moving_worker_release_mismatch');
  return Object.freeze({ image: expectedImage, endpointId: endpoint.id, endpointVersion: workers.endpointVersion, observedAtMs });
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
 * `release` receipt. Later checks must return the same jobId. `finalize` releases
 * that reservation/job using our existing journal (including on early abort).
 * onChunk receives paired metadata/bytes for the existing browser layer; it
 * must deliver only to the authenticated owner and honor the supplied signal.
 */
export async function createMovingSpeechTransport({ input, origin, release, authorize, onChunk, finalize,
  signal, idleMs, lifetimeMs } = {}) {
  if (!input?.plan || typeof input.messages !== 'function' || typeof authorize !== 'function'
    || typeof onChunk !== 'function' || typeof finalize !== 'function'
    || (signal !== undefined && !(signal instanceof AbortSignal))) fail('invalid_moving_speech_transport');
  const pin = verifyMovingWorkerRelease(release);
  const plan = input.plan;
  const owner = await authorize({ phase: 'prepare', binding: plan.binding, release: pin });
  if (!owner || typeof owner.userId !== 'string' || !owner.userId || owner.userId.length > 128
    || owner.sessionId !== plan.binding.sessionId || owner.endpointId !== pin.endpointId) fail('moving_speech_not_authorized');
  const owned = Object.freeze({ userId: owner.userId, sessionId: owner.sessionId, endpointId: owner.endpointId });
  const channel = createMovingWorkerChannel({ origin, avatar: plan.binding.workerAvatar, idleMs, lifetimeMs });
  let used = false, finished = false, started = false, cancelling = false, finalization, jobId;
  let resolveClosed, rejectClosed;
  const closed = new Promise((resolve, reject) => { resolveClosed = resolve; rejectClosed = reject; });
  closed.catch(() => {});
  const check = async phase => {
    const current = await channel.bounded(Promise.resolve().then(() => {
      if (channel.signal.aborted || cancelling) fail('moving_speech_cancelled');
      return authorize({ phase, binding: plan.binding, release: pin });
    }), 'moving_speech_authorization_timeout');
    if (!current || current.userId !== owned.userId || current.sessionId !== owned.sessionId
      || current.endpointId !== owned.endpointId || typeof current.jobId !== 'string' || !current.jobId || current.jobId.length > 128
      || (jobId !== undefined && current.jobId !== jobId)) fail('moving_speech_not_authorized');
    if (phase === 'send') {
      const fresh = verifyMovingWorkerRelease(current.release);
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
    if (reason !== 'complete') input.cancel();
    channel.close();
    // Cleanup errors are returned to the caller, not silently turned into a
    // successful/cancelled job. No remote credential or diagnostic is exposed.
    finalization = Promise.resolve().then(() => finalize({ owner: owned, jobId, reason }));
    finalization.then(resolveClosed, rejectClosed);
    return finalization;
  };
  const abort = () => { void cancel().catch(() => {}); };
  const disconnected = () => { void finish('disconnected').catch(() => {}); };
  async function cancel() {
    if (finished) return finalization;
    if (cancelling) return closed;
    cancelling = true;
    input.cancel();
    try { if (started) await channel.send(JSON.stringify({ t: 'avbryt', id: plan.start.id })); }
    catch { /* A broken connection is also cancelled by the owning journal. */ }
    return finish('cancelled');
  }
  signal?.addEventListener('abort', abort, { once: true });
  channel.signal.addEventListener('abort', disconnected, { once: true });
  if (signal?.aborted) { await cancel(); fail('moving_speech_cancelled'); }

  return Object.freeze({
    // Internal server-only capability, supplied to the accepted job by our
    // budgeted session manager. It must never point to Emil's staging server.
    callbackUrl: channel.callbackUrl, handleUpgrade: channel.handleUpgrade,
    release: pin, cancel, closed,
    async run() {
      if (used || finished) fail('moving_speech_transport_consumed');
      used = true;
      try {
        const hello = json(await channel.next());
        if (hello.t !== 'pong' || hello.avatar !== plan.binding.workerAvatar
          || !Number.isFinite(hello.rutor_per_s) || hello.rutor_per_s < 30
          || hello.ljud_fore_s !== plan.audioLeadMs / 1000 || hello.del_rutor !== 12) fail('moving_worker_incompatible');
        // A fresh admission check is required AFTER the authenticated callback,
        // before any PCM is disclosed. Worker pong does not attest its image.
        await check('send');
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
        }
      } catch (error) {
        await cancel();
        throw error;
      }
    },
  });
}
