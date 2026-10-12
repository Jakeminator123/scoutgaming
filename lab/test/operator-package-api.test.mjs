import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {publicPackageBranding,readPackagePresentation,withPackagePresentation} from '../../web/storage/presentation-package.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { createSeedProject as createHistoricalProject, addDealer, defaultPresentationLane } from '../lib/studio-model.mjs';
import { createOperatorPackageApi, fixtureLaneOperators, openWritableOperatorStore } from '../lib/operator-package-api.mjs';
import { createOperatorStore } from '../../web/storage/operator-store.mjs';
import { operatorMemoryPool } from './fixtures/operator-memory-pool.mjs';

// Test fixture selects its historical dealer explicitly; product startup has no composition.
function createSeedProject() {
  const project = createHistoricalProject();
  project.lanes = [defaultPresentationLane('astrid')];
  return project;
}
const origin = 'https://studio.example';
const scope = { environment: 'isolated-fixture', workspaceId: 'qa' };
const session = { user: 'lane-actor', role: 'admin', scope };
const clock = () => 1_700_000_000_000;

const memoryPool = operatorMemoryPool;

function apiFor(pool, project = createSeedProject(), storeFactory) {
  const lane = createOperatorPackageApi({ pool, scope, project, now: clock, storeFactory });
  const api = createStudioAdminApi({
    authorize: async () => session,
    mutationTransaction: work => work(),
    allowedOrigins: [origin],
    publicHosts: ['studio.example'],
    handlers: lane.handlers,
  });
  return { api, lane };
}

function request(action, body, headers = {}) {
  return new Request(`${origin}/studio/api/admin/${action}`, {
    method: 'POST',
    headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('fixture keeps demo-north, demo-south and SG test', () => {
  const operators = fixtureLaneOperators();
  assert.deepEqual(operators.map(item => item.slug), ['demo-north', 'demo-south', 'sg-test']);
  assert.deepEqual(operators.find(item => item.slug === 'sg-test'), { id: 'sg-test', slug: 'sg-test', name: 'SG test game provider' });
});

test('a pool with connect is the store client; query-only is 503', async () => {
  const pool = memoryPool();
  let seen;
  const storeFactory = options => { seen = options; return createOperatorStore(options); };
  const opened = await openWritableOperatorStore({ pool, scope, now: clock, storeFactory });
  assert.equal(seen.sql, pool);
  assert.equal(typeof pool.connect, 'function');
  assert.equal(typeof opened.listOperators, 'function');
  await assert.rejects(
    openWritableOperatorStore({ pool: { query: pool.query }, scope, now: clock, storeFactory }),
    error => error.statusCode === 503,
  );
  assert.equal(seen.sql, pool);
});

test('admin POST uses the session actor, refuses a query-only pool, and keeps the Origin gate', async () => {
  const pool = memoryPool();
  let actor;
  const storeFactory = async options => {
    assert.equal(options.sql, pool);
    const store = await createOperatorStore(options);
    return {
      createOperator: input => { actor = input.actor; return store.createOperator(input); },
      publishPackage: input => { actor = input.actor; return store.publishPackage(input); },
      listOperators: () => store.listOperators(),
    };
  };
  const { api } = apiFor(pool, createSeedProject(), storeFactory);
  const missingOrigin = new Request(`${origin}/studio/api/admin/operator-create-demo`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }, body: '{}',
  });
  assert.equal((await api.handle(missingOrigin)).status, 403);
  assert.equal(actor, undefined);
  const created = await api.handle(request('operator-create-demo', {}));
  assert.equal(created.status, 200);
  assert.equal(actor, 'lane-actor');
  assert.equal((await created.json()).operator.id, 'sg-test');
  const duplicate = await api.handle(request('operator-create-demo', {}));
  assert.equal(duplicate.status, 409);

  const queryOnly = apiFor({ query: pool.query });
  assert.equal((await queryOnly.api.handle(request('operator-create-demo', {}))).status, 503);
});

test('publishing increases package_revision and an unknown lane id is 422', async () => {
  const pool = memoryPool();
  const { api } = apiFor(pool);
  assert.equal((await api.handle(request('operator-create-demo', {}))).status, 200);
  const first = await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['mobile-phone'] }));
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.package_revision, 1);
  assert.deepEqual(firstBody.games, ['blackjack']);
  assert.deepEqual(firstBody.tables, []);
  const second = await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['mobile-phone'] }));
  assert.equal((await second.json()).package_revision, 2);
  const rejected = await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['not-a-lane'] }));
  assert.equal(rejected.status, 422);
  const current = await (await createOperatorStore({ sql: pool, scope, now: clock })).getCurrentPackage('sg-test');
  assert.equal(current.revision, 2);
});

