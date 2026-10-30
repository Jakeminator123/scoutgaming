import {nativeRoomMaterialFixture} from '../../../test/fixtures/native-room-game-material.mjs';
import {EXTENDED_PRESENTATION_STORAGE_CHECKSUM} from '../../../packages/presentation/server/presentation-storage.mjs';
import {wrapNativePresentationRepository} from '../lib/presentation-runtime-readiness.mjs';
import {presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {publicPackageBranding,readPackagePresentation,withPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioAdminApi } from '../lib/studio-admin-api.mjs';
import { createSeedProject as createHistoricalProject, addDealer, defaultPresentationLane } from '../../../packages/presentation/contracts/studio-model.mjs';
import { createOperatorPackageApi, fixtureLaneOperators, openWritableOperatorStore } from '../lib/operator-package-api.mjs';
import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { operatorMemoryPool } from './fixtures/operator-memory-pool.mjs';
import {readRuntimeCatalogFixture} from '../../../test/fixtures/runtime-media-catalog.mjs';
import {runtimeCatalogRevision} from '../../../packages/studio-registry/server/runtime-catalog.mjs';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {aiImageLabel,aiPlacementHash} from '../lib/ai-image-contract.mjs';

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
const testRoom=(id,operatorId,presentationLaneId='mobile-phone')=>({schemaVersion:2,id,name:id,operatorId,presentationLaneId,gameLaneId:'johns-game',state:'live'});
const withoutRooms=({rooms,...fields})=>fields;

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

// The SG test company is created in the store directly; Admin has no demo-create action.
async function createSgTest(pool) {
  await (await createOperatorStore({ sql: pool, scope, now: clock }))
    .createOperator({ actor: session.user, operatorId: 'sg-test', slug: 'sg-test', name: 'SG test game provider' });
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
  await createSgTest(pool);
  let actor;
  const storeFactory = async options => {
    assert.equal(options.sql, pool);
    const store = await createOperatorStore(options);
    return { ...store, publishPackage: input => { actor = input.actor; return store.publishPackage(input); } };
  };
  const { api } = apiFor(pool, createSeedProject(), storeFactory);
  const body = { operatorId: 'sg-test', lanes: ['mobile-phone'] };
  const missingOrigin = new Request(`${origin}/studio/api/admin/operator-package`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }, body: JSON.stringify(body),
  });
  assert.equal((await api.handle(missingOrigin)).status, 403);
  assert.equal(actor, undefined);
  const published = await api.handle(request('operator-package', body));
  assert.equal(published.status, 200);
  assert.equal(actor, 'lane-actor');
  assert.equal((await api.handle(request('operator-create-demo', {}))).status, 404, 'the retired demo-create action is gone');

  const queryOnly = apiFor({ query: pool.query });
  assert.equal((await queryOnly.api.handle(request('operator-package', body))).status, 503);
});

test('publishing increases package_revision and an unknown lane id is 422', async () => {
  const pool = memoryPool();
  const { api } = apiFor(pool);
  await createSgTest(pool);
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
  await createSgTest(pool);
  const direct = await createOperatorStore({ sql: pool, scope, now: clock });
  await direct.publishPackage({ actor: 'partner-admin', operatorId: 'sg-test', lanes: ['mobile-phone'], games: ['blackjack'], tables: ['t1'],rooms:[testRoom('t1','sg-test')], branding: { color: '#112233', name: 'North' } });
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
  const pool = memoryPool();
  const { api } = apiFor(pool, project);
  await createSgTest(pool);
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

import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
const nativeScope={environment:'frozen-publisher-fixture',workspaceId:'isolated'};
const mediaId='10000000-0000-4000-8000-000000000001',mediaHash='a'.repeat(64);
// SQL facade fixture only: exercises the actual repository/publisher transaction
// and rollback paths. Real PostgreSQL isolation remains a separate integration.
function nativePool(){
  let state={documents:new Map(),media:new Map(),catalogs:new Map(),packages:[],operatorAudits:[],audits:[],history:[]},tail=Promise.resolve(),sequence=0;
  let extendedReady=false;
  const calls=[],faults=new Set(),clone=v=>structuredClone(v),key=values=>JSON.stringify(values.slice(0,3));
  const result=(rows=[],command='SELECT')=>({rows:clone(rows),command});
  const pool={allowExtendedStorage(){extendedReady=true;},calls,snapshot:()=>clone(state),failNext:marker=>faults.add(marker),
    seedBrandingDraft(value){state.brandingDraft=clone(value);},
    setOperatorStatus(value){state.operatorStatus=value;},
    seedRuntimeCatalog(scope,value){state.catalogs.set(JSON.stringify([scope.environment,scope.workspaceId]),{revision:runtimeCatalogRevision(value),value:clone(value)});},
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
        if(marker==='extended-presentation-ready')return result(extendedReady?[{checksum:EXTENDED_PRESENTATION_STORAGE_CHECKSUM,structure_checksum:'a'.repeat(64),matching_checks:2}]:[]);
        if(marker==='read-runtime-catalog')return result(working.catalogs.has(JSON.stringify(values.slice(0,2)))?[working.catalogs.get(JSON.stringify(values.slice(0,2)))]:[]);
        const packages=()=>working.packages.filter(row=>row.environment_id===values[0]&&row.workspace_id===values[1]&&row.operator_id===values[2]);
        if(marker==='lock-operator'||marker==='operator-by-id')return result(values[2]==='north'?[{environment_id:values[0],workspace_id:values[1],operator_id:'north',slug:'north',name:'North',status:working.operatorStatus??'active',created_at_ms:1}]:[]);
        if(marker==='current-package-rooms')return result([...new Map(working.packages.filter(row=>row.environment_id===values[0]&&row.workspace_id===values[1]).sort((a,b)=>a.package_revision-b.package_revision).map(row=>[row.operator_id,row])).values()]);
        if(marker==='current-package')return result(packages().sort((a,b)=>b.package_revision-a.package_revision).slice(0,1));
        if(marker==='publish-package'){
          const row={environment_id:values[0],workspace_id:values[1],operator_id:values[2],package_revision:Math.max(0,...packages().map(row=>row.package_revision))+1,lanes:values[3],games:values[4],tables:values[5],branding:values[6],published_at_ms:values[7],rooms:values[8]};
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
        if(marker==='insert-media'||marker==='classify-media'||marker==='save-media-timing'){
          if((marker==='classify-media'||marker==='save-media-timing')&&working.media.get(key(values))?.revision!==values[5])return result();
          const row={environment_id:values[0],workspace_id:values[1],id:values[2],revision:values[3],record:JSON.parse(values[4]),updated_at:'2026-10-09T12:00:00Z'};
          working.media.set(key(values),row);return result([row]);
        }
      if (marker === 'audit-write') { working.operatorAudits.push(clone(values)); return result([{event_id:values[3]}]); }
        // The company's branding drafts, for the draft publication of Bolagets eget material.
        if(marker==='current-branding-draft')return result((working.drafts??[]).filter(row=>row.operator_id===values[2]).slice(-1));
        if(marker==='write-branding-draft'){
          const row={environment_id:values[0],workspace_id:values[1],operator_id:values[2],draft_revision:values[3],base_package_revision:values[4],branding:values[5],
            source_package_revision:values[6],published_package_revision:values[7],action:values[8],occurred_at_ms:values[12]};
          (working.drafts??=[]).push(row);return result([row]);
        }
        if(marker==='list-packages')return result(packages().filter(row=>values[3]===null||row.package_revision<values[3]).sort((a,b)=>b.package_revision-a.package_revision).slice(0,values[4]));
        if(marker==='package-by-revision')return result(packages().filter(row=>row.package_revision===Number(values[3])));
        if(marker==='audit'){working.audits.push(clone(values));return result();}
        if(marker==='history'){working.history.push(clone(values));return result();}
        throw Error('unexpected fixture marker '+marker);
      }};
    },
    async query(sql,values){const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const value=await client.query(sql,values);await client.query('COMMIT');return value;}finally{client.release();}}
  };return pool;
}
async function nativeFixture({dealer='linnea',materials=null}={}){
  const pool=nativePool(),repository=createStudioRepository({pool,scope:nativeScope});
  pool.seedRuntimeCatalog(nativeScope,readRuntimeCatalogFixture());
  const support=cloudPresentationFixture({project:createSeedProject(),lanes:[defaultPresentationLane('astrid')]}),project=support.project.dealers.some(row=>row.id===dealer)?support.project:addDealer(support.project,dealer,dealer==='linnea'?'Linnea':'Nora'),lane=defaultPresentationLane(dealer);
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
  const api=createOperatorPackageApi({pool,scope:nativeScope,repository,videoRegistry,now:clock,materials});
  const context={body:{operatorId:'north',lanes:[lane.id]},actor:{user:'tester'},scope:nativeScope};
  const prepare=()=>api.preparations.get('POST /studio/api/admin/operator-package')(context);
  const publish=prepared=>api.handlers.get('POST /studio/api/admin/operator-package')({...context,...(prepared===undefined?{}:{prepared})});
  const direct=await createOperatorStore({sql:pool,scope:nativeScope,now:clock});
  return {pool,repository,project,lane,administration,record,api,context,prepare,publish,direct,videoRegistry,io:()=>io,setDuring:fn=>changeDuringVerification=fn};
}

