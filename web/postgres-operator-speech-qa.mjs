import { randomUUID } from 'node:crypto';
import { StudioStorageError, validateActor, validateStudioScope } from './storage/studio-contract.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA = /^[a-f0-9]{64}$/;
const MAX_LIFETIME = 1800000;
const fail = (code = 'operator_speech_qa_invalid_gate', status = 503) => { throw new StudioStorageError(code, status); };
const integer = value => {
  if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
  if (!Number.isSafeInteger(value) || value < 0 || value > 8640000000000000) fail();
  return value;
};
const gateValue = row => {
  if (!row || !UUID.test(row.campaign_id) || !SHA.test(row.source_sha256)) fail();
  const value = { id: row.campaign_id, createdAt: integer(row.created_at_ms), expiresAt: integer(row.expires_at_ms) };
  if (value.expiresAt <= value.createdAt || value.expiresAt - value.createdAt > MAX_LIFETIME) fail();
  return value;
};
const sameGate = (a, b) => a && b && a.id === b.id && a.createdAt === b.createdAt && a.expiresAt === b.expiresAt;
const exactGate = value => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === 'createdAt,expiresAt,id' && UUID.test(value.id)
  && Number.isSafeInteger(value.createdAt) && value.createdAt >= 0 && Number.isSafeInteger(value.expiresAt)
  && value.expiresAt > value.createdAt && value.expiresAt - value.createdAt <= MAX_LIFETIME;

