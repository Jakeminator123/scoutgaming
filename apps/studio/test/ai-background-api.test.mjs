import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {AI_IMAGE_DEFAULT_MODEL,AI_IMAGE_DEFAULT_REASONING,AI_IMAGE_RENDERER,aiImageConfiguration,aiImageEnabled,aiImageSetup,createAiBackgroundApi,createAiImageDailyLimit} from '../lib/ai-background-api.mjs';
import {filmedTableRequestSize,filmedTableTemplate} from '../lib/filmed-table-template.mjs';
import {AI_IMAGE_PROPOSAL_MAX_BYTES,AI_IMAGE_REFERENCE_MAX_BYTES,aiPlacementHash} from '../lib/ai-image-contract.mjs';
import {defaultCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';

// No real provider call anywhere: every test injects fetchImpl.
const origin='https://studio.example.invalid',scope={environment:'test',workspaceId:'studio-test'};
const config={scope,apiBase:'/studio/api/admin',authBase:'/studio/api/auth',allowedOrigins:['https://public.example.invalid',origin],publicHosts:['public.example.invalid','studio.example.invalid']};
const KEY='fixture-openai-key-not-real';
const env={OPENAI_API_KEY:KEY,CROUPIER_AI_IMAGE_ENABLED:'1'};
const staff=role=>async()=>({user:'Personal',role,scope});
const url=origin+'/studio/api/layer-assets/generate';
const post=(body,headers={})=>new Request(url,{method:'POST',headers:{'content-type':'application/json',origin,'sec-fetch-site':'same-origin',...headers},body:JSON.stringify(body)});
const get=()=>new Request(url,{headers:{'sec-fetch-site':'same-origin'}});
const background={role:'background',prompt:'Lugn kvällsstudio med mjukt sidoljus',preset:'dark-studio',count:1};
const felt={r:20,g:90,b:60};
const png=async(width=64,height=36,color=felt)=>sharp({create:{width,height,channels:3,background:color}}).png().toBuffer();
const dataUrl=(type,bytes)=>`data:${type};base64,${bytes.toString('base64')}`;

function provider(calls,{respond}={}) {
  return async (target,init)=>{
    calls.push({target,init,body:JSON.parse(init.body)});
    if (respond) return respond(calls.length);
    return Response.json({id:'resp_fixture',status:'completed',output:[{type:'reasoning',id:'rs_fixture',summary:[]},
      {type:'image_generation_call',id:'ig_fixture',status:'completed',result:(await png()).toString('base64')}]});
  };
}
function api({role='admin',calls=[],respond,limiter=createAiImageDailyLimit(),settings=env,logs=[],...rest}={}) {
  const flagged={CROUPIER_AI_IMAGE_ENABLED:'1',...settings};
  return createAiBackgroundApi({authorize:staff(role),config,setup:()=>aiImageSetup(flagged),enabled:()=>aiImageEnabled(flagged),
    log:event=>logs.push(event),limiter,fetchImpl:provider(calls,{respond}),...rest});
}

test('wrong role, foreign scope, foreign origin and missing login are refused at the direct address without a provider call',async()=>{
  for (const role of ['partner','viewer','player']) {
    const calls=[],handler=api({role,calls});
    for (const request of [post(background),get()]) {
      const response=await handler.handle(request);
      assert.equal(response.status,403,role);assert.equal((await response.json()).error,'studio_request_rejected');
    }
    assert.equal(calls.length,0);
  }
  const calls=[];
  const foreign=createAiBackgroundApi({authorize:async()=>({user:'Personal',role:'admin',scope:{environment:'test',workspaceId:'other'}}),config,configuration:()=>aiImageConfiguration(env),fetchImpl:provider(calls)});
  assert.equal((await foreign.handle(post(background))).status,403);
  for (const headers of [{origin:'https://foreign.example.invalid'},{'sec-fetch-site':'cross-site'},{'sec-fetch-site':'same-site'}]) {
    assert.equal((await api({calls}).handle(post(background,headers))).status,403,JSON.stringify(headers));
  }
  const anonymous=createAiBackgroundApi({authorize:async()=>{throw Object.assign(Error('studio_login_required'),{statusCode:401});},config,configuration:()=>aiImageConfiguration(env),fetchImpl:provider(calls)});
  assert.equal((await anonymous.handle(post(background))).status,401);
  assert.equal(calls.length,0);
});

test('a missing key answers ai_image_unavailable and "not connected" status without calling the provider',async()=>{
  for (const settings of [{},{OPENAI_API_KEY:''},{OPENAI_API_KEY:'   '},{OPENCLAW_MODEL_API_KEY:'',OPENAI_API_KEY:KEY}]) {
    const calls=[],handler=api({calls,settings});
    const response=await handler.handle(post(background));
    assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'ai_image_unavailable',code:'ai_image_unavailable'});
    assert.deepEqual(await (await handler.handle(get())).json(),{enabled:true,configured:false,problem:'missing_key',dailyLimit:0,remaining:0});
    assert.equal(calls.length,0);
  }
});

