import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import sharp from 'sharp';
import {aiImageEnabled,aiImageSetup,createAiBackgroundApi,createAiImageDailyLimit} from '../lib/ai-background-api.mjs';
import {filmedTableFit,filmedTableTemplate} from '../lib/filmed-table-template.mjs';

const browserModule=process.env.CROUPIER_BROWSER_FIXTURE_MODULE;
const origin='https://ai-reference.fixture.invalid',id='00000000-0000-4000-8000-000000000001';

test('large transparent library references retain their alpha and felt colour through the real browser preparation and server analysis',{skip:!browserModule},async()=>{
  const bundle=await build({stdin:{contents:"import {prepareMaterialReference} from './client/admin/lib/ai-background.mjs'; window.prepareMaterialReference=prepareMaterialReference;",
    resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'js'},bundle:true,write:false,platform:'browser',format:'iife',logLevel:'silent',
    define:{'process.env.NEXT_PUBLIC_ADMIN_WORKSPACE':'"1"','process.env.NEXT_PUBLIC_LAB_BASE_PATH':'"/studio"'}});
  const {chromium}=await import(pathToFileURL(browserModule).href);
  const browser=await chromium.launch({headless:true,...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL?{channel:process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL}:{})});
  const context=await browser.newContext(),failures=[],reads=[];
  let bytes,type;
  await context.route('**/*',async route=>{
    try {
      const request=route.request(),url=new URL(request.url());
      assert.equal(url.origin,origin,'no real services are contacted');assert.equal(request.method(),'GET');
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><script src="/fixture.js"></script>'});
      if(url.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
      assert.equal(url.pathname,'/studio/api/layer-assets/'+id);reads.push(type);
      return route.fulfill({contentType:type,body:bytes});
    } catch(error) {failures.push(error);return route.fulfill({status:500,body:'Isolated fixture failed'});}
  });
  try {
    const page=await context.newPage();page.on('pageerror',error=>failures.push(error));await page.goto(origin);
    // Same large dimension as Oak/Purple Rain: the actual resize path must run.
    const red=await sharp({create:{width:600,height:300,channels:4,background:{r:200,g:20,b:30,alpha:1}}}).png().toBuffer();
    for(const format of ['png','webp']) {
      type='image/'+format;
      bytes=await sharp({create:{width:1672,height:900,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:red}]).toFormat(format).toBuffer();
      const reference=await page.evaluate(value=>window.prepareMaterialReference(value),id);
      const prepared=Buffer.from(reference.split(',')[1],'base64'),metadata=await sharp(prepared).metadata();
      assert.equal(metadata.width,1536);assert.equal(metadata.hasAlpha,true);assert.ok(prepared.length<2*1024*1024);
      const {data,info}=await sharp(prepared).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(data[3],0,'transparent margins survive canvas encoding');
      const center=(Math.floor(info.height/2)*info.width+Math.floor(info.width/2))*4;
      assert.ok(data[center]>data[center+1]+100&&data[center+3]===255,'the visible red felt remains opaque');

      const calls=[],scope={environment:'test',workspaceId:'reference-test'},env={OPENAI_API_KEY:'fixture-key-not-real',CROUPIER_AI_IMAGE_ENABLED:'1'};
      const generated=await sharp({create:{width:64,height:36,channels:3,background:'#126544'}}).png().toBuffer();
      const api=createAiBackgroundApi({authorize:async()=>({user:'fixture',role:'admin',scope}),
        config:{scope,unifiedUi:true,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',allowedOrigins:[origin],publicHosts:['ai-reference.fixture.invalid']},
        setup:()=>aiImageSetup(env),enabled:()=>aiImageEnabled(env),log:()=>{},limiter:createAiImageDailyLimit(),fetchImpl:async(_target,init)=>{
          calls.push(JSON.parse(init.body));return Response.json({status:'completed',output:[{type:'image_generation_call',status:'completed',result:generated.toString('base64')}]});
        }});
      const composition=filmedTableFit('paow').suggested.composition,template=filmedTableTemplate('paow',{composition});
      const response=await api.handle(new Request(origin+'/studio/api/layer-assets/generate',{method:'POST',headers:{'content-type':'application/json',origin,'sec-fetch-site':'same-origin'},
        body:JSON.stringify({role:'table',dealerId:'paow',preset:'free',prompt:'Tjock läderrail',reference,count:1,sceneTemplate:{id:'standardplacering',composition}})}));
      assert.equal(response.status,200,await response.text());assert.equal(calls.length,1);
      const sent=calls[0].input[0].content;
      const mockup=await sharp(Buffer.from(sent[1].image_url.split(',')[1],'base64')).raw().toBuffer({resolveWithObject:true});
      const x=Math.round(template.dealer.center.x*mockup.info.width/template.canvas.width);
      const y=Math.round((template.dealer.box.y+template.dealer.box.height+12)*mockup.info.height/template.canvas.height);
      const pixel=[...mockup.data.subarray((y*mockup.info.width+x)*mockup.info.channels,(y*mockup.info.width+x)*mockup.info.channels+3)];
      assert.ok(pixel[0]>pixel[1]+15&&pixel[0]>pixel[2]+15,'server analysis uses red felt, not black margins: '+pixel);
    }
    assert.deepEqual(reads,['image/png','image/webp']);assert.deepEqual(failures,[]);
  } finally {await context.close();await browser.close();}
});
