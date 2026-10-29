import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPglitePool} from '../../../test/fixtures/pglite-pool.mjs';
import {planStudioMigrations,applyStudioMigrations} from '../../../ops/neon-studio/migrations.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {addDealer,createSeedProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {createStudioDealerApi} from '../lib/studio-dealer-api.mjs';
import {dealerVoiceFromRequest,dealerVoiceProfileView} from '../../../packages/presentation/contracts/dealer-voice-profile.mjs';
import {createDealerSpeechRuntime} from '../../../services/game/dealer-speech-runtime.mjs';

// Röstprofil per dealer on real PostgreSQL SQL (PGlite with the Studio
// migrations): read/write, Admin-only, journalled, and the speech chain reads
// the saved voice. Synthetic data; no Neon, no ElevenLabs.
const scope={environment:'voice-test',workspaceId:'isolated'},origin='https://studio.example.invalid';
const config={scope,apiBase:'/api/admin',allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid',new URL(origin).host]};
const PAOW='WZVEBKUreb9jAKojf0QF',DRAGGE='7f95xPL4S3ySZ4OS1pw8',OTHER='AbCdEfGhIjKlMnOpQrSt';
const reference={kind:'video-frame',videoId:'paow-reference',sha256:'1'.repeat(64),offsetMs:0};
const req=(body,headers={})=>new Request(origin+'/api/dealers/voice',{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:JSON.stringify(body)});

async function fixture(t,{role='admin',users=['Admin']}={}){
  const pool=await createPglitePool();t.after(()=>pool.end());
  const plan=await planStudioMigrations({pool});await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  const repository=createStudioRepository({pool,scope});
  const project=addDealer(addDealer(createSeedProject(),'paow','Paow'),'dragan','Dragan');
  project.dealers.find(row=>row.id==='paow').speechProfile={schemaVersion:2,state:'enabled',reference,
    voice:{provider:'elevenlabs',voiceId:PAOW,modelId:'eleven_v3',language:'sv',settings:{stability:0.5,similarity_boost:0.85}}};
  const saved=await repository.initializeDocument('project',{value:project,actor:'fixture'});
  let calls=0;
  const api=createStudioDealerApi({repository,config,mutationTransaction:async work=>work(),videoRegistry:async()=>({videos:[]}),
    authorize:async()=>({user:users[Math.min(calls++,users.length-1)],role,scope})});
  const journal=async()=>({
    revision:(await pool.query('SELECT revision FROM croupier_studio.documents WHERE environment_id=$1 AND kind=$2',[scope.environment,'project'])).rows[0].revision,
    history:(await pool.query('SELECT revision,replaced_by,actor FROM croupier_studio.document_history WHERE environment_id=$1 ORDER BY revision',[scope.environment])).rows,
    audit:(await pool.query("SELECT action,subject,revision,actor FROM croupier_studio.audit_events WHERE environment_id=$1 AND action<>'initialize_document' ORDER BY at",[scope.environment])).rows});
  return {pool,repository,api,revision:saved.revision,journal};
}

test('Admin writes only the dealer voice; state, reference and other dealers stay, and the save is journalled',async t=>{
  const f=await fixture(t);
  const response=await f.api.handle(req({dealerId:'paow',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:OTHER,modelId:'eleven_v3'}}));
  assert.equal(response.status,200);
  const {project}=await response.json(),stored=(await f.repository.readDocument('project')).value;
  assert.deepEqual(project,stored);
  const paow=stored.dealers.find(row=>row.id==='paow');
  assert.deepEqual(paow.speechProfile,{schemaVersion:2,state:'enabled',reference,voice:{provider:'elevenlabs',voiceId:OTHER,modelId:'eleven_v3'}},'new voice drops the old voice tuning');
  assert.equal(stored.dealers.find(row=>row.id==='dragan').speechProfile,undefined);
  const journal=await f.journal();
  assert.notEqual(journal.revision,f.revision);
  assert.deepEqual(journal.history,[{revision:f.revision,replaced_by:journal.revision,actor:'Admin'}]);
  assert.deepEqual(journal.audit,[{action:'save_document',subject:'project',revision:journal.revision,actor:'Admin'}]);
  assert.deepEqual(dealerVoiceProfileView(paow),{source:'saved',name:null,provider:'elevenlabs',voiceId:OTHER,modelId:'eleven_v3'});
});

test('a catalog voice without model gets its confirmed model and tuning; same voice and model keep saved tuning',async t=>{
  const f=await fixture(t);
  let response=await f.api.handle(req({dealerId:'dragan',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:DRAGGE}}));
  assert.equal(response.status,200);
  let {project}=await response.json();
  assert.deepEqual(project.dealers.find(row=>row.id==='dragan').speechProfile,{schemaVersion:2,state:'preparation',reference:null,
    voice:{provider:'elevenlabs',voiceId:DRAGGE,modelId:'eleven_multilingual_v2',settings:{stability:0.5,similarity_boost:0.85,style:0.15,use_speaker_boost:true}}});
  response=await f.api.handle(req({dealerId:'paow',expectedRevision:project.revision,voice:{provider:'elevenlabs',voiceId:PAOW}}));
  ({project}=await response.json());
  assert.deepEqual(project.dealers.find(row=>row.id==='paow').speechProfile.voice,{provider:'elevenlabs',voiceId:PAOW,modelId:'eleven_v3',language:'sv',settings:{stability:0.5,similarity_boost:0.85}});
  assert.equal((await f.journal()).audit.length,2);
});