test('publishing lanes carries the operator branding, games and tables forward', async () => {
  const pool = memoryPool();
  const { api } = apiFor(pool);
  await api.handle(request('operator-create-demo', {}));
  const direct = await createOperatorStore({ sql: pool, scope, now: clock });
  await direct.publishPackage({ actor: 'partner-admin', operatorId: 'sg-test', lanes: ['mobile-phone'], games: ['blackjack'], tables: ['t1'], branding: { color: '#112233', name: 'North' } });
  const republished = await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['mobile-phone'] }));
  assert.equal(republished.status, 200);
  const body = await republished.json();
  assert.equal(body.package_revision, 2);
  assert.deepEqual(body.tables, ['t1']);
  const current = await direct.getCurrentPackage('sg-test');
  assert.deepEqual(publicPackageBranding(current.branding), { color: '#112233', name: 'North' });
  assert.equal(readPackagePresentation(current).projectRevision, body.presentation.projectRevision);
});

test('an empty project.lanes list never materializes a default publication', async () => {
  const project = createSeedProject();
  project.lanes = [];
  const { api } = apiFor(memoryPool(), project);
  await api.handle(request('operator-create-demo', {}));
  assert.equal((await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['vip-table'] }))).status, 422);
  assert.equal((await api.handle(request('operator-package', { operatorId: 'sg-test', lanes: ['mobile-phone'] }))).status, 422);
});

test('a registered extra cannot publish through a legacy adapter merely by presenting a matching game lane',async()=>{
  const project=addDealer(createSeedProject(),'nora','Nora'),lane=defaultPresentationLane('astrid');
  lane.dealers=['nora'];lane.layers.dealer.default='nora';lane.layers.dealer.allowed=['nora'];project.lanes=[lane];
  let writes=0;
  const api=createOperatorPackageApi({pool:memoryPool(),scope,project,gameLanes:[{schemaVersion:1,id:lane.id,label:'Nora',renderer:'portrait-video',dealer:'nora',mediaCollection:'nora-presentation'}],
    storeFactory:async()=>{writes++;throw Error('must not publish without own captured registry');}});
  await assert.rejects(api.handlers.get('POST /studio/api/admin/operator-package')({body:{operatorId:'north',lanes:[lane.id]},actor:session}),e=>e.statusCode===503);
  assert.equal(writes,0);
});

