// Isolated transport/projection fixtures: no product server, private runtime,
// provider, cloud, SQL or budget ledger is started or modified.
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer,request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {NATIVE_P6_QA,nativeP6QaRouterConfig,childSpecifications,validateCloudConfig} from '../config.mjs';
import {nativeP6QaRouterRequest,createCloudGateway} from '../gateway.mjs';
import {initializeNativeP6QaRouter,nativeP6OwnedSpeechFetch,nativeP6OwnedDirectorFetch} from '../../../web/native-p6-qa-hook.mjs';
import {projectOpenClawGameStatus} from '../../../web/openclaw-chat.mjs';
import {normalizeProductSpeechEnvelope} from '../../../open-claw/lab/src/product-speech.mjs';

const fixture=()=>({NODE_ENV:'production',PORT:'10000',CROUPIER_CLOUD_LAYOUT:'single-origin',
  CROUPIER_CLOUD_DATA_ROOT:NATIVE_P6_QA.dataRoot,RENDER_SERVICE_ID:NATIVE_P6_QA.serviceId,RENDER_EXTERNAL_URL:NATIVE_P6_QA.origin,
  RENDER_GIT_COMMIT:'1'.repeat(40),CROUPIER_STREAM_LANE:'lissabon-stream-lane',CROUPIER_STUDIO_NEON_POLICY:'1',
  CROUPIER_STUDIO_ENVIRONMENT_ID:NATIVE_P6_QA.environmentId,CROUPIER_STUDIO_WORKSPACE_ID:NATIVE_P6_QA.workspaceId,
  CROUPIER_DATABASE:'postgres',CROUPIER_GAME_DATABASE_URL:`postgresql://${NATIVE_P6_QA.database}:fixture@qa.neon.tech/${NATIVE_P6_QA.database}?sslmode=require`,
  CROUPIER_P6_QA_ROUTER:'1',CROUPIER_P6_QA_ROUTER_SOURCE_SHA256:'a'.repeat(64),CROUPIER_P6_SDK_RUN_ID:randomUUID(),
  CROUPIER_P6_SDK_DEPLOYMENT_ID:'dep-fixture',OPENCLAW_PRODUCT_SPEECH_URL:NATIVE_P6_QA.origin,
  CROUPIER_PRESENTATION_DIRECTOR_URL:NATIVE_P6_QA.origin,
  OPENCLAW_PRODUCT_SPEECH_TOKEN:'fixture-own-speech-token-'.repeat(3),CROUPIER_PRESENTATION_DIRECTOR_TOKEN:'fixture-own-director-token-'.repeat(3),
  CROUPIER_P6_SDK_WORKER_TOKEN:'fixture-sdk-worker-token-'.repeat(3),CROUPIER_P6_SDK_READBACK_TOKEN:'fixture-sdk-readback-token-'.repeat(3),
  CROUPIER_P6_SDK_TICKET_SECRET:'fixture-root-stage-secret-'.repeat(3)});
const privateRequest=(env,path='/api/product/speech')=>({url:path,method:'POST',headers:{host:new URL(NATIVE_P6_QA.origin).host,
  authorization:'Bearer '+env.OPENCLAW_PRODUCT_SPEECH_TOKEN,'content-type':'application/json'}});

test('default-off bootstrap does not read private files or require private credentials',async()=>{
  for(const flag of [undefined,'','0']){
    const env={CROUPIER_P6_QA_ROUTER:flag};assert.equal(nativeP6QaRouterConfig(env),null);
    assert.equal(await initializeNativeP6QaRouter(env),null);assert.equal(nativeP6QaRouterRequest(privateRequest(fixture()),null),null);
  }
  assert.equal(nativeP6OwnedSpeechFetch(null,{}),null);
  assert.equal(nativeP6OwnedDirectorFetch(null,{}),null);
});

