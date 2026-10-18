import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioPreviewClient, studioPreviewFromDocument, validateStudioPreviewSession, requestEmbeddedStudioPreviewClose } from '../services/game/public/studio-preview-client.mjs';
import { decorateGameEntryHtml, validateStudioPreview } from '../services/game/public/game-entry-contract.mjs';
import { validateComposition } from '../packages/presentation/runtime/presentation-composition.mjs';
import { readChoices, writeChoices, choicesStorageKey } from '../packages/presentation/runtime/player-choices.mjs';
import { dealerVersionPath } from '../services/game/public/dealer-version-switcher.mjs';
import { createLocalPresentation } from '../services/game/public/local-presentation.mjs';
const id='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', asset='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const context={sessionId:id,presentationLaneId:'evening',projectRevision:'revision:7',expiresAt:'2030-01-01T00:00:00.000Z'};
test('embedded preview requests only its own closure at the current origin; standalone return stays unchanged',()=>{
 const calls=[],target={location:{origin:'https://studio.test'},parent:{postMessage:(...args)=>calls.push(args)}};
 assert.equal(requestEmbeddedStudioPreviewClose(context,target),true);
 assert.deepEqual(calls,[[{type:'croupier:studio-preview-close',sessionId:id},'https://studio.test']]);
 assert.throws(()=>requestEmbeddedStudioPreviewClose({...context,sessionId:'bad'},target));
 const standalone={location:target.location};standalone.parent=standalone;
 assert.equal(requestEmbeddedStudioPreviewClose(context,standalone),false);
 assert.equal(requestEmbeddedStudioPreviewClose(null,target),false);assert.equal(calls.length,1);
});
const metadata=value=>({authenticated:true,guest:false,preview:true,studioPreview:value,externalServices:{ai:false,speech:false},dealerAvailability:[{id:'astrid',label:'Astrid',playable:true,reason:null},{id:'linnea',label:'Linnea',playable:false,reason:'studio_preview_idle_required'}]});
const choices={dealers:['astrid','elin'],dealerDefault:'astrid',tableColors:[],tableDefault:null,background:{enabled:true,mode:'baked',allowed:[],default:null}};
const registry=[{id:'astrid',label:'Astrid'},{id:'elin',label:'Elin'}];
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
 await a.request('/api/presentation/config?dealerId=linnea');assert.equal(calls.at(-1).path,'/api/studio-preview/'+id+'/presentation/config?dealerId=linnea');
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
 writeChoices(storage,'example',{dealer:'elin'});
 writeChoices(storage,undefined,{dealer:'astrid'},id);
 writeChoices(storage,undefined,{dealer:'saga'},other);
 assert.deepEqual(readChoices(storage,'example'),{dealer:'elin'});
 assert.deepEqual(readChoices(storage,undefined,id),{dealer:'astrid'});
 assert.deepEqual(readChoices(storage,undefined,other),{dealer:'saga'});
 writeChoices(storage,undefined,{},id);
 assert.equal(map.has(choicesStorageKey(undefined,id)),false);
 assert.deepEqual(readChoices(storage,'example'),{dealer:'elin'});assert.deepEqual(readChoices(storage,undefined,other),{dealer:'saga'});
});
test('dealer switching retains preview session and rejects foreign context',t=>{
 const oldDocument=globalThis.document,oldLocation=globalThis.location;
 t.after(()=>{globalThis.document=oldDocument;globalThis.location=oldLocation;});
 globalThis.document={documentElement:{dataset}};
 globalThis.location={pathname:'/studio-preview/'+id,origin:'https://test.example'};
 assert.equal(dealerVersionPath('elin','original','?operator=live&table=foreign&lane=wrong'),'/studio-preview/'+id+'?dealer=elin');
 assert.throws(()=>dealerVersionPath('nora','original')); // Active but absent from this preview registry.
 assert.throws(()=>dealerVersionPath('mei','original')); // Retired dealers remain blocked.
 globalThis.location.pathname='/studio-preview/'+other;assert.throws(()=>dealerVersionPath('elin','original'));
});
test('own dealer starts its exact preview idle and cannot select paid OpenClaw modes',async t=>{
 const oldDocument=globalThis.document;
 const nodes=[];
 const node=tag=>({tag,children:[],dataset:{},style:{},append(...children){this.children.push(...children);},setAttribute(){},remove(){},getContext(){return {drawImage(){}};}});
 globalThis.document={hidden:false,createElement:tag=>{const result=node(tag);nodes.push(result);return result;},addEventListener(){},removeEventListener(){}};
 let presentation;
 t.after(()=>{presentation?.close();globalThis.document=oldDocument;});
 const video={id:asset,dealer:'linnea',fileName:'idle.webm',sha256:'a'.repeat(64),src:'/api/studio-preview/'+id+'/videos/'+asset};
 const config={defaultMode:'active',projectRevision:context.projectRevision,inventory:{videos:[video],families:[]},dealerIdle:{linnea:video}};
 const calls=[],frames=[];
 const transport=createStudioPreviewClient({context,fetchImpl:async(path)=>{calls.push(path);return Response.json(config);}});
 const host=node('host');
 presentation=await createLocalPresentation({host,dealerId:'linnea',transport,version:()=>0,receipt(){},onIdle(){},onBusy(){},muted:()=>false,
  player:{playLocalClip(media,options){frames.push(media);return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}));}}});

 presentation.start();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(frames.length,1);assert.equal(frames[0].media.src,video.src);
 assert.deepEqual(calls,['/api/studio-preview/'+id+'/presentation/config?dealerId=linnea','/api/studio-preview/'+id+'/presentation/config?dealerId=linnea']);
 const select=nodes.find(row=>row.tag==='select');
 assert.equal(select.value,'off');assert.deepEqual(select.children.map(row=>row.value),['off','rules','random']);
 await presentation.observeChat('Never send to paid AI');assert.equal(calls.length,2);
 presentation.close();
});