const placementTable='f00be01d-fe7c-4a43-85b9-952e378f7331';
async function placementFixture(options){
  const f=await nativeFixture(options),first=await f.publish(),presentation=structuredClone(first.presentation),lane=presentation.lanes[0];
  const asset={schemaVersion:1,id:placementTable,role:'table',label:options?.tableLabel??'Oak',sha256:'b'.repeat(64),size:4096,contentType:'image/png',width:1672,height:941,
    pathname:`croupier/media/tables/${placementTable}/${'b'.repeat(64)}.png`};
  presentation.assets.push(asset);lane.layers.table={enabled:true,default:placementTable,allowed:[placementTable]};
  lane.composition=defaultCompositionSettings();lane.composition.mobile.table={width:1.75,x:0,y:.35};lane.composition.mobile.dealer.y=.03;
  const board=defaultBlackjackTableGeometry(placementTable);board.mobile={betMode:'under-cards',cardWidth:.038,dealer:{x:.5,y:.13},seats:[
    {bet:{x:.32,y:.39},card:{x:.324,y:.26}},{bet:{x:.5,y:.44},card:{x:.5,y:.29}},{bet:{x:.68,y:.39},card:{x:.676,y:.26}}]};
  lane.composition.blackjackTables=[board];
  const room={schemaVersion:2,id:'room-mobile',name:'Mobile',operatorId:'north',presentationLaneId:lane.id,gameLaneId:'johns-game',state:'live'};
  const admin=await f.repository.readDocument('administration');admin.value.rooms=[room];
  await f.repository.saveDocument('administration',{value:withoutRooms(admin.value),expectedRevision:admin.revision,actor:'tester'});
  for(let revision=1;revision<9;revision++)await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:revision,lanes:[lane.id],games:['blackjack'],tables:[room.id],rooms:[room],
    branding:withPackagePresentation({name:'North',roomOverrides:{[room.id]:{table:placementTable}},privateMetadata:{kept:true}},presentation)});
  f.pool.seedBrandingDraft({revision:3,basePackageRevision:9,branding:{roomOverrides:{[room.id]:{dealer:'linnea'}}}});
  const composition=structuredClone(lane.composition);
  composition.blackjackTables[0].mobile.seats.forEach(seat=>seat.card.y-=.07);
  composition.blackjackTables[0].mobile.autoScale={landing:true,cardSize:false,chips:true};
  composition.blackjackTables[0].desktop.anchors={cards:{target:'table',rect:{x:0,y:.1,width:1,height:1}}};
  composition.blackjackTables[0].desktop.fanSpread=.75;
  composition.desktop.table.width=.8;composition.tableFront=true;
  composition.desktop.gameUi={actions:{x:.5,y:.8},chat:{x:1,y:0,width:.3,height:.4}};
  const doc=await f.repository.readDocument('project');
  doc.value.layerAssets??=[];doc.value.layerAssets.push(asset);
  const savedLane=doc.value.lanes.find(row=>row.id===lane.id);savedLane.layers.table=structuredClone(lane.layers.table);savedLane.composition=composition;
  await f.repository.saveDocument('project',{value:doc.value,expectedRevision:doc.revision,actor:'tester'});
  const saved=await f.repository.readDocument('project');
  const body={action:'publish-scene-layout',operatorId:'north',compositionId:lane.id,expectedPackageRevision:9,expectedProjectRevision:saved.revision};
  const context={...f.context,body};
  return {...f,presentation,room,body,composition,context,prepare:()=>f.api.preparations.get('POST /studio/api/admin/operator-package')(context),
    publish:prepared=>f.api.handlers.get('POST /studio/api/admin/operator-package')({...context,...(prepared===undefined?{}:{prepared})})};
}

async function idleRefreshFixture(){
  const f=await placementFixture({dealer:'paow'}),alternate=structuredClone(f.record);
  alternate.id='10000000-0000-4000-8000-000000000099';alternate.sha256='d'.repeat(64);alternate.classification.label='Extra idle';
  alternate.pathname=`croupier/media/dealers/paow/review/uploads/${alternate.id}/${alternate.sha256}.mp4`;
  await f.repository.registerMedia(alternate,{actor:'tester'});
  const doc=await f.repository.readDocument('project'),policy={schemaVersion:1,familyId:'paow/idle.ready/ready',
    base:[{videoId:mediaId,weight:100,durationMs:1625}],variants:[{videoId:alternate.id,use:'rotation',automatic:null,durationMs:1625}],
    rotation:{clips:[mediaId,alternate.id].map(videoId=>({videoId,phase:'any',from:'rest',to:'rest',weight:20,head:false,calm:true}))}};
  doc.value.dealerIdlePolicies=[{dealerId:'paow',policy}];
  await f.repository.saveDocument('project',{value:doc.value,expectedRevision:doc.revision,actor:'tester'});
  // Restored notes after the original publication must not rewrite frozen
  // baseline metadata, or reject identical original bytes.
  const base=await f.repository.getMedia(mediaId);
  await f.repository.classifyMedia(mediaId,{sha256:mediaHash,expectedRevision:base.revision,metadata:{...f.record.classification,notes:'Restored source note'},actor:'tester'});
  const body={action:'refresh-dealer-idle',operatorId:'north',roomId:f.room.id,dealerId:'paow',expectedPackageRevision:9},context={...f.context,body};
  return {...f,alternate,policy,body,context,prepare:()=>f.api.preparations.get('POST /studio/api/admin/operator-package')(context),
    publish:prepared=>f.api.handlers.get('POST /studio/api/admin/operator-package')({...context,...(prepared===undefined?{}:{prepared})})};
}

test('scoped idle publication preserves published geometry, branding, all non-idle data, drafts and history',async()=>{
  const f=await idleRefreshFixture(),before=f.pool.snapshot(),old=await f.direct.getCurrentPackage('north');
  const prepared=await f.prepare(),receipt=await f.publish(prepared),after=f.pool.snapshot();
  assert.equal(receipt.packageRevision,10);assert.deepEqual(receipt.idleRefreshed,{dealerId:'paow',roomId:f.room.id});
  const expected=structuredClone(f.presentation);expected.playback.dealerIdlePolicies=[{dealerId:'paow',policy:f.policy}];expected.playback.media.push(f.alternate);
  assert.deepEqual(receipt.presentation,expected);
  assert.deepEqual(readPackagePresentation(await f.direct.getCurrentPackage('north')),expected);
  assert.deepEqual(publicPackageBranding((await f.direct.getCurrentPackage('north')).branding),publicPackageBranding(old.branding));
  for(const key of ['documents','media','catalogs','audits','history','brandingDraft'])assert.deepEqual(after[key],before[key],key);
  assert.deepEqual(after.packages.slice(0,-1),before.packages);assert.equal(after.operatorAudits.length,before.operatorAudits.length+1);
});

test('scoped idle publication rejects foreign rooms, dealers, payloads, preparations and stale revisions',async()=>{
  const f=await idleRefreshFixture(),before=f.pool.snapshot();
  for(const patch of [{operatorId:'south'},{roomId:'missing'},{dealerId:'linnea'},{expectedPackageRevision:8},{expectedPackageRevision:null},
    {presentation:f.presentation},{lanes:[f.lane.id]},{dealerId:'../paow'}]) {
    await assert.rejects(f.api.preparations.get('POST /studio/api/admin/operator-package')({...f.context,body:{...f.body,...patch}}),e=>[400,409,422].includes(e.statusCode));
  }
  const prepared=await f.prepare();await assert.rejects(f.publish({...prepared}),e=>e.statusCode===422);
  await assert.rejects(f.api.preparations.get('POST /studio/api/admin/operator-package')({...f.context,scope:{...nativeScope,workspaceId:'other'}}),e=>e.statusCode===403);
  assert.deepEqual(f.pool.snapshot(),before);
});