test('Director hook retains actual owner, live state and saved policy readers with an opaque owner cache scope',async()=>{
  const project={revision:'saved-policy'},readOwner=async()=> 'actual-owner',readStatus=async()=>({dealerId:'astrid',sessionRevision:'s',roundRevision:'r'}),
    readProject=async()=>project,signal=new AbortController().signal;let captured;
  const router={fetchForOwnedDirectorRequest:input=>{captured=input;return()=>{};}};
  const input={playerId:'actual-player',owner:'actual-owner',project,readOwner,readStatus,readProject,signal};
  const owned=nativeP6OwnedDirectorFetch(router,input);assert.deepEqual(captured,input);assert.match(owned.cacheScope,/^[a-f0-9]{64}$/);
  assert.notEqual(owned.cacheScope,nativeP6OwnedDirectorFetch(router,{...input,owner:'other-owner'}).cacheScope);
  assert.notEqual(owned.cacheScope,nativeP6OwnedDirectorFetch(router,{...input,project:{revision:'new-policy'}}).cacheScope);
  for(const key of ['readOwner','readStatus','readProject'])assert.throws(()=>nativeP6OwnedDirectorFetch(router,{...input,[key]:null}),/actual_director_callbacks_required/);
});

test('explicit QA requires exact service, Neon role/database, source/deployment and separate credentials',()=>{
  const env=fixture();assert.equal(nativeP6QaRouterConfig(env).runId,env.CROUPIER_P6_SDK_RUN_ID);
  for(const change of [{CROUPIER_P6_QA_ROUTER:'true'},{NODE_ENV:'development'},{RENDER_SERVICE_ID:'srv-production'},
    {RENDER_EXTERNAL_URL:'https://production.onrender.com'},{CROUPIER_CLOUD_DATA_ROOT:'/var/data/openclaw'},
    {CROUPIER_STUDIO_ENVIRONMENT_ID:'production'},{CROUPIER_STUDIO_WORKSPACE_ID:'other'},
    {CROUPIER_DATABASE:'sqlite'},{CROUPIER_GAME_DATABASE_URL:'postgresql://other:fixture@qa.neon.tech/other?sslmode=require'},
    {CROUPIER_GAME_DATABASE_URL:env.CROUPIER_GAME_DATABASE_URL.replace('sslmode=require','sslmode=disable')},
    {CROUPIER_CLOUD_LAYOUT:'separate-hosts'},{CROUPIER_P6_QA_ROUTER_SOURCE_SHA256:'invalid'},
    {CROUPIER_P6_SDK_RUN_ID:'unbound'},{CROUPIER_P6_SDK_DEPLOYMENT_ID:'latest'},
    {OPENCLAW_PRODUCT_SPEECH_URL:'https://shared.onrender.com'},{CROUPIER_PRESENTATION_DIRECTOR_URL:'https://shared.onrender.com'},
    {CROUPIER_P6_SDK_WORKER_TOKEN:env.OPENCLAW_PRODUCT_SPEECH_TOKEN},{CROUPIER_P6_SDK_TICKET_SECRET:''},
    ...['NODE_OPTIONS','NODE_PATH','LD_PRELOAD','NODE_EXTRA_CA_CERTS','NODE_TLS_REJECT_UNAUTHORIZED'].map(k=>({[k]:'injected'}))]){
    assert.throws(()=>nativeP6QaRouterConfig({...env,...change}),/CROUPIER_P6_QA_ROUTER/);
  }
});

test('a supplied environment cannot fabricate a real Linux Web process bootstrap',async()=>{
  await assert.rejects(initializeNativeP6QaRouter(fixture()),/native_p6_qa_actual_web_required/);
});

