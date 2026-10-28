import {driftError,MOVING_DRIFT_DEALER_ID} from '../../packages/presentation/contracts/moving-drift.mjs';

// The configuration admits at most eight profiles, one per dealer.
export const MOVING_DRIFT_MAX_DEALERS=8;
// Migration 016 refuses octet_length(state::text) above 32768. The store stops
// at 28 KiB, and each dealer slot ({"<id>": state}) gets an equal share, so a
// full slot fails only its own dealer's write and never blocks another dealer:
// 8 x 3400 plus the container stays below the row limit.
export const MOVING_DRIFT_ROW_LIMIT=28672;
export const MOVING_DRIFT_DEALER_LIMIT=3400;
/** Bytes of PostgreSQL's jsonb text output, which the CHECK measures: compact
 * JSON plus one space after every ':' and every ','. Exact for the drift state
 * (strings, booleans, null and safe integers). */
export function jsonbTextBytes(value) {
  const json=JSON.stringify(value);let spaces=0;
  const walk=node=>{
    if(Array.isArray(node)){spaces+=Math.max(0,node.length-1);node.forEach(walk);}
    else if(node&&typeof node==='object'){const keys=Object.keys(node);spaces+=2*keys.length-(keys.length?1:0);keys.forEach(key=>walk(node[key]));}
  };
  walk(JSON.parse(json));
  return Buffer.byteLength(json)+spaces;
}
const OFF=Object.freeze({mode:'off',profileId:null,endsAtMs:null});
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;

/** The environment row holds one controller state per dealer (no DDL: the
 * container keeps migration 016's required keys and its 32 KiB limit):
 * {schemaVersion:1, revision:<row revision>, desired:Off, dealers:{<dealerId>:<state>}}.
 * Each dealer state is the unchanged single-dealer controller state. The
 * top-level desired is always Off, so an older single-dealer process reading
 * this row admits nothing. A row written before per-dealer state (no
 * `dealers`) carries no dealer and is replaced by the first write: every
 * dealer then starts Off. Throws drift_invalid_state for anything else.
 */
function dealerStates(row) {
  if(row===null) return null;
  if(!Object.hasOwn(row,'dealers')) return null;
  const dealers=row.dealers,ids=plain(dealers)?Object.keys(dealers):null;
  if(!ids||ids.length>MOVING_DRIFT_MAX_DEALERS||ids.some(id=>!MOVING_DRIFT_DEALER_ID.test(id)||!plain(dealers[id])))
    throw driftError('drift_invalid_state',503);
  return dealers;
}

/** Explicit pool or trusted transaction adapter; no credentials/schema bootstrap.
 * Native Admin supplies its existing SQL transaction so auth and state share
 * one connection, lock and commit. Callbacks remain synchronous and effect-free.
 * One environment lock serializes every dealer; a callback sees only its dealer.
 */
export function createPostgresMovingDriftStore({pool,environmentId,transaction,dealerId}={}) {
  if((transaction===undefined?typeof pool?.connect!=='function':typeof transaction!=='function')
    ||typeof environmentId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(environmentId)
    ||typeof dealerId!=='string'||!MOVING_DRIFT_DEALER_ID.test(dealerId)) {
    throw driftError('drift_invalid_configuration',422);
  }
  async function transition(client,work) {
    await client.query("SET LOCAL statement_timeout = '5000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
    await client.query('/* moving-drift:lock */ SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['croupier:moving-drift:'+environmentId]);
    const rows=(await client.query('/* moving-drift:read */ SELECT revision,state FROM croupier_studio.moving_drift_control WHERE environment_id=$1 FOR UPDATE',[environmentId])).rows;
    const raw=(await client.query('/* moving-drift:clock */ SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now_ms')).rows[0]?.now_ms;
    const now=Number(raw);
    if(raw===null||raw===undefined||!Number.isSafeInteger(now)||now<0||rows.length>1
      ||rows[0]&&(Number(rows[0].revision)!==rows[0].state?.revision||!plain(rows[0].state))) throw driftError('drift_invalid_state',503);
    const row=rows[0]?.state??null,dealers=dealerStates(row);
    const previous=dealers&&Object.hasOwn(dealers,dealerId)?dealers[dealerId]:null;
    const result=work(structuredClone(previous),now);
    if(result?.then||!result?.state||!Number.isSafeInteger(result.state.revision)||result.state.revision<0
      ||result.state.schemaVersion!==1) throw driftError('drift_invalid_state',503);
    if(dealers&&JSON.stringify(previous)===JSON.stringify(result.state)) return result.value;
    const next={...(dealers??{}),[dealerId]:result.state};
    if(Object.keys(next).length>MOVING_DRIFT_MAX_DEALERS
      ||jsonbTextBytes({[dealerId]:result.state})>MOVING_DRIFT_DEALER_LIMIT) throw driftError('drift_invalid_state',503);
    const revision=row===null?0:row.revision+1;
    if(!Number.isSafeInteger(revision)) throw driftError('drift_invalid_state',503);
    const state={schemaVersion:1,revision,desired:OFF,dealers:next},json=JSON.stringify(state);
    if(jsonbTextBytes(state)>MOVING_DRIFT_ROW_LIMIT) throw driftError('drift_invalid_state',503);
    await client.query(
      '/* moving-drift:write */ INSERT INTO croupier_studio.moving_drift_control (environment_id,revision,state) VALUES ($1,$2,$3::jsonb) ON CONFLICT (environment_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state',
      [environmentId,revision,json]);
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
