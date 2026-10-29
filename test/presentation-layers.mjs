import {cloudPresentationFixture} from '../apps/studio/test/fixtures/cloud-presentation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {createBlobMediaStore} from '../packages/studio-registry/server/blob-reader.mjs';
import {platformBackendHeaders} from '../packages/navigation/server/platform-routing.mjs';
import {addDealer,createSeedProject,defaultPresentationLane,validateProject} from '../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath,buildPresentationPackage,validateLayerAsset} from '../packages/presentation/contracts/presentation-layers.mjs';
import {withPackagePresentation,readPackagePresentation,publicPackageBranding,PARTNER_ASSIGNMENT_KEY} from '../packages/presentation/server/presentation-package.mjs';
import {createPartnerBrandingApi as createApi} from '../apps/studio/lib/partner-branding-api.mjs';
import {publishThroughDraft,withBrandingDrafts} from '../apps/studio/test/fixtures/branding-draft-store.mjs';
import {createPublishedLayerAssets} from '../services/game/storage/published-layer-assets.mjs';
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
test('Admins tilldelning följer med paketet men aldrig i den publika brandingen',()=>{
  const {presentation}=fixture(),assignment={allow:{dealer:false,pause:true},limitPresets:['high'],languages:['sv']};
  const branding=withPackagePresentation({name:'North',[PARTNER_ASSIGNMENT_KEY]:assignment},presentation);
  assert.deepEqual(branding[PARTNER_ASSIGNMENT_KEY],assignment);
  assert.deepEqual(publicPackageBranding(branding),{name:'North'});
});
// Dealern (roomOverrides) provas på PostgreSQL i apps/studio/test/partner-table-actions.test.mjs.
test('Admins allow stänger bordsgrafik och bakgrund även i utseendets utkast för partnern, inte för Admin',async()=>{
  const {pack,presentation}=fixture();presentation.lanes[0].composition=defaultCompositionSettings();
  const choices={tableAsset:{table:presentation.assets[1].id,color:'#123456'},background:{background:presentation.assets[0].id}};
  for(const [key,branding] of Object.entries(choices)){
    const api=allow=>{
      const current={...pack,branding:withPackagePresentation({...publicPackageBranding(pack.branding),[PARTNER_ASSIGNMENT_KEY]:{allow}},presentation)};
      const store=withBrandingDrafts({getCurrentPackage:async()=>current,publishPackage:async()=>{throw Error('no publication here');}});
      return {store,api:createPartnerBrandingApi({store,readProject:async()=>{throw Error('not the mutable project');}})};
    };
    const command=(target,extra={})=>target.api.command({operatorId:'north',actor:'actor',action:'save-draft',expectedDraftRevision:0,expectedPackageRevision:1,branding,...extra});
    // Utan Admins allow-flagga följer valet miljön och sparas.
    const open=api({});await command(open);assert.equal((await open.store.getBrandingDraft('north')).revision,1,key);
    // Med flaggan false nekas samma val, och inget utkast sparas.
    const closed=api({[key]:false});
    await assert.rejects(command(closed),error=>error.statusCode===422,key);
    assert.equal(await closed.store.getBrandingDraft('north'),null,`${key}: inget sparat`);
    // Admin (N1) påverkas inte av bolagets allow.
    await command(closed,{audit:{actorId:'n1-admin',accessClass:'internal-admin',requestId:'00000000-0000-4000-8000-000000000001'}});
    assert.equal((await closed.store.getBrandingDraft('north')).revision,1,`${key}: Admin`);
  }
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
  const api=createPartnerBrandingApi({store:withBrandingDrafts({getCurrentPackage:async()=>current,publishPackage:async value=>(current={...value,revision:current.revision+1})}),readProject:async()=>{throw Error('mutable project must not be read');}});
  const view=await api.readState({operatorId:'north'});assert.deepEqual(view.presentation,presentation);assert.equal(view.branding._scoutPresentation,undefined);
  for(const branding of [{background:asset('background',3).id},{table:presentation.assets[0].id},{_scoutPresentation:{}},{lane:'unknown'},{color:'#ffffff'}])
    await assert.rejects(api.command({operatorId:'north',actor:'actor',action:'save-draft',expectedDraftRevision:0,expectedPackageRevision:1,branding}),error=>error.statusCode===422);
  const result=await publishThroughDraft(api,{operatorId:'north',actor:'actor',expectedPackageRevision:1,branding:{table:presentation.assets[1].id,color:'#123456'}});
  assert.equal(result.packageRevision,2);assert.deepEqual(readPackagePresentation(current),presentation);
});

