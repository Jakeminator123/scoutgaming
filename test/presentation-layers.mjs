import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {addDealer,createSeedProject,defaultPresentationLane,validateProject} from '../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath,buildPresentationPackage,validateLayerAsset} from '../packages/presentation/contracts/presentation-layers.mjs';
import {withPackagePresentation,readPackagePresentation,publicPackageBranding} from '../packages/presentation/server/presentation-package.mjs';
import {createPartnerBrandingApi as createApi} from '../apps/studio/lib/partner-branding-api.mjs';
import {createPublishedLayerAssets} from '../web/storage/published-layer-assets.mjs';
import {createGameEntrySelector} from '../packages/presentation/server/game-entry-selector.mjs';
import {resolvePlayerSelection} from '../packages/presentation/runtime/player-choices.mjs';
import {validateComposition,createLayerComposition} from '../packages/presentation/runtime/presentation-composition.mjs';

function asset(role,n) {const value={schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:role,sha256:'a'.repeat(64),size:128,contentType:'image/png',width:720,height:1280};return {...value,pathname:layerAssetPath(value)};}
function fixture() {
  let project=createSeedProject(); const lane=defaultPresentationLane('astrid');
  const background=asset('background',1),table=asset('table',2);
  lane.layers.background={enabled:true,mode:'image',default:background.id,allowed:[background.id]};
  lane.layers.table={enabled:true,default:table.id,allowed:[table.id],colors:['#123456']};
  lane.operatorAdjustable=['background','table','dealer','table.color','branding'];
  project.lanes=[lane];project.layerAssets=[background,table,asset('background',3)];
  const cloud=cloudPresentationFixture({project,lanes:[lane]});project=cloud.project;const presentation=cloud.presentation;
  return {project,presentation,pack:{operatorId:'north',revision:1,lanes:[lane.id],games:['blackjack'],tables:[],branding:withPackagePresentation({name:'North'},presentation)}};
}
test('publication freezes lane data and only referenced assets; subsequent Studio edits cannot change it',()=>{
  const {project,pack,presentation}=fixture();validateProject(project);
  project.lanes[0].layers.background.allowed=[];project.layerAssets[0].label='changed';
  assert.deepEqual(readPackagePresentation(pack),presentation);assert.equal(presentation.assets.length,2);
  assert.deepEqual(publicPackageBranding(pack.branding),{name:'North'});
});
test('an incomplete three-layer Nora can be published and entered through her own compatible lane', async () => {
  const project = addDealer(fixture().project, 'nora', 'Nora'), lane = project.lanes[0];
  lane.dealers = ['nora']; lane.layers.dealer.default = 'nora'; lane.layers.dealer.allowed = ['nora'];
  lane.composition = defaultCompositionSettings();
  for (const line of project.lines.filter(row => row.dealerId === 'nora' && row.eventId.startsWith('deal.'))) {
    assert.equal(line.variants[0].videoGenerationId, null);
  }
  assert.doesNotThrow(() => validateProject(project));
  const presentation = cloudPresentationFixture({project,lanes:[lane]}).presentation;
  const pack = { lanes: [lane.id], revision: 1, branding: withPackagePresentation({}, presentation) };
  assert.deepEqual(readPackagePresentation(pack), presentation);
  const administration = { gameLane: lane.id, gameLanes: [{ schemaVersion: 1, id: lane.id, label: 'Nora', renderer: 'portrait-video', dealer: 'nora', mediaCollection: 'nora-presentation' }] };
  const select = createGameEntrySelector({ policy: { readSaved: async () => ({ project, administration }), readGameConfiguration: async () => administration },
    packages: { resolve: async () => ({ operator: { id: 'north' }, package: pack }) } });
  const result = await select('?operator=north');
  assert.equal(result.status, 200); assert.equal(result.selection.dealer, 'nora'); assert.equal(result.selection.localDealer, 'nora');
  assert.equal(result.selection.composition.dealer.enabled, true); assert.equal(result.selection.composition.dealer.compatibility, 'per-clip');
});

