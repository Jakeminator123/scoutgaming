import * as savedGameDocumentContract from '../../packages/studio-registry/server/document-contract.mjs';

import test from 'node:test';
import assert from 'node:assert/strict';
import {combinedPool} from './fixtures/lifecycle-pool.mjs';
import {cloudPresentationFixture} from './fixtures/cloud-presentation.mjs';
import {defaultPresentationLane} from '../../packages/presentation/contracts/studio-model.mjs';
import {dealerArchiveCompositionIds,readDealerArchiveImpact,applyDealerArchiveImpact,withoutPresentationLanes} from '../lib/dealer-archive-impact.mjs';
import {createStudioRepository} from '../../packages/studio-registry/server/document-repository.mjs';
import {createOperatorStore} from '../../packages/operators/server/operator-store.mjs';
import {readPackagePresentation,withPackagePresentation} from '../../packages/presentation/server/presentation-package.mjs';
import {readOperatorLifecycle} from '../../packages/operators/server/operator-lifecycle.mjs';
import { createSavedGamePolicy } from '../../packages/presentation/server/saved-game-policy.mjs';

const { validateStudioGameAdministration } = createSavedGamePolicy({ documentContract: savedGameDocumentContract });

const scope={environment:'dealer-archive-impact',workspaceId:'isolated'};
const lane=(dealerId)=>({...defaultPresentationLane(dealerId),id:dealerId+'-room',label:dealerId+' scene'});
const adapter=dealer=>({schemaVersion:1,id:'room-lane-'+dealer,label:dealer,renderer:'portrait-video',dealer,mediaCollection:dealer+'-presentation'});
const room=dealer=>({schemaVersion:2,id:dealer+'-table',name:dealer+' table',operatorId:'north',presentationLaneId:dealer+'-room',gameLaneId:'room-lane-'+dealer,state:'live'});
async function fixture({labelCollision=false}={}){
  const pool=combinedPool(scope),repository=createStudioRepository({pool,scope});
  const cloud=cloudPresentationFixture({lanes:[lane('paow'),{...lane('linnea'),...(labelCollision?{label:'paow'}:{})}]});
  const project=await repository.initializeDocument('project',{value:cloud.project,actor:'fixture'});
  await repository.initializeDocument('administration',{value:{rooms:[room('paow'),room('linnea')],gameLanes:[adapter('paow'),adapter('linnea')],gameLane:'room-lane-paow'},actor:'fixture'});
  for(const {revision,...record} of cloud.mediaRows)pool.setMedia(record,revision);
  const stored=work=>repository.transaction(()=>repository.withTransactionClient(async client=>work(await createOperatorStore({sql:client,scope,transaction:fn=>repository.withTransactionClient(fn)}))));
  await stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:null,lanes:['paow-room','linnea-room'],games:['blackjack'],tables:['paow-table','linnea-table'],branding:withPackagePresentation({dealer:'paow',roomOverrides:{'paow-table':{dealer:'paow'},'linnea-table':{dealer:'linnea'}}},cloud.presentation)}));
  const unrelated=withoutPresentationLanes(cloud.presentation,['paow-room']);
  await stored(store=>store.publishPackage({actor:'fixture',operatorId:'other',expectedRevision:null,lanes:['linnea-room'],games:['blackjack'],tables:[],branding:withPackagePresentation(labelCollision?{label:'paow'}:{},unrelated)}));
  const input={repository,dealerId:'paow',expectedRevision:project.revision};
  return {pool,repository,cloud,project,stored,input,read:()=>readDealerArchiveImpact(input),pack:id=>stored(store=>store.getCurrentPackage(id))};
}

test('impact is a read-only current-state plan, with one token covering all affected domains',async()=>{
  const f=await fixture(),before=f.pool.snapshot(),plan=await f.read();
  assert.deepEqual(f.pool.snapshot(),before);
  assert.match(plan.impact.token,/^[a-f0-9]{64}$/);
  assert.deepEqual(plan.impact.compositions,[{id:'paow-room',label:'paow scene'}]);
  assert.deepEqual(plan.impact.rooms,[{id:'paow-table',name:'paow table',operatorId:'north'}]);
  assert.deepEqual(plan.impact.operators,[{id:'north',name:'North'}]);
  assert.equal(plan.impact.mediaCount,1);
  assert.equal((await f.read()).impact.token,plan.impact.token);
});

