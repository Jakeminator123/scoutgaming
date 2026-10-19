import {createHash,createHmac} from 'node:crypto';
import {createPostgresStore} from '../packages/storage/server/postgres-store.mjs';
import {createStudioNativeAuth} from '../packages/studio-access/studio-native-auth.mjs';
import {createStudioAdminApi} from '../apps/studio/lib/studio-admin-api.mjs';
import {createMovingDriftAdminApi} from '../apps/studio/lib/moving-drift-admin.mjs';
import {createNativeStudioRequestHandlers} from '../apps/studio/lib/studio-native-runtime.mjs';
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
export async function runMovingDriftPostgresChecks({pool,restart,createPool}) {
  const target=(await pool.query("SELECT current_user AS role,current_database() AS database,inet_server_addr()::text AS address")).rows[0];
  assert.equal(target.role,'studio_qa');assert.equal(target.database,'postgres');
  assert.ok(['127.0.0.1','127.0.0.1/32','::1','::1/128'].includes(target.address));
  const environmentId='isolated-drift';
  assert.equal((await pool.query('SELECT count(*)::integer AS n FROM croupier_studio.moving_drift_control')).rows[0].n,0);
  const make=(storeOptions={})=>createMovingDriftController({store:createPostgresMovingDriftStore({pool,environmentId,...storeOptions}),profiles,capabilities:{connected:true}});
  const pristine=make({environmentId:'initial-off-fixture'}),initial=await pristine.status();
  const confirmed=await pristine.observe({revision:0,operationId:null,observedAtMs:initial.serverNowMs,
    observedProfileIds:['base'],workers:[],queuedJobs:0,busyJobs:0,
    applied:{revision:0,operationId:null,mode:'off',profileId:null,workersMin:0,workersMax:1}});
  assert.equal(confirmed.observed.status,'off');assert.equal(confirmed.nextAction.type,'none');assert.equal(confirmed.admission.allowed,false);
  const first=make(),second=make(),commands=[command(),command({commandId:'second'})];
  const race=await Promise.allSettled([first.command(commands[0]),second.command(commands[1])]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(race.find(x=>x.status==='rejected').reason.code,'drift_revision_conflict');
  const saved=await first.status(),winner=commands[race.findIndex(result=>result.status==='fulfilled')];
  const retried=await make().command(winner);
  assert.equal(retried.revision,saved.revision);assert.equal(retried.operationId,saved.operationId);
  await assert.rejects(pool.query("UPDATE croupier_studio.moving_drift_control SET state='{}'::jsonb WHERE environment_id=$1",[environmentId]),error=>error.code==='23514');
  await assert.rejects(pool.query('UPDATE croupier_studio.moving_drift_control SET revision=revision+1 WHERE environment_id=$1',[environmentId]),error=>error.code==='23514');
  const other=createMovingDriftController({store:createPostgresMovingDriftStore({pool,environmentId:'other-fixture'}),profiles});
  assert.equal((await other.status()).revision,0);
  assert.equal((await first.status()).revision,1);
  // Commit to real PostgreSQL, then inject loss of its response. Retrying must
  // read the durable JSONB command, not create another operation after restart.
  let loseCommitResponse=true;
  const uncertainPool={async connect(){
    const client=await pool.connect();
    return {async query(sql,values){
      const result=await client.query(sql,values);
      if(sql==='COMMIT'&&loseCommitResponse){loseCommitResponse=false;throw new Error('fixture_commit_response_lost');}
      return result;
    },release(){client.release();}};
  }};
  const uncertainEnvironment='uncertain-commit-fixture',uncertainCommand=command({commandId:'lost-ack'});
  await assert.rejects(make({pool:uncertainPool,environmentId:uncertainEnvironment}).command(uncertainCommand),reject('drift_store_unavailable'));
  const committed=(await pool.query('SELECT state FROM croupier_studio.moving_drift_control WHERE environment_id=$1',[uncertainEnvironment])).rows[0].state;
  assert.equal(committed.revision,1);
  pool=await restart(pool);
  const retryAfterRestart=await make().command(winner);
  assert.equal(retryAfterRestart.revision,saved.revision);assert.equal(retryAfterRestart.operationId,saved.operationId);
  const recoveredCommand=await make({environmentId:uncertainEnvironment}).command(uncertainCommand);
  assert.equal(recoveredCommand.revision,committed.revision);assert.equal(recoveredCommand.operationId,committed.operationId);
  assert.deepEqual(recoveredCommand.desired,committed.desired);
  await assert.rejects(make({environmentId:uncertainEnvironment}).command({mode:'off',expectedRevision:0,commandId:'lost-ack'}),reject('drift_command_reused'));
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
  const apiChecks=await runMovingDriftAdminSqlChecks({pool,restart,createPool});pool=apiChecks.pool;
  return {pool,checks:[...apiChecks.checks,'drift-jsonb-retry-after-ack-loss-and-restart','drift-initial-off-attestation','drift-sql-state-constraints','drift-concurrent-command-cas','drift-environment-isolation','drift-postgres-restart-expiry']};
}

/** Called only after the caller's loopback/role/database guard above. */
async function runMovingDriftAdminSqlChecks({pool,restart,createPool}) {
  const origin='https://studio.croupier-qa.invalid',apiPath='/studio/api/admin/moving-drift';
  const scope={environment:'drift-api-sql',workspaceId:'isolated-qa'};
  const env={CROUPIER_STUDIO_MOVING_DRIFT_API:'1',CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify(profiles)};
  await pool.query("INSERT INTO croupier_auth.meta(k,v) VALUES('jwt_secret',$1) ON CONFLICT(k) DO NOTHING",['c'.repeat(64)]);
  const signer=(await pool.query("SELECT v FROM croupier_auth.meta WHERE k='jwt_secret'")).rows[0].v;
  const salt='d'.repeat(32),passwordHash='e'.repeat(128);
  const owner=(await pool.query(
    "INSERT INTO croupier_auth.users(username,salt,hash,role,created_at) VALUES($1,$2,$3,'admin',$4) RETURNING id,username",
    ['drift-api-sql-owner',salt,passwordHash,new Date().toISOString()])).rows[0];
  const mint=async()=>{
    const epoch=Number((await pool.query('SELECT epoch FROM croupier_auth.bo_auth_epochs WHERE user_id=$1',[owner.id])).rows[0]?.epoch??0);
    const body=Buffer.from(JSON.stringify({aud:'backoffice',sub:owner.username,role:'admin',auth_epoch:epoch,
      source_stamp:createHash('sha256').update(salt+':'+passwordHash).digest('hex'),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
    const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    return header+'.'+body+'.'+createHmac('sha256',Buffer.from(signer,'hex')).update(header+'.'+body).digest('base64url');
  };
  let token=await mint(),apiPool=createPool?createPool():pool;
  const ownsPool=!!createPool;
  const build=(rollback=false)=>{
    const store=createPostgresStore({pool:apiPool});
    const authorize=createStudioNativeAuth({boDb:store.boDb,scope});
    const service=createMovingDriftAdminApi({boDb:store.boDb,scope,env});
    assert.equal(service.configured,true);
    const api=createStudioAdminApi({authorize,handlers:service.handlers,gates:service.gates,
      allowedOrigins:[origin],publicHosts:[new URL(origin).host],
      mutationTransaction:work=>store.boDb.transaction(async()=>{
        const value=await work();if(rollback)throw Error('private_rollback_fixture');return value;
      })});
    return createNativeStudioRequestHandlers({configuration:()=>({
      allowedOrigins:[origin,'https://lab.croupier-qa.invalid'],publicHosts:[new URL(origin).host,'lab.croupier-qa.invalid'],
      apiBase:'/studio/api/admin',authBase:'/studio/api/auth'}),runtime:async()=>({api})});
  };
  const request=(body,headers={})=>new Request(origin+apiPath,{method:body?'POST':'GET',
    ...(body?{body:JSON.stringify(body)}:{}),headers:{cookie:'bo_jwt='+token,origin,
      'sec-fetch-site':'same-origin','content-type':'application/json',...headers}});
  const stop={mode:'off',expectedRevision:0,commandId:'api-sql-stop'};
  try {
    let handler=build(),response=await handler.handleNativeAdmin(request());
    assert.equal(response.status,200);const initial=await response.json();
    assert.equal(initial.revision,0);assert.equal(initial.observed.status,'unknown');
    assert.equal(initial.capabilities.connected,false);assert.equal(initial.admission.allowed,false);
    response=await handler.handleNativeAdmin(request(stop,{origin:'https://evil.croupier-qa.invalid'}));
    assert.equal(response.status,403);
    assert.equal(Number((await pool.query('SELECT revision FROM croupier_studio.moving_drift_control WHERE environment_id=$1',[scope.environment])).rows[0].revision),0);
    const race=await Promise.all(Array.from({length:4},(_,index)=>
      handler.handleNativeAdmin(request({...stop,commandId:'api-race-'+index}))));
    assert.deepEqual(race.map(row=>row.status).sort(),[200,409,409,409]);
    const winnerIndex=race.findIndex(row=>row.status===200),winningCommand={...stop,commandId:'api-race-'+winnerIndex};
    const saved=await race[winnerIndex].json();assert.equal(saved.revision,1);
    assert.equal(saved.desired.mode,'off');assert.equal(saved.observed.status,'unknown');
    assert.equal('nextAction' in saved,false);assert.equal(JSON.stringify(saved).includes('endpoint-test'),false);
    assert.equal(saved.admission.allowed,false);
    const rollback=build(true);
    response=await rollback.handleNativeAdmin(request({mode:'off',expectedRevision:1,commandId:'rollback-command'}));
    assert.equal(response.status,500);
    assert.equal(Number((await pool.query('SELECT revision FROM croupier_studio.moving_drift_control WHERE environment_id=$1',[scope.environment])).rows[0].revision),1);
    await pool.query('INSERT INTO croupier_auth.bo_auth_epochs(user_id,epoch) VALUES($1,1) ON CONFLICT(user_id) DO UPDATE SET epoch=croupier_auth.bo_auth_epochs.epoch+1',[owner.id]);
    for(const body of [undefined,{mode:'off',expectedRevision:1,commandId:'revoked-command'}]) {
      response=await handler.handleNativeAdmin(request(body));assert.equal(response.status,401);
    }
    token=await mint();
    if(ownsPool)await apiPool.end();
    pool=await restart(pool);apiPool=createPool?createPool():pool;handler=build();
    response=await handler.handleNativeAdmin(request(winningCommand));
    assert.equal(response.status,200);const restored=await response.json();
    assert.equal(restored.revision,saved.revision);assert.equal(restored.operationId,saved.operationId);
    assert.deepEqual(restored.desired,saved.desired);assert.equal(restored.admission.allowed,false);
    await pool.query('ALTER TABLE croupier_studio.moving_drift_control RENAME TO moving_drift_fixture_hidden');
    try {
      response=await handler.handleNativeAdmin(request());
      assert.equal(response.status,503);
      assert.deepEqual(await response.json(),{error:'Driftläget kan inte läsas eller sparas just nu.',code:'drift_store_unavailable'});
    } finally {await pool.query('ALTER TABLE croupier_studio.moving_drift_fixture_hidden RENAME TO moving_drift_control');}
    return {pool,checks:['drift-api-native-auth-csrf','drift-api-single-connection-concurrent-cas',
      'drift-api-shared-transaction-rollback','drift-api-session-revocation',
      'drift-api-postgres-restart-retry','drift-api-optional-schema-fails-closed']};
  } finally {if(ownsPool)await apiPool.end();}
}