test('without CROUPIER_AI_IMAGE_ENABLED=1 the route answers ai_image_disabled, even with a key, and never calls',async()=>{
  for (const flag of [undefined,'','0','true','yes']) {
    const calls=[],handler=api({calls,settings:{OPENAI_API_KEY:KEY,CROUPIER_AI_IMAGE_ENABLED:flag}});
    const response=await handler.handle(post(background));
    assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'ai_image_disabled',code:'ai_image_disabled'});
    assert.deepEqual(await (await handler.handle(get())).json(),{enabled:false,configured:false,problem:null,dailyLimit:0,remaining:0});
    assert.equal(calls.length,0,String(flag));
  }
  assert.equal(aiImageEnabled({}),false);assert.equal(aiImageEnabled({CROUPIER_AI_IMAGE_ENABLED:'1'}),true);
});

test('the daily cap answers ai_image_limit_reached before any provider call',async()=>{
  const calls=[],limiter=createAiImageDailyLimit(),settings={...env,CROUPIER_AI_IMAGE_DAILY_LIMIT:'2'};
  const handler=api({calls,limiter,settings});
  assert.equal((await handler.handle(post({...background,count:2}))).status,200);
  assert.equal(calls.length,2);
  assert.deepEqual(await (await handler.handle(get())).json(),{enabled:true,configured:true,problem:null,dailyLimit:2,remaining:0});
  const refused=await handler.handle(post(background));
  assert.equal(refused.status,429);assert.equal((await refused.json()).code,'ai_image_limit_reached');
  assert.equal(calls.length,2,'no call once the cap is reached');
  const off=[],closed=await api({calls:off,settings:{...env,CROUPIER_AI_IMAGE_DAILY_LIMIT:'0'}}).handle(post(background));
  assert.equal(closed.status,429);assert.equal(off.length,0);
  // A request larger than what is left is refused whole, without a partial call.
  const partial=[],cap=api({calls:partial,settings:{...env,CROUPIER_AI_IMAGE_DAILY_LIMIT:'2'}});
  assert.equal((await cap.handle(post({...background,count:3}))).status,429);assert.equal(partial.length,0);
});

test('the cap follows the Stockholm day and counts attempts, not only successes',()=>{
  let now=Date.parse('2026-10-28T22:30:00Z');
  const limiter=createAiImageDailyLimit({clock:()=>now});
  assert.equal(limiter.reserve(3,3),true);assert.equal(limiter.reserve(3,1),false);
  now=Date.parse('2026-10-28T22:59:00Z');assert.equal(limiter.remaining(3),0,'23:59 in Stockholm is the same day');
  now=Date.parse('2026-10-28T23:01:00Z');assert.equal(limiter.remaining(3),3,'00:01 in Stockholm starts a new day');
  assert.equal(limiter.reserve(3,0),false);assert.equal(limiter.reserve(3,1.5),false);
});

test('invalid requests, including table graphics without a filmed profile, are refused without a call',async()=>{
  const calls=[],handler=api({calls});
  for (const body of [
    {...background,prompt:'ab'},{...background,prompt:'x'.repeat(601)},{...background,prompt:'bild\u0000'},{...background,preset:'Lounge'},
    {...background,count:0},{...background,count:4},{...background,count:'2'},{...background,role:'dealer'},{...background,extra:true},
    {...background,dealerId:'paow'},{...background,role:'table'},{...background,role:'table',dealerId:'astrid'},{...background,role:'table',dealerId:'okänd'},
    {role:'background',prompt:'Studio',preset:'free'},null,[],
  ]) {
    const response=await handler.handle(post(body));
    assert.equal(response.status,400,JSON.stringify(body));assert.equal((await response.json()).code,'ai_image_invalid_request');
  }
  const text=new Request(url,{method:'POST',headers:{'content-type':'text/plain',origin,'sec-fetch-site':'same-origin'},body:'{}'});
  assert.equal((await handler.handle(text)).status,400);
  assert.equal(calls.length,0);
});

