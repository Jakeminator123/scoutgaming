import test from 'node:test';
import assert from 'node:assert/strict';
import { createDealerSpeechRuntime } from '../web/dealer-speech-runtime.mjs';
import { dealerSpeechProfileRevision } from '../web/dealer-speech-reference.mjs';
import { createMovingSpeechSourceSet } from '../web/moving-speech-bank.mjs';

const videoId = '11111111-1111-4111-8111-111111111111', sha256 = 'a'.repeat(64);
const compositing = {mode:'green-screen',threshold:.21,softness:.13,despill:.1};
const profile = () => ({schemaVersion:2,state:'enabled',
  voice:{provider:'elevenlabs',voiceId:'own-dragan-voice',modelId:'eleven_multilingual_v2',language:'sv',settings:{stability:.5,style:.15}},
  reference:{kind:'motion-video',videoId,sha256,offsetMs:0}});
function fixture(options = {}) {
  const state = {profile:profile(),videos:[{id:videoId,dealer:'dragan',revision:'studio-media-1',
    available:true,storage:'private-blob',contentType:'video/mp4',bytes:100,sha256,
    classification:{kind:'idle',dealerId:'dragan',compositing:{...compositing}}}],probes:[],tts:[],references:0};
  const sourceSet = createMovingSpeechSourceSet({dealerId:'dragan',
    clips:[{videoId,sha256,bytes:100,fps:24,frameCount:48,width:1080,height:1920}],rest:{videoId,frame:0}});
  const runtime = createDealerSpeechRuntime({
    readProject:async()=>({dealers:[{id:'dragan',speechProfile:state.profile}]}),
    readVideoRegistry:options.withoutRegistry ? undefined : async()=>({videos:state.videos}),
    env:{CROUPIER_DEALER_SPEECH_PROFILES:'1',ELEVENLABS_API_KEY:'fixture-only',...options.env},
    referenceService:{async prepare(){state.references++;assert.fail('moving preparation must never extract a still image');}},
    fetchImpl:async(url,input)=>{
      if(input.method==='GET') { state.probes.push(url); await options.onProbe?.(state);
        return options.voiceResponse?.() ?? Response.json({voice_id:'own-dragan-voice'}); }
      state.tts.push({url,input}); return new Response(new Uint8Array(48));
    },
  });
  return {state,sourceSet,runtime,input:()=>({dealerId:'dragan',sourceSet,beforeCostly:async()=>{}})};
}
async function speak(prepared) {
  for await(const chunk of prepared.source({text:'Hej Jakob.',beforeCostly:prepared.assertFresh})) assert.ok(chunk.length);
}

test('moving profile uses exact registered voice and compositing without still extraction or automatic TTS',async()=>{
  const f=fixture(),prepared=await f.runtime.prepareMoving(f.input());
  assert.equal(await f.runtime.requested('dragan'),true);
  assert.deepEqual(Object.keys(prepared).sort(),['assertFresh','compositing','profileRevision','source']);
  assert.equal(prepared.profileRevision,dealerSpeechProfileRevision(f.state.profile));
  assert.deepEqual(prepared.compositing,compositing);
  assert.equal(f.state.references,0);assert.equal(f.state.tts.length,0);
  assert.deepEqual(f.state.probes,['https://api.elevenlabs.io/v1/voices/own-dragan-voice']);
  await speak(prepared);
  assert.equal(f.state.tts.length,1);
  assert.match(f.state.tts[0].url,/own-dragan-voice\/stream\?output_format=pcm_24000$/);
  const body=JSON.parse(f.state.tts[0].input.body);
  assert.equal(body.text,'Hej Jakob.'); assert.equal(body.model_id,'eleven_multilingual_v2');
  assert.equal(body.language_code,undefined,'the existing multilingual provider contract retains language only in profile intent');
  assert.deepEqual(body.voice_settings,{stability:.5,style:.15});
});

test('still and moving paths reject the opposite reference kind before any provider or reference request',async()=>{
  const f=fixture();
  await assert.rejects(f.runtime.prepare(f.input()),{code:'generated_speech_reference_kind'});
  f.state.profile.reference.kind='video-frame';
  await assert.rejects(f.runtime.prepareMoving(f.input()),{code:'generated_speech_reference_kind'});
  assert.equal(f.state.probes.length,0);assert.equal(f.state.references,0);assert.equal(f.state.tts.length,0);
});

test('moving enablement, own dealer, configured registry and credentials are mandatory',async()=>{
  for(const options of [{env:{CROUPIER_DEALER_SPEECH_PROFILES:'0'}},{env:{ELEVENLABS_API_KEY:''}},{withoutRegistry:true}]){
    const f=fixture(options);await assert.rejects(f.runtime.prepareMoving(f.input()));
    assert.equal(f.state.probes.length,0);assert.equal(f.state.references,0);assert.equal(f.state.tts.length,0);
  }
  const f=fixture();f.state.profile.state='preparation';
  await assert.rejects(f.runtime.prepareMoving(f.input()),{code:'generated_speech_profile_not_enabled'});
  await assert.rejects(f.runtime.prepareMoving({...f.input(),dealerId:'astrid'}),{code:'generated_speech_dealer_unavailable'});
  assert.equal(f.state.probes.length,0);
});

