import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {layerAssetPath} from '../../../packages/presentation/contracts/presentation-layers.mjs';
import {canonicalStudioJson} from '../../../packages/studio-registry/server/document-contract.mjs';
import {operatorMemoryPool} from './fixtures/operator-memory-pool.mjs';
import {createOperatorStore} from '../../../packages/operators/server/operator-store.mjs';
import {createPartnerBrandingApi} from '../lib/partner-branding-api.mjs';
import {defaultPresentationLane} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {withPackagePresentation} from '../../../packages/presentation/server/presentation-package.mjs';
import {publicEditableBranding,resolveRoomBranding} from '../../../packages/operators/contracts/branding.mjs';
const scope={environment:'isolated-drafts',workspaceId:'draft-unit'},operatorId='draft-unit';
async function fixture(operatorAdjustable=['table.color','dealer'],{large=false,metadataBytes=0,roomGames={},tableClip=false}={}){
 const pool=operatorMemoryPool(),store=await createOperatorStore({sql:pool,scope}),actor='fixture';
 const audit={actorId:'42',accessClass:'partner',requestId:randomUUID()};
 await store.createOperator({operatorId,actor,slug:'draft-unit',name:'Draft'});
 const lane={...defaultPresentationLane('astrid'),composition:defaultCompositionSettings(),operatorAdjustable,dealers:['astrid','nora']};
 lane.layers.dealer={enabled:true,default:'astrid',allowed:['astrid','nora']};
 lane.layers.table={...lane.layers.table,enabled:true,colors:['#112233','#334455','#556677']};
 const assets=large?['table','background'].map((role,index)=>{
  const asset={schemaVersion:1,id:index?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111',role,label:role,
   contentType:'image/png',sha256:'a'.repeat(64),size:32,width:1920,height:1080};return {...asset,pathname:layerAssetPath(asset)};
 }):[];
 if(large){
  lane.layers.table={...lane.layers.table,enabled:true,default:assets[0].id,allowed:[assets[0].id]};
  lane.layers.background={...lane.layers.background,enabled:true,mode:'image',default:assets[1].id,allowed:[assets[1].id]};
 }
 if(tableClip){
  // A granted table clip for tablePlayback next to the base table.
  const row=(id,label,contentType)=>{const asset={schemaVersion:1,id,role:'table',label,contentType,sha256:'a'.repeat(64),size:32,width:1920,height:1080};return {...asset,pathname:layerAssetPath(asset)};};
  assets.push(row('11111111-1111-4111-8111-111111111111','Bord','image/png'),row('33333333-3333-4333-8333-333333333333','Levande bord','video/mp4'));
  lane.layers.table={...lane.layers.table,enabled:true,default:assets[0].id,allowed:assets.map(asset=>asset.id)};
  lane.tablePlayback={schemaVersion:1,rules:[{id:'living',assetId:assets[1].id,trigger:{everyMs:25000},maxDurationMs:10000,cooldownMs:25000,maxPerMinute:2,maxSecondsPerMinute:20}]};
 }
 const tables=large?Array.from({length:28},(_,i)=>'room-'+String(i).padStart(2,'0')+'x'.repeat(50)):['room-a','room-b'];
 const {playback:_playback,...captured}=cloudPresentationFixture({lanes:[lane],assets}).presentation;
 const presentation={...captured,schemaVersion:2};
 const initial=withPackagePresentation({lane:lane.id,color:'#112233'},presentation);
 if(metadataBytes)initial.n1Note='x'.repeat(metadataBytes);
 await store.publishPackage({operatorId,actor,lanes:[lane.id],games:[...new Set(['blackjack',...Object.values(roomGames)])],tables,branding:initial});
 let allowed=true,adminRevision='a1';
 const readAdministration=async()=>({revision:adminRevision,value:{gameLane:'portrait-astrid',gameLanes:[{schemaVersion:1,id:'portrait-astrid',label:'Astrid',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}],
 rooms:tables.map(id=>({schemaVersion:2,id,name:id,operatorId,presentationLaneId:lane.id,gameLaneId:'portrait-astrid',state:'live',...(roomGames[id]?{game:roomGames[id]}:{})}))}});
 const api=createPartnerBrandingApi({store,readProject:async()=>assert.fail('frozen only'),readAdministration,
 withWriteContext:work=>work({store,readAdministration,reauthorize:async()=>allowed})});
 const command=input=>api.command({operatorId,actor,audit,expectedDraftRevision:0,expectedPackageRevision:1,...input});
 return {pool,store,api,command,lane,tables,assets,initial,audit,actor,revoke:()=>{allowed=false;},changeAdmin:()=>{adminRevision='a2';}};
}