// No initializer, gate editor, reset, refund or disk fallback. Only the explicit
// frozen-ledger importer creates gate/campaign rows and the original lease.
// Missing active gate remains disabled; expired/imported attempts stay retained.
// Pool must pin a separate client per transaction. No provider runs under lock.
export function createPostgresOperatorSpeechQa({ pool, scope, now } = {}) {
  scope = validateStudioScope(scope);
  if (!pool || typeof pool.connect !== 'function' || (now !== undefined && typeof now !== 'function')) fail('operator_speech_qa_disabled');
  const { environment, workspaceId } = scope;
  async function transaction(work) {
    let client, began = false;
    try {
      client = await pool.connect();
      if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') fail('operator_speech_qa_disabled');
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED'); began = true;
      await client.query("SET LOCAL statement_timeout='5000ms'; SET LOCAL lock_timeout='3000ms'; SET LOCAL idle_in_transaction_session_timeout='10000ms'");
      const query = async (tag, sql, values = []) => (await client.query(`/* operator-qa:${tag} */ ${sql}`, values)).rows;
      // Same environment lock/order as every speech journal writer/importer.
      await query('lock', 'SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`croupier:speech:${environment}`]);
      const time = integer(now === undefined ? (await query('clock', 'SELECT (extract(epoch FROM clock_timestamp())*1000)::bigint AS now_ms'))[0]?.now_ms : now());
      const result = await work(query, time);
      const committed = await client.query('COMMIT'); began = false;
      if (committed?.command === 'ROLLBACK') fail('operator_speech_qa_unavailable');
      return result;
    } catch (error) {
      if (began) try { await client.query('ROLLBACK'); } catch { /* A lost commit is never replayed. */ }
      if (error instanceof StudioStorageError) throw error;
      fail('operator_speech_qa_unavailable');
    } finally { try { client?.release?.(); } catch { fail('operator_speech_qa_unavailable'); } }
  }
  async function readState(query, time) {
    const gates = await query('gate', 'SELECT * FROM croupier_studio.operator_qa_gate WHERE environment_id=$1 AND workspace_id=$2 LIMIT 2', [environment, workspaceId]);
    if (!gates.length) return { gate: null, attempts: 0 };
    if (gates.length !== 1) fail();
    const gate = gateValue(gates[0]);
    const campaigns = await query('campaign', 'SELECT * FROM croupier_studio.operator_qa_campaigns WHERE environment_id=$1 AND workspace_id=$2 AND campaign_id=$3 LIMIT 2', [environment, workspaceId, gate.id]);
    // The active gate must have the immutable retained campaign. Editing only
    // gate timestamps cannot extend or reset the original campaign allowance.
    if (campaigns.length !== 1 || !sameGate(gate, gateValue(campaigns[0]))) fail();
    const attempts = await query('attempts', 'SELECT * FROM croupier_studio.operator_qa_attempts WHERE environment_id=$1 AND workspace_id=$2 AND campaign_id=$3 ORDER BY attempt LIMIT 4', [environment, workspaceId, gate.id]);
    const seen = new Set();
    for (const row of attempts) {
      const attempt = integer(row.attempt), turn = integer(row.turn), reserved = integer(row.reserved_at_ms);
      if (![1, 2, 3].includes(attempt) || ![1, 2].includes(turn) || row.campaign_id !== gate.id || seen.has(attempt)
        || reserved < gate.createdAt || reserved >= gate.expiresAt || reserved > time
        || (row.actor === null ? !SHA.test(row.source_sha256) : row.source_sha256 !== null)) fail();
      if (row.actor !== null) validateActor(row.actor);
      seen.add(attempt);
    }
    if (attempts.length > 3) fail();
    const policies = await query('budget', 'SELECT * FROM croupier_studio.gpu_budget_policies WHERE environment_id=$1 LIMIT 2', [environment]);
    if (policies.length !== 1 || integer(policies[0].version) !== 1 || integer(policies[0].daily_budget_micro_usd) < 1
      || integer(policies[0].daily_budget_micro_usd) > 10000000 || integer(policies[0].created_at_ms) > time) fail('operator_speech_qa_disabled');
    return { gate: time >= gate.createdAt && time < gate.expiresAt ? gate : null, attempts: attempts.length, used: seen };
  }
  const getLease = async query => {
    const leases = await query('lease', "SELECT * FROM croupier_studio.speech_execution_leases WHERE environment_id=$1 AND resource='operator-qa' LIMIT 2", [environment]);
    const lease = leases[0];
    if (leases.length !== 1 || typeof lease.holder_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(lease.holder_id)
      || integer(lease.fence) < 1 || integer(lease.fence) >= Number.MAX_SAFE_INTEGER || lease.recovery_only !== false) fail('operator_speech_qa_disabled');
    integer(lease.expires_at_ms);
    return lease;
  };
  return Object.freeze({
    async state() {
      return transaction(async (query, time) => { const saved = await readState(query, time);
        if (saved.gate) await getLease(query);
        return { gate: saved.gate, attempts: saved.attempts }; });
    },
    async reserve({ gate, turn, authorize } = {}) {
      if (!exactGate(gate) || ![1, 2].includes(turn) || typeof authorize !== 'function') fail();
      gate = { ...gate };
      const holder = `operator-qa-${randomUUID()}`;
      const saved = await transaction(async (query, time) => {
        const current = await readState(query, time);
        if (!sameGate(current.gate, gate)) fail('operator_speech_qa_disabled');
        const lease = await getLease(query);
        if (integer(lease.expires_at_ms) > time) fail('operator_speech_qa_busy', 409);
        const attempt = [1, 2, 3].find(value => !current.used.has(value));
        if (!attempt) fail('operator_speech_qa_attempt_limit', 429);
        const authority = await authorize();
        if (!authority || Object.keys(authority).join(',') !== 'actor') fail('operator_speech_qa_auth_required', 403);
        const actor = validateActor(authority.actor), fence = integer(lease.fence) + 1;
        const reservedAt = integer(now === undefined ? (await query('clock', 'SELECT (extract(epoch FROM clock_timestamp())*1000)::bigint AS now_ms'))[0]?.now_ms : now());
        if (reservedAt < gate.createdAt || reservedAt >= gate.expiresAt) fail('operator_speech_qa_disabled');
        await query('reserve', 'INSERT INTO croupier_studio.operator_qa_attempts(environment_id,workspace_id,campaign_id,attempt,turn,reserved_at_ms,actor,source_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,NULL)', [environment, workspaceId, gate.id, attempt, turn, reservedAt, actor]);
        const updated = await query('claim', "UPDATE croupier_studio.speech_execution_leases SET holder_id=$2,fence=$3,expires_at_ms=$4 WHERE environment_id=$1 AND resource='operator-qa' RETURNING fence", [environment, holder, fence, gate.expiresAt]);
        if (updated.length !== 1 || integer(updated[0].fence) !== fence) fail();
        return { attempt, fence };
      });
      let released = false;
      return Object.freeze({ attempt: saved.attempt,
        async check() {
          if (released) return true; // HTTP preparation lock ends; live gate/auth remain caller-owned.
          return transaction(async (query, time) => {
            const current = await readState(query, time), lease = await getLease(query);
            return sameGate(current.gate, gate) && lease.holder_id === holder && integer(lease.fence) === saved.fence && integer(lease.expires_at_ms) > time;
          });
        },
        async release() {
          if (released) return;
          await transaction(async query => {
            const changed = await query('release', "UPDATE croupier_studio.speech_execution_leases SET expires_at_ms=0 WHERE environment_id=$1 AND resource='operator-qa' AND holder_id=$2 AND fence=$3 RETURNING fence", [environment, holder, saved.fence]);
            if (changed.length !== 1 || integer(changed[0].fence) !== saved.fence) fail('operator_speech_qa_stale', 409);
          });
          released = true;
        },
      });
    },
  });
}