test('a reference image is validated on the server: wrong type, false signature and oversize are refused',async()=>{
  const calls=[],handler=api({calls}),image=await png();
  const jpeg=await sharp({create:{width:32,height:32,channels:3,background:felt}}).jpeg().toBuffer();
  for (const reference of [dataUrl('image/gif',image),dataUrl('image/svg+xml',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    dataUrl('image/png',jpeg),dataUrl('image/png',Buffer.alloc(AI_IMAGE_REFERENCE_MAX_BYTES+1,1)),'https://example.invalid/bild.png',
    dataUrl('image/png',Buffer.concat([image.subarray(0,8),Buffer.alloc(64,7)]))]) {
    const response=await handler.handle(post({...background,reference}));
    assert.equal(response.status,400,reference.slice(0,40));assert.equal((await response.json()).code,'ai_image_invalid_request');
  }
  assert.equal(calls.length,0);
});

test('the mocked provider gives 1920 x 1080 proposals from gpt-6.1-sol with the fixed frame, references and forbidden content',async()=>{
  const calls=[],handler=api({calls});
  const photo=await sharp({create:{width:1536,height:1024,channels:3,background:{r:120,g:60,b:40}}}).withMetadata({exif:{IFD0:{Copyright:'Privat foto'}}}).jpeg().toBuffer();
  const response=await handler.handle(post({...background,count:2,preset:'warm-lounge',reference:dataUrl('image/jpeg',photo)}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ok,true);assert.equal(body.images.length,2);assert.equal(body.remaining,18);
  for (const image of body.images) {
    assert.match(image.id,/^[a-f0-9-]{36}$/);assert.deepEqual([image.width,image.height],[1920,1080]);
    assert.match(image.dataUrl,/^data:image\/webp;base64,/);
    const bytes=Buffer.from(image.dataUrl.split(',')[1],'base64'),metadata=await sharp(bytes).metadata();
    assert.deepEqual([metadata.format,metadata.width,metadata.height],['webp',1920,1080]);
    assert.ok(bytes.length<=750*1024);
  }
  assert.equal(calls.length,2);
  for (const [index,{target,init,body:sent}] of calls.entries()) {
    assert.equal(target,'https://api.openai.com/v1/responses');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
    assert.equal(init.headers.Authorization,`Bearer ${KEY}`,'the key goes to the provider only');
    assert.equal(sent.model,AI_IMAGE_DEFAULT_MODEL);assert.equal(sent.model,'gpt-6.1-sol');
    assert.deepEqual(sent.reasoning,{effort:AI_IMAGE_DEFAULT_REASONING});assert.equal(sent.reasoning.effort,'xhigh');
    assert.equal(sent.store,false);assert.deepEqual(sent.tool_choice,{type:'image_generation'});
    assert.deepEqual(sent.tools,[{type:'image_generation',model:AI_IMAGE_RENDERER,size:'1920x1088',quality:'high',output_format:'png',action:'generate'}]);
    assert.equal(AI_IMAGE_RENDERER,'gpt-image-2.5-sunburst');
    const [part,...images]=sent.input[0].content,text=part.text;
    assert.equal(part.type,'input_text');
    for (const phrase of ['1920x1080','x 656-1264','PHONE CROP','DEALER SAFE AREA','TABLE SAFE AREA','text, letters, digits','logos','people, faces','playing cards, chips, markers','amber, walnut',
      'Lugn kvällsstudio med mjukt sidoljus',`VARIATION ${index+1} of 2`]) assert.ok(text.includes(phrase),phrase);
    // The reference photo goes along, re-encoded in memory without its metadata.
    assert.equal(images.length,1);assert.equal(images[0].type,'input_image');assert.match(images[0].image_url,/^data:image\/jpeg;base64,/);
    const sentPhoto=await sharp(Buffer.from(images[0].image_url.split(',')[1],'base64')).metadata();
    assert.equal(sentPhoto.exif,undefined);assert.deepEqual([sentPhoto.width,sentPhoto.height],[1536,1024]);
  }
  // Without a reference, nothing but the brief is sent.
  const plain=[];await api({calls:plain}).handle(post({...background,preset:'free'}));
  assert.equal(plain[0].body.input[0].content.length,1);assert.match(plain[0].body.input[0].content[0].text,/PRESET: none; follow the staff description only/);
});

test('model, reasoning and cap are configurable; invalid values switch the feature off',()=>{
  assert.deepEqual({...aiImageConfiguration(env)},{apiKey:KEY,endpoint:'https://api.openai.com/v1/responses',model:'gpt-6.1-sol',renderer:'gpt-image-2.5-sunburst',reasoning:'xhigh',dailyLimit:20});
  assert.equal(aiImageConfiguration({...env,CROUPIER_AI_IMAGE_RENDERER:'gpt-image-2.5-flare'}).renderer,'gpt-image-2.5-flare');
  assert.equal(aiImageConfiguration({...env,CROUPIER_AI_IMAGE_RENDERER:'Bild 2'}),null);
  assert.deepEqual((({model,reasoning,dailyLimit})=>({model,reasoning,dailyLimit}))(aiImageConfiguration({...env,CROUPIER_AI_IMAGE_MODEL:'gpt-6.1-terra',CROUPIER_AI_IMAGE_REASONING:'max',CROUPIER_AI_IMAGE_DAILY_LIMIT:'5'})),
    {model:'gpt-6.1-terra',reasoning:'max',dailyLimit:5});
  for (const extra of [{CROUPIER_AI_IMAGE_REASONING:'extreme'},{CROUPIER_AI_IMAGE_MODEL:'GPT 6'},{CROUPIER_AI_IMAGE_DAILY_LIMIT:'-1'},{CROUPIER_AI_IMAGE_DAILY_LIMIT:'1001'},{CROUPIER_AI_IMAGE_DAILY_LIMIT:'tio'},
    {OPENCLAW_MODEL_BASE_URL:'http://api.openai.com/v1'}]) assert.equal(aiImageConfiguration({...env,...extra}),null,JSON.stringify(extra));
  // A non-OpenAI base needs its own explicit key; the site key is never sent elsewhere.
  assert.equal(aiImageConfiguration({...env,OPENCLAW_MODEL_BASE_URL:'https://proxy.example.invalid/v1'}),null);
  assert.equal(aiImageConfiguration({OPENCLAW_MODEL_API_KEY:'proxy-key',OPENCLAW_MODEL_BASE_URL:'https://proxy.example.invalid/v1'}).endpoint,'https://proxy.example.invalid/v1/responses');
});

test('provider failures become fixed codes; neither the key nor the provider text reaches the browser',async()=>{
  const leak=`Incorrect API key ${KEY}; organisation org-private; prompt "hemlig"`;
  for (const [respond,status,code] of [
    [()=>Response.json({error:{message:leak,type:'invalid_request_error',code:'moderation_blocked'}},{status:400}),422,'ai_image_rejected'],
    [()=>Response.json({error:{message:leak,code:'insufficient_quota'}},{status:429}),429,'ai_image_budget_exhausted'],
    [()=>Response.json({error:{message:leak,code:'billing_hard_limit_reached'}},{status:400}),429,'ai_image_budget_exhausted'],
    [()=>Response.json({error:{message:leak,code:'rate_limit_exceeded'}},{status:429}),503,'ai_image_unavailable'],
    [()=>Response.json({error:{message:leak,code:'invalid_api_key'}},{status:401}),503,'ai_image_unavailable'],
    [()=>new Response(leak,{status:500}),503,'ai_image_unavailable'],
    [()=>{throw new Error(leak);},503,'ai_image_unavailable'],
    [()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:leak}]}]}),422,'ai_image_rejected'],
    [()=>Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]}),503,'ai_image_unavailable'],
    [()=>Response.json({status:'completed',output:[{type:'image_generation_call',status:'completed',result:Buffer.from(leak).toString('base64')}]}),503,'ai_image_unavailable'],
    [()=>new Response('{"status":"completed","output":[',{status:200}),503,'ai_image_unavailable'],
  ]) {
    const calls=[],response=await api({calls,respond}).handle(post(background));
    const text=await response.text();
    assert.equal(response.status,status,code);assert.deepEqual(JSON.parse(text),{error:code,code});
    for (const secret of [KEY,'org-private','hemlig','Incorrect API key','rate_limit_exceeded','insufficient_quota']) assert.equal(text.includes(secret),false,secret);
    assert.equal(calls.length,1);
  }
  // One failed proposal does not hide the others.
  const calls=[],mixed=await api({calls,respond:async index=>index===1?Response.json({error:{message:leak}},{status:500})
    :Response.json({status:'completed',output:[{type:'image_generation_call',status:'completed',result:(await png()).toString('base64')}]})}).handle(post({...background,count:3}));
  assert.equal(mixed.status,200);assert.equal((await mixed.json()).images.length,2);
});