test('archive detaches active rooms and only affected publication, without changing immutable history or choosing a new default',async()=>{
  const f=await fixture(),plan=await f.read(),before=f.pool.snapshot(),other=await f.pack('other');
  await applyDealerArchiveImpact({...f.input,impactToken:plan.impact.token,actor:'Admin'});
  const admin=(await f.repository.readDocument('administration')).value,pack=await f.pack('north');
  assert.deepEqual(admin.rooms,[room('linnea')]);
  assert.deepEqual(admin.gameLanes,[adapter('linnea')]);assert.equal(admin.gameLane,null);
  assert.deepEqual(pack.lanes,['linnea-room']);assert.deepEqual(pack.tables,['linnea-table']);
  const retained=readPackagePresentation(pack);
  assert.deepEqual(retained.registeredDealers,f.cloud.presentation.registeredDealers.filter(row=>row.id==='linnea'));
  assert.deepEqual(retained.playback.media,f.cloud.presentation.playback.media.filter(row=>row.classification.dealerId==='linnea'));
  assert.equal(pack.branding.dealer,undefined);
  assert.equal(pack.branding.roomOverrides['paow-table'],undefined);
  assert.deepEqual(pack.branding.roomOverrides['linnea-table'],{dealer:'linnea'});
  assert.equal(readOperatorLifecycle(pack.branding).rooms[0].room.id,'paow-table');
  assert.deepEqual((await f.pack('other')),other);
  assert.deepEqual(f.pool.snapshot().packages.slice(0,2),before.packages);
});

test('archive removes only wholly assigned legacy tiers from modern or empty room administration',async()=>{
  const legacyRoom={id:'legacy-table',name:'Legacy table',scene:'studio',felt:'green',dealer:'mei',state:'preview'};
  for(const {name,rooms,tiers,removed} of [
    {name:'modern rooms',rooms:[room('linnea')],tiers:{classic:'astrid',high:'astrid',vip:'astrid'},removed:true},
    {name:'empty rooms',rooms:[],tiers:{classic:'astrid',high:'astrid',vip:'astrid'},removed:true},
    {name:'mixed tiers',rooms:[room('linnea')],tiers:{classic:'astrid',high:'mei',vip:'astrid'},removed:false},
    {name:'legacy room',rooms:[room('linnea'),legacyRoom],tiers:{classic:'astrid',high:'astrid',vip:'astrid'},removed:false},
  ]){
    const pool=combinedPool(scope),repository=createStudioRepository({pool,scope});
    const cloud=cloudPresentationFixture({lanes:[lane('astrid'),lane('linnea')]});
    const project=await repository.initializeDocument('project',{value:cloud.project,actor:'fixture'});
    const original={rooms,tiers,gameLanes:[adapter('linnea')],gameLane:'room-lane-linnea',
      pitboss:{payout10x:true,streak5:false,randomWalkMin:30},tournaments:[],voiceReview:{astrid:{}}};
    validateStudioGameAdministration(original);
    const saved=await repository.initializeDocument('administration',{value:original,actor:'fixture'});
    const input={repository,dealerId:'astrid',expectedRevision:project.revision};
    const before=pool.snapshot(),plan=await readDealerArchiveImpact(input),expected=structuredClone(original);
    if(removed)delete expected.tiers;
    assert.deepEqual(pool.snapshot(),before,name);
    assert.deepEqual(validateStudioGameAdministration(plan.administration),expected,name);
    assert.deepEqual(plan.packageChanges,[],name);
    assert.deepEqual(plan.impact.rooms,[],name);
    await applyDealerArchiveImpact({...input,impactToken:plan.impact.token,actor:'Admin'});
    const after=await repository.readDocument('administration');
    assert.deepEqual(after.value,expected,name);
    assert.equal(after.revision!==saved.revision,removed,name);
    assert.deepEqual(pool.snapshot().packages,before.packages,name);
    const history=pool.snapshot().history.filter(row=>row[2]==='administration');
    assert.equal(history.length,removed?1:0,name);
    if(removed)assert.deepEqual(JSON.parse(history[0][4]),original,name);
  }
});

test('stale admin, package or media revision rejects the entire confirmation without partial writes',async()=>{
  for(const domain of ['administration','package','media']){
    const f=await fixture(),plan=await f.read();
    if(domain==='administration'){
      const doc=await f.repository.readDocument('administration');
      await f.repository.saveDocument('administration',{value:doc.value,expectedRevision:doc.revision,actor:'Other'});
    }else if(domain==='package'){
      const pack=await f.pack('north');await f.stored(store=>store.publishPackage({actor:'Other',operatorId:'north',expectedRevision:pack.revision,lanes:pack.lanes,games:pack.games,tables:pack.tables,branding:pack.branding}));
    }else {const {revision,...record}=f.cloud.mediaRows[0];f.pool.setMedia(record,'media-changed');}
    const before=f.pool.snapshot();
    await assert.rejects(applyDealerArchiveImpact({...f.input,impactToken:plan.impact.token,actor:'Admin'}),{code:'studio_conflict'});
    assert.deepEqual(f.pool.snapshot(),before,domain);
  }
});

