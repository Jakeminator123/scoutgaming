import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, open, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isIP } from 'node:net';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASTRID_VOICE_PROFILE } from '../packages/presentation/contracts/astrid-voice-profile.mjs';
import { createSpeechSessionManager, sessionReserveMicroUsd, dailyBudgetMicroUsd } from './generated-speech-session.mjs';
import { createSpeechJournalLease, requireSpeechJournal } from '../packages/presentation/server/speech-journal-lease.mjs';
import { acceptsWorkerBinding } from '../services/astrid-gpu-worker/gateway/worker-binding.mjs';

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => createHash('sha256').update(value).digest('hex');
const equalPath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const identifier = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
// The isolated unpaid preload installs this optional, allowlisted callback.
// Production has no callback; no identity, text or payload is passed to it.
function unpaidTrace(phase) {
  const trace = globalThis[Symbol.for('croupier.unpaid-stream-diagnostics')];
  if (typeof trace === 'function') { try { trace(phase, {}); } catch {} }
}
const PCM_LIMIT = 24000 * 2 * 25;
function startAudioPrefetch(open, signal) {
  const chunks = [], waiters = [];
  let done = false, error = null, bytes = 0;
  const wake = () => { const pending = waiters.splice(0); for (const resolve of pending) resolve(); };
  signal.addEventListener('abort', wake, { once: true });
  const task = (async () => {
    try {
      for await (const pcm of open()) {
        signal.throwIfAborted();
        const length = pcm?.byteLength;
        if (!Number.isInteger(length) || length < 1 || length % 2 || bytes + length > PCM_LIMIT) throw Error('Audio duration exceeded');
        chunks.push(pcm); bytes += length; wake();
      }
      done = true;
    } catch (failure) { error = failure; }
    finally { wake(); }
  })();
  return {
    task,
    get error() { return error; },
    async *read() {
      let index = 0, offset = 0;
      for (;;) {
        signal.throwIfAborted();
        // Transport packets are often tiny. Revalidating the same already
        // buffered audio once per packet starves the GPU on database latency.
        // Drain only what is available, in bounded relay-sized blocks; never
        // wait to fill a block. The consumer still revalidates every write.
        if (index < chunks.length) {
          const parts = []; let length = 0;
          while (index < chunks.length && length < 65536) {
            const chunk = chunks[index], take = Math.min(chunk.byteLength - offset, 65536 - length);
            parts.push(chunk.subarray(offset, offset + take)); length += take; offset += take;
            if (offset === chunk.byteLength) { index++; offset = 0; }
          }
          yield Buffer.concat(parts, length);
          continue;
        }
        if (done) return;
        if (error) throw error;
        await new Promise(resolve => waiters.push(resolve));
      }
    },
  };
}
function fail(code, statusCode = 503) { throw Object.assign(new Error(code), { code, statusCode }); }
function privateDirectory(value) {
  if (typeof value !== 'string' || !isAbsolute(value)) return false;
  const path = resolve(value), inside = relative(REPOSITORY, path);
  return ![parse(path).root, homedir(), process.cwd()].some(v => equalPath(path, resolve(v)))
    && (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside));
}

