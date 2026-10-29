// "Skapa bordsgrafik med AI" v2: the styles colour the 3D mock-up that is sent
// as the edit source, "Fri" with an inspiration image takes its dominant colour,
// and a table drawn for the fitted width answers with that placement. The
// provider is mocked; no request leaves the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {aiImageEnabled,aiImageSetup,createAiBackgroundApi,createAiImageDailyLimit} from '../lib/ai-background-api.mjs';
import {filmedTableFit,filmedTableRequestSize,filmedTableTemplate} from '../lib/filmed-table-template.mjs';
import {aiPlacementHash} from '../lib/ai-image-contract.mjs';

const origin='https://studio.example.invalid',scope={environment:'test',workspaceId:'studio-test'};
const config={scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid','studio.example.invalid']};
const env={OPENAI_API_KEY:'fixture-openai-key-not-real',CROUPIER_AI_IMAGE_ENABLED:'1'};
const post=body=>new Request(origin+'/studio/api/layer-assets/generate',{method:'POST',headers:{'content-type':'application/json',origin,'sec-fetch-site':'same-origin'},body:JSON.stringify(body)});
const png=async(width,height,color)=>sharp({create:{width,height,channels:3,background:color}}).png().toBuffer();
const dataUrl=(type,bytes)=>`data:${type};base64,${bytes.toString('base64')}`;
function api({calls=[]}={}) {
  return createAiBackgroundApi({authorize:async()=>({user:'Personal',role:'admin',scope}),config,setup:()=>aiImageSetup(env),enabled:()=>aiImageEnabled(env),
    log:()=>{},limiter:createAiImageDailyLimit(),fetchImpl:async(_target,init)=>{calls.push({body:JSON.parse(init.body)});
      return Response.json({status:'completed',output:[{type:'image_generation_call',status:'completed',result:(await png(64,36,{r:20,g:90,b:60})).toString('base64')}]});}});
}
test('table styles colour the 3D mock-up; "Fri" with an inspiration image takes its dominant colour; the fitted width is drawn as sent',async()=>{
  const fit=filmedTableFit('paow'),composition=fit.suggested.composition,template=filmedTableTemplate('paow',{composition});
  const feltAt=async (body)=>{
    const calls=[],response=await api({calls}).handle(post(body));
    assert.equal(response.status,200);
    const sent=calls[0].body.input[0].content,size=filmedTableRequestSize(template);
    assert.equal(calls[0].body.tools[0].size,`${size.width}x${size.height}`);
    const {data,info}=await sharp(Buffer.from(sent[1].image_url.split(',')[1],'base64')).raw().toBuffer({resolveWithObject:true});
    // Between the dealer spot and box 4: plain felt in the mock-up.
    const x=Math.round(template.dealer.center.x*info.width/template.canvas.width),y=Math.round((template.dealer.box.y+template.dealer.box.height+12)*info.height/template.canvas.height);
    return {text:sent[0].text,pixel:[...data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3)]};
  };
  const base={role:'table',dealerId:'paow',prompt:'Tjock läderrail',count:1,sceneTemplate:{id:'standardplacering',composition}};
  const luxury=await feltAt({...base,preset:'dark-luxury'});
  assert.match(luxury.text,/LOOK: Dark luxury/);assert.ok(Math.max(...luxury.pixel)<90,'near-black felt: '+luxury.pixel);
  const neon=await feltAt({...base,preset:'neon'});
  assert.match(neon.text,/LOOK: Aggressive neon/);assert.ok(neon.pixel[2]>neon.pixel[1],'violet felt: '+neon.pixel);
  const red=await png(64,64,{r:200,g:20,b:30});
  const free=await feltAt({...base,preset:'free',reference:dataUrl('image/png',red)});
  assert.match(free.text,/LOOK: follow the staff description and the reference photo/);
  assert.ok(free.pixel[0]>free.pixel[1]+15&&free.pixel[0]>free.pixel[2]+15,'the felt follows the inspiration: '+free.pixel);
  // The answer names the fitted placement, which "Använd i miljön" writes to the scene template.
  const answer=await (await api().handle(post({...base,preset:'casino'}))).json();
  assert.deepEqual(answer.fit,{dealerId:'paow',placement:aiPlacementHash(composition)});
  assert.deepEqual([answer.images[0].width,answer.images[0].height],[template.canvas.width,template.canvas.height]);
});