test('package and audit failures roll back administration and publication together',async()=>{
  for(const marker of ['publish-package','audit-write']){
    const f=await fixture(),plan=await f.read(),before=f.pool.snapshot();f.pool.fail(marker);
    await assert.rejects(applyDealerArchiveImpact({...f.input,impactToken:plan.impact.token,actor:'Admin'}));
    assert.deepEqual(f.pool.snapshot(),before);
  }
});

test('removing a final frozen scene leaves an empty unpublished package and an archived room',async()=>{
  const f=await fixture(),current=await f.pack('north');
  await f.stored(store=>store.publishPackage({actor:'fixture',operatorId:'north',expectedRevision:current.revision,lanes:['paow-room'],games:['blackjack'],tables:['paow-table'],branding:withPackagePresentation({},withoutPresentationLanes(f.cloud.presentation,['linnea-room']))}));
  const plan=await f.read();await applyDealerArchiveImpact({...f.input,impactToken:plan.impact.token,actor:'Admin'});
  const pack=await f.pack('north');assert.deepEqual(pack.lanes,[]);assert.deepEqual(pack.tables,[]);assert.equal(readPackagePresentation(pack),null);
  assert.equal(readOperatorLifecycle(pack.branding).rooms[0].room.id,'paow-table');
});

test('historical publication does not block a new archive plan',async()=>{
  const f=await fixture(),plan=await f.read();await applyDealerArchiveImpact({...f.input,impactToken:plan.impact.token,actor:'Admin'});
  const again=await f.read();assert.deepEqual(again.packageChanges,[]);assert.deepEqual(again.impact.rooms,[]);
  assert.ok(f.pool.snapshot().packages.some(row=>JSON.parse(row.lanes).includes('paow-room')));
});

test('two confirmations have one winner, and stale impact cannot replay writes',async()=>{
  const f=await fixture(),plan=await f.read(),input={...f.input,impactToken:plan.impact.token,actor:'Admin'};
  const results=await Promise.allSettled([applyDealerArchiveImpact(input),applyDealerArchiveImpact(input)]);
  assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(results.find(row=>row.status==='rejected').reason.code,'studio_conflict');
  assert.equal((await f.pack('north')).revision,2);
});

test('impact also names a frozen scene whose draft was already removed',async()=>{
  const f=await fixture();
  const project=structuredClone(f.project.value);project.lanes=project.lanes.filter(lane=>lane.id!=='paow-room');
  const saved=await f.repository.saveDocument('project',{value:project,expectedRevision:f.project.revision,actor:'Admin'});
  const plan=await readDealerArchiveImpact({...f.input,expectedRevision:saved.revision});
  assert.deepEqual(plan.impact.compositions,[{id:'paow-room',label:'paow scene'}]);
  assert.equal(plan.impact.rooms.length,1);
});


test('dealer references are structural, even when IDs and labels equal another dealer or media ID',()=>{
  const own={...lane('paow'),id:'linnea',label:'linnea'};
  const textOnly={...lane('linnea'),id:'paow',label:'owned-video'};
  const mediaUse={...lane('linnea'),id:'shared-idle',idle:{variants:['owned-video']}};
  const records=[{id:'owned-video',classification:{dealerId:'paow'}}];
  assert.deepEqual(dealerArchiveCompositionIds({lanes:[own,textOnly,mediaUse]},'paow',records),['linnea','shared-idle']);
  assert.deepEqual(dealerArchiveCompositionIds({lanes:[own]},'linnea',records),[]);
});

test('archiving preserves unrelated frozen scenes and branding whose labels equal the dealer ID',async()=>{
  const f=await fixture({labelCollision:true}),other=await f.pack('other');
  const plan=await f.read();
  assert.deepEqual(plan.impact.compositions.map(row=>row.id),['paow-room']);
  assert.deepEqual(plan.impact.operators.map(row=>row.id),['north']);
  await applyDealerArchiveImpact({...f.input,impactToken:plan.impact.token,actor:'Admin'});
  assert.deepEqual(await f.pack('other'),other);
  const kept=readPackagePresentation(await f.pack('north'));
  assert.equal(kept.lanes[0].label,'paow');
  assert.equal(kept.lanes[0].id,'linnea-room');
});