export function generatedSpeechStreamConfiguration(env = process.env) {
  let origin = null;
  const local = env.CROUPIER_GENERATED_SPEECH_PREVIEW === '1' && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(env.HOST);
  if (local) origin = `http://${env.HOST === '::1' ? '[::1]' : env.HOST}:${Number(env.PORT || 4173)}`;
  let cloud = false;
  const cloudHost = ['0.0.0.0', '::', '[::]'].includes(env.HOST)
    || (env.CROUPIER_CLOUD_RUNTIME === '1' && env.HOST === '127.0.0.1');
  if (env.CROUPIER_CLOUD_GENERATED_SPEECH === '1' && env.NODE_ENV === 'production' && env.DEMO_GUEST_ACCESS !== '1'
    && cloudHost) {
    try {
      const url = new URL(env.PUBLIC_URL);
      cloud = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' && !url.port
        && !isIP(url.hostname) && url.hostname.includes('.') && !url.hostname.endsWith('.local') && url.hostname !== 'localhost';
      if (cloud) origin = url.origin;
    } catch {}
  }
  const enabled = env.CROUPIER_GENERATED_SPEECH_STREAMING === '1' && env.CROUPIER_GENERATED_SPEECH === '1' && (local || cloud);
  const journaled = env.CROUPIER_STUDIO_NEON_POLICY === '1';
  const configuration = { directory: journaled ? undefined : env.CROUPIER_GENERATED_SPEECH_DIR, origin,
    workerSecret: env.CROUPIER_SPEECH_STREAM_WORKER_SECRET, ticketSecret: env.CROUPIER_SPEECH_STREAM_TICKET_SECRET,
    apiKey: env.CARTESIA_API_KEY, voiceId: ASTRID_VOICE_PROFILE.voiceId, modelId: ASTRID_VOICE_PROFILE.modelId };
  if (cloud) {
    configuration.session = {
      apiKey: env.RUNPOD_API_KEY, endpointId: env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID,
      reserveUsd: env.CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD,
      dailyBudgetUsd: env.CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD,
    };
    // Cartesia may start while the already-requested GPU session is connecting.
    // PCM stays in this process until the browser ticket is authenticated.
    configuration.overlapAudio = true;
  }
  const secret = v => typeof v === 'string' && v.length >= 32 && v.length <= 2048 && !/\s/.test(v);
  const sessionConfigured = !cloud || (typeof configuration.session.apiKey === 'string' && configuration.session.apiKey.length > 0
    && !/\s/.test(configuration.session.apiKey) && /^[A-Za-z0-9_-]{1,100}$/.test(configuration.session.endpointId ?? '')
    && sessionReserveMicroUsd(configuration.session.reserveUsd) !== null && dailyBudgetMicroUsd(configuration.session.dailyBudgetUsd) !== null
    && sessionReserveMicroUsd(configuration.session.reserveUsd) <= dailyBudgetMicroUsd(configuration.session.dailyBudgetUsd));
  const configured = enabled && (journaled || privateDirectory(configuration.directory)) && secret(configuration.workerSecret) && secret(configuration.ticketSecret)
    && configuration.workerSecret !== configuration.ticketSecret
    && typeof configuration.apiKey === 'string' && configuration.apiKey.length > 0 && !/\s/.test(configuration.apiKey) && sessionConfigured;
  return { enabled, configured, configuration };
}

/** No websocket dependency is loaded unless this opt-in service is constructed.
 * prepare reserves durable request identity. Without a cloud GPU session, TTS
 * starts only on an authenticated browser attachment. With overlapAudio, TTS
 * starts only after the GPU job is accepted, while that worker connects.
 * Owner, player and shutdown cancellation abort that fetch immediately.
 * PCM enters the relay only after the browser ticket is authenticated.
 * Normal HTTP result completion does not own this lifetime.
 */
