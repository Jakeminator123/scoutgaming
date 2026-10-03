import { createHash } from 'node:crypto';
import { StudioStorageError, validateStudioEnvironmentId } from './storage/studio-contract.mjs';
import { GPU_RESERVATION_WINDOW_MS, FULLFILE_ADMISSION_REMAINING_MS } from './speech-journal-constants.mjs';

export { GPU_RESERVATION_WINDOW_MS, FULLFILE_ADMISSION_REMAINING_MS };
const MAX_MICRO_USD = 10000000;
const resources = new Set(['fullfile-provider', 'stream-session', 'operator-qa']);
const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
const activeRequests = new Set(['reserved', 'submission_started', 'submission_uncertain']);
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const hash = /^[a-f0-9]{64}$/;
const sessionIdPattern = /^[a-f0-9]{32}$/;
const jobIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const endpointPattern = /^[A-Za-z0-9_-]{1,100}$/;
const safeCodePattern = /^(?:generated_speech_|invalid_generated_speech_|speech_|gpu_)[a-z_]{1,100}$/;
const directClientQueues = new WeakMap();
const fail = (code, status = 503) => { throw new StudioStorageError(code, status); };
const check = (value, pattern, code = 'invalid_generated_speech_journal_input') => {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code, 422);
  return value;
};
const integer = (value, max = Number.MAX_SAFE_INTEGER) => {
  if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
  if (!Number.isSafeInteger(value) || value < 0 || value > max) fail('generated_speech_journal_invalid', 409);
  return value;
};
const microUsd = value => {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MICRO_USD) fail('invalid_generated_speech_budget', 422);
  return value;
};
const ttl = value => {
  if (!Number.isSafeInteger(value) || value < 1000 || value > GPU_RESERVATION_WINDOW_MS) fail('invalid_generated_speech_lease', 422);
  return value;
};
const cloneMetadata = value => {
  let nodes = 0;
  const seen = new Set();
  const secretKey = /token|secret|password|authorization|cookie|api.?key|credential|ticket|signature/i;
  function clone(item, depth) {
    if (++nodes > 512 || depth > 12) fail('invalid_generated_speech_package', 422);
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (typeof item === 'string') {
      if (/^(?:data:|Bearer\s)/i.test(item) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(item)) fail('invalid_generated_speech_package', 422);
      if (/^(?:\/|[a-z][a-z0-9+.-]*:\/\/)/i.test(item)) {
        let url;
        try { url = new URL(item, 'https://metadata.invalid'); } catch { fail('invalid_generated_speech_package', 422); }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search) fail('invalid_generated_speech_package', 422);
      }
      return item;
    }
    if (!item || typeof item !== 'object' || seen.has(item)) fail('invalid_generated_speech_package', 422);
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (!array && prototype !== Object.prototype && prototype !== null) fail('invalid_generated_speech_package', 422);
    if (array && Object.keys(item).length !== item.length) fail('invalid_generated_speech_package', 422);
    seen.add(item);
    const output = array ? [] : {};
    for (const key of Object.keys(item)) {
      const property = Object.getOwnPropertyDescriptor(item, key);
      if (!property || !Object.hasOwn(property, 'value') || secretKey.test(key) || key.length > 128 || /[\u0000-\u001f]/.test(key)
        || ['__proto__', 'constructor', 'prototype'].includes(key)) fail('invalid_generated_speech_package', 422);
      output[key] = clone(property.value, depth + 1);
    }
    seen.delete(item);
    return output;
  }
  const result = clone(value, 0);
  if (!result || Array.isArray(result) || typeof result !== 'object' || Buffer.byteLength(JSON.stringify(result)) > 24000) fail('invalid_generated_speech_package', 422);
  return result;
};

export function speechRequestKey(ownerHash, requestId) {
  return createHash('sha256').update(`${check(ownerHash, hash)}\0${check(requestId, identifier)}`).digest('hex');
}

