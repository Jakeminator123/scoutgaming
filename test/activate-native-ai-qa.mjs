import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AI_QA_ORIGINAL,AI_QA_LIMITS,AI_QA_SIX_LIMITS,AI_QA_SIX_AUTHORIZATION,aiQaNextWindowCounts,sha256,inspectAiQaRecords,createAiQaBudget} from '../web/native-ai-qa-budget.mjs';
import {createBoundedAiQaRouter} from '../web/native-ai-qa-runtime.mjs';

const productSchema=await readFile(new URL('../ops/neon-game/product-schema.sql',import.meta.url),'utf8');
const canonicalPlayerLink=/CREATE TABLE croupier_game\.([a-z_]+) \(craig_user_id TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL REFERENCES croupier_game\.players\(id\)\)/.exec(productSchema)?.[1];
assert.ok(canonicalPlayerLink,'the product schema must declare the Craig-to-player ownership relation');
function assertPlayerLinkQuery(sql){
  const queriedTable=/\bJOIN croupier_game\.([a-z_]+)\b/.exec(sql)?.[1];
  assert.equal(queriedTable,canonicalPlayerLink,'QA ownership query must use the relation defined by the product schema');
}

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
  const manifest={campaignId:original.campaignId,runId:'11111111-1111-4111-8111-111111111111',expectedSha:'a'.repeat(40),createdAtMs:100,expiresAtMs:10000,limits:AI_QA_LIMITS,ownLinkedPlayerSha256:sha256('player'),sources:{'web/native-ai-qa-budget.mjs':authoritySourceSha256}};
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
      assertPlayerLinkQuery(sql);
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

async function continuationFixture(t,{install=true,oldTtsId='tts-old'}={}){
  const f=await fixture(t);
  for(const[resource,id]of[['sdk','director-old'],['generation','generation-old'],['sdk','speech-old'],['tts',oldTtsId],['gpu','lipsync']]){
    const key=await f.budget.dispatch(resource,id);await f.budget.outcome(key,'response-observed');
  }
  const before=await f.budget.inspect();assert.equal(before.records.length,13);
  const c={predecessorRecordCount:13,predecessorJournalSha256:before.previousSha256,previousManifestSha256:f.options.manifestRawSha256,
    previousAuthoritySourceSha256:f.options.authoritySourceSha256,previousRunId:f.manifest.runId,previousExpectedSha:f.manifest.expectedSha,
    rootReviewedIntentSha256:'3'.repeat(64),preflightSha256:'4'.repeat(64),streamRequestIdSha256:sha256('stream-one')};
  const manifest={...f.manifest,runId:'22222222-2222-4222-8222-222222222222',expectedSha:'b'.repeat(40),createdAtMs:10000,expiresAtMs:20000,continuation:c};
  f.setTime(10000);const options={...f.options,manifest,manifestRawSha256:'5'.repeat(64),authoritySourceSha256:'6'.repeat(64)};
  const budget=await createAiQaBudget(options),approve={approvedIntentSha256:c.rootReviewedIntentSha256,preflightSha256:c.preflightSha256};
  if(install)await budget.continueOnce(approve);
  return{...f,before,continuationBudget:budget,continuationManifest:manifest,continuationOptions:options,approve};
}

