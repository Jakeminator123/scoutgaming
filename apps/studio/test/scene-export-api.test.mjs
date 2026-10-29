// Miljöbild: the material role `illustration` and "Exportera miljöbild" against real PostgreSQL SQL (PGlite)
// with the Studio migrations, the native readiness gate and a private-Blob stand-in. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {createPglitePool} from '../../../test/fixtures/pglite-pool.mjs';
import {planStudioMigrations,applyStudioMigrations} from '../../../ops/neon-studio/migrations.mjs';
import {createStudioRepository} from '../../../packages/studio-registry/server/document-repository.mjs';
import {wrapNativePresentationRepository,PRESENTATION_RUNTIME_UPDATE_REQUIRED} from '../lib/presentation-runtime-readiness.mjs';
import {PRESENTATION_CAPABILITY_VERSION_HEADER,presentationCapabilitiesForVersion} from '../../../packages/presentation/capability-contract.mjs';
import {createSeedProject,defaultPresentationLane,validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {buildPresentationPackage,layerAssetPath,validateLayerAsset,validatePresentationPackage} from '../../../packages/presentation/contracts/presentation-layers.mjs';
import {changeMaterialTrash} from '../lib/material-trash.mjs';
import {createSceneExportApi,illustrationLabel,validateSceneExportRequest} from '../lib/scene-export-api.mjs';
import {desktopSceneStill} from '../../../packages/presentation/runtime/scene-still.mjs';

const origin='https://studio.example.invalid',scope={environment:'scene-export-test',workspaceId:'isolated'};
const config={scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid','studio.example.invalid']};
const url=origin+'/studio/api/layer-assets/scene-export',videoId='00000000-0000-4000-8000-0000000000d1';
const env={CROUPIER_MEDIA_STORAGE:'blob',BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_fixture_not_real'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const solid=(width,height,color)=>sharp({create:{width,height,channels:4,background:color}}).png().toBuffer();
function material(n,role,bytes,width,height){
  const row={schemaVersion:1,id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,role,label:`Material ${n}`,sha256:sha(bytes),size:bytes.length,contentType:'image/png',width,height};
  row.pathname=layerAssetPath(row);return row;
}
// A green-screen frame with one white block below the table: the green keys away, the block stays.
async function dealerFrame(){
  const block=await sharp({create:{width:120,height:300,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).png().toBuffer();
  const png=await sharp({create:{width:1920,height:1080,channels:4,background:{r:0,g:255,b:0,alpha:1}}}).composite([{input:block,left:900,top:600}]).png().toBuffer();
  return 'data:image/png;base64,'+png.toString('base64');
}

async function fixture(t,{version=33}={}){
  const pool=await createPglitePool();t.after(()=>pool.end());
  const plan=await planStudioMigrations({pool});await applyStudioMigrations({pool,expectedTarget:plan.target,confirm:true});
  const raw=createStudioRepository({pool,scope}),fetches=[];
  const repository=wrapNativePresentationRepository(raw,{env:{CROUPIER_BACKEND_ORIGIN:'https://runtime.example.invalid'},fetchImpl:async(_url,init)=>{
    const asked=Number(init.headers[PRESENTATION_CAPABILITY_VERSION_HEADER]??2);fetches.push(asked);
    return asked>version?new Response(null,{status:406}):Response.json(presentationCapabilitiesForVersion(asked));
  }});
  const backgroundBytes=await solid(1920,1080,{r:220,g:30,b:30,alpha:1}),tableBytes=await solid(400,200,{r:20,g:40,b:230,alpha:1});
  const background=material(1,'background',backgroundBytes,1920,1080),table=material(2,'table',tableBytes,400,200);
  const lane={...defaultPresentationLane('astrid'),id:'studion',label:'Studion',composition:defaultCompositionSettings()};
  lane.layers.background={enabled:true,mode:'image',default:background.id,allowed:[background.id]};
  lane.layers.table={enabled:true,default:table.id,allowed:[table.id]};
  const project={...createSeedProject(),lanes:[lane],layerAssets:[background,table]};
  await raw.initializeDocument('project',{value:validateProject(project),revision:'project-1',actor:'fixture'});
  const blobs=new Map([[background.pathname,backgroundBytes],[table.pathname,tableBytes]]),puts=[];
  const privateMedia={
    async get(storage){const bytes=blobs.get(storage.pathname);return bytes&&sha(bytes)===storage.sha256?new Response(bytes,{headers:{'content-type':storage.contentType}}):new Response(null,{status:404});},
    async put(pathname,bytes,options){assert.equal(sha(bytes),options.sha256);puts.push(pathname);blobs.set(pathname,Buffer.from(bytes));},
  };
  const dealerRecord={id:videoId,revision:'media-1',classification:{dealerId:'astrid',compositing:{mode:'green-screen',threshold:.23,softness:.15,despill:0}}};
  // Only the dealer clip's registration is a stand-in; documents, revisions and readiness are the real ones.
  const withMedia={...repository,getMedia:async id=>id===videoId?structuredClone(dealerRecord):repository.getMedia(id)};
  const mutationTransaction=(work,{presentationMutation}={})=>repository.withMutationContext(work,presentationMutation);
  const api=(role='admin')=>createSceneExportApi({authorize:async()=>({user:'Personal',role,scope}),config,repository:withMedia,mutationTransaction,env,privateMedia,imageLibrary:async()=>sharp});
  const post=(body,headers={})=>new Request(url,{method:'POST',headers:{'content-type':'application/json',origin,'sec-fetch-site':'same-origin',...headers},body:JSON.stringify(body)});
  return {pool,raw,repository,api,post,blobs,puts,fetches,background,table,lane,dealerRecord};
}
async function pixel(bytes,x,y){
  const {data,info}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});const i=(y*info.width+x)*info.channels;
  return [data[i],data[i+1],data[i+2]];
}

test('export renders the saved scene on a computer screen and saves a new illustration material, nothing else',async t=>{
  const f=await fixture(t),frame=await dealerFrame();
  const before=await f.raw.readDocument('project');
  const response=await f.api().handle(f.post({laneId:'studion',expectedRevision:before.revision,dealer:{videoId,frame}}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.label,'Studion · miljöbild v1');assert.deepEqual(body.skipped,[]);
  const saved=await f.raw.readDocument('project'),asset=saved.value.layerAssets.find(row=>row.id===body.id);
  assert.equal(validateLayerAsset(asset).role,'illustration');
  assert.deepEqual([asset.contentType,asset.width,asset.height],['image/webp',1920,1080]);
  assert.match(asset.pathname,/^croupier\/media\/illustrations\//);
  assert.deepEqual(f.puts,[asset.pathname]);
  assert.deepEqual(saved.value.lanes,before.value.lanes,'the export never selects, replaces or archives a picture');
  assert.deepEqual(body.project.layerAssets.map(row=>row.id),saved.value.layerAssets.map(row=>row.id));
  // The stored bytes are the rendered still: background, the table at its saved placement, the keyed dealer on top.
  const bytes=f.blobs.get(asset.pathname);assert.equal(sha(bytes),asset.sha256);
  const still=desktopSceneStill({composition:f.lane.composition,background:{width:1920,height:1080},table:{width:400,height:200},dealer:true});
  assert.deepEqual(still.layers.map(row=>row.role),['background','table','dealer']);
  const [tx,ty,tw,th]=still.layers[1].rect;
  const red=await pixel(bytes,100,100),blue=await pixel(bytes,Math.round(tx+tw/2),Math.round(ty+th/2)),white=await pixel(bytes,960,750);
  assert.ok(red[0]>180&&red[1]<80&&red[2]<80,'the keyed green shows the background: '+red);
  assert.ok(blue[2]>180&&blue[0]<80,'the table sits at its saved placement, not on the lower half: '+blue);
  assert.ok(white.every(value=>value>220),'the dealer stays in front: '+white);
  assert.ok(f.fetches.includes(33),'storing an illustration negotiates the v33 runtime first');
  // A second export is the next version; the first stays in the library.
  const again=await f.api().handle(f.post({laneId:'studion',expectedRevision:saved.revision}));
  assert.equal(again.status,200);
  const second=await again.json(),after=await f.raw.readDocument('project');
  assert.equal(second.label,'Studion · miljöbild v2');
  assert.deepEqual(after.value.layerAssets.filter(row=>row.role==='illustration').map(row=>row.label),['Studion · miljöbild v1','Studion · miljöbild v2']);
});

test('a miljöbild is chosen on the environment, travels in the package and can never be a background or a table',async t=>{
  const f=await fixture(t);
  const saved=await f.raw.readDocument('project');
  const exported=await (await f.api().handle(f.post({laneId:'studion',expectedRevision:saved.revision}))).json();
  const current=await f.raw.readDocument('project'),id=exported.id;
  const chosen={...current.value,lanes:current.value.lanes.map(lane=>({...lane,illustration:id}))};
  await f.repository.saveDocument('project',{expectedRevision:current.revision,value:chosen,actor:'Personal'});
  const stored=await f.raw.readDocument('project');
  assert.equal(stored.value.lanes[0].illustration,id);
  // The frozen package carries the picture with its lane, and only as an illustration.
  const pack=buildPresentationPackage(stored.value,['studion'],stored.value.layerAssets);
  assert.equal(pack.lanes[0].illustration,id);assert.equal(pack.assets.find(row=>row.id===id).role,'illustration');
  assert.throws(()=>validatePresentationPackage({...pack,assets:pack.assets.map(row=>row.id===id?{...row,role:'background',pathname:layerAssetPath({...row,role:'background'})}:row)}));
  assert.throws(()=>validatePresentationPackage({...pack,assets:pack.assets.filter(row=>row.id!==id)}));
  // Never a layer: not allowed, not a default, not a playback clip; and the lane field must name an illustration.
  const lane=stored.value.lanes[0];
  for (const broken of [
    {...lane,layers:{...lane.layers,background:{...lane.layers.background,allowed:[...lane.layers.background.allowed,id]}}},
    {...lane,layers:{...lane.layers,background:{...lane.layers.background,default:id,allowed:[...lane.layers.background.allowed,id]}}},
    {...lane,layers:{...lane.layers,table:{...lane.layers.table,allowed:[...lane.layers.table.allowed,id]}}},
    {...lane,illustration:f.background.id},
    {...lane,illustration:'00000000-0000-4000-8000-0000000000ff'},
  ]) {
    assert.throws(()=>validateProject({...stored.value,lanes:[broken]}));
    await assert.rejects(f.repository.saveDocument('project',{expectedRevision:stored.revision,value:{...stored.value,lanes:[broken]},actor:'Personal'}));
  }
  // An illustration is an image only and never belongs to a game.
  const picture=stored.value.layerAssets.find(row=>row.id===id);
  assert.throws(()=>layerAssetPath({...picture,contentType:'video/mp4'}));
  assert.throws(()=>validateLayerAsset({...picture,game:'blackjack'}));
  // Archiving the picture clears the choice and keeps the room's layers; nothing else is archived.
  const archived=changeMaterialTrash(stored.value,{id,archived:true,now:()=>1791753600000});
  assert.equal(Object.hasOwn(archived.lanes[0],'illustration'),false);
  assert.deepEqual(archived.lanes[0].layers,stored.value.lanes[0].layers);
  assert.equal(archived.layerAssetTrash[0].asset.id,id);
  assert.equal(illustrationLabel('Studion',archived),'Studion · miljöbild v2','an archived picture keeps its version number');
});

test('an older game server, a stale editor and foreign or broken input store nothing',async t=>{
  const old=await fixture(t,{version:32}),saved=await old.raw.readDocument('project');
  const refused=await old.api().handle(old.post({laneId:'studion',expectedRevision:saved.revision}));
  assert.equal(refused.status,503);assert.equal((await refused.json()).code,PRESENTATION_RUNTIME_UPDATE_REQUIRED);
  assert.deepEqual(old.puts,[],'no byte is stored before the runtime reads the role');
  assert.equal((await old.raw.readDocument('project')).revision,saved.revision);

  const f=await fixture(t),current=await f.raw.readDocument('project'),frame=await dealerFrame();
  const expect=async(request,status,code,handler=f.api())=>{const response=await handler.handle(request);assert.equal(response.status,status);if(code)assert.equal((await response.json()).error,code);};
  await expect(f.post({laneId:'studion',expectedRevision:'project-0'}),409,'scene_export_stale');
  await expect(f.post({laneId:'other',expectedRevision:current.revision}),404,'scene_export_lane_missing');
  await expect(f.post({laneId:'studion',expectedRevision:current.revision,dealer:{videoId:'00000000-0000-4000-8000-0000000000d9',frame}}),422,'scene_export_dealer_invalid');
  await expect(f.post({laneId:'studion',expectedRevision:current.revision,dealer:{videoId,frame:'data:image/png;base64,AAAA'}}),400,'scene_export_invalid_request');
  await expect(f.post({laneId:'studion',expectedRevision:current.revision,extra:true}),400,'scene_export_invalid_request');
  await expect(f.post({laneId:'studion',expectedRevision:current.revision},{origin:'https://foreign.example.invalid'}),403);
  await expect(f.post({laneId:'studion',expectedRevision:current.revision},{'sec-fetch-site':'cross-site'}),403);
  await expect(f.post({laneId:'studion',expectedRevision:current.revision}),403,undefined,f.api('partner'));
  await expect(new Request(url,{headers:{'sec-fetch-site':'same-origin'}}),405);
  // A clip from a dealer the environment does not allow, or one without keying, cannot lend its frame.
  f.dealerRecord.classification.dealerId='vera';
  await expect(f.post({laneId:'studion',expectedRevision:current.revision,dealer:{videoId,frame}}),422,'scene_export_dealer_invalid');
  f.dealerRecord.classification={dealerId:'astrid',compositing:{mode:'opaque',threshold:0}};
  await expect(f.post({laneId:'studion',expectedRevision:current.revision,dealer:{videoId,frame}}),422,'scene_export_dealer_invalid');
  assert.deepEqual(f.puts,[]);
  assert.equal((await f.raw.readDocument('project')).revision,current.revision);
  assert.throws(()=>validateSceneExportRequest({laneId:'Studion',expectedRevision:current.revision}));
});

test('labels stay within the material limit and count only this environment',()=>{
  const project={layerAssets:[{role:'illustration',label:'Studion · miljöbild v4'},{role:'illustration',label:'Studion 2 · miljöbild v9'},{role:'background',label:'Studion · miljöbild v7'}]};
  assert.equal(illustrationLabel('Studion',project),'Studion · miljöbild v5');
  assert.equal(illustrationLabel('Ny <miljö>',{}),'Ny miljö · miljöbild v1');
  const long='x'.repeat(80),label=illustrationLabel(long,{});
  assert.ok(label.length<=80);assert.match(label,/ · miljöbild v1$/);
  assert.equal(illustrationLabel(long,{layerAssets:[{role:'illustration',label}]}).endsWith('v2'),true);
});
