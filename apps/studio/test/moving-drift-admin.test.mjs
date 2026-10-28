import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingDriftAdminApi,movingDriftAdminConfiguration} from '../lib/moving-drift-admin.mjs';
import {createStudioAdminApi} from '../lib/studio-admin-api.mjs';
import {createNativeStudioRequestHandlers} from '../lib/studio-native-runtime.mjs';
import {createMovingDriftController} from '../../../services/game/moving-drift-controller.mjs';

const origin='https://studio.example.invalid',path='/studio/api/admin/moving-drift';
const scope={environment:'isolated-drift-api',workspaceId:'qa'};
const session={user:'Jakob',role:'admin',accountId:'fixture-owner',scope};
const profiles=[{id:'base',label:'Bas',dealerId:'dragan',endpointId:'private-endpoint-1',releaseDigest:'a'.repeat(64),bankHash:'b'.repeat(64)}];
const enabled={CROUPIER_STUDIO_MOVING_DRIFT_API:'1',CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify(profiles)};
const stop=(extra={})=>({expectedRevision:0,commandId:'stop-1',mode:'off',...extra});
const request=(body,options={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},...options});
function fixture(options={}) {
  let state=null,now=1792404000000,calls=0;
  let serial=Promise.resolve();
  const store={transact(work) {
    const result=serial.then(()=>{calls++;const next=work(structuredClone(state),now);state=structuredClone(next.state);return next.value;});
    serial=result.catch(()=>{});return result;
  }};
  const service=createMovingDriftAdminApi({scope,env:enabled,storeFactory:()=>store,...options.service});
  const api=createStudioAdminApi({authorize:()=>session,allowedOrigins:[origin],publicHosts:[new URL(origin).host],
    mutationTransaction:work=>work(),handlers:service.handlers,gates:service.gates,...options.api});
  return {api,service,store,get calls(){return calls;},get state(){return state;},advance(ms){now+=ms;}};
}

test('configuration is explicit, bounded and cannot enable runtime/provider capabilities',async()=>{
  assert.equal(movingDriftAdminConfiguration({}),null);
  assert.equal(movingDriftAdminConfiguration({...enabled,CROUPIER_STUDIO_MOVING_DRIFT_API:'true'}),null);
  const {dealerId:_dealer,...withoutDealer}=profiles[0],second={...profiles[0],id:'paow',dealerId:'paow',endpointId:'private-endpoint-2'};
  for(const raw of [undefined,'{}','[]','null','invalid',' '.repeat(8193),
    JSON.stringify(Array(9).fill(profiles[0])),JSON.stringify([{...profiles[0],url:'private'}]),
    // Every profile names exactly one dealer, and dealers never share a profile ID or endpoint.
    JSON.stringify([withoutDealer]),JSON.stringify([{...profiles[0],dealerId:'Dragan'}]),JSON.stringify([{...profiles[0],dealerId:null}]),
    JSON.stringify([profiles[0],{...second,dealerId:'dragan'}]),JSON.stringify([profiles[0],{...second,endpointId:profiles[0].endpointId}]),
    JSON.stringify([profiles[0],{...second,id:profiles[0].id}])]) {
    assert.throws(()=>movingDriftAdminConfiguration({...enabled,CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:raw}),e=>e.code==='drift_invalid_configuration');
  }
  let borrowed=0;
  const pool={connect(){borrowed++;throw Error('no network');}};
  const service=createMovingDriftAdminApi({pool,scope,env:enabled});
  assert.equal(service.configured,true);assert.equal(borrowed,0);
  const f=fixture();
  const response=await f.api.handle(request()),status=await response.json();
  assert.equal(response.status,200);assert.equal(status.desired.mode,'off');
  assert.equal(status.observed.status,'unknown');assert.equal(status.admission.allowed,false);
  assert.deepEqual(status.capabilities,{connected:false,allowedModes:['off'],reasonCode:'drift_runtime_unavailable'});
  assert.equal(status.cost.estimatedMicroUsd,null);
  for(const [mode,extra] of [['saving',{}],['warm',{durationSeconds:1800}]]) {
    const denied=await f.api.handle(request(stop({mode,profileId:'base',...extra})));
    assert.equal(denied.status,503);assert.equal((await denied.json()).code,'drift_runtime_unavailable');
  }
  assert.equal(f.state.revision,0);
});