test('scoped idle publication rechecks project, administration, media, package and SQL rollback',async()=>{
  for(const kind of ['project','administration','media','package','sql']){
    const f=await idleRefreshFixture(),prepared=await f.prepare();
    if(kind==='project'||kind==='administration'){const doc=await f.repository.readDocument(kind);await f.repository.saveDocument(kind,{value:doc.value,expectedRevision:doc.revision,actor:'concurrent'});}
    if(kind==='media'){const row=await f.repository.getMedia(f.alternate.id);await f.repository.classifyMedia(row.id,{sha256:f.alternate.sha256,expectedRevision:row.revision,metadata:{...f.alternate.classification,label:'Changed'},actor:'concurrent'});}
    if(kind==='package'){const old=await f.direct.getCurrentPackage('north');await f.direct.publishPackage({actor:'concurrent',operatorId:'north',expectedRevision:9,lanes:old.lanes,games:old.games,tables:old.tables,branding:old.branding});}
    if(kind==='sql')f.pool.failNext('publish-package');
    const before=f.pool.snapshot();await assert.rejects(f.publish(prepared));assert.deepEqual(f.pool.snapshot(),before,kind);
  }
});

test('saved scene publication preserves PAOW frozen media, choices, branding draft, project and package history',async()=>{
  const f=await placementFixture({dealer:'paow'}),before=f.pool.snapshot(),original=await f.direct.getCurrentPackage('north'),io=f.io(),offset=f.pool.calls.length;
  const prepared=await f.prepare(),result=await f.publish(prepared),after=f.pool.snapshot();
  assert.equal(result.packageRevision,10);assert.equal(result.compositionId,f.body.compositionId);assert.equal(result.projectRevision,f.body.expectedProjectRevision);
  assert.deepEqual(result.affectedRooms,[{id:f.room.id,name:f.room.name,state:f.room.state}]);
  const expected=structuredClone(f.presentation);expected.lanes[0].composition=structuredClone(f.composition);
  assert.deepEqual(result.presentation,expected);
  assert.deepEqual(readPackagePresentation(await f.direct.getCurrentPackage('north')),expected);
  assert.deepEqual(publicPackageBranding((await f.direct.getCurrentPackage('north')).branding),publicPackageBranding(original.branding));
  for(const key of ['documents','media','catalogs','audits','history','brandingDraft'])assert.deepEqual(after[key],before[key],key+' remains untouched');
  assert.deepEqual(after.packages.slice(0,-1),before.packages);assert.equal(after.operatorAudits.length,before.operatorAudits.length+1);
  assert.equal(f.io(),io,'no provider or mutable media recapture');
  assert.ok(f.pool.calls.slice(offset).filter(row=>row.marker==='read-document'&&row.values[2]==='project').length>=2,'saved project is checked during preparation and the transaction');
});

test('saved scene publication filters unpublished table profiles without publishing draft materials or policies',async()=>{
  const f=await placementFixture(),doc=await f.repository.readDocument('project'),lane=doc.value.lanes[0],asset=structuredClone(doc.value.layerAssets.find(row=>row.id===placementTable));
  Object.assign(asset,{id:mediaId,label:'Unpublished table',pathname:`croupier/media/tables/${mediaId}/${asset.sha256}.png`});
  doc.value.layerAssets.push(asset);lane.layers.table.allowed.push(asset.id);lane.layers.table.default=asset.id;
  lane.composition.blackjackTables.push(defaultBlackjackTableGeometry(asset.id));lane.label='Unpublished label';lane.operatorAdjustable=[];
  await f.repository.saveDocument('project',{value:doc.value,expectedRevision:doc.revision,actor:'tester'});
  f.body.expectedProjectRevision=(await f.repository.readDocument('project')).revision;
  const before=f.pool.snapshot(),result=await f.publish(),expected=structuredClone(f.presentation);
  expected.lanes[0].composition=f.composition;assert.deepEqual(result.presentation,expected);
  assert.deepEqual(f.pool.snapshot().documents,before.documents,'filtering must not change the saved template');
  const changed=await f.repository.readDocument('project'),savedLane=changed.value.lanes[0];
  savedLane.layers.table.allowed=[asset.id];savedLane.composition.blackjackTables=savedLane.composition.blackjackTables.filter(row=>row.tableId===asset.id);
  savedLane.composition.desktop.background.x=.2;
  await f.repository.saveDocument('project',{value:changed.value,expectedRevision:changed.revision,actor:'tester'});
  f.body.expectedProjectRevision=(await f.repository.readDocument('project')).revision;f.body.expectedPackageRevision=result.packageRevision;
  const retained=await f.publish();expected.lanes[0].composition.desktop.background.x=.2;
  assert.deepEqual(retained.presentation,expected,'a removed template material keeps its frozen manual profile and choice');
  f.body.expectedPackageRevision=retained.packageRevision;const unchanged=f.pool.snapshot();
  await assert.rejects(f.publish(),error=>error.statusCode===422);assert.deepEqual(f.pool.snapshot(),unchanged,'filtered-only changes cannot create another version');
});

test('saved scene publication refuses missing layouts and no-op without a new package, but permits profile reset',async()=>{
  for(const kind of ['same','absent','missing-lane','reset']){
    const f=await placementFixture(),doc=await f.repository.readDocument('project');
    if(kind==='same')doc.value.lanes[0].composition=structuredClone(f.presentation.lanes[0].composition);
    if(kind==='absent')delete doc.value.lanes[0].composition;
    if(kind==='missing-lane')doc.value.lanes=[];
    if(kind==='reset')delete doc.value.lanes[0].composition.blackjackTables;
    await f.repository.saveDocument('project',{value:doc.value,expectedRevision:doc.revision,actor:'tester'});
    f.body.expectedProjectRevision=(await f.repository.readDocument('project')).revision;
    const before=f.pool.snapshot();
    if(kind==='reset'){const result=await f.publish();assert.equal(result.presentation.lanes[0].composition.blackjackTables,undefined);}
    else{await assert.rejects(f.prepare(),e=>e.statusCode===422);assert.deepEqual(f.pool.snapshot(),before,kind);}
  }
});

test('scene layout intent is exact, nonzero and scoped; malicious or stale inputs never publish',async()=>{
  const f=await placementFixture(),before=f.pool.snapshot();
  for(const patch of [{composition:f.composition},{offsetY:.07},{expectedPackageRevision:null},{expectedPackageRevision:0},
    {tableId:placementTable},{roomId:f.room.id},{actor:'attacker'},{lanes:[f.lane.id]},{presentation:f.presentation},{expectedPackageRevision:8},
    {compositionId:'../other'},{compositionId:'original'},{compositionId:'missing'},{operatorId:'south'},
    {expectedProjectRevision:null},{expectedProjectRevision:''},{expectedProjectRevision:'stale-project'},{action:'update-scene-layout'}]){
    await assert.rejects(f.api.preparations.get('POST /studio/api/admin/operator-package')({...f.context,body:{...f.body,...patch}}),e=>[400,409,422].includes(e.statusCode));
  }
  for(const field of Object.keys(f.body)){const missing={...f.body};delete missing[field];
    await assert.rejects(f.api.preparations.get('POST /studio/api/admin/operator-package')({...f.context,body:missing}),e=>e.statusCode===400);}
  await assert.rejects(f.api.preparations.get('POST /studio/api/admin/operator-package')({...f.context,scope:{...nativeScope,workspaceId:'other'}}),e=>e.statusCode===403);
  assert.deepEqual(f.pool.snapshot(),before);
});

test('saved scene publication reports all shared-lane package rooms without touching foreign or unpublished rooms',async()=>{
  const f=await placementFixture(),admin=await f.repository.readDocument('administration');
  admin.value.rooms.push({...f.room,id:'room-shared',name:'Shared',state:'preview'},
    {...f.room,id:'room-not-published',name:'Not published'},{...f.room,id:'room-foreign',operatorId:'south'});
  await f.repository.saveDocument('administration',{value:withoutRooms(admin.value),expectedRevision:admin.revision,actor:'tester'});
  const current=await f.direct.getCurrentPackage('north');await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:9,
    lanes:current.lanes,games:current.games,tables:[...current.tables,'room-shared'],rooms:admin.value.rooms.filter(row=>row.operatorId==='north'&&[...current.tables,'room-shared'].includes(row.id)),branding:current.branding});f.body.expectedPackageRevision=10;
  const before=f.pool.snapshot(),result=await f.publish();
  assert.deepEqual(result.affectedRooms,[{id:f.room.id,name:f.room.name,state:f.room.state},{id:'room-shared',name:'Shared',state:'preview'}]);
  assert.deepEqual(f.pool.snapshot().documents,before.documents);
});

