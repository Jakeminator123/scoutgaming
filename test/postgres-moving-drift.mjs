import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {createPostgresMovingDriftStore} from '../services/game/postgres-moving-drift.mjs';
import {createMovingDriftController} from '../services/game/moving-drift-controller.mjs';

const profiles=[{id:'base',label:'Bas',endpointId:'endpoint-test',releaseDigest:'a'.repeat(64),bankHash:'b'.repeat(64)}];
const command=(extra={})=>({mode:'saving',profileId:'base',expectedRevision:0,commandId:'first',...extra});
const reject=code=>error=>error.code===code&&error.message===code;
function fakePool({failOn,commit='COMMIT'}={}) {
  const trace=[];let row=null,released=0,working;
  return {trace,get released(){return released;},async connect(){return {
    async query(sql,values=[]) {
      const marker=/moving-drift:([a-z]+)/.exec(sql)?.[1]??sql.split(' ')[0];trace.push({marker,values});
      if(marker===failOn) throw new Error('private database credential');
      if(marker==='BEGIN') working=structuredClone(row);
      if(marker==='read') return {rows:working?[working]:[]};
      if(marker==='clock') return {rows:[{now_ms:'1792404000000'}]};
      if(marker==='write') working={revision:values[1],state:JSON.parse(values[2])};
      if(marker==='COMMIT') {if(commit==='COMMIT')row=working;return {command:commit};}
      return {rows:[]};
    },
    release(){released++;}
  };}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  test('store is inert until called, scopes its lock and row, and masks driver errors',async()=>{
    const pool=fakePool(),store=createPostgresMovingDriftStore({pool,environmentId:'isolated-drift'});
    assert.deepEqual(pool.trace,[]);
    const controller=createMovingDriftController({store,profiles,capabilities:{connected:true}});
    await controller.command(command());
    assert.deepEqual(pool.trace.map(x=>x.marker),['BEGIN','SET','lock','read','clock','write','COMMIT']);
    assert.deepEqual(pool.trace.find(x=>x.marker==='lock').values,['croupier:moving-drift:isolated-drift']);
    assert.deepEqual(pool.trace.find(x=>x.marker==='read').values,['isolated-drift']);
    assert.equal(pool.released,1);
    const bad=fakePool({failOn:'write'});
    await assert.rejects(createMovingDriftController({store:createPostgresMovingDriftStore({pool:bad,environmentId:'isolated-drift'}),profiles})
      .command({mode:'off',expectedRevision:0,commandId:'stop'}),reject('drift_store_unavailable'));
    assert.equal(bad.trace.at(-1).marker,'ROLLBACK');
    assert.equal(bad.released,1);
  });
  test('transaction cannot report success on rolled-back COMMIT or asynchronous side effects',async()=>{
    const pool=fakePool({commit:'ROLLBACK'}),store=createPostgresMovingDriftStore({pool,environmentId:'isolated-drift'});
    await assert.rejects(createMovingDriftController({store,profiles}).status(),reject('drift_store_unavailable'));
    await assert.rejects(store.transact(()=>Promise.resolve({state:{}})),reject('drift_invalid_state'));
    assert.throws(()=>createPostgresMovingDriftStore({pool,environmentId:'production/other'}),reject('drift_invalid_configuration'));
  });
}

/** Caller must supply the existing isolated localhost QA cluster, already migrated.
 * No environment variables, remote DB discovery or database creation here.
 */
export async function runMovingDriftPostgresChecks({pool,restart}) {
  const target=(await pool.query("SELECT current_user AS role,current_database() AS database,inet_server_addr()::text AS address")).rows[0];
  assert.equal(target.role,'studio_qa');assert.equal(target.database,'postgres');
  assert.ok(['127.0.0.1','127.0.0.1/32','::1','::1/128'].includes(target.address));
  const environmentId='isolated-drift';
  assert.equal((await pool.query('SELECT count(*)::integer AS n FROM croupier_studio.moving_drift_control')).rows[0].n,0);
  const make=()=>createMovingDriftController({store:createPostgresMovingDriftStore({pool,environmentId}),profiles,capabilities:{connected:true}});
  const first=make(),second=make();
  const race=await Promise.allSettled([first.command(command()),second.command(command({commandId:'second'}))]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(race.find(x=>x.status==='rejected').reason.code,'drift_revision_conflict');
  const saved=await first.status();
  await assert.rejects(pool.query("UPDATE croupier_studio.moving_drift_control SET state='{}'::jsonb WHERE environment_id=$1",[environmentId]),error=>error.code==='23514');
  await assert.rejects(pool.query('UPDATE croupier_studio.moving_drift_control SET revision=revision+1 WHERE environment_id=$1',[environmentId]),error=>error.code==='23514');
  const other=createMovingDriftController({store:createPostgresMovingDriftStore({pool,environmentId:'other-fixture'}),profiles});
  assert.equal((await other.status()).revision,0);
  assert.equal((await first.status()).revision,1);
  // Seed an already expired desired period, not provider/runtime data.
  await pool.query(`UPDATE croupier_studio.moving_drift_control
    SET state=jsonb_set(jsonb_set(state,'{desired,mode}','"warm"'::jsonb),'{desired,endsAtMs}',
      to_jsonb(floor(extract(epoch FROM clock_timestamp())*1000)::bigint-1000))
    WHERE environment_id=$1`,[environmentId]);
  pool=await restart(pool);
  const recovered=await make().status();
  assert.equal(recovered.revision,saved.revision+1);
  assert.equal(recovered.desired.mode,'off');
  assert.equal(recovered.admission.allowed,false);
  assert.equal(recovered.observed.status,'unknown');
  const row=(await pool.query('SELECT revision,state FROM croupier_studio.moving_drift_control WHERE environment_id=$1',[environmentId])).rows[0];
  assert.equal(Number(row.revision),recovered.revision);assert.equal(row.state.desired.mode,'off');
  return {pool,checks:['drift-sql-state-constraints','drift-concurrent-command-cas','drift-environment-isolation','drift-postgres-restart-expiry']};
}
