import { MOVING_BUDGET_MAX_MICRO_USD } from './moving-speech-budget.mjs';
import { MOVING_SPEECH_LIMITS } from './moving-speech-limits.mjs';
import { GPU_RESERVATION_WINDOW_MS } from '../../packages/presentation/contracts/speech-journal-constants.mjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { createSpeechJournalLease } from '../../packages/presentation/server/speech-journal-lease.mjs';
import { createMovingSpeechConnection, verifyMovingWorkerRelease } from './moving-speech-transport.mjs';
import { verifyMovingSpeechBinding } from './moving-speech-binding.mjs';
import { verifyMovingCapacity } from './moving-speech-capacity.mjs';

const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
const jobPattern = /^[A-Za-z0-9_-]{1,128}$/;
const fail = (code, statusCode = 409) => { throw Object.assign(Error(code), { code, statusCode }); };
const positive = (n, max) => Number.isSafeInteger(n) && n > 0 && n <= max;
function bounded(work, signal, ms, code) {
  const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(ms)]);
  return new Promise((resolve, reject) => {
    const abort = () => reject(Object.assign(Error(code), { code, statusCode: 503 }));
    deadline.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      if (deadline.aborted) return abort();
      return work(deadline);
    }).then(resolve, reject).finally(() => deadline.removeEventListener('abort', abort));
    if (deadline.aborted) abort();
  });
}

/** Server-only, one utterance per admitted job. Provider adapter returns
 * submit -> {id}, status -> {status}; it must honor the supplied AbortSignal,
 * never retry a POST; execution stays <=180 seconds, total job TTL <=540 seconds.
 * reserveMicroUsd covers cold start, bank transfer, inference, voice and drain.
 * budgetId is a stable operator mandate ID, never a per-request/browser value.
 * No policy bootstrap, provider call, timer or acquisition at construction.
 */