import {createStudioRepository} from '../../web/storage/studio-repository.mjs';
const nativeScope={environment:'frozen-publisher-fixture',workspaceId:'isolated'};
const mediaId='10000000-0000-4000-8000-000000000001',mediaHash='a'.repeat(64);
// SQL facade fixture only: exercises the actual repository/publisher transaction
// and rollback paths. Real PostgreSQL isolation remains a separate integration.
function nativePool(){
  let state={documents:new Map(),media:new Map(),packages:[],operatorAudits:[],audits:[],history:[]},tail=Promise.resolve(),sequence=0;
  const calls=[],faults=new Set(),clone=v=>structuredClone(v),key=values=>JSON.stringify(values.slice(0,3));
  const result=(rows=[],command='SELECT')=>({rows:clone(rows),command});
  const pool={calls,snapshot:()=>clone(state),failNext:marker=>faults.add(marker),
    async connect(){
      const clientId=++sequence;let working,readOnly,unlock;
      return {release(){unlock?.();},async query(sql,values=[]){
        const marker=/\/\* (?:studio|operator-store):([a-z-]+) \*\//.exec(sql)?.[1]??sql.split(/\s/)[0];
        calls.push({clientId,marker,sql,values:clone(values)});
        if(faults.delete(marker))throw Error('private forced fixture failure');
        if(sql.startsWith('BEGIN')){readOnly=sql.includes('READ ONLY');working=clone(state);return result([],'BEGIN');}
        if(sql.startsWith('SET LOCAL'))return result([],'SET');
        if(sql.includes('pg_advisory_xact_lock')){if(unlock)return result();const previous=tail;tail=new Promise(resolve=>unlock=resolve);await previous;working=clone(state);return result();}
        if(sql==='COMMIT'||sql==='ROLLBACK'){if(sql==='COMMIT'&&!readOnly)state=working;working=undefined;unlock?.();unlock=null;return result([],sql);}
        assert.ok(working,'domain reads/writes use a live scoped client');
        const packages=()=>working.packages.filter(row=>row.environment_id===values[0]&&row.workspace_id===values[1]&&row.operator_id===values[2]);
        if(marker==='lock-operator'||marker==='operator-by-id')return result(values[2]==='north'?[{environment_id:values[0],workspace_id:values[1],operator_id:'north',slug:'north',name:'North',status:'active',created_at_ms:1}]:[]);
        if(marker==='current-package')return result(packages().sort((a,b)=>b.package_revision-a.package_revision).slice(0,1));
        if(marker==='publish-package'){
          const row={environment_id:values[0],workspace_id:values[1],operator_id:values[2],package_revision:Math.max(0,...packages().map(row=>row.package_revision))+1,lanes:values[3],games:values[4],tables:values[5],branding:values[6],published_at_ms:values[7]};
          working.packages.push(row);return result([row]);
        }
        if(marker==='read-document')return result(working.documents.has(key(values))?[working.documents.get(key(values))]:[]);
        if(marker==='media-aliases')return result([...working.media.values()].filter(row=>!(row.environment_id===values[0]&&row.workspace_id===values[1]&&row.id===values[2])&&(row.id===values[2]||row.record.pathname===values[3])).slice(0,2));
        if(marker==='read-media')return result(working.media.has(key(values))?[working.media.get(key(values))]:[]);
        if(marker==='list-media')return result([...working.media.values()].filter(row=>row.environment_id===values[0]&&row.workspace_id===values[1]).slice(0,values[2]));
        if(marker==='insert-document'||marker==='save-document'){
          if(marker==='save-document'&&working.documents.get(key(values))?.revision!==values[5])return result();
          const row={environment_id:values[0],workspace_id:values[1],kind:values[2],revision:values[3],value:JSON.parse(values[4]),updated_at:'2026-10-09T12:00:00Z'};
          working.documents.set(key(values),row);return result([row]);
        }
        if(marker==='insert-media'||marker==='classify-media'){
          if(marker==='classify-media'&&working.media.get(key(values))?.revision!==values[5])return result();
          const row={environment_id:values[0],workspace_id:values[1],id:values[2],revision:values[3],record:JSON.parse(values[4]),updated_at:'2026-10-09T12:00:00Z'};
          working.media.set(key(values),row);return result([row]);
        }
      if (marker === 'audit-write') { working.operatorAudits.push(clone(values)); return result([{event_id:values[3]}]); }
        if(marker==='audit'){working.audits.push(clone(values));return result();}
        if(marker==='history'){working.history.push(clone(values));return result();}
        throw Error('unexpected fixture marker '+marker);
      }};
    },
    async query(sql,values){const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const value=await client.query(sql,values);await client.query('COMMIT');return value;}finally{client.release();}}
  };return pool;
}
async function nativeFixture({dealer='johanna'}={}){
  const pool=nativePool(),repository=createStudioRepository({pool,scope:nativeScope});
  const support=cloudPresentationFixture({project:createSeedProject(),lanes:[defaultPresentationLane('astrid')]}),project=support.project.dealers.some(row=>row.id===dealer)?support.project:addDealer(support.project,dealer,dealer==='johanna'?'Johanna':'Nora'),lane=defaultPresentationLane(dealer);
  lane.id='johns-presentation';lane.dealers=[dealer];lane.layers.dealer.default=dealer;lane.layers.dealer.allowed=[dealer];project.lanes=[lane];
  project.lines.find(row=>row.dealerId===dealer&&row.eventId==='idle.ready').variants[0].videoGenerationId=mediaId;
  const classification={dealerId:dealer,eventId:'idle.ready',kind:'idle',role:'alternative',situation:'',label:'Egen dealerfilm',notes:'',compositing:{mode:'green-screen',threshold:.2,softness:.1,despill:0}};
  const record={id:mediaId,sha256:mediaHash,size:4096,contentType:'video/mp4',pathname:`croupier/media/dealers/${dealer}/review/uploads/${mediaId}/${mediaHash}.mp4`,classification};
  const administration={rooms:[],gameLane:'johns-game',gameLanes:[{schemaVersion:1,id:'johns-game',label:'Johns',renderer:'portrait-video',dealer,mediaCollection:dealer+'-presentation'}],
    tiers:{classic:'vera',high:'astrid',vip:'amira'},tournaments:[],pitboss:{payout10x:true,streak5:true,randomWalkMin:45}};
  await repository.initializeDocument('project',{value:project,revision:project.revision,actor:'tester'});
  await repository.initializeDocument('administration',{value:administration,revision:'admin-initial',actor:'tester'});
  await repository.registerMedia(record,{actor:'tester'});
  for (const {revision,...supportRecord} of support.mediaRows) await repository.registerMedia(supportRecord,{actor:'tester'});
  let io=0,changeDuringVerification=async()=>{};
  const videoRegistry={
    async loadCaptured(snapshot){
      io++;const reads=pool.calls.filter(row=>row.marker==='BEGIN'||row.marker==='COMMIT'||row.marker==='ROLLBACK');
      assert.equal(reads.at(-1).marker,'COMMIT','provider work follows completed SQL reads');
      return {videos:snapshot.mediaRows.map(row=>({id:row.id,sha256:row.sha256,bytes:row.size,dealer:row.classification.dealerId,available:true,classification:row.classification,kind:'idle',playback:'once'})),families:[],summary:{readable:true,snapshotReadable:true}};
    },
    async verifyCapturedMedia(preconditions){io++;assert.ok(preconditions.length > 0);await changeDuringVerification();}
  };
  const api=createOperatorPackageApi({pool,scope:nativeScope,repository,videoRegistry,now:clock});
  const context={body:{operatorId:'north',lanes:[lane.id]},actor:{user:'tester'},scope:nativeScope};
  const prepare=()=>api.preparations.get('POST /studio/api/admin/operator-package')(context);
  const publish=prepared=>api.handlers.get('POST /studio/api/admin/operator-package')({...context,...(prepared===undefined?{}:{prepared})});
  const direct=await createOperatorStore({sql:pool,scope:nativeScope,now:clock});
  return {pool,repository,project,lane,administration,record,api,context,prepare,publish,direct,io:()=>io,setDuring:fn=>changeDuringVerification=fn};
}
test('native package publishing freezes Johanna own UUID and exact metadata with provider work before the bound writer',async()=>{
  const f=await nativeFixture(),prepared=await f.prepare(),offset=f.pool.calls.length;
  const result=await f.publish(prepared);assert.equal(result.presentation.schemaVersion,3);assert.equal(result.packageRevision,1);assert.equal(f.io(),2);
  assert.equal(result.presentation.playback.media[0].id,mediaId);
  assert.equal(result.presentation.playback.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='idle.ready').variants[0].videoGenerationId,mediaId);
  assert.equal(result.presentation.registeredDealers[0].id,'johanna');assert.equal(result.presentation.registeredDealers[0].idle.id,mediaId);
  const writes=f.pool.calls.slice(offset);assert.equal(new Set(writes.map(row=>row.clientId)).size,1);
  assert.deepEqual(writes.find(row=>row.marker==='read-media').values.slice(0,2),[nativeScope.environment,nativeScope.workspaceId]);
  assert.equal(writes.some(row=>row.marker==='publish-package'),true);
  const current=await f.direct.getCurrentPackage('north');assert.deepEqual(readPackagePresentation(current),result.presentation);
  const saved=await f.repository.readDocument('project');saved.value.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='idle.ready').variants[0].videoGenerationId=null;
  await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
  assert.equal(readPackagePresentation(await f.direct.getCurrentPackage('north')).registeredDealers[0].idle.id,mediaId);
});
test('native publication rejects project/admin/package or exact selected-media drift after provider I/O without a package write',async()=>{
  for(const kind of ['project','administration','package','media']){
    const f=await nativeFixture();f.setDuring(async()=>{
      if(kind==='package')await f.direct.publishPackage({actor:'partner',operatorId:'north',lanes:[f.lane.id],games:['blackjack'],tables:[],branding:{name:'Concurrent brand'}});
      else if(kind==='media'){const media=await f.repository.getMedia(mediaId);await f.repository.classifyMedia(mediaId,{sha256:mediaHash,expectedRevision:media.revision,metadata:{...f.record.classification,label:'Changed intake'},actor:'tester'});}
      else{const saved=await f.repository.readDocument(kind);await f.repository.saveDocument(kind,{value:saved.value,expectedRevision:saved.revision,actor:'tester'});}
    });
    const prepared=await f.prepare(),before=f.pool.snapshot().packages;
    await assert.rejects(f.publish(prepared),e=>e.statusCode===409);assert.deepEqual(f.pool.snapshot().packages,before);
  }
});
test('native publication uses server-read current package revision and preserves partner branding/games/tables',async()=>{
  const f=await nativeFixture();
  await f.direct.publishPackage({actor:'partner',operatorId:'north',lanes:[f.lane.id],games:['blackjack'],tables:['legacy'],branding:{name:'Johns',color:'#123456'}});
  const prepared=await f.prepare();assert.equal(prepared.expectedPackageRevision,1);
  const result=await f.publish(prepared);assert.equal(result.packageRevision,2);assert.deepEqual(result.tables,['legacy']);
  assert.deepEqual(publicPackageBranding((await f.direct.getCurrentPackage('north')).branding),{name:'Johns',color:'#123456'});
});
test('native preparation requires own idle and cannot write if provider verification fails',async()=>{
  const f=await nativeFixture(),saved=await f.repository.readDocument('project');
  saved.value.lines.find(row=>row.dealerId==='johanna'&&row.eventId==='idle.ready').variants[0].videoGenerationId=null;
  await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
  await assert.rejects(f.prepare(),e=>e.code==='studio_dealer_idle_required');assert.equal(f.pool.snapshot().packages.length,0);
  const other=await nativeFixture();other.setDuring(async()=>{throw Object.assign(new Error('studio_media_storage_unavailable'),{statusCode:503});});
  await assert.rejects(other.prepare(),e=>e.statusCode===503);assert.equal(other.pool.snapshot().packages.length,0);
});
test('native Nora also freezes an exact own idle and does not inherit Johanna or a same-ID lane constraint',async()=>{
  const f=await nativeFixture({dealer:'nora'}),result=await f.publish();
  assert.equal(result.presentation.registeredDealers[0].id,'nora');assert.equal(result.presentation.registeredDealers[0].idle.classification.dealerId,'nora');
  assert.notEqual(f.lane.id,f.administration.gameLane);
});
test('advanced republication refuses removing an in-use presentation or changing its room dealer, then preserves a valid binding',async()=>{
  const f=await nativeFixture(),first=await f.publish();
  const room={schemaVersion:2,id:'room-10000000-0000-4000-8000-000000000002',name:'Johns',operatorId:'north',presentationLaneId:f.lane.id,gameLaneId:'johns-game',state:'live'};
  const admin=await f.repository.readDocument('administration');admin.value.rooms=[room];await f.repository.saveDocument('administration',{value:admin.value,expectedRevision:admin.revision,actor:'tester'});
  await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:1,lanes:[f.lane.id],games:['blackjack'],tables:[room.id],branding:withPackagePresentation({name:'Johns'},first.presentation)});
  const saved=await f.repository.readDocument('project'),other=defaultPresentationLane('astrid');other.id='other-presentation';saved.value.lanes.push(other);
  await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
  const context={...f.context,body:{operatorId:'north',lanes:[other.id]}};
  const prepared=await f.api.preparations.get('POST /studio/api/admin/operator-package')(context);
  await assert.rejects(f.api.handlers.get('POST /studio/api/admin/operator-package')({...context,prepared}),e=>e.statusCode===409);
  assert.equal((await f.direct.getCurrentPackage('north')).revision,2);
  const changed=await f.repository.readDocument('project');
  changed.value.lanes[0].dealers=['astrid'];changed.value.lanes[0].layers.dealer.default='astrid';changed.value.lanes[0].layers.dealer.allowed=['astrid'];
  await f.repository.saveDocument('project',{value:changed.value,expectedRevision:changed.revision,actor:'tester'});
  await assert.rejects(f.publish(),e=>e.statusCode===409,'a valid new default cannot retarget an existing Johanna room');
  assert.equal((await f.direct.getCurrentPackage('north')).revision,2);
  const restore=await f.repository.readDocument('project');
  restore.value.lanes[0].dealers=['johanna'];restore.value.lanes[0].layers.dealer.default='johanna';restore.value.lanes[0].layers.dealer.allowed=['johanna'];
  await f.repository.saveDocument('project',{value:restore.value,expectedRevision:restore.revision,actor:'tester'});
  const valid=await f.publish();assert.equal(valid.packageRevision,3);assert.deepEqual(valid.tables,[room.id]);
});
test('native SQL failure rolls back publisher and forged or mismatched preparations cannot cross intent boundaries',async()=>{
  const f=await nativeFixture(),prepared=await f.prepare(),before=f.pool.snapshot();
  await assert.rejects(f.publish({...prepared}),e=>e.statusCode===422);
  await assert.rejects(f.api.handlers.get('POST /studio/api/admin/operator-package')({...f.context,body:{operatorId:'other',lanes:[f.lane.id]},prepared}),e=>e.statusCode===422);
  f.pool.failNext('publish-package');await assert.rejects(f.publish(prepared),e=>e.statusCode===503);
  assert.deepEqual(f.pool.snapshot(),before);
});


