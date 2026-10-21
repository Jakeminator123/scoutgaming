import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {createRoomGameConfigApi} from '../lib/room-game-config-api.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {withPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {canonicalStudioJson,validateDocumentValue} from '../../../packages/studio-registry/server/document-contract.mjs';
import {ROOM_LIMIT_PRESETS,validateRoomGameConfig} from '../../../packages/presentation/contracts/room-game-config.mjs';
import {isPresentationRoomReadQuery,studioAdminEndpoint} from '../lib/studio-admin-contract.mjs';

const scope={environment:'j08-test',workspaceId:'isolated'},actor={user:'j08-admin',role:'admin'};
const clone=structuredClone;
function fixture({resolver=true}={}) {
  const cloud=cloudPresentationFixture({lanes:[defaultPresentationLane('linnea')]});
  const room={schemaVersion:2,id:'room-test',name:'Test room',operatorId:'north',presentationLaneId:'mobile-phone',gameLaneId:'room-lane',state:'live'};
  const operator={environment_id:scope.environment,workspace_id:scope.workspaceId,operator_id:'north',slug:'north',name:'North',status:'active',created_at_ms:1};
  let state={document:{revision:'admin-1',value:{rooms:[room],gameLane:'room-lane',gameLanes:[{schemaVersion:1,id:'room-lane',label:'Room',renderer:'portrait-video',dealer:'linnea',mediaCollection:'linnea-presentation'}]}},
    packages:[{environment_id:scope.environment,workspace_id:scope.workspaceId,operator_id:'north',package_revision:1,lanes:'["mobile-phone"]',games:'["blackjack"]',tables:'["room-test"]',branding:canonicalStudioJson(withPackagePresentation({},cloud.presentation)),published_at_ms:1}],configs:{},heads:{},audits:[]};
  let work=null,serial=Promise.resolve(),failure=null;const trace=[];
  const client={async query(sql,values) {
    assert.ok(work,'every SQL query uses one active repository transaction');assert.deepEqual(values.slice(0,2),[scope.environment,scope.workspaceId]);
    const marker=/\/\* ([^ ]+) \*\//.exec(sql)?.[1];trace.push(marker);
    if(failure===marker){failure=null;throw Error('injected SQL failure');}
    let rows=[];
    if(marker==='operator-store:operator-by-id'||marker==='operator-store:lock-operator')rows=values[2]===operator.operator_id?[operator]:[];
    else if(marker==='operator-store:current-package')rows=work.packages.filter(row=>row.operator_id===values[2]).slice(-1);
    else if(marker==='operator-store:publish-package') {const row={...work.packages.at(-1),package_revision:work.packages.at(-1).package_revision+1,lanes:values[3],games:values[4],tables:values[5],branding:values[6],published_at_ms:values[7]};work.packages.push(row);rows=[row];}
    else if(marker==='operator-store:audit-write'){work.audits.push(values);rows=[{event_id:values[3]}];}
    else if(marker==='room-game-config:room-lock')assert.match(sql,/pg_advisory_xact_lock/);
    else if(marker==='room-game-config:publish-config'){const key=values[2]+':'+values[3];assert.equal(work.configs[key],undefined);work.configs[key]=values[4];}
    else if(marker==='room-game-config:publish-head')work.heads[values[2]]=values[3];
    else if(marker==='room-game-config:read-published'){const body=work.configs[values[2]+':'+values[3]];rows=body?[{body}]:[];}
    else throw Error('Unhandled SQL '+marker);
    return {rows:clone(rows)};
  }};
  const repository={scope,async transaction(callback) {
    const previous=serial;let unlock;serial=new Promise(resolve=>{unlock=resolve;});await previous;work=clone(state);
    try{const result=await callback();state=work;return result;}finally{work=null;unlock();}
  },async withTransactionClient(callback){assert.ok(work);return callback(client);},async readDocument(){assert.ok(work);return clone(work.document);},async saveDocument(kind,{value,expectedRevision}) {
    assert.ok(work);assert.equal(kind,'administration');if(work.document.revision!==expectedRevision)throw Object.assign(Error('conflict'),{statusCode:409});
    work.document={revision:'admin-'+(Number(work.document.revision.split('-')[1])+1),value:validateDocumentValue(kind,value,'validation')};return clone(work.document);
  }};
  let materialOverride=null;
  const material=({language})=>materialOverride??({revision:'media-revision-1',dealerId:'linnea',language,leadMs:1200,cardMs:880,media:cloud.mediaRows.map(({id,sha256})=>({id,sha256}))});
  const api=createRoomGameConfigApi({repository,scope,...(resolver?{resolveMaterial:material}:{}),now:()=>100});
  const invoke=(method,body,options={})=>api.handlers.get(method+' /studio/api/admin/room-game-config')({actor,scope,request:new Request('https://studio.invalid/studio/api/admin/room-game-config?operatorId=north&roomId=room-test',{method}),body,...options});
  const save=(gameConfig={language:'sv',limitPreset:'prive'},extra={})=>invoke('POST',{action:'save-draft',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:state.document.revision,expectedPackageRevision:state.packages.at(-1).package_revision,gameConfig,...extra});
  const publish=draft=>invoke('POST',{action:'publish',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:draft.administrationRevision,expectedPackageRevision:draft.packageRevision,expectedDraftRevision:draft.draft.revision});
  return {api,invoke,save,publish,trace,snapshot:()=>clone(state),fail:marker=>{failure=marker;},setMaterial:value=>{materialOverride=value;},material:()=>material({language:'sv'})};
}