// Internal server adapter, NOT authentication, a speech-QA permission gate or a
// provider client. The caller still validates current user/role/origin, policy,
// cancellation and exact Blob bytes. Metadata checks do not prove Blob existence.
// A full-file request key does NOT enable the managed-cloud full-file path;
// the existing streaming-only policy and separate operator speech-QA gate stay.
// Production uses the database clock; `now` is only an isolated-test injection.
// `pool` is pg.Pool, or a query-only wrapper around an ALREADY connected client.
export async function createSpeechJournal({ pool, environmentId, now } = {}) {
  const environment = validateStudioEnvironmentId(environmentId);
  if (!pool || (typeof pool.connect !== 'function' && typeof pool.query !== 'function') || (now !== undefined && typeof now !== 'function')) fail('invalid_generated_speech_journal_input', 422);

  async function transaction(work) {
    let client, previous, unlockDirect, release = false, began = false;
    try {
      if (typeof pool.connect === 'function') {
        client = await pool.connect(); release = true;
        if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') fail('generated_speech_journal_unavailable');
      } else {
        // Prevent overlapping BEGIN/COMMIT on one supplied connected client.
        previous = directClientQueues.get(pool) ?? Promise.resolve();
        const current = new Promise(resolve => { unlockDirect = resolve; });
        directClientQueues.set(pool, current);
        await previous;
        client = pool;
      }
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED'); began = true;
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query("SET LOCAL lock_timeout = '3s'");
      // Short transactions, one lock order for every writer in this environment.
      // No provider call, file/Blob I/O, wait or paid retry under this lock.
      await client.query('/* speech:lock */ SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`croupier:speech:${environment}`]);
      const stamp = now === undefined
        ? (await client.query('/* speech:clock */ SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms')).rows[0]?.now_ms
        : now();
      const time = integer(stamp);
      if (time > 8640000000000000 - GPU_RESERVATION_WINDOW_MS) fail('generated_speech_journal_invalid', 409);
      const result = await work(client, time);
      await client.query('COMMIT'); began = false;
      return result;
    } catch (error) {
      if (began) { try { await client.query('ROLLBACK'); } catch { /* A lost COMMIT is uncertain, never retried. */ } }
      if (error instanceof StudioStorageError) throw error;
      fail('generated_speech_journal_unavailable');
    } finally {
      try {
        if (release && typeof client?.release === 'function') client.release();
      } catch { fail('generated_speech_journal_unavailable'); }
      finally { unlockDirect?.(); }
    }
  }
  const row = async (client, tag, sql, values = []) => (await client.query(`/* speech:${tag} */ ${sql}`, values)).rows[0] ?? null;
  const getLease = async (client, lease, time, { paid = false } = {}) => {
    if (!lease || !resources.has(lease.resource)) fail('invalid_generated_speech_lease', 422);
    check(lease.holderId, identifier); integer(lease.fence);
    const saved = await row(client, 'get_lease', 'SELECT * FROM croupier_studio.speech_execution_leases WHERE environment_id = $1 AND resource = $2', [environment, lease.resource]);
    if (!saved || saved.holder_id !== lease.holderId || integer(saved.fence) !== lease.fence || integer(saved.expires_at_ms) <= time) fail('generated_speech_stale_fence', 409);
    if (paid && saved.recovery_only) fail('generated_speech_recovery_only', 409);
    return saved;
  };
  const leaseResult = saved => Object.freeze({ resource: saved.resource, holderId: saved.holder_id, fence: integer(saved.fence), expiresAt: integer(saved.expires_at_ms), recoveryOnly: saved.recovery_only });
  const getOpenSession = client => row(client, 'open_session', 'SELECT * FROM croupier_studio.gpu_sessions WHERE environment_id = $1 AND released_at_ms IS NULL', [environment]);
  const getActiveRequests = (client, resource) => row(client, 'active_requests', "SELECT count(*)::bigint AS count FROM croupier_studio.speech_requests WHERE environment_id = $1 AND lease_resource = $2 AND state IN ('reserved', 'submission_started', 'submission_uncertain')", [environment, resource]);
  const getRequest = (client, key) => row(client, 'get_request', 'SELECT * FROM croupier_studio.speech_requests WHERE environment_id = $1 AND request_key = $2', [environment, key]);
  const ownedRequest = async (client, key, lease, time, paid = false) => {
    check(key, hash); await getLease(client, lease, time, { paid });
    const saved = await getRequest(client, key);
    if (!saved || saved.lease_resource !== lease.resource || saved.holder_id !== lease.holderId || integer(saved.lease_fence) !== lease.fence) fail('generated_speech_stale_fence', 409);
    return saved;
  };
  const getSession = async (client, id, lease, time, paid = false) => {
    check(id, sessionIdPattern); await getLease(client, lease, time, { paid });
    const saved = await row(client, 'get_session', 'SELECT * FROM croupier_studio.gpu_sessions WHERE environment_id = $1 AND session_id = $2', [environment, id]);
    if (!saved || lease.resource !== 'stream-session' || saved.holder_id !== lease.holderId || integer(saved.lease_fence) !== lease.fence) fail('generated_speech_stale_fence', 409);
    return saved;
  };
  const sessionResult = saved => ({ sessionId: saved.session_id, endpointId: saved.endpoint_id, workerId: saved.worker_id, state: saved.state, jobId: saved.job_id,
    holderId: saved.holder_id, fence: integer(saved.lease_fence), createdAt: integer(saved.created_at_ms),
    cancelRequestedAt: saved.cancel_requested_at_ms === null ? null : integer(saved.cancel_requested_at_ms),
    terminalStatus: saved.terminal_status, terminalReason: saved.terminal_reason,
    releasedAt: saved.released_at_ms === null ? null : integer(saved.released_at_ms) });
  const sessionColumns = new Set(['holder_id', 'lease_fence', 'state', 'job_id', 'cancel_requested_at_ms', 'terminal_status', 'terminal_reason', 'released_at_ms']);
  const updateSession = async (client, id, fields) => {
    const names = Object.keys(fields);
    if (!names.length || names.some(name => !sessionColumns.has(name))) fail('generated_speech_journal_invalid', 409);
    return row(client, `update_session:${names.join(',')}`, `UPDATE croupier_studio.gpu_sessions SET ${names.map((name, index) => `${name} = $${index + 3}`).join(', ')} WHERE environment_id = $1 AND session_id = $2 RETURNING *`, [environment, id, ...Object.values(fields)]);
  };
  const knownJob = (saved, jobId) => {
    check(jobId, jobIdPattern);
    if (!saved.job_id || saved.job_id !== jobId) fail('generated_speech_job_mismatch', 409);
  };
  // These observations must come from the trusted relay, not an HTTP request body.
  const drained = (proof, workerId) => {
    if (!proof || (workerId !== undefined && proof.workerId !== workerId) || proof.workers !== 0 || proof.busy !== 0 || proof.available !== 0) fail('generated_speech_worker_not_drained', 409);
  };
  const getPolicy = async (client, current) => {
    const saved = await row(client, 'get_policy', 'SELECT * FROM croupier_studio.gpu_budget_policies WHERE environment_id = $1', [environment]);
    if (!saved || saved.version !== 1) fail('generated_speech_budget_policy_missing', 409);
    const persisted = integer(saved.daily_budget_micro_usd, MAX_MICRO_USD);
    if (!persisted) fail('generated_speech_journal_invalid', 409);
    return { dailyBudgetMicroUsd: Math.min(persisted, microUsd(current)), savedBudgetMicroUsd: persisted };
  };
  const getFullfilePolicy = async (client, reserve, time) => {
    microUsd(reserve);
    const saved = await row(client, 'get_file_policy', 'SELECT * FROM croupier_studio.fullfile_budget_policies WHERE environment_id=$1', [environment]);
    if (!saved || integer(saved.version) !== 1) fail('generated_speech_fullfile_budget_policy_missing', 409);
    if (integer(saved.reserve_micro_usd, MAX_MICRO_USD) !== reserve
      || integer(saved.reservation_window_ms) !== GPU_RESERVATION_WINDOW_MS || integer(saved.created_at_ms) > time)
      fail('generated_speech_fullfile_budget_policy_conflict', 409);
    return { reserveMicroUsd:reserve, reservationWindowMs:GPU_RESERVATION_WINDOW_MS };
  };
  // All paid capabilities share one daily cap and the same advisory lock. A
  // completed/cancelled/uncertain request still consumes its original amount.
  const dayUsed = async (client, day) => integer((await row(client, 'day_sum', `SELECT coalesce(sum(reserved_micro_usd),0)::bigint AS used FROM (
    SELECT reserved_micro_usd FROM croupier_studio.gpu_reservations WHERE environment_id=$1 AND day=$2::date
    UNION ALL SELECT reserved_micro_usd FROM croupier_studio.fullfile_reservations WHERE environment_id=$1 AND day=$2::date
  ) costs`, [environment,day])).used);
  const requestDays = time => [...new Set([time,time+GPU_RESERVATION_WINDOW_MS].map(stamp=>new Date(stamp).toISOString().slice(0,10)))];
  const assertFileReserve = async (client, saved, time, reserve, current) => {
    const policy = await getFullfilePolicy(client,reserve,time), budget = await getPolicy(client,current), created = integer(saved.created_at_ms);
    if (saved.capability !== 'fullfile' || time < created
      || time + FULLFILE_ADMISSION_REMAINING_MS > created + policy.reservationWindowMs)
      fail('generated_speech_fullfile_reservation_expired',409);
    const rows=(await client.query(`/* speech:file_reservations */ SELECT request_key,to_char(day,'YYYY-MM-DD') AS day,reserved_micro_usd,reserved_at_ms
      FROM croupier_studio.fullfile_reservations WHERE environment_id=$1 AND request_key=$2 ORDER BY day LIMIT 3`,[environment,saved.request_key])).rows;
    const days=requestDays(created);
    if(rows.length!==days.length || rows.some((r,i)=>r.request_key!==saved.request_key || r.day!==days[i]
      || integer(r.reserved_micro_usd)!==reserve || integer(r.reserved_at_ms)!==created)) fail('generated_speech_fullfile_reservation_invalid',409);
    for(const day of days)if(await dayUsed(client,day)>budget.dailyBudgetMicroUsd)fail('generated_speech_daily_budget_exhausted',429);
    return {key:saved.request_key,days,reservedMicroUsd:reserve,expiresAt:created+policy.reservationWindowMs};
  };

  return Object.freeze({
    environmentId: environment,
    async findRequest({ ownerHash, requestId, fingerprint, capability } = {}) {
      const key = speechRequestKey(ownerHash, requestId); check(fingerprint, hash);
      if (!['fullfile', 'stream'].includes(capability)) fail('invalid_generated_speech_journal_input', 422);
      return transaction(async client => {
        const saved = await getRequest(client, key);
        if (!saved) return null;
        if (saved.owner_hash !== ownerHash || saved.fingerprint !== fingerprint || saved.capability !== capability) fail('generated_speech_request_conflict', 409);
        return { key, state: saved.state, ...(saved.state === 'completed' && capability === 'fullfile'
          ? { packageId: saved.package_id, packageMetadata: cloneMetadata(saved.package_metadata) } : {}) };
      });
    },
    async acquireLease({ resource, holderId, ttlMs = 60000, recoveryOnly = false } = {}) {
      if (!resources.has(resource) || typeof recoveryOnly !== 'boolean' || (recoveryOnly && resource !== 'stream-session')) fail('invalid_generated_speech_lease', 422);
      check(holderId, identifier); ttl(ttlMs);
      return transaction(async (client, time) => {
        const previous = await row(client, 'get_lease', 'SELECT * FROM croupier_studio.speech_execution_leases WHERE environment_id = $1 AND resource = $2', [environment, resource]);
        if (previous && integer(previous.expires_at_ms) > time) fail('generated_speech_lease_busy', 429);
        const open = resource === 'stream-session' ? await getOpenSession(client) : null;
        // Streaming requests are permanent spent keys, not GPU job ownership.
        // An open session (even terminal but undrained) blocks paid admission.
        const unresolved = resource === 'stream-session' ? Boolean(open) : integer((await getActiveRequests(client, resource)).count) > 0;
        if (unresolved && !recoveryOnly) fail('generated_speech_recovery_required', 409);
        if (recoveryOnly && !open) fail('generated_speech_recovery_not_found', 409);
        const fence = previous ? integer(previous.fence) + 1 : 1;
        integer(fence);
        const saved = await row(client, 'put_lease', `INSERT INTO croupier_studio.speech_execution_leases (environment_id, resource, holder_id, fence, expires_at_ms, recovery_only) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (environment_id, resource) DO UPDATE SET holder_id = EXCLUDED.holder_id, fence = EXCLUDED.fence, expires_at_ms = EXCLUDED.expires_at_ms, recovery_only = EXCLUDED.recovery_only RETURNING *`, [environment, resource, holderId, fence, time + ttlMs, recoveryOnly]);
        if (open) await updateSession(client, open.session_id, { holder_id: holderId, lease_fence: fence });
        return leaseResult(saved);
      });
    },
    async renewLease({ lease, ttlMs = 60000 } = {}) {
      ttl(ttlMs);
      return transaction(async (client, time) => {
        await getLease(client, lease, time);
        return leaseResult(await row(client, 'renew_lease', 'UPDATE croupier_studio.speech_execution_leases SET expires_at_ms = $3 WHERE environment_id = $1 AND resource = $2 RETURNING *', [environment, lease.resource, time + ttlMs]));
      });
    },
    async releaseLease({ lease } = {}) {
      return transaction(async (client, time) => {
        await getLease(client, lease, time);
        if (lease.resource === 'stream-session' ? await getOpenSession(client) : integer((await getActiveRequests(client, lease.resource)).count)) fail('generated_speech_recovery_required', 409);
        await row(client, 'renew_lease', 'UPDATE croupier_studio.speech_execution_leases SET expires_at_ms = $3 WHERE environment_id = $1 AND resource = $2 RETURNING *', [environment, lease.resource, time]);
        return { released: true };
      });
    },
    async claimRequest({ ownerHash, requestId, fingerprint, capability, lease, reserveMicroUsd, currentBudgetMicroUsd } = {}) {
      const key = speechRequestKey(ownerHash, requestId); check(fingerprint, hash);
      if (!['fullfile', 'stream'].includes(capability)) fail('invalid_generated_speech_journal_input', 422);
      return transaction(async (client, time) => {
        const existing = await getRequest(client, key);
        if (existing) {
          if (existing.owner_hash !== ownerHash || existing.fingerprint !== fingerprint || existing.capability !== capability) fail('generated_speech_request_conflict', 409);
          if (existing.state === 'completed' && capability === 'fullfile') return { status: 'completed', key, packageId: existing.package_id, packageMetadata: cloneMetadata(existing.package_metadata) };
          return { status: ['reserved', 'submission_started'].includes(existing.state) ? 'inFlight' : 'alreadyAttempted', key, state: existing.state };
        }
        await getLease(client, lease, time, { paid: true });
        if (!(capability === 'stream' ? ['stream-session', 'operator-qa'] : ['fullfile-provider', 'operator-qa']).includes(lease.resource)) fail('invalid_generated_speech_lease', 422);
        if (capability === 'fullfile') {
          const active = await row(client, 'active_file_requests', "SELECT count(*)::bigint AS count FROM croupier_studio.speech_requests WHERE environment_id = $1 AND capability = 'fullfile' AND state IN ('reserved', 'submission_started', 'submission_uncertain')", [environment]);
          if (integer(active.count)) fail('generated_speech_busy', 429);
          await getFullfilePolicy(client,reserveMicroUsd,time);
          const budget=await getPolicy(client,currentBudgetMicroUsd);
          for(const day of requestDays(time))if(await dayUsed(client,day)+reserveMicroUsd>budget.dailyBudgetMicroUsd)
            fail('generated_speech_daily_budget_exhausted',429);
        }
        await row(client, 'insert_request', `INSERT INTO croupier_studio.speech_requests (environment_id, request_key, owner_hash, request_id, fingerprint, capability, state, lease_resource, holder_id, lease_fence, created_at_ms, updated_at_ms)
          VALUES ($1, $2, $3, $4, $5, $6, 'reserved', $7, $8, $9, $10, $10) RETURNING *`, [environment, key, ownerHash, requestId, fingerprint, capability, lease.resource, lease.holderId, lease.fence, time]);
        if(capability==='fullfile')for(const day of requestDays(time))await row(client,'insert_file_reservation',
          'INSERT INTO croupier_studio.fullfile_reservations(environment_id,request_key,day,reserved_micro_usd,reserved_at_ms) VALUES($1,$2,$3::date,$4,$5) RETURNING *',
          [environment,key,day,reserveMicroUsd,time]);
        return { status: 'new', key };
      });
    },
    async assertFullfileReservation({key,lease,reserveMicroUsd,currentBudgetMicroUsd}={}){
      return transaction(async(client,time)=>{
        const saved=await ownedRequest(client,key,lease,time,true);
        if(!['reserved','submission_started'].includes(saved.state))fail('generated_speech_request_already_attempted',409);
        return assertFileReserve(client,saved,time,reserveMicroUsd,currentBudgetMicroUsd);
      });
    },
    async markRequestSubmissionStarted({ key, lease, reserveMicroUsd, currentBudgetMicroUsd } = {}) {
      return transaction(async (client, time) => {
        const saved = await ownedRequest(client, key, lease, time, true);
        if (saved.state !== 'reserved') fail('generated_speech_request_already_attempted', 409);
          if (saved.capability === 'fullfile') await assertFileReserve(client, saved, time, reserveMicroUsd, currentBudgetMicroUsd);
        await row(client, 'update_request', 'UPDATE croupier_studio.speech_requests SET state = $3, updated_at_ms = $4, safe_error = $5, package_id = $6, package_metadata = $7::jsonb WHERE environment_id = $1 AND request_key = $2 RETURNING *', [environment, key, 'submission_started', time, null, null, null]);
        return { key, state: 'submission_started' };
      });
    },
    async completeRequest({ key, lease, packageId = null, packageMetadata = null } = {}) {
      if (packageId !== null) check(packageId, identifier);
      const metadata = packageMetadata === null ? null : cloneMetadata(packageMetadata);
      return transaction(async (client, time) => {
        const saved = await ownedRequest(client, key, lease, time);
        if (saved.state !== 'submission_started') fail('generated_speech_request_already_attempted', 409);
        if (saved.capability === 'fullfile' ? packageId === null || metadata === null : packageId !== null || metadata !== null) fail('invalid_generated_speech_package', 422);
        await row(client, 'update_request', 'UPDATE croupier_studio.speech_requests SET state = $3, updated_at_ms = $4, safe_error = $5, package_id = $6, package_metadata = $7::jsonb WHERE environment_id = $1 AND request_key = $2 RETURNING *', [environment, key, 'completed', time, null, packageId, metadata === null ? null : JSON.stringify(metadata)]);
        return { key, state: 'completed' };
      });
    },
    async failRequest({ key, lease, safeCode = 'generated_speech_failed' } = {}) {
      check(safeCode, safeCodePattern);
      return transaction(async (client, time) => {
        const saved = await ownedRequest(client, key, lease, time);
        if (!activeRequests.has(saved.state)) fail('generated_speech_request_already_attempted', 409);
        const state = saved.state === 'reserved' ? 'failed' : 'submission_uncertain';
        await row(client, 'update_request', 'UPDATE croupier_studio.speech_requests SET state = $3, updated_at_ms = $4, safe_error = $5, package_id = $6, package_metadata = $7::jsonb WHERE environment_id = $1 AND request_key = $2 RETURNING *', [environment, key, state, time, safeCode, null, null]);
        return { key, state };
      });
    },
    async getCompletedPackage({ ownerHash, requestId } = {}) {
      const key = speechRequestKey(ownerHash, requestId);
      return transaction(async client => {
        const saved = await getRequest(client, key);
        if (!saved || saved.owner_hash !== ownerHash || saved.state !== 'completed' || saved.capability !== 'fullfile') fail('generated_speech_not_found', 404);
        return { key, packageId: saved.package_id, packageMetadata: cloneMetadata(saved.package_metadata) };
      });
    },
    async getCompletedPackageById({ ownerHash, packageId } = {}) {
      check(ownerHash, hash); check(packageId, identifier);
      return transaction(async client => {
        const found = (await client.query(`/* speech:get_package */ SELECT request_key,package_id,package_metadata FROM croupier_studio.speech_requests
          WHERE environment_id=$1 AND owner_hash=$2 AND package_id=$3 AND state='completed' AND capability='fullfile' LIMIT 2`, [environment, ownerHash, packageId])).rows;
        if (!found.length) fail('generated_speech_not_found', 404);
        if (found.length !== 1) fail('generated_speech_journal_invalid', 409);
        return { key:found[0].request_key, packageId:found[0].package_id, packageMetadata:cloneMetadata(found[0].package_metadata) };
      });
    },
    async initializeBudgetPolicy({ dailyBudgetMicroUsd, confirmation } = {}) {
      microUsd(dailyBudgetMicroUsd);
      // This is an explicit operator assertion, NOT evidence that old disk cost
      // journals are empty. Integration must preserve/import them before cutover.
      if (confirmation !== 'verified-new-empty-cost-journal') fail('generated_speech_budget_bootstrap_required', 409);
      return transaction(async (client, time) => {
        const existing = await row(client, 'get_policy', 'SELECT * FROM croupier_studio.gpu_budget_policies WHERE environment_id = $1', [environment]);
        if (existing) return getPolicy(client, dailyBudgetMicroUsd);
        const count = await row(client, 'journal_count', `SELECT ((SELECT count(*) FROM croupier_studio.speech_requests WHERE environment_id = $1)
          + (SELECT count(*) FROM croupier_studio.gpu_sessions WHERE environment_id = $1)
            + (SELECT count(*) FROM croupier_studio.gpu_reservations WHERE environment_id = $1)
            + (SELECT count(*) FROM croupier_studio.fullfile_reservations WHERE environment_id = $1))::bigint AS count`, [environment]);
        if (integer(count.count)) fail('generated_speech_journal_invalid', 409);
        await row(client, 'insert_policy', 'INSERT INTO croupier_studio.gpu_budget_policies (environment_id, version, daily_budget_micro_usd, created_at_ms) VALUES ($1, 1, $2, $3) RETURNING *', [environment, dailyBudgetMicroUsd, time]);
        return { dailyBudgetMicroUsd, savedBudgetMicroUsd: dailyBudgetMicroUsd };
      });
    },
    async initializeFullfileBudgetPolicy({reserveMicroUsd,currentBudgetMicroUsd,confirmation}={}){
      microUsd(reserveMicroUsd);microUsd(currentBudgetMicroUsd);
      if(confirmation!=='verified-new-empty-cost-journal')fail('generated_speech_budget_bootstrap_required',409);
      return transaction(async(client,time)=>{
        const budget=await getPolicy(client,currentBudgetMicroUsd);
        if(reserveMicroUsd>budget.dailyBudgetMicroUsd)fail('generated_speech_daily_budget_exhausted',429);
        const existing=await row(client,'get_file_policy','SELECT * FROM croupier_studio.fullfile_budget_policies WHERE environment_id=$1',[environment]);
        if(existing)return getFullfilePolicy(client,reserveMicroUsd,time);
        const count=await row(client,'journal_count',`SELECT ((SELECT count(*) FROM croupier_studio.speech_requests WHERE environment_id=$1)
          +(SELECT count(*) FROM croupier_studio.gpu_sessions WHERE environment_id=$1)
          +(SELECT count(*) FROM croupier_studio.gpu_reservations WHERE environment_id=$1)
          +(SELECT count(*) FROM croupier_studio.fullfile_reservations WHERE environment_id=$1))::bigint AS count`,[environment]);
        if(integer(count.count))fail('generated_speech_journal_invalid',409);
        await row(client,'insert_file_policy','INSERT INTO croupier_studio.fullfile_budget_policies(environment_id,version,reserve_micro_usd,reservation_window_ms,created_at_ms) VALUES($1,1,$2,$3,$4) RETURNING *',
          [environment,reserveMicroUsd,GPU_RESERVATION_WINDOW_MS,time]);
        return {reserveMicroUsd,reservationWindowMs:GPU_RESERVATION_WINDOW_MS};
      });
    },
    async getBudgetPolicy({ currentBudgetMicroUsd } = {}) {
      microUsd(currentBudgetMicroUsd);
      return transaction(client => getPolicy(client, currentBudgetMicroUsd));
    },
    async reserveSession({ sessionId, endpointId, lease, reserveMicroUsd, currentBudgetMicroUsd, workerState } = {}) {
      check(sessionId, sessionIdPattern); check(endpointId, endpointPattern); microUsd(reserveMicroUsd); microUsd(currentBudgetMicroUsd); drained(workerState);
      return transaction(async (client, time) => {
        await getLease(client, lease, time, { paid: true });
        if (lease.resource !== 'stream-session') fail('invalid_generated_speech_lease', 422);
        if (await row(client, 'get_session', 'SELECT * FROM croupier_studio.gpu_sessions WHERE environment_id = $1 AND session_id = $2', [environment, sessionId])) fail('generated_speech_session_already_attempted', 409);
        if (await getOpenSession(client)) fail('generated_speech_session_busy', 429);
        const policy = await getPolicy(client, currentBudgetMicroUsd);
        const days = [...new Set([time, time + GPU_RESERVATION_WINDOW_MS].map(stamp => new Date(stamp).toISOString().slice(0, 10)))];
        for (const day of days) {
            if (await dayUsed(client,day) + reserveMicroUsd > policy.dailyBudgetMicroUsd) fail('generated_speech_daily_budget_exhausted', 429);
        }
        const saved = await row(client, 'insert_session', `INSERT INTO croupier_studio.gpu_sessions (environment_id, session_id, endpoint_id, worker_id, holder_id, lease_fence, state, created_at_ms)
          VALUES ($1, $2, $3, $4, $5, $6, 'reserved', $7) RETURNING *`, [environment, sessionId, endpointId, `croupier-${sessionId}`, lease.holderId, lease.fence, time]);
        for (const day of days) await row(client, 'insert_reservation', 'INSERT INTO croupier_studio.gpu_reservations (environment_id, session_id, day, reserved_micro_usd) VALUES ($1, $2, $3::date, $4) RETURNING *', [environment, sessionId, day, reserveMicroUsd]);
        return { ...sessionResult(saved), days, reservedMicroUsd: reserveMicroUsd };
      });
    },
    async markSubmissionStarted({ sessionId, lease } = {}) {
      return transaction(async (client, time) => {
        const saved = await getSession(client, sessionId, lease, time, true);
        if (saved.state !== 'reserved' || saved.job_id) fail('generated_speech_session_already_attempted', 409);
        return sessionResult(await updateSession(client, sessionId, { state: 'submission_started' }));
      });
    },
    async attachJob({ sessionId, lease, jobId } = {}) {
      check(jobId, jobIdPattern);
      return transaction(async (client, time) => {
        const saved = await getSession(client, sessionId, lease, time, true);
        if (saved.job_id === jobId) return sessionResult(saved);
        if (saved.state !== 'submission_started' || saved.job_id) fail('generated_speech_session_already_attempted', 409);
        return sessionResult(await updateSession(client, sessionId, { state: 'running', job_id: jobId }));
      });
    },
    async markSubmissionUncertain({ sessionId, lease } = {}) {
      return transaction(async (client, time) => {
        const saved = await getSession(client, sessionId, lease, time);
        if (saved.state !== 'submission_started' || saved.job_id) fail('generated_speech_session_already_attempted', 409);
        return sessionResult(await updateSession(client, sessionId, { state: 'submission_uncertain' }));
      });
    },
    async requestCancel({ sessionId, lease, jobId } = {}) {
      return transaction(async (client, time) => {
        const saved = await getSession(client, sessionId, lease, time); knownJob(saved, jobId);
        if (saved.terminal_status) return sessionResult(saved);
        return sessionResult(await updateSession(client, sessionId, { state: 'cancelling', cancel_requested_at_ms: saved.cancel_requested_at_ms ?? time }));
      });
    },
    async recordProviderStatus({ sessionId, lease, jobId, status } = {}) {
      if (!terminal.has(status) && !['IN_QUEUE', 'IN_PROGRESS'].includes(status)) fail('invalid_generated_speech_provider_status', 422);
      return transaction(async (client, time) => {
        const saved = await getSession(client, sessionId, lease, time); knownJob(saved, jobId);
        if (saved.terminal_status) {
          if (saved.terminal_status !== status) fail('generated_speech_terminal_conflict', 409);
          return sessionResult(saved);
        }
        return sessionResult(terminal.has(status) ? await updateSession(client, sessionId, { state: 'terminal', terminal_status: status, terminal_reason: 'provider' }) : saved);
      });
    },
    async confirmWorkerDrained({ sessionId, lease, proof } = {}) {
      return transaction(async (client, time) => {
        const saved = await getSession(client, sessionId, lease, time); drained(proof, saved.worker_id);
        if (!saved.terminal_status) fail('generated_speech_terminal_required', 409);
        return sessionResult(saved.released_at_ms === null ? await updateSession(client, sessionId, { released_at_ms: time }) : saved);
      });
    },
    async retireExpiredMissingSession({ sessionId, lease, jobId, providerStatus, proof } = {}) {
      if (providerStatus !== 'not_found') fail('invalid_generated_speech_provider_status', 422);
      return transaction(async (client, time) => {
        const saved = await getSession(client, sessionId, lease, time); knownJob(saved, jobId); drained(proof, saved.worker_id);
        if (saved.terminal_status || time < integer(saved.created_at_ms) + GPU_RESERVATION_WINDOW_MS) fail('generated_speech_session_not_expired', 409);
        return sessionResult(await updateSession(client, sessionId, { state: 'terminal', terminal_status: 'TIMED_OUT', terminal_reason: 'expired_missing_status', released_at_ms: time }));
      });
    },
    async listRecoverableSessions() {
      return transaction(async client => (await client.query('/* speech:list_sessions */ SELECT * FROM croupier_studio.gpu_sessions WHERE environment_id = $1 AND released_at_ms IS NULL ORDER BY created_at_ms, session_id', [environment])).rows.map(sessionResult));
    },
  });
}
