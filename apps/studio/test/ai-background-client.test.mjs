import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
import sharp from 'sharp';
import {AI_IMAGE_MESSAGES,AI_TABLE_MISFIT,aiImageErrorMessage,aiSceneTemplates,aiTableDealers,aiTableFitsTemplate,dataUrlFile,prepareReferenceImage,readAiImageStatus,registerAiProposal,requestAiProposals} from '../client/admin/lib/ai-background.mjs';
import {aiImageLabel,aiPlacementHash,aiTableLabelFit,sha256Hex} from '../lib/ai-image-contract.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetPath} from '../../../packages/presentation/contracts/layer-asset-contract.mjs';

const webp=async(width,height)=>sharp({create:{width,height,channels:3,background:{r:30,g:30,b:40}}}).webp().toBuffer();
const proposalOf=async(width=1920,height=1080)=>({id:'00000000-0000-4000-8000-00000000000a',dataUrl:'data:image/webp;base64,'+(await webp(width,height)).toString('base64'),width,height});

// The existing manual upload: prepare, private Blob put, commit. The fixture
// answers like layer-upload-service and records what the dialog sent.
function uploadServer(calls) {
  const id='00000000-0000-4000-8000-0000000000aa';let prepared;
  return async (url,init)=>{
    const body=JSON.parse(init.body);calls.push({url,method:init.method,credentials:init.credentials,body});
    if (body.operation==='prepare') {
      prepared=body;
      return Response.json({id,pathname:layerAssetPath({id,role:body.role,sha256:body.sha256,contentType:body.contentType}),clientToken:'client-token',ticket:'ticket'});
    }
    const {operation:_o,...asset}=prepared;
    return Response.json({id,project:{layerAssets:[{schemaVersion:1,id,...asset,pathname:layerAssetPath({id,role:asset.role,sha256:asset.sha256,contentType:asset.contentType})}]}});
  };
}

test('"Använd" registers the chosen background through the existing layer-asset upload with role and AI label',async()=>{
  const calls=[],puts=[],proposal=await proposalOf();
  const prompt='Lugn kvällsstudio med mjukt sidoljus och djupblå toner bakom dealern, utan föremål i mitten';
  const saved=await registerAiProposal(proposal,{role:'background',prompt},{fetchImpl:uploadServer(calls),put:async(pathname,file,options)=>{puts.push({pathname,file,options});return {pathname};}});
  assert.equal(saved.id,'00000000-0000-4000-8000-0000000000aa');
  assert.deepEqual(calls.map(row=>[row.url,row.method,row.credentials,row.body.operation]),
    [['/api/layer-assets/upload','POST','same-origin','prepare'],['/api/layer-assets/upload','POST','same-origin','commit']]);
  const bytes=Buffer.from(proposal.dataUrl.split(',')[1],'base64'),prepare=calls[0].body;
  assert.deepEqual(prepare,{operation:'prepare',role:'background',label:aiImageLabel(prompt),sha256:createHash('sha256').update(bytes).digest('hex'),
    size:bytes.length,contentType:'image/webp',width:1920,height:1080});
  assert.match(prepare.label,/^AI · Lugn kvällsstudio/);assert.ok(prepare.label.length<=80);assert.equal(Object.hasOwn(prepare,'game'),false);
  assert.equal(puts.length,1);assert.equal(puts[0].options.access,'private');assert.equal(puts[0].options.token,'client-token');
  assert.equal(puts[0].file.type,'image/webp');assert.equal(puts[0].file.size,bytes.length);
});