test('J08 save/read/publish binds immutable full profile and package on the same transaction',async()=>{
  const f=fixture(),draft=await f.save();assert.equal(draft.published,null);assert.equal(draft.publication.ready,true);
  assert.deepEqual(f.snapshot().heads,{});assert.equal(f.snapshot().packages.length,1);assert.deepEqual((await f.invoke('GET')).draft,draft.draft);
  const result=await f.publish(draft);assert.equal(result.packageRevision,2);assert.equal(result.draft,null);assert.equal(result.published.packageRevision,2);
  const stored=f.snapshot(),version=result.published.configVersion,config=JSON.parse(stored.configs['room-test:'+version]);
  assert.equal(stored.heads['room-test'],version);assert.equal(JSON.parse(stored.packages.at(-1).branding).roomGameConfigVersions['room-test'],version);
  assert.equal(config.betMs,20000);assert.equal(config.actionMs,15000);assert.equal(config.language,'sv');assert.equal(config.cardMs,880);
  assert.deepEqual(config.limits,{min:5,max:2000,sideMax:200});assert.deepEqual(config.chips,ROOM_LIMIT_PRESETS.prive.chips);assert.equal(config.refill,1000);
  assert.ok(f.trace.indexOf('room-game-config:room-lock')<f.trace.indexOf('operator-store:publish-package'));
  assert.deepEqual((await f.invoke('GET')).published,result.published);
});
test('J08 role and tenant failures happen before data reads; wrong room cannot publish',async()=>{
  const f=fixture();await assert.rejects(f.invoke('GET',undefined,{actor:{user:'partner',role:'partner'}}),{statusCode:403});
  await assert.rejects(f.invoke('GET',undefined,{scope:{...scope,workspaceId:'other'}}),{statusCode:403});assert.equal(f.trace.length,0);
  await assert.rejects(f.save(undefined,{roomId:'other-room'}),{statusCode:404});assert.equal(f.snapshot().packages.length,1);
});
test('J08 stale administration, package and draft revisions never partially publish',async()=>{
  const f=fixture(),first=await f.save();await assert.rejects(f.save(undefined,{expectedAdministrationRevision:'old'}),{statusCode:409});
  await assert.rejects(f.save(undefined,{expectedPackageRevision:99}),{statusCode:409});await f.save({language:'en',limitPreset:'high'});
  await assert.rejects(f.publish(first),{statusCode:409});assert.deepEqual(f.snapshot().heads,{});
});
test('J08 publication fault rolls package, audit, config, head and draft back together',async()=>{
  const f=fixture(),draft=await f.save(),before=f.snapshot();f.fail('room-game-config:publish-head');await assert.rejects(f.publish(draft),/injected/);assert.deepEqual(f.snapshot(),before);
  await f.publish(draft);assert.equal(f.snapshot().packages.length,2);
});
test('J08 concurrent duplicate publications have one winner',async()=>{
  const f=fixture(),draft=await f.save();const outcomes=await Promise.allSettled([f.publish(draft),f.publish(draft)]);
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);assert.equal(outcomes.find(row=>row.status==='rejected').reason.statusCode,409);assert.equal(f.snapshot().packages.length,2);
});
test('J08 unavailable, wrong-language or changed-hash material is rejected without fixture fallback',async()=>{
  const unavailable=fixture({resolver:false}),draft=await unavailable.save();assert.equal(draft.publication.ready,false);await assert.rejects(unavailable.publish(draft),{statusCode:422});
  for(const override of ['language','hash']) {const f=fixture();const value=f.material();if(override==='language')value.language='en';else value.media[0].sha256='f'.repeat(64);f.setMaterial(value);const d=await f.save();assert.equal(d.publication.ready,false);await assert.rejects(f.publish(d),{statusCode:422});assert.deepEqual(f.snapshot().heads,{});}
});
test('J08 only accepted values, strict document draft and read query shapes survive validation',()=>{
  for(const language of ['en','sv'])for(const limitPreset of Object.keys(ROOM_LIMIT_PRESETS))assert.deepEqual(validateRoomGameConfig({language,limitPreset}),{language,limitPreset});
  for(const bad of [{language:'de',limitPreset:'prive'},{language:'sv',limitPreset:'custom'},{language:'sv',limitPreset:'prive',betMs:1}])assert.throws(()=>validateRoomGameConfig(bad));
  assert.throws(()=>validateDocumentValue('administration',{rooms:[],roomGameConfigs:[{roomId:'forged'}]},'r1'));
  assert.ok(studioAdminEndpoint('GET','/studio/api/admin/room-game-config'));assert.ok(studioAdminEndpoint('GET','/studio/api/admin/shared-table-proof'));
  for(const query of ['operatorId=north&roomId=r&roomId=other','operatorId=north&roomId=r&language=sv','operatorId=north','operatorId=north&roomId=../x'])assert.equal(isPresentationRoomReadQuery('GET',new URL('https://x.invalid/studio/api/admin/room-game-config?'+query)),false);
  assert.equal(isPresentationRoomReadQuery('POST',new URL('https://x.invalid/studio/api/admin/room-game-config?operatorId=north&roomId=r')),false);
});