test('table mode sends the computed landing template and draws the boxes exactly on the filmed landings',async()=>{
  const calls=[],handler=api({calls}),template=filmedTableTemplate('paow'),size=filmedTableRequestSize(template);
  const response=await handler.handle(post({role:'table',dealerId:'paow',prompt:'Mörkgrön filt med smal guldkant',preset:'casino',count:1}));
  assert.equal(response.status,200);
  const [proposal]=(await response.json()).images;
  assert.deepEqual([proposal.width,proposal.height],[template.canvas.width,template.canvas.height]);
  const sent=calls[0].body,[brief,landing]=sent.input[0].content;
  assert.equal(sent.tools[0].action,'edit');assert.equal(sent.tools[0].size,`${size.width}x${size.height}`);
  assert.match(brief.text,/rendered 3D mock-up/);assert.match(brief.text,/FORBIDDEN: text, letters, digits/);assert.match(brief.text,/painted box outlines/);
  assert.match(brief.text,/LOOK: Classic casino/);assert.match(brief.text,/"Grön filt".*"Lila neon".*"Ljus ek"/s,'the pre-made tables as words');
  const reference=await sharp(Buffer.from(landing.image_url.split(',')[1],'base64')).metadata();
  assert.deepEqual([reference.format,reference.width,reference.height],['png',size.width,size.height]);
  const {data,info}=await sharp(Buffer.from(proposal.dataUrl.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,4);
  const pixel=(x,y)=>{const at=(Math.round(y)*info.width+Math.round(x))*4;return [...data.subarray(at,at+4)];};
  assert.equal(pixel(4,4)[3],0,'outside the table is transparent');
  // Below the rail the apron and the pedestal stay; beside the pedestal the scene shows through.
  assert.equal(pixel(template.canvas.width/2,template.canvas.height-2)[3],255,'the pedestal reaches the frame');
  assert.equal(pixel(4,template.canvas.height-2)[3],0,'beside the pedestal is transparent');
  for (const seat of [...template.seats,template.dealer]) {
    const inside=pixel(seat.center.x,seat.center.y),edge=pixel(seat.box.x,seat.center.y);
    assert.equal(inside[3],255);assert.ok(Math.abs(inside[1]-felt.g)<24,'felt inside the box');
    assert.ok(edge[0]+edge[1]+edge[2]>inside[0]+inside[1]+inside[2]+150,'the drawn box edge is at the computed position');
  }
});

// The table-template work's placement (bordsmatt-paow.json): desktop 50 % / y 35 %, phone 158 % / y 35 %.
function facitComposition() {
  const composition=defaultCompositionSettings();
  composition.desktop.table={width:.5,x:0,y:.35};composition.mobile.table={width:1.58,x:0,y:.35};
  return composition;
}
test('a table graphic follows the chosen scene template: facit placement gives facit measurements, none gives the defaults',async()=>{
  const table={role:'table',dealerId:'paow',prompt:'Grön filt',preset:'casino',count:1};
  const calls=[],handler=api({calls});
  const response=await handler.handle(post({...table,sceneTemplate:{id:'paow-bord',composition:facitComposition()}}));
  assert.equal(response.status,200);
  const [proposal]=(await response.json()).images;
  assert.deepEqual([proposal.width,proposal.height],[1920,1404]);
  assert.equal(calls[0].body.tools[0].size,'1920x1408');assert.match(calls[0].body.input[0].content[0].text,/scene template paow-bord/);
  // Seat 4 of the facit lands at u 960, v 498.38: felt there, the drawn box edge at x 901.5.
  const {data,info}=await sharp(Buffer.from(proposal.dataUrl.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const pixel=(x,y)=>{const at=(Math.round(y)*info.width+Math.round(x))*4;return [...data.subarray(at,at+4)];};
  const centre=pixel(960,498.38),edge=pixel(901.5,498.38);
  assert.equal(centre[3],255);assert.ok(edge[0]+edge[1]+edge[2]>centre[0]+centre[1]+centre[2]+150);
  for (const body of [table,{...table,sceneTemplate:null},{...table,sceneTemplate:{id:'utan-placering'}}]) {
    const plain=[],result=await api({calls:plain}).handle(post(body));
    assert.equal(result.status,200);
    const [image]=(await result.json()).images;
    assert.deepEqual([image.width,image.height],[1215,2074]);assert.equal(plain[0].body.tools[0].size,'1216x2080');
  }
});

test('an invalid scene template or composition is refused as ai_image_invalid_request without a call',async()=>{
  const table={role:'table',dealerId:'paow',prompt:'Grön filt',preset:'casino',count:1},calls=[],handler=api({calls});
  const wide=facitComposition();wide.desktop.table.width=9;
  const skewed=facitComposition();skewed.mobile.table.x=.2;
  for (const sceneTemplate of [{id:'Bad Id',composition:facitComposition()},{id:'',composition:facitComposition()},{id:'x'.repeat(64)},{id:'mall',composition:{mobile:{}}},
    {id:'mall',composition:wide},{id:'mall',composition:{...facitComposition(),extra:true}},{id:'mall',composition:skewed},{id:'mall',composition:facitComposition(),label:'Mall'},'mall',[]]) {
    const response=await handler.handle(post({...table,sceneTemplate}));
    assert.equal(response.status,400,JSON.stringify(sceneTemplate).slice(0,80));assert.equal((await response.json()).code,'ai_image_invalid_request');
  }
  const {dealerId:_dealer,...background}=table;
  assert.equal((await handler.handle(post({...background,role:'background',sceneTemplate:{id:'mall'}}))).status,400);
  assert.equal(calls.length,0);
});

test('the server logs only the provider status and error code, never text, prompt or key',async()=>{
  const leak=`Incorrect API key ${KEY}; prompt "Hemlig kvällsstudio"`;
  for (const [respond,expected] of [
    [()=>Response.json({error:{message:leak,code:'moderation_blocked'}},{status:400}),{status:400,code:'moderation_blocked'}],
    [()=>Response.json({error:{message:leak,code:'insufficient_quota'}},{status:429}),{status:429,code:'insufficient_quota'}],
    [()=>Response.json({error:{message:leak,code:leak}},{status:401}),{status:401,code:null}],
    [()=>new Response(leak,{status:500}),{status:500,code:null}],
    [()=>{throw new Error(leak);},{status:null,code:'fetch_failed'}],
    [()=>Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]}),{status:200,code:'max_output_tokens'}],
  ]) {
    const logs=[],response=await api({respond,logs}).handle(post({...background,prompt:'Hemlig kvällsstudio'}));
    assert.notEqual(response.status,200);assert.deepEqual(logs,[expected]);
    for (const secret of [KEY,'Hemlig','Incorrect']) assert.equal(JSON.stringify(logs).includes(secret),false,secret);
  }
  const quiet=[];assert.equal((await api({logs:quiet}).handle(post(background))).status,200);assert.deepEqual(quiet,[]);
});

