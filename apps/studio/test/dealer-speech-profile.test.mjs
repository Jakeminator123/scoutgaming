import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDealerSpeechProfile,validateDealerSpeechReference,dealerSpeechPreparation,dealerSpeechReferenceCheck} from '../../../packages/presentation/contracts/dealer-speech-profile.mjs';
import {addDealer,createSeedProject,defaultPresentationLane,validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {createStudioProjectBindings} from '../../../packages/presentation/server/studio-project-bindings.mjs';
import {captureFrozenRegisteredDealers} from '../../../packages/presentation/server/frozen-dealer-idle.mjs';
import {dealerVoicePreset,dealerVoiceDraft,dealerVoiceFromDraft,matchingDealerVoicePreset,suggestedDealerVoicePreset} from '../../../packages/presentation/contracts/dealer-voice-catalog.mjs';

test('original celebrity presets choose exact IDs, language-specific models and independent tuning',()=>{
  const paow=dealerVoicePreset('paow','sv'),english=dealerVoicePreset('paow','en'),dragge=dealerVoicePreset('dragge','sv');
  assert.equal(paow.voiceId,'WZVEBKUreb9jAKojf0QF');assert.equal(paow.modelId,'eleven_v3');
  assert.deepEqual(paow.settings,{stability:.5,similarity_boost:.85,use_speaker_boost:true});
  assert.equal(english.voiceId,paow.voiceId);assert.equal(english.modelId,'eleven_multilingual_v2');
  assert.deepEqual(english.settings,{stability:.38,similarity_boost:.8,style:.3,use_speaker_boost:true});
  assert.equal(dragge.voiceId,'7f95xPL4S3ySZ4OS1pw8');assert.equal(dragge.modelId,'eleven_multilingual_v2');assert.equal(dragge.settings.style,.15);
  paow.settings.stability=0;assert.equal(dealerVoicePreset('paow','sv').settings.stability,.5);
  for(const id of ['paow','dragge','astrid-victoria'])for(const language of ['sv','en']){
    const voice=dealerVoicePreset(id,language),draft=dealerVoiceDraft(voice);
    assert.deepEqual(normalizeDealerSpeechProfile({schemaVersion:2,state:'preparation',voice:dealerVoiceFromDraft(draft),reference:null}).voice,voice);
    assert.equal(matchingDealerVoicePreset(draft),id);
  }
  assert.throws(()=>dealerVoicePreset('marten'));assert.throws(()=>dealerVoicePreset('paow','sv-SE'));
});
test('name suggestions do not invent clones or silently replace custom saved tuning',()=>{
  assert.equal(suggestedDealerVoicePreset({id:'body-7',label:'PAOW'}),'paow');
  assert.equal(suggestedDealerVoicePreset({id:'dragan',label:'Dragan'}),'dragge');
  assert.equal(suggestedDealerVoicePreset({id:'marten',label:'Mårten'}),null);
  assert.equal(suggestedDealerVoicePreset({id:'body-paow-fake',label:'Paow?'}),null);
  const voice={...dealerVoicePreset('paow','sv'),settings:{stability:.1}},snapshot=structuredClone(voice),draft=dealerVoiceDraft(voice);
  assert.equal(matchingDealerVoicePreset(draft),null);assert.deepEqual(dealerVoiceFromDraft(draft),snapshot);assert.deepEqual(voice,snapshot);
  assert.equal(dealerVoiceFromDraft(dealerVoiceDraft(null)),null);
});
const voice={provider:'elevenlabs',voiceId:'paow-own-voice',modelId:'fixture-model'};
const reference={kind:'video-frame',videoId:'own-idle',sha256:'a'.repeat(64),offsetMs:200};
const profile=()=>({schemaVersion:1,state:'preparation',voice:{...voice},reference:{...reference}});
const video=()=>({id:'own-idle',dealer:'paow',available:true,integrity:'verified',bytes:100,sha256:'a'.repeat(64),duration:3});
test('new registered dealer can persist preparation without changing runtime activation',()=>{
  const project=addDealer(createSeedProject(),'paow','PAOW');
  project.dealers.find(row=>row.id==='paow').speechProfile=profile();
  assert.equal(validateProject(project),project);
  assert.equal(dealerSpeechPreparation(profile()).active,false);
  assert.deepEqual(dealerSpeechPreparation(undefined).missing,['röstprofil','referensvideo']);
  const incomplete={schemaVersion:1,state:'preparation',voice:null,reference:null};
  assert.deepEqual(normalizeDealerSpeechProfile(incomplete),incomplete);
});
test('credentials, endpoints, active flags and forged reference shapes cannot enter the draft profile',()=>{
  for(const patch of [{state:'active'},{apiKey:'secret'},{endpoint:'https://worker.invalid'},{voice:{...voice,apiKey:'secret'}},{voice:{...voice,provider:'unknown'}},
    {reference:{...reference,videoId:'https://private.invalid/video'}},{reference:{...reference,offsetMs:-1}},{reference:{...reference,frameIndex:2}}]){
    assert.throws(()=>normalizeDealerSpeechProfile({...profile(),...patch}));
  }
});
test('own unchanged available video plus in-range selected timestamp are required',()=>{
  assert.doesNotThrow(()=>validateDealerSpeechReference(profile(),video(),'paow'));
  assert.doesNotThrow(()=>validateDealerSpeechReference(profile(),{...video(),duration:undefined},'paow'));
  for(const patch of [{dealer:'astrid'},{sha256:'b'.repeat(64)},{available:false},{integrity:'unavailable'},{duration:.2},{classification:{mediaType:'audio'}},{classification:{archived:true}}]){
    assert.throws(()=>validateDealerSpeechReference(profile(),{...video(),...patch},'paow'));
  }
});

test('incompatible reference can stay in preparation but cannot enable speech over the three layers',()=>{
  const enabled={...profile(),schemaVersion:2,state:'enabled'};
  for(const patch of [{compositing:{mode:'alpha'}},{compositing:{mode:'opaque'}},{bytes:256*1024*1024+1},
    {contentType:'image/png'},{duration:0},{classification:{dealerId:'astrid'}},{compositing:{mode:'green-screen',threshold:2}}]){
    const source={...video(),...patch};
    assert.equal(dealerSpeechReferenceCheck(source,'paow').canEnable,false);
    assert.throws(()=>validateDealerSpeechReference(enabled,source,'paow'),/speech_reference_/);
  }
  const alpha={...video(),compositing:{mode:'alpha'}};
  assert.doesNotThrow(()=>validateDealerSpeechReference(profile(),alpha,'paow'));
  assert.match(dealerSpeechReferenceCheck(alpha,'paow').message,/Alfa.*talmotorn/);
  assert.equal(dealerSpeechReferenceCheck(video(),'paow').canEnable,true);
  assert.doesNotThrow(()=>validateDealerSpeechReference(enabled,video(),'paow'));
});
test('save binding checks own source, hash and archive state on authoritative registry',async()=>{
  const project=addDealer(createSeedProject(),'paow','PAOW');delete project.idlePolicy;
  project.dealers.find(row=>row.id==='paow').speechProfile=profile();
  const source=video(),registry={videos:[source],families:[]};
  const verify=createStudioProjectBindings({videoRegistry:async()=>registry});
  await verify(project);
  for(const [key,value] of [['dealer','astrid'],['sha256','b'.repeat(64)],['available',false]]){
    const previous=source[key];source[key]=value;
    await assert.rejects(verify(project),error=>error.code==='studio_speech_reference_invalid');source[key]=previous;
  }
});
test('frozen dealer capture projects id/label/idle only and omits speech preparation',()=>{
  const project=addDealer(createSeedProject(),'paow','PAOW');delete project.idlePolicy;
  project.dealers.find(row=>row.id==='paow').speechProfile=profile();
  const lane=defaultPresentationLane('paow');project.lanes=[lane];
  const captured=captureFrozenRegisteredDealers({project,selectedLaneIds:[lane.id],inventory:{videos:[],families:[]},mediaRows:[]});
  const dealer=captured.registeredDealers.find(row=>row.id==='paow');
  assert.deepEqual(dealer,{id:'paow',label:'PAOW',idle:null});
  assert.doesNotMatch(JSON.stringify(captured),/voiceId|elevenlabs|own-idle|speechProfile/);
});

test('enabled request needs voice and an explicit video reference, remains unapproved and stays bound on save',async()=>{
  const enabled={...profile(),schemaVersion:2,state:'enabled'};
  assert.deepEqual(normalizeDealerSpeechProfile(enabled),enabled);
  assert.equal(dealerSpeechPreparation(enabled).active,false);
  assert.equal(dealerSpeechPreparation(enabled).requested,true);
  for(const patch of [{schemaVersion:1},{voice:null},{reference:null}])assert.throws(()=>normalizeDealerSpeechProfile({...enabled,...patch}));
  const moving={...enabled,reference:{...reference,kind:'motion-video'}};
  assert.deepEqual(normalizeDealerSpeechProfile(moving),moving);
  assert.equal(dealerSpeechPreparation(moving).active,false);
  assert.equal(dealerSpeechPreparation(moving).requested,true);
  const project=addDealer(createSeedProject(),'paow','PAOW');delete project.idlePolicy;
  project.dealers.find(row=>row.id==='paow').speechProfile=enabled;
  assert.equal(validateProject(project),project);
  const verify=createStudioProjectBindings({videoRegistry:async()=>({videos:[{...video(),dealer:'astrid'}],families:[]})});
  await assert.rejects(verify(project),error=>error.code==='studio_speech_reference_invalid');
  project.dealers.find(row=>row.id==='paow').speechProfile=moving;
  assert.equal(validateProject(project),project);
  await assert.rejects(verify(project),error=>error.code==='studio_speech_reference_invalid');
  await createStudioProjectBindings({videoRegistry:async()=>({videos:[video()],families:[]})})(project);
});

test('v2 preserves explicit ElevenLabs tuning, forbids foreign fields and leaves v1 unchanged',()=>{
  const p={...profile(),schemaVersion:2,voice:{...voice,modelId:'eleven_v3',language:'sv',settings:{use_speaker_boost:true,similarity_boost:.85,stability:.5}}};
  const normalized=normalizeDealerSpeechProfile(p);
  assert.deepEqual(normalized.voice.settings,{stability:.5,similarity_boost:.85,use_speaker_boost:true});
  assert.deepEqual(Object.keys(normalized.voice.settings),['stability','similarity_boost','use_speaker_boost']);
  for(const settings of [{},{stability:NaN},{stability:1.01},{style:-1},{use_speaker_boost:'true'},{apiKey:'secret'}])assert.throws(()=>normalizeDealerSpeechProfile({...p,voice:{...p.voice,settings}}));
  for(const patch of [{schemaVersion:1},{voice:{...p.voice,provider:'cartesia'}},{voice:{...p.voice,language:'sv-SE'}}])assert.throws(()=>normalizeDealerSpeechProfile({...p,...patch}));
  assert.deepEqual(normalizeDealerSpeechProfile({...profile(),voice:null}).voice,null);
});
