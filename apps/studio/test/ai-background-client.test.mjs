import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
import sharp from 'sharp';
import {AI_IMAGE_MESSAGES,aiImageErrorMessage,aiTableDealers,dataUrlFile,prepareReferenceImage,readAiImageStatus,registerAiProposal,requestAiProposals} from '../client/admin/lib/ai-background.mjs';
import {aiImageLabel} from '../lib/ai-image-contract.mjs';
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

test('"Använd" for a table graphic registers a Blackjack table, never a background',async()=>{
  const calls=[],proposal=await proposalOf(1080,1233);
  await registerAiProposal(proposal,{role:'table',prompt:'Grön filt'},{fetchImpl:uploadServer(calls),put:async pathname=>({pathname})});
  assert.equal(calls[0].body.role,'table');assert.equal(calls[0].body.game,'blackjack');assert.equal(calls[0].body.label,'AI · Grön filt');
  assert.deepEqual([calls[0].body.width,calls[0].body.height],[1080,1233]);
});

test('proposal requests go to the one AI route and only fixed codes become text',async()=>{
  const sent=[],image=await proposalOf();
  const fetchImpl=async(url,init)=>{sent.push({url,init});return Response.json({ok:true,images:[image,{id:'x',dataUrl:'https://evil.invalid/x.png',width:1,height:1}],remaining:7});};
  const result=await requestAiProposals({role:'table',prompt:'Filt',preset:'casino',count:2,dealerId:'paow',reference:'data:image/png;base64,AAAA'},{fetchImpl});
  assert.equal(sent[0].url,'/api/layer-assets/generate');assert.equal(sent[0].init.method,'POST');assert.equal(sent[0].init.credentials,'same-origin');
  assert.deepEqual(JSON.parse(sent[0].init.body),{role:'table',prompt:'Filt',preset:'casino',count:2,dealerId:'paow',reference:'data:image/png;base64,AAAA'});
  assert.deepEqual(result,{images:[image],remaining:7},'malformed proposals are dropped');
  await requestAiProposals({role:'background',prompt:'Studio',preset:'free',count:1,dealerId:'paow'},{fetchImpl});
  assert.deepEqual(JSON.parse(sent[1].init.body),{role:'background',prompt:'Studio',preset:'free',count:1});
  for (const [code,message] of Object.entries(AI_IMAGE_MESSAGES)) {
    const error=await requestAiProposals({role:'background',prompt:'Studio',preset:'free',count:1},{fetchImpl:async()=>Response.json({code,error:'secret provider text'},{status:503})}).catch(cause=>cause);
    assert.equal(aiImageErrorMessage(error),message);
  }
  assert.match(AI_IMAGE_MESSAGES.ai_image_unavailable,/^Inte anslutet\./);
  const unknown=await requestAiProposals({role:'background',prompt:'Studio',preset:'free',count:1},{fetchImpl:async()=>Response.json({code:'provider_said',error:'secret provider text'},{status:500})}).catch(cause=>cause);
  assert.equal(aiImageErrorMessage(unknown),'Förslagen kunde inte skapas. Försök igen.');assert.doesNotMatch(aiImageErrorMessage(unknown),/secret|provider/);
  assert.deepEqual(await readAiImageStatus({fetchImpl:async()=>Response.json({configured:false,dailyLimit:0,remaining:0})}),{configured:false,dailyLimit:0,remaining:0});
});

test('reference photos: PNG, JPEG or WebP up to 8 MB in the dialog; small files are sent as they are',async()=>{
  const png=await sharp({create:{width:20,height:20,channels:3,background:{r:1,g:2,b:3}}}).png().toBuffer();
  assert.equal(await prepareReferenceImage(new File([png],'bord.png',{type:'image/png'})),'data:image/png;base64,'+png.toString('base64'));
  await assert.rejects(prepareReferenceImage(new File([png],'bord.gif',{type:'image/gif'})),/PNG, JPEG eller WebP/);
  await assert.rejects(prepareReferenceImage(new File([new Uint8Array(8*1024*1024+1)],'stor.jpg',{type:'image/jpeg'})),/högst 8 MB/);
  assert.equal(dataUrlFile('data:image/webp;base64,'+png.toString('base64'),'a.webp').size,png.length);
  assert.throws(()=>dataUrlFile('https://example.invalid/a.webp','a.webp'));
});

test('labels and table dealers follow the layer contract and the filmed profile registry',()=>{
  assert.equal(aiImageLabel('  Mörk <studio>\n med   ljus '),'AI · Mörk studio med ljus');
  assert.ok(aiImageLabel('x'.repeat(600)).length<=80);assert.equal(aiImageLabel(''),'AI · bild');
  assert.deepEqual(aiTableDealers([{id:'paow',label:'PAOW'},{id:'astrid',label:'Astrid'},{id:'dragan',label:'Dragan'},{id:'ny',label:'Ny'}]).map(row=>row.id),['paow','dragan']);
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
      return /\.(mjs|js|json)$/.test(path)?localRequire(path):loadTs(pathToFileURL(path));
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
  assert.match(closed,/Skapa bakgrund med AI/);assert.doesNotMatch(closed,/Beskriv bakgrunden|role="dialog"/);assert.doesNotMatch(closed,/disabled=""/);
  assert.match(html({role:'table',dealers:[{id:'paow',label:'PAOW'}]}),/Skapa bordsgrafik med AI<\/button>/);
  for (const props of [{role:'table',game:'roulette',dealers:[{id:'paow',label:'PAOW'}]},{role:'table',dealers:[{id:'astrid',label:'Astrid'}]},{disabled:true}]) {
    assert.match(html(props),/<button[^>]*disabled=""/,JSON.stringify(props));
  }
});