// A noise image is the worst case for WebP; the answer must still stay under 3 MB.
async function noisePng(width,height) {
  const raw=Buffer.alloc(width*height*3);
  for (let index=0;index<raw.length;index++) raw[index]=(Math.imul(index+1,2654435761)>>>24)&255;
  return sharp(raw,{raw:{width,height,channels:3}}).png({compressionLevel:1}).toBuffer();
}
test('three worst-case proposals stay under 3 MB in total, each WebP within 700 KiB',async()=>{
  for (const [body,width,height] of [[{...background,count:3},1920,1088],
    [{role:'table',dealerId:'paow',prompt:'Grön filt',preset:'casino',count:3,sceneTemplate:{id:'paow-bord',composition:facitComposition()}},1920,1408]]) {
    const noise=(await noisePng(width,height)).toString('base64'),calls=[];
    const handler=api({calls,respond:()=>Response.json({status:'completed',output:[{type:'image_generation_call',status:'completed',result:noise}]})});
    const response=await handler.handle(post(body)),text=await response.text();
    assert.equal(response.status,200,body.role);
    const {images}=JSON.parse(text);
    assert.equal(images.length,3);assert.ok(text.length<3*1024*1024,`${body.role}: ${text.length} bytes`);
    // Noise may be sent smaller, but always with the frame's aspect.
    const aspect=body.role==='table'?1920/1404:16/9;
    for (const image of images) {
      assert.match(image.dataUrl,/^data:image\/webp;base64,/);
      const bytes=Buffer.from(image.dataUrl.split(',')[1],'base64'),metadata=await sharp(bytes).metadata();
      assert.ok(bytes.length<=AI_IMAGE_PROPOSAL_MAX_BYTES);assert.deepEqual([metadata.width,metadata.height],[image.width,image.height]);
      assert.ok(Math.abs(image.width/image.height-aspect)<.01);
    }
  }
});