test('"Använd" for a table graphic registers a Blackjack table labelled with dealer and placement',async()=>{
  const calls=[],proposal=await proposalOf(1215,2074),fit={dealerId:'paow',placement:aiPlacementHash(defaultCompositionSettings())};
  await registerAiProposal(proposal,{role:'table',prompt:'Grön filt',fit},{fetchImpl:uploadServer(calls),put:async pathname=>({pathname})});
  assert.equal(calls[0].body.role,'table');assert.equal(calls[0].body.game,'blackjack');
  assert.equal(calls[0].body.label,`AI · Grön filt · paow · ${fit.placement}`);assert.deepEqual(aiTableLabelFit(calls[0].body.label),fit);
  assert.deepEqual([calls[0].body.width,calls[0].body.height],[1215,2074]);
  await assert.rejects(registerAiProposal(proposal,{role:'table',prompt:'Grön filt'},{fetchImpl:uploadServer([]),put:async pathname=>({pathname})}),/dealer och placering/);
  const long=aiImageLabel('x'.repeat(600),fit);assert.ok(long.length<=80);assert.deepEqual(aiTableLabelFit(long),fit);
});

test('proposal requests go to the one AI route and only fixed codes become text',async()=>{
  const sent=[],image=await proposalOf();
  const fetchImpl=async(url,init)=>{sent.push({url,init});return Response.json({ok:true,images:[image,{id:'x',dataUrl:'https://evil.invalid/x.png',width:1,height:1}],remaining:7});};
  const tableAnswer=async(url,init)=>{sent.push({url,init});return Response.json({ok:true,images:[image],remaining:7,fit:{dealerId:'paow',placement:'0a1b2c3d'}});};
  const withFit=await requestAiProposals({role:'table',prompt:'Filt',preset:'casino',count:1,dealerId:'paow'},{fetchImpl:tableAnswer});
  assert.deepEqual(withFit.fit,{dealerId:'paow',placement:'0a1b2c3d'});sent.length=0;
  await assert.rejects(requestAiProposals({role:'table',prompt:'Filt',preset:'casino',count:1,dealerId:'paow'},{fetchImpl}),/kunde inte skapas/,'a table answer without fit is refused');sent.length=0;
  const result=await requestAiProposals({role:'background',prompt:'Filt',preset:'casino',count:2,reference:'data:image/png;base64,AAAA'},{fetchImpl});
  assert.equal(sent[0].url,'/api/layer-assets/generate');assert.equal(sent[0].init.method,'POST');assert.equal(sent[0].init.credentials,'same-origin');
  assert.deepEqual(JSON.parse(sent[0].init.body),{role:'background',prompt:'Filt',preset:'casino',count:2,reference:'data:image/png;base64,AAAA'});
  assert.deepEqual(result,{images:[image],remaining:7,fit:null},'malformed proposals are dropped');
  await requestAiProposals({role:'background',prompt:'Studio',preset:'free',count:1,dealerId:'paow',sceneTemplate:{id:'miljö'}},{fetchImpl});
  assert.deepEqual(JSON.parse(sent[1].init.body),{role:'background',prompt:'Studio',preset:'free',count:1});
  const composition={mobile:{},desktop:{}};
  await requestAiProposals({role:'table',prompt:'Filt',preset:'casino',count:1,dealerId:'paow',sceneTemplate:{id:'paow-bord',composition}},{fetchImpl:tableAnswer});
  assert.deepEqual(JSON.parse(sent[2].init.body).sceneTemplate,{id:'paow-bord',composition},'the scene template and its composition go along');
  await requestAiProposals({role:'table',prompt:'Filt',preset:'casino',count:1,dealerId:'paow',sceneTemplate:null},{fetchImpl:tableAnswer});
  assert.equal(Object.hasOwn(JSON.parse(sent[3].init.body),'sceneTemplate'),false,'no template: the server uses the composition defaults');
  for (const [code,message] of Object.entries(AI_IMAGE_MESSAGES)) {
    const error=await requestAiProposals({role:'background',prompt:'Studio',preset:'free',count:1},{fetchImpl:async()=>Response.json({code,error:'secret provider text'},{status:503})}).catch(cause=>cause);
    assert.equal(aiImageErrorMessage(error),message);
  }
  assert.match(AI_IMAGE_MESSAGES.ai_image_unavailable,/^Inte anslutet\./);assert.match(AI_IMAGE_MESSAGES.ai_image_disabled,/^Inte påslaget\./);
  assert.equal(AI_IMAGE_MESSAGES.ai_image_budget_exhausted,'AI-budgeten är slut. Kontakta den som äger OpenAI-kontot.');
  assert.doesNotMatch(AI_IMAGE_MESSAGES.ai_image_budget_exhausted,/i morgon/);
  const unknown=await requestAiProposals({role:'background',prompt:'Studio',preset:'free',count:1},{fetchImpl:async()=>Response.json({code:'provider_said',error:'secret provider text'},{status:500})}).catch(cause=>cause);
  assert.equal(aiImageErrorMessage(unknown),'Förslagen kunde inte skapas. Försök igen.');assert.doesNotMatch(aiImageErrorMessage(unknown),/secret|provider/);
  assert.deepEqual(await readAiImageStatus({fetchImpl:async()=>Response.json({enabled:false,configured:false,problem:null,dailyLimit:0,remaining:0})}),{enabled:false,configured:false,problem:null,dailyLimit:0,remaining:0});
  assert.equal((await readAiImageStatus({fetchImpl:async()=>Response.json({enabled:true,configured:false,problem:'invalid_setting'})})).problem,'invalid_setting');
  assert.equal((await readAiImageStatus({fetchImpl:async()=>Response.json({enabled:true,configured:false,problem:'<script>'})})).problem,null);
  assert.equal(AI_IMAGE_MESSAGES.ai_image_misconfigured,'AI-inställningen är ogiltig. Kontakta den som driftar Scoutgaming.');
});