export async function createGeneratedSpeechStreamService(server, configuration, {
  resolveOwner, attachRelay, pcmSource, sessionManager: suppliedSessionManager, fetchImpl = fetch, dealerRuntime, replyLibrary, onLibraryStatus = () => {}, replyCaptureBytes = 64 * 1024 * 1024,
  freshnessIntervalMs = 500, ticketLifetimeMs = 30000, streamLifetimeMs = 120000, movingSpeechRoutes = false,
  journal = null, journalRequired = process.env.CROUPIER_STUDIO_NEON_POLICY === '1',
} = {}) {
  if (journalRequired || journal) requireSpeechJournal(journal);
  if (journal && suppliedSessionManager) fail('generated_speech_journal_unavailable');
  const ownership = journal ? createSpeechJournalLease({ journal, resource:'stream-session' }) : null;
  const journalTasks = new Set();
  let serviceClosing = false, closePromise;
  const track = task => { journalTasks.add(task); task.finally(() => journalTasks.delete(task)).catch(() => {}); return task; };
  if ((!journal && !privateDirectory(configuration?.directory)) || typeof resolveOwner !== 'function') fail('generated_speech_stream_not_configured');
  const [{ issueTicket, ticketAuthenticator }, { createCartesiaSource }] = await Promise.all([
    import('../services/astrid-gpu-worker/gateway/auth.mjs'),
    import('../services/astrid-gpu-worker/gateway/cartesia-source.mjs'),
  ]);
  const { directory, workerSecret, ticketSecret, origin } = configuration;
  const authenticateTicket = ticketAuthenticator(ticketSecret);
  const source = pcmSource ?? createCartesiaSource(configuration, { fetchImpl });
  const attach = attachRelay ?? (await import('../services/astrid-gpu-worker/gateway/relay.mjs')).attachSpeechRelay;
  const records = new Map(), owners = new Map(), preparations = new Map(), inFlight = new Set();
  let exclusive = null;
  const settleExclusive = () => {
    if (exclusive?.releasing && ![...inFlight].some(item => item.owner === exclusive.owner)
      && !owners.has(exclusive.owner)) exclusive = null;
  };
  const releaseOwner = owner => {
    if (exclusive?.owner !== owner) return;
    exclusive.releasing = true;
    // Cancellation removes the public preparation entry immediately. Retain
    // admission until its manager promise has finished cancelling its own job.
    settleExclusive();
  };
  const mark = (record, stage, ms) => {
    try { record.input.onTiming?.(stage, ms); } catch { /* Telemetry cannot affect paid work. */ }
  };
  let relay, sessionManager, libraryBytesHeld = 0;
  if (!Number.isSafeInteger(replyCaptureBytes) || replyCaptureBytes < 1 || replyCaptureBytes > 64 * 1024 * 1024) fail('reply_library_invalid_capture_limit');
  function releaseLibrary(record) {
    libraryBytesHeld -= record.libraryRetained ?? 0; record.libraryRetained = 0;
    record.libraryChunks.audio = []; record.libraryChunks.video = [];
  }
  const libraryStatus = status => { try { onLibraryStatus(status); } catch {} };
  function collect(record,kind,bytes) {
    if (!replyLibrary || !record || record.libraryOverflow) return;
    const limit = kind === 'audio' ? 24000 * 2 * 25 : 128 * 1024 * 1024;
    record.libraryBytes[kind] += bytes.byteLength;
    if (record.libraryBytes[kind] > limit || libraryBytesHeld + bytes.byteLength > replyCaptureBytes) {
      record.libraryOverflow = true; releaseLibrary(record);
      libraryStatus({state:'skipped',code:'reply_library_capture_limit'}); return;
    }
    record.libraryChunks[kind].push(Buffer.from(bytes));
    libraryBytesHeld += bytes.byteLength; record.libraryRetained = (record.libraryRetained ?? 0) + bytes.byteLength;
  }
  function finishLibrary(record,message) {
    if (!replyLibrary || !record || record.librarySaving || record.libraryOverflow || !record.ttsComplete
      || message.aborted || !Number.isInteger(message.frames) || message.frames < 1
      || record.controller.signal.aborted || record.input.signal?.aborted || !record.libraryBytes.audio || !record.libraryBytes.video) return;
    record.librarySaving = true;
    const pcm = Buffer.concat(record.libraryChunks.audio), video = Buffer.concat(record.libraryChunks.video);
    record.libraryChunks.audio = []; record.libraryChunks.video = [];
    const wav = Buffer.alloc(44 + pcm.length);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16);
    wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(24000,24); wav.writeUInt32LE(48000,28);
    wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(pcm.length,40); pcm.copy(wav,44); pcm.fill(0);
    const request = {dealerId:record.input.dealerId,exactText:record.input.text,language:'en',
      profileRevision:record.runtime?.profileRevision ?? digest(JSON.stringify(ASTRID_VOICE_PROFILE)),
      audio:{bytes:wav,contentType:'audio/wav'},video:{bytes:video,contentType:'video/mp4'}};
    // Starts after the final media/control frame has been forwarded. Storage
    // never gates first audio, first video or worker reuse, and gets no user audio.
    track((async () => {
      try {
        await record.input.beforeCostly(); await record.runtime?.assertFresh();
        if (record.input.signal?.aborted) return;
        await replyLibrary.save(request); libraryStatus({state:'saved'});
      } catch { libraryStatus({state:'failed',code:'reply_library_save_failed'}); }
      finally { wav.fill(0); video.fill(0); releaseLibrary(record); }
    })());
  }
  const forget = record => {
    clearTimeout(record.deadline); clearInterval(record.monitor);
    if (!record.librarySaving) releaseLibrary(record);
    record.libraryChunks.audio = []; record.libraryChunks.video = [];
    record.input.signal?.removeEventListener('abort', record.externalAbort);
    record.wireSignal?.removeEventListener('abort', record.wireAbort);
    if (records.get(record.id) === record) records.delete(record.id);
    if (owners.get(record.input.owner) === record) owners.delete(record.input.owner);
    releaseOwner(record.input.owner);
  };
  const cancel = record => {
    if (!records.has(record.id)) return;
    record.controller.abort(); record.stopPrefetch?.(); record.handle?.abort(); forget(record);
    if (journal && record.journalClaim && !record.journalSettled) {
      record.journalSettled = true;
      track((async () => { await journal.failRequest({ key:record.journalClaim.key,
        lease:await ownership.get(), safeCode:'generated_speech_stream_cancelled' }); })()).catch(() => {});
    }
  };
  const fresh = async record => {
    if (record.controller.signal.aborted || record.input.signal?.aborted || records.get(record.id) !== record) fail('generated_speech_stream_cancelled', 499);
    await record.input.beforeCostly();
    await record.runtime?.assertFresh();
    if (record.controller.signal.aborted || record.input.signal?.aborted || records.get(record.id) !== record) fail('generated_speech_stream_cancelled', 499);
  };
  relay = attach(server, {
      workerSecret, allowedOrigins: [origin], maxAudioSeconds: 25, allowClientPCM: false, movingSpeechRoutes,
    ...(configuration.session ? { maxWorkers: 1, maxSessions: 1 } : {}),
    onFirstMedia(identity) {
      const record = records.get(identity.sessionId);
      if (record?.streamStartedAt) mark(record, 'worker_first_media_ms', Math.round(performance.now() - record.streamStartedAt));
    },
    onTransport(identity, ms) {
      const record = records.get(identity.sessionId);
      if (record) mark(record, 'server_transport_enqueue_ms', ms);
    },
    onMedia(identity,bytes) { collect(records.get(identity.sessionId),'video',bytes); },
    onComplete(identity,message) { finishLibrary(records.get(identity.sessionId),message); },
    onWorkerIdle(workerId) { sessionManager?.activity?.(workerId); },
    authenticateWorker(req, workerId) {
      if (configuration.session && typeof sessionManager?.authorizeWorker === 'function') return sessionManager.authorizeWorker(req.headers, workerId);
      // Existing non-journal/local streaming accepts only the legacy avatar.
      // Profile-bound workers require the journal manager's exact expectation.
      return acceptsWorkerBinding(null, req.headers);
    },
    async authenticateClient(req) {
      const claims = authenticateTicket(req);
      if (!claims) return null;
      const record = records.get(claims.sessionId);
      if (!record || record.state !== 'prepared' || Date.now() > record.descriptor.expiresAt || claims.userId !== digest(record.input.owner)) return null;
      try {
        if (await resolveOwner(req, record.input.playerId) !== record.input.owner) return null;
        await fresh(record);
        return { ...claims, ...(record.workerId ? {workerId:record.workerId} : {}) };
      } catch { cancel(record); return null; }
    },
    async onSessionReady(identity) {
      const record = records.get(identity.sessionId);
      if (!record || record.state !== 'prepared' || identity.userId !== digest(record.input.owner)) throw Error('Stale speech request');
      record.state = 'streaming';
      record.streamStartedAt = performance.now();
      clearTimeout(record.deadline);
      record.deadline = setTimeout(() => cancel(record), streamLifetimeMs); record.deadline.unref?.();
      record.wireSignal = identity.signal;
      record.wireAbort = () => cancel(record);
      identity.signal.addEventListener('abort', record.wireAbort, { once: true });
      if (identity.signal.aborted) { record.wireAbort(); return; }
      try {
        unpaidTrace('fresh_before');
        await fresh(record);
        unpaidTrace('fresh_after');
        if (identity.signal.aborted) return;
        record.handle = relay.openSource({ ...identity, rate: 24000 });
        unpaidTrace('source_opened');
        record.monitor = setInterval(() => {
          if (record.checking) return;
          record.checking = true;
          fresh(record).catch(() => cancel(record)).finally(() => { record.checking = false; });
        }, freshnessIntervalMs); record.monitor.unref?.();
        const signal = AbortSignal.any([identity.signal, record.controller.signal]);
        const ttsStartedAt = performance.now();
        let firstAudio = true;
        unpaidTrace('tts_source_before');
        if (journal && !record.submissionMarked) {
          await track((async () => journal.markRequestSubmissionStarted({ key:record.journalClaim.key, lease:await ownership.get() }))());
          record.submissionMarked = true;
          await fresh(record);
        }
        const audio = record.audioPrefetch ? record.audioPrefetch.read() : (record.runtime?.source ?? source)({ text: record.input.text, signal, beforeCostly: async () => {
          await fresh(record); if (ownership) await ownership.get(); await fresh(record);
        } });
        for await (const pcm of audio) {
          await fresh(record);
          if (firstAudio) {
            firstAudio = false;
            mark(record, 'tts_first_audio_ms', Math.round(performance.now() - ttsStartedAt));
          }
          collect(record,'audio',pcm);
          await record.handle.writePCM(pcm);
          unpaidTrace('pcm_written');
        }
        mark(record, 'tts_complete_ms', Math.round(performance.now() - ttsStartedAt));
        await fresh(record); record.ttsComplete = true; record.handle.end();
        if (journal) {
          await track((async () => journal.completeRequest({ key:record.journalClaim.key, lease:await ownership.get() }))());
          record.journalSettled = true;
        }
        // Keep freshness monitoring through the final encoded fragment, even
        // after the HTTP TTS response has ended. Wire terminal ack owns cleanup.
      } catch { unpaidTrace('source_error'); cancel(record); throw Error('Speech source unavailable'); }
    },
  });
  sessionManager = suppliedSessionManager ?? (configuration.session ? createSpeechSessionManager({
    ...configuration.session, directory, workerSecret, origin,
  }, { workerState: id => id ? relay.workerStatus(id) : relay.status(), stopWorker: id => relay.stopWorker(id), fetchImpl, journal, journalRequired, leaseManager:ownership }) : null);
  async function reserve(input, key, fingerprint) {
    if (journal) {
      const identity = { ownerHash:digest(input.owner), requestId:input.requestId, fingerprint, capability:'stream' };
      if (await journal.findRequest(identity)) fail('generated_speech_request_already_attempted', 409);
      const lease = await ownership.get({ recover:true });
      if (lease.recoveryOnly) {
        if (sessionManager) await sessionManager.ensure({ signal:input.signal, beforeCostly:input.beforeCostly });
        fail('generated_speech_recovery_required', 409);
      }
      const claim = await journal.claimRequest({ ...identity, lease });
      if (claim.status !== 'new') fail('generated_speech_request_already_attempted', 409);
      return claim;
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || !equalPath(await realpath(directory), resolve(directory))) fail('generated_speech_stream_invalid_directory');
    const reservations = (await readdir(directory)).filter(name => /^(?:stream-)?[a-f0-9]{64}\.request\.json$/.test(name));
    if (reservations.length >= 1024) fail('generated_speech_stream_ledger_full');
    // Recognize early experimental reservations, then use the exact full-file
    // service key so capability changes cannot pay twice for one request.
    try { await lstat(join(directory, `stream-${key}.request.json`)); fail('generated_speech_request_already_attempted', 409); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    let file;
    try { file = await open(join(directory, `${key}.request.json`), 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') fail('generated_speech_request_already_attempted', 409); throw error; }
    try { await file.writeFile(JSON.stringify({ fingerprint, ownerHash: digest(input.owner), state: 'reserved', createdAt: Date.now() })); await file.sync(); }
    finally { await file.close(); }
  }
  return {
    status: () => ({ enabled: true, ...relay.status(), pending: records.size + inFlight.size }),
    prewarm({dealerId,beforeCostly,signal} = {}) {
      if (!dealerRuntime) return Promise.resolve(false);
      const work = Promise.resolve().then(() => dealerRuntime.prepare({dealerId,beforeCostly,signal})).then(() => true, () => false);
      track(work); return work;
    },
    acquireExclusive(owner) {
      if (typeof owner !== 'string' || !owner || owner.length > 512) fail('invalid_generated_speech_stream_request', 400);
      if (exclusive || records.size || preparations.size || inFlight.size || relay.status().busy > 0) fail('generated_speech_stream_busy', 429);
      const lease = { owner, releasing: false };
      exclusive = lease;
      return () => { if (exclusive === lease) releaseOwner(owner); };
    },
    async prepare(input) {
      if (serviceClosing) fail('generated_speech_stream_cancelled', 499);
      if (!input || !identifier(input.requestId) || (input.dealerId !== 'astrid' && (!dealerRuntime || !/^[a-z][a-z0-9-]{0,63}$/.test(input.dealerId ?? ''))) || typeof input.owner !== 'string' || !input.owner || input.owner.length > 512
        || typeof input.text !== 'string' || !input.text.trim() || input.text !== input.text.trim() || input.text.length > 500
        || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(input.text) || typeof input.beforeCostly !== 'function') fail('invalid_generated_speech_stream_request', 400);
      if (exclusive && (exclusive.owner !== input.owner || exclusive.releasing)) fail('generated_speech_stream_busy', 429);
      if (!preparations.has(input.owner) && !owners.has(input.owner) && records.size + preparations.size >= 32) fail('generated_speech_stream_busy', 429);
      const preparation = { playerId: input.playerId, owner: input.owner };
      let settled;
      preparation.done = new Promise(resolve => { settled = resolve; });
      preparations.set(input.owner, preparation);
      inFlight.add(preparation);
      const current = () => { input.signal?.throwIfAborted(); if (preparations.get(input.owner) !== preparation) fail('generated_speech_stream_cancelled', 499); };
      let prefetchAbort = null, published = false;
      try {
      current(); await input.beforeCostly(); current();
      const runtime = input.dealerId === 'astrid' ? null : await dealerRuntime.prepare(input);
      current();
      if (runtime && !sessionManager?.supportsAvatars) fail('generated_speech_profiles_not_configured');
      const key = digest(`${digest(input.owner)}\0${input.requestId}`), fingerprint = digest(JSON.stringify(runtime
        ? [input.text,input.dealerId,runtime.profileRevision,runtime.imageSha256] : [input.text, configuration.voiceId, configuration.modelId]));
      // Never silently fall back to a paid full-file job on unavailable capacity.
      if (!sessionManager && !relay.status().available) fail('generated_speech_stream_worker_unavailable', 503);
      if (records.size >= 32) fail('generated_speech_stream_busy', 429);
      if (owners.has(input.owner)) cancel(owners.get(input.owner));
      preparation.journalClaim = await reserve(input, key, fingerprint);
      current(); await input.beforeCostly(); current();
      let workerId, audioPrefetch = null;
      const beginAudio = async () => {
        if (audioPrefetch || prefetchAbort) return;
        prefetchAbort = new AbortController();
        preparation.stopPrefetch = () => prefetchAbort.abort();
        current();
        if (journal && !preparation.submissionMarked) {
          await track((async () => journal.markRequestSubmissionStarted({ key:preparation.journalClaim.key, lease:await ownership.get() }))());
          preparation.submissionMarked = true;
          current();
        }
        if (prefetchAbort.signal.aborted) fail('generated_speech_stream_cancelled', 499);
        const prefetchSignal = input.signal ? AbortSignal.any([input.signal, prefetchAbort.signal]) : prefetchAbort.signal;
        audioPrefetch = startAudioPrefetch(() => (runtime?.source ?? source)({ text: input.text, signal: prefetchSignal, beforeCostly: async () => {
          current(); await input.beforeCostly(); await runtime?.assertFresh(); current();
        } }), prefetchSignal);
      };
      if (sessionManager) {
        const ready = await sessionManager.ensure({ signal: input.signal, ...(runtime ? {avatar:runtime.avatar} : {}), beforeCostly: async () => { current(); await input.beforeCostly(); await runtime?.assertFresh(); current(); }, ...(configuration.overlapAudio === true ? { onSubmitted: beginAudio } : {}) });
        workerId = ready?.workerId;
        if (runtime && (!workerId || ready.binding?.dealerId !== input.dealerId || ready.binding?.profileRevision !== runtime.profileRevision || ready.binding?.imageSha256 !== runtime.imageSha256 || ready.binding?.protocolVersion !== 3)) fail('generated_speech_worker_binding_mismatch');
        current(); await input.beforeCostly(); current();
        if (!relay.status().available) fail('generated_speech_stream_worker_unavailable', 503);
      }
      if (audioPrefetch?.error) throw audioPrefetch.error;
      const id = randomBytes(16).toString('hex'), controller = new AbortController(), issuedAt = Date.now(), expiresAt = issuedAt + ticketLifetimeMs;
      const descriptor = { schemaVersion: runtime ? 2 : 1, kind: 'generated-speech-stream', id, requestId: input.requestId, dealerId: input.dealerId, exactText: input.text,
        textSha256: digest(input.text), reviewStatus: 'pending', url: '/speech-stream',
        ticket: issueTicket(ticketSecret, { userId: digest(input.owner), sessionId: id, ttlSeconds: ticketLifetimeMs / 1000 }, issuedAt), expiresAt,
        ...(runtime ? {profileRevision:runtime.profileRevision,imageSha256:runtime.imageSha256,compositing:runtime.compositing} : {}) };
      const record = { id, descriptor, input, controller, runtime, workerId, state: 'prepared', journalClaim:preparation.journalClaim, submissionMarked:preparation.submissionMarked === true, audioPrefetch, stopPrefetch: prefetchAbort ? () => prefetchAbort.abort() : null, libraryChunks:{audio:[],video:[]}, libraryBytes:{audio:0,video:0} };
      records.set(id, record); owners.set(input.owner, record); published = true;
      record.externalAbort = () => cancel(record);
      input.signal?.addEventListener('abort', record.externalAbort, { once: true });
      record.deadline = setTimeout(() => cancel(record), ticketLifetimeMs); record.deadline.unref?.();
      return descriptor;
      } catch (error) {
        if (!published) prefetchAbort?.abort();
        if (journal && preparation.journalClaim && !published) {
          try { await journal.failRequest({ key:preparation.journalClaim.key, lease:await ownership.get(), safeCode:'generated_speech_stream_failed' }); } catch {}
        }
        releaseOwner(input.owner);
        if (/^(?:generated_speech_|invalid_generated_speech_)/.test(error?.code || '') || /^(?:stale_chat_|chat_cancelled)/.test(error?.message || '')) throw error;
        if (input.signal?.aborted) fail('generated_speech_stream_cancelled', 499);
        fail('generated_speech_stream_failed');
      } finally {
        if (preparations.get(input.owner) === preparation) preparations.delete(input.owner);
        inFlight.delete(preparation); settleExclusive();
        settled();
      }
    },
    cancelOwner(owner) { preparations.get(owner)?.stopPrefetch?.(); preparations.delete(owner); const record = owners.get(owner); if (record) cancel(record); releaseOwner(owner); },
    cancelPlayer(playerId) { for (const [owner, preparation] of preparations) if (preparation.playerId === playerId) { preparation.stopPrefetch?.(); preparations.delete(owner); releaseOwner(owner); } for (const record of records.values()) if (record.input.playerId === playerId) cancel(record); },
    close(options) {
      if (closePromise) return closePromise;
      serviceClosing = true;
      const preparing = [...inFlight].map(preparation => preparation.done);
      for (const preparation of preparations.values()) preparation.stopPrefetch?.();
      preparations.clear(); for (const record of [...records.values()]) cancel(record);
      // Provider retirement and cancelled-request journal flushing share the
      // same runtime window. Do not delay worker cleanup behind a SQL wait.
      const managerClose = sessionManager?.close(options);
      closePromise = (async () => {
        try {
          const flushRequests = (async () => {
            await Promise.all(preparing);
            let failed = false;
            while (journalTasks.size) {
              const outcomes = await Promise.allSettled([...journalTasks]);
              failed ||= outcomes.some(outcome => outcome.status === 'rejected');
            }
            if (failed) fail('generated_speech_stream_shutdown_incomplete');
          })();
          const outcomes = await Promise.allSettled([flushRequests, managerClose]);
          if (outcomes.some(outcome => outcome.status === 'rejected')) fail('generated_speech_stream_shutdown_incomplete');
        } finally {
          relay.close();
          if (ownership && !options?.signal?.aborted) { try { await ownership.release(); } catch {} }
        }
      })();
      return closePromise;
    },
  };
}