test('lane operator choices carry each current published assignment and never borrow another company package', async () => {
  const pool=memoryPool(),{api,lane}=apiFor(pool),store=await createOperatorStore({sql:pool,scope,now:clock});
  await api.handle(request('operator-create-demo',{}));
  await store.createOperator({actor:session.user,operatorId:'johns',slug:'johns',name:'Johns'});
  assert.deepEqual((await lane.listOperators()).map(row=>[row.id,row.publishedPackage]),[['johns',null],['sg-test',null]]);
  await store.publishPackage({actor:session.user,operatorId:'sg-test',lanes:['mobile-phone'],games:['blackjack'],tables:['room-sg'],branding:{name:'Private package detail'}});
  await store.publishPackage({actor:session.user,operatorId:'johns',lanes:['johns-johanna'],games:['blackjack'],tables:['room-johns'],branding:{name:'Other private detail'}});
  await store.publishPackage({actor:session.user,operatorId:'sg-test',expectedRevision:1,lanes:['mobile-phone','evening'],games:['blackjack'],tables:['room-sg'],branding:{name:'Private package detail'}});
  const listed=await lane.listOperators();
  assert.deepEqual(listed.find(row=>row.id==='sg-test').publishedPackage,{revision:2,lanes:['evening','mobile-phone']});
  assert.deepEqual(listed.find(row=>row.id==='johns').publishedPackage,{revision:1,lanes:['johns-johanna']});
  assert.doesNotMatch(JSON.stringify(listed),/room-sg|room-johns|Private|branding|tables|games/);
  listed.find(row=>row.id==='sg-test').publishedPackage.lanes.length=0;
  assert.equal((await lane.listOperators()).find(row=>row.id==='sg-test').publishedPackage.lanes.length,2);
});


