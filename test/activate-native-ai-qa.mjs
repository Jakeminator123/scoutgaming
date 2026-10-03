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
