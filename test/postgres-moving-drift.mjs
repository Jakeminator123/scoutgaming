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

const profiles=[{id:'base',label:'Bas',dealerId:'dragan',endpointId:'endpoint-test',releaseDigest:'a'.repeat(64),bankHash:'b'.repeat(64)}];
const dealerId='dragan';
const paowProfiles=[{id:'paow',label:'Paow',dealerId:'paow',endpointId:'endpoint-paow',releaseDigest:'a'.repeat(64),bankHash:'c'.repeat(64)}];
const command=(extra={})=>({mode:'saving',profileId:'base',expectedRevision:0,commandId:'first',...extra});
const reject=code=>error=>error.code===code&&error.message===code;
const OFF={mode:'off',profileId:null,endsAtMs:null};
function fakePool({failOn,commit='COMMIT',row=null}={}) {
  const trace=[];let released=0,working;
  return {trace,get released(){return released;},get row(){return row;},set row(value){row=value;},async connect(){return {
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
    const pool=fakePool(),store=createPostgresMovingDriftStore({pool,environmentId:'isolated-drift',dealerId});
    assert.deepEqual(pool.trace,[]);
    const controller=createMovingDriftController({store,profiles,capabilities:{connected:true}});
    await controller.command(command());
    assert.deepEqual(pool.trace.map(x=>x.marker),['BEGIN','SET','lock','read','clock','write','COMMIT']);
    assert.deepEqual(pool.trace.find(x=>x.marker==='lock').values,['croupier:moving-drift:isolated-drift']);
    assert.deepEqual(pool.trace.find(x=>x.marker==='read').values,['isolated-drift']);
    assert.equal(pool.released,1);
    const bad=fakePool({failOn:'write'});
    await assert.rejects(createMovingDriftController({store:createPostgresMovingDriftStore({pool:bad,environmentId:'isolated-drift',dealerId}),profiles})
      .command({mode:'off',expectedRevision:0,commandId:'stop'}),reject('drift_store_unavailable'));
    assert.equal(bad.trace.at(-1).marker,'ROLLBACK');
    assert.equal(bad.released,1);
  });
  test('transaction cannot report success on rolled-back COMMIT or asynchronous side effects',async()=>{
    const pool=fakePool({commit:'ROLLBACK'}),store=createPostgresMovingDriftStore({pool,environmentId:'isolated-drift',dealerId});
    await assert.rejects(createMovingDriftController({store,profiles}).status(),reject('drift_store_unavailable'));
    await assert.rejects(store.transact(()=>Promise.resolve({state:{}})),reject('drift_invalid_state'));
    for(const options of [{environmentId:'production/other',dealerId},{environmentId:'isolated-drift'},
      {environmentId:'isolated-drift',dealerId:'Dragan'},{environmentId:'isolated-drift',dealerId:'__proto__'}])
      assert.throws(()=>createPostgresMovingDriftStore({pool,...options}),reject('drift_invalid_configuration'));
  });
  test('two dealers share one environment row and lock but never read or change each other',async()=>{
    const pool=fakePool(),make=(id,catalogue)=>createMovingDriftController({capabilities:{connected:true},profiles:catalogue,
      store:createPostgresMovingDriftStore({pool,environmentId:'isolated-drift',dealerId:id})});
    const dragan=make('dragan',profiles),paow=make('paow',paowProfiles);
    const saving=await dragan.command(command());
    assert.equal(saving.desired.mode,'saving');assert.equal(saving.revision,1);
    // Paow starts Off at its own revision 0, although the row has been written.
    const paowStatus=await paow.status();
    assert.equal(paowStatus.revision,0);assert.equal(paowStatus.desired.mode,'off');
    await paow.command({mode:'saving',profileId:'paow',expectedRevision:0,commandId:'paow-first'});
    const stopped=await paow.command({mode:'off',expectedRevision:1,commandId:'paow-stop'});
    assert.equal(stopped.revision,2);
    // A command never crosses dealers: Dragan's profile is unknown to Paow.
    await assert.rejects(paow.command({mode:'saving',profileId:'base',expectedRevision:2,commandId:'cross'}),reject('drift_unknown_profile'));
    const after=await dragan.status();
    assert.equal(after.revision,saving.revision);assert.equal(after.operationId,saving.operationId);assert.equal(after.desired.mode,'saving');
    const row=pool.row;
    assert.deepEqual(Object.keys(row.state.dealers).sort(),['dragan','paow']);
    assert.equal(row.state.schemaVersion,1);assert.equal(row.state.revision,row.revision);assert.deepEqual(row.state.desired,OFF);
    assert.equal(row.state.dealers.dragan.desired.mode,'saving');assert.equal(row.state.dealers.paow.desired.mode,'off');
    // An unchanged dealer state is not rewritten by a read.
    const writes=pool.trace.filter(x=>x.marker==='write').length;await dragan.status();
    assert.equal(pool.trace.filter(x=>x.marker==='write').length,writes);
  });
  test('a single-dealer row from before per-dealer state is replaced and every dealer starts Off',async()=>{
    const legacy={schemaVersion:1,revision:7,operationId:'11111111-1111-4111-8111-111111111111',
      desired:{mode:'saving',profileId:'base',endsAtMs:null},observation:null,updatedAtMs:1,lastCommand:null,
      cost:{estimatedMicroUsd:null,source:null,quotedAtMs:null,shutdownTailMs:null},
      execution:{holderId:'old-process',profileId:'base',fence:4,leaseUntilMs:1792404060000,catalogueFingerprint:'f'.repeat(64),observedAtMs:null}};
    const pool=fakePool({row:{revision:'7',state:legacy}});
    const controller=createMovingDriftController({profiles,capabilities:{connected:true,requireExecutor:true},
      store:createPostgresMovingDriftStore({pool,environmentId:'isolated-drift',dealerId})});
    const status=await controller.status();
    assert.equal(status.revision,0);assert.equal(status.desired.mode,'off');assert.equal(status.admission.allowed,false);
    assert.equal(pool.row.revision,8);
    assert.deepEqual(Object.keys(pool.row.state).sort(),['dealers','desired','revision','schemaVersion']);
    assert.deepEqual(pool.row.state.desired,OFF);
    // The old process's top-level lease is gone, so it cannot publish evidence.
    await assert.rejects(controller.guardAdmission({phase:'reserve',sessionId:'session-1',endpointId:'endpoint-test',
      admission:{revision:7,operationId:legacy.operationId,profileId:'base',endpointId:'endpoint-test'}}),reject('drift_not_admitting'));
  });
  test('malformed dealer containers and more than eight dealers fail closed without a write',async()=>{
    const base={schemaVersion:1,revision:3,desired:OFF};
    for(const dealers of [[],null,'dragan',{Dragan:{}},{dragan:[]},{dragan:null},
      Object.fromEntries(Array.from({length:9},(_,i)=>['dealer-'+i,{schemaVersion:1,revision:0,desired:OFF}]))]) {
      const pool=fakePool({row:{revision:'3',state:{...base,dealers}}});
      await assert.rejects(createMovingDriftController({profiles,store:createPostgresMovingDriftStore({pool,environmentId:'isolated-drift',dealerId})}).status(),
        reject('drift_invalid_state'));
      assert.equal(pool.trace.some(x=>x.marker==='write'),false);
    }
    const full=Object.fromEntries(Array.from({length:8},(_,i)=>['dealer-'+i,{schemaVersion:1,revision:0,desired:OFF}]));
    const pool=fakePool({row:{revision:'3',state:{...base,dealers:full}}});
    await assert.rejects(createMovingDriftController({profiles,store:createPostgresMovingDriftStore({pool,environmentId:'isolated-drift',dealerId})}).status(),
      reject('drift_invalid_state'));
    assert.equal(pool.trace.some(x=>x.marker==='write'),false);
  });
  test('eight dealers with maximum identifiers and an observed worker fit the 32 KiB row of migration 016',async()=>{
    const pool=fakePool(),hex=c=>c.repeat(64),long=(prefix,n)=>(prefix+'x'.repeat(n)).slice(0,n);
    for(let i=0;i<8;i++) {
      const id=long('d'+i+'-',40),profile={id:long('p'+i+'-',32),label:'L'.repeat(80),dealerId:id,endpointId:long('e'+i,128),
        releaseDigest:hex('a'),bankHash:hex('b')};
      const controller=createMovingDriftController({profiles:[profile],capabilities:{connected:true,requireExecutor:true},
        store:createPostgresMovingDriftStore({pool,environmentId:'isolated-drift',dealerId:id})});
      const execution=await controller.claimExecution({holderId:long('h'+i,128),profileId:profile.id});
      let status=await controller.observe({revision:0,operationId:null,execution,observedAtMs:1792404000000,observedProfileIds:[profile.id],
        workers:[],busyJobs:0,queuedJobs:0,applied:{revision:0,operationId:null,mode:'off',profileId:null,workersMin:0,workersMax:1}});
      status=await controller.command({mode:'saving',profileId:profile.id,expectedRevision:status.revision,commandId:long('c'+i,64)});
      await controller.observe({revision:status.revision,operationId:status.operationId,execution,observedAtMs:1792404000000,
        observedProfileIds:[profile.id],busyJobs:0,queuedJobs:0,providerDeadlineMs:9007199254740991,budgetCoveredUntilMs:9007199254740991,
        workers:[{id:long('w'+i,128),profileId:profile.id,state:'initializing',gpu:'G'.repeat(80),releaseDigest:hex('a'),bankHash:hex('b'),modelReady:true}],
        applied:{revision:status.revision,operationId:status.operationId,mode:'saving',profileId:profile.id,workersMin:0,workersMax:1}});
    }
    const bytes=Buffer.byteLength(JSON.stringify(pool.row.state));
    assert.equal(Object.keys(pool.row.state.dealers).length,8);
    assert.ok(bytes<16384,`${bytes} bytes`);
  });
  test('the dealer container satisfies the unchanged migration 016 table and its constraints in PostgreSQL',async t=>{
    const {createPglitePool}=await import('./fixtures/pglite-pool.mjs');
    const {readFile}=await import('node:fs/promises');
    const pool=await createPglitePool({migrations:[]});t.after(()=>pool.end());
    await pool.query('CREATE SCHEMA IF NOT EXISTS croupier_studio');
    await pool.query(await readFile(new URL('../ops/neon-studio/016-moving-drift-control.sql',import.meta.url),'utf8'));
    await pool.query("INSERT INTO croupier_studio.moving_drift_control(environment_id,revision,state) VALUES('isolated-drift',5,$1::jsonb)",
      [JSON.stringify({schemaVersion:1,revision:5,operationId:null,desired:{mode:'saving',profileId:'base',endsAtMs:null}})]);
    const make=(id,catalogue)=>createMovingDriftController({capabilities:{connected:true},profiles:catalogue,
      store:createPostgresMovingDriftStore({pool,environmentId:'isolated-drift',dealerId:id})});
    const dragan=make('dragan',profiles),paow=make('paow',paowProfiles);
    assert.equal((await dragan.status()).desired.mode,'off');
    await dragan.command(command());
    await paow.command({mode:'saving',profileId:'paow',expectedRevision:0,commandId:'paow-first'});
    const {rows:[row]}=await pool.query("SELECT revision,state FROM croupier_studio.moving_drift_control WHERE environment_id='isolated-drift'");
    assert.equal(Number(row.revision),8);assert.equal(row.state.revision,8);assert.deepEqual(row.state.desired,OFF);
    assert.equal(row.state.dealers.dragan.desired.profileId,'base');assert.equal(row.state.dealers.paow.desired.profileId,'paow');
    assert.equal((await dragan.status()).revision,1);assert.equal((await paow.status()).revision,1);
    // The table's own checks still bind the row revision, so no writer can skip them.
    await assert.rejects(pool.query("UPDATE croupier_studio.moving_drift_control SET revision=revision+1 WHERE environment_id='isolated-drift'"),
      error=>error.code==='23514');
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
  const make=(storeOptions={})=>createMovingDriftController({store:createPostgresMovingDriftStore({pool,environmentId,dealerId,...storeOptions}),profiles,capabilities:{connected:true}});
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
  const other=createMovingDriftController({store:createPostgresMovingDriftStore({pool,environmentId:'other-fixture',dealerId}),profiles});
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
  const committed=(await pool.query('SELECT state FROM croupier_studio.moving_drift_control WHERE environment_id=$1',[uncertainEnvironment])).rows[0].state.dealers[dealerId];
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
    SET state=jsonb_set(jsonb_set(state,'{dealers,dragan,desired,mode}','"warm"'::jsonb),'{dealers,dragan,desired,endsAtMs}',
      to_jsonb(floor(extract(epoch FROM clock_timestamp())*1000)::bigint-1000))
    WHERE environment_id=$1`,[environmentId]);
  pool=await restart(pool);
  const recovered=await make().status();
  assert.equal(recovered.revision,saved.revision+1);
  assert.equal(recovered.desired.mode,'off');
  assert.equal(recovered.admission.allowed,false);
  assert.equal(recovered.observed.status,'unknown');
  const row=(await pool.query('SELECT revision,state FROM croupier_studio.moving_drift_control WHERE environment_id=$1',[environmentId])).rows[0];
  assert.equal(Number(row.revision),row.state.revision);assert.equal(row.state.dealers.dragan.revision,recovered.revision);
  assert.equal(row.state.dealers.dragan.desired.mode,'off');assert.deepEqual(row.state.desired,{mode:'off',profileId:null,endsAtMs:null});
  // Two dealers in one environment: concurrent commands on separate connections
  // serialize on the environment lock and neither overwrites the other.
  const dealerEnvironment='dealer-row-fixture';
  const forDealer=(id,catalogue)=>createMovingDriftController({capabilities:{connected:true},profiles:catalogue,
    store:createPostgresMovingDriftStore({pool,environmentId:dealerEnvironment,dealerId:id})});
  const pair=await Promise.all([forDealer('dragan',profiles).command(command({commandId:'dealer-dragan'})),
    forDealer('paow',paowProfiles).command({mode:'saving',profileId:'paow',expectedRevision:0,commandId:'dealer-paow'})]);
  assert.deepEqual(pair.map(status=>status.revision),[1,1]);
  const shared=(await pool.query('SELECT revision,state FROM croupier_studio.moving_drift_control WHERE environment_id=$1',[dealerEnvironment])).rows[0];
  assert.deepEqual(Object.keys(shared.state.dealers).sort(),['dragan','paow']);
  assert.equal(shared.state.dealers.dragan.desired.profileId,'base');assert.equal(shared.state.dealers.paow.desired.profileId,'paow');
  assert.equal((await forDealer('dragan',profiles).status()).operationId,pair[0].operationId);
  const apiChecks=await runMovingDriftAdminSqlChecks({pool,restart,createPool});pool=apiChecks.pool;
  return {pool,checks:[...apiChecks.checks,'drift-dealer-row-concurrency','drift-jsonb-retry-after-ack-loss-and-restart','drift-initial-off-attestation','drift-sql-state-constraints','drift-concurrent-command-cas','drift-environment-isolation','drift-postgres-restart-expiry']};
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