test('inspiration images: PNG, JPEG or WebP, shrunk in the browser to at most 1536 px and under 2 MB',async()=>{
  const png=await sharp({create:{width:20,height:20,channels:3,background:{r:1,g:2,b:3}}}).png().toBuffer();
  const measure=size=>async()=>size,never=async()=>assert.fail('small images are sent as they are');
  assert.equal(await prepareReferenceImage(new File([png],'bord.png',{type:'image/png'}),{measure:measure({width:1536,height:900}),shrink:never}),'data:image/png;base64,'+png.toString('base64'));
  const shrinks=[],jpeg=new Blob([new Uint8Array(1000)],{type:'image/jpeg'});
  const shrunk=await prepareReferenceImage(new File([png],'foto.png',{type:'image/png'}),{measure:measure({width:4000,height:3000}),shrink:async(_file,size,quality)=>{shrinks.push({size,quality});return jpeg;}});
  assert.match(shrunk,/^data:image\/jpeg;base64,/);assert.deepEqual(shrinks,[{size:{width:1536,height:1152},quality:.88}]);
  const big=new File([new Uint8Array(2*1024*1024)],'stor.webp',{type:'image/webp'}),qualities=[];
  await prepareReferenceImage(big,{measure:measure({width:1200,height:800}),shrink:async(_file,size,quality)=>{qualities.push([size.width,quality]);return quality<.7?jpeg:new Blob([new Uint8Array(2*1024*1024)]);}});
  assert.deepEqual(qualities,[[1200,.88],[1200,.75],[1200,.6]],'2 MB or more is re-encoded until it is under 2 MB');
  await assert.rejects(prepareReferenceImage(big,{measure:measure({width:1200,height:800}),shrink:async()=>new Blob([new Uint8Array(3*1024*1024)])}),/mindre än 2 MB/);
  await assert.rejects(prepareReferenceImage(new File([png],'bord.gif',{type:'image/gif'}),{measure:measure({width:20,height:20})}),/PNG, JPEG eller WebP/);
  await assert.rejects(prepareReferenceImage(new File([new Uint8Array(8*1024*1024+1)],'stor.jpg',{type:'image/jpeg'}),{measure:measure({width:20,height:20})}),/högst 8 MB/);
  assert.equal(dataUrlFile('data:image/webp;base64,'+png.toString('base64'),'a.webp').size,png.length);
  assert.throws(()=>dataUrlFile('https://example.invalid/a.webp','a.webp'));
});