test('saved scene publication keeps room material choices and rejects forged or changed preparations',async()=>{
  const f=await placementFixture(),current=await f.direct.getCurrentPackage('north'),presentation=readPackagePresentation(current),other=structuredClone(presentation.assets[0]);
  // The uploaded Oak is allowed but a different published room choice is authoritative.
  const oak=presentation.assets.find(row=>row.id===placementTable);Object.assign(other,oak,{id:mediaId,pathname:`croupier/media/tables/${mediaId}/${oak.sha256}.png`});
  presentation.assets.push(other);presentation.lanes[0].layers.table.allowed.push(other.id);
  const branding=withPackagePresentation({...publicPackageBranding(current.branding),roomOverrides:{[f.room.id]:{table:other.id}}},presentation);
  await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:9,lanes:current.lanes,games:current.games,tables:current.tables,branding});
  f.body.expectedPackageRevision=10;await f.publish();assert.deepEqual(publicPackageBranding((await f.direct.getCurrentPackage('north')).branding),publicPackageBranding(branding));
  const clean=await placementFixture(),prepared=await clean.prepare(),before=clean.pool.snapshot();
  await assert.rejects(clean.publish({...prepared}),e=>e.statusCode===422);
  await assert.rejects(clean.api.handlers.get('POST /studio/api/admin/operator-package')({...clean.context,body:{...clean.body,compositionId:'another-scene'},prepared}),e=>e.statusCode===422);
  assert.deepEqual(clean.pool.snapshot(),before);
});

test('saved scene publication retains another lane, supports a scene without rooms and refuses suspended operators',async()=>{
  const f=await placementFixture(),current=await f.direct.getCurrentPackage('north'),presentation=readPackagePresentation(current),other=structuredClone(presentation.lanes[0]);
  other.id='other-published-lane';presentation.lanes.push(other);
  const admin=await f.repository.readDocument('administration');admin.value.rooms.push({...f.room,id:'room-other-lane',presentationLaneId:other.id});
  await f.repository.saveDocument('administration',{value:withoutRooms(admin.value),expectedRevision:admin.revision,actor:'tester'});
  await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:9,lanes:presentation.lanes.map(lane=>lane.id),games:current.games,tables:[...current.tables,'room-other-lane'],rooms:admin.value.rooms,
    branding:withPackagePresentation(publicPackageBranding(current.branding),presentation)});
  f.body.expectedPackageRevision=10;const result=await f.publish();assert.deepEqual(result.presentation.lanes[1],other);assert.deepEqual(result.tables,[f.room.id,'room-other-lane']);
  const unpublished=await placementFixture(),pack=await unpublished.direct.getCurrentPackage('north');
  await unpublished.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:9,lanes:pack.lanes,games:pack.games,tables:[],branding:pack.branding});
   unpublished.body.expectedPackageRevision=10;assert.deepEqual((await unpublished.publish()).affectedRooms,[]);
  const suspended=await placementFixture(),prepared=await suspended.prepare();suspended.pool.setOperatorStatus('suspended');
  const before=suspended.pool.snapshot();await assert.rejects(suspended.prepare(),e=>e.statusCode===409);await assert.rejects(suspended.publish(prepared),e=>e.statusCode===409);
  assert.deepEqual(suspended.pool.snapshot(),before);
});

test('saved scene CAS rejects changed package, project or administration and rolls back SQL failure',async()=>{
  for(const change of ['package','project','administration','failure']){
    const f=await placementFixture(),prepared=await f.prepare();
    if(change==='package'){const current=await f.direct.getCurrentPackage('north');await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:9,
      lanes:current.lanes,games:current.games,tables:current.tables,branding:{...current.branding,name:'Concurrent branding'}});}
    if(change==='administration'){const admin=await f.repository.readDocument('administration');admin.value.rooms[0].name='Concurrent room edit';
      await f.repository.saveDocument('administration',{value:withoutRooms(admin.value),expectedRevision:admin.revision,actor:'tester'});}
    if(change==='project'){const doc=await f.repository.readDocument('project');doc.value.lanes[0].composition.mobile.dealer.x=.2;
      await f.repository.saveDocument('project',{value:doc.value,expectedRevision:doc.revision,actor:'tester'});}
    if(change==='failure')f.pool.failNext('publish-package');
    const before=f.pool.snapshot();await assert.rejects(f.publish(prepared),e=>change==='failure'||e.statusCode===409);assert.deepEqual(f.pool.snapshot(),before);
  }
  const f=await placementFixture(),first=await f.prepare(),second=await f.prepare(),outcomes=await Promise.allSettled([f.publish(first),f.publish(second)]);
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(outcomes.find(row=>row.status==='rejected').reason.statusCode,409);assert.equal((await f.direct.getCurrentPackage('north')).revision,10);
});

function placementAdmin(f,{authorize=async()=>({...session,scope:nativeScope}),preparations=f.api.preparations,mutationTransaction=work=>work()}={}){
  return createStudioAdminApi({authorize,mutationTransaction,allowedOrigins:[origin],publicHosts:['studio.example'],handlers:f.api.handlers,preparations});
}

test('N1 scoped idle publication requires admin authorization, current session and runtime readiness for its exact candidate',async()=>{
  const f=await idleRefreshFixture(),before=f.pool.snapshot();
  for(const actor of [null,{...session,scope:nativeScope,role:'partner'}]){
    const api=placementAdmin(f,{authorize:async()=>actor});assert.ok([401,403].includes((await api.handle(request('operator-package',f.body))).status));
  }
  assert.equal((await placementAdmin(f).handle(request('operator-package',f.body,{origin:'https://foreign.example'}))).status,403);
  let reads=0;const revoked=placementAdmin(f,{authorize:async()=>++reads<3?{...session,scope:nativeScope}:null});
  assert.ok([401,403].includes((await revoked.handle(request('operator-package',f.body))).status));
  const blocked=placementAdmin(f,{mutationTransaction:async()=>{throw Object.assign(Error('runtime_required'),{statusCode:503});}});
  assert.equal((await blocked.handle(request('operator-package',f.body))).status,503);
  assert.deepEqual(f.pool.snapshot(),before);
  let descriptor;const ready=placementAdmin(f,{mutationTransaction:async(work,options)=>{descriptor=options;return work();}});
  const response=await ready.handle(request('operator-package',f.body));assert.equal(response.status,200);
  assert.deepEqual(descriptor.presentationDocuments,['project','administration']);
  assert.equal(descriptor.presentationMutation.kind,'presentation-package');
  assert.deepEqual(descriptor.presentationMutation.value,(await response.json()).presentation);
});
test('N1 saved scene publication negotiates the exact candidate and both document revisions before writing',async()=>{
  const f=await placementFixture();let descriptor;
  const api=placementAdmin(f,{mutationTransaction:async(work,options)=>{descriptor=options;return work();}});
  const response=await api.handle(request('operator-package',f.body));assert.equal(response.status,200);
  assert.deepEqual(descriptor.presentationDocuments,['project','administration']);assert.equal(descriptor.presentationMutation.kind,'presentation-package');
  assert.deepEqual(descriptor.presentationMutation.value,(await response.json()).presentation);
  const blocked=await placementFixture(),before=blocked.pool.snapshot();
  const reject=placementAdmin(blocked,{mutationTransaction:async()=>{throw Object.assign(Error('runtime_required'),{statusCode:503});}});
  assert.equal((await reject.handle(request('operator-package',blocked.body))).status,503);assert.deepEqual(blocked.pool.snapshot(),before);
  const absent=placementAdmin(blocked,{preparations:new Map(),mutationTransaction:()=>{throw Error('must not enter mutation without prepared candidate');}});
  assert.equal((await absent.handle(request('operator-package',blocked.body))).status,503);assert.deepEqual(blocked.pool.snapshot(),before);
  const normal=await nativeFixture();let normalDescriptor;
  const legacy=placementAdmin(normal,{mutationTransaction:async(work,options)=>{normalDescriptor=options;return work();}});
  assert.equal((await legacy.handle(request('operator-package',normal.context.body))).status,200);
  assert.deepEqual(normalDescriptor.presentationDocuments,['project','administration']);
});