async function tierFixture(studioPreview=null) {
 const {readFile}=await import('node:fs/promises'),vm=await import('node:vm');
 const source=await readFile(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
 const nodes=new Map(),hints=[],link={search:''};
 const node=key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);};
 const sandbox=vm.createContext({studioPreview,round:null,busy:false,SEATS:7,selected:5,
  bets:Array.from({length:7},()=>({main:0,pp:0,tp:0})),undoStack:[],DEALER:{key:'astrid'},location:link,
  document:{querySelectorAll:()=>[]},$:node,buildChips(){},renderBets(){},hint:(...args)=>hints.push(args),
  fmt:String,console:{info(){}},flyChip(){},sfx:{play(){}},
  dealerVersionPath:()=>assert.fail('preset must not navigate'),ensureLogin:()=>assert.fail('invalid restored bets must not request login'),
  dealSequence:()=>assert.fail('invalid restored bets must not reach the server')});
 const run=code=>vm.runInContext(code,sandbox);
 const slice=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
 run(slice('const TABLES = [','// ---------- player account:'));
 run(slice('const betTotal =','const mains ='));
 run(slice('function setTable(id) {',"document.querySelectorAll('#table-pick .tbl').forEach(b => { b.onclick"));
 run(slice('let allSides = false;','seatEls.forEach((seat, i) => {'));
 run(slice("$('#double-btn').onclick =","// MAX:"));
 run(source.split('\n').find(line=>line.startsWith("$('#deal-now').onclick =")));
 run('balance=10000000;');
 return {run,node,hints,link,read:code=>JSON.parse(run('JSON.stringify('+code+')')),
  render:()=>run('{'+slice('  const staked = bets.filter','  layoutDealControl();')+'}')};
}

test('only Classic can be selected in ordinary play and preview; stale unsupported presets fall back without navigation',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../services/game/public/index.html',import.meta.url),'utf8');
 for(const id of ['high','vip'])assert.match(html,new RegExp('<button[^>]*data-id="'+id+'"[^>]*disabled[^>]*>[^<]+<small>UNAVAILABLE</small>'));
 for(const preview of [null,context]){
  const f=await tierFixture(preview);
  assert.deepEqual(f.read('[table.id,LIMITS.min,LIMITS.max]'),['classic',5,2000]);
  f.run('bets[0].main=25;undoStack.push({box:0,field:"main",value:25});');
  for(const id of ['high','vip','unknown']){
   f.run('setTable('+JSON.stringify(id)+');');
   assert.deepEqual(f.read('[table.id,bets[0].main,undoStack.length]'),['classic',25,1]);
  }
  // A stale caller cannot restore unsupported limits or their large chip ladder.
  f.run('table=TABLES.find(x=>x.id==="vip");CHIPS=table.chips;setTable("vip");');
  assert.deepEqual(f.read('[table.id,Math.max(...CHIPS),bets[0].main]'),['classic',1000,0]);
  assert.equal(f.link.search,'');
 }
});

test('actual Classic controls retain main and side caps and reject oversized restored drafts without sending them',async()=>{
 const f=await tierFixture();
 f.run('selected=1000;placeBet(0,"main",{});placeBet(0,"main",{});placeBet(0,"pp",{});placeBet(0,"tp",{});selected=5;placeBet(0,"main",{});placeBet(0,"pp",{});placeBet(0,"tp",{});');
 assert.deepEqual(f.read('bets[0]'),{main:2000,pp:1000,tp:1000});
 f.render();assert.equal(f.node('#deal-now').disabled,false);
 for(const [main,pp,tp] of [[50000,0,0],[5,1001,0],[5,0,1001]]){
  f.run('bets[0]='+JSON.stringify({main,pp,tp})+';');f.render();
  assert.equal(f.node('#deal-now').disabled,true);assert.match(f.node('#deal-now').title,/Reduce or clear/);
  await f.node('#deal-now').onclick();
  assert.deepEqual(f.read('bets[0]'),{main,pp,tp},'unsubmitted choices stay available to edit');
  assert.equal(f.hints.at(-1)[0],'CLASSIC LIMIT');
 }
 f.run('bets[0]={main:4,pp:0,tp:0};');f.render();assert.equal(f.node('#deal-now').disabled,true);
 f.run('bets[0].main=5;');f.render();assert.equal(f.node('#deal-now').disabled,false);
});

