import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AI_QA_ORIGINAL,AI_QA_LIMITS,sha256,inspectAiQaRecords,createAiQaBudget} from '../web/native-ai-qa-budget.mjs';
import {createBoundedAiQaRouter} from '../web/native-ai-qa-runtime.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'bounded-ai-qa-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const anchor=Buffer.from('synthetic test authorization'),authoritySourceSha256='1'.repeat(64);
  const legacy=[];
  for(let i=0;i<2;i++)legacy.push(JSON.stringify({format:'native-p6-total-budget-event-v1',sequence:i,
    previousSha256:i?sha256(legacy[0]):null,approvalRawSha256:sha256(anchor),authoritySourceSha256:AI_QA_ORIGINAL.authoritySha256,
    atMs:i+1,event:i?{kind:'short-text-probe-outcome',outcome:'response-observed'}:
      {kind:'short-text-probe',campaignId:AI_QA_ORIGINAL.campaignId,upperBoundMicroUsd:5251152}}));
  const original={...AI_QA_ORIGINAL,anchorSha256:sha256(anchor),records:legacy.map(sha256)};
  await Promise.all(legacy.map((b,i)=>writeFile(join(directory,String(i).padStart(6,'0')+'.json'),b)));
  const anchorPath=join(directory,'..',directory.split(/[\\/]/).at(-1)+'-anchor');
  await writeFile(anchorPath,anchor);t.after(()=>rm(anchorPath,{force:true}));
  let time=100;
  const manifest={campaignId:original.campaignId,runId:'test-run',expiresAtMs:10000,limits:AI_QA_LIMITS,ownLinkedPlayerSha256:sha256('player')};
  const options={directory,anchorPath,manifest,manifestRawSha256:'2'.repeat(64),authoritySourceSha256,original,now:()=>time};
  const budget=await createAiQaBudget(options);await budget.activate();
  return{budget,options,legacy,manifest,setTime:n=>{time=n;}};
}
test('exception appends to original chain, retains every reservation, and survives a process restart',async t=>{
  const f=await fixture(t);const before=await f.budget.inspect();
  assert.equal(before.totalEncumberedMicroUsd,10000000);assert.equal(before.retainedMicroUsd,5251152);
  assert.equal(before.unencumberedMicroUsd,0);assert.equal(before.actualCostUsd,null);
  for(let i=0;i<2;i++)assert.equal(await readFile(join(f.options.directory,String(i).padStart(6,'0')+'.json'),'utf8'),f.legacy[i]);
  const key=await f.budget.dispatch('sdk','a');await f.budget.outcome(key,'response-observed',{inputTokens:34,outputTokens:22});
  const restarted=await createAiQaBudget(f.options);assert.equal((await restarted.activate()).counts.sdk,1);
  await assert.rejects(()=>restarted.dispatch('sdk','a'),/ai_qa_retry_or_expired/);
  assert.equal((await restarted.inspect()).records.length,5);
});
test('at most two generations, three SDK calls, two TTS calls; concurrent paid dispatch is fenced',async t=>{
  const f=await fixture(t);
  for(let i=0;i<2;i++){const k=await f.budget.dispatch('generation','g'+i);await f.budget.outcome(k,'response-observed');}
  await assert.rejects(()=>f.budget.dispatch('generation','g3'),/ai_qa_dispatch_limit/);
  let k=await f.budget.dispatch('sdk','s0');await assert.rejects(()=>f.budget.dispatch('tts','parallel'),/ai_qa_pending_dispatch/);
  await f.budget.outcome(k,'response-observed');
  for(let i=1;i<3;i++){k=await f.budget.dispatch('sdk','s'+i);await f.budget.outcome(k,'response-observed');}
  await assert.rejects(()=>f.budget.dispatch('sdk','s3'),/ai_qa_dispatch_limit/);
  for(let i=0;i<2;i++){k=await f.budget.dispatch('tts','t'+i);await f.budget.outcome(k,'response-observed');}
  await assert.rejects(()=>f.budget.dispatch('tts','t3'),/ai_qa_dispatch_limit/);
});
test('unknown result permanently stops paid work across restart; outcomes can still be recorded',async t=>{
  const f=await fixture(t),key=await f.budget.dispatch('sdk','lost');await f.budget.outcome(key,'uncertain');
  const restarted=await createAiQaBudget(f.options);await assert.rejects(()=>restarted.dispatch('gpu','new'),/ai_qa_active_exception_required/);
  assert.equal((await restarted.inspect()).totalEncumberedMicroUsd,10000000);
});
test('expiry fences a new dispatch and never refunds original or bounded reservations',async t=>{
  const f=await fixture(t);f.setTime(10000);await assert.rejects(()=>f.budget.dispatch('sdk','late'),/ai_qa_active_exception_required/);
  assert.equal((await f.budget.close()).refundMicroUsd,0);
});
test('tampering with original bytes is rejected before any append',async t=>{
  const f=await fixture(t);await writeFile(join(f.options.directory,'000000.json'),f.legacy[0]+' ');
  await assert.rejects(()=>f.budget.inspect(),/ai_qa_original_records_changed/);
});
test('the runtime uses the actual speech worker and blocks a second session POST and a third generation',async t=>{
  const f=await fixture(t);let sdkCalls=0,providerCalls=0;
  const worker={runNativeP6ProductSpeech:async({responsesCreate,ticket})=>{
    const r=await responsesCreate({logicalCallId:ticket.stage,body:{model:'gpt-5.6-terra',stream:false,store:false,max_output_tokens:64}});
    return{kind:'generatedText',text:r.output_text};}};
  const router=createBoundedAiQaRouter({manifest:f.manifest,budget:f.budget,worker,
    client:{responses:{create:async()=>({status:'completed',output_text:'Short '+(++sdkCalls),usage:{input_tokens:34,output_tokens:22}})}},
    readbackToken:'private',endpointId:'endpoint',fetchImpl:async()=>{providerCalls++;return Response.json({id:'job',status:'IN_QUEUE'});},now:()=>100});
  const args={playerId:'player',owner:'owner',readOwner:async()=> 'owner',readEnvelope:async()=>({status:{dealerId:'astrid'},request:{requestId:'g1'}})};
  const one=await (await router.fetchForOwnedRequest(args)('')).json();assert.equal(one.text,'Short 1');
  await router.providerFetch('https://api.cartesia.ai/tts/bytes',{method:'POST',body:JSON.stringify({transcript:one.text})});
  await router.providerFetch('https://api.runpod.ai/v2/endpoint/run',{method:'POST',body:JSON.stringify({input:{op:'session'}})});
  await assert.rejects(()=>router.providerFetch('https://api.runpod.ai/v2/endpoint/run',{method:'POST',body:JSON.stringify({input:{op:'session',worker_id:'new'}})}),/ai_qa_retry_or_expired/);
  args.readEnvelope=async()=>({status:{dealerId:'astrid'},request:{requestId:'g2'}});
  await router.fetchForOwnedRequest(args)('');args.readEnvelope=async()=>({status:{dealerId:'astrid'},request:{requestId:'g3'}});
  await assert.rejects(()=>router.fetchForOwnedRequest(args)(''),/ai_qa_dispatch_limit/);
  assert.equal(sdkCalls,2);assert.equal(providerCalls,2);
});
test('stale cookie ownership reaches neither SDK nor provider',async t=>{
  const f=await fixture(t);let calls=0;
  const router=createBoundedAiQaRouter({manifest:f.manifest,budget:f.budget,client:{responses:{create:()=>{calls++;}}},worker:{},now:()=>100});
  await assert.rejects(()=>router.fetchForOwnedRequest({playerId:'player',owner:'old',readOwner:async()=> 'new'})(''),/ai_qa_current_owner_required/);
  assert.equal(calls,0);assert.equal((await f.budget.inspect()).counts.generation,0);
});

