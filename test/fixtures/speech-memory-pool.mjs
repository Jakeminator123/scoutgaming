import assert from 'node:assert/strict';

// Deterministic SQL transaction fixture; actual SQL acceptance runs separately.
export function speechMemoryPool(clock = () => Date.parse('2026-10-03T12:00:00Z')) {
  let state = { leases: new Map(), requests: new Map(), policies: new Map(), sessions: new Map(), reservations: new Map(), filePolicies: new Map(), fileReservations: new Map() };
  let tail = Promise.resolve(), injected = null, connects = 0, releases = 0;
  const trace = [];
  const key = (...parts) => parts.join('\0');
  const rows = value => ({ rows: value === null || value === undefined ? [] : Array.isArray(value) ? structuredClone(value) : [structuredClone(value)] });
  const number = value => String(value);
  const duplicate = () => { throw Object.assign(new Error('duplicate secret-dsn'), { code: '23505' }); };
  const pool = {
    async connect() {
      if (injected?.tag === 'connect') { injected = null; throw new Error('private postgresql://password@host'); }
      connects++;
      let snapshot = null, unlock = null, inTransaction = false;
      return {
        async query(sql, p = []) {
          const tag = /\/\* speech:([^*]+) \*\//.exec(sql)?.[1] ?? sql;
          trace.push(tag);
          if (injected?.tag === tag && !injected.afterCommit) { injected = null; throw new Error('secret provider-token / database password'); }
          if (sql.startsWith('BEGIN')) { assert.equal(inTransaction, false); inTransaction = true; return rows(); }
          if (sql.startsWith('SET LOCAL')) { assert.equal(inTransaction, true); return rows(); }
          if (tag === 'lock') {
            assert.equal(inTransaction, true);
            const previous = tail; tail = new Promise(resolve => { unlock = resolve; });
            await previous; snapshot = structuredClone(state);
            return rows();
          }
          if (sql === 'COMMIT') {
            assert.equal(inTransaction, true); inTransaction = false; snapshot = null;
            unlock?.(); unlock = null;
            if (injected?.tag === 'COMMIT') { injected = null; throw new Error('lost commit response secret'); }
            return rows();
          }
          if (sql === 'ROLLBACK') {
            if (snapshot) state = snapshot;
            inTransaction = false; snapshot = null; unlock?.(); unlock = null;
            return rows();
          }
          assert.ok(inTransaction && snapshot, `query outside pinned transaction: ${tag}`);
          const [env, id] = p;
          if (tag === 'clock') return rows({ now_ms: number(clock()) });
          if (tag === 'get_lease') return rows(state.leases.get(key(env, id)));
          if (tag === 'put_lease') {
            const saved = { environment_id: env, resource: id, holder_id: p[2], fence: number(p[3]), expires_at_ms: number(p[4]), recovery_only: p[5] };
            state.leases.set(key(env, id), saved); return rows(saved);
          }
          if (tag === 'renew_lease') { const saved = state.leases.get(key(env, id)); saved.expires_at_ms = number(p[2]); return rows(saved); }
          if (tag === 'get_request') return rows(state.requests.get(key(env, id)));
          if (tag === 'get_package') return rows([...state.requests.values()].filter(value => value.environment_id === env
            && value.owner_hash === id && value.package_id === p[2] && value.state === 'completed' && value.capability === 'fullfile').slice(0, 2));
          if (tag === 'active_requests' || tag === 'active_file_requests') {
            const count = [...state.requests.values()].filter(r => r.environment_id === env && (tag === 'active_requests' ? r.lease_resource === id : r.capability === 'fullfile')
              && ['reserved', 'submission_started', 'submission_uncertain'].includes(r.state)).length;
            return rows({ count: number(count) });
          }
          if (tag === 'insert_request') {
            if (state.requests.has(key(env, id))) duplicate();
            const saved = { environment_id: env, request_key: id, owner_hash: p[2], request_id: p[3], fingerprint: p[4], capability: p[5], state: 'reserved',
              lease_resource: p[6], holder_id: p[7], lease_fence: number(p[8]), created_at_ms: number(p[9]), updated_at_ms: number(p[9]), package_id: null, package_metadata: null, safe_error: null };
            state.requests.set(key(env, id), saved); return rows(saved);
          }
          if (tag === 'update_request') {
            const saved = state.requests.get(key(env, id));
            Object.assign(saved, { state: p[2], updated_at_ms: number(p[3]), safe_error: p[4], package_id: p[5], package_metadata: p[6] === null ? null : JSON.parse(p[6]) });
            return rows(saved);
          }
          if (tag === 'get_policy') return rows(state.policies.get(env));
          if (tag === 'insert_policy') {
            if (state.policies.has(env)) duplicate();
            const saved = { environment_id: env, version: 1, daily_budget_micro_usd: number(p[1]), created_at_ms: number(p[2]) };
            state.policies.set(env, saved); return rows(saved);
          }
          if (tag === 'update_policy') {
            const saved = state.policies.get(env); if (!saved) return rows(undefined);
            saved.daily_budget_micro_usd = number(p[1]); return rows(saved);
          }
          if (tag === 'get_file_policy') return rows(state.filePolicies.get(env));
          if (tag === 'insert_file_policy') {
            if (state.filePolicies.has(env)) duplicate();
            const saved = { environment_id:env, version:1, reserve_micro_usd:number(p[1]), reservation_window_ms:number(p[2]), created_at_ms:number(p[3]) };
            state.filePolicies.set(env,saved); return rows(saved);
          }
          if (tag === 'file_reservations') return rows([...state.fileReservations.values()].filter(r=>r.environment_id===env && r.request_key===id).sort((a,b)=>a.day.localeCompare(b.day)).slice(0,3));
          if (tag === 'insert_file_reservation') {
            if (state.fileReservations.has(key(env,id,p[2]))) duplicate();
            assert.ok(state.requests.has(key(env,id))); assert.ok(state.filePolicies.has(env));
            const saved={environment_id:env,request_key:id,day:p[2],reserved_micro_usd:number(p[3]),reserved_at_ms:number(p[4])};
            state.fileReservations.set(key(env,id,p[2]),saved); return rows(saved);
          }
          if (tag === 'journal_count') return rows({ count: number(['requests', 'sessions', 'reservations', 'fileReservations'].reduce((sum, kind) => sum + [...state[kind].values()].filter(r => r.environment_id === env).length, 0)) });
          if (tag === 'get_session') return rows(state.sessions.get(key(env, id)));
          if (tag === 'open_session') return rows([...state.sessions.values()].find(r => r.environment_id === env && r.released_at_ms === null));
          if (tag === 'insert_session') {
            if (state.sessions.has(key(env, id)) || [...state.sessions.values()].some(r => r.environment_id === env && r.released_at_ms === null)) duplicate();
            const saved = { environment_id: env, session_id: id, endpoint_id: p[2], worker_id: p[3], holder_id: p[4], lease_resource: 'stream-session', lease_fence: number(p[5]),
              state: 'reserved', created_at_ms: number(p[6]), job_id: null, cancel_requested_at_ms: null, terminal_status: null, terminal_reason: null, released_at_ms: null };
            state.sessions.set(key(env, id), saved); return rows(saved);
          }
          if (tag.startsWith('update_session:')) {
            const saved = state.sessions.get(key(env, id)), columns = tag.slice('update_session:'.length).split(',');
            for (let i = 0; i < columns.length; i++) saved[columns[i]] = p[i + 2];
            if (saved.job_id && [...state.sessions.values()].some(r => r !== saved && r.environment_id === env && r.endpoint_id === saved.endpoint_id && r.job_id === saved.job_id)) duplicate();
            return rows(saved);
          }
          if (tag === 'day_sum') return rows({ used: number([...state.reservations.values(),...state.fileReservations.values()].filter(r => r.environment_id === env && r.day === id).reduce((sum, r) => sum + Number(r.reserved_micro_usd), 0)) });
          if (tag === 'insert_reservation') {
            if (state.reservations.has(key(env, id, p[2]))) duplicate();
            const saved = { environment_id: env, session_id: id, day: p[2], reserved_micro_usd: number(p[3]) };
            state.reservations.set(key(env, id, p[2]), saved); return rows(saved);
          }
          if (tag === 'list_sessions') return rows([...state.sessions.values()].filter(r => r.environment_id === env && r.released_at_ms === null).sort((a, b) => Number(a.created_at_ms) - Number(b.created_at_ms) || a.session_id.localeCompare(b.session_id)));
          throw new Error(`Unknown fixture SQL: ${tag}`);
        },
        release() { assert.equal(inTransaction, false, 'transaction not closed before release'); assert.equal(unlock, null); releases++; },
      };
    },
    get state() { return state; },
    get trace() { return trace; },
    get counts() { return { connects, releases }; },
    failNext(tag, { afterCommit = false } = {}) { injected = { tag, afterCommit }; },
  };
  return pool;
}