test('N1 scene layout blocks anonymous, partner, cross-origin and revoked sessions without writes',async()=>{
  const f=await placementFixture(),before=f.pool.snapshot();
  for(const actor of [null,{...session,scope:nativeScope,role:'partner'}]){
    const api=placementAdmin(f,{authorize:async()=>actor});assert.ok([401,403].includes((await api.handle(request('operator-package',f.body))).status));
  }
  assert.equal((await placementAdmin(f).handle(request('operator-package',f.body,{origin:'https://foreign.example'}))).status,403);
  let reads=0;const revoked=placementAdmin(f,{authorize:async()=>++reads<3?{...session,scope:nativeScope}:null});
  assert.ok([401,403].includes((await revoked.handle(request('operator-package',f.body))).status));
  assert.deepEqual(f.pool.snapshot(),before);
});
test('native package publishing freezes Linnea own UUID and exact metadata with provider work before the bound writer',async()=>{
  const f=await nativeFixture(),prepared=await f.prepare(),offset=f.pool.calls.length;
  const result=await f.publish(prepared);assert.equal(result.presentation.schemaVersion,3);assert.equal(result.packageRevision,1);assert.equal(f.io(),2);
  assert.equal(result.presentation.playback.media[0].id,mediaId);
  assert.equal(result.presentation.playback.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='idle.ready').variants[0].videoGenerationId,mediaId);
  assert.equal(result.presentation.registeredDealers[0].id,'linnea');assert.equal(result.presentation.registeredDealers[0].idle.id,mediaId);
  const writes=f.pool.calls.slice(offset);assert.equal(new Set(writes.map(row=>row.clientId)).size,1);
  assert.deepEqual(writes.find(row=>row.marker==='read-media').values.slice(0,2),[nativeScope.environment,nativeScope.workspaceId]);
  assert.equal(writes.some(row=>row.marker==='publish-package'),true);
  const current=await f.direct.getCurrentPackage('north');assert.deepEqual(readPackagePresentation(current),result.presentation);
  const saved=await f.repository.readDocument('project');saved.value.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='idle.ready').variants[0].videoGenerationId=null;
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
  await f.direct.publishPackage({actor:'partner',operatorId:'north',lanes:[f.lane.id],games:['blackjack'],tables:['legacy'],rooms:[testRoom('legacy','north',f.lane.id)],branding:{name:'Johns',color:'#123456'}});
  const prepared=await f.prepare();assert.equal(prepared.expectedPackageRevision,1);
  const result=await f.publish(prepared);assert.equal(result.packageRevision,2);assert.deepEqual(result.tables,['legacy']);
  assert.deepEqual(publicPackageBranding((await f.direct.getCurrentPackage('north')).branding),{name:'Johns',color:'#123456'});
});
test('native preparation requires own idle and cannot write if provider verification fails',async()=>{
  const f=await nativeFixture(),saved=await f.repository.readDocument('project');
  saved.value.lines.find(row=>row.dealerId==='linnea'&&row.eventId==='idle.ready').variants[0].videoGenerationId=null;
  await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
  await assert.rejects(f.prepare(),e=>e.code==='studio_dealer_idle_required');assert.equal(f.pool.snapshot().packages.length,0);
  const other=await nativeFixture();other.setDuring(async()=>{throw Object.assign(new Error('studio_media_storage_unavailable'),{statusCode:503});});
  await assert.rejects(other.prepare(),e=>e.statusCode===503);assert.equal(other.pool.snapshot().packages.length,0);
});
test('native Nora also freezes an exact own idle and does not inherit Linnea or a same-ID lane constraint',async()=>{
  const f=await nativeFixture({dealer:'nora'}),result=await f.publish();
  assert.equal(result.presentation.registeredDealers[0].id,'nora');assert.equal(result.presentation.registeredDealers[0].idle.classification.dealerId,'nora');
  assert.notEqual(f.lane.id,f.administration.gameLane);
});
test('advanced republication refuses removing an in-use presentation or changing its room dealer, then preserves a valid binding',async()=>{
  const f=await nativeFixture(),first=await f.publish();
  const room={schemaVersion:2,id:'room-10000000-0000-4000-8000-000000000002',name:'Johns',operatorId:'north',presentationLaneId:f.lane.id,gameLaneId:'johns-game',state:'live'};
  const admin=await f.repository.readDocument('administration');admin.value.rooms=[room];await f.repository.saveDocument('administration',{value:withoutRooms(admin.value),expectedRevision:admin.revision,actor:'tester'});
  await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:1,lanes:[f.lane.id],games:['blackjack'],tables:[room.id],rooms:[room],branding:withPackagePresentation({name:'Johns'},first.presentation)});
  const saved=await f.repository.readDocument('project'),other=defaultPresentationLane('astrid');other.id='other-presentation';saved.value.lanes.push(other);
  await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
  const context={...f.context,body:{operatorId:'north',lanes:[other.id]}};
  const prepared=await f.api.preparations.get('POST /studio/api/admin/operator-package')(context);
  await assert.rejects(f.api.handlers.get('POST /studio/api/admin/operator-package')({...context,prepared}),e=>e.statusCode===409);
  assert.equal((await f.direct.getCurrentPackage('north')).revision,2);
  const changed=await f.repository.readDocument('project');
  changed.value.lanes[0].dealers=['astrid'];changed.value.lanes[0].layers.dealer.default='astrid';changed.value.lanes[0].layers.dealer.allowed=['astrid'];
  await f.repository.saveDocument('project',{value:changed.value,expectedRevision:changed.revision,actor:'tester'});
  await assert.rejects(f.publish(),e=>e.statusCode===409,'a valid new default cannot retarget an existing Linnea room');
  assert.equal((await f.direct.getCurrentPackage('north')).revision,2);
  const restore=await f.repository.readDocument('project');
  restore.value.lanes[0].dealers=['linnea'];restore.value.lanes[0].layers.dealer.default='linnea';restore.value.lanes[0].layers.dealer.allowed=['linnea'];
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
  await createSgTest(pool);
  await store.createOperator({actor:session.user,operatorId:'johns',slug:'johns',name:'Johns'});
  assert.deepEqual((await lane.listOperators()).map(row=>[row.id,row.publishedPackage]),[['johns',null],['sg-test',null]]);
  await store.publishPackage({actor:session.user,operatorId:'sg-test',lanes:['mobile-phone'],games:['blackjack'],tables:['room-sg'],rooms:[testRoom('room-sg','sg-test')],branding:{name:'Private package detail'}});
  await store.publishPackage({actor:session.user,operatorId:'johns',lanes:['johns-linnea'],games:['blackjack'],tables:['room-johns'],rooms:[testRoom('room-johns','johns','johns-linnea')],branding:{name:'Other private detail'}});
  await store.publishPackage({actor:session.user,operatorId:'sg-test',expectedRevision:1,lanes:['mobile-phone','evening'],games:['blackjack'],tables:['room-sg'],rooms:[testRoom('room-sg','sg-test')],branding:{name:'Private package detail'}});
  const listed=await lane.listOperators();
  assert.deepEqual(listed.find(row=>row.id==='sg-test').publishedPackage,{revision:2,lanes:['evening','mobile-phone']});
  assert.deepEqual(listed.find(row=>row.id==='johns').publishedPackage,{revision:1,lanes:['johns-linnea']});
  assert.doesNotMatch(JSON.stringify(listed),/room-sg|room-johns|Private|branding|tables|games/);
  listed.find(row=>row.id==='sg-test').publishedPackage.lanes.length=0;
  assert.equal((await lane.listOperators()).find(row=>row.id==='sg-test').publishedPackage.lanes.length,2);
});


test('publishing the whole existing selection refreezes one shared dealer snapshot without changing room bindings', async () => {
  const f = await nativeFixture(), saved = await f.repository.readDocument('project'), second = structuredClone(f.lane);
  second.id = 'second-linnea'; saved.value.lanes.push(second);
  await f.repository.saveDocument('project', { value: saved.value, expectedRevision: saved.revision, actor: 'tester' });
  f.context.body.lanes = [f.lane.id, second.id];
  const first = await f.publish();
  const rooms = [f.lane.id, second.id].map((presentationLaneId, i) => ({ schemaVersion: 2, id: 'room-10000000-0000-4000-8000-00000000000' + (i + 2),
    name: 'Room ' + i, operatorId: 'north', presentationLaneId, gameLaneId: 'johns-game', state: 'live' }));
  const admin = await f.repository.readDocument('administration'); admin.value.rooms = rooms;
  await f.repository.saveDocument('administration', { value: withoutRooms(admin.value), expectedRevision: admin.revision, actor: 'tester' });
  await f.direct.publishPackage({ actor: 'tester', operatorId: 'north', expectedRevision: 1, lanes: f.context.body.lanes, games: ['blackjack'], tables: rooms.map(r => r.id),rooms,
    branding: withPackagePresentation({ name: 'Johns' }, first.presentation) });
  const changed = await f.repository.readDocument('project');
  changed.value.lines.find(row => row.dealerId === 'linnea' && row.eventId === 'speak.goodluck').variants[0].label = 'Updated shared event';
  await f.repository.saveDocument('project', { value: changed.value, expectedRevision: changed.revision, actor: 'tester' });
  const beforeAdmin = await f.repository.readDocument('administration'), offset = f.pool.calls.length, prepared = await f.prepare();
  assert.equal(f.pool.calls.slice(offset).filter(call => call.marker === 'list-media').length, 1, 'one captured library snapshot for all selections');
  const result = await f.publish(prepared);
  assert.equal(result.packageRevision, 3); assert.deepEqual(result.tables, rooms.map(r => r.id));
  assert.deepEqual(result.presentation.lanes.map(l => l.id), f.context.body.lanes);
  assert.equal(result.presentation.registeredDealers.length, 1);
  assert.equal(result.presentation.playback.lines.find(row => row.dealerId === 'linnea' && row.eventId === 'speak.goodluck').variants[0].label, 'Updated shared event');
  assert.notEqual(first.presentation.playback.lines.find(row => row.dealerId === 'linnea' && row.eventId === 'speak.goodluck').variants[0].label, 'Updated shared event');
  assert.deepEqual(await f.repository.readDocument('administration'), beforeAdmin);
  assert.equal((await f.direct.getCurrentPackage('north')).branding.name, 'Johns');
});