test('policy installation preserves original campaign and requires existing account link and empty scoped policy',async()=>{
  const {installAiQaPolicy}=await import('../tools/activate-native-ai-qa.mjs');
  const calls=[];const counts={gpu_policy:0,file_policy:0,campaigns:0,gates:0,attempts:0,requests:0,sessions:0,gpu_reservations:0,fullfile_reservations:0,active_leases:0};
  const client={release(){},query:async(sql,values)=>{
    calls.push({sql,values});
    if(sql.includes('current_database'))return{rows:[{database:'croupier_studio_qa_abc92154cb15',role:'croupier_studio_qa_abc92154cb15'}]};
    if(sql.includes('FROM croupier_auth.users'))return{rows:[{id:7,username:'existing-qa',role:'superadmin'}]};
    if(sql.includes('FROM croupier_game.players')){
      assert.match(sql,/WHERE p\.id=\$1 AND l\.craig_user_id=\$2/);assert.deepEqual(values,['player',7]);return{rows:[{id:'player'}]};}
    if(sql.includes('AS gpu_policy'))return{rows:[counts]};
    if(sql.includes('AS now_ms'))return{rows:[{now_ms:100}]};
    return{command:sql==='COMMIT'?'COMMIT':undefined,rows:[]};
  }};
  const args={pool:{connect:async()=>client},operatorId:7,username:'existing-qa',playerId:'player',now:()=>100,
    manifest:{runId:'run',ownLinkedPlayerSha256:sha256('player'),createdAtMs:100,expiresAtMs:10000},manifestRawSha256:'3'.repeat(64)};
  const r=await installAiQaPolicy(args);assert.equal(r.originalCampaignId,AI_QA_ORIGINAL.campaignId);
  assert.equal(calls.filter(c=>c.sql.startsWith('INSERT')).length,5);
  assert.ok(calls.filter(c=>c.sql.includes('INSERT INTO croupier_studio.operator_')).every(c=>c.values[2]===AI_QA_ORIGINAL.campaignId));
  counts.sessions=1;calls.length=0;await assert.rejects(()=>installAiQaPolicy(args),/ai_qa_install_nonempty_policy_or_jobs/);
  assert.equal(calls.filter(c=>c.sql.startsWith('INSERT')).length,0);assert.ok(calls.some(c=>c.sql==='ROLLBACK'));
});

