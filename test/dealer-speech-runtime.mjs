import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createDealerSpeechRuntime } from '../services/game/dealer-speech-runtime.mjs';
import { avatarBinding, acceptsWorkerBinding } from '../services/astrid-gpu-worker/gateway/worker-binding.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const profile = () => ({schemaVersion:2,state:'enabled',voice:{provider:'elevenlabs',voiceId:'own-paow-voice',modelId:'eleven_multilingual_v2'},
  reference:{kind:'video-frame',videoId:'own-paow-video',sha256:'1'.repeat(64),offsetMs:0}});
function fixture(patch = {}) {
  let current = profile(), references = 0;
  const calls = [], bytes = Buffer.from('isolated reference bytes');
  const probes=[];let voiceResponse=async url=>Response.json({voice_id:url.split('/').at(-1)});
  let at=0;
  const runtime = createDealerSpeechRuntime({clock:()=>at,
    readProject:async()=>({dealers:[{id:'paow',speechProfile:current}]}),
    env:{CROUPIER_DEALER_SPEECH_PROFILES:'1',ELEVENLABS_API_KEY:'isolated-key',...patch},
    referenceService:{async prepare(input) {references++;await input.beforeCostlyStep();return {dealerId:input.dealerId,profileRevision:input.profileRevision,image:{sha256:hash(bytes),bytes},compositing:null};}},
    fetchImpl:async(url,options)=>{if(options.method==='GET'){probes.push({url,options});return voiceResponse(url);}calls.push({url,options});return new Response(new Uint8Array(48));},
  });
  return {runtime,calls,probes,advance:ms=>{at+=ms;},references:()=>references,setVoiceResponse:fn=>{voiceResponse=fn;},setProfile:value=>{current=value;},input:()=>({dealerId:'paow',beforeCostly:async()=>{}})};
}
test('registered voice is immutable per prepared request; provider is invoked only with owned text and fresh profile', async()=>{
  const f=fixture(), result=await f.runtime.prepare(f.input());
  assert.equal(f.calls.length,0);assert.equal(result.avatar.dealerId,'paow');assert.equal(result.compositing,null);
  const binding=avatarBinding(result.avatar);
  assert.equal(binding.imageSha256,result.imageSha256);assert.equal(binding.protocolVersion,3);
  let count=0;
  for await (const chunk of result.source({text:'Hej Jakob.',beforeCostly:result.assertFresh})) count+=chunk.length;
  assert.equal(count,48);assert.equal(f.calls.length,1);
  assert.match(f.calls[0].url,/own-paow-voice\/stream\?output_format=pcm_24000$/);
  f.setProfile({...profile(),voice:{...profile().voice,voiceId:'changed-voice'}});
  await assert.rejects(result.assertFresh(),{code:'generated_speech_profile_changed'});
  await assert.rejects(async()=>{for await (const chunk of result.source({text:'Hej igen.',beforeCostly:result.assertFresh})) void chunk;},/TTS stream failed/);
  assert.equal(f.calls.length,1,'changed profile cannot create a second bill');
});
test('disabled runtime, missing credential, missing dealer and preparation intent stop before reference/provider work',async()=>{
  for(const patch of [{CROUPIER_DEALER_SPEECH_PROFILES:'0'},{ELEVENLABS_API_KEY:''}]) {
    const f=fixture(patch);await assert.rejects(f.runtime.prepare(f.input()));assert.equal(f.references(),0);assert.equal(f.calls.length,0);
  }
  const f=fixture();f.setProfile({...profile(),state:'preparation'});
  assert.equal(await f.runtime.requested('paow'),false);
  await assert.rejects(f.runtime.prepare(f.input()),{code:'generated_speech_profile_not_enabled'});
  await assert.rejects(f.runtime.prepare({...f.input(),dealerId:'foreign'}),{code:'generated_speech_dealer_unavailable'});
  assert.equal(f.references(),0);
});
test('worker attestation must match every binding field; legacy and registered sessions cannot be confused',async()=>{
  const f=fixture(),result=await f.runtime.prepare(f.input()),binding=avatarBinding(result.avatar);
  const headers={'x-dealer-id':'paow','x-speech-profile-revision':binding.profileRevision,'x-speech-image-sha256':binding.imageSha256,'x-speech-protocol':'3'};
  assert.equal(acceptsWorkerBinding(binding,headers),true);
  for(const [key,value] of Object.entries(headers)) {
    assert.equal(acceptsWorkerBinding(binding,{...headers,[key]:value+'x'}),false);
    const missing={...headers};delete missing[key];assert.equal(acceptsWorkerBinding(binding,missing),false);
  }
  assert.equal(acceptsWorkerBinding(undefined,headers),false);
  assert.equal(acceptsWorkerBinding(null,headers),false);
  assert.equal(acceptsWorkerBinding(binding,{}),false);
  assert.equal(acceptsWorkerBinding(null,{}),true);
  assert.throws(()=>avatarBinding({...result.avatar,imageSha256:'0'.repeat(64)}),/Invalid worker avatar/);
});
test('voice permission is checked read-only on exact provider before reference preparation; failures never retry',async()=>{
  for(const response of [()=>new Response('private',{status:404}),()=>Response.json({voice_id:'foreign'}),
    ()=>Response.json({huge:'x'.repeat(140000)}),()=>{throw Error('private key/network error');}]){
    const f=fixture();f.setVoiceResponse(response);
    await assert.rejects(f.runtime.prepare(f.input()),{code:'generated_speech_voice_unavailable'});
    assert.equal(f.probes.length,1);assert.equal(f.references(),0);assert.equal(f.calls.length,0);
    assert.equal(f.probes[0].options.redirect,'error');assert.equal(f.probes[0].options.method,'GET');
    assert.equal(f.probes[0].url,'https://api.elevenlabs.io/v1/voices/own-paow-voice');
  }
});
test('registered Cartesia voice uses its own credential and active exact voice metadata',async()=>{
  const f=fixture({CARTESIA_API_KEY:'cartesia-only'});f.setProfile({...profile(),voice:{provider:'cartesia',voiceId:'own-cartesia',modelId:'sonic-3.5'}});
  f.setVoiceResponse(()=>Response.json({id:'own-cartesia',status:'archived'}));
  await assert.rejects(f.runtime.prepare(f.input()),{code:'generated_speech_voice_unavailable'});
  f.setVoiceResponse(()=>Response.json({id:'own-cartesia',status:'active'}));
  await f.runtime.prepare(f.input());
  assert.equal(f.probes[1].url,'https://api.cartesia.ai/voices/own-cartesia');
  assert.equal(f.probes[1].options.headers.authorization,'Bearer cartesia-only');
  assert.equal(f.probes[1].options.headers['xi-api-key'],undefined);
});
test('normalized clone profile reaches TTS unchanged and a settings edit invalidates the prepared avatar session',async()=>{
  const f=fixture(),voice={...profile().voice,modelId:'eleven_v3',language:'sv',settings:{use_speaker_boost:true,similarity_boost:0.85,stability:0.5}};
  f.setProfile({...profile(),voice});const runtime=await f.runtime.prepare(f.input());
  for await(const chunk of runtime.source({text:'Hej Jakob.',beforeCostly:runtime.assertFresh}))void chunk;
  const body=JSON.parse(f.calls[0].options.body);
  assert.equal(body.model_id,'eleven_v3');assert.equal(body.language_code,undefined);
  assert.deepEqual(body.voice_settings,{stability:0.5,similarity_boost:0.85,use_speaker_boost:true});
  f.setProfile({...profile(),voice:{...voice,settings:{...voice.settings,stability:1}}});
  await assert.rejects(runtime.assertFresh(),{code:'generated_speech_profile_changed'});
  assert.equal(f.calls.length,1);
});

test('warm voice checks reuse only successful exact provider/key/model verification for at most one minute',async()=>{
  const f=fixture();await f.runtime.prepare(f.input());await f.runtime.prepare(f.input());assert.equal(f.probes.length,1);
  f.advance(60000);await f.runtime.prepare(f.input());assert.equal(f.probes.length,2);
  f.setProfile({...profile(),voice:{...profile().voice,voiceId:'different-voice'}});await f.runtime.prepare(f.input());assert.equal(f.probes.length,3);
});
test('failed voice metadata is never cached and cannot start TTS or reference preparation',async()=>{
  const f=fixture();f.setVoiceResponse(()=>new Response('',{status:403}));
  await assert.rejects(f.runtime.prepare(f.input()));await assert.rejects(f.runtime.prepare(f.input()));
  assert.equal(f.probes.length,2);assert.equal(f.references(),0);assert.equal(f.calls.length,0);
});