test('v3 republication changes the allowed default from Astrid to Linnea without replacing its room or adapter', async () => {
  const f=await nativeFixture(), saved=await f.repository.readDocument('project');
  saved.value.lanes[0].dealers=['astrid','linnea'];saved.value.lanes[0].layers.dealer={enabled:true,default:'astrid',allowed:['astrid','linnea']};
  await f.repository.saveDocument('project',{value:saved.value,expectedRevision:saved.revision,actor:'tester'});
  const admin=await f.repository.readDocument('administration');
  admin.value.gameLanes[0].dealer='astrid';admin.value.gameLanes[0].mediaCollection='astrid-presentation';
  const room={schemaVersion:2,id:'room-existing-astrid',name:'Existing Astrid',operatorId:'north',presentationLaneId:f.lane.id,gameLaneId:'johns-game',state:'live'};
  admin.value.rooms=[room];
  await f.repository.saveDocument('administration',{value:withoutRooms(admin.value),expectedRevision:admin.revision,actor:'tester'});
  const first=await f.publish();
  await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:1,lanes:[f.lane.id],games:['blackjack'],tables:[room.id],rooms:[room],branding:withPackagePresentation({name:'North'},first.presentation)});
  const changed=await f.repository.readDocument('project');changed.value.lanes[0].layers.dealer.default='linnea';
  await f.repository.saveDocument('project',{value:changed.value,expectedRevision:changed.revision,actor:'tester'});
  const beforeAdmin=await f.repository.readDocument('administration'), result=await f.publish();
  assert.equal(result.packageRevision,3);assert.deepEqual(result.tables,[room.id]);assert.deepEqual(await f.repository.readDocument('administration'),beforeAdmin);
  const {createGameEntrySelector}=await import('../../../packages/presentation/server/game-entry-selector.mjs');
  const select=createGameEntrySelector({policy:{readGameConfiguration(){},readSaved:async()=>({project:(await f.repository.readDocument('project')).value,administration:beforeAdmin.value})},
    packages:{resolve:async()=>({operator:{id:'north',status:'active'},package:await f.direct.getCurrentPackage('north')})}});
  const entry=await select('?operator=north&table='+room.id);
  assert.equal(entry.status,200);assert.equal(entry.selection.dealer,'linnea');assert.equal(entry.selection.presentation,'local');
  assert.equal(entry.selection.roomId,room.id);assert.equal(entry.selection.lane,room.gameLaneId);
  const astrid=await select('?operator=north&table='+room.id+'&dealer=astrid');
  assert.equal(astrid.selection.dealer,'astrid');assert.equal(astrid.selection.presentation,'local');
  const denied=await select('?operator=north&table='+room.id+'&dealer=mei');
  assert.equal(denied.status,404);assert.deepEqual(entry.selection.choices.dealers,['linnea','astrid']);
  assert.equal(readPackagePresentation(await f.direct.getCurrentPackage('north')).registeredDealers.find(row=>row.id==='linnea').idle.id,mediaId);
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
  await createSgTest(pool);
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


test('native publication of all measured filmed takes requires v29 and installed optional020',async()=>{
  for(const version of [28,29])for(const installed of [false,true]){
    const source=nativeRoomMaterialFixture({allSpeechSlots:true,capture:false}),pool=nativePool();
    if(installed)pool.allowExtendedStorage();
    pool.seedRuntimeCatalog(nativeScope,readRuntimeCatalogFixture());
    const repository=createStudioRepository({pool,scope:nativeScope});
    await repository.initializeDocument('project',{value:source.project,revision:source.project.revision,actor:'tester'});
    await repository.initializeDocument('administration',{value:{rooms:[],gameLanes:[],gameLane:null},revision:'admin-initial',actor:'tester'});
    for(const {revision,updatedAt,mediaTiming,...record} of source.records){
      const {media}=await repository.registerMedia(record,{actor:'tester'});
      await repository.saveMediaTiming(record.id,{sha256:record.sha256,expectedRevision:media.revision,mediaTiming,actor:'tester'});
    }
    let fetches=0;
    const guarded=wrapNativePresentationRepository(repository,{env:{CROUPIER_BACKEND_ORIGIN:'https://runtime.example.invalid'},fetchImpl:async(_url,init)=>{
      fetches++;assert.equal(init.headers['X-Presentation-Capability-Version'],'29');
      assert.equal(pool.calls.filter(row=>['BEGIN','COMMIT','ROLLBACK'].includes(row.marker)).at(-1).marker,'COMMIT','capability before SQL');
      return Response.json(presentationCapabilitiesForVersion(version));
    }});
    const videoRegistry={loadCaptured:async snapshot=>({videos:snapshot.mediaRows.map(row=>({...row,dealer:row.classification.dealerId,bytes:row.size,available:true,integrity:'verified'})),families:[]}),verifyCapturedMedia:async()=>{}};
    const api=createOperatorPackageApi({pool,scope:nativeScope,repository:guarded,videoRegistry,now:clock});
    const context={body:{operatorId:'north',lanes:[source.project.lanes[0].id]},actor:{user:'tester'},scope:nativeScope};
    const prepared=await api.preparations.get('POST /studio/api/admin/operator-package')(context),before=pool.snapshot();
    const publish=()=>api.handlers.get('POST /studio/api/admin/operator-package')({...context,prepared});
    if(version===28||!installed){
      await assert.rejects(publish,e=>e.code===(version===28?'studio_presentation_runtime_update_required':'studio_extended_presentation_storage_unavailable'));
      assert.deepEqual(pool.snapshot(),before);
    }else{
      const saved=await publish(),stored=JSON.parse(pool.snapshot().packages[0].branding);
      assert.equal(stored._scoutPresentation.format,'croupier-lanes-v2');
      assert.equal(saved.presentation.playback.media.length,53);
      assert.deepEqual(readPackagePresentation({branding:stored,lanes:saved.lanes}),saved.presentation);
      assert.equal(saved.presentation.playback.media.every(row=>Boolean(row.mediaTiming)),true);
    }
    assert.equal(fetches,1);
    const raw=createOperatorPackageApi({pool,scope:nativeScope,repository,videoRegistry,now:clock});
    await assert.rejects(raw.handlers.get('POST /studio/api/admin/operator-package')(context),e=>e.code==='studio_presentation_runtime_update_required');
  }
});

// AI table graphics: publication refuses one drawn for another dealer or placement.
const aiTableId='a1000000-0000-4000-8000-000000000001';
function aiTableAsset(label){return {schemaVersion:1,id:aiTableId,role:'table',game:'blackjack',label,sha256:'c'.repeat(64),size:2048,contentType:'image/webp',width:1215,height:2074,
  pathname:`croupier/media/tables/${aiTableId}/${'c'.repeat(64)}.webp`};}
const drawnForPaow=composition=>aiImageLabel('Grön filt',{dealerId:'paow',placement:aiPlacementHash(composition??defaultCompositionSettings())});

test('Admin package publication refuses an AI table graphic after a dealer swap, with a fixed answer; manual material passes', async () => {
  const pool=memoryPool(),project=createSeedProject(),lane=project.lanes[0];
  project.layerAssets=[aiTableAsset(drawnForPaow())];lane.layers.table={enabled:true,default:aiTableId,allowed:[aiTableId]};
  const {api}=apiFor(pool,project);
  await createSgTest(pool);
  // The template's dealer is not the one the table was drawn for.
  const refused=await api.handle(request('operator-package',{operatorId:'sg-test',lanes:[lane.id]}));
  assert.equal(refused.status,422);
  assert.deepEqual(await refused.json(),{error:'ai_table_misfit',code:'ai_table_misfit',compositionId:lane.id,assetId:aiTableId,reason:'ai_table_other_dealer'});
  assert.equal((await (await createOperatorStore({sql:pool,scope,now:clock})).getCurrentPackage('sg-test'))?.revision??null,null,'nothing was frozen');
  project.layerAssets[0].label='Blackjack · eget bord';
  const manual=await api.handle(request('operator-package',{operatorId:'sg-test',lanes:[lane.id]}));
  assert.equal(manual.status,200,'the same table as ordinary material publishes');
});