test('labels and table dealers follow the layer contract and the filmed profile registry',()=>{
  assert.equal(aiImageLabel('  Mörk <studio>\n med   ljus '),'AI · Mörk studio med ljus');
  assert.ok(aiImageLabel('x'.repeat(600)).length<=80);assert.equal(aiImageLabel(''),'AI · bild');
  assert.deepEqual(aiTableDealers([{id:'paow',label:'PAOW'},{id:'astrid',label:'Astrid'},{id:'dragan',label:'Dragan'},{id:'ny',label:'Ny'}]).map(row=>row.id),['paow','dragan']);
  const lanes=[{id:'roulette',label:'Roulette',dealers:['anna']},{id:'paow-bord',label:'PAOW-bord',dealers:['paow','dragan']},{id:'andra',label:'Andra',dealers:['paow']}];
  assert.deepEqual(aiSceneTemplates(lanes,'paow').map(row=>row.id),['paow-bord','andra'],'the first template that allows the dealer comes first');
  assert.deepEqual(aiSceneTemplates(lanes,'astrid'),[]);assert.deepEqual(aiSceneTemplates(undefined,'paow'),[]);
});

// Render the exported dialog's closed state: it compiles, resolves its client
// libraries and shows the trigger; table mode needs Blackjack and a filmed dealer.
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
function loadTs(fileUrl) {
  const output=transformSync(readFileSync(fileUrl,'utf8'),{filename:fileURLToPath(fileUrl),jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}},localRequire=createRequire(fileUrl);
  vm.runInNewContext(output.code,{module,exports:module.exports,require:name=>{
    if (name.startsWith('./')||name.startsWith('../')) for (const suffix of ['','.tsx','.ts','.mjs','.js']) {
      const path=fileURLToPath(new URL(name+suffix,fileUrl));if(!existsSync(path))continue;
      return /\.(mjs|js|json)$/.test(path)?localRequire(path):loadTs(pathToFileURL(path)).exports;
    }
    return localRequire(name);
  },process,URL,AbortController,Response,Request,Headers,fetch},{filename:fileURLToPath(fileUrl)});
  return {exports:module.exports,localRequire};
}
test('the exported dialog renders its trigger and stays closed until opened',()=>{
  const {exports:{AiBackgroundDialog},localRequire}=loadTs(new URL('../client/admin/components/studio/ai-background-dialog.tsx',import.meta.url));
  const {createElement}=localRequire('react'),{renderToStaticMarkup}=localRequire('react-dom/server');
  const html=props=>renderToStaticMarkup(createElement(AiBackgroundDialog,{onRegistered:()=>assert.fail('closed dialog cannot register'),...props}));
  const closed=html({});
  // One trigger, "Skapa med AI", in the Admin kit; the kit's native dialog renders nothing until opened.
  assert.match(closed,/Skapa med AI<\/button>/);assert.doesNotMatch(closed,/Beskriv bakgrunden|Skapa bakgrund med AI|role="dialog"/);assert.doesNotMatch(closed,/disabled=""/);
  assert.match(closed,/<dialog[^>]*><\/dialog>/,'the closed dialog has no content');
  assert.match(html({role:'table',dealers:[{id:'paow',label:'PAOW'}]}),/Skapa med AI<\/button>/);
  for (const props of [{role:'table',game:'roulette',dealers:[{id:'paow',label:'PAOW'}]},{role:'table',dealers:[{id:'astrid',label:'Astrid'}]},{disabled:true}]) {
    assert.match(html(props),/<button[^>]*disabled=""/,JSON.stringify(props));
  }
});

test('SHA-256 runs synchronously in the browser and matches Node',()=>{
  for (const text of ['','abc','å'.repeat(31),'x'.repeat(55),'x'.repeat(56),'x'.repeat(64),'y'.repeat(1000)]) {
    assert.equal(sha256Hex(text),createHash('sha256').update(text,'utf8').digest('hex'),text.slice(0,8));
  }
  const composition=defaultCompositionSettings(),moved=defaultCompositionSettings();moved.desktop.table.y=.05;
  assert.match(aiPlacementHash(composition),/^[a-f0-9]{8}$/);assert.notEqual(aiPlacementHash(moved),aiPlacementHash(composition));
  // Card geometry, game UI and table order do not move the graphic.
  const extra={...defaultCompositionSettings(),blackjackTables:[{tableId:'00000000-0000-4000-8000-0000000000aa',mobile:{},desktop:{}}]};
  assert.equal(aiPlacementHash(extra),aiPlacementHash(composition));
});