test('configuration enforces the exact UTF-8 byte limit without a Node Buffer global',()=>{
  for(const label of ['Bas','Å😀漢']) {
    const configured=[{...profiles[0],label}],json=JSON.stringify(configured),bytes=Buffer.byteLength(json,'utf8');
    for(const limit of [8191,8192,8193]) {
      const raw=json+' '.repeat(limit-bytes);
      assert.equal(Buffer.byteLength(raw,'utf8'),limit);
      const previous=globalThis.Buffer;
      try {
        globalThis.Buffer=undefined;
        const parse=()=>movingDriftAdminConfiguration({...enabled,CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:raw});
        if(limit<=8192) assert.deepEqual(parse().profiles,configured);
        else assert.throws(parse,error=>error.code==='drift_invalid_configuration'&&error.statusCode===422);
      } finally {globalThis.Buffer=previous;}
    }
  }
});

test('unconfigured or invalid optional control plane leaves other Admin actions available',async()=>{
  for(const env of [{},{...enabled,CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:'bad'},
    {...enabled,CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify([{...profiles[0],bankHash:'bad'}])}]) {
    const f=fixture({service:{env}});
    assert.equal(f.service.configured,false);assert.deepEqual(f.api.availableActions(session),[]);
    for(const req of [request(),request(stop())]) {
      const res=await f.api.handle(req);assert.equal(res.status,503);
      assert.deepEqual(await res.json(),{error:'Driftväljaren är inte tillgänglig.',code:'drift_api_unavailable'});
    }
    assert.equal(f.calls,0);
    const handlers=new Map([...f.service.handlers,['GET /studio/api/admin/players',()=>({players:[]})]]);
    const api=createStudioAdminApi({authorize:()=>session,allowedOrigins:[origin],publicHosts:[new URL(origin).host],
      handlers,gates:f.service.gates});
    const unrelated=await api.handle(new Request(origin+'/studio/api/admin/players'));
    assert.equal(unrelated.status,200);assert.deepEqual(await unrelated.json(),{players:[]});
  }
});

test('one configured dealer addresses that dealer slot; several dealers keep the API closed until Admin selects one',async()=>{
  const seen=[],store={transact:()=>assert.fail('construction reads no state')};
  const f=fixture({service:{storeFactory:options=>{seen.push(options);return store;}}});
  assert.equal(f.service.configured,true);
  assert.deepEqual(seen.map(({environmentId,dealerId})=>({environmentId,dealerId})),[{environmentId:scope.environment,dealerId:'dragan'}]);
  const second={...profiles[0],id:'paow',label:'Paow',dealerId:'paow',endpointId:'private-endpoint-2'};
  const several=createMovingDriftAdminApi({scope,env:{...enabled,CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify([profiles[0],second])},
    storeFactory:()=>assert.fail('several dealers must not open a store')});
  assert.equal(several.configured,false);assert.deepEqual([...several.handlers.keys()],[]);
});

