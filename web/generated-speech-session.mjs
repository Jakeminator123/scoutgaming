import { randomBytes } from 'node:crypto';
import { lstat, mkdir, open, readdir, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

export const SPEECH_SESSION_POLICY = Object.freeze({
  seconds: 540, executionTimeout: 600000, ttl: 660000,
  admissionWindowMs: 180000,
  // Includes the bounded session, drain and shutdown allowance. Reserve the
  // full configured cost on both days when this window crosses UTC midnight.
  reservationWindowMs: 720000, dailyMicroUsd: 10000000,
});
const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
const jobIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const token = value => typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/\s/.test(value);
const fail = (code, statusCode = 503) => { throw Object.assign(new Error(code), { code, statusCode }); };
export function sessionReserveMicroUsd(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d?)(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
  return amount > 0 && amount <= SPEECH_SESSION_POLICY.dailyMicroUsd ? amount : null;
}
const utcDay = milliseconds => new Date(milliseconds).toISOString().slice(0, 10);

/** Starts nothing at construction/startup. One verified conversation request
 * may create one bounded GPU session; subsequent utterances reuse it. Budget
 * reservations are immutable, conservative, never automatically refunded.
 * reserveUsd must include actual GPU rate, startup/idle/storage and margin.
 */
export function createSpeechSessionManager(configuration, {
  workerState, stopWorker = () => {}, fetchImpl = fetch, now = Date.now,
  sleep = (ms, signal) => pause(ms, undefined, { signal }),
  readyTimeoutMs = 90000, pollMs = 500, idleTimeoutMs = 60000,
} = {}) {
  const { directory, apiKey, endpointId, workerSecret, origin, reserveUsd, dailyBudgetUsd } = configuration ?? {};
  const reserveMicroUsd = sessionReserveMicroUsd(reserveUsd);
  const dailyBudgetMicroUsd = sessionReserveMicroUsd(dailyBudgetUsd);
  let url;
  try { url = new URL(origin); } catch {}
  if (!isAbsolute(directory ?? '') || !token(apiKey) || !jobIdPattern.test(endpointId ?? '')
    || !token(workerSecret) || workerSecret.length < 32 || !reserveMicroUsd || !dailyBudgetMicroUsd
    || reserveMicroUsd > dailyBudgetMicroUsd || !workerState
    || url?.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    fail('generated_speech_session_not_configured');
  }
  const base = `https://api.runpod.ai/v2/${endpointId}`;
  const root = resolve(directory), lockPath = join(root, 'stream-session.lock');
  const managerAbort = new AbortController();
  let pending = null, activeJob = null, idleTimer = null, closing = false;

  async function store() {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const info = await lstat(root);
    const actual = await realpath(root);
    if (!info.isDirectory() || info.isSymbolicLink() || (process.platform === 'win32' ? actual.toLowerCase() !== root.toLowerCase() : actual !== root)) fail('generated_speech_session_invalid_directory');
  }
  async function json(name) {
    const path = join(root, name), info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 8192) fail('generated_speech_session_ledger_invalid');
    const file = await open(path, 'r');
    try { return JSON.parse(await file.readFile('utf8')); }
    finally { await file.close(); }
  }
  async function optional(name) {
    try { return await json(name); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function record(name, value) {
    const file = await open(join(root, name), 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(value)); await file.sync(); }
    finally { await file.close(); }
  }
  const prefix = id => `gpu-session-${id}`;
  async function call(route, { signal, body } = {}) {
    const response = await fetchImpl(`${base}/${route}`, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { authorization: `Bearer ${apiKey}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      const reason = ({ 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 429: 'rate_limited' })[response.status] || 'http_failed';
      fail(`generated_speech_session_provider_${reason}`);
    }
    if (Number(response.headers.get('content-length') || 0) > 8192) {
      await response.body?.cancel(); fail('generated_speech_session_provider_response_too_large');
    }
    const reader = response.body?.getReader();
    if (!reader) fail('generated_speech_session_provider_empty');
    const chunks = []; let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > 8192) { await reader.cancel(); fail('generated_speech_session_provider_response_too_large'); }
        chunks.push(Buffer.from(next.value));
      }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { fail('generated_speech_session_provider_invalid_json'); }
    } finally { reader.releaseLock(); }
  }
  async function inspect(job, signal) {
    let value;
    try { value = await call(`status/${job.jobId}`, { signal }); }
    catch (error) {
      // RunPod removes expired job records. Retire only a known job beyond
      // our entire reserved lifetime, with no remaining relay worker. Keep
      // its spent reservation and fail this turn: replacement requires a
      // later explicit request and the normal budget/freshness checks.
      if (error?.code === 'generated_speech_session_provider_not_found'
        && Number.isSafeInteger(job.createdAt)
        && now() - job.createdAt >= SPEECH_SESSION_POLICY.reservationWindowMs) {
        const state = workerState(job.workerId);
        if (state.workers === 0 && state.busy === 0 && state.available === 0
          && !(await optional(`${prefix(job.id)}.terminal.json`))) {
          await record(`${prefix(job.id)}.terminal.json`, {
            status: 'TIMED_OUT', reason: 'provider_status_not_found_after_expiry', observedAt: now(),
          });
        }
      }
      throw error;
    }
    if (value?.id !== job.jobId) fail('generated_speech_session_provider_job_mismatch');
    if (!['IN_QUEUE', 'IN_PROGRESS', ...terminal].includes(value.status)) fail('generated_speech_session_provider_invalid_status');
    if (terminal.has(value.status) && !(await optional(`${prefix(job.id)}.terminal.json`))) {
      await record(`${prefix(job.id)}.terminal.json`, { status: value.status });
    }
    return value.status;
  }
  async function cancel(job) {
    if (!job) return;
    if (activeJob?.jobId === job.jobId) { activeJob = null; clearTimeout(idleTimer); }
    try {
      if (!(await optional(`${prefix(job.id)}.cancel.json`))) await record(`${prefix(job.id)}.cancel.json`, { requestedAt: now() });
      // Close our idle reverse channel as well. Provider cancellation may mark
      // a job terminal before the handler observes shutdown.
      stopWorker(job.workerId);
      // Cancellation is limited to our known job, never a shared queue purge.
      const value = await call(`cancel/${job.jobId}`, { body: {} });
      // A cancellation request alone is not proof. Preserve only a terminal
      // response bound to this job before provider retention removes its ID.
      if (value?.id === job.jobId && terminal.has(value.status) && !(await optional(`${prefix(job.id)}.terminal.json`))) {
        await record(`${prefix(job.id)}.terminal.json`, { status: value.status });
      }
    } catch { /* Reservation remains spent and known ID stays recoverable. */ }
  }
  async function waitUntilStopped(job, signal, fresh) {
    const started = now();
    for (;;) {
      await fresh();
      const receipt = await optional(`${prefix(job.id)}.terminal.json`);
      const status = terminal.has(receipt?.status) ? receipt.status : await inspect(job, signal);
      if (terminal.has(status) && !workerState(job.workerId).workers) return;
      if (now() - started >= readyTimeoutMs) fail('generated_speech_session_stop_timeout', 504);
      await sleep(pollMs, signal);
    }
  }
  function touch() {
    if (closing || !activeJob) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (workerState().busy > 0) { touch(); return; }
      const job = activeJob; activeJob = null;
      void cancel(job);
    }, idleTimeoutMs);
    idleTimer.unref?.();
  }
  async function ledger() {
    const all = [];
    for (const name of await readdir(root)) {
      const match = /^gpu-session-([a-f0-9]{32})\.reservation\.json$/.exec(name);
      if (!match) continue;
      const value = await json(name);
      if (value.id !== match[1] || value.endpointId !== endpointId || !Number.isSafeInteger(value.reservedMicroUsd)
        || value.workerId !== `croupier-${match[1]}`
        || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0
        || value.reservedMicroUsd < 1 || value.reservedMicroUsd > SPEECH_SESSION_POLICY.dailyMicroUsd
        || !Array.isArray(value.days) || !value.days.length || value.days.length > 2
        || value.days.some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day))) fail('generated_speech_session_ledger_invalid');
      all.push({ ...value, done: await optional(`${prefix(value.id)}.terminal.json`),
        job: await optional(`${prefix(value.id)}.job.json`), cancelling: await optional(`${prefix(value.id)}.cancel.json`) });
    }
    return all;
  }
  async function budgetPolicy(entries) {
    let policy = await optional('gpu-budget-policy.json');
    if (!policy) {
      // The explicit remaining-budget configuration is the operator's bootstrap
      // confirmation. Never infer zero previous use from existing job artifacts.
      if (entries.length) fail('generated_speech_session_ledger_invalid');
      policy = { version: 1, dailyBudgetMicroUsd, createdAt: now() };
      await record('gpu-budget-policy.json', policy);
    }
    if (policy.version !== 1 || !Number.isSafeInteger(policy.dailyBudgetMicroUsd)
      || policy.dailyBudgetMicroUsd < 1 || policy.dailyBudgetMicroUsd > SPEECH_SESSION_POLICY.dailyMicroUsd) fail('generated_speech_session_ledger_invalid');
    // A deploy/restart may tighten an existing ledger, never silently increase it.
    return Math.min(dailyBudgetMicroUsd, policy.dailyBudgetMicroUsd);
  }
  async function ensure(input, lifetime) {
    const signal = input.signal ? AbortSignal.any([input.signal, managerAbort.signal]) : managerAbort.signal;
    const fresh = async () => { signal.throwIfAborted(); await input.beforeCostly(); signal.throwIfAborted(); };
    await fresh();
    // A verified new conversation turn owns this interval. The previous idle
    // timer must not cancel its worker while status/ledger I/O is in flight.
    clearTimeout(idleTimer); idleTimer = null;
    lifetime.idleSuspended = true;
    await store();
    let lock, job;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') fail('generated_speech_session_busy', 429); throw error; }
    try {
      const entries = await ledger(), active = entries.filter(entry => !entry.done);
      const remainingBudget = await budgetPolicy(entries);
      if (active.length > 1) fail('generated_speech_session_ledger_invalid');
      if (active.length) {
        const entry = active[0];
        if (!jobIdPattern.test(entry.job?.jobId ?? '')) fail('generated_speech_session_submission_uncertain');
        job = { id: entry.id, jobId: entry.job.jobId, workerId: entry.workerId, createdAt: entry.createdAt };
        const status = await inspect(job, signal);
        if (terminal.has(status)) {
          // Provider cancellation can finish before the reverse socket closes.
          // That socket is still ours; wait for its release before replacement.
          stopWorker(job.workerId);
          await waitUntilStopped(job, signal, fresh); job = null;
        }
        else if (entry.cancelling || now() + SPEECH_SESSION_POLICY.admissionWindowMs >= entry.createdAt + SPEECH_SESSION_POLICY.seconds * 1000) {
          // Ticket admission + maximum utterance must fit. Do not hand a new
          // speaker a worker that is about to expire under an ongoing stream.
          if (workerState(job.workerId).busy > 0) fail('generated_speech_stream_busy', 429);
          await cancel(job); await waitUntilStopped(job, signal, fresh); job = null;
        }
      }
      if (!job) {
        // A previous attempt may already have persisted the terminal receipt
        // while its socket was draining. Preserve that ownership on retry.
        for (const entry of entries.filter(entry => entry.done && workerState(entry.workerId).workers > 0)) {
          if (!jobIdPattern.test(entry.job?.jobId ?? '')) fail('generated_speech_session_ledger_invalid');
          stopWorker(entry.workerId);
          await waitUntilStopped({ id: entry.id, jobId: entry.job.jobId, workerId: entry.workerId, createdAt: entry.createdAt }, signal, fresh);
        }
        if (workerState().workers > 0) fail('generated_speech_session_untracked_worker');
        const started = now(), days = [...new Set([utcDay(started), utcDay(started + SPEECH_SESSION_POLICY.reservationWindowMs)])];
        for (const day of days) {
          const used = entries.filter(entry => entry.days.includes(day)).reduce((sum, entry) => sum + entry.reservedMicroUsd, 0);
          if (used + reserveMicroUsd > remainingBudget) fail('generated_speech_daily_budget_exhausted', 429);
        }
        await fresh();
        const id = randomBytes(16).toString('hex'), workerId = `croupier-${id}`;
        await record(`${prefix(id)}.reservation.json`, { id, endpointId, days, reservedMicroUsd: reserveMicroUsd, createdAt: started, workerId });
        await fresh();
        // No automatic retry of this paid POST, including a lost submit response.
        const value = await call('run', { signal, body: {
          input: { op: 'session', ws_url: `wss://${url.host}/lipsync-worker`, ws_token: workerSecret, worker_id: workerId, ttl: SPEECH_SESSION_POLICY.seconds },
          policy: { executionTimeout: SPEECH_SESSION_POLICY.executionTimeout, ttl: SPEECH_SESSION_POLICY.ttl },
        } });
        if (!jobIdPattern.test(value?.id ?? '')) fail('generated_speech_session_submission_uncertain');
        job = { id, jobId: value.id, workerId, createdAt: started };
        await record(`${prefix(id)}.job.json`, { jobId: value.id });
      }
      const waitStarted = now();
      while (!workerState(job.workerId).available) {
        await fresh();
        if (workerState(job.workerId).busy > 0) fail('generated_speech_stream_busy', 429);
        if (now() - waitStarted >= readyTimeoutMs) fail('generated_speech_session_start_timeout', 504);
        const status = await inspect(job, signal);
        if (terminal.has(status)) fail('generated_speech_session_worker_failed');
        await sleep(pollMs, signal);
      }
      await fresh(); activeJob = job; touch();
      return { ready: true };
    } catch (error) {
      if (job && !['generated_speech_stream_busy', 'generated_speech_session_stopping'].includes(error?.code)) await cancel(job);
      if (signal.aborted) fail('generated_speech_session_cancelled', 499);
      if (/^generated_speech_[a-z_]+$/.test(error?.code ?? '')) throw error;
      fail('generated_speech_session_unavailable');
    } finally { await lock.close(); await unlink(lockPath); }
  }
  return {
    activity(workerId) {
      if (activeJob?.workerId === workerId && !pending && !closing) touch();
    },
    ensure(input) {
      if (closing || typeof input?.beforeCostly !== 'function') return Promise.reject(Object.assign(new Error('generated_speech_session_cancelled'), { code: 'generated_speech_session_cancelled', statusCode: 499 }));
      if (pending) return pending.then(async value => { input.signal?.throwIfAborted(); await input.beforeCostly(); touch(); return value; });
      const lifetime = { idleSuspended: false };
      pending = ensure(input, lifetime).finally(() => { pending = null; if (lifetime.idleSuspended && activeJob && !closing) touch(); });
      return pending;
    },
    async close() { closing = true; clearTimeout(idleTimer); managerAbort.abort(); await cancel(activeJob); activeJob = null; },
  };
}