test('wrong roles, unknown/default assets, duplicate IDs, paths and unsafe MIME are refused',()=>{
  const {project}=fixture();
  for(const mutate of [p=>p.lanes[0].layers.background.allowed.push(p.layerAssets[1].id),p=>p.lanes[0].layers.table.default='missing',p=>p.layerAssets.push(p.layerAssets[0])]){
    const draft=structuredClone(project);mutate(draft);assert.throws(()=>buildPresentationPackage(draft,['mobile-phone'],draft.layerAssets));
  }
  for(const changes of [{pathname:'../secret.env'},{contentType:'constructor'},{role:'dealer'},{size:134217729}])assert.throws(()=>validateLayerAsset({...project.layerAssets[0],...changes}));
});
test('corrupt, oversized or mismatched snapshots fail closed and cannot leak internal branding',()=>{
  const {pack}=fixture();
  for(const mutate of [p=>p.branding._scoutPresentation.sha256='b'.repeat(64),p=>p.branding._scoutPresentation.data='a'.repeat(6501),p=>p.lanes.push('other')]){const next=structuredClone(pack);mutate(next);assert.throws(()=>readPackagePresentation(next),error=>error.statusCode===503);}
});
test('partner can choose only within the frozen lane and cannot replace the server-authored snapshot',async()=>{
  const {pack,presentation}=fixture();presentation.lanes[0].composition=defaultCompositionSettings();pack.branding=withPackagePresentation(publicPackageBranding(pack.branding),presentation);let current=pack;
  const api=createPartnerBrandingApi({store:{getCurrentPackage:async()=>current,publishPackage:async value=>(current={...value,revision:current.revision+1})},readProject:async()=>{throw Error('mutable project must not be read');}});
  const view=await api.read({operatorId:'north'});assert.deepEqual(view.presentation,presentation);assert.equal(view.branding._scoutPresentation,undefined);
  for(const branding of [{background:asset('background',3).id},{table:presentation.assets[0].id},{_scoutPresentation:{}},{lane:'unknown'},{color:'#ffffff'}])await assert.rejects(api.write({operatorId:'north',actor:'actor',expectedRevision:1,branding}),error=>error.statusCode===422);
  const result=await api.write({operatorId:'north',actor:'actor',expectedRevision:1,branding:{table:presentation.assets[1].id,color:'#123456'}});
  assert.equal(result.packageRevision,2);assert.deepEqual(readPackagePresentation(current),presentation);
});