test('publishing the whole existing selection refreezes one shared dealer snapshot without changing room bindings', async () => {
  const f = await nativeFixture(), saved = await f.repository.readDocument('project'), second = structuredClone(f.lane);
  second.id = 'second-johanna'; saved.value.lanes.push(second);
  await f.repository.saveDocument('project', { value: saved.value, expectedRevision: saved.revision, actor: 'tester' });
  f.context.body.lanes = [f.lane.id, second.id];
  const first = await f.publish();
  const rooms = [f.lane.id, second.id].map((presentationLaneId, i) => ({ schemaVersion: 2, id: 'room-10000000-0000-4000-8000-00000000000' + (i + 2),
    name: 'Room ' + i, operatorId: 'north', presentationLaneId, gameLaneId: 'johns-game', state: 'live' }));
  const admin = await f.repository.readDocument('administration'); admin.value.rooms = rooms;
  await f.repository.saveDocument('administration', { value: admin.value, expectedRevision: admin.revision, actor: 'tester' });
  await f.direct.publishPackage({ actor: 'tester', operatorId: 'north', expectedRevision: 1, lanes: f.context.body.lanes, games: ['blackjack'], tables: rooms.map(r => r.id),
    branding: withPackagePresentation({ name: 'Johns' }, first.presentation) });
  const changed = await f.repository.readDocument('project');
  changed.value.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'speak.goodluck').variants[0].label = 'Updated shared event';
  await f.repository.saveDocument('project', { value: changed.value, expectedRevision: changed.revision, actor: 'tester' });
  const beforeAdmin = await f.repository.readDocument('administration'), offset = f.pool.calls.length, prepared = await f.prepare();
  assert.equal(f.pool.calls.slice(offset).filter(call => call.marker === 'list-media').length, 1, 'one captured library snapshot for all selections');
  const result = await f.publish(prepared);
  assert.equal(result.packageRevision, 3); assert.deepEqual(result.tables, rooms.map(r => r.id));
  assert.deepEqual(result.presentation.lanes.map(l => l.id), f.context.body.lanes);
  assert.equal(result.presentation.registeredDealers.length, 1);
  assert.equal(result.presentation.playback.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'speak.goodluck').variants[0].label, 'Updated shared event');
  assert.notEqual(first.presentation.playback.lines.find(row => row.dealerId === 'johanna' && row.eventId === 'speak.goodluck').variants[0].label, 'Updated shared event');
  assert.deepEqual(await f.repository.readDocument('administration'), beforeAdmin);
  assert.equal((await f.direct.getCurrentPackage('north')).branding.name, 'Johns');
});


