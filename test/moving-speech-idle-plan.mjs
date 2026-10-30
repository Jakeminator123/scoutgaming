import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingSpeechSourceSet} from '../services/game/moving-speech-bank.mjs';
import {prepareMovingIdleSource,prepareMovingIdlePlan} from '../services/game/moving-speech-idle-plan.mjs';

const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',sha='a'.repeat(64);
function fixture(){
  const dealerId='nora',classification={dealerId,eventId:'idle.ready',kind:'idle',role:'standard',label:'Own idle',notes:'',situation:''};
  const video={id,dealer:dealerId,sha256:sha,bytes:100,available:true,classification};
  const sourceSet=createMovingSpeechSourceSet({dealerId,clips:[{videoId:id,sha256:sha,bytes:100,fps:24,frameCount:39,width:1080,height:1920}],rest:{videoId:id,frame:0}});
  const policy={schemaVersion:1,familyId:dealerId+'/idle.ready/ready',base:[{videoId:id,weight:100,durationMs:60000}],variants:[]};
  const project={dealers:[{id:dealerId}],dealerIdlePolicies:[{dealerId,policy}],
    lines:[{dealerId,eventId:'idle.ready',baselineVariantId:dealerId+'.idle.ready.standard',
      variants:[{id:dealerId+'.idle.ready.standard',triggerIds:[],videoGenerationId:id}]}]};
  const frozenContext={schemaVersion:3,context:{dealerId},dealer:{id:dealerId},project,inventory:{videos:[video]},
    records:[{id,sha256:sha,size:100,contentType:'video/mp4',classification}]};
  return {sourceSet,frozenContext,publicVideo:videoId=>({id:videoId,sha256:sha,src:'/api/presentation/registered-video/fixture/'+videoId})};
}

test('idle speech uses the explicit published baseline and whole measured cycles regardless of approximate policy duration',()=>{
  const f=fixture(),idle=prepareMovingIdleSource(f);
  for(const count of [18,39,40,600]){
    const sequence=prepareMovingIdlePlan(idle,count),length=Math.ceil(count/39)*39;
    assert.equal(sequence.kind,'idle');assert.equal(sequence.frames.length,length);
    assert.equal(sequence.steps[0].end,length);assert.equal(sequence.sources[0].videoId,id);
    assert.deepEqual(sequence.frames.map(f=>f.frame),Array.from({length},(_,k)=>k%39));
    assert.ok(sequence.frames.every(f=>f.take==='clip-'+id&&f.sourceSha256===sha));
  }
  const durationChange=fixture();durationChange.frozenContext.project.dealerIdlePolicies[0].policy.base[0].durationMs=200;
  const changed=prepareMovingIdleSource(durationChange);
  assert.notEqual(changed.fingerprint,idle.fingerprint,'published policy changes invalidate preparation');
  assert.deepEqual(prepareMovingIdlePlan(changed,40),prepareMovingIdlePlan(idle,40));
});

test('idle speech refuses missing, ambiguous, substituted, foreign or unregistered baseline authority',()=>{
  const changes=[f=>f.frozenContext.schemaVersion=2,f=>f.frozenContext.context.dealerId='other',
    f=>f.frozenContext.dealer.id='other',f=>f.frozenContext.project.dealers=[],
    f=>f.frozenContext.project.lines[0].variants[0].triggerIds=['conditional'],
    f=>f.frozenContext.project.lines[0].variants[0].videoGenerationId=other,
    f=>f.frozenContext.project.dealerIdlePolicies[0].policy.base[0].videoId=other,
    f=>f.frozenContext.project.dealerIdlePolicies=[],f=>f.frozenContext.inventory.videos[0].available=false,
    f=>f.frozenContext.inventory.videos[0].classification.dealerId='other',
    f=>f.frozenContext.inventory.videos.push(structuredClone(f.frozenContext.inventory.videos[0])),
    f=>f.frozenContext.inventory.videos[0].sha256='b'.repeat(64),f=>f.frozenContext.records[0].size=101,
    f=>f.frozenContext.records[0].sha256='b'.repeat(64),f=>f.frozenContext.records=[],
    f=>f.publicVideo=()=>({id:other,sha256:sha,src:'/api/presentation/registered-video/fixture/'+other}),
    f=>f.publicVideo=undefined];
  for(const change of changes){const f=fixture();change(f);assert.throws(()=>prepareMovingIdleSource(f),/moving_idle_source_mismatch/);}
});

test('idle plans are bounded and contain no card events or invented presentation version',()=>{
  const idle=prepareMovingIdleSource(fixture());
  for(const count of [0,-1,601,1.5,NaN])assert.throws(()=>prepareMovingIdlePlan(idle,count));
  const sequence=prepareMovingIdlePlan(idle,48);
  assert.equal(Object.hasOwn(sequence,'version'),false);
  assert.equal(Object.hasOwn(sequence.steps[0],'event'),false);
});