test('QA bindings reach only Web, with no SDK provider credential or loader forwarded',()=>{
  const env={...fixture(),OPENAI_API_KEY:'fixture-not-forwarded',DATABASE_URL:'fixture-not-forwarded'};
  const specs=childSpecifications(validateCloudConfig(env),env,{labInternalSecret:'fixture-private-lab-secret-'.repeat(3)});
  for(const name of ['RENDER_SERVICE_ID','RENDER_GIT_COMMIT','RENDER_EXTERNAL_URL','CROUPIER_CLOUD_DATA_ROOT',
    'CROUPIER_P6_QA_ROUTER','CROUPIER_P6_QA_ROUTER_SOURCE_SHA256','CROUPIER_P6_SDK_RUN_ID','CROUPIER_P6_SDK_DEPLOYMENT_ID',
    'CROUPIER_P6_SDK_WORKER_TOKEN','CROUPIER_P6_SDK_READBACK_TOKEN','CROUPIER_P6_SDK_TICKET_SECRET']){
    assert.equal(specs.web.env[name],env[name]);assert.equal(specs.lab.env[name],undefined);
  }
  assert.equal(nativeP6QaRouterConfig(specs.web.env).runId,env.CROUPIER_P6_SDK_RUN_ID);
  for(const spec of Object.values(specs))for(const key of ['OPENAI_API_KEY','DATABASE_URL','NODE_OPTIONS','NODE_PATH'])assert.equal(spec.env[key],undefined);
  const disabled={...env,CROUPIER_P6_QA_ROUTER:'0'};
  const off=childSpecifications(validateCloudConfig(disabled),disabled,{labInternalSecret:'fixture-private-lab-secret-'.repeat(3)});
  assert.equal(off.web.env.CROUPIER_P6_QA_ROUTER,undefined);assert.equal(off.web.env.CROUPIER_P6_SDK_TICKET_SECRET,undefined);
});

test('only three exact server routes with their own token can use the QA gateway',()=>{
  const env=fixture(),qa=nativeP6QaRouterConfig(env),req=privateRequest(env);
  assert.equal(nativeP6QaRouterRequest(req,qa).accepted,true);
  assert.equal(nativeP6QaRouterRequest({...req,url:'/api/studio/advice',headers:{...req.headers,
    authorization:'Bearer '+env.CROUPIER_PRESENTATION_DIRECTOR_TOKEN}},qa).accepted,true);
  assert.equal(nativeP6QaRouterRequest({...req,url:'/internal/p6/qa-routing',method:'GET',headers:{...req.headers,
    authorization:'Bearer '+env.CROUPIER_P6_SDK_READBACK_TOKEN}},qa).accepted,true);
  assert.equal(nativeP6QaRouterRequest({...req,url:'/api/other'},qa),null);
  for(const[change,status]of [[{url:'/api/product/speech?stage=text'},404],[{method:'GET'},405],
    [{headers:{...req.headers,host:'production.onrender.com'}},421],[{headers:{...req.headers,authorization:'Bearer wrong'}},401],
    [{url:'/api/studio/advice'},401],...['cookie','origin','sec-fetch-site','x-croupier-vercel-secret','x-croupier-p6-stage-ticket','x-croupier-p6-stage']
      .map(key=>[{headers:{...req.headers,[key]:'client-supplied'}},403])]){
    assert.equal(nativeP6QaRouterRequest({...req,...change},qa).status,status);
  }
  assert.equal(nativeP6QaRouterRequest(req,{...qa,serviceId:'srv-production'}).status,421);
});

test('real isolated HTTP gateway forwards before Vercel ingress and never falls back after upstream failure',async()=>{
  const env=fixture(),qa=nativeP6QaRouterConfig(env),seen=[],servers=[];
  const web=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);
    seen.push({url:req.url,host:req.headers.host,authorization:req.headers.authorization,body:Buffer.concat(chunks).toString()});
    res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"fixture_blocked"}');});
  servers.push(web);
  try{
    web.listen(0,'127.0.0.1');await once(web,'listening');
    const publicOrigin='https://croupier-native-qa-abc92154cb15.vercel.app';
    const gateway=createCloudGateway({singleOrigin:true,gameOrigin:publicOrigin,boOrigin:publicOrigin,labOrigin:publicOrigin,
      nativeP6QaRouter:qa},{webPort:web.address().port,labPort:1,labInternalSecret:'fixture-lab-secret-'.repeat(3),
      vercelIngress:{transportOrigin:NATIVE_P6_QA.origin,publicOrigin,secret:'fixture-vercel-secret-'.repeat(3)}});
    servers.push(gateway);gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
    const hit=(path,changes={})=>new Promise((resolve,reject)=>{
      const r=httpRequest({hostname:'127.0.0.1',port:gateway.address().port,path,method:'POST',
        headers:{...privateRequest(env).headers,...changes}},res=>{let body='';res.on('data',c=>body+=c);
          res.on('end',()=>resolve({status:res.statusCode,body}));});
      r.on('error',reject);r.setTimeout(2000,()=>r.destroy(Error('fixture_timeout')));r.end('canonical fixture envelope');});
    assert.equal((await hit('/api/product/speech')).status,503);assert.equal(seen.length,1);
    assert.deepEqual(seen[0],{url:'/api/product/speech',host:new URL(NATIVE_P6_QA.origin).host,
      authorization:'Bearer '+env.OPENCLAW_PRODUCT_SPEECH_TOKEN,body:'canonical fixture envelope'});
    assert.equal((await hit('/api/product/speech',{cookie:'player_session=client'})).status,403);
    assert.equal((await hit('/api/product/speech',{authorization:'Bearer other'})).status,401);
    assert.equal((await hit('/api/other')).status,421);assert.equal(seen.length,1);
    web.closeAllConnections();await new Promise(resolve=>web.close(resolve));
    assert.equal((await hit('/api/product/speech')).status,502);assert.equal(seen.length,1);
  }finally{for(const server of servers.reverse()){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
});