test('v3 republication changes the allowed default from Astrid to Johanna without replacing its room or adapter', async () => {
  const f=await nativeFixture(), saved=await f.repository.readDocument('project');
  saved.value.lanes[0].dealers=['astrid','johanna'];saved.value.lanes[0].layers.dealer={enabled:true,default:'astrid',allowed:['astrid','johanna']};
  await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
  const admin=await f.repository.readDocument('administration');
  admin.value.gameLanes[0].dealer='astrid';admin.value.gameLanes[0].mediaCollection='astrid-presentation';
  const room={schemaVersion:2,id:'room-existing-astrid',name:'Existing Astrid',operatorId:'north',presentationLaneId:f.lane.id,gameLaneId:'johns-game',state:'live'};
  admin.value.rooms=[room];
  await f.repository.saveDocument('administration',{value:admin.value,expectedRevision:admin.revision,actor:'tester'});
  const first=await f.publish();
  await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:1,lanes:[f.lane.id],games:['blackjack'],tables:[room.id],branding:withPackagePresentation({name:'North'},first.presentation)});
  const changed=await f.repository.readDocument('project');changed.value.lanes[0].layers.dealer.default='johanna';
  await f.repository.saveDocument('project',{value:changed.value,expectedRevision:changed.revision,actor:'tester'});
  const beforeAdmin=await f.repository.readDocument('administration'), result=await f.publish();
  assert.equal(result.packageRevision,3);assert.deepEqual(result.tables,[room.id]);assert.deepEqual(await f.repository.readDocument('administration'),beforeAdmin);
  const {createGameEntrySelector}=await import('../../web/game-entry-operator.mjs');
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project:(await f.repository.readDocument('project')).value,administration:beforeAdmin.value})},
    packages:{resolve:async()=>({operator:{id:'north',status:'active'},package:await f.direct.getCurrentPackage('north')})}});
  const entry=await select('?operator=north&table='+room.id);
  assert.equal(entry.status,200);assert.equal(entry.selection.dealer,'johanna');assert.equal(entry.selection.presentation,'local');
  assert.equal(entry.selection.roomId,room.id);assert.equal(entry.selection.lane,room.gameLaneId);
  const astrid=await select('?operator=north&table='+room.id+'&dealer=astrid');
  assert.equal(astrid.selection.dealer,'astrid');assert.equal(astrid.selection.presentation,'local');
  const denied=await select('?operator=north&table='+room.id+'&dealer=mei');
  assert.equal(denied.status,404);assert.deepEqual(entry.selection.choices.dealers,['johanna','astrid']);
  assert.equal(readPackagePresentation(await f.direct.getCurrentPackage('north')).registeredDealers.find(row=>row.id==='johanna').idle.id,mediaId);
});