export function createMovingSpeechSession({ journal, scope, origin, endpointId, release, provider,
  budgetId, totalBudgetMicroUsd, initialBudgetMicroUsd = totalBudgetMicroUsd, reserveMicroUsd, currentDailyBudgetMicroUsd, holderId,
  workerState, lifetimeMs = MOVING_SPEECH_LIMITS.lifetimeMs,
  startupMs = Math.min(MOVING_SPEECH_LIMITS.startupMs, lifetimeMs), idleMs = 15000,
  cleanupMs = 15000, pollMs = 500, connectionFactory = createMovingSpeechConnection } = {}) {
  if (!journal || ['reserveMovingSession', 'assertMovingSession', 'listMovingSessions'].some(name => typeof journal[name] !== 'function')
    || !provider || ['submit', 'cancel', 'status'].some(name => typeof provider[name] !== 'function')
    || typeof release !== 'function' || typeof workerState !== 'function'
    || !positive(totalBudgetMicroUsd, MOVING_BUDGET_MAX_MICRO_USD) || !positive(reserveMicroUsd, Math.min(totalBudgetMicroUsd,5000000))
    || !positive(initialBudgetMicroUsd, totalBudgetMicroUsd)
    || !positive(currentDailyBudgetMicroUsd, 20000000) || !positive(lifetimeMs, MOVING_SPEECH_LIMITS.lifetimeMs)
    || !positive(startupMs, Math.min(MOVING_SPEECH_LIMITS.startupMs, lifetimeMs))
    || !positive(idleMs, 15000) || !positive(cleanupMs, 30000) || !positive(pollMs, 1000)) fail('invalid_generated_speech_moving_configuration', 422);
  const ownership = createSpeechJournalLease({ journal, resource: 'stream-session', holderId });
  let active = null;

  return Object.freeze({
    // Explicit recovery only. Never submits/replays a paid request, refunds a
    // reservation, guesses a job ID or touches an Astrid/foreign-scope session.
    async reconcile() {
      if (active) fail('generated_speech_session_busy', 429);
      const operation = {}; active = operation;
      const recovered = [], unresolved = [];
      try {
        for (const saved of await journal.listMovingSessions({ scope })) {
          if (!saved.jobId || saved.endpointId !== endpointId) {
            unresolved.push({ sessionId: saved.sessionId, reason: !saved.jobId ? 'submission_unresolved' : 'endpoint_changed' }); continue;
          }
          const lease = await ownership.get({ recover: true });
          let status;
          try {
            status = (await bounded(s => provider.status({ jobId: saved.jobId, signal: s }), undefined, cleanupMs, 'generated_speech_moving_status_unknown'))?.status;
            if (!terminal.has(status)) {
              await journal.requestCancel({ sessionId: saved.sessionId, jobId: saved.jobId, lease });
              await bounded(s => provider.cancel({ jobId: saved.jobId, signal: s }), undefined, cleanupMs, 'generated_speech_moving_cancel_unknown');
              status = (await bounded(s => provider.status({ jobId: saved.jobId, signal: s }), undefined, cleanupMs, 'generated_speech_moving_status_unknown'))?.status;
            }
            if (!terminal.has(status)) { unresolved.push({ sessionId: saved.sessionId, reason: 'provider_not_terminal' }); continue; }
            const empty = await bounded(s => workerState({ signal: s }), undefined, cleanupMs, 'generated_speech_moving_drain_unknown');
            if (empty?.workers !== 0 || empty.busy !== 0 || empty.available !== 0) { unresolved.push({ sessionId: saved.sessionId, reason: 'worker_not_drained' }); continue; }
            await journal.recordProviderStatus({ sessionId: saved.sessionId, jobId: saved.jobId, lease, status });
            await journal.confirmWorkerDrained({ sessionId: saved.sessionId, lease, proof: { workerId: saved.workerId, ...empty } });
            await ownership.release(); recovered.push(saved.sessionId);
          } catch { unresolved.push({ sessionId: saved.sessionId, reason: 'recovery_unverified' }); }
        }
        return { recovered, unresolved };
      } finally { if (active === operation) active = null; }
    },
    async admit({ ownerHash, userId, requestId, fingerprint, binding: sourceBinding, mediaReferences,
      projectRevision, beforeCostly, signal, bankDownload } = {}) {
      if (active) fail('generated_speech_session_busy', 429);
      if (typeof beforeCostly !== 'function' || typeof userId !== 'string' || !userId || userId.length > 128
        || (signal !== undefined && !(signal instanceof AbortSignal))) fail('invalid_generated_speech_moving_admission', 422);
      const binding = verifyMovingSpeechBinding({ ...sourceBinding, schemaVersion: 1,
        sessionId: randomBytes(16).toString('hex'), attemptId: randomUUID(), nonce: randomBytes(32).toString('hex') });
      const operation = {}; active = operation;
      let session, connection, submission, acceptedJob, observedJob, finalized, readiness, admittedCapacity;
      const life = new AbortController();
      const requestSignal = AbortSignal.any([life.signal, ...(signal ? [signal] : [])]);
      const admittedAtMs = Date.now(), expiresAtMs = admittedAtMs + lifetimeMs;
      // Even a lost submit reply plus the provider TTL must fit the original
      // reservation's UTC coverage. A delayed caller cannot buy a later window.
      const assertSubmissionWindow = () => {
        if (Date.now() + idleMs + MOVING_SPEECH_LIMITS.jobTtlMs + MOVING_SPEECH_LIMITS.providerIdleMs > admittedAtMs + GPU_RESERVATION_WINDOW_MS)
          fail('generated_speech_moving_submission_expired');
      };
      const timer = setTimeout(() => life.abort(), lifetimeMs); timer.unref?.();
      const currentLease = () => ownership.get();
      async function observeCapacity(receipt, signal) {
        const state=await workerState({signal});
        if (!receipt.capacity) return {state}; // Legacy callers must still prove zero workers.
        const proof={schemaVersion:1,observedAtMs:Date.now(),release:receipt,health:state?.raw};
        const verified=verifyMovingCapacity(proof,{endpointId});
        return {state,proof,verified};
      }
      async function guard(phase, guardSignal) {
        await beforeCostly({ phase, signal: guardSignal });
        if (guardSignal.aborted) fail('generated_speech_cancelled');
        const saved = await journal.assertMovingSession({ scope, sessionId: binding.sessionId,
          binding, lease: await currentLease(), ...(acceptedJob ? { jobId: acceptedJob } : {}) });
        return saved;
      }
      async function finalize({ reason }) {
        if (finalized) return finalized;
        finalized = (async () => {
          clearTimeout(timer); life.abort();
          // A callback/token is already closed by the transport. No terminal
          // inference from timeout, lease expiry, connection EOF or cancel ACK.
          if (!session || !acceptedJob) {
            if (observedJob) {
              try { await bounded(s => provider.cancel({ jobId: observedJob, signal: s }), undefined, cleanupMs, 'generated_speech_moving_cancel_unknown'); }
              catch { /* A lost attach COMMIT still keeps all durable ownership. */ }
            }
            if (!session && ownership.current()) {
              try { await ownership.release(); } catch { /* Lost reserve COMMIT may own an open session. */ }
            }
            return { released: false, reason: session ? 'submission_unresolved' : 'not_reserved' };
          }
          const lease = await currentLease();
          if (reason !== 'complete') {
            await journal.requestCancel({ sessionId: binding.sessionId, lease, jobId: acceptedJob });
            try { await bounded(s => provider.cancel({ jobId: acceptedJob, signal: s }), undefined, cleanupMs, 'generated_speech_moving_cancel_unknown'); }
            catch { /* Status, not cancel acknowledgement, proves terminal. */ }
          }
          const until = Date.now() + cleanupMs;
          while (Date.now() < until) {
            let status;
            try { status = (await bounded(s => provider.status({ jobId: acceptedJob, signal: s }), undefined,
              Math.max(1, until - Date.now()), 'generated_speech_moving_status_unknown'))?.status; }
            catch { return { released: false, reason: 'provider_status_unknown' }; }
            if (terminal.has(status)) {
              await journal.recordProviderStatus({ sessionId: binding.sessionId, lease, jobId: acceptedJob, status });
              // One callback, now permanently closed, plus terminal provider
              // status proves this job cannot deliver more frames or PCM.
              await journal.confirmWorkerDrained({ sessionId: binding.sessionId, lease,
                proof: { workerId: session.workerId, workers: 0, busy: 0, available: 0 } });
              await journal.completeRequest({ key: session.key, lease });
              await ownership.release();
              return { released: true, status };
            }
            if (!['IN_QUEUE', 'IN_PROGRESS'].includes(status)) return { released: false, reason: 'provider_status_unknown' };
            await pause(Math.min(pollMs, Math.max(1, until - Date.now())));
          }
          return { released: false, reason: 'provider_not_terminal' };
        })().finally(() => { if (active === operation) active = null; });
        return finalized;
      }
      try {
        await bounded(s => beforeCostly({ phase: 'admit', signal: s }), requestSignal, idleMs, 'generated_speech_moving_admission_timeout');
        // Acquire the shared journal fence before observing provider capacity.
        // Different server processes cannot reserve this endpoint concurrently.
        const lease=await currentLease();
        const receipt = await bounded(s => release({ signal: s }), requestSignal, idleMs, 'generated_speech_moving_release_timeout');
        if (verifyMovingWorkerRelease(receipt).endpointId !== endpointId) fail('generated_speech_moving_endpoint_mismatch');
        const capacity = await bounded(s => observeCapacity(receipt,s), requestSignal, idleMs, 'generated_speech_moving_drain_unknown');
        admittedCapacity=capacity.verified;
        session = await journal.reserveMovingSession({ scope, ownerHash, requestId, fingerprint, binding, mediaReferences,
          projectRevision, budgetId, totalBudgetMicroUsd, initialBudgetMicroUsd, sessionId: binding.sessionId, endpointId,
          lease, reserveMicroUsd, currentBudgetMicroUsd: currentDailyBudgetMicroUsd, workerState: capacity.state,
          ...(capacity.proof ? {movingCapacity:capacity.proof}:{}) });
        connection = await connectionFactory({ origin, release: receipt, attestationBinding: binding,
          signal: requestSignal, lifetimeMs, startupMs, idleMs, finalize, chunkAcknowledgements: true,
          authorize: async ({ phase, signal: authSignal }) => {
            await guard(phase, authSignal);
            if (phase !== 'prepare' && !acceptedJob) fail('generated_speech_moving_job_not_accepted');
            return { userId, sessionId: binding.sessionId, endpointId, jobId: acceptedJob,
              ...(phase === 'send' ? { release: await release({ signal: authSignal }) } : {}) };
          } });
      } catch (error) {
        await finalize({ reason: 'admission_failed' });
        throw error;
      }
      const api = {
        sessionId: binding.sessionId, attemptId: binding.attemptId, binding,
        callbackUrl: connection.callbackUrl, handleUpgrade: connection.handleUpgrade, closed: connection.closed,
        submit() {
          if (submission) return submission;
          submission = (async () => {
            try {
              assertSubmissionWindow();
              await bounded(s => guard('submit', s), requestSignal, idleMs, 'generated_speech_moving_admission_timeout');
              const download = typeof bankDownload === 'function'
                ? await bounded(s => bankDownload({ binding, callbackUrl: connection.callbackUrl, signal: s,
                  sessionSignal: requestSignal, ttlMs: Math.max(1, expiresAtMs - Date.now()) }), requestSignal, idleMs, 'generated_speech_moving_bank_timeout') : bankDownload;
              assertSubmissionWindow();
              const lease = await currentLease();
              await journal.markRequestSubmissionStarted({ key: session.key, lease });
              await journal.markSubmissionStarted({ sessionId: binding.sessionId, lease });
              // Exactly one POST. A lost reply/COMMIT remains spent and pinned.
              let result;
              try {
                result = await bounded(async s => {
                  if (admittedCapacity) {
                    const fresh=await observeCapacity(await release({signal:s}),s);
                    if (!fresh.verified || fresh.verified.image !== admittedCapacity.image
                      || fresh.verified.endpointVersion !== admittedCapacity.endpointVersion) fail('generated_speech_moving_capacity_changed');
                    // The journal is already submission_started. Its normal
                    // prepare/output guard accepts only reserved/running jobs;
                    // renew the same fence and recheck current product access.
                    await beforeCostly({phase:'submit',signal:s});
                    s.throwIfAborted();
                    await currentLease();
                  }
                  assertSubmissionWindow(); return provider.submit({ input: { schemaVersion: 1,
                  callbackUrl: connection.callbackUrl, ttlSeconds: MOVING_SPEECH_LIMITS.executionMs / 1000, binding,
                  ...(download ? { bankDownload: download } : {}) }, signal: s }); }, requestSignal, idleMs,
                'generated_speech_moving_submission_unknown');
                if (!jobPattern.test(result?.id ?? '')) fail('generated_speech_moving_submission_unknown', 503);
              } catch (error) {
                await journal.markSubmissionUncertain({ sessionId: binding.sessionId, lease });
                await journal.failRequest({ key: session.key, lease, safeCode: 'generated_speech_moving_submission_unknown' });
                fail('generated_speech_moving_submission_unknown', 503);
              }
              observedJob = result.id;
              await journal.attachJob({ sessionId: binding.sessionId, lease, jobId: result.id });
              acceptedJob = result.id;
              if (requestSignal.aborted) {
                // Cancellation can win while the attach COMMIT is pending.
                // Its earlier finalizer cannot see this late known job ID.
                try { await bounded(s => provider.cancel({ jobId: acceptedJob, signal: s }), undefined, cleanupMs, 'generated_speech_moving_cancel_unknown'); } catch { /* Retain ownership. */ }
                fail('generated_speech_cancelled');
              }
              return Object.freeze({ jobId: acceptedJob, sessionId: binding.sessionId });
            } catch (error) { await connection.cancel(); throw error; }
          })();
          return submission;
        },
        ready() {
          if (!readiness) readiness = (async () => { await api.submit(); return connection.ready(); })();
          return readiness;
        },
        async dispatch(input, options) {
          try { await api.ready(); return await connection.dispatch(input, options); }
          catch (error) { input?.cancel?.(); await connection.cancel(); throw error; }
        },
        cancel: connection.cancel,
      };
      return Object.freeze(api);
    },
  });
}