test('moving source set must validate and contain the exact profile video ID, hash and dealer',async()=>{
  for(const mutate of [
    sources=>{sources.sourceSetSha256='b'.repeat(64);},
    sources=>{sources.clips[0].frameCount++;},
  ]){
    const f=fixture(),sources=structuredClone(f.sourceSet);mutate(sources);
    await assert.rejects(f.runtime.prepareMoving({...f.input(),sourceSet:sources}),{code:'generated_speech_moving_sources_invalid'});
    assert.equal(f.state.probes.length,0);
  }
  for(const patch of [{videoId:'22222222-2222-4222-8222-222222222222'},{sha256:'b'.repeat(64)}]){
    const f=fixture();Object.assign(f.state.profile.reference,patch);
    await assert.rejects(f.runtime.prepareMoving(f.input()),{code:'generated_speech_reference_mismatch'});
    assert.equal(f.state.probes.length,0);
  }
  const f=fixture(),foreign=createMovingSpeechSourceSet({...f.sourceSet,dealerId:'astrid'});
  await assert.rejects(f.runtime.prepareMoving({...f.input(),sourceSet:foreign}),{code:'generated_speech_reference_mismatch'});
  assert.equal(f.state.probes.length,0);
});

test('moving offset is bounded by the exact clip frame count even without registry duration',async()=>{
  const f=fixture();f.state.profile.reference.offsetMs=1999;
  await f.runtime.prepareMoving(f.input());
  for(const offsetMs of [2000,2001,3600000]){
    f.state.profile.reference.offsetMs=offsetMs;
    await assert.rejects(f.runtime.prepareMoving(f.input()),{code:'generated_speech_reference_out_of_range'});
  }
  assert.equal(f.state.probes.length,1);assert.equal(f.state.references,0);
});

test('unavailable, unversioned, changed, recorded-speech and incompatible sources stop before voice verification',async()=>{
  for(const mutate of [
    f=>{f.state.videos=[];},f=>{f.state.videos.push(structuredClone(f.state.videos[0]));},
    ...[{sha256:'b'.repeat(64)},{bytes:101},{dealer:'astrid'},{available:false},{integrity:'unavailable'},
      {revision:undefined},{storage:'disk'},{deletion:{state:'deleted'}},{contentType:'video/webm'},{duration:0},
      {compositing:{mode:'opaque'}},{compositing:{mode:'alpha'}},{compositing:{mode:'green-screen',threshold:2}}]
      .map(patch=>f=>Object.assign(f.state.videos[0],patch)),
    ...[{archived:true},{recordedSpeech:{text:'Recorded words'}},{kind:'reaction'},{dealerId:'astrid'}]
      .map(patch=>f=>Object.assign(f.state.videos[0].classification,patch)),
  ]){
    const f=fixture();mutate(f);
    await assert.rejects(f.runtime.prepareMoving(f.input()),{code:'generated_speech_moving_reference_unavailable'});
    assert.equal(f.state.probes.length,0);assert.equal(f.state.references,0);assert.equal(f.state.tts.length,0);
  }
});

test('effective compositing reads registry overrides or its valid legacy default, never a hard-coded null',async()=>{
  const f=fixture();f.state.videos[0].compositing={...compositing,threshold:.42};
  assert.equal((await f.runtime.prepareMoving(f.input())).compositing.threshold,.42);
  delete f.state.videos[0].compositing;delete f.state.videos[0].classification.compositing;
  assert.deepEqual((await f.runtime.prepareMoving(f.input())).compositing,{mode:'green-screen',threshold:.23,softness:.15,despill:0});
});

test('freshness rejects changed profile, media revision, classification or compositing before another TTS call',async()=>{
  for(const mutate of [
    f=>{f.state.profile.voice.settings.style=.3;},f=>{f.state.profile.state='preparation';},
    f=>{f.state.videos[0].revision='studio-media-2';},
    f=>{f.state.videos[0].classification.compositing.threshold=.4;},
    f=>{f.state.videos[0].classification.label='Reclassified';},
    f=>{f.state.videos[0].sha256='b'.repeat(64);},f=>{f.state.videos[0].classification.archived=true;},
  ]){
    const f=fixture(),prepared=await f.runtime.prepareMoving(f.input());
    await speak(prepared);mutate(f);
    await assert.rejects(prepared.assertFresh());await assert.rejects(speak(prepared));
    assert.equal(f.state.tts.length,1);assert.equal(f.state.references,0);
  }
});

test('a registry edit during voice permission lookup invalidates moving preparation',async()=>{
  const f=fixture({onProbe:state=>{state.videos[0].revision='studio-media-2';}});
  await assert.rejects(f.runtime.prepareMoving(f.input()),{code:'generated_speech_reference_changed'});
  assert.equal(f.state.tts.length,0);assert.equal(f.state.references,0);
});

test('moving voice verification is bounded, cached on success and fails closed on provider rejection',async()=>{
  const f=fixture();await f.runtime.prepareMoving(f.input());await f.runtime.prepareMoving(f.input());
  assert.equal(f.state.probes.length,1);
  const failed=fixture({voiceResponse:()=>new Response('',{status:403})});
  await assert.rejects(failed.runtime.prepareMoving(failed.input()),{code:'generated_speech_voice_unavailable'});
  assert.equal(failed.state.probes.length,1);assert.equal(failed.state.references,0);assert.equal(failed.state.tts.length,0);
});

test('owner rejection and cancellation silence prepared moving speech before provider work',async()=>{
  const f=fixture(),controller=new AbortController();let owner=true;
  const prepared=await f.runtime.prepareMoving({...f.input(),signal:controller.signal,beforeCostly:async()=>{if(!owner)throw Error('owner_changed');}});
  owner=false;await assert.rejects(prepared.assertFresh(),/owner_changed/);await assert.rejects(speak(prepared));
  owner=true;controller.abort();await assert.rejects(prepared.assertFresh(),{name:'AbortError'});await assert.rejects(speak(prepared));
  assert.equal(f.state.tts.length,0);assert.equal(f.state.references,0);
});
