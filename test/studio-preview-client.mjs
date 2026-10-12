import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioPreviewClient, studioPreviewFromDocument, validateStudioPreviewSession } from '../web/public/studio-preview-client.mjs';
import { decorateGameEntryHtml, validateStudioPreview } from '../web/public/game-entry-contract.mjs';
import { validateComposition } from '../web/public/presentation-composition.mjs';
import { readChoices, writeChoices, choicesStorageKey } from '../web/public/player-choices.mjs';
import { dealerVersionPath } from '../web/public/dealer-version-switcher.mjs';
import { createLocalPresentation } from '../web/public/local-presentation.mjs';
const id='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', asset='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const context={sessionId:id,presentationLaneId:'evening',projectRevision:'revision:7',expiresAt:'2030-01-01T00:00:00.000Z'};
const metadata=value=>({authenticated:true,guest:false,preview:true,studioPreview:value,externalServices:{ai:false,speech:false},dealerAvailability:[{id:'astrid',label:'Astrid',playable:true,reason:null},{id:'johanna',label:'Johanna',playable:false,reason:'studio_preview_idle_required'}]});
const choices={dealers:['astrid','vera'],dealerDefault:'astrid',tableColors:[],tableDefault:null,background:{enabled:true,mode:'baked',allowed:[],default:null}};
const registry=[{id:'astrid',label:'Astrid'},{id:'vera',label:'Vera'}];
const dataset={gameLocalDealer:'astrid',gameRegisteredDealers:JSON.stringify(registry),gameLane:'evening',gameDealer:'astrid',gamePresentation:'local',gameChoices:JSON.stringify(choices),studioPreview:JSON.stringify(context)};
const composition={schemaVersion:1,dealer:{enabled:true,compatibility:'per-clip'},
 table:{enabled:true,default:asset,allowed:[asset]},background:{enabled:true,mode:'image',default:null,allowed:[]},
 assets:[{id:asset,role:'table',label:'Testbord',contentType:'image/png',src:'/api/studio-preview/'+id+'/layers/'+asset}]};