test('native package publication lets a fitting AI table through and refuses a moved placement before any I/O', async () => {
  for (const [composition,refuse] of [[undefined,false],[{...defaultCompositionSettings(),desktop:{...defaultCompositionSettings().desktop,table:{width:.5,x:0,y:.35}}},true]]) {
    const f=await nativeFixture({dealer:'paow'}),doc=await f.repository.readDocument('project');
    doc.value.layerAssets=[aiTableAsset(drawnForPaow())];
    const lane=doc.value.lanes.find(row=>row.id===f.lane.id);lane.layers.table={enabled:true,default:aiTableId,allowed:[aiTableId]};
    if (composition) lane.composition=composition;
    await f.repository.saveDocument('project',{value:doc.value,expectedRevision:doc.revision,actor:'tester'});
    if (!refuse) { const receipt=await f.publish();assert.equal(receipt.ok,true);assert.ok(receipt.presentation.assets.some(row=>row.id===aiTableId));continue; }
    await assert.rejects(f.prepare(),error=>error.code==='ai_table_misfit'&&error.reason==='ai_table_other_placement'&&error.compositionId===f.lane.id);
    assert.equal(f.io(),0,'refused before provider reads');assert.equal(await f.direct.getCurrentPackage('north'),null);
  }
});

test('publish-scene-layout refuses a moved placement for an AI table drawn for the old one, and passes one drawn for the new', async () => {
  const published=defaultCompositionSettings();published.mobile.table={width:1.75,x:0,y:.35};published.mobile.dealer.y=.03;
  const moved=structuredClone(published);moved.desktop.table.width=.8;
  const stale=await placementFixture({dealer:'paow',tableLabel:drawnForPaow(published)}),before=await stale.direct.getCurrentPackage('north');
  await assert.rejects(stale.prepare(),error=>error.code==='ai_table_misfit'&&error.reason==='ai_table_other_placement'&&error.assetId===placementTable);
  assert.equal((await stale.direct.getCurrentPackage('north')).revision,before.revision,'the published package is unchanged');
  const redrawn=await placementFixture({dealer:'paow',tableLabel:drawnForPaow(moved)});
  const receipt=await redrawn.publish(await redrawn.prepare());
  assert.equal(receipt.packageRevision,10);assert.equal(receipt.presentation.lanes[0].composition.desktop.table.width,.8);
});

// Bolagets eget material across the publishers that rebuild a presentation.
// The material store runs real SQL on PGlite (with or without 021); the
// publishers keep their SQL facade.
import {createPglitePool} from '../../../test/fixtures/pglite-pool.mjs';
import {planStudioMigrations,applyStudioMigrations} from '../../../ops/neon-studio/migrations.mjs';
import {createOperatorMaterialStore} from '../lib/operator-material-store.mjs';
import {operatorTableBinding} from '../lib/operator-material-publication.mjs';
import {createPartnerBrandingApi} from '../lib/partner-branding-api.mjs';
import {canonicalStudioJson} from '../../../packages/studio-registry/server/document-contract.mjs';
import {randomUUID} from 'node:crypto';

const ownBackground='0d0d0d0d-0000-4000-8000-00000000b001',ownTable='0d0d0d0d-0000-4000-8000-00000000c001';
const ownAsset=(id,role,sha)=>({schemaVersion:1,id,role,label:role==='table'?'Bolagets bord':'Bolagets bakgrund',sha256:sha.repeat(64),size:4096,
  contentType:'image/png',width:1920,height:1080,pathname:`croupier/media/${role==='table'?'tables':'backgrounds'}/${id}/${sha.repeat(64)}.png`});
async function materialDatabase({with021=true}={}){
  const pool=await createPglitePool({migrations:[]}),plan=await planStudioMigrations({pool});
  await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true,deferOptional:with021?[]:['021']});
  const operators=await createOperatorStore({sql:pool,scope:nativeScope,now:clock});
  for(const id of ['north','south'])await operators.createOperator({actor:'fixture',operatorId:id,slug:id,name:id});
  return {pool,store:createOperatorMaterialStore({sql:pool,scope:nativeScope,now:clock})};
}
// The company may change background and table; the background layer is an image layer.
async function unlockOwnMaterial(f){
  const doc=await f.repository.readDocument('project'),lane=doc.value.lanes.find(row=>row.id===f.lane.id);
  lane.layers.background={enabled:true,mode:'image',default:null,allowed:[]};lane.operatorAdjustable=['table.color','table','background','branding'];
  lane.composition=defaultCompositionSettings();
  await f.repository.saveDocument('project',{value:doc.value,expectedRevision:doc.revision,actor:'tester'});
  return lane;
}
// Fixture only: a first package, then a live room on this template with the same frozen branding.
async function withOwnRoom(f,lane){
  const first=await f.publish();
  const room={schemaVersion:2,id:'room-own',name:'Eget rum',operatorId:'north',presentationLaneId:lane.id,gameLaneId:'johns-game',state:'live'};
  const admin=await f.repository.readDocument('administration');admin.value.rooms=[room];
  await f.repository.saveDocument('administration',{value:withoutRooms(admin.value),expectedRevision:admin.revision,actor:'tester'});
  const rev1=await f.direct.getCurrentPackage('north');
  await f.direct.publishPackage({actor:'tester',operatorId:'north',expectedRevision:1,lanes:rev1.lanes,games:['blackjack'],tables:[room.id],rooms:[room],branding:rev1.branding});
  return {first,room};
}
const has=(presentation,id,role)=>presentation.assets.some(row=>row.id===id)&&presentation.lanes.every(lane=>lane.layers[role].allowed.includes(id));
const staff=()=>({actorId:'staff-1',accessClass:'internal-admin',requestId:randomUUID()});
async function approve(store,materialId,role,tableBinding,operatorId='north'){
  await store.appendMaterial({actor:'staff-1',audit:staff(),operatorId,materialId,expectedRevision:0,state:'pending',source:'upload',
    asset:ownAsset(materialId,role,role==='table'?'7':'6'),...(tableBinding?{tableBinding}:{})});
  await store.appendMaterial({actor:'staff-1',audit:staff(),operatorId,materialId,expectedRevision:1,state:'approved'});
}
const handler=f=>f.api.handlers.get('POST /studio/api/admin/operator-package'),preparation=f=>f.api.preparations.get('POST /studio/api/admin/operator-package');
async function admin(f,body){const context={...f.context,body};return handler(f)({...context,prepared:await preparation(f)(context)});}
function brandingApi(f,db){
  const readAdministration=()=>f.repository.readDocument('administration');
  return createPartnerBrandingApi({store:f.direct,readAdministration,readProject:async()=>(await f.repository.readDocument('project')).value,materials:db.store,
    withWriteContext:work=>f.repository.transaction(()=>f.repository.withTransactionClient(async client=>work({
      store:await createOperatorStore({sql:client,scope:nativeScope,now:clock,transaction:callback=>f.repository.withTransactionClient(callback)}),
      readAdministration,reauthorize:async()=>true,materials:db.store})))});
}