test('persistent private closure rehydrates a fresh image, preserves existing bytes, and rejects a changed source',async t=>{
  const {AI_QA_PRIVATE_NAMES,buildAiQaPrivateSnapshot,restoreAiQaPrivateSnapshot,initializeAiQaPrivateBootstrap}=await import('../web/native-ai-qa-private.mjs');
  const base=await mkdtemp(join(tmpdir(),'bounded-private-bootstrap-'));t.after(()=>rm(base,{recursive:true,force:true}));
  const original=join(base,'original'),repository=join(base,'image');const {mkdir}=await import('node:fs/promises');await mkdir(original);await mkdir(repository);
  const pins={};for(const name of AI_QA_PRIVATE_NAMES){const bytes=Buffer.from('Synthetic source '+name);pins[name]=sha256(bytes);await writeFile(join(original,name),bytes);}
  const raw=await buildAiQaPrivateSnapshot({directory:original,pins}),manifest={privateSources:pins,privateSnapshotSha256:sha256(raw)};
  const first=await restoreAiQaPrivateSnapshot({repository,manifest,raw});assert.equal(first.written,4);assert.equal(first.providerCalls,0);assert.equal(first.budgetWrites,0);
  const second=await restoreAiQaPrivateSnapshot({repository,manifest,raw});assert.equal(second.written,0);assert.equal(second.retained,4);
  const path=join(repository,'lab/data/platform-private',AI_QA_PRIVATE_NAMES[0]);await writeFile(path,'Different existing bytes');
  await assert.rejects(()=>restoreAiQaPrivateSnapshot({repository,manifest,raw}),/ai_qa_private_snapshot_target_changed/);
  assert.equal(await readFile(path,'utf8'),'Different existing bytes');assert.equal(await initializeAiQaPrivateBootstrap({CROUPIER_P6_BOUNDED_TEST:'0'}),null);
});

