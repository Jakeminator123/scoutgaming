import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegisteredDealerIdle} from '../web/storage/studio-runtime.mjs';
for (const dealerId of ['astrid','vera','mei','paow','amira']) test(dealerId+' uses only its own saved cloud idle', async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const baseline=dealerId+'.idle.ready.standard';
 const project={dealers:[{id:dealerId,label:dealerId}],lines:[{dealerId,eventId:'idle.ready',baselineVariantId:baseline,variants:[{id:baseline,triggerIds:[],videoGenerationId:id}]}]};
 const video={id,dealer:dealerId,sha256:'a'.repeat(64),available:true,classification:{dealerId,eventId:'idle.ready',kind:'idle',role:'standard',playback:'once',situation:'',label:'Idle',notes:''}};
 const load=createRegisteredDealerIdle({registryLoader:async()=>({videos:[video]})});
 assert.equal(Boolean(await load(dealerId,project)),dealerId!=='amira');
 video.dealer='other';assert.equal(await load(dealerId,project),null);
 video.dealer=dealerId;project.lines[0].variants[0].videoGenerationId=null;assert.equal(await load(dealerId,project),null);
 assert.equal(await load('unregistered',project),null);
});