test('one explicit continuation keeps thirteen historical bytes and cumulative accounting through restart',async t=>{
  const f=await continuationFixture(t,{install:false});
  const bytes=await Promise.all(f.before.records.map(r=>readFile(join(f.options.directory,String(r.sequence).padStart(6,'0')+'.json'))));
  await assert.rejects(()=>f.continuationBudget.inspect(),/ai_qa_existing_run_changed/);
  assert.equal((await f.budget.inspect()).records.length,13,'construction cannot extend the timer');
  const next=await f.continuationBudget.continueOnce(f.approve);
  assert.deepEqual(next.counts,{generation:1,sdk:2,tts:1,gpu:1});assert.equal(next.exception.expiresAtMs,10000);
  assert.equal(next.activeWindow.expiresAtMs,20000);assert.equal(next.exception.authoritySourceSha256,f.options.authoritySourceSha256);
  assert.equal(next.continuation.authoritySourceSha256,f.continuationOptions.authoritySourceSha256);
  for(let i=0;i<13;i++)assert.deepEqual(await readFile(join(f.options.directory,String(i).padStart(6,'0')+'.json')),bytes[i]);
  const restarted=await createAiQaBudget(f.continuationOptions);
  await assert.rejects(()=>restarted.continueOnce(f.approve),/ai_qa_continuation_cas_changed/);
  await assert.rejects(()=>restarted.activate(),/ai_qa_manifest_expired/);
  await assert.rejects(()=>restarted.dispatch('sdk','speech-old'),/ai_qa_retry_or_expired/,'old operation dedupe survives a new manifest');
  for(const[resource,id]of[['generation','stream-one'],['sdk','stream-sdk'],['tts','stream-tts'],['gpu','session']]){
    const key=await restarted.dispatch(resource,id);await restarted.outcome(key,'response-observed');
  }
  const after=await restarted.inspect();assert.deepEqual(after.counts,{generation:2,sdk:3,tts:2,gpu:2});
  assert.equal(after.totalEncumberedMicroUsd,10000000);assert.equal(after.retainedMicroUsd,5251152);
  assert.equal(after.unencumberedMicroUsd,0);assert.equal(after.refundMicroUsd,0);assert.equal(after.actualCostUsd,null);
  await assert.rejects(()=>restarted.dispatch('generation','third'),/ai_qa_dispatch_limit/);
  f.setTime(20000);await assert.rejects(()=>restarted.dispatch('sdk','late'),/ai_qa_active_exception_required/);
});

test('manual continuation rejects an active old window, wrong review/predecessor/authority and a longer window',async t=>{
  for(const name of ['active','review','head','authority','long','expired'])await t.test(name,async t=>{
    const f=await continuationFixture(t,{install:false});
    if(name==='active')f.setTime(9999);
    if(name==='review')f.approve.approvedIntentSha256='f'.repeat(64);
    if(name==='head')f.continuationManifest.continuation.predecessorJournalSha256='f'.repeat(64);
    if(name==='authority')f.continuationManifest.continuation.previousAuthoritySourceSha256='f'.repeat(64);
    if(name==='long')f.continuationManifest.expiresAtMs=10000+AI_QA_LIMITS.lifetimeMs+1;
    if(name==='expired')f.setTime(20000);
    await assert.rejects(()=>f.continuationBudget.continueOnce(f.approve),/ai_qa_/);
    assert.equal((await f.budget.inspect()).records.length,13);
  });
});

test('closed, unresolved and uncertain original runs cannot be continued or refunded',async t=>{
  for(const reason of ['closed','pending','uncertain'])await t.test(reason,async t=>{
    const f=await continuationFixture(t,{install:false});f.setTime(9999);
    if(reason==='closed')await f.budget.close();
    else{const key=await f.budget.dispatch('sdk','unobserved');if(reason==='uncertain')await f.budget.outcome(key,'uncertain');}
    f.setTime(10000);const current=await f.budget.inspect();
    Object.assign(f.continuationManifest.continuation,{predecessorJournalSha256:current.previousSha256,predecessorRecordCount:current.records.length});
    await assert.rejects(()=>f.continuationBudget.continueOnce(f.approve),/ai_qa_continuation_not_drained/);
    assert.equal((await f.budget.inspect()).refundMicroUsd,0);
  });
});

test('a lost append acknowledgement retains its lock and fences restart without replaying or removing history',async t=>{
  const f=await continuationFixture(t,{install:false}),{open,lstat}=await import('node:fs/promises');
  const budget=await createAiQaBudget({...f.continuationOptions,appendOpen:async(...args)=>{
    const file=await open(...args);return{writeFile:bytes=>file.writeFile(bytes),close:()=>file.close(),sync:async()=>{throw Error('synthetic lost fsync acknowledgement');}};
  }});
  await assert.rejects(()=>budget.continueOnce(f.approve),/synthetic lost fsync/);
  assert.equal((await lstat(join(f.options.directory,'write.lock'))).isDirectory(),true);
  const restarted=await createAiQaBudget(f.continuationOptions);
  await assert.rejects(()=>restarted.inspect(),/ai_qa_budget_locked/);
  for(const record of f.before.records)assert.equal(sha256(await readFile(join(f.options.directory,String(record.sequence).padStart(6,'0')+'.json'))),record.rawSha256);
});

