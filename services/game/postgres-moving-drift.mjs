import {driftError} from '../../packages/presentation/contracts/moving-drift.mjs';

/** Explicit pool or trusted transaction adapter; no credentials/schema bootstrap.
 * Native Admin supplies its existing SQL transaction so auth and state share
 * one connection, lock and commit. Callbacks remain synchronous and effect-free.
 */
export function createPostgresMovingDriftStore({pool,environmentId,transaction}={}) {
  if((transaction===undefined?typeof pool?.connect!=='function':typeof transaction!=='function')
    ||typeof environmentId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(environmentId)) {
    throw driftError('drift_invalid_configuration',422);
  }
  async function transition(client,work) {
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
    if(JSON.stringify(previous)!==json) await client.query(
      '/* moving-drift:write */ INSERT INTO croupier_studio.moving_drift_control (environment_id,revision,state) VALUES ($1,$2,$3::jsonb) ON CONFLICT (environment_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state',
      [environmentId,result.state.revision,json]);
    return result.value;
  }
  return Object.freeze({async transact(work) {
    let client,begun=false;
    try {
      if(transaction) return await transaction(client=>transition(client,work));
      client=await pool.connect();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
      const value=await transition(client,work);
      const committed=await client.query('COMMIT');begun=false;
      if(committed.command!=='COMMIT') throw driftError('drift_store_unavailable',503);
      return value;
    } catch(error) {
      if(begun) try {await client.query('ROLLBACK');} catch {}
      if(typeof error?.code==='string'&&/^drift_[a-z_]+$/.test(error.code)) throw error;
      throw driftError('drift_store_unavailable',503);
    } finally {try {client?.release();} catch {}}
  }});
}