test('owned adapter reproduces the actual canonical contract with fresh state, history and checked memory',async()=>{
  const request={requestId:'fixture-real-turn',message:'Hello Astrid',history:[{role:'user',text:'Prior server-owned message'}]};
  const now=Date.now(),memory={asOf:now,facts:[{id:'memory-divorce',topicId:'divorce',kind:'player-assertion',quote:'I am going through a divorce.',
    saidAt:now-1000,expiresAt:now+86400000}]};
  const initial={dealerId:'astrid',sessionRevision:'session-1',roundRevision:'round-1',roundPhase:'idle',round:null,displayName:'QA',
    publishedEvents:[],occupiedBoxes:[],policy:{generatedText:true,recordedLines:[],silence:true,mediaFamilies:[]},conversationMemory:memory};
  const current={...initial,roundRevision:'round-2',wallet:100,shoe:['hidden'],cookie:'private'};delete current.conversationMemory;
  let captured;const actualFetch=()=>{};const readOwner=async()=> 'real-owner';const signal=new AbortController().signal;
  const f=nativeP6OwnedSpeechFetch({fetchForOwnedRequest:input=>{captured=input;return actualFetch;}},
    {request,status:initial,playerId:'real-player',owner:'real-owner',readOwner,readStatus:async()=>current,signal,model:'gpt-5.6-terra'});
  assert.equal(f,actualFetch);assert.equal(captured.readOwner,readOwner);assert.equal(captured.signal,signal);assert.equal(captured.playerId,'real-player');
  const e=await captured.readEnvelope();assert.deepEqual(e,normalizeProductSpeechEnvelope({request,
    status:projectOpenClawGameStatus({...current,conversationMemory:memory}),model:'gpt-5.6-terra'}));
  assert.deepEqual(e.request.history,request.history);assert.deepEqual(e.status.conversationMemory,memory);
  assert.equal(e.status.roundRevision,'round-2');for(const k of ['wallet','shoe','cookie'])assert.equal(Object.hasOwn(e.status,k),false);
});

test('owned adapter propagates real authority failure and exact trusted operator context',async()=>{
  const input={request:{},status:{},playerId:'operator-qa-real',owner:'real-owner',readOwner:async()=>null,
    readStatus:async()=>{throw Error('actual_session_revoked');},operatorAttempt:2,operatorCampaignId:randomUUID()};
  let captured;const router={fetchForOwnedRequest:value=>{captured=value;return()=>{};}};
  nativeP6OwnedSpeechFetch(router,input);assert.equal(captured.operatorAttempt,2);assert.equal(captured.operatorCampaignId,input.operatorCampaignId);
  await assert.rejects(captured.readEnvelope(),/actual_session_revoked/);
  assert.throws(()=>nativeP6OwnedSpeechFetch(router,{...input,readOwner:null}),/actual_owner_callbacks_required/);
});