test('switching or republishing a lane removes incompatible old design choices without allowing new forbidden choices',async()=>{
  const {presentation,pack}=fixture();
  const second=defaultPresentationLane('astrid');second.id='vip-table';second.label='VIP';
  second.layers.background={enabled:true,mode:'baked',default:null,allowed:[]};
  second.layers.table={enabled:true,default:null,allowed:[],colors:['#654321']};
  second.operatorAdjustable=['dealer'];
  const expanded={...presentation,lanes:[...presentation.lanes,second]};
  let current={...pack,tables:['room-main','room-vip'],lanes:expanded.lanes.map(lane=>lane.id),branding:withPackagePresentation({name:'North',lane:'mobile-phone',background:presentation.assets[0].id,table:presentation.assets[1].id,color:'#123456'},expanded)};
  const api=createPartnerBrandingApi({store:{getCurrentPackage:async()=>current,publishPackage:async value=>(current={...value,revision:current.revision+1})},readProject:async()=>{throw Error('not the mutable project');}});
  await assert.rejects(api.write({operatorId:'north',actor:'actor',expectedRevision:1,branding:{lane:'vip-table',background:presentation.assets[0].id}}),error=>error.statusCode===422);
  const result=await api.write({operatorId:'north',actor:'actor',expectedRevision:1,branding:{lane:'vip-table',dealer:'astrid'}});
  assert.deepEqual(result.branding,{name:'North',lane:'vip-table',dealer:'astrid'});
  const published=withPackagePresentation({name:'North',lane:'gone',background:'unknown'},presentation);
  assert.deepEqual(publicPackageBranding(published),{name:'North'});
});
test('published private asset access is limited to that operator; a library-only asset never resolves',async()=>{
  const {pack,presentation}=fixture();let reads=0;
  const handler=createPublishedLayerAssets({packages:{resolve:async slug=>slug==='north'?{operator:{id:'north'},package:pack}:null},privateMedia:async()=>{reads++;return new Response('verified');}});
  assert.equal((await handler(new Request(`https://example.com/api/presentation/layers/north/${presentation.assets[0].id}`))).status,200);
  for(const slug of ['south','north'])assert.equal((await handler(new Request(`https://example.com/api/presentation/layers/${slug}/${asset('background',3).id}`))).status,404);
  assert.equal(reads,1);
});
test('game entry uses the published snapshot after Studio is edited and keeps authority separate',async()=>{
  const {pack,project,presentation}=fixture();project.lanes[0].layers.table.colors=['#ffffff'];
  const select=createGameEntrySelector({policy:{readSaved:async()=>({project,administration:{gameLane:'mobile-phone',gameLanes:[{schemaVersion:1,id:'mobile-phone',label:'Fixture portrait',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}]}}),readGameConfiguration:async()=>({})},packages:{resolve:async()=>({operator:{id:'north'},package:pack})}});
  const {selection}=await select('?operator=north');
  assert.deepEqual(selection.choices.tableColors,['#123456']);assert.equal(selection.branding._scoutPresentation,undefined);
  assert.equal(selection.composition.assets.length,2);assert.deepEqual(Object.keys(selection.composition).sort(),['assets','background','dealer','schemaVersion','table']);
  assert.doesNotThrow(()=>validateComposition(selection.composition));
  const chosen=resolvePlayerSelection({choices:selection.choices,composition:selection.composition,currentDealer:'astrid',stored:{tableAsset:presentation.assets[1].id,background:presentation.assets[0].id}});
  assert.equal(chosen.backgroundDisabled,false);assert.equal(chosen.applyBackground,true);
});

test('legacy full-frame flags cannot suppress independent background and table sources',()=>{
  const {presentation}=fixture(),lane=presentation.lanes[0];
  const descriptor={schemaVersion:1,
    dealer:{enabled:true,compatibility:'full-frame'},
    background:{enabled:true,mode:'image',default:lane.layers.background.default,allowed:lane.layers.background.allowed},
    table:{enabled:true,default:lane.layers.table.default,allowed:lane.layers.table.allowed},
    assets:presentation.assets.map(({id,role,label,contentType})=>({id,role,label,contentType,src:`/api/presentation/layers/north/${id}`}))};
  const mounted=new Set(),host={dataset:{},append:node=>mounted.add(node)};
  const document={documentElement:{dataset:{}},querySelector:()=>host,
    createElement:tag=>({tagName:tag.toUpperCase(),dataset:{},setAttribute(){},remove(){mounted.delete(this);}})};
  const composition=createLayerComposition(document,descriptor);
  assert.equal(mounted.size,2,'legacy compatibility cannot bypass the mandatory compositor');
  composition.replace({...descriptor,dealer:{enabled:false,compatibility:'full-frame'}});
  assert.deepEqual([...mounted].map(node=>node.src),descriptor.assets.map(asset=>asset.src));
  assert.equal(host.dataset.dealerLayerEnabled,'false');
  composition.setBackground(asset('background',3).id);
  assert.equal(mounted.size,2,'library-only references cannot be selected');
  composition.replace(descriptor);
  assert.equal(mounted.size,2,'turning the dealer back on retains its authorized plane sources');
});

function createPartnerBrandingApi(options) {
  const readAdministration=async()=>{
    const pack=await options.store.getCurrentPackage('north');
    return {revision:'admin-fixture',value:{gameLane:'mobile-phone',gameLanes:[{schemaVersion:1,id:'mobile-phone',label:'Astrid',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}],
      rooms:pack.tables.map((id,index)=>({schemaVersion:2,id,name:id,operatorId:'north',gameLaneId:'mobile-phone',presentationLaneId:pack.lanes[index%pack.lanes.length],state:'live'}))}};
  };
  return createApi({...options,readAdministration,withWriteContext:work=>work({store:options.store,readAdministration,reauthorize:async()=>true})});
}