test('doubling respects existing Classic side caps as well as main cap and balance',async()=>{
 const f=await tierFixture();
 for(const key of ['pp','tp']){
  f.run('bets[0]={main:100,pp:0,tp:0};bets[0]['+JSON.stringify(key)+']=500;');f.render();
  assert.equal(f.node('#double-btn').disabled,false);f.node('#double-btn').onclick();f.render();
  assert.equal(f.read('bets[0].main'),200);assert.equal(f.read('bets[0]['+JSON.stringify(key)+']'),1000);
  assert.equal(f.node('#double-btn').disabled,true);
  const before=f.read('bets');f.node('#double-btn').onclick();assert.deepEqual(f.read('bets'),before);
 }
 f.run('bets[0]={main:2000,pp:0,tp:0};');f.render();assert.equal(f.node('#double-btn').disabled,true);
 f.run('bets[0]={main:100,pp:0,tp:0};balance=199;');f.render();assert.equal(f.node('#double-btn').disabled,true);
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
 const source=await readFile(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
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
 const loadProfile=async()=>{imports++;return import('../services/game/public/lissabon-profile.mjs');};
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
 const source=await readFile(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
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

async function returnLinkFixture({selection,preview=null,closeFails=false,embedded=false}={}){
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('const lobbyReturn ='),source.indexOf('for (const {id,label}'));
 const run=new Function('studioPreview','entrySelection','document','gameApi','writeChoices','choiceStorage','previewSessionId','soundStorageKey','location','window','requestEmbeddedStudioPreviewClose',block);
 const link={},events=[],storage={removeItem:key=>events.push(['remove',key])};
 const target={location:{origin:'https://studio.test'}};target.parent=embedded?{postMessage:(message,origin)=>events.push(['message',message,origin])}:target;
 run(preview,selection,{querySelector:()=>link},{close:async()=>{events.push(['close']);if(closeFails)throw Error('Expired');}},
  (...args)=>events.push(['choices',...args.slice(1)]),storage,preview?.sessionId??null,'preview-sound',
  {search:'?operator=foreign&table=foreign&returnTo=https://foreign.invalid',assign:href=>events.push(['navigate',href])},target,value=>requestEmbeddedStudioPreviewClose(value,target));
 return {link,events};
}

test('player return restores the server-selected lobby room without trusting query or guessing a room from composition',async()=>{
 const {gameLaneFromDocument}=await import('../packages/presentation/contracts/game-selection.mjs');
 const base={...dataset};delete base.studioPreview;
 for(const [fields,expected] of [
  [{gameOperator:'example',gamePackageRevision:'4',gameBranding:'{}',gameRoomId:'room-evening'},'/lobby?operator=example&room=room-evening'],
  [{gameOperator:'example'},'/lobby?operator=example'],[{},'/lobby']]){
  const {link,events}=await returnLinkFixture({selection:gameLaneFromDocument({...base,...fields})});
  assert.equal(link.href,expected);assert.equal(link.onclick,undefined);assert.deepEqual(events,[]);
 }
 for(const fields of [{gameOperator:'//foreign.invalid'}, {gameOperator:'example',gameRoomId:'../other'}, {gameRoomId:'room-evening'}]){
  assert.throws(()=>gameLaneFromDocument({...base,...fields}));
 }
});

test('preview return opens Admin with exact composition and dealer after closing only its isolated session',async()=>{
 const {gameLaneFromDocument}=await import('../packages/presentation/contracts/game-selection.mjs');
 const selected={...dataset,gameComposition:JSON.stringify(composition)};
 const selection=gameLaneFromDocument(selected),preview=studioPreviewFromDocument(selected,'/studio-preview/'+id);
 for(const closeFails of [false,true]){
  const {link,events}=await returnLinkFixture({selection,preview,closeFails});
  assert.equal(link.href,'/admin/compositions?composition=evening&dealer=astrid');assert.equal(link.textContent,'Till Sammansättning');
  for(const modifier of [{button:1},{button:0,ctrlKey:true},{button:0,metaKey:true},{button:0,shiftKey:true},{button:0,altKey:true}]){
   await link.onclick({...modifier,preventDefault(){assert.fail('modified click must retain normal browser behavior');}});assert.deepEqual(events,[]);
  }
  let prevented=false;await link.onclick({button:0,preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.deepEqual(events,[['close'],['choices',undefined,{},id],['remove','preview-sound'],['navigate',link.href]]);
 }
});
test('embedded preview return closes its session and asks the parent to stop, without loading Admin inside the frame',async()=>{
 const {link,events}=await returnLinkFixture({selection:{dealer:'astrid'},preview:context,embedded:true});
 assert.equal(link.textContent,'Stäng provspel');await link.onclick({button:0,preventDefault(){}});
 assert.deepEqual(events,[['close'],['choices',undefined,{},id],['remove','preview-sound'],['message',{type:'croupier:studio-preview-close',sessionId:id},'https://studio.test']]);
});