test('a table answer names the dealer and the placement it was drawn for; a background has none',async()=>{
  const table={role:'table',dealerId:'paow',prompt:'Grön filt',preset:'casino',count:1};
  const plain=await (await api().handle(post(table))).json();
  assert.deepEqual(plain.fit,{dealerId:'paow',placement:aiPlacementHash(defaultCompositionSettings())});
  const placed=await (await api().handle(post({...table,sceneTemplate:{id:'paow-bord',composition:facitComposition()}}))).json();
  assert.deepEqual(placed.fit,{dealerId:'paow',placement:aiPlacementHash(facitComposition())});
  assert.notEqual(placed.fit.placement,plain.fit.placement);
  assert.equal(Object.hasOwn(await (await api().handle(post(background))).json(),'fit'),false);
});

test('the inspiration image is checked for dimensions on the server: over 1536 px is refused',async()=>{
  const calls=[],handler=api({calls});
  for (const [width,height] of [[1537,100],[100,2000],[12,12]]) {
    const image=await sharp({create:{width,height,channels:3,background:felt}}).png().toBuffer();
    const response=await handler.handle(post({...background,reference:dataUrl('image/png',image)}));
    assert.equal(response.status,400,`${width}x${height}`);assert.equal((await response.json()).code,'ai_image_invalid_request');
  }
  assert.equal(calls.length,0);
  const fits=await sharp({create:{width:1536,height:864,channels:3,background:felt}}).webp().toBuffer();
  assert.equal((await handler.handle(post({...background,reference:dataUrl('image/webp',fits)}))).status,200);
  assert.equal(calls[0].body.input[0].content[1].type,'input_image');
});