test('switching or republishing a lane removes incompatible old design choices without allowing new forbidden choices',async()=>{
  const {presentation,pack}=fixture();
  const second=defaultPresentationLane('astrid');second.id='vip-table';second.label='VIP';
  second.layers.background={enabled:true,mode:'baked',default:null,allowed:[]};
  second.layers.table={enabled:true,default:null,allowed:[],colors:['#654321']};
  second.operatorAdjustable=['dealer'];
  // The old lane has separate layers, so the company may clear its own choices there when it switches;
  // the draft is checked per room, and a room may only change what its template lets the company change.
  const first={...presentation.lanes[0],composition:defaultCompositionSettings()};
  const expanded={...presentation,lanes:[first,second]};
  // Baked variant: the old lane keeps its baked composition, so its room cannot drop the company's old
  // choices and the same switch is refused before anything is drafted or published.
  const baked={...presentation,lanes:[presentation.lanes[0],second]};let bakedWrites=0;
  const bakedPack={...pack,tables:['room-main','room-vip'],lanes:baked.lanes.map(lane=>lane.id),branding:withPackagePresentation({name:'North',lane:'mobile-phone',background:presentation.assets[0].id,table:presentation.assets[1].id,color:'#123456'},baked)};
  const bakedApi=createPartnerBrandingApi({store:withBrandingDrafts({getCurrentPackage:async()=>bakedPack,publishPackage:async()=>{bakedWrites++;return bakedPack;}}),readProject:async()=>{throw Error('not the mutable project');}});
  await assert.rejects(publishThroughDraft(bakedApi,{operatorId:'north',actor:'actor',expectedPackageRevision:1,branding:{lane:'vip-table',dealer:'astrid'}}),error=>error.statusCode===422);
  assert.equal(bakedWrites,0);
  let current={...pack,tables:['room-main','room-vip'],lanes:expanded.lanes.map(lane=>lane.id),branding:withPackagePresentation({name:'North',lane:'mobile-phone',background:presentation.assets[0].id,table:presentation.assets[1].id,color:'#123456'},expanded)};
  const api=createPartnerBrandingApi({store:withBrandingDrafts({getCurrentPackage:async()=>current,publishPackage:async value=>(current={...value,revision:current.revision+1})}),readProject:async()=>{throw Error('not the mutable project');}});
  await assert.rejects(api.command({operatorId:'north',actor:'actor',action:'save-draft',expectedDraftRevision:0,expectedPackageRevision:1,branding:{lane:'vip-table',background:presentation.assets[0].id}}),error=>error.statusCode===422);
  const result=await publishThroughDraft(api,{operatorId:'north',actor:'actor',expectedPackageRevision:1,branding:{lane:'vip-table',dealer:'astrid'}});
  assert.deepEqual(result.branding,{lane:'vip-table',dealer:'astrid'});
  assert.deepEqual(publicPackageBranding(current.branding),{name:'North',lane:'vip-table',dealer:'astrid'});
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

test('published bytes revalidate without retransmission; withdrawn assets cannot reuse a cached ETag',async t=>{
  const {pack,presentation}=fixture(),bytes=Buffer.alloc(64*1024,42);
  const asset=presentation.assets[0];Object.assign(asset,{sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length});
  asset.pathname=layerAssetPath(asset);pack.branding=withPackagePresentation({},presentation);
  const cacheDir=await mkdtemp(join(tmpdir(),'croupier-media-revalidation-'));
  t.after(()=>{assert.equal(dirname(resolve(cacheDir)),resolve(tmpdir()));assert.match(basename(cacheDir),/^croupier-media-revalidation-/);return rm(cacheDir,{recursive:true,force:true});});
  let active=true,resolves=0,downloads=0,reads=0;
  const store=createBlobMediaStore({defaultCacheDir:cacheDir,clientFactory:async()=>({get:async pathname=>{
    downloads++;return {statusCode:200,stream:new Response(bytes).body,
      blob:{pathname,url:`https://fixture.private.blob.vercel-storage.com/${pathname}`,contentType:asset.contentType,size:bytes.length}};
  }})});
  const handle=createPublishedLayerAssets({packages:{resolve:async()=>{resolves++;return active?{operator:{id:'north'},package:pack}:null;}},
    privateMedia:(record,request)=>{reads++;return store.getPrivateMedia(record,request,{env:{CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'fixture-private-only'}});}});
  const url=`https://example.test/api/presentation/layers/north/${asset.id}`;
  const request=(headers={},method='GET')=>handle(new Request(url,{headers,method}));
  const first=await request();assert.equal(first.status,200);assert.deepEqual(Buffer.from(await first.arrayBuffer()),bytes);
  assert.equal(first.headers.get('cache-control'),'private, no-cache, must-revalidate');const etag=first.headers.get('etag');
  for(let i=0;i<3;i++){
    const cached=await request({'if-none-match':etag});assert.equal(cached.status,304);assert.equal(cached.body,null);
    assert.equal(cached.headers.get('cache-control'),'private, no-cache, must-revalidate');
  }
  const range=await request({range:'bytes=10-13','if-range':etag});assert.equal(range.status,206);
  assert.equal(range.headers.get('content-range'),`bytes 10-13/${bytes.length}`);assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(10,14));
  const changed=await request({range:'bytes=10-13','if-range':'"old-version"'});assert.equal(changed.status,200);
  assert.deepEqual(Buffer.from(await changed.arrayBuffer()),bytes);
  const head=await request({},'HEAD');assert.equal(head.status,200);assert.equal(head.body,null);assert.equal(head.headers.get('content-length'),String(bytes.length));
  assert.equal(resolves,7);assert.equal(downloads,1);assert.equal(reads,7);
  const denied=await request({'sec-fetch-site':'cross-site','if-none-match':etag});assert.equal(denied.status,403);
  assert.equal(denied.headers.get('cache-control'),'private, no-store');
  active=false;
  const withdrawn=await request({'if-none-match':etag,range:'bytes=0-'});assert.equal(withdrawn.status,404);
  assert.equal(withdrawn.headers.get('cache-control'),'private, no-store');assert.equal(reads,8);assert.equal(resolves,9);
});

test('unverified responses remain uncacheable and frontend ingress preserves byte validators',async()=>{
  const {pack,presentation}=fixture();
  for(const [status,headers] of [[200,{}],[200,{ETag:'"wrong"'}],[503,{ETag:'"sha256-'+presentation.assets[0].sha256+'"'}]]) {
    const handle=createPublishedLayerAssets({packages:{resolve:async()=>({operator:{id:'north'},package:pack})},privateMedia:async()=>new Response('unavailable',{status,headers})});
    const response=await handle(new Request(`https://example.test/api/presentation/layers/north/${presentation.assets[0].id}`));
    assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');
  }
  const input=new Headers({'if-none-match':'"version"','if-range':'"version"',range:'bytes=10-13',cookie:'session=fixture'});
  const forwarded=platformBackendHeaders(input,{secret:'fixture-server-only',publicOrigin:'https://example.test'});
  for(const name of ['if-none-match','if-range','range','cookie'])assert.equal(forwarded.get(name),input.get(name));
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

test('composition accepts exact room-scoped layer routes without widening the existing URL contracts',()=>{
  const background=asset('background',1),table=asset('table',2);
  const descriptor={schemaVersion:1,dealer:{enabled:true,compatibility:'per-clip'},
    background:{enabled:true,mode:'image',default:background.id,allowed:[background.id]},table:{enabled:true,default:table.id,allowed:[table.id]},
    assets:[background,table].map(({id,role,label,contentType})=>({id,role,label,contentType,src:`/api/presentation/room-layers/north/room-a/12/${id}`}))};
  assert.deepEqual(validateComposition(descriptor),descriptor);
  const mutate=src=>({...descriptor,assets:[{...descriptor.assets[0],src},descriptor.assets[1]]});
  for(const src of [
    `/api/presentation/layers/north/${background.id}`,
    `/api/studio-preview/00000000-0000-4000-8000-000000000009/layers/${background.id}`,
  ])assert.doesNotThrow(()=>validateComposition(mutate(src)));
  for(const src of [
    `/api/presentation/room-layers/North/room-a/12/${background.id}`,
    `/api/presentation/room-layers/north/room%2Fa/12/${background.id}`,
    `/api/presentation/room-layers/north/room-a/0/${background.id}`,
    `/api/presentation/room-layers/north/room-a/01/${background.id}`,
    `/api/presentation/room-layers/north/room-a/9007199254740992/${background.id}`,
    `/api/presentation/room-layers/north/room-a/12/${table.id}`,
    `/api/presentation/room-layers/north/room-a/12/${background.id}?packageRevision=99`,
    `/api/presentation/room-layers/north/room-a/12/${background.id}#old`,
    `https://other.invalid/api/presentation/room-layers/north/room-a/12/${background.id}`,
  ])assert.throws(()=>validateComposition(mutate(src)));
});

test('replaced and closed composition loads release their own listeners, timers and video sources',async t=>{
  const timers=new Map();let timerId=0,compositors=0;
  t.mock.method(globalThis,'setTimeout',(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;});
  t.mock.method(globalThis,'clearTimeout',id=>timers.delete(id));
  const mounted=new Set(),nodes=[];
  class Node extends EventTarget{
    constructor(tag){super();this.tagName=tag.toUpperCase();this.dataset={};this.style={};this.listeners=new Set();this.src='';this.loads=0;nodes.push(this);}
    addEventListener(type,listener,options){this.listeners.add(listener);super.addEventListener(type,listener,options);}
    removeEventListener(type,listener,options){this.listeners.delete(listener);super.removeEventListener(type,listener,options);}
    setAttribute(){}removeAttribute(name){if(name==='src')this.src='';}pause(){}load(){this.loads++;}remove(){mounted.delete(this);}
  }
  const background=asset('background',1),table=asset('table',2);
  const descriptor={schemaVersion:1,dealer:{enabled:true,compatibility:'per-clip'},
    background:{enabled:true,mode:'video',default:background.id,allowed:[background.id]},table:{enabled:true,default:table.id,allowed:[table.id]},
    assets:[background,table].map(({id,role,label})=>({id,role,label,contentType:'video/mp4',src:`/api/presentation/room-layers/north/room-a/1/${id}`}))};
  const host={dataset:{},append:node=>mounted.add(node)},document={documentElement:{dataset:{}},querySelector:()=>host,createElement:tag=>new Node(tag)};
  // A known fast link loads the background film at once (a slow link defers it; see the K04 layer proofs below).
  const composition=createLayerComposition(document,descriptor,{connection:{downlink:10,effectiveType:'4g',saveData:false},
    loadRuntime:async()=>({Compositor:class{constructor(){compositors++;}}})});
  assert.equal(timers.size,2);const old=[...mounted];
  const preparing=composition.prepareClip({mode:'alpha'});await Promise.resolve();await Promise.resolve();
  // A replaced preparation reports that it is no longer current; a layer never fails the film.
  composition.replace(descriptor);assert.equal(await preparing,false);
  assert.equal(timers.size,2,'only the replacement owns load deadlines');
  for(const node of old){assert.equal(node.listeners.size,0);assert.equal(node.src,'');assert.equal(node.loads,1);node.dispatchEvent(new Event('loadeddata'));}
  assert.equal(compositors,0);const current=[...mounted];composition.close();composition.close();
  assert.equal(timers.size,0);assert.equal(mounted.size,0);
  for(const node of current){assert.equal(node.listeners.size,0);assert.equal(node.src,'');assert.equal(node.loads,1);node.dispatchEvent(new Event('loadeddata'));}
  composition.replace(descriptor);assert.equal(mounted.size,0);assert.equal(compositors,0);
});

function createPartnerBrandingApi(options) {
  const readAdministration=async()=>{
    const pack=await options.store.getCurrentPackage('north');
    return {revision:'admin-fixture',value:{gameLane:'mobile-phone',gameLanes:[{schemaVersion:1,id:'mobile-phone',label:'Astrid',renderer:'portrait-video',dealer:'astrid',mediaCollection:'astrid-presentation'}],
      rooms:pack.tables.map((id,index)=>({schemaVersion:2,id,name:id,operatorId:'north',gameLaneId:'mobile-phone',presentationLaneId:pack.lanes[index%pack.lanes.length],state:'live'}))}};
  };
  return createApi({...options,readAdministration,withWriteContext:work=>work({store:options.store,readAdministration,reauthorize:async()=>true})});
}

// K04 (rerun 4 and the production measure, 28 Oct 2026): every film waited in prepareClip for the background and the
// table. A layer that missed its 12 s deadline left a rejected promise in `pending`, so every later film failed until
// the layer was rendered again; the production table PNG (1.63 MB) misses it at 400 kbit/s. The production background
// is a 3.97 MB film loaded with preload=auto beside the dealer's first idle film.
const fastLink={downlink:10,effectiveType:'4g',saveData:false};
const flushLayers=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function layerHarness({backgroundType='image/png',tableType='image/png',connection=fastLink}={}){
  const nodes=new Map(),rendered=[];
  class Node extends EventTarget{
    constructor(tag){super();this.tagName=tag.toUpperCase();this.dataset={};this.style={setProperty(){}};this.listeners=new Set();this.sources=[];this.loads=0;this.readyState=0;this.complete=false;this.naturalWidth=0;this.videoWidth=0;this.plays=0;}
    get src(){return this.sources.at(-1)??'';}set src(value){this.sources.push(value);}
    addEventListener(type,listener,options){this.listeners.add(listener);super.addEventListener(type,listener,options);}
    removeEventListener(type,listener,options){this.listeners.delete(listener);super.removeEventListener(type,listener,options);}
    setAttribute(){}removeAttribute(name){if(name==='src')this.sources.push('');}pause(){}load(){this.loads++;}play(){this.plays++;return Promise.resolve();}remove(){}
    getContext(){return{clearRect(){},drawImage(){},fillRect(){}};}
    loaded(width,height){if(this.tagName==='VIDEO'){this.videoWidth=width;this.videoHeight=height;this.readyState=4;this.dispatchEvent(new Event('loadeddata'));}
      else{this.naturalWidth=width;this.naturalHeight=height;this.complete=true;this.dispatchEvent(new Event('load'));}}
  }
  const background=asset('background',1),table=asset('table',2),types={background:backgroundType,table:tableType};
  const descriptor={schemaVersion:1,dealer:{enabled:true,compatibility:'per-clip'},
    background:{enabled:true,mode:backgroundType.startsWith('video/')?'video':'image',default:background.id,allowed:[background.id]},table:{enabled:true,default:table.id,allowed:[table.id]},
    assets:[background,table].map(({id,role,label})=>({id,role,label,contentType:types[role],src:`/api/presentation/room-layers/north/room-a/1/${id}`}))};
  const host={dataset:{},append(node){if(node.dataset?.layerAsset)nodes.set(node.dataset.layerAsset===background.id?'background':'table',node);}};
  const document={documentElement:{dataset:{}},querySelector:()=>host,createElement:tag=>new Node(tag)};
  const composition=createLayerComposition(document,descriptor,{connection,loadRuntime:async()=>({Compositor:class{
    constructor(canvas){this.canvas=canvas;}render(_scene,_actor,assets){rendered.push([...assets.keys()].sort());}dispose(){}}})});
  return{composition,rendered,node:role=>nodes.get(role),video:{videoWidth:1920,videoHeight:1080},assets:{background,table}};
}
async function settledWithin(t,promise,ms){let value='pending';promise.then(result=>{value=result;},error=>{value=error;});
  await flushLayers();for(let at=0;at<ms&&value==='pending';at+=250){t.mock.timers.tick(250);await flushLayers();}return value;}

test('a layer that has not loaded holds a film for at most three seconds, never fails a later one and shows once it arrives',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=layerHarness();h.node('background').loaded(720,1280);
  let done='pending';h.composition.prepareClip({mode:'alpha'}).then(value=>{done=value;},error=>{done=error;});
  await flushLayers();t.mock.timers.tick(2999);await flushLayers();assert.equal(done,'pending','a short wait for the table');
  t.mock.timers.tick(1);await flushLayers();assert.equal(done,true,'the film plays without the table');
  t.mock.timers.tick(20000);await flushLayers();
  assert.equal(await settledWithin(t,h.composition.prepareClip({mode:'alpha'}),0),true,'a late layer never holds or fails a later film');
  h.composition.renderFrame(h.video,0);assert.deepEqual(h.rendered.at(-1),['background'],'the table is not drawn before it arrives');
  assert.equal(h.node('table').src,`/api/presentation/room-layers/north/room-a/1/${h.assets.table.id}`,'it keeps loading');
  h.node('table').loaded(1672,941);assert.deepEqual(h.rendered.at(-1),['background','table'],'and shows once it arrives');
  h.composition.close();
});

test('a layer that fails to load is requested again a bounded number of times and never fails a film',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=layerHarness(),table=h.node('table');h.node('background').loaded(720,1280);table.dispatchEvent(new Event('error'));
  assert.equal(await settledWithin(t,h.composition.prepareClip({mode:'alpha'}),0),true,'a failed layer does not hold the film');
  assert.equal(table.sources.length,1);
  t.mock.timers.tick(2000);assert.equal(table.sources.length,2,'requested again');table.dispatchEvent(new Event('error'));
  t.mock.timers.tick(6000);assert.equal(table.sources.length,3,'and once more');table.dispatchEvent(new Event('error'));
  t.mock.timers.tick(60000);assert.equal(table.sources.length,3,'then it stays without the table');assert.equal(table.listeners.size,0);
  assert.equal(await settledWithin(t,h.composition.prepareClip({mode:'alpha'}),0),true);h.composition.close();
});

test('on a slow or unknown link the background film waits for the dealer’s first frame; a fast link loads it at once',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  for(const [connection,deferred] of [[null,true],[{downlink:0.4,effectiveType:'2g',saveData:false},true],[{...fastLink,effectiveType:'3g'},true],
    [{...fastLink,saveData:true},true],[fastLink,false]]){
    const h=layerHarness({backgroundType:'video/mp4',connection}),background=h.node('background'),src=`/api/presentation/room-layers/north/room-a/1/${h.assets.background.id}`;
    h.node('table').loaded(1672,941);
    assert.equal(background.preload,deferred?'none':'auto',JSON.stringify(connection));assert.equal(background.src,deferred?'':src);
    assert.equal(background.autoplay,!deferred);
    assert.equal(await settledWithin(t,h.composition.prepareClip({mode:'alpha'}),deferred?0:3000),true,'a deferred background never holds the film');
    h.composition.renderFrame(h.video,0);
    assert.deepEqual(h.rendered.at(-1),['table'],'a dark surface until the background has a frame');
    assert.equal(background.preload,'auto');assert.equal(background.src,src,'the dealer’s first frame starts the background film');
    background.loaded(1920,1080);assert.deepEqual(h.rendered.at(-1),['background','table']);
    assert.equal(await settledWithin(t,h.composition.prepareClip({mode:'alpha'}),0),true);h.composition.close();
  }
});