test('native publication rejects a stale editor revision before provider verification',async()=>{
  const f=await nativeFixture();
  await f.direct.publishPackage({actor:'partner',operatorId:'north',lanes:[f.lane.id],games:['blackjack'],tables:[],branding:{name:'Newer selection'}});
  f.context.body.expectedPackageRevision=null;
  const before=f.pool.snapshot();
  await assert.rejects(f.prepare(),error=>error.statusCode===409);
  assert.equal(f.io(),0);assert.deepEqual(f.pool.snapshot(),before);
  f.context.body.expectedPackageRevision=1;
  await f.direct.publishPackage({actor:'partner',operatorId:'north',expectedRevision:1,lanes:[f.lane.id],games:['blackjack'],tables:[],branding:{name:'Latest selection'}});
  const newer=f.pool.snapshot();
  await assert.rejects(f.prepare(),error=>error.statusCode===409);
  assert.equal(f.io(),0);assert.deepEqual(f.pool.snapshot(),newer);
});

test('an explicit editor revision retains the transaction CAS when publication changes after preparation',async()=>{
  const f=await nativeFixture();f.context.body.expectedPackageRevision=null;
  const initial=await f.publish();assert.equal(initial.packageRevision,1);
  f.context.body.expectedPackageRevision=1;
  const prepared=await f.prepare();
  const current=await f.direct.getCurrentPackage('north');
  await f.direct.publishPackage({actor:'partner',operatorId:'north',expectedRevision:1,lanes:current.lanes,games:current.games,tables:current.tables,branding:{...current.branding,name:'Concurrent branding'}});
  const before=f.pool.snapshot();
  await assert.rejects(f.publish(prepared),error=>error.statusCode===409);
  assert.deepEqual(f.pool.snapshot(),before);
});

