import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { GPU_RESERVATION_WINDOW_MS } from './speech-journal-constants.mjs';
import { SHUTDOWN_BUDGET } from './graceful-shutdown.mjs';
import { avatarBinding, sameBinding, acceptsWorkerBinding } from '../services/astrid-gpu-worker/gateway/worker-binding.mjs';

const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
const jobId = /^[A-Za-z0-9_-]{1,128}$/;
const fail = (code, statusCode = 503) => { throw Object.assign(new Error(code), { code, statusCode }); };
export function requireSpeechJournal(journal) {
  if (!journal || ['findRequest', 'acquireLease', 'renewLease', 'releaseLease', 'claimRequest',
    'getCompletedPackageById',
    'markRequestSubmissionStarted', 'completeRequest', 'failRequest', 'getBudgetPolicy',
    'listRecoverableSessions', 'reserveSession', 'markSubmissionStarted', 'attachJob',
    'markSubmissionUncertain', 'requestCancel', 'recordProviderStatus', 'confirmWorkerDrained',
    'retireExpiredMissingSession'].some(name => typeof journal[name] !== 'function')) fail('generated_speech_journal_unavailable');
  return journal;
}

// A lease is acquired on explicit demand, never at construction. An expired
// fence cannot become a new paid owner implicitly. Only known GPU recovery is
// allowed to adopt an expired lease, and that lease cannot submit paid work.
export function createSpeechJournalLease({ journal, resource, holderId = `speech-${randomUUID()}` }) {
  requireSpeechJournal(journal);
  let lease = null, pending = null;
  return Object.freeze({
    get({ recover = false } = {}) {
      if (pending) return pending;
      pending = (async () => {
        if (lease) lease = await journal.renewLease({ lease, ttlMs: GPU_RESERVATION_WINDOW_MS });
        else {
          try { lease = await journal.acquireLease({ resource, holderId, ttlMs: GPU_RESERVATION_WINDOW_MS }); }
          catch (error) {
            if (!recover || resource !== 'stream-session' || error.code !== 'generated_speech_recovery_required') throw error;
            lease = await journal.acquireLease({ resource, holderId, ttlMs: GPU_RESERVATION_WINDOW_MS, recoveryOnly: true });
          }
        }
        return lease;
      })().finally(() => { pending = null; });
      return pending;
    },
    async release() {
      if (pending) await pending;
      if (lease) { await journal.releaseLease({ lease }); lease = null; }
    },
    current: () => lease,
  });
}

