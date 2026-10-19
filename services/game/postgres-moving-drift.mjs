import {driftError} from '../../packages/presentation/contracts/moving-drift.mjs';

/** Uses an explicitly supplied pool; never reads credentials or bootstraps schema.
 * The advisory/row lock protects the shared environment, including first insert.
 * Only synchronous control-plane transitions run under the lock, no provider I/O.
 */
export function createPostgresMovingDriftStore({pool,environmentId}={}) {
  if(typeof pool?.connect!=='function'||typeof environmentId!=='string'
    ||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(environmentId)) throw driftError('drift_invalid_configuration',422);
  return Object.freeze({async transact(work) {
    let client,begun=false;
    try {
      client=await pool.connect();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
      await client.query("SET LOCAL statement_timeout = '5000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
      await client.query('/* moving-drift:lock */ SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['croupier:moving-drift:'+environmentId]);
      const rows=(await client.query('/* moving-drift:read */ SELECT revision,state FROM croupier_studio.moving_drift_control WHERE environment_id=$1 FOR UPDATE',[environmentId])).rows;
      const raw=(await client.query('/* moving-drift:clock */ SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now_ms')).rows[0]?.now_ms;
      const now=Number(raw);
      if(raw===null||raw===undefined||!Number.isSafeInteger(now)||now<0||rows.length>1
        ||rows[0]&&Number(rows[0].revision)!==rows[0].state?.revision) throw driftError('drift_invalid_state',503);
      const previous=rows[0]?.state??null;
      const result=work(structuredClone(previous),now);
      if(result?.then||!result?.state||!Number.isSafeInteger(result.state.revision)||result.state.revision<0
        ||result.state.schemaVersion!==1) throw driftError('drift_invalid_state',503);
      const json=JSON.stringify(result.state);
      if(Buffer.byteLength(json)>32768) throw driftError('drift_invalid_state',503);
      if(JSON.stringify(previous)!==json) await client.query(`/* moving-drift:write */ INSERT INTO croupier_studio.moving_drift_control (environment_id,revision,state)
        VALUES ($1,$2,$3::jsonb) ON CONFLICT (environment_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state`,
        [environmentId,result.state.revision,json]);
      const committed=await client.query('COMMIT');begun=false;
      if(committed.command!=='COMMIT') throw driftError('drift_store_unavailable',503);
      return result.value;
    } catch(error) {
      if(begun) try {await client.query('ROLLBACK');} catch {}
      if(typeof error?.code==='string'&&/^drift_[a-z_]+$/.test(error.code)) throw error;
      throw driftError('drift_store_unavailable',503);
    } finally {try {client?.release();} catch {}}
  }});
}