test('private closure snapshot rejects extra paths and tampering before creating a target',async t=>{
  const {AI_QA_PRIVATE_NAMES,decodeAiQaPrivateSnapshot,restoreAiQaPrivateSnapshot}=await import('../web/native-ai-qa-private.mjs');
  const files=Object.fromEntries(AI_QA_PRIVATE_NAMES.map(name=>{const bytes=Buffer.from('Fixture '+name);return[name,{sha256:sha256(bytes),bytesBase64:bytes.toString('base64')}];}));
  const pins=Object.fromEntries(Object.entries(files).map(([n,f])=>[n,f.sha256]));files['../credentials.json']={sha256:'0'.repeat(64),bytesBase64:'YQ=='};
  const raw=Buffer.from(JSON.stringify({purpose:'bounded-native-ai-qa-private-snapshot-v1',files}));assert.throws(()=>decodeAiQaPrivateSnapshot(raw,pins),/ai_qa_private_snapshot_paths/);
  const directory=await mkdtemp(join(tmpdir(),'bounded-private-denied-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await assert.rejects(()=>restoreAiQaPrivateSnapshot({repository:directory,manifest:{privateSources:pins,privateSnapshotSha256:'0'.repeat(64)},raw}),/ai_qa_private_snapshot_changed/);
  const {readdir}=await import('node:fs/promises');assert.deepEqual(await readdir(directory),[]);
});

test('one bounded QA boot passes fullfile policy to Web; registered transport and Neon reservation are required before SDK/provider',async t=>{
  const {randomUUID}=await import('node:crypto');const {NATIVE_P6_QA:QA,validateCloudConfig,childSpecifications}=await import('../ops/cloud/config.mjs');
  const {AI_QA_SOURCE_PATHS,boundedAiQaAllowsFullfile}=await import('../web/native-ai-qa-runtime.mjs');
  const {configureGeneratedSpeechJournal,getGeneratedSpeechService,generatedSpeechStatus}=await import('../web/generated-speech.mjs');
  const {createSpeechJournal}=await import('../web/postgres-speech-journal.mjs');const {speechMemoryPool}=await import('./fixtures/speech-memory-pool.mjs');
  const runId=randomUUID(),env={NODE_ENV:'production',PORT:'10000',CROUPIER_CLOUD_LAYOUT:'single-origin',
    CROUPIER_CLOUD_DATA_ROOT:QA.dataRoot,RENDER_SERVICE_ID:QA.serviceId,RENDER_EXTERNAL_URL:QA.origin,RENDER_GIT_COMMIT:'a'.repeat(40),
    CROUPIER_STREAM_LANE:'lissabon-stream-lane',CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_STUDIO_ENVIRONMENT_ID:QA.environmentId,CROUPIER_STUDIO_WORKSPACE_ID:QA.workspaceId,
    CROUPIER_DATABASE:'postgres',CROUPIER_GAME_DATABASE_URL:`postgresql://${QA.database}:synthetic@qa.neon.tech/${QA.database}?sslmode=require`,
    PUBLIC_URL:QA.frontendOrigin,BO_URL:QA.frontendOrigin,LAB_PUBLIC_URL:QA.frontendOrigin,CROUPIER_GAME_ORIGIN:QA.frontendOrigin,BETTALOTTO_PARTNER_BASE_URL:QA.frontendOrigin,
    OPENCLAW_PRODUCT_SPEECH_URL:QA.origin,CROUPIER_PRESENTATION_DIRECTOR_URL:QA.origin,
    CROUPIER_P6_QA_ROUTER:'1',CROUPIER_P6_QA_ROUTER_SOURCE_SHA256:'b'.repeat(64),CROUPIER_P6_SDK_RUN_ID:runId,CROUPIER_P6_SDK_DEPLOYMENT_ID:'dep-synthetic',
    OPENCLAW_PRODUCT_SPEECH_TOKEN:'speech-'.repeat(8),CROUPIER_PRESENTATION_DIRECTOR_TOKEN:'director-'.repeat(8),CROUPIER_P6_SDK_WORKER_TOKEN:'worker-'.repeat(8),
    CROUPIER_P6_SDK_READBACK_TOKEN:'readback-'.repeat(8),CROUPIER_P6_SDK_TICKET_SECRET:'tickets-'.repeat(8),CROUPIER_P6_BOUNDED_TEST:'1',CROUPIER_P6_BOUNDED_MANIFEST_SHA256:'c'.repeat(64),
    CROUPIER_P6_SDK_OPENAI_API_KEY:'synthetic',CROUPIER_GENERATED_SPEECH:'1',CROUPIER_CLOUD_GENERATED_SPEECH:'1',CROUPIER_GENERATED_SPEECH_STREAMING:'1',
    CROUPIER_SPEECH_STREAM_WORKER_SECRET:'streamworker-'.repeat(8),CROUPIER_SPEECH_STREAM_TICKET_SECRET:'streamticket-'.repeat(8),
    CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD:'1',CROUPIER_SPEECH_FULLFILE_RESERVE_USD:'1',CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:'4.748848',
    CARTESIA_API_KEY:'synthetic',RUNPOD_API_KEY:'synthetic',CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID:'fixture-endpoint'};
  const config=validateCloudConfig(env),specs=childSpecifications(config,env,{labInternalSecret:'internal-'.repeat(8)});
  assert.deepEqual(config.fullfileBudget,{reserveUsd:'1',dailyBudgetUsd:'4.748848'});assert.equal(specs.web.env.CROUPIER_SPEECH_FULLFILE_RESERVE_USD,'1');
  assert.equal(specs.web.env.CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD,'4.748848');assert.equal(specs.lab.env.CROUPIER_P6_SDK_OPENAI_API_KEY,undefined);
  assert.throws(()=>validateCloudConfig({...env,CROUPIER_SPEECH_FULLFILE_RESERVE_USD:undefined}),/FULLFILE_RESERVE/);
  const standard={...env,CROUPIER_P6_QA_ROUTER:'0',CROUPIER_P6_BOUNDED_TEST:'0'};assert.equal(validateCloudConfig(standard).fullfileBudget,null);
  const directory=await mkdtemp(join(tmpdir(),'bounded-file-chain-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const webEnv={...specs.web.env,CROUPIER_GENERATED_SPEECH_DIR:directory};const saved=Object.fromEntries(Object.keys(webEnv).map(k=>[k,process.env[k]]));Object.assign(process.env,webEnv);
  t.after(()=>{configureGeneratedSpeechJournal(null);for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  let paid=0;const manifest={purpose:'bounded-native-ai-qa-activation-v1',campaignId:AI_QA_ORIGINAL.campaignId,expectedSha:env.RENDER_GIT_COMMIT,runId,deploymentId:env.CROUPIER_P6_SDK_DEPLOYMENT_ID,
    limits:AI_QA_LIMITS,originalAnchorSha256:AI_QA_ORIGINAL.anchorSha256,actualCostUsd:null,privateSnapshotSha256:'d'.repeat(64),createdAtMs:Date.now()-1,expiresAtMs:Date.now()+60000,
    ownLinkedPlayerSha256:sha256('player'),sources:Object.fromEntries(AI_QA_SOURCE_PATHS.map(p=>[p,'e'.repeat(64)])),privateWorkerSha256:'f'.repeat(64),sdkVersion:'7.12.1',
    sdkRoot:QA.dataRoot+'/p6-sdk/cb9b6b53-e7b0-4fa9-bc53-c5152ddbb1f2/node_modules/openai'};
  const router=createBoundedAiQaRouter({manifest,budget:{},client:{},worker:{},endpointId:'fixture-endpoint',fetchImpl:()=>{paid++;throw Error('no paid fixture request');}});
  const pool=speechMemoryPool(),journal=await createSpeechJournal({pool,environmentId:QA.environmentId});const artifacts={save(){},get(){}};
  configureGeneratedSpeechJournal(journal,{artifacts,providerFetch:async()=>{paid++;}});assert.equal(getGeneratedSpeechService(),null,'an arbitrary function cannot open fullfile');
  configureGeneratedSpeechJournal(journal,{artifacts,providerFetch:router.providerFetch});assert.equal(boundedAiQaAllowsFullfile(router.providerFetch,process.env),true);
  assert.equal(generatedSpeechStatus().configured,true);const service=getGeneratedSpeechService();assert.ok(service);
  await assert.rejects(()=>service.generate({owner:'fixture-owner',requestId:'policy-absent',dealerId:'astrid',text:'Short fixture.'}),{code:'generated_speech_fullfile_budget_policy_missing'});
  assert.equal(paid,0);assert.equal(pool.state.requests.size,0);
  process.env.CROUPIER_P6_BOUNDED_TEST='0';assert.equal(getGeneratedSpeechService(),null,'ordinary managed streaming remains closed');
});

test('fresh cloud image prepares only private bootstrap parents for UID1000 before activation',async()=>{
  const docker=await readFile(new URL('../ops/cloud/Dockerfile',import.meta.url),'utf8');
  const prepare='mkdir -p /app/lab/data/platform-private',own='chown node:node /app/lab/data /app/lab/data/platform-private',mode='chmod 700 /app/lab/data /app/lab/data/platform-private';
  assert.ok(docker.indexOf('COPY . .')<docker.indexOf(prepare));
  assert.ok(docker.indexOf(prepare)<docker.indexOf(own));assert.ok(docker.indexOf(own)<docker.indexOf(mode));
  assert.ok(docker.indexOf(mode)<docker.indexOf('CMD ['));
  assert.ok(!docker.includes('chown -R node:node /app/lab/data'));
  const {AI_QA_SOURCE_PATHS}=await import('../web/native-ai-qa-runtime.mjs');assert.ok(AI_QA_SOURCE_PATHS.includes('ops/cloud/Dockerfile'));
  const bootstrap=await readFile(new URL('../web/native-ai-qa-private.mjs',import.meta.url),'utf8');assert.ok(bootstrap.includes("'ops/cloud/Dockerfile'"));
});