test('API returns explicit public fields, private headers and repeatable CAS command results',async()=>{
  const f=fixture();
  const initial=await f.api.handle(request());assert.equal(initial.headers.get('cache-control'),'private, no-store');
  assert.equal(initial.headers.get('x-content-type-options'),'nosniff');
  assert.match(initial.headers.get('content-type'),/^application\/json/);
  assert.ok(f.api.availableActions(session).includes('POST moving-drift'));
  const a=await f.api.handle(request(stop())),saved=await a.json();
  assert.equal(a.status,200);assert.equal(saved.revision,1);assert.equal(saved.observed.status,'unknown');
  assert.equal(saved.desired.mode,'off');assert.equal(saved.admission.allowed,false);
  assert.equal('nextAction' in saved,false);
  for(const privateValue of ['private-endpoint-1',profiles[0].releaseDigest,profiles[0].bankHash]) assert.equal(JSON.stringify(saved).includes(privateValue),false);
  const retry=await f.api.handle(request({mode:'off',commandId:'stop-1',expectedRevision:0}));
  assert.deepEqual(await retry.json(),saved);
  const conflict=await f.api.handle(request(stop({commandId:'stop-2'})));
  assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'drift_revision_conflict');
  const changed=await f.api.handle(request(stop({expectedRevision:1})));
  assert.equal(changed.status,409);assert.equal((await changed.json()).code,'drift_command_reused');
  const race=await Promise.all([f.api.handle(request(stop({expectedRevision:1,commandId:'race-a'}))),
    f.api.handle(request(stop({expectedRevision:1,commandId:'race-b'})))]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(f.state.revision,2);
});

test('N1 role, fresh session and configured workspace are checked before any state access',async()=>{
  for(const actor of [null,{...session,role:'partner-admin'},{...session,role:'player'},
    {...session,scope:{...scope,environment:'other'}},{...session,scope:{...scope,workspaceId:'other'}}]) {
    const f=fixture({api:{authorize:()=>actor}});
    for(const req of [request(),request(stop())]) assert.ok([401,403].includes((await f.api.handle(req)).status));
    assert.equal(f.calls,0);
  }
  let revoked=false;
  const f=fixture({api:{authorize:()=>revoked?{...session,role:'player'}:session,
    mutationTransaction:work=>{revoked=true;return work();}}});
  assert.equal((await f.api.handle(request(stop()))).status,403);
  assert.equal(f.calls,0);
});

test('exact routes, CSRF, JSON and forbidden observer/provider input fail without state changes',async()=>{
  const f=fixture();
  const cases=[
    [request(stop(),{headers:{origin:'https://evil.invalid','sec-fetch-site':'same-origin','content-type':'application/json'}}),403],
    [request(stop(),{headers:{origin,'sec-fetch-site':'cross-site','content-type':'application/json'}}),403],
    [request(stop(),{headers:{origin,'content-type':'application/json'}}),403],
    [request(stop(),{headers:{origin,'sec-fetch-site':'same-origin','content-type':'text/plain'}}),415],
    [request(stop(),{body:'{'}),400],
    [request(stop({actor:'admin'})),400],[request(stop({scope})),400],
    [request(stop({endpointId:'client-endpoint'})),422],[request(stop({observed:{status:'ready'}})),422],
    [request(stop({nextAction:{type:'apply'}})),422],[request(stop({endsAtMs:1799999999999})),422],
    [new Request(origin+path+'?profileId=base'),404],[new Request(origin+path+'/observe'),404],
    [new Request(origin+path,{method:'DELETE'}),405],
  ];
  for(const [req,status] of cases) assert.equal((await f.api.handle(req)).status,status,req.url);
  assert.equal(f.calls,0);
});