test('continuation rejects Director, default/false stream and wrong request before any append or paid call',async t=>{
  const f=await continuationFixture(t);let paid=0;
  const router=createBoundedAiQaRouter({manifest:f.continuationManifest,budget:f.continuationBudget,worker:{},client:{},endpointId:'endpoint',now:()=>10000,fetchImpl:()=>{paid++;}});
  const args={playerId:'player',owner:'owner',readOwner:async()=> 'owner',readEnvelope:async()=>({status:{dealerId:'astrid'},request:{requestId:'stream-one'}})};
  const before=await f.continuationBudget.inspect();
  for(const flag of [undefined,false,'true'])await assert.rejects(()=>router.fetchForOwnedRequest({...args,streamRequested:flag})(''),/ai_qa_continuation_stream_required/);
  await assert.rejects(()=>router.fetchForOwnedRequest({...args,streamRequested:true,readEnvelope:async()=>({request:{requestId:'wrong'}})})(''),/ai_qa_continuation_request_required/);
  await assert.rejects(()=>router.fetchForOwnedDirectorRequest({})(''),/ai_qa_continuation_director_denied/);
  await assert.rejects(()=>router.providerFetch('https://api.runpod.ai/v2/endpoint/run',{method:'POST',body:JSON.stringify({input:{op:'lipsync'}})}),/ai_qa_gpu_op_denied/);
  assert.equal(paid,0);assert.equal((await f.continuationBudget.inspect()).previousSha256,before.previousSha256);
  const {nativeP6OwnedSpeechFetch}=await import('../web/native-p6-qa-hook.mjs');let captured;
  const capture={fetchForOwnedRequest:args=>{captured=args;return 'trusted-transport';}};
  const hookArgs={readStatus:()=>{},readOwner:()=>{}};
  nativeP6OwnedSpeechFetch(capture,hookArgs);assert.equal(captured.streamRequested,false);
  nativeP6OwnedSpeechFetch(capture,{...hookArgs,streamRequested:true});assert.equal(captured.streamRequested,true);
  nativeP6OwnedSpeechFetch(capture,{...hookArgs,streamRequested:'true'});assert.equal(captured.streamRequested,false);
});

test('continuation admits precisely one normal stream SDK/TTS/session sequence and permits known cancel reads after expiry',async t=>{
  const f=await continuationFixture(t);let sdk=0,tts=0,gpu=0,cancel=0,clock=10000;
  const worker={runNativeP6ProductSpeech:async({responsesCreate,ticket})=>{
    assert.equal(ticket.stage,'stream-1');const r=await responsesCreate({logicalCallId:'stream-sdk',body:{model:'gpt-5.6-terra',stream:false,store:false,max_output_tokens:64}});
    return{kind:'generatedText',text:r.output_text};}};
  const router=createBoundedAiQaRouter({manifest:f.continuationManifest,budget:f.continuationBudget,worker,now:()=>clock,endpointId:'endpoint',
    client:{responses:{create:async()=>{sdk++;return{status:'completed',output_text:'Remaining stream.',usage:{input_tokens:9,output_tokens:3}};}}},
    fetchImpl:async(url)=>{if(url.includes('cartesia'))tts++;else if(url.includes('/cancel/'))cancel++;else gpu++;return Response.json({id:'known-job',status:'IN_QUEUE'});}});
  const args={streamRequested:true,playerId:'player',owner:'owner',readOwner:async()=> 'owner',readEnvelope:async()=>({status:{dealerId:'astrid'},request:{requestId:'stream-one'}})};
  const choice=await(await router.fetchForOwnedRequest(args)('')).json();
  await router.providerFetch('https://api.cartesia.ai/tts/bytes',{method:'POST',body:JSON.stringify({transcript:choice.text})});
  await router.providerFetch('https://api.runpod.ai/v2/endpoint/run',{method:'POST',body:JSON.stringify({input:{op:'session'}})});
  await assert.rejects(()=>router.fetchForOwnedRequest(args)(''),/ai_qa_retry_or_expired/);
  clock=20000;f.setTime(20000);await router.providerFetch('https://api.runpod.ai/v2/endpoint/cancel/known-job',{method:'POST'});
  assert.deepEqual({sdk,tts,gpu,cancel},{sdk:1,tts:1,gpu:1,cancel:1});
  assert.deepEqual((await f.continuationBudget.inspect()).counts,{generation:2,sdk:3,tts:2,gpu:2});
});