test('reader, cross-site and a changed actor are refused before any write',async t=>{
  for(const [options,headers] of [[{role:'reader'},{}],[{},{origin:'https://evil.invalid'}],[{users:['Admin','Other']},{}]]){
    const f=await fixture(t,options),before=await f.journal();
    const response=await f.api.handle(req({dealerId:'paow',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:OTHER}},headers));
    assert.equal(response.status,403);assert.deepEqual(await f.journal(),before);
  }
});

test('invalid voice, unknown dealer and stale revision change nothing',async t=>{
  const f=await fixture(t),before=await f.journal();
  for(const [body,status,code] of [
    [{dealerId:'paow',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:'short'}},422,'studio_dealer_voice_invalid'],
    [{dealerId:'paow',expectedRevision:f.revision,voice:{provider:'cartesia',voiceId:OTHER}},422,'studio_dealer_voice_invalid'],
    [{dealerId:'paow',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:OTHER,modelId:'sonic-3'}},422,'studio_dealer_voice_invalid'],
    [{dealerId:'paow',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:OTHER,apiKey:'secret'}},422,'studio_dealer_voice_invalid'],
    [{dealerId:'ghost',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:OTHER}},409,'studio_dealer_missing'],
    [{dealerId:'paow',expectedRevision:'studio.project.stale',voice:{provider:'elevenlabs',voiceId:OTHER}},409,'studio_conflict'],
    [{dealerId:'paow',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:OTHER},extra:true},400,null],
  ]){
    const response=await f.api.handle(req(body));assert.equal(response.status,status,JSON.stringify(body));
    if(code)assert.equal((await response.json()).code,code);
  }
  assert.deepEqual(await f.journal(),before);
});

test('the speech chain speaks with the dealer voice saved in the database, not a constant',async t=>{
  const f=await fixture(t);
  await f.api.handle(req({dealerId:'paow',expectedRevision:f.revision,voice:{provider:'elevenlabs',voiceId:OTHER,modelId:'eleven_v3'}}));
  const bytes=Buffer.from('reference'),calls=[];
  const runtime=createDealerSpeechRuntime({readProject:async()=>(await f.repository.readDocument('project')).value,
    env:{CROUPIER_DEALER_SPEECH_PROFILES:'1',ELEVENLABS_API_KEY:'isolated-key'},
    referenceService:{async prepare(input){await input.beforeCostlyStep();return {dealerId:input.dealerId,profileRevision:input.profileRevision,image:{sha256:createHash('sha256').update(bytes).digest('hex'),bytes},compositing:null};}},
    fetchImpl:async(url,options)=>{calls.push({url,method:options.method,body:options.body});return options.method==='GET'?Response.json({voice_id:url.split('/').at(-1)}):new Response(new Uint8Array(48));}});
  const prepared=await runtime.prepare({dealerId:'paow',beforeCostly:async()=>{}});
  for await (const chunk of prepared.source({text:'Hej.',beforeCostly:prepared.assertFresh}))void chunk;
  assert.equal(calls[0].url,'https://api.elevenlabs.io/v1/voices/'+OTHER);
  assert.match(calls.at(-1).url,new RegExp(OTHER+'/stream'));assert.equal(JSON.parse(calls.at(-1).body).model_id,'eleven_v3');
  assert.equal(calls.some(call=>call.url.includes(PAOW)),false);
});

test('request normalizer refuses unknown fields and keeps tuning only for the same voice and model',()=>{
  const current={provider:'elevenlabs',voiceId:PAOW,modelId:'eleven_v3',settings:{stability:0.5}};
  assert.deepEqual(dealerVoiceFromRequest({provider:'elevenlabs',voiceId:PAOW},current),current);
  assert.deepEqual(dealerVoiceFromRequest({provider:'elevenlabs',voiceId:PAOW,modelId:'eleven_multilingual_v2'},current),
    {provider:'elevenlabs',voiceId:PAOW,modelId:'eleven_multilingual_v2',settings:{stability:0.38,similarity_boost:0.8,style:0.3,use_speaker_boost:true}});
  assert.deepEqual(dealerVoiceFromRequest({provider:'elevenlabs',voiceId:OTHER}),{provider:'elevenlabs',voiceId:OTHER,modelId:'eleven_multilingual_v2'});
  for(const input of [null,{provider:'elevenlabs',voiceId:OTHER,settings:{stability:2}},{provider:'elevenlabs',voiceId:OTHER+'x'},{provider:'elevenlabs',voiceId:'../'+OTHER.slice(3)}])
    assert.throws(()=>dealerVoiceFromRequest(input),{code:'studio_dealer_voice_invalid'});
});