test('native request handler uses the same API in both documented basePath configurations',async()=>{
  for(const apiBase of ['/studio/api/admin','/api/admin']) {
    const f=fixture({api:{apiBase}});
    const handler=createNativeStudioRequestHandlers({configuration:()=>({allowedOrigins:[origin,'https://lab.example.invalid'],
      publicHosts:[new URL(origin).host,'lab.example.invalid'],apiBase,authBase:apiBase.replace('/admin','/auth')}),runtime:async()=>({api:f.api})});
    const url=origin+apiBase+'/moving-drift';
    const get=await handler.handleNativeAdmin(new Request(url));
    assert.equal(get.status,200);assert.equal((await get.json()).revision,0);
    const post=await handler.handleNativeAdmin(new Request(url,{method:'POST',body:JSON.stringify(stop()),
      headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'}}));
    assert.equal(post.status,200);assert.equal((await post.json()).revision,1);
    const cross=await handler.handleNativeAdmin(new Request(url,{headers:{'sec-fetch-site':'cross-site'}}));
    assert.equal(cross.status,403);
  }
});

test('unavailable schema/driver and private errors produce bounded public failures',async()=>{
  const f=fixture({service:{storeFactory:()=>({transact(){throw Object.assign(new Error('private host password'),{code:'42P01'});}})}});
  const error=await f.api.handle(request());
  assert.equal(error.status,500);assert.deepEqual(await error.json(),{error:'Request failed'});
  const unavailable=fixture({service:{pool:{async connect(){throw new Error('private password');}},storeFactory:undefined}});
  const response=await unavailable.api.handle(request(stop()));
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'Driftläget kan inte läsas eller sparas just nu.',code:'drift_store_unavailable'});
  assert.equal(unavailable.calls,0);
});

test('a lost HTTP acknowledgement can be retried without advancing the durable command',async()=>{
  let lost=true;
  const f=fixture({api:{mutationTransaction:async work=>{
    const value=await work();if(lost){lost=false;throw Error('response_lost_fixture');}return value;
  }}});
  assert.equal((await f.api.handle(request(stop()))).status,500);assert.equal(f.state.revision,1);
  const retry=await f.api.handle(request(stop()));
  assert.equal(retry.status,200);assert.equal((await retry.json()).revision,1);
});

test('availableModes and admission come from the controller, never from command success',async()=>{
  const f=fixture({service:{controllerFactory:options=>createMovingDriftController({...options,capabilities:{connected:true}})}});
  const saved=await f.api.handle(request(stop({mode:'saving',profileId:'base'})));
  const status=await saved.json();assert.equal(saved.status,200);
  assert.equal(status.desired.mode,'saving');assert.equal(status.observed.status,'unknown');
  assert.equal(status.admission.allowed,false);assert.deepEqual(status.capabilities.allowedModes,['off','saving']);
  const warm=await f.api.handle(request({mode:'warm',expectedRevision:1,commandId:'warm-1',profileId:'base',durationSeconds:1800}));
  assert.equal(warm.status,409);assert.equal((await warm.json()).code,'drift_warm_unavailable');
});
test('Admin reports connected only from a fresh shared executor lease, and loses admission when it expires',async()=>{
  const f=fixture();
  const backend=createMovingDriftController({store:f.store,profiles,capabilities:{connected:true,requireExecutor:true}});
  const initial=await backend.status();
  const execution=await backend.claimExecution({holderId:'server-fixture',profileId:'base'});
  const observe=status=>backend.observe({revision:status.revision,operationId:status.operationId,execution,
    observedAtMs:status.serverNowMs,observedProfileIds:['base'],workers:[],queuedJobs:0,busyJobs:0,
    applied:{revision:status.revision,operationId:status.operationId,mode:status.desired.mode,profileId:status.desired.profileId,workersMin:0,workersMax:1}});
  await observe(initial);
  let response=await f.api.handle(request()),body=await response.json();
  assert.equal(body.capabilities.connected,true);assert.deepEqual(body.capabilities.allowedModes,['off','saving']);
  response=await f.api.handle(request({expectedRevision:0,commandId:'saving',mode:'saving',profileId:'base'}));
  assert.equal(response.status,200);const accepted=await response.json();
  await observe(accepted);
  response=await f.api.handle(request());body=await response.json();assert.equal(body.admission.allowed,true);
  assert.equal(JSON.stringify(body).includes(profiles[0].endpointId),false);
  f.advance(15001);
  response=await f.api.handle(request());body=await response.json();
  assert.equal(body.capabilities.connected,false);assert.equal(body.admission.allowed,false);
  assert.equal(body.observed.status,'unknown');
});
