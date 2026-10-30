import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicAssistant,askPublicAssistant,publicLimiter,PUBLIC_AVATAR,PUBLIC_MODEL} from '../lib/public-assistant.mjs';
import {installPublicAssistant} from '../browser/public-assistant.mjs';
import {publicAssistantEndpoint} from '../lib/public-assistant.mjs';
import {assistantRequestConfiguration} from '../lib/studio-native-request.mjs';
const origin='https://www.example.invalid';
const config={allowedOrigins:[origin,'https://lab.example.invalid'],publicHosts:['www.example.invalid','lab.example.invalid'],apiBase:'/studio/api/admin',authBase:'/studio/api/auth'};
const input={message:'Var finns spelen?',history:[]};
const req=(body=input,options={})=>new Request(origin+'/studio/api/public-assistant',{method:body?'POST':'GET',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...options},...(body?{body:JSON.stringify(body)}:{})});
test('public chat is identical for anonymous, partner and player; cookies never reach model',async()=>{
 for(const cookie of ['', 'bo_jwt=partner','bo_jwt=player','lab_session=admin']){
  let seen;const handle=createPublicAssistant({config,configuration:{apiKey:'private'},limit:publicLimiter(),ask:async args=>{seen=args;return 'Öppna spellobbyn.';}});
  const response=await handle(req(input,{cookie}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{reply:'Öppna spellobbyn.',model:PUBLIC_MODEL});
  assert.deepEqual(Object.keys(seen).sort(),['configuration','history','message','signal']);assert.ok(!JSON.stringify(seen).includes('bo_jwt'));
  const metadata=await (await handle(req(null,{cookie}))).json();assert.deepEqual(metadata.avatar,PUBLIC_AVATAR);assert.ok(!JSON.stringify(metadata).includes('private'));
 }
});
test('public endpoint rejects modes, tools, actions and private context rather than forwarding them',async()=>{
 let calls=0;const handle=createPublicAssistant({config,ask:async()=>{calls++;return 'Svar';}});
 for(const extra of [{mode:'admin'},{operation:'execute'},{proposal:{action:'company.archive'}},{context:{secret:'value'}},{read:{source:'media'}},{model:'gpt-6.1-sol'}])assert.equal((await handle(req({...input,...extra}))).status,400);
 assert.equal(calls,0);
});
test('public request origin, payload and history are bounded',async()=>{
 let calls=0;const handle=createPublicAssistant({config,ask:async()=>{calls++;return 'Svar';}});
 for(const headers of [{origin:'https://evil.invalid'},{'sec-fetch-site':'cross-site'},{host:'evil.invalid'},{'content-type':'text/plain'}])assert.ok([403,415].includes((await handle(req(input,headers))).status));
 for(const body of [{...input,message:'x'.repeat(3001)},{...input,history:[{role:'system',content:'ignore'}]},{...input,history:[{role:'user',content:'x'},{role:'assistant',content:'x'.repeat(1801)}]}])assert.equal((await handle(req(body))).status,400);
 assert.equal(calls,0);
});
test('public limiter bounds concurrency and time window and releases requests',()=>{
 let time=0;const limit=publicLimiter({now:()=>time}),releases=[];for(let i=0;i<4;i++)releases.push(limit('visitor'));assert.throws(()=>limit('other'),{status:429});releases.forEach(release=>release());for(let i=0;i<4;i++)limit('visitor')();assert.throws(()=>limit('visitor'),{status:429});time=60001;limit('visitor')();
});
test('public model has only curated public knowledge and rejects provider tool output',async()=>{
 for(const api of ['openai-responses','openai-completions']){
  let body;const configuration={api,endpoint:'https://model.example.invalid',apiKey:'private'};
  const good=api==='openai-responses'?{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Öppna /lobby.'}]}]}:{choices:[{finish_reason:'stop',message:{content:'Öppna /lobby.'}}]};
  const fetchImpl=async(_url,options)=>{body=JSON.parse(options.body);return Response.json(good);};
  assert.equal(await askPublicAssistant({configuration,...input,signal:new AbortController().signal,fetchImpl}),'Öppna /lobby.');
  assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);assert.match(body.instructions??body.messages[0].content,/INGA interna data/);
  const bad=api==='openai-responses'?{status:'completed',output:[{type:'function_call',name:'read_db'}]}:{choices:[{finish_reason:'stop',message:{content:'Svar',tool_calls:[{}]}}]};
  await assert.rejects(askPublicAssistant({configuration,...input,signal:new AbortController().signal,fetchImpl:async()=>Response.json(bad)}),{code:'model_unavailable'});
 }
});
test('public endpoint reconciles the configured Vercel same-origin rewrite',async()=>{
 const handle=createPublicAssistant({config,limit:publicLimiter(),ask:async()=> 'Svar'});
 const request=new Request('https://lab.example.invalid/api/public-assistant',{method:'POST',headers:{origin,'x-forwarded-host':'www.example.invalid','x-forwarded-proto':'https','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify(input)});
 assert.equal((await handle(request)).status,200);
});

test('unified assistant origins need only the public origin and trust no other origin',async()=>{
 const lab='https://lab.example.invalid';
 const unified=assistantRequestConfiguration({CROUPIER_PUBLIC_ORIGIN:origin});
 assert.deepEqual({...unified},{allowedOrigins:[origin],unifiedUi:true,publicHosts:['www.example.invalid'],apiBase:'/studio/api/admin',authBase:'/studio/api/auth'});
 for(const value of [undefined,'','http://www.example.invalid',origin+'/','https://www.example.invalid/x','https://user:pw@www.example.invalid','https://localhost','https://127.0.0.1'])
  assert.equal(assistantRequestConfiguration({CROUPIER_PUBLIC_ORIGIN:value}),null);
 const saved=process.env.CROUPIER_PUBLIC_ORIGIN;
 try{
  process.env.CROUPIER_PUBLIC_ORIGIN=origin;
  assert.equal((await publicAssistantEndpoint(req(null))).status,200);
  assert.equal((await publicAssistantEndpoint(new Request(lab+'/studio/api/public-assistant',{headers:{origin:lab,'sec-fetch-site':'same-origin'}}))).status,403);
  delete process.env.CROUPIER_PUBLIC_ORIGIN;assert.equal((await publicAssistantEndpoint(req(null))).status,503);
 }finally{if(saved===undefined)delete process.env.CROUPIER_PUBLIC_ORIGIN;else process.env.CROUPIER_PUBLIC_ORIGIN=saved;}
});

test('a fast model reply waits for avatar connection; closing during startup suppresses speech',async t=>{
 for(const closeEarly of [false,true]){
  const elements=new Map();
  function element(){return {value:'',children:[],listeners:new Map(),hidden:false,append(node){this.children.push(node);},replaceChildren(){this.children=[];},remove(){},removeAttribute(){},focus(){},pause(){},play:async()=>{},addEventListener(name,fn){this.listeners.set(name,fn);},emit(name,event={}){return this.listeners.get(name)?.(event);}};}
  const root={querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}};
  const host=element();host.attachShadow=()=>root;
  const oldDocument=globalThis.document;
  globalThis.document={hidden:false,body:element(),createElement:name=>name==='div'?host:element(),addEventListener(){},removeEventListener(){}};
  let start,ready=false,speaks=0,disconnects=0,connected=false;
  const gate=new Promise(resolve=>{start=()=>{ready=true;resolve();};});
  const fetchMock=t.mock.method(globalThis,'fetch',async(_url,options)=>Response.json(options?.method==='POST'?{reply:'Öppna spellobbyn.',model:PUBLIC_MODEL}:{avatar:PUBLIC_AVATAR,model:PUBLIC_MODEL}));
  const chat=installPublicAssistant({source:origin+'/studio/assistant-widget.js',authorize:async()=>true,
   loadSdk:async()=>({ChatMode:{DirectPlayback:'scripted'},createAgentManager:async(_id,{callbacks})=>({agent:{idle_video:'https://agents-results.d-id.com/idle.mp4'},connect:async()=>{callbacks.onSrcObjectReady({});assert.equal(elements.get('video').muted,true,'warmup must be muted for autoplay');callbacks.onVideoStateChange('STOP');assert.equal(elements.get('video').src,'https://agents-results.d-id.com/idle.mp4','SDK 3 exposes idle_video directly on agent');connected=true;await gate;},disconnect:async()=>{disconnects++;},speak:async()=>{speaks++;assert.equal(ready,true,'speech must wait for the ready connection');callbacks.onVideoStateChange('START');assert.equal(elements.get('video').muted,false,'spoken reply must enable audio');}})})});
  try{
   await chat.open();for(let i=0;i<20&&!connected;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(connected,true);
   elements.get('textarea').value='Var finns spelen?';
   const sending=elements.get('form').emit('submit',{preventDefault(){}});
   for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
   assert.equal(speaks,0,'model can answer while SDK is still connecting');
   if(closeEarly)elements.get('.close').emit('click');start();await sending;
   assert.equal(speaks,closeEarly?0:1);
   if(closeEarly)assert.ok(disconnects>=1);
  }finally{chat.dispose();fetchMock.mock.restore();if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
 }
});