// Review of #505: a background film deferred until the dealer's first frame must not stay dark when that frame
// never comes. It loads after DEFERRED_LAYER_MS (20 s), or at once when the dealer is reported unavailable.
test('a deferred background film loads after twenty seconds without a dealer frame, or at once when the dealer is unavailable',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=layerHarness({backgroundType:'video/mp4',connection:null}),background=h.node('background'),src=`/api/presentation/room-layers/north/room-a/1/${h.assets.background.id}`;
  assert.equal(background.src,'');t.mock.timers.tick(19999);assert.equal(background.src,'','still waiting for the dealer');
  t.mock.timers.tick(1);assert.equal(background.src,src,'the background loads anyway');assert.equal(background.preload,'auto');
  assert.equal(await settledWithin(t,h.composition.prepareClip({mode:'alpha'}),3000),true);
  h.composition.renderFrame(h.video,0);assert.deepEqual(background.sources,[src],'a later dealer frame does not load it again');h.composition.close();
  const u=layerHarness({backgroundType:'video/mp4',connection:null}),deferred=u.node('background');
  u.composition.dealerUnavailable();assert.equal(deferred.src,src,'a dealer reported unavailable releases it at once');
  t.mock.timers.tick(20000);assert.deepEqual(deferred.sources,[src]);u.composition.close();
});
