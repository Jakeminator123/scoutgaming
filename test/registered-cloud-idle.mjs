import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegisteredDealerIdle} from '../packages/presentation/server/registered-dealer-idle.mjs';
const fixture=dealerId=>{
 const id='11111111-1111-4111-8111-111111111111';
 const baseline=dealerId+'.idle.ready.standard';
 const project={dealers:[{id:dealerId,label:dealerId}],lines:[{dealerId,eventId:'idle.ready',baselineVariantId:baseline,variants:[{id:baseline,triggerIds:[],videoGenerationId:id}]}]};
 const video={id,dealer:dealerId,sha256:'a'.repeat(64),available:true,classification:{dealerId,eventId:'idle.ready',kind:'idle',role:'standard',playback:'once',situation:'',label:'Idle',notes:''}};
 return {project,video};
};
for (const dealerId of ['astrid','paow','dragan','marten','nora','another-dealer']) test(dealerId+' uses only its own saved cloud idle', async()=>{
 const {project,video}=fixture(dealerId);
 const load=createRegisteredDealerIdle({registryLoader:async()=>({videos:[video]})});
 assert.equal(Boolean(await load(dealerId,project)),true);
 video.dealer='other';assert.equal(await load(dealerId,project),null);
 video.dealer=dealerId;project.lines[0].variants[0].videoGenerationId=null;assert.equal(await load(dealerId,project),null);
 assert.equal(await load('unregistered',project),null);
});
for (const dealerId of ['vera','mei','amira','johanna']) test(dealerId+' cannot reactivate an exact historical cloud idle',async()=>{
 const {project,video}=fixture(dealerId),before=structuredClone({project,video});
 let reads=0;const load=createRegisteredDealerIdle({registryLoader:async()=>{reads++;return {videos:[video]};}});
 assert.equal(await load(dealerId,project),null);
 assert.equal(reads,0,'retired identities are rejected before reading their media registry');
 assert.deepEqual({project,video},before,'historical saved data remains unchanged');
});