test('room metadata uses authoritative game and a room-only publish leaves the other room unchanged',async()=>{
 const f=await fixture(['table.color','dealer'],{roomGames:{'room-b':'roulette'}});
 const before=await f.api.readState({operatorId});
 assert.deepEqual(before.rooms.map(room=>[room.id,room.game]),[['room-a','blackjack'],['room-b','roulette']]);
 const saved=await f.command({action:'save-draft',branding:{lane:f.lane.id,color:'#112233',roomOverrides:{'room-a':{color:'#334455'}}}});
 assert.deepEqual(saved.rooms,before.rooms);
 const review=await f.command({action:'review',expectedDraftRevision:1});assert.deepEqual(review.affectedRooms,['room-a']);
 const published=await f.command({action:'publish',expectedDraftRevision:1,reviewToken:review.reviewToken});
 assert.deepEqual(published.rooms,before.rooms);assert.equal(published.branding.roomOverrides['room-a'].color,'#334455');
 assert.deepEqual(resolveRoomBranding(published.branding,'room-b',f.lane.id),resolveRoomBranding(before.branding,'room-b',f.lane.id));
});
test('draft save is durable without publishing; review binds administration; restore is only a draft',async()=>{
 const f=await fixture();
 const saved=await f.command({action:'save-draft',branding:{lane:f.lane.id,color:'#334455',roomOverrides:{'room-b':{color:'#556677'}}}});
 assert.equal(saved.packageRevision,1);assert.equal(saved.draft.revision,1);assert.equal((await f.api.readState({operatorId})).draft.branding.color,'#334455');
 const review=await f.command({action:'review',expectedDraftRevision:1});
 assert.deepEqual(review.affectedRooms,['room-a','room-b']);assert.ok(review.changes.some(row=>row.roomId==='room-b'&&row.after==='#556677'));
 f.changeAdmin();
 await assert.rejects(f.command({action:'publish',expectedDraftRevision:1,reviewToken:review.reviewToken}),e=>e.statusCode===409);
 const fresh=await f.command({action:'review',expectedDraftRevision:1});
 const published=await f.command({action:'publish',expectedDraftRevision:1,reviewToken:fresh.reviewToken});
 assert.equal(published.packageRevision,2);assert.equal(published.draft,null);assert.equal(published.draftRevision,2);
 const restored=await f.command({action:'restore',sourcePackageRevision:1,expectedDraftRevision:2,expectedPackageRevision:2});
 assert.equal(restored.packageRevision,2);assert.equal(restored.draft.revision,3);assert.equal(restored.draft.branding.color,'#112233');
 const journal=await f.store.listAuditEvents(operatorId);
 assert.ok(journal.entries.some(row=>row.action==='draft.restore'&&row.actor==='42'));
});
test('concurrent draft CAS, revoked grants and foreign or unimplemented fields preserve the saved draft',async()=>{
 const f=await fixture(),body={action:'save-draft',branding:{lane:f.lane.id,color:'#334455'}};
 const results=await Promise.allSettled([f.command(body),f.command(body)]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
 assert.equal(results.find(row=>row.status==='rejected').reason.statusCode,409);
 for(const branding of [{logo:'https://example.invalid/x'},{lane:f.lane.id,roomOverrides:{foreign:{color:'#334455'}}},{lane:f.lane.id,roomOverrides:{'room-a':{lane:'foreign'}}},{lane:f.lane.id,color:'rgba(0,0,0,0)'}])
  await assert.rejects(f.command({action:'save-draft',expectedDraftRevision:1,branding}),e=>e.statusCode===422);
 f.revoke();await assert.rejects(f.command({action:'restore',sourcePackageRevision:1,expectedDraftRevision:1}),e=>e.statusCode===403);
 assert.equal((await f.store.getBrandingDraft(operatorId)).revision,1);assert.equal((await f.store.getCurrentPackage(operatorId)).revision,1);
});

test('discard clears only the selected operators draft, preserves its published package and advances draft CAS',async()=>{
 const f=await fixture(),before=await f.api.readState({operatorId}),pack=await f.store.getCurrentPackage(operatorId);
 const otherId='other-draft';
 await f.store.createOperator({operatorId:otherId,actor:f.actor,slug:otherId,name:'Other'});
 await f.store.publishPackage({operatorId:otherId,actor:f.actor,lanes:pack.lanes,games:pack.games,tables:[],branding:f.initial});
 await f.store.saveBrandingDraft({operatorId:otherId,actor:f.actor,audit:f.audit,expectedDraftRevision:0,expectedPackageRevision:1,branding:{lane:f.lane.id,color:'#556677'}});
 const other=await f.store.getBrandingDraft(otherId);
 await f.command({action:'save-draft',branding:{lane:f.lane.id,color:'#334455'}});
 const discarded=await f.command({action:'discard-draft',expectedDraftRevision:1});
 assert.equal(discarded.draft,null);assert.equal(discarded.draftRevision,2);
 assert.equal(discarded.packageRevision,1);assert.deepEqual(discarded.branding,before.branding);assert.deepEqual(discarded.presentation,before.presentation);
 assert.deepEqual(await f.store.getCurrentPackage(operatorId),pack);
 assert.deepEqual(await f.store.getBrandingDraft(otherId),other);
 assert.equal((await f.api.readState({operatorId})).draft,null);
 const marker=await f.store.getBrandingDraft(operatorId);assert.equal(marker.action,'draft.restore');assert.equal(marker.sourcePackageRevision,1);
 for(const action of ['review','publish','discard-draft'])await assert.rejects(f.command({action,expectedDraftRevision:2,reviewToken:'obsolete'}),error=>error.statusCode===409);
 await assert.rejects(f.command({action:'save-draft',expectedDraftRevision:1,branding:{lane:f.lane.id,color:'#556677'}}),error=>error.statusCode===409);
 const next=await f.command({action:'save-draft',expectedDraftRevision:2,branding:{lane:f.lane.id,color:'#556677'}});
 assert.equal(next.draft.revision,3);assert.equal(next.draft.branding.color,'#556677');
});

test('discard remains cleared after a later publication while restoring an older identical version creates a real draft',async()=>{
 const f=await fixture();
 await f.command({action:'save-draft',branding:{lane:f.lane.id,color:'#334455'}});
 await f.command({action:'discard-draft',expectedDraftRevision:1});
 const pack=await f.store.getCurrentPackage(operatorId);
 await f.store.publishPackage({operatorId,actor:f.actor,lanes:pack.lanes,games:pack.games,tables:pack.tables,branding:pack.branding});
 const current=await f.api.readState({operatorId});assert.equal(current.packageRevision,2);assert.equal(current.draft,null);assert.equal(current.draftRevision,2);
 await assert.rejects(f.command({action:'restore',sourcePackageRevision:2,expectedPackageRevision:2,expectedDraftRevision:2}),error=>error.statusCode===409);
 assert.equal((await f.store.getBrandingDraft(operatorId)).revision,2);
 const restored=await f.command({action:'restore',sourcePackageRevision:1,expectedPackageRevision:2,expectedDraftRevision:2});
 assert.equal(restored.draft.revision,3);assert.equal(restored.draft.sourcePackageRevision,1);assert.deepEqual(restored.draft.branding,current.branding);
 assert.equal((await f.api.readState({operatorId})).draft.revision,3);assert.equal((await f.store.getCurrentPackage(operatorId)).revision,2);
});

test('discard rejects stale revisions and revoked permission, and concurrent confirmations commit once',async()=>{
 const f=await fixture();await f.command({action:'save-draft',branding:{lane:f.lane.id,color:'#334455'}});
 for(const patch of [{expectedDraftRevision:0},{expectedDraftRevision:1,expectedPackageRevision:2}])
  await assert.rejects(f.command({action:'discard-draft',...patch}),error=>error.statusCode===409);
 assert.equal((await f.store.getBrandingDraft(operatorId)).revision,1);
 const result=await Promise.allSettled([1,2].map(()=>f.command({action:'discard-draft',expectedDraftRevision:1})));
 assert.equal(result.filter(row=>row.status==='fulfilled').length,1);assert.equal(result.find(row=>row.status==='rejected').reason.statusCode,409);
 await f.command({action:'save-draft',expectedDraftRevision:2,branding:{lane:f.lane.id,color:'#334455'}});
 f.revoke();await assert.rejects(f.command({action:'discard-draft',expectedDraftRevision:3}),error=>error.statusCode===403);
 assert.equal((await f.store.getBrandingDraft(operatorId)).revision,3);assert.equal((await f.store.getCurrentPackage(operatorId)).revision,1);
});
test('draft marker failure rolls back package and publication audit while retaining the original draft',async()=>{
 const f=await fixture();await f.command({action:'save-draft',branding:{lane:f.lane.id,color:'#334455'}});
 const review=await f.command({action:'review',expectedDraftRevision:1}),before=structuredClone(f.pool.tables);
 f.pool.before('write-branding-draft',()=>{throw Object.assign(Error('fixture constraint'),{code:'23514'});});
 await assert.rejects(f.command({action:'publish',expectedDraftRevision:1,reviewToken:review.reviewToken}),e=>e.statusCode===422);
 assert.deepEqual(f.pool.tables,before);
});
test('shared room resolution strips foreign lane defaults, applies own override, and never exports frozen internals',()=>{
 const branding={lane:'first',table:'table-a',dealer:'astrid',color:'#112233',_scoutPresentation:{secret:'never'},logo:'legacy',
 roomOverrides:{second:{dealer:'nora',color:'#334455'}}};
 assert.deepEqual(resolveRoomBranding(branding,'second','other'),{lane:'other',dealer:'nora',color:'#334455'});
 assert.deepEqual(resolveRoomBranding(branding,'missing','other'),{lane:'other'});
 assert.equal(Object.hasOwn(publicEditableBranding(branding),'_scoutPresentation'),false);
 assert.equal(Object.hasOwn(publicEditableBranding(branding),'logo'),false);
});

test('explicit override changes remain reviewable at the same rendered value and require that field grant',async()=>{
 const f=await fixture();
 await f.command({action:'save-draft',branding:{lane:f.lane.id,color:'#112233',roomOverrides:{'room-a':{color:'#112233'}}}});
 const review=await f.command({action:'review',expectedDraftRevision:1});
 assert.deepEqual(review.affectedRooms,['room-a']);
 assert.deepEqual(review.changes,[{roomId:'room-a',key:'roomOverrides.color',before:null,after:'#112233'}]);
 await f.command({action:'publish',expectedDraftRevision:1,reviewToken:review.reviewToken});
 await f.command({action:'save-draft',expectedDraftRevision:2,expectedPackageRevision:2,branding:{lane:f.lane.id,color:'#112233'}});
 const reset=await f.command({action:'review',expectedDraftRevision:3,expectedPackageRevision:2});
 assert.deepEqual(reset.affectedRooms,['room-a']);
 assert.deepEqual(reset.changes,[{roomId:'room-a',key:'roomOverrides.color',before:'#112233',after:null}]);
 const locked=await fixture(['dealer']);
 await assert.rejects(locked.command({action:'save-draft',branding:{lane:locked.lane.id,color:'#112233',roomOverrides:{'room-a':{color:'#112233'}}}}),e=>e.statusCode===422);
 assert.equal(await locked.store.getBrandingDraft(operatorId),null);
});

function largeBranding(f){
 return {lane:f.lane.id,color:'#334455',roomOverrides:Object.fromEntries(f.tables.map(id=>[id,
  {table:f.assets[0].id,background:f.assets[1].id,dealer:'astrid',color:'#334455'}]))};
}
test('a tablePlayback clip cannot be saved as the company or a room table; ordinary tables still can',async()=>{
 const f=await fixture(['table','table.color','dealer'],{tableClip:true}),[base,clip]=f.assets;
 for(const branding of [{lane:f.lane.id,table:clip.id},{lane:f.lane.id,roomOverrides:{'room-a':{table:clip.id}}}])
  await assert.rejects(f.command({action:'save-draft',branding}),e=>e.statusCode===422,'clip rejected: '+JSON.stringify(branding));
 assert.equal(await f.store.getBrandingDraft(operatorId),null);
 const saved=await f.command({action:'save-draft',branding:{lane:f.lane.id,roomOverrides:{'room-a':{table:base.id}}}});
 assert.equal(saved.draft.branding.roomOverrides['room-a'].table,base.id);
});
test('large valid drafts save, update, review and publish with bounded verifiable journal references and atomic rollback',async()=>{
 const f=await fixture(['table','background','dealer','table.color'],{large:true}),branding=largeBranding(f);
 assert.ok(Buffer.byteLength(canonicalStudioJson(branding))>5000);
 assert.ok(Buffer.byteLength(canonicalStudioJson({...f.initial,...branding}))<8000);
 await f.command({action:'save-draft',branding});
 const changed=structuredClone(branding);changed.roomOverrides[f.tables[0]].color='#556677';
 await f.command({action:'save-draft',expectedDraftRevision:1,branding:changed});
 const saved=await f.store.getBrandingDraft(operatorId);assert.deepEqual(saved.branding,changed);
 const review=await f.command({action:'review',expectedDraftRevision:2});assert.equal(review.affectedRooms.length,28);
 const before=structuredClone(f.pool.tables);
 f.pool.before('write-branding-draft',()=>{throw Object.assign(Error('fixture constraint'),{code:'23514'});});
 await assert.rejects(f.command({action:'publish',expectedDraftRevision:2,reviewToken:review.reviewToken}),e=>e.statusCode===422);
 assert.deepEqual(f.pool.tables,before);
 const published=await f.command({action:'publish',expectedDraftRevision:2,reviewToken:review.reviewToken});
 assert.equal(published.packageRevision,2);assert.equal(published.draftRevision,3);assert.equal(published.draft,null);
 assert.deepEqual(publicEditableBranding((await f.store.getCurrentPackage(operatorId)).branding),changed);
 const journal=await f.store.listAuditEvents(operatorId),digest=value=>createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
 const update=journal.entries.find(row=>row.action==='draft.save'&&row.afterRevision===2);
 assert.equal(update.changes.before.draftRevision,1);assert.equal(update.changes.before.brandingSha256,digest(branding));
 assert.equal(update.changes.after.draftRevision,2);assert.equal(update.changes.after.brandingSha256,digest(changed));
 assert.equal(Object.hasOwn(update.changes.after,'branding'),false);
 const publication=journal.entries.find(row=>row.action==='draft.publish');
 assert.equal(publication.changes.before.draftRevision,2);assert.equal(publication.changes.after.draftRevision,3);
 assert.equal(publication.changes.after.basePackageRevision,1);assert.equal(publication.changes.after.publishedPackageRevision,2);
 assert.equal(publication.changes.after.brandingSha256,digest(changed));
 assert.ok(journal.entries.filter(row=>row.resourceType==='draft').every(row=>canonicalStudioJson(row.changes).length<=10000));
 const first=journal.entries.find(row=>row.action==='draft.save'&&row.afterRevision===1);
 assert.deepEqual(first.changes.after.branding,branding); // Smaller events retain a readable value snapshot.
});
test('save, review and publish reject an oversized merged package before mutation and retain the saved draft',async()=>{
 const f=await fixture(['table','background','dealer','table.color'],{large:true,metadataBytes:6100}),branding=largeBranding(f);
 assert.ok(Buffer.byteLength(canonicalStudioJson(f.initial))<8000);
 assert.ok(Buffer.byteLength(canonicalStudioJson(branding))<8000);
 assert.ok(Buffer.byteLength(canonicalStudioJson({...f.initial,...branding}))>8000);
 await f.command({action:'save-draft',branding:{lane:f.lane.id,color:'#334455'}});
 const before=structuredClone(f.pool.tables),input=structuredClone(branding);
 await assert.rejects(f.command({action:'save-draft',expectedDraftRevision:1,branding:input}),e=>e.statusCode===413);
 assert.deepEqual(input,branding);assert.deepEqual(f.pool.tables,before);
 // A pre-fix saved draft may fit alone but not beside its frozen N1 metadata.
 await f.store.saveBrandingDraft({operatorId,actor:f.actor,audit:f.audit,expectedDraftRevision:1,expectedPackageRevision:1,branding});
 const legacy=structuredClone(f.pool.tables);
 for(const action of ['review','publish']){
  await assert.rejects(f.command({action,expectedDraftRevision:2,reviewToken:'unused'}),e=>e.statusCode===413);
  assert.deepEqual(f.pool.tables,legacy);
 }
});

test('an N1 session on the Admin route may choose any allowed layer, a partner session keeps the company gate',async()=>{
 const f=await fixture(['table.color'],{large:true});
 const admin={...f.audit,accessClass:'internal-admin'};
 const branding={lane:f.lane.id,color:'#112233',roomOverrides:{[f.tables[0]]:{background:f.assets[1].id,table:f.assets[0].id}}};
 await assert.rejects(f.command({action:'save-draft',branding}),e=>e.statusCode===422,'the partner audit class is still gated by operatorAdjustable');
 assert.equal(await f.store.getBrandingDraft(operatorId),null);
 const saved=await f.command({action:'save-draft',audit:admin,branding});
 assert.equal(saved.draft.revision,1);
 const review=await f.command({action:'review',audit:admin,expectedDraftRevision:1});
 assert.deepEqual(review.affectedRooms,[f.tables[0]]);
 assert.deepEqual(review.changes.map(row=>[row.roomId,row.key,row.before,row.after]).sort(),[[f.tables[0],'background',null,f.assets[1].id],[f.tables[0],'table',null,f.assets[0].id]],'the review names the room and both unlocked layers');
 await assert.rejects(f.command({action:'publish',expectedDraftRevision:1,reviewToken:review.reviewToken}),e=>e.statusCode===422,'a partner cannot publish an Admin draft outside its gate');
 const published=await f.command({action:'publish',audit:admin,expectedDraftRevision:1,reviewToken:review.reviewToken});
 assert.equal(published.packageRevision,2);
 assert.deepEqual(resolveRoomBranding(published.branding,f.tables[0],f.lane.id),{lane:f.lane.id,color:'#112233',background:f.assets[1].id,table:f.assets[0].id});
 assert.deepEqual(resolveRoomBranding(published.branding,f.tables[1],f.lane.id),{lane:f.lane.id,color:'#112233'},'sibling rooms are unchanged');
 const foreign='33333333-3333-4333-8333-333333333333';
 for(const [outside,status] of [[{background:foreign},422],[{table:foreign},422],[{dealer:'unknown'},422],[{dealer:'nora'},409]])
  await assert.rejects(f.command({action:'save-draft',audit:admin,expectedDraftRevision:2,expectedPackageRevision:2,branding:{lane:f.lane.id,color:'#112233',roomOverrides:{[f.tables[0]]:outside}}}),e=>e.statusCode===status,'Admin stays within the composition allowlist and the room dealer choices');
 assert.equal((await f.store.getCurrentPackage(operatorId)).revision,2);
});
test('Admin layer choices never bypass a baked background, missing material or an unrelated company grant',async()=>{
 const f=await fixture(['dealer']);
 const admin={...f.audit,accessClass:'internal-admin'};
 for(const branding of [
  {lane:f.lane.id,color:'#112233',roomOverrides:{'room-a':{background:'22222222-2222-4222-8222-222222222222'}}}, // the fixture composition bakes its background
  {lane:f.lane.id,color:'#112233',roomOverrides:{'room-a':{table:'11111111-1111-4111-8111-111111111111'}}}, // no table material is allowed
  {lane:f.lane.id,color:'#334455'}, // table colour is not a layer; the company grant decides
 ])await assert.rejects(f.command({action:'save-draft',audit:admin,branding}),e=>e.statusCode===422);
 assert.equal(await f.store.getBrandingDraft(operatorId),null);
 assert.equal((await f.store.getCurrentPackage(operatorId)).revision,1);
});