test('preview metadata binds document, snapshot, exact session path and private composition',()=>{
 assert.deepEqual(validateStudioPreview(context),context);
 const d={...dataset,gameComposition:JSON.stringify(composition)};
 assert.deepEqual(studioPreviewFromDocument(d,'/studio-preview/'+id),context);
 assert.equal(studioPreviewFromDocument({},'/blackjack'),null);
 for(const [data,path]of [[{},'/studio-preview/'+id],[d,'/blackjack'],[d,'/studio-preview/'+other],
  [{...d,gameOperator:'example'},'/studio-preview/'+id],[{...d,gameLane:'other'},'/studio-preview/'+id],
  [{...d,gameComposition:JSON.stringify({...composition,assets:[{...composition.assets[0],src:composition.assets[0].src.replace(id,other)}]})},'/studio-preview/'+id]]) assert.throws(()=>studioPreviewFromDocument(data,path));
 for(const bad of [{...context,projectRevision:7},{...context,operator:'example'},{...context,sessionId:'../other'}])assert.throws(()=>validateStudioPreview(bad));
 const html=decorateGameEntryHtml('<html lang="sv">',{CROUPIER_STUDIO_NEON_POLICY:'1'},{lane:'evening',dealer:'astrid',presentation:'local',localDealer:'astrid',registeredDealers:registry,choices,composition,studioPreview:context});
 assert.match(html,/data-studio-preview="/);assert.match(html,/revision:7/);
 assert.throws(()=>decorateGameEntryHtml('<html>',{CROUPIER_STUDIO_NEON_POLICY:'1'},{lane:'evening',dealer:'astrid',presentation:'local',studioPreview:context,operator:'example'}));
 assert.deepEqual(validateComposition(composition),composition);
 for(const src of [composition.assets[0].src+'?bypass=1','//other.example/'+asset,'/api/studio-preview/bad/layers/'+asset,composition.assets[0].src.replace(asset,other)])
  assert.throws(()=>validateComposition({...composition,assets:[{...composition.assets[0],src}]}));
});
test('two preview clients and the ordinary game keep separate explicit transports',async()=>{
 const calls=[],fetchImpl=async(path,init)=>{calls.push({path,init});return new Response('{}');};
 const a=createStudioPreviewClient({context,fetchImpl}),b=createStudioPreviewClient({context:{...context,sessionId:other},fetchImpl}),live=createStudioPreviewClient({fetchImpl});
 const body=JSON.stringify({op:'state',id:'client-cannot-authorize'});
 await Promise.all([a.request('/api/table',{method:'POST',body}),b.request('/api/table',{method:'POST',body}),live.request('/api/table',{method:'POST',body})]);
 assert.deepEqual(calls.map(row=>row.path),['/api/studio-preview/'+id+'/table','/api/studio-preview/'+other+'/table','/api/table']);
 assert.ok(calls.every(row=>row.init.body===body));assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[2].init.credentials,undefined);
 await a.request('/api/presentation/config?dealerId=johanna');assert.equal(calls.at(-1).path,'/api/studio-preview/'+id+'/presentation/config?dealerId=johanna');
 const before=calls.length;
 for(const path of ['/api/deposit','/api/currency','/api/auth/logout','/api/bo/config','/api/chat/memory','/chat','//other.example/api/table','/api/table?operator=live'])
  await assert.rejects(a.request(path,{method:'POST'}));
 assert.equal(calls.length,before);
});
test('expired, mismatched and revoked sessions fail closed without a live fallback',async()=>{
 let calls=0;
 const expired=createStudioPreviewClient({context,now:()=>Date.parse(context.expiresAt),fetchImpl:()=>{calls++;}});
 await assert.rejects(expired.request('/api/auth/session'),{code:'studio_preview_expired'});assert.equal(calls,0);
 assert.deepEqual(validateStudioPreviewSession(metadata(context),context).studioPreview,context);
 assert.throws(()=>validateStudioPreviewSession(metadata({...context,sessionId:other}),context));
 assert.throws(()=>validateStudioPreviewSession({...metadata(context),preview:false},context));
 const revoked=createStudioPreviewClient({context,fetchImpl:async()=>{calls++;return new Response('{}',{status:403});}});
 await assert.rejects(revoked.request('/api/player',{method:'POST'}),{code:'studio_preview_unavailable'});assert.equal(calls,1);
 const a=createStudioPreviewClient({context});
 assert.equal(a.mediaUrl({id:asset}),'/api/studio-preview/'+id+'/videos/'+asset);
 assert.throws(()=>a.mediaUrl({id:asset,src:'/api/presentation/videos/'+asset}));
 assert.throws(()=>a.mediaUrl({id:asset,src:'/api/studio-preview/'+other+'/videos/'+asset}));
});
test('preview preference keys never read or overwrite ordinary or other preview choices',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
 writeChoices(storage,'example',{dealer:'vera'});
 writeChoices(storage,undefined,{dealer:'astrid'},id);
 writeChoices(storage,undefined,{dealer:'amira'},other);
 assert.deepEqual(readChoices(storage,'example'),{dealer:'vera'});
 assert.deepEqual(readChoices(storage,undefined,id),{dealer:'astrid'});
 assert.deepEqual(readChoices(storage,undefined,other),{dealer:'amira'});
 writeChoices(storage,undefined,{},id);
 assert.equal(map.has(choicesStorageKey(undefined,id)),false);
 assert.deepEqual(readChoices(storage,'example'),{dealer:'vera'});assert.deepEqual(readChoices(storage,undefined,other),{dealer:'amira'});
});
test('dealer switching retains preview session and rejects foreign context',t=>{
 const oldDocument=globalThis.document,oldLocation=globalThis.location;
 t.after(()=>{globalThis.document=oldDocument;globalThis.location=oldLocation;});
 globalThis.document={documentElement:{dataset}};
 globalThis.location={pathname:'/studio-preview/'+id,origin:'https://test.example'};
 assert.equal(dealerVersionPath('vera','original','?operator=live&table=foreign&lane=wrong'),'/studio-preview/'+id+'?dealer=vera');
 assert.throws(()=>dealerVersionPath('mei','original'));
 globalThis.location.pathname='/studio-preview/'+other;assert.throws(()=>dealerVersionPath('vera','original'));
});
test('own dealer starts its exact preview idle and cannot select paid OpenClaw modes',async t=>{
 const oldDocument=globalThis.document;
 const nodes=[];
 const node=tag=>({tag,children:[],dataset:{},style:{},append(...children){this.children.push(...children);},setAttribute(){},remove(){},getContext(){return {drawImage(){}};}});
 globalThis.document={hidden:false,createElement:tag=>{const result=node(tag);nodes.push(result);return result;},addEventListener(){},removeEventListener(){}};
 let presentation;
 t.after(()=>{presentation?.close();globalThis.document=oldDocument;});
 const video={id:asset,dealer:'johanna',fileName:'idle.webm',sha256:'a'.repeat(64),src:'/api/studio-preview/'+id+'/videos/'+asset};
 const config={defaultMode:'active',projectRevision:context.projectRevision,inventory:{videos:[video],families:[]},dealerIdle:{johanna:video}};
 const calls=[],frames=[];
 const transport=createStudioPreviewClient({context,fetchImpl:async(path)=>{calls.push(path);return Response.json(config);}});
 const host=node('host');
 presentation=await createLocalPresentation({host,dealerId:'johanna',transport,version:()=>0,receipt(){},onIdle(){},onBusy(){},muted:()=>false,
  player:{playLocalClip(media,options){frames.push(media);return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}));}}});

 presentation.start();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(frames.length,1);assert.equal(frames[0].media.src,video.src);
 assert.deepEqual(calls,['/api/studio-preview/'+id+'/presentation/config?dealerId=johanna','/api/studio-preview/'+id+'/presentation/config?dealerId=johanna']);
 const select=nodes.find(row=>row.tag==='select');
 assert.equal(select.value,'off');assert.deepEqual(select.children.map(row=>row.value),['off','rules','random']);
 await presentation.observeChat('Never send to paid AI');assert.equal(calls.length,2);
 presentation.close();
});