test('J08 HTTP boundary preserves private reads, origin protection and package readiness descriptors',async()=>{
  const f=fixture(),origin='https://studio.invalid',transactions=[];
  const http=createStudioAdminApi({authorize:async()=>({...actor,scope}),allowedOrigins:[origin],publicHosts:['studio.invalid'],handlers:f.api.handlers,
    mutationTransaction:async(work,options)=>{transactions.push(options);return work();}});
  const path=origin+'/studio/api/admin/room-game-config';
  const read=await http.handle(new Request(path+'?operatorId=north&roomId=room-test'));
  assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'private, no-store');assert.equal((await read.json()).draft,null);
  const request=body=>new Request(path,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(body)});
  const body={action:'save-draft',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:'admin-1',expectedPackageRevision:1,gameConfig:{language:'sv',limitPreset:'casual'}};
  const draftResponse=await http.handle(request(body));assert.equal(draftResponse.status,200);const draft=await draftResponse.json();
  assert.deepEqual(transactions[0],{presentationDocuments:['project','administration']});
  const publishBody={action:'publish',operatorId:'north',roomId:'room-test',expectedAdministrationRevision:draft.administrationRevision,expectedPackageRevision:1,expectedDraftRevision:draft.draft.revision};
  const forged=request(publishBody);forged.headers.set('origin','https://other.invalid');assert.equal((await http.handle(forged)).status,403);assert.equal(f.snapshot().packages.length,1);
  const published=await http.handle(request(publishBody));assert.equal(published.status,200);assert.equal((await published.json()).published.packageRevision,2);
  assert.deepEqual(transactions[1],{presentationDocuments:['project','administration'],presentationOperatorIds:['north']});
});