// The legacy provider protocol is preserved. Only durable ownership, request
// idempotence, cost policy, reservations and terminal receipts move to SQL.
// No disk inspection, budget seed, refund, provider retry or queue purge.
export function createJournalSpeechSessionManager(configuration, {
  journal, leaseManager, workerState, stopWorker = () => {}, fetchImpl = fetch, now = Date.now,
  sleep = (ms, signal) => pause(ms, undefined, { signal }), readyTimeoutMs = 90000,
  pollMs = 500, idleTimeoutMs = 60000, policy, reserveMicroUsd, dailyBudgetMicroUsd,
}) {
  requireSpeechJournal(journal);
  const ownership = leaseManager ?? createSpeechJournalLease({ journal, resource: 'stream-session' });
  const { apiKey, endpointId, workerSecret, origin } = configuration;
  const originUrl = new URL(origin), base = `https://api.runpod.ai/v2/${endpointId}`;
  const shutdown = new AbortController();
  const cleanupAbort = new AbortController();
  let pending = null, active = null, idleTimer = null, closing = false;
  let closePromise;
  const lifecycleTasks = new Map();
  const bindings = new Map();
  let pendingBinding;

  async function call(route, { signal, body } = {}) {
    const response = await fetchImpl(`${base}/${route}`, { method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { authorization: `Bearer ${apiKey}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.any([cleanupAbort.signal, ...(signal ? [signal] : []), AbortSignal.timeout(SHUTDOWN_BUDGET.providerRequestMs)]) });
    if (!response.ok) {
      await response.body?.cancel();
      fail(`generated_speech_session_provider_${({ 401:'unauthorized', 403:'forbidden', 404:'not_found', 429:'rate_limited' })[response.status] ?? 'http_failed'}`);
    }
    if (Number(response.headers.get('content-length') || 0) > 8192) { await response.body?.cancel(); fail('generated_speech_session_provider_response_too_large'); }
    const reader = response.body?.getReader();
    if (!reader) fail('generated_speech_session_provider_empty');
    const chunks = []; let size = 0;
    try {
      for (;;) { const next = await reader.read(); if (next.done) break;
        size += next.value.byteLength;
        if (size > 8192) { await reader.cancel(); fail('generated_speech_session_provider_response_too_large'); }
        chunks.push(Buffer.from(next.value));
      }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { fail('generated_speech_session_provider_invalid_json'); }
    } finally { reader.releaseLock(); }
  }
  const proof = job => ({ workerId: job.workerId, ...workerState(job.workerId) });
  async function inspect(job, signal) {
    let response;
    try { response = await call(`status/${job.jobId}`, { signal }); }
    catch (error) {
      if (error.code === 'generated_speech_session_provider_not_found') {
        const observed = proof(job);
        if (observed.workers === 0 && observed.busy === 0 && observed.available === 0) {
          // DB time validates expiry. Even a valid retirement fails this turn;
          // a replacement still needs a later explicit admission.
          const lease = await ownership.get();
          Object.assign(job, await journal.retireExpiredMissingSession({ sessionId: job.sessionId, lease, jobId: job.jobId, providerStatus: 'not_found', proof: observed }));
          if (lease.recoveryOnly) await ownership.release();
        }
      }
      throw error;
    }
    if (response?.id !== job.jobId) fail('generated_speech_session_provider_job_mismatch');
    if (!['IN_QUEUE', 'IN_PROGRESS', ...terminal].includes(response.status)) fail('generated_speech_session_provider_invalid_status');
    const saved = await journal.recordProviderStatus({ sessionId: job.sessionId, lease: await ownership.get(), jobId: job.jobId, status: response.status });
    Object.assign(job, saved); return response.status;
  }
  function lifecycle(job, operation) {
    if (!job?.jobId) return Promise.resolve();
    if (lifecycleTasks.has(job.jobId)) return lifecycleTasks.get(job.jobId);
    const task = operation(job);
    lifecycleTasks.set(job.jobId, task);
    void task.finally(() => lifecycleTasks.delete(job.jobId)).catch(() => {});
    return task;
  }
  const cancel = job => lifecycle(job, cancelOnce);
  const retire = job => lifecycle(job, retireOnce);
  async function cancelOnce(job) {
    if (!job?.jobId) return;
    if (active?.sessionId === job.sessionId) { active = null; clearTimeout(idleTimer); }
    try {
      Object.assign(job, await journal.requestCancel({ sessionId: job.sessionId, lease: await ownership.get(), jobId: job.jobId }));
      if (terminal.has(job.terminalStatus)) {
        const observed = proof(job);
        if (observed.workers === 0 && observed.busy === 0 && observed.available === 0) {
          Object.assign(job, await journal.confirmWorkerDrained({ sessionId: job.sessionId, lease: await ownership.get(), proof: observed }));
          return;
        }
      }
      stopWorker(job.workerId);
      const started = now(), deadlineMs = SHUTDOWN_BUDGET.providerRequestMs;
      const signal = AbortSignal.timeout(deadlineMs);
      if (!terminal.has(job.terminalStatus)) {
        const response = await call(`cancel/${job.jobId}`, { body: {}, signal });
        if (response?.id === job.jobId && terminal.has(response.status)) {
          Object.assign(job, await journal.recordProviderStatus({ sessionId: job.sessionId, lease: await ownership.get(), jobId: job.jobId, status: response.status }));
        }
      }
      // A terminal provider response alone does not prove the worker socket
      // drained. Poll this same job within the remaining cancellation window.
      for (;;) {
        const observed = proof(job);
        if (terminal.has(job.terminalStatus) && observed.workers === 0 && observed.busy === 0 && observed.available === 0) {
          Object.assign(job, await journal.confirmWorkerDrained({ sessionId: job.sessionId, lease: await ownership.get(), proof: observed })); return;
        }
        if (cleanupAbort.signal.aborted || signal.aborted || now() - started >= deadlineMs) return;
        await sleep(Math.min(pollMs, deadlineMs - (now() - started)), AbortSignal.any([signal, cleanupAbort.signal]));
        if (!terminal.has(job.terminalStatus)) await inspect(job, signal);
      }
    } catch { /* Known job/lease/reservation remain recoverable; no refund. */ }
  }
  async function retireOnce(job) {
    if (!job?.jobId) return;
    if (active?.sessionId === job.sessionId) { active = null; clearTimeout(idleTimer); }
    // A normal idle/shutdown path lets the exact reverse worker return from its
    // RunPod handler. Keep the SQL session open and fall back to cancellation
    // only when that bounded, same-job observation fails.
    const started = now(), deadlineMs = Math.min(readyTimeoutMs, SHUTDOWN_BUDGET.naturalWorkerMs);
    const signal = AbortSignal.timeout(deadlineMs);
    let stopRequested = false;
    try {
      for (;;) {
        const before = proof(job);
        if (!stopRequested && before.busy === 0) stopRequested = stopWorker(job.workerId);
        const status = job.terminalStatus ?? await inspect(job, signal);
        const observed = proof(job);
        if (terminal.has(status) && observed.workers === 0 && observed.busy === 0 && observed.available === 0) {
          Object.assign(job, await journal.confirmWorkerDrained({ sessionId: job.sessionId, lease: await ownership.get(), proof: observed }));
          return;
        }
        if (signal.aborted || cleanupAbort.signal.aborted || now() - started >= deadlineMs) break;
        await sleep(Math.min(pollMs, deadlineMs - (now() - started)), AbortSignal.any([signal, cleanupAbort.signal]));
      }
    } catch { /* A bounded graceful stop falls back to exact known-job cancellation. */ }
    await cancelOnce(job);
  }
  async function waitUntilStopped(job, signal, fresh) {
    const started = now();
    for (;;) {
      await fresh();
      const status = job.terminalStatus ?? await inspect(job, signal);
      const observed = proof(job);
      if (terminal.has(status) && observed.workers === 0 && observed.busy === 0 && observed.available === 0) {
        await journal.confirmWorkerDrained({ sessionId: job.sessionId, lease: await ownership.get(), proof: observed }); return;
      }
      if (now() - started >= readyTimeoutMs) fail('generated_speech_session_stop_timeout', 504);
      await sleep(pollMs, signal);
    }
  }
  function touch() {
    if (!active || closing) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (workerState().busy > 0) { touch(); return; }
      const job = active; active = null; void retire(job);
    }, idleTimeoutMs); idleTimer.unref?.();
  }
  async function ensure(input) {
    const binding = avatarBinding(input.avatar);
    const signal = input.signal ? AbortSignal.any([input.signal, shutdown.signal]) : shutdown.signal;
    const fresh = async () => { signal.throwIfAborted(); await input.beforeCostly(); signal.throwIfAborted(); };
    let job;
    try {
      await fresh(); clearTimeout(idleTimer); idleTimer = null;
      if (lifecycleTasks.size) fail('generated_speech_session_stopping', 429);
      let lease = await ownership.get({ recover: true });
      await journal.getBudgetPolicy({ currentBudgetMicroUsd: dailyBudgetMicroUsd });
      const open = await journal.listRecoverableSessions();
      if (open.length > 1) fail('generated_speech_journal_invalid', 409);
      if (open.length) {
        job = open[0];
        if (job.endpointId !== endpointId || !jobId.test(job.jobId ?? '')) fail('generated_speech_session_submission_uncertain', 409);
        const status = job.terminalStatus ?? await inspect(job, signal);
        const unknownBinding = !bindings.has(job.workerId);
        if (lease.recoveryOnly || !sameBinding(bindings.get(job.workerId), binding) || terminal.has(status) || job.cancelRequestedAt !== null
          || now() + policy.admissionWindowMs >= job.createdAt + policy.seconds * 1000) {
          if (workerState(job.workerId).busy > 0) fail('generated_speech_stream_busy', 429);
          if (!terminal.has(status)) {
            if (job.cancelRequestedAt !== null) await cancel(job); else await retire(job);
          } else stopWorker(job.workerId);
          await waitUntilStopped(job, signal, fresh); job = null;
          if (lease.recoveryOnly) { await ownership.release(); fail('generated_speech_recovery_required', 409); }
          if (unknownBinding && !terminal.has(status)) fail('generated_speech_recovery_required', 409);
        }
      }
      if (!job) {
        const state = workerState();
        if (state.workers || state.busy || state.available) fail('generated_speech_session_untracked_worker');
        await fresh(); lease = await ownership.get();
        const sessionId = randomBytes(16).toString('hex');
        job = await journal.reserveSession({ sessionId, endpointId, lease, reserveMicroUsd,
          currentBudgetMicroUsd: dailyBudgetMicroUsd, workerState: state });
        await fresh(); lease = await ownership.get();
        await journal.markSubmissionStarted({ sessionId, lease });
        bindings.clear(); bindings.set(job.workerId, binding);
        try {
          // There is one paid POST. Lost HTTP or SQL acknowledgement preserves
          // the submitted marker and cannot authorize a replacement attempt.
          const response = await call('run', { signal, body: {
            input: { op:'session', ws_url:`wss://${originUrl.host}/lipsync-worker`, ws_token:workerSecret,
              worker_id:job.workerId, ttl:policy.seconds, ...(input.avatar ? {avatar:input.avatar} : {}) },
            policy: { executionTimeout:policy.executionTimeout, ttl:policy.ttl } } });
          if (!jobId.test(response?.id ?? '')) fail('generated_speech_session_submission_uncertain', 409);
          job = await journal.attachJob({ sessionId, lease: await ownership.get(), jobId: response.id });
        } catch (error) {
          try { await journal.markSubmissionUncertain({ sessionId, lease: await ownership.get() }); } catch {}
          throw error;
        }
      }
      const started = now();
      while (!workerState(job.workerId).available) {
        await fresh();
        if (workerState(job.workerId).busy > 0) fail('generated_speech_stream_busy', 429);
        if (now() - started >= readyTimeoutMs) fail('generated_speech_session_start_timeout', 504);
        if (terminal.has(await inspect(job, signal))) fail('generated_speech_session_worker_failed');
        await sleep(pollMs, signal);
      }
      await fresh(); active = job; touch(); return { ready:true, workerId:job.workerId, binding };
    } catch (error) {
      if (job?.jobId && job.releasedAt === null && !['generated_speech_stream_busy', 'generated_speech_recovery_required'].includes(error.code)) await cancel(job);
      if (signal.aborted) fail('generated_speech_session_cancelled', 499);
      if (/^generated_speech_[a-z_]+$/.test(error?.code ?? '')) throw error;
      fail('generated_speech_session_unavailable');
    }
  }
  return Object.freeze({
    authorizeWorker(headers, workerId) { return acceptsWorkerBinding(bindings.get(workerId), headers); },
    supportsAvatars:true,
    activity(workerId) { if (active?.workerId === workerId && !pending && !closing) touch(); },
    ensure(input) {
      if (closing || typeof input?.beforeCostly !== 'function') return Promise.reject(Object.assign(new Error('generated_speech_session_cancelled'), { code:'generated_speech_session_cancelled', statusCode:499 }));
      let binding; try { binding = avatarBinding(input.avatar); } catch { return Promise.reject(Error('generated_speech_session_avatar_invalid')); }
      if (pending && !sameBinding(pendingBinding, binding)) return Promise.reject(Object.assign(Error('generated_speech_stream_busy'), {code:'generated_speech_stream_busy',statusCode:429}));
      if (pending) return pending.then(async result => { input.signal?.throwIfAborted(); await input.beforeCostly(); touch(); return result; });
      pendingBinding = binding;
      pending = ensure(input).finally(() => { pending = null; if (active && !closing) touch(); }); return pending;
    },
    close({ signal = AbortSignal.timeout(SHUTDOWN_BUDGET.runtimeMs) } = {}) {
      if (closePromise) return closePromise;
      closing = true; clearTimeout(idleTimer); shutdown.abort();
      const abortCleanup = () => cleanupAbort.abort();
      signal.addEventListener('abort', abortCleanup, { once: true });
      if (signal.aborted) abortCleanup();
      closePromise = (async () => {
        if (pending) { try { await pending; } catch {} }
        const job = active;
        await retire(job);
        while (lifecycleTasks.size) await Promise.all([...lifecycleTasks.values()]);
        active = null;
        // Do not invent terminal status or release a failed/unknown session.
        if (cleanupAbort.signal.aborted || job && job.releasedAt === null
          || (await journal.listRecoverableSessions()).length) fail('generated_speech_session_shutdown_incomplete');
        // The stream service owns a supplied fence until its request writes
        // finish. Standalone session managers release their own lease here.
        if (!leaseManager) { try { await ownership.release(); } catch {} }
      })().finally(() => signal.removeEventListener('abort', abortCleanup));
      return closePromise;
    },
  });
}
