import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomGameConfigClient,createRoomGameConfigController} from '../lib/room-game-config-client.mjs';
const context={operatorId:'operator-one',roomId:'room-123'};
const fields={language:'sv',limitPreset:'prive'};
const result=(extra={})=>({ok:true,...context,administrationRevision:'admin-1',packageRevision:4,draft:null,published:null,publication:{ready:false},...extra});
const draft=(extra={})=>result({administrationRevision:'admin-2',draft:{revision:'draft-2',gameConfig:fields},publication:{ready:true},...extra});
const published=()=>result({administrationRevision:'admin-3',packageRevision:5,published:{configVersion:'config-3',packageRevision:5,gameConfig:fields,betMs:20000,actionMs:15000}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('read is scoped, credentialed, uncached and rejects a different room receipt',async()=>{
 const calls=[];const client=createRoomGameConfigClient({fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json(result());}});
 assert.equal((await client.read(context)).roomId,context.roomId);
 const url=new URL(calls[0].url,'https://fixture.invalid');
 assert.equal(url.pathname,'/api/admin/room-game-config');assert.equal(url.searchParams.get('roomId'),context.roomId);
 assert.equal(url.searchParams.get('operatorId'),context.operatorId);assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.redirect,'error');
 const wrong=createRoomGameConfigClient({fetchImpl:async()=>Response.json(result({roomId:'other'}))});
 await assert.rejects(wrong.read(context),/kvitto/);
});

test('save sends only the agreed fields and exact administration/package revisions',async()=>{
 let body;const client=createRoomGameConfigClient({fetchImpl:async(url,init)=>{body=JSON.parse(init.body);return Response.json(draft());}});
 await client.save(context,result(),fields);
 assert.deepEqual(body,{action:'save-draft',...context,expectedAdministrationRevision:'admin-1',expectedPackageRevision:4,gameConfig:fields});
 await assert.rejects(client.save(context,result(),{...fields,betMs:500}),/giltigt/);
 const bad=createRoomGameConfigClient({fetchImpl:async()=>Response.json(draft({packageRevision:5}))});
 await assert.rejects(bad.save(context,result(),fields),/verifieras/);
});

test('publication refers only to saved draft and verifies version and package together',async()=>{
 let body;const client=createRoomGameConfigClient({fetchImpl:async(url,init)=>{body=JSON.parse(init.body);return Response.json(published());}});
 const next=await client.publish(context,draft());
 assert.deepEqual(body,{action:'publish',...context,expectedAdministrationRevision:'admin-2',expectedPackageRevision:4,expectedDraftRevision:'draft-2'});
 assert.equal(next.published.configVersion,'config-3');assert.equal(next.draft,null);
 await assert.rejects(client.publish(context,result()),/Spara/);
 const bad=createRoomGameConfigClient({fetchImpl:async()=>Response.json({...published(),published:{...published().published,packageRevision:4}})});
 await assert.rejects(bad.publish(context,draft()),/verifieras/);
});

test('conflict preserves entered fields and requires readback then save before publish',async()=>{
 let saves=0,publishes=0;
 const controller=createRoomGameConfigController({client:{read:async()=>draft(),save:async(c,p,f)=>{saves++;if(saves===1)throw Error('Konflikt');return draft({draft:{revision:'draft-3',gameConfig:f}});},publish:async()=>{publishes++;return published();}}});
 await controller.configure(context);controller.edit('limitPreset','high');
 await controller.save();assert.equal(controller.getSnapshot().stale,true);assert.equal(controller.getSnapshot().fields.limitPreset,'high');
 await controller.publish();assert.equal(publishes,0);
 await controller.refresh();assert.equal(controller.getSnapshot().fields.limitPreset,'high');assert.equal(controller.dirty(),true);
 await controller.publish();assert.equal(publishes,0);
 await controller.save();assert.equal(controller.dirty(),false);await controller.publish();assert.equal(publishes,1);
});

test('late reads from a previous room cannot replace current room or its draft',async()=>{
 let resolveOld;const controller=createRoomGameConfigController({client:{read:async(c)=>c.roomId===context.roomId?await new Promise(resolve=>resolveOld=resolve):result({...c}),save:async()=>draft(),publish:async()=>published()}});
 const old=controller.configure(context);await controller.configure({...context,roomId:'room-new'});
 resolveOld(draft());await old;assert.equal(controller.getSnapshot().context.roomId,'room-new');assert.equal(controller.getSnapshot().receipt.roomId,'room-new');
 controller.cancel();
});

test('concurrent save clicks produce one request; cancellation discards a late write receipt',async()=>{
 let finish,saves=0;const controller=createRoomGameConfigController({client:{read:async()=>result(),save:async()=>{saves++;return await new Promise(resolve=>finish=resolve);},publish:async()=>published()}});
 await controller.configure(context);const first=controller.save();await controller.save();assert.equal(saves,1);
 controller.cancel();finish(draft());await first;await flush();assert.equal(controller.getSnapshot().receipt.administrationRevision,'admin-1');
});


test('revoked access clears previously read room settings and cannot publish stale data',async()=>{
 let count=0,publishes=0;const controller=createRoomGameConfigController({client:{read:async()=>{if(count++===0)return draft();throw Object.assign(Error('Åtkomst nekad'),{status:403});},save:async()=>draft(),publish:async()=>{publishes++;return published();}}});
 await controller.configure(context);await controller.refresh();assert.equal(controller.getSnapshot().receipt,null);await controller.publish();assert.equal(publishes,0);
});