test('approved company material survives every rebuilding publisher: Admin package, scene layout, idle refresh and the company\'s drafts',async t=>{
  const db=await materialDatabase();t.after(()=>db.pool.end());
  const f=await nativeFixture({dealer:'paow',materials:()=>db.store});
  const lane=await unlockOwnMaterial(f);
  await approve(db.store,ownBackground,'background');
  await approve(db.store,ownTable,'table',operatorTableBinding('paow',lane));
  const kept=(presentation,step)=>{assert.ok(has(presentation,ownBackground,'background'),step+': background');assert.ok(has(presentation,ownTable,'table'),step+': table');};
  const stored=async()=>readPackagePresentation(await f.direct.getCurrentPackage('north'));
  // Without a room on the template nothing is added; the warning says why.
  const {first,room}=await withOwnRoom(f,lane);
  assert.equal(first.presentation.assets.length,0);
  assert.deepEqual(first.materialWarnings.map(row=>[row.materialId,row.code]),[[ownBackground,'operator_material_no_room'],[ownTable,'operator_material_no_room']]);
  // 1. Admin's package publication freezes the project and adds the company's material.
  const again=await f.publish();assert.equal(again.packageRevision,3);assert.equal(again.materialWarnings,undefined);
  kept(again.presentation,'admin package');kept(await stored(),'admin package stored');
  // 2. Saved scene layout: a change that keeps dealer and table placement.
  const doc=await f.repository.readDocument('project');doc.value.lanes[0].composition.tableFront=true;
  await f.repository.saveDocument('project',{value:doc.value,expectedRevision:doc.revision,actor:'tester'});
  const saved=await f.repository.readDocument('project');
  const sceneReceipt=await admin(f,{action:'publish-scene-layout',operatorId:'north',compositionId:lane.id,expectedPackageRevision:3,expectedProjectRevision:saved.revision});
  assert.equal(sceneReceipt.packageRevision,4);assert.equal(sceneReceipt.presentation.lanes[0].composition.tableFront,true);
  kept(sceneReceipt.presentation,'scene layout');kept(await stored(),'scene layout stored');
  // 3. Idle refresh: only the saved idle selection changes.
  const alternate={...structuredClone(f.record),id:'10000000-0000-4000-8000-000000000099',sha256:'d'.repeat(64)};
  alternate.classification.label='Extra idle';alternate.pathname=`croupier/media/dealers/paow/review/uploads/${alternate.id}/${alternate.sha256}.mp4`;
  await f.repository.registerMedia(alternate,{actor:'tester'});
  const idleDoc=await f.repository.readDocument('project');
  idleDoc.value.dealerIdlePolicies=[{dealerId:'paow',policy:{schemaVersion:1,familyId:'paow/idle.ready/ready',base:[{videoId:mediaId,weight:100,durationMs:1625}],
    variants:[{videoId:alternate.id,use:'rotation',automatic:null,durationMs:1625}],
    rotation:{clips:[mediaId,alternate.id].map(videoId=>({videoId,phase:'any',from:'rest',to:'rest',weight:20,head:false,calm:true}))}}}];
  await f.repository.saveDocument('project',{value:idleDoc.value,expectedRevision:idleDoc.revision,actor:'tester'});
  const idleReceipt=await admin(f,{action:'refresh-dealer-idle',operatorId:'north',roomId:room.id,dealerId:'paow',expectedPackageRevision:4});
  assert.equal(idleReceipt.packageRevision,5);assert.ok(idleReceipt.presentation.playback.media.some(row=>row.id===alternate.id));
  kept(idleReceipt.presentation,'idle refresh');kept(await stored(),'idle refresh stored');
  // 4. The company's draft chooses its own background: save, review and publish.
  const branding=brandingApi(f,db),audit=()=>({actorId:'partner-1',accessClass:'partner',requestId:randomUUID()});
  const cycle=async(choice,expectedPackageRevision,expectedDraftRevision)=>{
    await branding.command({operatorId:'north',actor:'partner-1',audit:audit(),action:'save-draft',expectedDraftRevision,expectedPackageRevision,branding:choice});
    const review=await branding.command({operatorId:'north',actor:'partner-1',audit:audit(),action:'review',expectedDraftRevision:expectedDraftRevision+1,expectedPackageRevision});
    return branding.command({operatorId:'north',actor:'partner-1',audit:audit(),action:'publish',expectedDraftRevision:expectedDraftRevision+1,expectedPackageRevision,reviewToken:review.reviewToken});
  };
  const view=await cycle({lane:lane.id,background:ownBackground},5,0);
  assert.equal(view.packageRevision,6);assert.equal(view.branding.background,ownBackground);
  kept(view.presentation,'branding');kept(await stored(),'branding stored');
  // 5. The next draft also chooses the company's own table graphic.
  const draftPublished=await cycle({lane:lane.id,background:ownBackground,table:ownTable},6,2);
  assert.equal(draftPublished.packageRevision,7);kept(draftPublished.presentation,'draft');kept(await stored(),'draft stored');
  assert.equal((await f.direct.getCurrentPackage('north')).branding.table,ownTable,'the company chose its own table graphic');
  // 6. Admin publishes the package again: the company's choice and material stay.
  const last=await f.publish();assert.equal(last.packageRevision,8);kept(last.presentation,'admin again');
  assert.equal((await f.direct.getCurrentPackage('north')).branding.background,ownBackground);
  // Revoked material and a moved placement leave the next package, with a warning naming the room.
  await db.store.appendMaterial({actor:'staff-1',audit:staff(),operatorId:'north',materialId:ownBackground,expectedRevision:2,state:'revoked'});
  const movedDoc=await f.repository.readDocument('project');movedDoc.value.lanes[0].composition.desktop.table.y=.1;movedDoc.value.lanes[0].composition.mobile.table.y=.1;
  await f.repository.saveDocument('project',{value:movedDoc.value,expectedRevision:movedDoc.revision,actor:'tester'});
  const movedSaved=await f.repository.readDocument('project');
  const movedReceipt=await admin(f,{action:'publish-scene-layout',operatorId:'north',compositionId:lane.id,expectedPackageRevision:8,expectedProjectRevision:movedSaved.revision});
  assert.equal(movedReceipt.packageRevision,9);
  for(const id of [ownBackground,ownTable])assert.equal(movedReceipt.presentation.assets.some(row=>row.id===id),false,id);
  assert.deepEqual(movedReceipt.materialWarnings.map(row=>[row.materialId,row.code,row.reason,row.rooms.map(item=>item.id)]),
    [[ownTable,'operator_material_table_mismatch','placement',[room.id]]]);
});

test('a material decision between preparation and commit is a conflict; nothing is published',async t=>{
  const db=await materialDatabase();t.after(()=>db.pool.end());
  const f=await nativeFixture({dealer:'paow',materials:()=>db.store}),lane=await unlockOwnMaterial(f);await withOwnRoom(f,lane);
  await approve(db.store,ownBackground,'background');
  const prepared=await f.prepare();assert.ok(has(prepared.presentation,ownBackground,'background'));
  await db.store.appendMaterial({actor:'staff-1',audit:staff(),operatorId:'north',materialId:ownBackground,expectedRevision:2,state:'revoked'});
  await assert.rejects(f.publish(prepared),error=>error.statusCode===409);
  assert.equal((await f.direct.getCurrentPackage('north')).revision,2);
  // The branding path negotiates the merged candidate and proves the same rows under the lock.
  await approve(db.store,'0d0d0d0d-0000-4000-8000-00000000b002','background');
  const branding=brandingApi(f,db),stale=createPartnerBrandingApi({store:f.direct,readAdministration:()=>f.repository.readDocument('administration'),
    readProject:async()=>(await f.repository.readDocument('project')).value,materials:{listMaterials:async()=>[]},
    withWriteContext:work=>f.repository.transaction(()=>f.repository.withTransactionClient(async client=>work({
      store:await createOperatorStore({sql:client,scope:nativeScope,now:clock,transaction:callback=>f.repository.withTransactionClient(callback)}),
      readAdministration:()=>f.repository.readDocument('administration'),reauthorize:async()=>true,materials:db.store})))});
  // Both APIs review the same draft; the stale one negotiated without the company's rows.
  const audit=()=>({actorId:'partner-1',accessClass:'partner',requestId:randomUUID()}),base={operatorId:'north',actor:'partner-1',expectedPackageRevision:2};
  const unchanged=(await branding.readState({operatorId:'north'})).branding;
  await branding.command({...base,audit:audit(),action:'save-draft',expectedDraftRevision:0,branding:unchanged});
  const review=await branding.command({...base,audit:audit(),action:'review',expectedDraftRevision:1});
  await assert.rejects(stale.command({...base,audit:audit(),action:'publish',expectedDraftRevision:1,reviewToken:review.reviewToken}),error=>error.statusCode===409);
  assert.equal((await f.direct.getCurrentPackage('north')).revision,2);
  assert.equal((await branding.command({...base,audit:audit(),action:'publish',expectedDraftRevision:1,reviewToken:review.reviewToken})).packageRevision,3);
});

test('without 021, with 021 but no material, and with another company\'s material: the exact package without company material',async t=>{
  for(const scenario of ['without 021','no material','other company']){
    const db=await materialDatabase({with021:scenario!=='without 021'});t.after(()=>db.pool.end());
    assert.equal(await db.store.available(),scenario!=='without 021');
    if(scenario==='other company')await approve(db.store,ownBackground,'background',undefined,'south');
    const f=await nativeFixture({dealer:'paow',materials:()=>db.store}),lane=await unlockOwnMaterial(f);await withOwnRoom(f,lane);
    const plain=createOperatorPackageApi({pool:f.pool,scope:nativeScope,repository:f.repository,videoRegistry:f.videoRegistry,now:clock});
    const expected=await plain.preparations.get('POST /studio/api/admin/operator-package')(f.context),prepared=await f.prepare();
    assert.deepEqual(prepared.materialWarnings,[],scenario);
    assert.equal(canonicalStudioJson(prepared.presentation),canonicalStudioJson(expected.presentation),scenario);
    const before=await f.direct.getCurrentPackage('north'),receipt=await f.publish(prepared);assert.equal(receipt.materialWarnings,undefined);
    assert.equal(canonicalStudioJson((await f.direct.getCurrentPackage('north')).branding),canonicalStudioJson(withPackagePresentation(before.branding,expected.presentation)),
      scenario+': the same frozen envelope byte for byte');
  }
});