test('an AI table graphic fits only a scene template with its dealer landings and placement; all other material passes',()=>{
  const fit={dealerId:'paow',placement:aiPlacementHash(defaultCompositionSettings())};
  const asset={role:'table',label:aiImageLabel('Grön filt',fit)},lane={dealers:['paow']};
  assert.deepEqual(aiTableFitsTemplate(asset,lane),{ok:true},'no composition: the defaults it was drawn for');
  assert.deepEqual(aiTableFitsTemplate(asset,{dealers:['paow','dragan'],composition:defaultCompositionSettings()}),{ok:true},'Dragan lands where PAOW lands');
  for (const other of [{dealers:['astrid']},{dealers:['paow','ny-dealer']},{dealers:[]}]) {
    assert.deepEqual(aiTableFitsTemplate(asset,other),{ok:false,code:'ai_table_other_dealer',reason:AI_TABLE_MISFIT.ai_table_other_dealer});
  }
  const moved=defaultCompositionSettings();moved.mobile.table={width:1.58,x:0,y:.35};
  assert.deepEqual(aiTableFitsTemplate(asset,{dealers:['paow'],composition:moved}),{ok:false,code:'ai_table_other_placement',reason:AI_TABLE_MISFIT.ai_table_other_placement});
  assert.equal(aiTableFitsTemplate(asset,{dealers:['paow'],composition:{mobile:{}}}).code,'ai_table_other_placement');
  for (const material of [{role:'table',label:'Blackjack · grön filt'},{role:'background',label:asset.label},{role:'table',label:'Bord från AI, omdöpt'},null]) {
    assert.deepEqual(aiTableFitsTemplate(material,{dealers:['astrid'],composition:moved}),{ok:true});
  }
});

test('choosing a table in a scene template blocks a misfit AI graphic and explains why',()=>{
  const {exports:{LayerAssetSelect},localRequire}=loadTs(new URL('../components/layer-selectors.tsx',import.meta.url));
  const {createElement}=localRequire('react'),{renderToStaticMarkup}=localRequire('react-dom/server');
  const placement=aiPlacementHash(defaultCompositionSettings()),asset=(id,label)=>({schemaVersion:1,id,role:'table',game:'blackjack',label,sha256:'a'.repeat(64),size:100,contentType:'image/webp',pathname:'x',width:1215,height:2074});
  const ai=asset('00000000-0000-4000-8000-0000000000a1',`AI · Grön filt · paow · ${placement}`),manual=asset('00000000-0000-4000-8000-0000000000a2','Blackjack · eget bord');
  const lane=dealers=>({id:'miljö',label:'Miljö',dealers,layers:{table:{enabled:true,default:null,allowed:[]},background:{enabled:false,default:null,allowed:[],mode:'baked'}}});
  const html=props=>renderToStaticMarkup(createElement(LayerAssetSelect,{role:'table',assets:[ai,manual],onChange:()=>{},...props}));
  const fits=html({lane:lane(['paow'])});
  assert.doesNotMatch(fits,/passar inte miljön/);assert.doesNotMatch(fits,/<option[^>]*disabled=""[^>]*value="00000000-0000-4000-8000-0000000000a1"|value="00000000-0000-4000-8000-0000000000a1"[^>]*disabled=""/);
  const other=html({lane:lane(['astrid'])});
  assert.match(other,/value="00000000-0000-4000-8000-0000000000a1" disabled=""/);assert.match(other,/passar inte miljön/);
  assert.doesNotMatch(other,/value="00000000-0000-4000-8000-0000000000a2" disabled=""/,'manual material is never blocked');
  const chosen={...lane(['astrid']),layers:{...lane(['astrid']).layers,table:{enabled:true,default:ai.id,allowed:[ai.id]}}};
  assert.match(html({lane:chosen}),new RegExp('role="alert">'+ai.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+': Bordsgrafiken är ritad för en annan dealer'));
});