test('an invalid renderer, model, reasoning, cap or API form is "invalid setting", told apart from a missing key',async()=>{
  for (const extra of [{CROUPIER_AI_IMAGE_RENDERER:'Bild 2'},{CROUPIER_AI_IMAGE_MODEL:'GPT 6'},{CROUPIER_AI_IMAGE_REASONING:'extreme'},{CROUPIER_AI_IMAGE_DAILY_LIMIT:'tio'},
    {OPENCLAW_MODEL_API:'openai-completions'},{OPENCLAW_MODEL_BASE_URL:'http://api.openai.com/v1'}]) {
    const calls=[],handler=api({calls,settings:{...env,...extra}});
    const response=await handler.handle(post(background));
    assert.equal(response.status,503,JSON.stringify(extra));assert.deepEqual(await response.json(),{error:'ai_image_misconfigured',code:'ai_image_misconfigured'});
    assert.deepEqual(await (await handler.handle(get())).json(),{enabled:true,configured:false,problem:'invalid_setting',dailyLimit:0,remaining:0});
    assert.equal(calls.length,0);
  }
  assert.deepEqual({...aiImageSetup({OPENAI_API_KEY:KEY})},{settings:aiImageConfiguration({OPENAI_API_KEY:KEY}),problem:null});
  assert.equal(aiImageSetup({}).problem,'missing_key');
});

// Landing check: synthetic images only. A calm grey felt with fine grain passes,
// a checkered pattern warns, and a warning never removes the proposal.
async function syntheticPng(width,height,shade) {
  const raw=Buffer.alloc(width*height*3);
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const value=Math.max(0,Math.min(255,Math.round(shade(x,y)))),at=(y*width+x)*3;
    raw[at]=value;raw[at+1]=value;raw[at+2]=value;
  }
  return sharp(raw,{raw:{width,height,channels:3}}).png().toBuffer();
}
const grain=(x,y)=>((Math.imul(y*7919+x+1,2654435761)>>>24)/255-.5)*12;
const calm=base=>(x,y)=>base+grain(x,y);
const checkered=(x,y)=>((Math.floor(x/8)+Math.floor(y/8))%2?190:60);
const respondWith=bytes=>()=>Response.json({status:'completed',output:[{type:'image_generation_call',status:'completed',result:bytes.toString('base64')}]});
const ZONES=['box-1','box-2','box-3','box-4','box-5','box-6','box-7','dealer'];