function continuationPolicyFixture(){
  const calls=[],metadata={kind:'synthetic-package'},previousManifest={campaignId:AI_QA_ORIGINAL.campaignId,createdAtMs:100,expiresAtMs:10000,ownLinkedPlayerSha256:sha256('player')},pin='7'.repeat(64);
  const fullfile={requestKey:'8'.repeat(64),packageId:'generated-'+'9'.repeat(32),packageMetadataSha256:sha256(JSON.stringify(metadata))};
  const campaign={campaign_id:AI_QA_ORIGINAL.campaignId,workspace_id:'croupier',created_at_ms:'100',expires_at_ms:'10000',source_sha256:pin};
  const tables={gpu_budget_policies:[{version:1,daily_budget_micro_usd:'4748848'}],fullfile_budget_policies:[{version:1,reserve_micro_usd:'1000000',reservation_window_ms:'720000'}],
    operator_qa_campaigns:[campaign],operator_qa_gate:[structuredClone(campaign)],operator_qa_attempts:[],
    speech_requests:[{request_key:fullfile.requestKey,capability:'fullfile',state:'completed',package_id:fullfile.packageId,package_metadata:metadata}],
    gpu_sessions:[],gpu_reservations:[],fullfile_reservations:[{request_key:fullfile.requestKey,reserved_micro_usd:'1000000'}],
    speech_execution_leases:[{resource:'operator-qa',expires_at_ms:'0',recovery_only:false}]};
  const client={release(){},query:async(sql,values)=>{calls.push({sql,values});
    if(sql.includes('current_database'))return{rows:[{database:'croupier_studio_qa_abc92154cb15',role:'croupier_studio_qa_abc92154cb15'}]};
    if(sql.includes('FROM croupier_auth.users'))return{rows:[{id:'7',username:'existing-qa',role:'admin'}]};
    if(sql.includes('FROM croupier_game.players')){
      assertPlayerLinkQuery(sql);
      assert.doesNotMatch(sql,/\bplayer_account_links\b/,'the unavailable player-account table must never be queried');
      assert.deepEqual(values,['player','7']);return{rows:[{id:'player'}]};
    }
    if(sql.includes('AS now_ms'))return{rows:[{now_ms:'20000'}]};
    const table=/SELECT \* FROM croupier_studio\.([a-z_]+)/.exec(sql)?.[1];if(table)return{rows:structuredClone(tables[table])};
    return{command:sql==='COMMIT'?'COMMIT':undefined,rows:[]};}};
  return{calls,tables,args:{pool:{connect:async()=>client},previousManifest,previousManifestRawSha256:pin,fullfile,operatorId:'7',username:'existing-qa',playerId:'player',now:()=>20000}};
}

test('ownership relation fixture rejects the unavailable table and detects divergence from the actual product schema',()=>{
  assert.throws(()=>assertPlayerLinkQuery('SELECT p.id FROM croupier_game.players p JOIN croupier_game.player_account_links l ON l.player_id=p.id'),/QA ownership query must use/);
  assert.doesNotThrow(()=>assertPlayerLinkQuery(`SELECT p.id FROM croupier_game.players p JOIN croupier_game.${canonicalPlayerLink} l ON l.player_id=p.id`));
});