test('malformed explicit editor revisions are refused before native reads or provider work',async()=>{
  const f=await nativeFixture();
  for(const revision of [undefined,0,-1,1.5,'1',false,{},Number.MAX_SAFE_INTEGER+1]){
    f.context.body.expectedPackageRevision=revision;const calls=f.pool.calls.length;
    await assert.rejects(f.prepare(),error=>error.statusCode===422);
    assert.equal(f.pool.calls.length,calls);assert.equal(f.io(),0);
  }
});

test('legacy adapter enforces explicit revisions and retains compatibility for omitted revisions',async()=>{
  const pool=memoryPool(),{api}=apiFor(pool);
  assert.equal((await api.handle(request('operator-create-demo',{}))).status,200);
  const body={operatorId:'sg-test',lanes:['mobile-phone'],expectedPackageRevision:null};
  const first=await api.handle(request('operator-package',body));assert.equal(first.status,200);assert.equal((await first.json()).packageRevision,1);
  assert.equal((await api.handle(request('operator-package',body))).status,409);
  const second=await api.handle(request('operator-package',{...body,expectedPackageRevision:1}));assert.equal(second.status,200);assert.equal((await second.json()).packageRevision,2);
  assert.equal((await api.handle(request('operator-package',{operatorId:'sg-test',lanes:['mobile-phone']}))).status,200);
});
test('native publication cannot invent a presentation from a missing or empty saved collection',async()=>{
  for(const missing of [false,true]){
    const f=await nativeFixture(),saved=await f.repository.readDocument('project');
    if(missing)delete saved.value.lanes;else saved.value.lanes=[];
    await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
    const before=f.pool.snapshot();
    await assert.rejects(f.prepare(),error=>error.code==='studio_presentation_required'&&error.statusCode===422);
    assert.equal(f.io(),0);assert.deepEqual(f.pool.snapshot(),before);
  }
});
test('an explicitly saved Astrid uses the same native own-idle capture and cannot publish without it',async()=>{
  const f=await nativeFixture({dealer:'astrid'}), first=await f.publish();
  assert.equal(first.presentation.schemaVersion,3);assert.equal(f.io(),2);
  assert.deepEqual(first.presentation.registeredDealers.map(row=>row.id),['astrid']);
  assert.equal(first.presentation.registeredDealers[0].idle.id,mediaId);
  const saved=await f.repository.readDocument('project');
  saved.value.lines.find(row=>row.dealerId==='astrid'&&row.eventId==='idle.ready').variants[0].videoGenerationId=null;
  await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
  const before=f.pool.snapshot();
  await assert.rejects(f.publish(),error=>error.code==='studio_dealer_idle_required');
  assert.deepEqual(f.pool.snapshot(),before);
});