test('table landing check: calm felt passes, a checkered felt warns on every zone, a dark felt under a dark stroke warns on contrast',async()=>{
  const template=filmedTableTemplate('paow'),size=filmedTableRequestSize(template),table={role:'table',dealerId:'paow',prompt:'Grå filt',preset:'casino',count:1};
  const ask=async(bytes,body=table)=>{
    const response=await api({respond:respondWith(bytes)}).handle(post(body));
    assert.equal(response.status,200,'a warning never refuses the proposal');
    const [proposal]=(await response.json()).images;
    assert.match(proposal.dataUrl,/^data:image\/webp;base64,/);
    return proposal.check;
  };
  const quiet=await ask(await syntheticPng(size.width,size.height,calm(70)));
  assert.equal(quiet.ok,true,JSON.stringify(quiet.worst));
  assert.deepEqual(quiet.zones.map(zone=>zone.zone),ZONES);
  for (const zone of quiet.zones) { assert.ok(zone.spread<8&&zone.edges<.01&&zone.contrast>=3,JSON.stringify(zone)); assert.equal(zone.ok,true); }
  assert.ok(quiet.worst.score<=1&&ZONES.includes(quiet.worst.zone));
  const busy=await ask(await syntheticPng(size.width,size.height,checkered));
  assert.equal(busy.ok,false);assert.ok(['busy','edges'].includes(busy.worst.reason));assert.ok(busy.worst.score>1);
  assert.ok(busy.zones.every(zone=>!zone.ok),'the pattern covers every landing');
  // Light studio draws a dark stroke; on a near-black felt it disappears.
  const dark=await ask(await syntheticPng(size.width,size.height,()=>18),{...table,preset:'light-studio'});
  assert.equal(dark.ok,false);assert.equal(dark.worst.reason,'low_contrast');assert.ok(dark.zones.every(zone=>zone.contrast<3));
  // Detail only between the boxes leaves the landings calm.
  const boxes=[...template.seats,template.dealer].map(seat=>seat.box);
  const scaleX=size.width/template.canvas.width,scaleY=size.height/template.canvas.height;
  const inBox=(x,y)=>boxes.some(box=>x>=box.x*scaleX-4&&x<=(box.x+box.width)*scaleX+4&&y>=box.y*scaleY-4&&y<=(box.y+box.height)*scaleY+4);
  const between=await ask(await syntheticPng(size.width,size.height,(x,y)=>inBox(x,y)?calm(70)(x,y):checkered(x,y)));
  assert.equal(between.ok,true,JSON.stringify(between.worst));
  // One busy box is named as the worst zone.
  const four=template.seats.find(seat=>seat.id==='4').box;
  const inFour=(x,y)=>x>=four.x*scaleX&&x<=(four.x+four.width)*scaleX&&y>=four.y*scaleY&&y<=(four.y+four.height)*scaleY;
  const one=await ask(await syntheticPng(size.width,size.height,(x,y)=>inFour(x,y)?checkered(x,y):calm(70)(x,y)));
  assert.equal(one.ok,false);assert.equal(one.worst.zone,'box-4');
  assert.deepEqual(one.zones.filter(zone=>!zone.ok).map(zone=>zone.zone),['box-4']);
});

test('background landing check covers the area behind the dealer and the phone strip only',async()=>{
  const ask=async bytes=>{
    const response=await api({respond:respondWith(bytes)}).handle(post(background));
    assert.equal(response.status,200);
    return (await response.json()).images[0].check;
  };
  const quiet=await ask(await syntheticPng(1920,1088,(x,y)=>calm(40+y/20)(x,y)));
  assert.equal(quiet.ok,true,JSON.stringify(quiet.worst));assert.deepEqual(quiet.zones.map(zone=>zone.zone),['dealer','phone']);
  assert.ok(quiet.zones.every(zone=>zone.contrast===null),'a background has no box stroke');
  const busy=await ask(await syntheticPng(1920,1088,checkered));
  assert.equal(busy.ok,false);assert.ok(busy.zones.every(zone=>!zone.ok));
  // Detail on the desktop-only sides (outside x 656-1264) is allowed.
  const sides=await ask(await syntheticPng(1920,1088,(x,y)=>x<600||x>1320?checkered(x,y):calm(50)(x,y)));
  assert.equal(sides.ok,true,JSON.stringify(sides.worst));
  // A busy area above the table line behind the head warns as "dealer".
  const head=await ask(await syntheticPng(1920,1088,(x,y)=>x>800&&x<1120&&y<380?checkered(x,y):calm(50)(x,y)));
  assert.equal(head.ok,false);assert.equal(head.worst.zone,'dealer');
});