test('preview tier presets never navigate out of their selected dealer or session',async()=>{
 const {readFile}=await import('node:fs/promises'),vm=await import('node:vm');
 const source=await readFile(new URL('../web/public/app.mjs',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function setTable(id) {'),source.indexOf("document.querySelectorAll('#table-pick .tbl').forEach(b => { b.onclick"));
 const tables=[{id:'classic',name:'CLASSIC',dealer:'vera',chips:[5],min:5,max:2000},{id:'high',name:'HIGH',dealer:'vera',chips:[100],min:100,max:50000}];
 const link={search:''},base={TABLES:tables,table:tables[0],round:null,busy:false,DEALER:{key:'astrid'},location:link,
  bets:[],undoStack:[],balance:10000,CHIPS:tables[0].chips,URLSearchParams,document:{querySelectorAll:()=>[]},
  $:()=>({}),buildChips(){},renderBets(){},hint(){},fmt:String};
 const preview=vm.createContext({...base,studioPreview:context,dealerVersionPath:()=>assert.fail('preview preset must not navigate')});
 vm.runInContext(code+"\nsetTable('high');",preview);assert.equal(preview.table.id,'high');assert.equal(link.search,'');
 const regular=vm.createContext({...base,studioPreview:null,dealerVersionPath:dealer=>'/blackjack?dealer='+dealer});
 vm.runInContext(code+"\nsetTable('high');",regular);assert.equal(link.search,'');assert.equal(regular.table.id,'high');
});

test('closing one preview addresses only its owner-bound session',async()=>{
 const calls=[],fetchImpl=async(path,options)=>{calls.push({path,options});return new Response(null,{status:204});};
 const a=createStudioPreviewClient({context,fetchImpl}),b=createStudioPreviewClient({context:{...context,sessionId:other},fetchImpl});
 await a.close();await b.request('/api/table',{method:'POST',body:'{}'});
 assert.equal(calls[0].path,'/api/studio-preview/'+id);assert.equal(calls[0].options.method,'DELETE');
 assert.equal(calls[1].path,'/api/studio-preview/'+other+'/table');
 const count=calls.length;await assert.rejects(createStudioPreviewClient({fetchImpl}).close());assert.equal(calls.length,count);
});

test('preview never loads local profile UI or its ordinary session API; normal local play still does',async t=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../web/public/app.mjs',import.meta.url),'utf8');
 const at=source.indexOf("await import('./lissabon-profile.mjs')");
 assert.ok(at>0);
 const start=source.lastIndexOf('\nif ',at)+1,end=source.indexOf("document.querySelector('#sign-out')",at);
 const block=source.slice(start,end).replace("import('./lissabon-profile.mjs')","loadProfile()");
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('studioPreview','localPresentationEnabled','tableReady','loadProfile','round','busy','chatBusy','astridCamera','console',block);
 const originalFetch=globalThis.fetch,calls=[];
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({localDemoProfiles:false});};
 let imports=0;
 const loadProfile=async()=>{imports++;return import('../web/public/lissabon-profile.mjs');};
 const quietConsole={warn(...args){assert.fail(args.join(' '));}};
 for(const local of [true,false]){
  await run(context,local,Promise.resolve(),loadProfile,null,false,false,null,quietConsole);
  await new Promise(resolve=>setImmediate(resolve));
 }
 assert.equal(imports,0);assert.deepEqual(calls,[]);
 await run(null,true,Promise.resolve(),loadProfile,null,false,false,null,quietConsole);
 await new Promise(resolve=>setImmediate(resolve));
 // Loading an uncached ES module may finish after the first event loop turn.
 for(let i=0;i<20&&!calls.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(imports,1);assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/auth/session');
 await run(null,false,Promise.resolve(),loadProfile,null,false,false,null,quietConsole);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(imports,1);assert.equal(calls.length,1);
});

test('preview notice uses the existing HUD and hides inert chat without changing ordinary initialization',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../web/public/app.mjs',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('if (studioPreview) {'),source.indexOf('const choiceStorage='));
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('studioPreview','document','$','gameApi','STUDIO_PREVIEW_NOTICE','previewSession',block);
 const element=tag=>({tag,children:[],attrs:{},append(...rows){this.children.push(...rows);},setAttribute(key,value){this.attrs[key]=value;}});
 for(const preview of [null,context]){
  const nodes=Object.fromEntries(['#top-right','#chat','#chat-input','#chat-send','#add-funds','#sign-out','#wallet label'].map(id=>[id,element(id)]));
  const document={createElement:element,querySelector:selector=>nodes[selector],body:{append(){assert.fail('preview notice must remain in the HUD');}}};
  let sessions=0;
  await run(preview,document,selector=>nodes[selector],{session:async()=>{sessions++;return metadata(context);}},'Full preview explanation',null);
  assert.equal(sessions,preview?1:0);
  if(preview){
   const notice=nodes['#top-right'].children[0];
   assert.equal(notice.tag,'details');assert.equal(notice.id,'studio-preview-status');
   assert.equal(notice.children[0].textContent,'Provspel · separat testsaldo');
   assert.equal(notice.children[0].title,'Full preview explanation');
   assert.equal(notice.children[1].textContent,'Full preview explanation');
   assert.equal(nodes['#chat'].hidden,true);assert.equal(nodes['#chat'].inert,true);
   assert.equal(nodes['#chat-input'].disabled,true);assert.equal(nodes['#chat-send'].disabled,true);
  }else{assert.deepEqual(nodes['#top-right'].children,[]);assert.equal(nodes['#chat'].hidden,undefined);}
 }
});