test('continuation reads the expired original operator gate and retained policies without updating campaign or reservations',async()=>{
  const {readAiQaContinuationPolicy}=await import('../tools/activate-native-ai-qa.mjs'),f=continuationPolicyFixture(),before=JSON.stringify(f.tables);
  const result=await readAiQaContinuationPolicy(f.args);assert.equal(result.expiredOperatorGateRetained,true);assert.equal(result.sqlMutations,0);
  assert.equal(JSON.stringify(f.tables),before);assert.ok(f.calls[0].sql.endsWith('READ ONLY'));
  assert.equal(f.calls.some(c=>/^(INSERT|UPDATE|DELETE|ALTER|CREATE)|FOR UPDATE|pg_advisory/.test(c.sql)),false);
  assert.ok(f.calls.filter(c=>c.sql.includes('FROM croupier_studio.')).every(c=>c.values[0]==='qa_native_abc92154cb15'));
  f.tables.operator_qa_gate[0].expires_at_ms='30000';await assert.rejects(()=>readAiQaContinuationPolicy(f.args),/ai_qa_continuation_original_campaign_changed/);
});

test('continuation refuses modified fullfile/policy/lease/session state without a data mutation',async t=>{
  const {readAiQaContinuationPolicy}=await import('../tools/activate-native-ai-qa.mjs');
  for(const change of ['file','budget','reservation','lease','session'])await t.test(change,async()=>{
    const f=continuationPolicyFixture();
    if(change==='file')f.tables.speech_requests[0].state='submission_uncertain';
    if(change==='budget')f.tables.gpu_budget_policies[0].daily_budget_micro_usd='5000000';
    if(change==='reservation')f.tables.fullfile_reservations[0].reserved_micro_usd='0';
    if(change==='lease')f.tables.speech_execution_leases[0].recovery_only=true;
    if(change==='session')f.tables.gpu_sessions.push({state:'active'});
    const before=JSON.stringify(f.tables);await assert.rejects(()=>readAiQaContinuationPolicy(f.args),/ai_qa_continuation_/);
    assert.equal(JSON.stringify(f.tables),before);assert.equal(f.calls.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)),false);
  });
});

test('reviewed continuation intent binds exact predecessor, current release, one stream request and unchanged cap',async t=>{
  const f=await continuationFixture(t,{install:false}),{validateAiQaContinuationIntent}=await import('../tools/activate-native-ai-qa.mjs');
  const c=f.continuationManifest.continuation,base={purpose:'bounded-native-ai-qa-continuation-intent-v1',campaignId:AI_QA_ORIGINAL.campaignId,
    expectedSha:f.continuationManifest.expectedSha,deploymentId:'dep-current',runId:f.continuationManifest.runId,
    ...c,streamRequestId:'stream-one',limits:AI_QA_LIMITS,actualCostUsd:null,extraReserveMicroUsd:0,refundMicroUsd:0,
    fullfile:{requestKey:'8'.repeat(64),packageId:'generated-'+'9'.repeat(32),packageMetadataSha256:'a'.repeat(64)}};
  const args={previousManifest:f.manifest,previousManifestRawSha256:f.options.manifestRawSha256,state:f.before,
    expectedSha:base.expectedSha,deploymentId:base.deploymentId,runId:base.runId};
  const raw=JSON.stringify(base);assert.equal(validateAiQaContinuationIntent({...args,raw,approvedIntentSha256:sha256(raw)}).streamRequestId,'stream-one');
  await assert.rejects(async()=>validateAiQaContinuationIntent({...args,raw:raw+' ',approvedIntentSha256:sha256(raw)}),/ai_qa_continuation_reviewed_intent_changed/);
  for(const patch of [{expectedSha:'c'.repeat(40)},{previousAuthoritySourceSha256:'c'.repeat(64)},{extraReserveMicroUsd:1},{actualCostUsd:0},{limits:{...AI_QA_LIMITS,generations:3}}]){
    const changed=JSON.stringify({...base,...patch});assert.throws(()=>validateAiQaContinuationIntent({...args,raw:changed,approvedIntentSha256:sha256(changed)}),/ai_qa_continuation_/);
  }
});

test('normal stream factory reserves one Neon session with continuation transport and no operator-gate extension or fullfile job',async t=>{
  const f=await continuationFixture(t),{createSpeechJournal}=await import('../web/postgres-speech-journal.mjs'),{speechMemoryPool}=await import('./fixtures/speech-memory-pool.mjs'),
    {createGeneratedSpeechStreamService}=await import('../web/generated-speech-stream.mjs');
  const directory=await mkdtemp(join(tmpdir(),'continuation-stream-factory-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const pool=speechMemoryPool(),journal=await createSpeechJournal({pool,environmentId:'qa_native_abc92154cb15'});
  await journal.initializeBudgetPolicy({dailyBudgetMicroUsd:4748848,confirmation:'verified-new-empty-cost-journal'});
  let available=0,jobPosts=0,cancels=0;const ops=[];
  const relay={status:()=>({workers:available,busy:0,available}),workerStatus:id=>({workerId:id,workers:available,busy:0,available}),stopWorker(){available=0;},close(){available=0;}};
  const worker={runNativeP6ProductSpeech:async({responsesCreate})=>{await responsesCreate({logicalCallId:'stream-sdk',body:{model:'gpt-5.6-terra',stream:false,store:false,max_output_tokens:32}});return{kind:'generatedText',text:'One normal stream.'};}};
  const router=createBoundedAiQaRouter({manifest:f.continuationManifest,budget:f.continuationBudget,worker,now:()=>10000,endpointId:'endpoint',
    client:{responses:{create:async()=>({status:'completed',usage:{input_tokens:9,output_tokens:3}})}},fetchImpl:async(url,options)=>{
      if(url.endsWith('/run')){jobPosts++;ops.push(JSON.parse(options.body).input.op);available=1;return Response.json({id:'factory-job',status:'IN_PROGRESS'});}
      if(url.includes('/cancel/')){cancels++;return Response.json({id:'factory-job',status:'CANCELLED'});}
      return Response.json({id:'factory-job',status:'IN_PROGRESS'});
    }});
  const choice=await(await router.fetchForOwnedRequest({streamRequested:true,playerId:'player',owner:'owner',readOwner:async()=> 'owner',
    readEnvelope:async()=>({status:{dealerId:'astrid'},request:{requestId:'stream-one'}})})('')).json();
  const service=await createGeneratedSpeechStreamService({}, {directory,origin:'https://qa.example.test',workerSecret:'worker'.repeat(8),ticketSecret:'ticket'.repeat(8),apiKey:'synthetic',voiceId:'voice',modelId:'model',
    session:{apiKey:'synthetic',endpointId:'endpoint',reserveUsd:'1',dailyBudgetUsd:'4.748848'}},
    {resolveOwner:()=> 'owner',attachRelay:()=>relay,fetchImpl:router.providerFetch,journal,journalRequired:true});
  t.after(()=>service.close());
  const descriptor=await service.prepare({requestId:'stream-one',text:choice.text,dealerId:'astrid',owner:'owner',playerId:'player',beforeCostly:async()=>{}});
  assert.equal(descriptor.kind,'generated-speech-stream');assert.deepEqual(ops,['session']);assert.equal(jobPosts,1);
  assert.equal(pool.state.sessions.size,1);assert.equal([...pool.state.reservations.values()][0].reserved_micro_usd,'1000000');
  assert.equal(pool.state.fileReservations.size,0);assert.equal((await f.continuationBudget.inspect()).counts.tts,1,'prepare does not start the second TTS before attachment');
  await service.close();assert.equal(cancels,1);assert.equal([...pool.state.sessions.values()][0].state,'terminal');
});

async function closedSuccessorFixture(t){
  const f=await continuationFixture(t,{oldTtsId:sha256('Fresh stream.')});
  for(const [resource,id]of[['generation','stream-one'],['sdk','stream-sdk'],['gpu','session']]){const k=await f.continuationBudget.dispatch(resource,id);await f.continuationBudget.outcome(k,'response-observed');}
  const before=await f.continuationBudget.close();assert.equal(before.records.length,21);f.setTime(20000);
  return{...f,before,original:{...f.options.original,closedJournalSha256:before.previousSha256}};
}
async function successorBudget(f,before,ordinal=3){
  const runId=String(ordinal).repeat(8)+'-'+String(ordinal).repeat(4)+'-4'+String(ordinal).repeat(3)+'-8'+String(ordinal).repeat(3)+'-'+String(ordinal).repeat(12);
  const c={predecessorRecordCount:before.records.length,predecessorJournalSha256:before.previousSha256,
    previousManifestSha256:before.activeWindow.manifestSha256,previousAuthoritySourceSha256:before.activeWindow.authoritySourceSha256,
    previousRunId:before.activeWindow.runId,previousExpectedSha:before.activeWindow.expectedSha,
    rootReviewedIntentSha256:'a'.repeat(64),preflightSha256:'b'.repeat(64),streamRequestIdSha256:sha256('stream-'+ordinal),humanAuthorization:AI_QA_SIX_AUTHORIZATION,
    previousCounts:before.counts,limitCounts:aiQaNextWindowCounts(before),globalRemainingGenerations:6-before.counts.generation,windowGenerations:1,streamOnly:true};
  const manifest={...f.manifest,runId,expectedSha:'c'.repeat(40),createdAtMs:ordinal*10000,expiresAtMs:(ordinal+1)*10000,limits:AI_QA_SIX_LIMITS,additionalWindow:c};
  f.setTime(ordinal*10000);const options={...f.options,original:f.original,manifest,manifestRawSha256:sha256(runId),authoritySourceSha256:'d'.repeat(64)};
  const budget=await createAiQaBudget(options);return{budget,manifest,options,approve:{approvedIntentSha256:c.rootReviewedIntentSha256,preflightSha256:c.preflightSha256}};
}
test('additional window retains original closed21 bytes and charges one fresh stream without reopening old authority',async t=>{
  const f=await closedSuccessorFixture(t),next=await successorBudget(f,f.before),oldBytes=await Promise.all(f.before.records.map(r=>readFile(join(f.options.directory,String(r.sequence).padStart(6,'0')+'.json'))));
  await assert.rejects(()=>next.budget.inspect(),/ai_qa_existing_run_changed/);let state=await next.budget.openAdditionalWindow(next.approve);
  assert.equal(state.closed,true);assert.equal(state.windowClosed,false);assert.equal(state.closedWindows[0].runId,f.continuationManifest.runId);assert.deepEqual(state.counts,{generation:2,sdk:3,tts:1,gpu:2});
  await assert.rejects(()=>next.budget.openAdditionalWindow(next.approve),/ai_qa_additional_cas_changed/);
  await assert.rejects(()=>f.continuationBudget.dispatch('sdk','old-reopened'),/ai_qa_/);
  let sdk=0,provider=0;const router=createBoundedAiQaRouter({manifest:next.manifest,budget:next.budget,now:()=>30000,endpointId:'endpoint',worker:{runNativeP6ProductSpeech:async({responsesCreate})=>{await responsesCreate({logicalCallId:'sdk-new',body:{model:'gpt-5.6-terra',stream:false,store:false,max_output_tokens:32}});return{kind:'generatedText',text:'Fresh stream.'};}},client:{responses:{create:async()=>{sdk++;return{status:'completed',usage:{total_tokens:7}};}}},fetchImpl:async()=>{provider++;return Response.json({id:'one'});}});
  const args={playerId:'player',owner:'owner',readOwner:async()=> 'owner',readEnvelope:async()=>({status:{dealerId:'astrid'},request:{requestId:'stream-3'}})};
  await assert.rejects(()=>router.fetchForOwnedRequest(args)(''),/ai_qa_continuation_stream_required/);await assert.rejects(()=>router.fetchForOwnedDirectorRequest({})(''),/ai_qa_continuation_director_denied/);
  await router.fetchForOwnedRequest({...args,streamRequested:true})('');await router.providerFetch('https://api.cartesia.ai/tts/bytes',{method:'POST',body:JSON.stringify({transcript:'Fresh stream.'})});
  await assert.rejects(()=>router.providerFetch('https://api.cartesia.ai/tts/bytes',{method:'POST',body:JSON.stringify({transcript:'Fresh stream.'})}),/ai_qa_retry_or_expired/);
  await router.providerFetch('https://api.runpod.ai/v2/endpoint/run',{method:'POST',body:JSON.stringify({input:{op:'session'}})});
  await assert.rejects(()=>router.providerFetch('https://api.runpod.ai/v2/endpoint/run',{method:'POST',body:JSON.stringify({input:{op:'session'}})}),/ai_qa_retry_or_expired/);
  await assert.rejects(()=>next.budget.dispatch('sdk','more-sdk'),/ai_qa_dispatch_limit/);assert.deepEqual({sdk,provider},{sdk:1,provider:2});
  const restarted=await createAiQaBudget(next.options);state=await restarted.close();assert.deepEqual(state.counts,{generation:3,sdk:4,tts:2,gpu:3});assert.equal(state.records.length,31);assert.equal(state.windowClosed,true);
  assert.equal(state.refundMicroUsd,0);assert.equal(state.totalEncumberedMicroUsd,10000000);assert.equal(state.actualCostUsd,null);
  for(let i=0;i<21;i++)assert.deepEqual(await readFile(join(f.options.directory,String(i).padStart(6,'0')+'.json')),oldBytes[i]);
});
test('each later window requires new explicit CAS and global six cannot be extended; uncertain work stays closed',async t=>{
  const f=await closedSuccessorFixture(t);let state=f.before;
  for(let n=3;n<=6;n++){const next=await successorBudget(f,state,n);state=await next.budget.openAdditionalWindow(next.approve);
    for(const resource of ['generation','sdk','tts','gpu']){const k=await next.budget.dispatch(resource,resource+'-'+n);await next.budget.outcome(k,'response-observed');}state=await next.budget.close();}
  assert.deepEqual(state.counts,{generation:6,sdk:7,tts:5,gpu:6});const seventh=await successorBudget(f,state,7);await assert.rejects(()=>seventh.budget.openAdditionalWindow(seventh.approve),/ai_qa_additional_predecessor_not_closed/);
});
test('additional reservation read preserves history and refuses an unfunded reservation or nonterminal/active owner',async t=>{
  const {readAiQaAdditionalPolicy}=await import('../tools/activate-native-ai-qa.mjs');
  for(const change of ['none','funds','lease','job','file'])await t.test(change,async()=>{const f=continuationPolicyFixture();
    f.tables.fullfile_budget_policies[0].daily_budget_micro_usd='4748848';for(const n of ['operator_qa_campaigns','operator_qa_gate'])f.tables[n][0].source_sha256='f5687e76c2611fb664937ff1b7076e0aef368d488be163294eb43cd3c7912c1e';
    f.tables.gpu_sessions=[{session_id:'session',job_id:'known',state:'terminal',released_at_ms:'100',terminal_status:'CANCELLED',terminal_reason:'provider'}];f.tables.gpu_reservations=[{session_id:'session',reserved_micro_usd:'1000000'}];
    if(change==='funds')for(const id of ['session2','session3']){f.tables.gpu_sessions.push({...f.tables.gpu_sessions[0],session_id:id});f.tables.gpu_reservations.push({session_id:id,reserved_micro_usd:'1000000'});}if(change==='lease')f.tables.speech_execution_leases[0].expires_at_ms='20001';if(change==='job')f.tables.gpu_sessions[0].released_at_ms=null;if(change==='file')f.tables.speech_requests[0].state='failed';
    const before=JSON.stringify(f.tables);if(change==='none'){const r=await readAiQaAdditionalPolicy(f.args);assert.equal(r.reservedSqlMicroUsd,2000000);assert.equal(r.nextWindowGpuReserveMicroUsd,1000000);assert.equal(JSON.stringify(r).includes('known'),false);}
    else await assert.rejects(()=>readAiQaAdditionalPolicy(f.args),/ai_qa_additional_/);assert.equal(JSON.stringify(f.tables),before);assert.equal(f.calls.some(c=>/^(INSERT|UPDATE|DELETE)/.test(c.sql)),false);
  });
});
