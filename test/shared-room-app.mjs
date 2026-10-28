import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { createSharedRoomController } from '../services/game/public/shared-room-controller.mjs';
import { createSharedRoomView } from '../services/game/public/shared-room-view.mjs';
import { createSharedRoomPresentationPorts, mountSharedRoomPresentation } from '../services/game/public/shared-room-presentation.mjs';
import { createSharedRoomCommandClient } from '../services/game/public/shared-room-command-client.mjs';
import { createSharedRoomClient } from '../services/game/public/shared-room-client.mjs';
import { mountSharedRoomApp } from '../services/game/public/shared-room-app.mjs';
import { createMemoryTableStore } from './fixtures/blackjack-table-memory-store.mjs';
import { createTableCoordinator } from '../services/game/games/blackjack/table/coordinator.mjs';
import { presentationForRow } from '../services/game/games/blackjack/presentation/outbox-presentation.mjs';
import { deterministicRandom } from './fixtures/blackjack-deterministic-random.mjs';
import { DRAGAN_KEVIN_PROFILE as dragan } from '../packages/presentation/contracts/filmed-profiles/kevin-dragan-f15b2af1.mjs';
const roomId='room-a',actor='alice';
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
function snapshot(version=0,extra={}){
  return {contract:'blackjack-table/1',roomId,version,presentationVer:0,configVersion:'cfg-1',windowId:'window-1',
    phase:'bets',roundId:null,turnSeq:0,owners:Array(7).fill(null),seatGen:Array(7).fill(0),bets:Array.from({length:7},()=>({main:0,pp:0,tp:0})),
    players:[],deadline:null,actionDeadline:null,plan:null,round:null,serverNow:1000,unopened:version===0,
    settings:{configVersion:'cfg-1',language:'sv',betMs:20000,actionMs:15000,limits:{min:.5,max:2000,sideMax:100},chips:[.5,1,5],refill:1000},
    me:{id:actor,seats:[],memberGen:0,active:false,available:1000,pausedUntil:0,insuranceDue:false,lastSettlement:null},...extra};
}
function seated(version=1,extra={}){return snapshot(version,{owners:[actor,null,null,null,null,null,null],seatGen:[1,0,0,0,0,0,0],players:[{id:actor,seats:[0],ready:false,leaving:false}],me:{id:actor,seats:[0],memberGen:1,active:true,available:1000,pausedUntil:0,insuranceDue:false,lastSettlement:null},...extra});}
function presentationBinding(s=snapshot(),{dealer='astrid',packageRevision=1,branding={}}={}){
  return {owner:'web',roomId,configVersion:s.configVersion,windowId:s.windowId,
    presentationContext:{operatorSlug:'north',roomId,packageRevision,dealerId:dealer},
    selection:{lane:'saved',dealer,presentation:'local',localDealer:dealer,registeredDealers:[{id:dealer,label:dealer}],operator:'north',roomId,packageRevision,branding}};
}
const bindingResponse=url=>{const query=new URL(url,'https://game.invalid').searchParams;return Response.json(presentationBinding({configVersion:query.get('configVersion'),windowId:query.get('windowId')}));};
function harness(t,options={}){
  const calls=[],renders=[],events=[];let send=options.send??(async intent=>({status:'ok',result:{op:intent.op,version:10},commandId:'id-1',replay:false}));
  const commands=options.commands??{state:'idle',send(intent){calls.push(intent);return send(intent);},retry(){return send();},stop(){this.state='stopped';}};
  const view={bind(value){this.actions=value;},render(value){renders.push(value);},close(){events.push('view-close');}};
  const presentation=options.presentation??{restoreSnapshot(s){events.push('restore:'+s.version);},present(p){events.push('present:'+p.ver);},close(){events.push('media-close');}};
  const controller=createSharedRoomController({roomId,commands,view,presentation,now:options.now??(()=>1000)});
  t.after(()=>controller.stop());
  return{controller,calls,renders,events,commands,view,setSend:fn=>send=fn,restore:(s,signal)=>controller.restoreSnapshot(s,{signal:signal??new AbortController().signal})};
}

test('binding latency counts toward the server turn and action deadline',async t=>{
  let now=100;const gate=deferred();let restoredOptions;
  const h=harness(t,{now:()=>now,presentation:{restoreSnapshot:async(_s,options)=>{restoredOptions=options;await gate.promise;},present(){},close(){}}});
  const s=seated(2,{phase:'round',roundId:'round-2',serverNow:1000,plan:{turnAt:1100},actionDeadline:1300,
    round:{phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand']}});
  const restoring=h.controller.restoreSnapshot(s,{receivedAt:100});now=300;
  assert.deepEqual(h.renders.at(-1).can.act,[],'binding must still authorize controls');
  gate.resolve();await restoring;
  assert.equal(restoredOptions.receivedAt,100);
  assert.equal(h.renders.at(-1).serverNow,1200);
  assert.deepEqual(h.renders.at(-1).can.act,['hit','stand'],'binding delay must not postpone the turn');
  now=450;await h.controller.dispatch('act',{action:'hit'});
  assert.equal(h.calls.length,0,'the elapsed deadline must not be extended by binding latency');
});

test('a queued presentation uses receipt time and restores expired cards without playing old film',async()=>{
  const calls=[];const ports=createSharedRoomPresentationPorts({clock:()=>500,
    media:{state(){},present(){calls.push('film');},close(){}},
    cards:{restore(){calls.push('cards');},sync(){},clear(){},close(){}}});
  ports.restoreSnapshot(seated(1),{receivedAt:100});
  ports.restoreSnapshot(seated(2,{presentationVer:1}),{receivedAt:100});calls.length=0;
  try { await ports.present({roomId,ver:1,kind:'plan',startAt:1000,endAt:1100,events:[{type:'deal',shoeDraw:1}]});
    assert.deepEqual(calls,['cards']);
  } finally {ports.close();}
});

test('first join uses server generations and waits for WS; HTTP results cannot invent seats, balance or cards',async t=>{
  const h=harness(t);await h.restore(snapshot());
  assert.equal(h.renders.at(-1).can.join,true);assert.equal(h.renders.at(-1).can.bet,false);
  await h.controller.dispatch('join',{seat:2});
  assert.deepEqual(h.calls,[{op:'join',memberGen:0,seats:[2],seatGens:{2:0}}]);
  assert.equal(h.controller.state.snapshot.version,0);assert.deepEqual(h.controller.state.snapshot.me.seats,[]);
  assert.equal(h.controller.state.snapshot.me.available,1000);assert.equal(h.renders.at(-1).can.join,false);
  const s=seated(10,{owners:[null,null,actor,null,null,null,null],seatGen:[0,0,1,0,0,0,0],me:{...seated().me,seats:[2]}});
  await h.restore(s);assert.equal(h.controller.state.waiting,null);assert.equal(h.renders.at(-1).can.bet,true);
});

test('all server command intents use current window, membership and turn identifiers',async t=>{
  const h=harness(t);let version=1;
  h.setSend(async intent=>({status:'ok',result:{op:intent.op,version},replay:false}));
  const reset=async extra=>h.restore(seated(version++,extra));
  for(const op of ['bet','undo','clear','doubleBets','allSeats','repeat','ready']){
    await reset({bets:[{main:5,pp:0,tp:0},...snapshot().bets.slice(1)],me:{...seated().me,lastSettlement:{roundId:'r0',returned:0,hands:[{box:0}]}}});
    await h.controller.dispatch(op,op==='bet'?{seat:0,field:'pp'}:undefined);
    const expected={op,windowId:'window-1',...(op==='bet'?{seat:0,field:'pp',chip:.5}:op==='allSeats'?{chip:.5}:{})};
    assert.deepEqual(h.calls.at(-1),expected);await reset();
  }
  await h.controller.dispatch('leave');assert.deepEqual(h.calls.at(-1),{op:'leave',memberGen:1});await reset();
  const round={phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand','double','split']};
  await reset({phase:'round',roundId:'round-7',turnSeq:19,round});
  await h.controller.dispatch('act',{action:'split'});assert.deepEqual(h.calls.at(-1),{op:'act',roundId:'round-7',turnSeq:19,box:0,handIndex:0,action:'split'});
  await reset({phase:'round',roundId:'round-7',round:{...round,phase:'insurance'},me:{...seated().me,insuranceDue:true}});
  await h.controller.dispatch('insurance',{take:false});assert.deepEqual(h.calls.at(-1),{op:'insurance',roundId:'round-7',phase:'insurance',take:false});
  await reset({phase:'settled',roundId:'round-7'});await h.controller.dispatch('next');assert.deepEqual(h.calls.at(-1),{op:'next',roundId:'round-7'});
  await reset();await h.controller.dispatch('refill');assert.deepEqual(h.calls.at(-1),{op:'refill'});
  await reset();h.setSend(async()=>({status:'ok',result:{op:'pause',pausedUntil:90000},replay:false}));
  await h.controller.dispatch('pause');assert.deepEqual(h.calls.at(-1),{op:'pause'});assert.deepEqual(h.controller.state.waiting,{pausedUntil:90000});
});

test('stale or foreign controls cannot write; a disconnected snapshot cannot authorize a new command',async t=>{
  const h=harness(t),connection=new AbortController();await h.restore(seated(2),connection.signal);
  await h.controller.dispatch('bet',{seat:6,field:'main'});assert.equal(h.calls.length,0);
  await h.controller.dispatch('act',{action:'hit'});assert.equal(h.calls.length,0);
  connection.abort();await h.controller.dispatch('refill');assert.equal(h.calls.length,0);assert.equal(h.renders.at(-1).connected,false);
  await h.restore(seated(3,{windowId:'window-9',seatGen:[4,0,0,0,0,0,0]}));
  await h.controller.dispatch('bet',{seat:0,field:'main'});assert.equal(h.calls[0].windowId,'window-9');
  await assert.rejects(h.restore(seated(1)),{message:'shared_room_invalid_controls'});
});

test('uncertain HTTP result blocks new intents and explicit retry preserves exact original ID and body',async t=>{
  const requests=[];let attempts=0;
  const commands=createSharedRoomCommandClient({roomId,randomUUID:()=> 'fixed-command',fetchImpl:async(url,init)=>{
    requests.push({url,body:init.body});if(++attempts===1)return new Response('unavailable',{status:503});
    return Response.json({result:{op:'bet',version:2,reserved:.5},replay:true,snapshot:seated(2)});
  }});
  const h=harness(t,{commands});await h.restore(seated());await h.controller.dispatch('bet',{seat:0,field:'main'});
  assert.equal(commands.state,'uncertain');assert.equal(h.renders.at(-1).retry,true);
  await h.controller.dispatch('refill');assert.equal(requests.length,1);assert.equal(h.controller.state.snapshot.version,1);
  await h.controller.retry();assert.equal(requests.length,2);assert.deepEqual(requests[1],requests[0]);
  assert.equal(h.controller.state.snapshot.version,1);await h.restore(seated(2));assert.equal(h.controller.state.waiting,null);
});

test('late async restore after close cannot restore authority or restart controls',async t=>{
  const gate=deferred();const h=harness(t,{presentation:{restoreSnapshot:()=>gate.promise,present(){},close(){}}});
  const restore=h.restore(seated());h.controller.stop();gate.resolve();await restore;
  assert.equal(h.controller.state.snapshot,null);assert.equal(h.controller.state.closed,true);assert.equal(h.commands.state,'stopped');
  await h.controller.dispatch('refill');assert.equal(h.calls.length,0);
});

test('pending presentation binding disables connected controls and retries until the latest restore completes',async t=>{
  const gate=deferred();let restores=0;
  const h=harness(t,{presentation:{restoreSnapshot(){if(++restores===2)return gate.promise;},present(){},close(){}}});
  await h.restore(seated(1));const pending=h.restore(seated(2));
  assert.equal(h.controller.state.connected,false);assert.equal(h.renders.at(-1).can.bet,false);
  await h.controller.dispatch('refill');assert.equal(h.calls.length,0);
  h.commands.state='uncertain';let retries=0;h.commands.retry=()=>{retries++;};
  await h.controller.retry();assert.equal(retries,0);assert.equal(h.renders.at(-1).retry,false);
  h.commands.state='idle';await h.restore(seated(3));assert.equal(h.controller.state.connected,true);
  gate.resolve();await pending;assert.equal(h.controller.state.snapshot.version,3,'a superseded async restore cannot replace the latest authority');
});

test('presentation restores reconnect cards without old replay; new events use exact frame callbacks after snapshot',async()=>{
  const trace=[];let selected;
  const cards=Object.fromEntries(['restore','sync','clear','show','reveal','close'].map(key=>[key,(...args)=>trace.push([key,...args])]));
  cards.begin=(video,event)=>{trace.push(['begin',video.id,event.shoeDraw]);return 7;};cards.frame=(...args)=>trace.push(['frame',...args]);cards.finish=(...args)=>trace.push(['finish',...args]);
  const media={state(){},prepareSequence(){},async present(event,options){trace.push(['media',event.type]);options.onSelected({id:'exact'},event);options.onFrame(.5);return true;},close(){}};
  const ports=createSharedRoomPresentationPorts({cards,media,clock:()=>1000});
  const first=new AbortController();ports.restoreSnapshot(seated(3,{presentationVer:3}),{signal:first.signal});
  const p={roomId,ver:3,talkId:'talk-3',endAt:2000,events:[{type:'deal',to:'player',box:0,shoeDraw:1}]};
  await ports.present(p,{signal:first.signal});assert.deepEqual(trace.map(row=>row[0]),['restore']);
  ports.restoreSnapshot(seated(4,{presentationVer:4}),{signal:first.signal});await ports.present({...p,ver:4},{signal:first.signal});
  assert.deepEqual(trace.map(row=>row[0]),['restore','sync','media','begin','frame','finish']);
  assert.deepEqual(trace.at(-1),['finish',7,1,true]);first.abort();
  ports.restoreSnapshot(seated(5,{presentationVer:5}),{signal:new AbortController().signal});
  await ports.present({...p,ver:5});assert.equal(trace.at(-1)[0],'restore');ports.close();
});

// K04 F9: the media asks the step's own card cursor whether its card shows before it writes an error line.
test('a filmed step tells its media whether the card of its own film already shows on the table',async()=>{
  const asked=[],tokens=[];
  const cards=Object.fromEntries(['restore','sync','clear','show','reveal','close','frame','finish'].map(key=>[key,()=>{}]));
  cards.begin=()=>7;cards.shown=token=>{tokens.push(token);return true;};
  const media={state(){},prepareSequence(){},async present(event,options){asked.push(options.shown());options.onSelected({id:'exact'},event);asked.push(options.shown());return true;},close(){}};
  const ports=createSharedRoomPresentationPorts({cards,media,clock:()=>1000}),signal=new AbortController().signal;
  const p={roomId,ver:3,talkId:'talk-3',endAt:2000,events:[{type:'deal',to:'player',box:0,shoeDraw:1}]};
  ports.restoreSnapshot(seated(3,{presentationVer:3}),{signal});await ports.present(p,{signal});
  ports.restoreSnapshot(seated(4,{presentationVer:4}),{signal});await ports.present({...p,ver:4},{signal});
  assert.deepEqual(asked,[false,true],'no card cursor before the film is selected');assert.deepEqual(tokens,[7]);ports.close();
});

class Element extends EventTarget {
  constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};const styles=new Map();this.style={setProperty:(key,value)=>styles.set(key,String(value)),getPropertyValue:key=>styles.get(key)??'',removeProperty:key=>styles.delete(key)};this.hidden=false;this.disabled=false;this.className='';this._text='';this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  setAttribute(name,value){this.attributes[name]=String(value);}append(...children){for(const child of children)if(child instanceof Element)child.parentNode=this;this.children.push(...children);}prepend(...children){this.children.unshift(...children);}replaceChildren(...children){this._text='';this.children=children;}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
  remove(){this.removed=true;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
}
function documentFixture(){
  const ids=['scene','seats','chips','balance','total-bet','last-win','banner','deal-now','insurance','ins-yes','ins-no','actions','actions-top','undo-btn','clear-btn','double-btn','max-btn','all-sides','add-funds','pitboss','presentation-loading','caption','limits','chat','table-pick'];
  const nodes=new Map(ids.map(id=>[id,new Element()])),acts=['hit','stand','double','split'].map(action=>{const node=new Element('button');node.dataset.act=action;return node;});
  const document={documentElement:{style:new Element().style,dataset:{sharedRoom:'1',gameLane:'saved',gameDealer:'astrid',gameLocalDealer:'astrid',gamePresentation:'local',gameRegisteredDealers:JSON.stringify([{id:'astrid',label:'Astrid'}]),gameOperator:'north',gamePackageRevision:'1',gameBranding:'{}',gameRoomId:roomId}},
    getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),querySelector:selector=>nodes.get(selector.slice(1)),querySelectorAll:selector=>selector==='[data-act]'?acts:[]};
  return{document,nodes,acts};
}
async function bindingHarness(t,{fetchImpl=async url=>bindingResponse(url),createPresentation,document:givenDocument,bindingRetryDelaysMs}={}){
  const {document:defaultDocument,nodes}=documentFixture(),document=givenDocument??defaultDocument;
  const window=new EventTarget();window.location={origin:'https://game.invalid'};
  const writes=[],mounts=[],renders=[];let socketOptions,stops=0;
  const commands={state:'idle',send:async intent=>{writes.push(intent);return{status:'rejected',httpStatus:409,code:'STALE_COMMAND'};},stop(){this.state='stopped';}};
  const app=await mountSharedRoomApp({document,window,fetchImpl,createCommands:()=>commands,...(bindingRetryDelaysMs?{bindingRetryDelaysMs}:{}),
    createView:()=>({bind(){},render:value=>renders.push(value),close(){}}),
    createSocket:options=>{socketOptions=options;return{start(){},stop(){stops++;}};},
    createPresentation:async options=>{mounts.push(options);return createPresentation?createPresentation(options):
      (options.onReady(options.selection.dealer),{restoreSnapshot(){},present(){},close(){}});}});
  t.after(app.close);
  return{...app,document,window,nodes,writes,mounts,renders,commands,get stops(){return stops;},
    restore:(value,signal=new AbortController().signal)=>socketOptions.restoreSnapshot(value,{signal})};
}

// K04 at 400 kbit/s: the idle clip alone outlasted the 30 s render/startup limits.
// The binding is still read twice around the mount; the dealer's first frame is not a gate.
test('new shared client ignores a newer HTML dealer and opens controls once the active binding is confirmed after mounting, before any dealer frame',async t=>{
  const {document}=documentFixture();Object.assign(document.documentElement.dataset,{gameDealer:'nora',gameLocalDealer:'nora',gamePackageRevision:'9'});
  const mounted=deferred(),confirmed=deferred(),requests=[];let loaded;
  const active=presentationBinding(seated(3),{dealer:'astrid',packageRevision:1,branding:{color:'#123456'}});
  const h=await bindingHarness(t,{document,fetchImpl:async(url,init)=>{requests.push({url,init});return requests.length===1?Response.json(active):confirmed.promise;},
    createPresentation:async options=>{loaded=options;await mounted.promise;return{restoreSnapshot(){},present(){},close(){}};}});
  assert.equal(h.mounts.length,0,'media is not selected before the server snapshot');
  const restoring=h.restore(seated(3));await turn();
  assert.equal(loaded.selection.packageRevision,1);assert.equal(loaded.selection.dealer,'astrid');assert.equal(requests.length,1);
  await h.controller.dispatch('refill');assert.equal(h.writes.length,0);assert.equal(h.controller.state.connected,false);
  mounted.resolve();await turn();await turn();
  assert.equal(requests.length,2,'the server checks the binding again as soon as the adapter is mounted, without a dealer frame');
  assert.equal(h.controller.state.connected,false);assert.equal(document.documentElement.dataset.presentationStartup,'pending');
  for(const {url,init}of requests){
    assert.equal(url,'/api/presentation/shared-room/room-a/binding?configVersion=cfg-1&windowId=window-1');
    assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.credentials,'same-origin');assert.equal(init.mode,'same-origin');
    assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.equal(new Headers(init.headers).has('authorization'),false);assert.ok(init.signal instanceof AbortSignal);
  }
  confirmed.resolve(Response.json(active));await restoring;
  assert.equal(h.controller.state.connected,true);assert.equal(document.documentElement.dataset.presentationStartup,'ready');
  await h.controller.dispatch('refill');assert.deepEqual(h.writes,[{op:'refill'}]);
  // The dealer's first verified frame arrives later and changes no authority.
  loaded.onReady('astrid');assert.equal(h.controller.state.connected,true);
});

test('a frame of another dealer fails the restore before the binding is confirmed and only closes the media afterwards',async t=>{
  const confirmed=deferred();let reads=0,closes=0,options;
  const h=await bindingHarness(t,{fetchImpl:async url=>++reads===1?bindingResponse(url):confirmed.promise,
    createPresentation:async value=>{options=value;return{restoreSnapshot(){},present(){},close(){closes++;}};}});
  const restoring=h.restore(seated(1));await turn();await turn();
  options.onReady('nora');confirmed.resolve(bindingResponse('/binding?configVersion=cfg-1&windowId=window-1'));
  await assert.rejects(restoring,/shared_room_presentation_dealer_mismatch/);assert.equal(closes,1);assert.equal(h.controller.state.connected,false);
  const errors=[];
  const fresh=await bindingHarness(t,{createPresentation:async value=>{options=value;return{restoreSnapshot(){},present(){},close(){errors.push('closed');}};}});
  await fresh.restore(seated(2));assert.equal(fresh.controller.state.connected,true);
  options.onReady('nora');assert.deepEqual(errors,['closed'],'media that showed another dealer is closed');
  assert.match(fresh.nodes.get('caption').textContent,/inte tillgänglig/);assert.equal(fresh.controller.state.connected,true,'server-owned controls are unchanged');
});

test('an existing client retains the active N2 presentation and remounts once for the next window package',async t=>{
  let current=presentationBinding(seated(3),{branding:{color:'#123456'}}),closes=0;
  const h=await bindingHarness(t,{fetchImpl:async()=>Response.json(current),createPresentation:async options=>{
    options.onReady(options.selection.dealer);return{restoreSnapshot(){},present(){},close(){closes++;}};}});
  await h.restore(seated(3));assert.equal(h.mounts.length,1);
  // The server still names the active config after another package is published.
  await h.restore(seated(4));assert.equal(h.mounts.length,1);assert.equal(closes,0);
  assert.equal(h.mounts[0].selection.branding.color,'#123456');
  const next=seated(5,{windowId:'window-2',configVersion:'cfg-2',settings:{...snapshot().settings,configVersion:'cfg-2'}});
  current=presentationBinding(next,{packageRevision:2,branding:{color:'#abcdef'}});
  await h.restore(next);assert.equal(h.mounts.length,2);assert.equal(closes,1);
  assert.equal(h.mounts[1].selection.packageRevision,2);assert.equal(h.mounts[1].selection.branding.color,'#abcdef');
  await h.restore({...next,version:6});assert.equal(h.mounts.length,2);assert.equal(closes,1);
  h.close();assert.equal(closes,2);
});

test('an unopened room binds its published head and reuses unchanged media when its first window opens',async t=>{
  const urls=[];const h=await bindingHarness(t,{fetchImpl:async url=>{urls.push(url);return bindingResponse(url);}});
  await h.restore(snapshot(0,{windowId:'unopened'}));
  assert.equal(urls.length,2);assert.ok(urls.every(url=>url.endsWith('configVersion=cfg-1&windowId=unopened')));
  await h.restore(seated(1));assert.equal(h.mounts.length,1);assert.equal(h.controller.state.snapshot.windowId,'window-1');
});

test('a stale or revoked binding after slow media loading closes that media and never enables commands',async t=>{
  for(const status of [403,409,'changed'])await t.test(String(status),async t=>{
    let reads=0,closes=0;const loaded=deferred();
    const active=presentationBinding(seated(1));
    const h=await bindingHarness(t,{fetchImpl:async()=>++reads===1?Response.json(active):status==='changed'
      ?Response.json({...active,selection:{...active.selection,branding:{color:'#ffffff'}}}):new Response(null,{status}),
      createPresentation:async()=>{await loaded.promise;return{restoreSnapshot(){},present(){},close(){closes++;}};}});
    const restoring=h.restore(seated(1));await turn();assert.equal(reads,1);assert.equal(h.controller.state.connected,false);
    loaded.resolve();await assert.rejects(restoring,/shared_room_presentation_binding_(unavailable|changed)/);
    assert.equal(reads,2);assert.equal(closes,1);assert.equal(h.controller.state.connected,false);
    await h.controller.dispatch('refill');assert.equal(h.writes.length,0);h.close();assert.equal(closes,1);
  });
});

test('binding scope, owner, context and snapshot preconditions are checked before mounting media',async t=>{
  const mutations=[b=>{b.owner='preview';},b=>{b.roomId='room-b';},b=>{b.configVersion='cfg-2';},b=>{b.windowId='window-2';},
    b=>{b.presentationContext.roomId='room-b';},b=>{b.presentationContext.operatorSlug='south';},b=>{b.presentationContext.packageRevision=2;},
    b=>{b.presentationContext.dealerId='nora';},b=>{b.selection.roomId='room-b';},b=>{b.selection.registeredDealers=[];},b=>{b.selection.token='not-a-capability';}];
  for(const mutate of mutations){
    const binding=presentationBinding();mutate(binding);
    const h=await bindingHarness(t,{fetchImpl:async()=>Response.json(binding)});
    await assert.rejects(h.restore(snapshot()));assert.equal(h.mounts.length,0);assert.equal(h.controller.state.connected,false);h.close();
  }
});

test('a window rollover during binding exposes only the recognized recoverable conflict',async t=>{
  const h=await bindingHarness(t,{fetchImpl:async()=>Response.json({error:'shared_room_presentation_stale'},{status:409})});
  await assert.rejects(h.restore(snapshot()),{code:'shared_room_presentation_stale'});
  assert.equal(h.controller.state.connected,false);assert.equal(h.mounts.length,0);
});

for(const stage of ['binding','mount','confirmation'])test(`window rollover during ${stage} recovers the mounted app through fresh WS authority`,async t=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const sockets=[],renders=[],closes=[],restores=[];let reads=0,mounts=0,stale=true;
  class Socket extends EventTarget{readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}
    message(s){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,snapshot:s,presentation:null})}));}}
  const commands={state:'idle',stop(){this.state='stopped';}};
  const app=await mountSharedRoomApp({document,window,createCommands:()=>commands,
    createView:()=>({bind(){},render:value=>renders.push(value),close(){}}),
    createSocket:options=>createSharedRoomClient({...options,WebSocket:Socket,reconnectDelayMs:1}),
    fetchImpl:async url=>{
      reads++;
      if(stale&&(stage==='binding'||stage==='confirmation'&&reads===2))return Response.json({error:'shared_room_presentation_stale'},{status:409});
      return bindingResponse(url);
    },
    createPresentation:async()=>{
      const mount=++mounts;
      if(stale&&stage==='mount')throw Object.assign(Error('shared_room_presentation_stale'),{code:'shared_room_presentation_stale'});
      return{restoreSnapshot:(_s,options)=>restores.push(options),present(){},close:()=>closes.push(mount)};
    }});
  t.after(app.close);sockets[0].message(seated(1));
  for(let i=0;i<100&&sockets.length<2;i++)await delay(2);
  assert.equal(sockets.length,2);assert.equal(app.controller.state.connected,false);
  assert.equal(commands.state,'idle','retry must not stop the command client');
  assert.deepEqual(renders.at(-1).can.act,[]);assert.equal(renders.at(-1).can.bet,false);
  if(stage==='confirmation')assert.deepEqual(closes,[1],'the unconfirmed candidate is disposed');
  stale=false;const receivedAt=Date.now();sockets[1].message(seated(2,{windowId:'window-2',serverNow:receivedAt}));
  for(let i=0;i<100&&!app.controller.state.connected;i++)await delay(2);
  assert.equal(app.controller.state.snapshot.windowId,'window-2');assert.equal(renders.at(-1).can.bet,true);
  assert.ok(restores.at(-1).receivedAt>=receivedAt,'the binding forwards the WS receipt time');
});

// K04 R5: a moved window during mount or confirmation is not a failed start. The start screen keeps loading
// (no alert, no reload button) until the fresh socket's binding makes it ready; any other conflict still fails it.
for(const [stage,error] of [['mount','shared_room_presentation_stale'],['confirmation','shared_room_presentation_stale'],['confirmation','other_conflict']])
test(`a ${error} during ${stage} ${error==='other_conflict'?'still fails':'never fails'} the start screen`,async t=>{
  const {document,nodes}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const loading=nodes.get('presentation-loading');loading.textContent='Visar spelbordet…';
  const sockets=[];let reads=0,stale=true;
  class Socket extends EventTarget{readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}
    message(s){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,snapshot:s,presentation:null})}));}}
  const app=await mountSharedRoomApp({document,window,createCommands:()=>({state:'idle',stop(){this.state='stopped';}}),
    createView:()=>({bind(){},render(){},close(){}}),
    createSocket:options=>createSharedRoomClient({...options,WebSocket:Socket,reconnectDelayMs:1}),
    fetchImpl:async url=>{reads++;return stale&&stage==='confirmation'&&reads===2?Response.json({error},{status:409}):bindingResponse(url);},
    createPresentation:async()=>{
      if(stale&&stage==='mount')throw Object.assign(Error(error),{code:error});
      return{restoreSnapshot(){},present(){},close(){}};
    }});
  t.after(app.close);sockets[0].message(seated(1));
  const failed=()=>document.documentElement.dataset.presentationStartup==='failed'||loading.attributes.role==='alert'||/kunde inte/.test(loading.textContent);
  if(error==='other_conflict'){
    for(let i=0;i<100&&!failed();i++)await delay(2);
    assert.equal(failed(),true,'a conflict that is not a moved window still fails the start');assert.equal(sockets.length,1);return;
  }
  for(let i=0;i<100&&sockets.length<2;i++)await delay(2);
  assert.equal(sockets.length,2,'the moved window is read again through a new socket');
  assert.equal(failed(),false,'the start screen is not marked as failed');assert.notEqual(document.documentElement.dataset.presentationStartup,'failed');
  stale=false;sockets[1].message(seated(2,{windowId:'window-2'}));
  for(let i=0;i<100&&document.documentElement.dataset.presentationStartup!=='ready';i++)await delay(2);
  assert.equal(document.documentElement.dataset.presentationStartup,'ready');assert.equal(failed(),false);
});

for(const [status,error]of [[401,'shared_room_authentication_required'],[403,'shared_room_presentation_forbidden'],[409,'other_conflict']])
test(`binding HTTP ${status} ${error} never gains recoverable stale authority`,async t=>{
  const h=await bindingHarness(t,{fetchImpl:async()=>Response.json({error},{status})});
  await assert.rejects(h.restore(snapshot()),reason=>reason.code!=='shared_room_presentation_stale');
  assert.equal(h.controller.state.connected,false);assert.equal(h.mounts.length,0);
});

// K04 F5b, aggravating: every snapshot of the same window read the binding again (1-2.5 s in staging) before its
// plan could be presented. A binding the server confirmed for this window and configuration is reused; a new
// window, another configuration or a binding that was never confirmed is read and confirmed again.
test('a snapshot of an already confirmed window reuses its binding without another read; a new window reads it again',async t=>{
  let reads=0;const restores=[];
  const h=await bindingHarness(t,{fetchImpl:async url=>{reads++;return bindingResponse(url);},
    createPresentation:options=>{options.onReady(options.selection.dealer);return{restoreSnapshot:value=>restores.push(value.version),present(){},close(){}};}});
  await h.restore(seated(1));assert.equal(reads,2,'read and confirmed once for the window');
  await h.restore(seated(2));await h.restore(seated(3,{presentationVer:1}));
  assert.equal(reads,2,'later snapshots of the same window are not read again');assert.deepEqual(restores,[1,2,3]);
  assert.equal(h.controller.state.connected,true);
  await h.restore(seated(4,{windowId:'window-2',presentationVer:1}));assert.equal(reads,3,'a new window is read again');
  assert.equal(h.mounts.length,1,'its unchanged binding keeps the mounted media');assert.deepEqual(restores,[1,2,3,4]);
});

test('a binding that failed its confirmation is read again by the next snapshot of the same window',async t=>{
  let reads=0;
  const h=await bindingHarness(t,{fetchImpl:async url=>++reads===2?Response.json({error:'other_conflict'},{status:409}):bindingResponse(url)});
  await assert.rejects(h.restore(seated(1)));assert.equal(reads,2);
  await h.restore(seated(2));assert.equal(reads,4,'nothing unconfirmed is reused');assert.equal(h.controller.state.connected,true);
});

test('an aborted binding fetch cannot mount late or replace a newer connection generation',async t=>{
  const oldRead=deferred(),oldConnection=new AbortController();let reads=0,firstSignal;
  const next=seated(3,{windowId:'window-3',configVersion:'cfg-3',settings:{...snapshot().settings,configVersion:'cfg-3'}});
  const h=await bindingHarness(t,{fetchImpl:async(url,init)=>{
    if(++reads===1){firstSignal=init.signal;return oldRead.promise;}return Response.json(presentationBinding(next,{packageRevision:3}));}});
  const oldRestore=h.restore(seated(1),oldConnection.signal);await turn();oldConnection.abort();assert.equal(firstSignal.aborted,true);
  await h.restore(next);assert.equal(h.controller.state.snapshot.version,3);assert.equal(h.mounts.length,1);
  oldRead.resolve(Response.json(presentationBinding(seated(1))));await assert.rejects(oldRestore,{name:'AbortError'});
  assert.equal(h.mounts.length,1);assert.equal(h.controller.state.connected,true);assert.equal(h.controller.state.snapshot.version,3);
});

test('existing DOM receives server balances, native seat/chip controls, Swedish error and explicit retry',()=>{
  const {document,nodes}=documentFixture(),calls=[];const view=createSharedRoomView({document});
  view.bind({dispatch:(...args)=>calls.push(args),selectChip:amount=>calls.push(['chip',amount]),retry:()=>calls.push(['retry'])});
  const can={join:true,bet:true,leave:true,act:[],insurance:false};
  view.render({snapshot:seated(1,{me:{...seated().me,available:17.5}}),chip:.5,can,notice:'Svaret saknas.',retry:true,busy:false,connected:true});
  assert.match(nodes.get('balance').textContent,/17,5 demo/);assert.equal(nodes.get('seats').children.length,7);
  // The own seat's circle reads "Du" and takes no click; its small "Lämna" control leaves the seat.
  const own=nodes.get('seats').children[0],join=own.children[0].children[0],leaveSeat=own.children[0].children[2];
  assert.equal(join.tagName,'BUTTON');assert.equal(join.textContent,'Du');assert.equal(join.disabled,true);join.click();assert.equal(calls.length,0);
  assert.equal(leaveSeat.textContent,'Lämna');assert.equal(leaveSeat.hidden,false);leaveSeat.click();assert.deepEqual(calls[0],['join',{seat:0}]);
  assert.equal(nodes.get('seats').children[1].children[0].children[2].hidden,true,'a free seat has no leave control');
  nodes.get('chips').children[1].disabled=false;nodes.get('chips').children[1].click();assert.deepEqual(calls[1],['chip',1]);
  // The status overlay is pointer-transparent; the retry control must sit in the clickable control bar.
  const status=nodes.get('scene').children.find(node=>node.id==='shared-room-status');assert.equal(status.children.some(node=>node.id==='shared-room-retry'),false);
  const controls=nodes.get('scene').children.find(node=>node.id==='shared-room-controls'),retry=controls.children.find(node=>node.id==='shared-room-retry');
  assert.equal(retry.hidden,false);retry.click();assert.deepEqual(calls[2],['retry']);
  // Bet controls exist only on the player's own seat; other seats keep one touch-sized join control.
  assert.equal(own.children[0].children[1].hidden,false);assert.equal(nodes.get('seats').children[1].children[0].children[1].hidden,true);
  assert.equal(nodes.get('seats').children[1].children[0].children[1].style.display,'none');
  for(const id of ['chat','table-pick']){assert.equal(nodes.get(id).hidden,true);assert.equal(nodes.get(id).style.display,'none');}
  assert.match(nodes.get('limits').textContent,/^0,5 – 2\s?000 kr · demo$/);
  view.render({snapshot:null,chip:.5,can:{join:false,bet:false,leave:false,act:[],insurance:false},notice:'',retry:false,busy:false,connected:false});
  assert.equal(nodes.get('limits').textContent,'–','no snapshot shows no stale placeholder limits');
  view.close();leaveSeat.click();assert.equal(calls.length,3);
});

// Jakob in staging 28 Oct 2026: Redo, Upprepa and the side bets went to the server, which answered 409 NO_BETS.
test('before a main bet Redo and the side bets stay closed locally with the server text as tooltip; Upprepa needs a previous round',async t=>{
  const h=harness(t);await h.restore(seated(1));
  let r=h.renders.at(-1);
  assert.equal(r.can.bet,true);assert.equal(r.can.ready,false);assert.equal(r.can.repeat,false);
  assert.deepEqual(r.hints,{ready:'Lägg en insats först.',repeat:'Det finns ingen tidigare insats att upprepa.',side:'Lägg en insats först.'});
  for(const [op,args] of [['ready'],['repeat'],['bet',{seat:0,field:'pp'}],['bet',{seat:0,field:'tp'}]])await h.controller.dispatch(op,args);
  assert.deepEqual(h.calls,[],'nothing reaches the server before a main bet');
  // The main bet on this box opens Redo and its side bets; a previous round on a box still owned opens Upprepa.
  const lastSettlement={roundId:'r0',returned:0,hands:[{box:0}]};
  await h.restore(seated(2,{bets:[{main:5,pp:0,tp:0},...snapshot().bets.slice(1)],me:{...seated().me,lastSettlement}}));
  r=h.renders.at(-1);assert.equal(r.can.ready,true);assert.equal(r.can.repeat,true);assert.deepEqual([r.hints.ready,r.hints.repeat],['','']);
  await h.controller.dispatch('bet',{seat:0,field:'pp'});assert.deepEqual(h.calls.at(-1),{op:'bet',windowId:'window-1',seat:0,field:'pp',chip:.5});
  // A previous round on a box the player has since left is nothing to repeat (the server's lastBets filter).
  await h.restore(seated(11,{me:{...seated().me,lastSettlement:{...lastSettlement,hands:[{box:4}]}}}));
  assert.equal(h.renders.at(-1).can.repeat,false);
  // The server's NO_BETS text stays the safety net for a refusal that still arrives.
  h.setSend(async()=>({status:'rejected',httpStatus:409,code:'NO_BETS'}));await h.restore(seated(12,{bets:[{main:5,pp:0,tp:0},...snapshot().bets.slice(1)]}));
  await h.controller.dispatch('ready');assert.equal(h.renders.at(-1).notice,'Lägg en insats först.');
});

test('the view closes side bets without a main bet on their box and shows why on Redo, Upprepa and the side bets',()=>{
  const {document,nodes}=documentFixture(),calls=[];const view=createSharedRoomView({document});
  view.bind({dispatch:(...args)=>calls.push(args)});
  const can={join:true,bet:true,leave:true,ready:false,repeat:false,act:[],insurance:false};
  const hints={ready:'Lägg en insats först.',repeat:'Det finns ingen tidigare insats att upprepa.',side:'Lägg en insats först.'};
  view.render({snapshot:seated(1),chip:.5,can,hints,notice:'',retry:false,busy:false,connected:true});
  const bets=nodes.get('seats').children[0].children[0].children[1],[pp,main,tp]=bets.children;
  assert.equal(main.disabled,false);assert.equal(main.className.split(' ').includes('seat-shared-bet-main'),true);assert.equal(main.title,'');
  for(const side of [pp,tp]){assert.equal(side.disabled,true);assert.equal(side.title,'Lägg en insats först.');assert.equal(side.className.split(' ').includes('seat-shared-bet-side'),true);}
  assert.equal(nodes.get('deal-now').disabled,true);assert.equal(nodes.get('deal-now').title,'Lägg en insats först.');
  assert.equal(nodes.get('max-btn').disabled,true);assert.equal(nodes.get('max-btn').title,'Det finns ingen tidigare insats att upprepa.');
  main.click();assert.deepEqual(calls,[['bet',{seat:0,field:'main'}]]);
  view.render({snapshot:seated(2,{bets:[{main:5,pp:0,tp:0},...snapshot().bets.slice(1)]}),chip:.5,can:{...can,ready:true,repeat:true},
    hints:{ready:'',repeat:'',side:hints.side},notice:'',retry:false,busy:false,connected:true});
  assert.equal(main.textContent,'Insats 5');assert.equal(main.classes.has('staked'),true);
  for(const side of [pp,tp]){assert.equal(side.disabled,false);assert.equal(side.title,'');}
  assert.equal(nodes.get('deal-now').disabled,false);assert.equal(nodes.get('deal-now').title,'');
  view.close();
});

// K04 F8: a revoked session ended the table with "Ladda om sidan", which only met the same refusal again.
test('a session the socket refused twice asks for a new sign-in with a link; other terminal errors keep the reload text',async t=>{
  for(const [code,notice,signIn] of [['shared_room_unauthorized','Din session har gått ut. Logga in igen.',true],
    ['shared_room_renderer_failed','Bordet kunde inte uppdateras. Ladda om sidan för att fortsätta.',false],[undefined,'Bordet kunde inte uppdateras. Ladda om sidan för att fortsätta.',false]]){
    const h=harness(t);await h.restore(seated(1));h.controller.fail(code);
    const r=h.renders.at(-1);assert.equal(r.notice,notice);assert.equal(r.signIn,signIn,String(code));assert.equal(r.can.bet,false);
    assert.equal(h.commands.state,'stopped');
  }
  const {document,nodes}=documentFixture();const view=createSharedRoomView({document,signInHref:'/player-login?game=blackjack&table=north-1'});
  const link=()=>nodes.get('scene').children.find(node=>node.id==='shared-room-controls').children.find(node=>node.id==='shared-room-sign-in');
  view.render({snapshot:null,can:{join:false,bet:false,leave:false,act:[],insurance:false},notice:'',signIn:false,retry:false,busy:false,connected:false});
  assert.equal(link().tagName,'A');assert.equal(link().hidden,true);assert.equal(link().href,'/player-login?game=blackjack&table=north-1');
  view.render({snapshot:null,can:{join:false,bet:false,leave:false,act:[],insurance:false},notice:'Din session har gått ut. Logga in igen.',signIn:true,retry:false,busy:false,connected:false});
  assert.equal(link().hidden,false);assert.equal(link().textContent,'Logga in');view.close();
});

test('the mounted app hands the socket\'s unauthorized code to the table and links to the player sign-in of this table',async t=>{
  const {document}=documentFixture();const window=new EventTarget();
  window.location={origin:'https://game.invalid',href:'https://game.invalid/game?game=blackjack&operator=north&table=north-1&launch=a.b.c'};
  let socketOptions,viewOptions,rendered;
  const app=await mountSharedRoomApp({document,window,fetchImpl:async url=>bindingResponse(url),
    createCommands:()=>({state:'idle',send:async()=>({status:'rejected',httpStatus:409,code:'STALE_COMMAND'}),stop(){this.state='stopped';}}),
    createView:options=>{viewOptions=options;return{bind(){},render:value=>{rendered=value;},close(){}};},
    createSocket:options=>{socketOptions=options;return{start(){},stop(){},status:()=>({state:'failed'})};},
    createPresentation:async options=>(options.onReady(options.selection.dealer),{restoreSnapshot(){},present(){},close(){}})});
  t.after(app.close);
  assert.equal(viewOptions.signInHref,'/player-login?game=blackjack&table=north-1&operator=north','the sign-in keeps the table and never a launch token');
  socketOptions.onError({code:'shared_room_unauthorized'});
  assert.equal(rendered.notice,'Din session har gått ut. Logga in igen.');assert.equal(rendered.signIn,true);
});

test('mounted application wires real WS and HTTP clients; duplicate reconnect state never replays presentation',async t=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const sockets=[],renders=[],events=[],requests=[];
  class Socket extends EventTarget {readyState=1;bufferedAmount=0;constructor(){super();sockets.push(this);}close(){this.readyState=3;}frame(s,p=null){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,snapshot:s,presentation:p})}));}}
  const app=await mountSharedRoomApp({document,window,createSocket:options=>createSharedRoomClient({...options,WebSocket:Socket,reconnectDelayMs:1}),
    fetchImpl:async url=>bindingResponse(url),
    createCommands:options=>createSharedRoomCommandClient({...options,randomUUID:()=> 'join-id',fetchImpl:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return Response.json({result:{op:'join',version:1,memberGen:1,seats:[0],seatGen:[1,0,0,0,0,0,0]},replay:false,snapshot:seated()});}}),
    createView:()=>({bind(){},render:state=>renders.push(state),close(){}}),
    createPresentation:async({onReady})=>{onReady('astrid');return{restoreSnapshot:s=>events.push('restore:'+s.version),present:p=>events.push('present:'+p.ver),close(){}};}});
  t.after(app.close);sockets[0].frame(snapshot());await turn();await turn();
  await app.controller.dispatch('join',{seat:0});assert.equal(app.controller.state.snapshot.unopened,true);
  assert.deepEqual(requests[0].body,{op:'join',memberGen:0,seats:[0],seatGens:{0:0},commandId:'join-id'});
  sockets[0].frame(seated());await turn();await turn();assert.equal(app.controller.state.snapshot.me.seats[0],0);
  const p={roomId,ver:1,talkId:'talk-1',auditSeq:1,status:'ready',kind:'window',windowId:'window-1',configVersion:'cfg-1',language:'sv',startAt:1000,endAt:2000,events:[],lines:[]};
  sockets[0].frame(seated(2,{presentationVer:1}),p);await turn();await turn();sockets[0].frame(seated(2,{presentationVer:1}),p);await turn();await turn();
  assert.equal(events.filter(row=>row==='present:1').length,1);assert.ok(events.indexOf('restore:2')<events.indexOf('present:1'));
  sockets[0].dispatchEvent(Object.assign(new Event('close'),{code:1001}));
  const deadline=Date.now()+1000;while(sockets.length<2){assert.ok(Date.now()<deadline);await delay(1);}
  sockets[1].frame(seated(2,{presentationVer:1}),p);await turn();await turn();
  assert.equal(events.filter(row=>row==='present:1').length,1,'a normal reconnect must restore, never replay an old presentation');
  window.dispatchEvent(new Event('pagehide'));await app.controller.dispatch('refill');assert.equal(requests.length,1);assert.equal(app.controller.state.closed,true);
});

test('a postload binding rejection through the real socket closes the controller, media and command port',async t=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  let socket,reads=0,closes=0,stops=0;
  class Socket extends EventTarget{readyState=1;constructor(){super();socket=this;}close(){this.readyState=3;}}
  const app=await mountSharedRoomApp({document,window,fetchImpl:async()=>++reads===1?Response.json(presentationBinding()):new Response(null,{status:403}),
    createSocket:options=>createSharedRoomClient({...options,WebSocket:Socket}),createCommands:()=>({state:'idle',stop(){stops++;},send(){assert.fail('unverified media cannot authorize writes');}}),
    createView:()=>({bind(){},render(){},close(){}}),createPresentation:async options=>{options.onReady('astrid');return{restoreSnapshot(){},present(){},close(){closes++;}};}});
  t.after(app.close);socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,snapshot:snapshot(),presentation:null})}));
  await turn();await turn();assert.equal(reads,2);assert.equal(closes,1);assert.equal(stops,1);assert.equal(socket.readyState,3);
  assert.equal(app.controller.state.closed,true);await app.controller.dispatch('refill');app.close();assert.equal(closes,1);assert.equal(stops,1);
});

test('pagehide during bound media startup closes a late returned port and stops the socket and commands',async()=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const gate=deferred();let closes=0,stops=0,socketStops=0,viewCloses=0,mediaSignal,restorer;
  const app=await mountSharedRoomApp({document,window,fetchImpl:async url=>bindingResponse(url),createCommands:()=>({state:'idle',stop(){stops++;}}),
    createPresentation:options=>{mediaSignal=options.signal;return gate.promise;},createSocket:options=>{restorer=options.restoreSnapshot;return{start(){},stop(){socketStops++;}};},
    createView:()=>({bind(){},render(){},close(){viewCloses++;}})});
  const restoring=restorer(snapshot(),{signal:new AbortController().signal});await turn();
  assert.ok(mediaSignal);window.dispatchEvent(new Event('pagehide'));assert.equal(mediaSignal.aborted,true);gate.resolve({close(){closes++;}});
  await assert.rejects(restoring,{name:'AbortError'});app.close();
  assert.equal(closes,1);assert.equal(stops,1);assert.equal(socketStops,1);assert.equal(viewCloses,1);
});

test('revoked command authority stops writes and preserves the last server snapshot',async t=>{
  const h=harness(t);h.setSend(async()=>({status:'rejected',httpStatus:403,code:'AUTHORITY_REJECTED'}));
  await h.restore(seated());await h.controller.dispatch('refill');
  assert.equal(h.commands.state,'stopped');assert.equal(h.renders.at(-1).can.bet,false);
  assert.equal(h.controller.state.snapshot.me.available,1000);assert.match(h.renders.at(-1).notice,/inloggning/);
});

test('pause keeps stand and declining insurance usable while blocking bets and risk-increasing actions',async t=>{
  const h=harness(t);h.setSend(async intent=>({status:'rejected',httpStatus:409,code:'NOT_YOUR_TURN'}));
  const me={...seated().me,pausedUntil:10000,insuranceDue:true};
  await h.restore(seated(2,{phase:'round',roundId:'r2',me,round:{phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['stand','hit','double','split']}}));
  assert.deepEqual(h.renders.at(-1).can.act,['stand']);await h.controller.dispatch('act',{action:'hit'});assert.equal(h.calls.length,0);
  await h.controller.dispatch('act',{action:'stand'});assert.equal(h.calls.at(-1).action,'stand');
  await h.restore(seated(3,{phase:'round',roundId:'r2',me,round:{phase:'insurance',active:0,hands:[{box:0,cards:[]}],dealer:[]}}));
  await h.controller.dispatch('insurance',{take:true});assert.equal(h.calls.length,1);
  await h.controller.dispatch('insurance',{take:false});assert.equal(h.calls.at(-1).take,false);
});

test('pagehide aborts pending media initialization and blocks late startup work',async()=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  let signal,ready,closes=0,restorer,reads=0;const confirmed=deferred();
  const app=await mountSharedRoomApp({document,window,fetchImpl:async url=>++reads===1?bindingResponse(url):confirmed.promise,createCommands:()=>({state:'idle',stop(){}}),
    createPresentation:async options=>{signal=options.signal;ready=options.onReady;return{restoreSnapshot(){},close(){closes++;}};},
    createSocket:options=>{restorer=options.restoreSnapshot;return{start(){},stop(){}};},createView:()=>({bind(){},render(){},close(){}})});
  const restoring=restorer(snapshot(),{signal:new AbortController().signal});await turn();await turn();
  assert.equal(reads,2);assert.equal(app.controller.state.connected,false);window.dispatchEvent(new Event('pagehide'));assert.equal(signal.aborted,true);
  confirmed.resolve(bindingResponse('/binding?configVersion=cfg-1&windowId=window-1'));
  await assert.rejects(restoring,{name:'AbortError'});ready('astrid');assert.equal(closes,1);assert.notEqual(document.documentElement.dataset.presentationStartup,'ready');
});

test('all seven seats remain selectable through a native control when the visual table is compact',()=>{
  const {document,nodes}=documentFixture(),calls=[];
  const view=createSharedRoomView({document});view.bind({dispatch:(...args)=>calls.push(args)});
  view.render({snapshot:snapshot(),chip:.5,can:{join:true,act:[]},notice:'',retry:false,busy:false,connected:true});
  const controls=nodes.get('scene').children.find(node=>node.id==='shared-room-controls'),picker=controls.children.find(node=>node.tagName==='SELECT');
  assert.equal(picker.tagName,'SELECT');assert.equal(picker.children.length,8);
  picker.value='6';picker.dispatchEvent(new Event('change'));assert.deepEqual(calls,[['join',{seat:6}]]);
  view.close();picker.value='0';picker.dispatchEvent(new Event('change'));assert.equal(calls.length,1);
});

test('registered local presentation reuses exact media and card ports without AbortSignal.any and disposes its resources',async t=>{
  const descriptor=Object.getOwnPropertyDescriptor(AbortSignal,'any');
  Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});
  t.after(()=>Object.defineProperty(AbortSignal,'any',descriptor));
  const timeout=AbortSignal.timeout;
  t.mock.method(AbortSignal,'timeout',ms=>{assert.equal(ms,10000);return timeout(ms);});
  const {document,nodes}=documentFixture(),window=new EventTarget(),requests=[];window.matchMedia=()=>({matches:true});window.fetch=(url,init)=>{requests.push({url,init});return Promise.resolve(Response.json({}));};
  nodes.set('table2d',new Element());nodes.get('scene').getBoundingClientRect=nodes.get('table2d').getBoundingClientRect=()=>({left:0,top:0,width:1080,height:1920});
  const events=[];let options,shown;
  const selection={presentation:'local',dealer:'astrid',localDealer:'astrid',operator:'north',roomId,packageRevision:1,registeredDealers:[{id:'astrid',label:'Astrid'}]};
  const cards=Object.fromEntries(['restore','sync','clear','show','reveal','setProjection','close'].map(key=>[key,()=>events.push('cards-'+key)]));
  const port=await mountSharedRoomPresentation({document,window,selection,onReady:id=>events.push(id),onError:()=>{},createComposition:()=>null,
    loadAdapters:async()=>[{PerformancePlayer:class{dispose(){events.push('player-close');}}},{createLocalPresentation:async value=>{options=value;return{state(){},start(){value.onIdle();},close(){events.push('media-close');}};}},{createLocalCardOverlay:()=>cards}]});
  assert.equal(options.entry,selection);assert.equal(options.dealerId,'astrid');assert.equal(options.muted(),true);
  assert.equal(typeof options.transport.request,'function');assert.deepEqual(events,['astrid']);
  const wsConnection=new AbortController();port.restoreSnapshot(seated(20,{presentationVer:7}),{signal:wsConnection.signal});
  assert.equal(options.version(),7,'state-only versions cannot replace the presentation version');
  assert.throws(()=>options.transport.request('/api/presentation/select',{method:'POST',body:'{}'}),/shared_room_media_authority_unavailable/);
  await port.present({roomId,ver:7,talkId:'verified-talk',endAt:2000,events:[]});
  await options.transport.request('/api/presentation/select',{method:'POST',body:JSON.stringify({version:7,event:{type:'speak',line:'goodluck'}})});
  assert.deepEqual(JSON.parse(requests[0].init.body),{version:7,event:{type:'speak',line:'goodluck'},sharedRoom:{roomId,ver:7,talkId:'verified-talk'}});
  await options.transport.request('/api/presentation/config',{method:'GET'});assert.equal(requests[1].init.body,undefined);
  assert.equal(requests[1].url,'/api/presentation/shared-room/room-a/config');
  const context={operatorSlug:'north',roomId,packageRevision:1,dealerId:'astrid'};
  await options.transport.request('/api/presentation/config?'+new URLSearchParams(context),{method:'GET'});
  assert.equal(requests[2].url,'/api/presentation/shared-room/room-a/config?'+new URLSearchParams(context));
  const advice=JSON.stringify({presentationContext:context,event:{type:'idle'},version:7});
  await options.transport.request('/api/presentation/idle-advice',{method:'POST',body:advice});
  assert.equal(requests[3].url,'/api/presentation/shared-room/room-a/idle-advice');assert.equal(requests[3].init.body,advice);
  wsConnection.abort();assert.equal(requests[0].init.signal.aborted,true,'selection belongs to the WS generation at request start');
  assert.throws(()=>options.transport.request('/api/presentation/select',{body:'{}'}),/authority_unavailable/);
  port.layout({snapshot:seated(),seats:Array.from({length:7},()=>new Element())});
  cards.setProjection=projection=>{shown=projection.boxes;};
  const multi=seated(20,{owners:[actor,null,null,null,null,null,actor],me:{...seated().me,seats:[0,6]}}),seats=Array.from({length:7},()=>new Element());
  port.layout({snapshot:multi,focusSeat:6,seats});assert.deepEqual(shown,[4,5,6]);assert.equal(seats[6].hidden,false);
  port.layout({snapshot:multi,focusSeat:0,seats});assert.deepEqual(shown,[0,1,2]);
  assert.ok(events.includes('cards-restore'));assert.ok(events.includes('cards-setProjection'));port.close();
  assert.deepEqual(events.slice(-3),['media-close','cards-close','player-close']);
  await assert.rejects(mountSharedRoomPresentation({document,window,selection:{...selection,registeredDealers:[]},onReady(){},onError(){}}),/binding_missing/);
});

test('bound shared presentation applies only its published room branding and restores its owned colour on close',async()=>{
  const {document,nodes}=documentFixture(),window=new EventTarget(),selected=[];
  window.location={search:'?dealer=nora&table=%23ffffff'};window.matchMedia=()=>({matches:false});window.fetch=async()=>Response.json({});
  document.documentElement.style.setProperty('--table-felt','#010203');
  for(const id of ['felt-brand','wallet','chip-row'])nodes.set(id,new Element());
  const background='00000000-0000-4000-8000-000000000001',table='00000000-0000-4000-8000-000000000002';
  const selection={...presentationBinding().selection,branding:{background,table,color:'#123456'},
    choices:{dealers:['astrid'],dealerDefault:'astrid',tableColors:['#123456'],tableDefault:'#123456',background:{enabled:true,mode:'image',allowed:[background],default:background}},
    composition:{background:{enabled:true,mode:'image',allowed:[background],default:background},table:{enabled:true,allowed:[table],default:table},
      assets:[{id:background,role:'background',contentType:'image/png'},{id:table,role:'table',contentType:'image/png'}]}};
  let mediaOptions,closes=0;
  const port=await mountSharedRoomPresentation({document,window,selection,onReady(){},onError(){},
    createComposition:()=>({setBackground:id=>selected.push(['background',id]),setTable:id=>selected.push(['table',id]),onGeometryChange:()=>()=>{},close(){closes++;}}),
    loadAdapters:async()=>[{PerformancePlayer:class{dispose(){}}},{createLocalPresentation:async options=>{mediaOptions=options;return{state(){},start(){options.onIdle();},close(){}};}},
      {createLocalCardOverlay:()=>({restore(){},sync(){},clear(){},close(){}})}]});
  assert.equal(mediaOptions.dealerId,'astrid');assert.deepEqual(selected,[['background',background],['table',table]]);
  assert.equal(document.documentElement.dataset.tableColor,'#123456');assert.equal(document.documentElement.style.getPropertyValue('--table-felt'),'#123456');
  assert.equal(nodes.get('felt-brand').style.getPropertyValue('color'),'#123456');
  port.close();port.close();assert.equal(closes,1);assert.equal(document.documentElement.style.getPropertyValue('--table-felt'),'#010203');
  assert.equal(document.documentElement.dataset.tableColor,undefined);assert.equal(nodes.get('felt-brand').style.getPropertyValue('color'),'');
});

test('media lookahead may shift its private queue without skipping committed instructions',async()=>{
  const seen=[];let queue;
  const cards={restore(){},sync(){},clear(){},show(){},reveal(){},close(){}};
  const media={state(){},prepareSequence(events){queue=events;},async present(event){seen.push(event.line);queue.shift();return true;},close(){}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:()=>1000});
  ports.restoreSnapshot(seated(1),{signal:new AbortController().signal});ports.restoreSnapshot(seated(2,{presentationVer:1}));
  const events=[{type:'speak',line:'goodluck'},{type:'speak',line:'insurance'},{type:'speak',line:'double'}];
  await ports.present({roomId,ver:1,talkId:'lookahead',endAt:2000,events});
  assert.deepEqual(seen,['goodluck','insurance','double']);assert.equal(events.length,3);ports.close();
});

test('local seat focus shows a distant owned seat without a join or leave write',async t=>{
  const h=harness(t);await h.restore(seated(2,{owners:[actor,null,null,null,null,null,actor],me:{...seated().me,seats:[0,6]}}));
  h.view.actions.focusSeat(6);assert.equal(h.renders.at(-1).focusSeat,6);assert.equal(h.calls.length,0);
});


test('fresh rule events are observed once; history, expiry and reconnect cannot collect settlement',async()=>{
  const observed=[],states=[],gate=deferred();const connection=new AbortController();
  const media={state:value=>states.push(value),observeEvents:(events,options)=>{observed.push({events,options});},present:()=>gate.promise,close(){}};
  const cards={restore(){},sync(){},clear(){},show(){},reveal(){},close(){}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:()=>1000});
  const p={roomId,ver:1,talkId:'rules-1',kind:'plan',endAt:2000,events:[{type:'turn',box:0,handIndex:0}]};
  ports.restoreSnapshot(seated(1,{presentationVer:1}),{signal:connection.signal});await ports.present(p,{signal:connection.signal});assert.equal(observed.length,0);
  ports.restoreSnapshot(seated(2,{presentationVer:2}),{signal:connection.signal});
  const events=[{type:'settle'},{type:'speak',line:'win'}];const presenting=ports.present({...p,ver:2,events},{signal:connection.signal});
  assert.equal(observed.length,1);assert.deepEqual(observed[0].events,events);assert.notEqual(observed[0].events,events);assert.equal(observed[0].options.signal,connection.signal);
  connection.abort();assert.equal(states.at(-1).action,true);gate.resolve(true);await assert.rejects(presenting,{name:'AbortError'});
  assert.equal(states.at(-1).action,true,'stale finally cannot resume idle');
  const fresh=new AbortController();ports.restoreSnapshot(seated(3,{phase:'settled',presentationVer:2}),{signal:fresh.signal});
  await ports.present({...p,ver:2},{signal:fresh.signal});assert.equal(observed.length,1,'reconnect never repeats historical rule');
  ports.restoreSnapshot(seated(4,{phase:'bets',windowId:'window-2',presentationVer:3}),{signal:fresh.signal});
  assert.equal(observed.length,2);assert.deepEqual(observed[1].events,[]);assert.equal(observed[1].options.command,'collect');assert.equal(observed[1].options.previousVersion,2);
  await ports.present({...p,ver:3,endAt:900},{signal:fresh.signal});assert.equal(observed.length,2,'expired presentation cannot trigger a rule');ports.close();
});

// Material-like timing (native material derives leadMs/cardMs from its own takes): the plan's turnAt
// (65.6 s) lies after its seventeen three-second clips. The store's default 700/500 ms window is shorter
// than its own clips, and since K04 F2 a decision plan's turnAt ends media that has not shown a frame.
async function sevenSeatPlan() {
  const store=createMemoryTableStore();store.test.publish('v1',{leadMs:15000,cardMs:3100});
  const table=createTableCoordinator({store,clock:{now:()=>1000},random:deterministicRandom('shared-long-seven')});
  store.test.fund(actor,1000);let n=0;
  const send=(op,extra={})=>table.command({actorId:actor},{roomId,op,commandId:`long-${++n}`,...extra});
  await send('join',{seats:[0,1,2,3,4,5,6],memberGen:0,seatGens:{0:0,1:0,2:0,3:0,4:0,5:0,6:0}});
  const windowId=(await table.snapshot(roomId,actor)).windowId;
  for(let seat=0;seat<7;seat++)await send('bet',{seat,field:'main',chip:5,windowId});
  await send('ready',{windowId});
  const state=await table.snapshot(roomId,actor),row=store.test.outbox().findLast(row=>row.payload.presentation?.kind==='plan');
  const presentation=presentationForRow(row);
  assert.equal(presentation.events.filter(event=>event.type==='deal').length,16);
  return{snapshot:state,presentation};
}
async function flushRender(){await turn();await turn();}
function timedPresentation(t,mediaPresent){
  const sockets=[],errors=[],seen=[],restores=[];
  class Socket extends EventTarget {
    readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}
    message(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,...value})}));}
    ended(){this.readyState=3;this.dispatchEvent(Object.assign(new Event('close'),{code:1001}));}
  }
  const cards=Object.fromEntries(['restore','sync','clear','show','reveal','close'].map(key=>[key,()=>{}]));
  const media={state(){},prepareSequence(){},async present(event,options){seen.push(event);return mediaPresent(event,options);},close(){}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now});
  const client=createSharedRoomClient({roomId,browserOrigin:'https://game.invalid',WebSocket:Socket,callbackTimeoutMs:30000,reconnectDelayMs:250,
    restoreSnapshot:(value,meta)=>{restores.push(value.version);return ports.restoreSnapshot(value,meta);},present:ports.present,onError:error=>errors.push(error)});
  t.after(()=>{client.stop();ports.close();});client.start();
  return{client,ports,sockets,errors,seen,restores};
}

test('seven-seat committed K04 plan renders every serial three-second clip beyond thirty seconds',async t=>{
  const plan=await sevenSeatPlan();t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const h=timedPresentation(t,async(event,{onFrame})=>{onFrame?.(0);await new Promise(resolve=>setTimeout(resolve,3000));onFrame?.(3);return true;});
  h.sockets[0].message({snapshot:snapshot(),presentation:null});await flushRender();
  h.sockets[0].message(plan);await flushRender();
  const count=plan.presentation.events.filter(event=>['speak','deal','reveal'].includes(event.type)).length;
  assert.ok(count*3000>30000);
  for(let i=0;i<count;i++){t.mock.timers.tick(3000);await flushRender();assert.deepEqual(h.errors,[]);}
  assert.equal(h.seen.filter(event=>event.type==='deal').length,16);assert.equal(h.seen.length,count);
  assert.equal(h.client.status().state,'running');
});

test('a zero-duration committed new window still plays placebets while reconnect history stays consumed',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const h=timedPresentation(t,async()=>true),connection=h.sockets[0];
  connection.message({snapshot:seated(1,{phase:'settled'}),presentation:null});await flushRender();
  const p={roomId,ver:1,talkId:'window-new',auditSeq:1,status:'ready',kind:'window',windowId:'window-2',configVersion:'cfg-1',language:'sv',
    startAt:1000,endAt:1000,events:[{type:'speak',line:'placebets'},{type:'idle'}],lines:[]};
  const next={snapshot:seated(2,{phase:'bets',windowId:'window-2',presentationVer:1}),presentation:p};
  connection.message(next);await flushRender();assert.deepEqual(h.seen.map(event=>event.line),['placebets']);
  connection.ended();t.mock.timers.tick(250);await flushRender();h.sockets[1].message(next);await flushRender();
  assert.deepEqual(h.seen.map(event=>event.line),['placebets']);assert.deepEqual(h.errors,[]);
});

for(const frozenFrame of [false,true])test('long plan still terminates a '+(frozenFrame?'frozen-frame':'silent')+' clip after thirty seconds',async t=>{
  const plan=await sevenSeatPlan();t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  let context;const h=timedPresentation(t,async(_event,options)=>{context=options;if(frozenFrame)options.onFrame(0);return new Promise(()=>{});});
  h.sockets[0].message({snapshot:snapshot(),presentation:null});await flushRender();h.sockets[0].message(plan);await flushRender();
  assert.equal(h.seen.length,1);
  for(let i=0;i<5;i++){t.mock.timers.tick(5000);context.onFrame(frozenFrame?0:NaN);await flushRender();assert.deepEqual(h.errors,[]);}
  t.mock.timers.tick(5000);await flushRender();
  assert.deepEqual(h.errors,[{code:'shared_room_renderer_timeout'}]);assert.equal(context.signal.aborted,true);assert.equal(h.seen.length,1);
});

test('an advancing clip may run longer than thirty seconds without extending the frozen total budget',async t=>{
  const plan=await sevenSeatPlan();plan.presentation.events=[{type:'speak',line:'goodluck'}];plan.presentation.lines=[];plan.presentation.endAt=61000;
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});let context;const done=deferred();
  const h=timedPresentation(t,async(_event,options)=>{context=options;options.onFrame(0);await done.promise;return true;});
  h.sockets[0].message({snapshot:snapshot(),presentation:null});await flushRender();h.sockets[0].message(plan);await flushRender();
  for(let i=1;i<=6;i++){t.mock.timers.tick(10000);context.onFrame(i*10);await flushRender();assert.deepEqual(h.errors,[]);}
  done.resolve();await flushRender();assert.equal(h.client.status().state,'running');assert.equal(h.seen.length,1);
});

test('disconnect aborts the clip but waits for its async renderer before restoring a consumed long plan',async t=>{
  const plan=await sevenSeatPlan();t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});let context;const done=deferred();
  const h=timedPresentation(t,async(_event,options)=>{context=options;await done.promise;return true;});
  h.sockets[0].message({snapshot:snapshot(),presentation:null});await flushRender();h.sockets[0].message(plan);await flushRender();
  h.sockets[0].ended();assert.equal(context.signal.aborted,true);t.mock.timers.tick(250);await flushRender();
  h.sockets[1].message(plan);await flushRender();assert.equal(h.restores.length,2,'new renderer must wait for the old asynchronous port');
  context.onFrame(100);done.resolve();await flushRender();
  assert.equal(h.restores.length,3);assert.equal(h.seen.length,1,'the interrupted presentation remains consumed');assert.deepEqual(h.errors,[]);
  assert.throws(()=>context.onSelected({id:'late'},plan.presentation.events[0]),{name:'AbortError'});
  assert.equal(h.client.status().state,'running');
});


test('completed media callbacks cannot reacquire the card cursor or renew a discarded timer',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});let context,begins=0,frames=0;
  const cards={restore(){},sync(){},clear(){},show(){},reveal(){},close(){},begin(){begins++;return begins;},frame(){frames++;},finish(){}};
  const media={state(){},prepareSequence(){},present:async(_event,options)=>{context=options;options.onSelected({id:'exact'},{shoeDraw:1});return true;},close(){}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now});t.after(()=>ports.close());
  const signal=new AbortController().signal;ports.restoreSnapshot(seated(1),{signal});ports.restoreSnapshot(seated(2,{presentationVer:1}),{signal});
  await ports.present({roomId,ver:1,talkId:'late-clips',kind:'plan',endAt:2000,events:[{type:'deal',shoeDraw:1}]},{signal});
  context.onSelected({id:'late'},{shoeDraw:9});context.onFrame(100);
  assert.equal(begins,1);assert.equal(frames,0);t.mock.timers.tick(60000);await flushRender();
});

test('a media stall cannot resume idle before the client fails closed',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});const states=[];
  const cards=Object.fromEntries(['restore','sync','clear','show','reveal','close'].map(key=>[key,()=>{}]));
  const media={state:value=>states.push(value),prepareSequence(){},present:()=>new Promise(()=>{}),close(){}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now});t.after(()=>ports.close());
  const signal=new AbortController().signal;ports.restoreSnapshot(seated(1),{signal});ports.restoreSnapshot(seated(2,{presentationVer:1}),{signal});
  const count=states.length;const pending=assert.rejects(ports.present({roomId,ver:1,talkId:'stall-idle',kind:'plan',endAt:2000,
    events:[{type:'speak',line:'goodluck'}]},{signal}),error=>error.rendererTimeout===true);
  await flushRender();t.mock.timers.tick(30000);await pending;
  assert.equal(states.slice(count).some(value=>value.action===false),false);
});


test('zero-duration window permits ninety seconds of progressing speech through the real client and presentation ports',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});let context;const done=deferred();
  const h=timedPresentation(t,async(_event,options)=>{context=options;options.onFrame(0);await done.promise;return true;});
  h.sockets[0].message({snapshot:snapshot(),presentation:null});await flushRender();
  const p={roomId,ver:1,talkId:'window-long-speech',auditSeq:1,status:'ready',kind:'window',windowId:'window-long',configVersion:'cfg-1',language:'sv',
    startAt:1000,endAt:1000,events:[{type:'speak',line:'placebets'}],lines:[]};
  h.sockets[0].message({snapshot:seated(2,{windowId:'window-long',presentationVer:1}),presentation:p});await flushRender();
  for(let second=10;second<=90;second+=10){t.mock.timers.tick(10000);context.onFrame(second);await flushRender();assert.deepEqual(h.errors,[]);}
  done.resolve();await flushRender();assert.equal(h.client.status().state,'running');assert.equal(h.seen.length,1);
});


test('the frozen total includes preparation and buffer startup for every before main and after part',async t=>{
  const plan=await sevenSeatPlan();plan.presentation.events=[plan.presentation.events.find(event=>event.type==='deal')];plan.presentation.lines=[];
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});let context;const done=deferred();
  const h=timedPresentation(t,async(_event,options)=>{context=options;await done.promise;return true;});
  h.sockets[0].message({snapshot:snapshot(),presentation:null});await flushRender();h.sockets[0].message(plan);await flushRender();
  for(const clip of [1,2,3]){
    context.onProgress({clip,phase:'prepare'});t.mock.timers.tick(29000);await flushRender();assert.deepEqual(h.errors,[]);
    context.onProgress({clip,phase:'play'});t.mock.timers.tick(29000);await flushRender();assert.deepEqual(h.errors,[]);
    context.onProgress({clip,phase:'frame',time:0});
    for(let second=5;second<=125;second+=5){t.mock.timers.tick(5000);context.onProgress({clip,phase:'frame',time:second});await flushRender();assert.deepEqual(h.errors,[]);}
    context.onProgress({clip,phase:'complete'});
  }
  done.resolve();await flushRender();assert.equal(h.client.status().state,'running');assert.equal(h.seen.length,1);
});

// Kevin's table clock in the shared ports (K public/shared-table.js:304-328, app.js:214-246) with the Dragan profile.
const filmedBox=(box,shoeDraw)=>({type:'deal',to:'box',box,shoeDraw,faceDown:false});
const dragonTake=key=>dragan.takes.find(take=>take.key===key);
const frameMs=frames=>frames*1000/dragan.plane.fps;
// The fake media never selects a video, so the ports' static fallback (cards.show) follows every played deal; `shown`
// before any media.present call is therefore the expired-step path alone. The snapshot clock is the mocked Date.
function timedPorts(t,{present,startAt,endAt,events,enableTimers=true,filmedMaterial}){
  if(enableTimers)t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  startAt??=Date.now();endAt??=startAt+30000;
  const seen=[],shown=[],prepared=[],prepareOptions=[],revealed=[];
  const cards={restore(){},sync(){},clear(){},close(){},show:draw=>shown.push(draw),reveal:()=>revealed.push(Date.now()),begin:(_video,source)=>source.shoeDraw,frame(){},finish(){}};
  const media={filmedMaterial,state(){},prepareSequence(value,options){prepared.push(value);prepareOptions.push(options);},async present(event,options){seen.push({event,options,at:Date.now()});return present?present(event,options):true;},close(){}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now,filmedProfile:dragan,dealerId:'dragan'});t.after(()=>ports.close());
  const signal=new AbortController().signal;
  ports.restoreSnapshot(seated(1,{serverNow:Date.now()}),{signal});ports.restoreSnapshot(seated(2,{presentationVer:1,serverNow:Date.now()}),{signal});
  const plan={roomId,ver:1,talkId:'timed',kind:'plan',startAt,endAt,events};
  return {seen,shown,prepared,prepareOptions,revealed,plan,start:()=>ports.present(plan,{signal})};
}

test('a filmed step starts at its own time on the table clock, names its exact take for the lookahead and carries the handover',async t=>{
  const h=timedPorts(t,{events:[filmedBox(0,9)]});
  const result=h.start();await flushRender();
  assert.equal(h.seen.length,0,'700 ms lead before the first take (K shared-table.mjs:150)');
  assert.deepEqual(h.prepared[0][0].filmedTake,{profileId:dragan.id,takeKey:'1:iv',sha256:dragonTake('1:iv').sha256});
  t.mock.timers.tick(699);await flushRender();assert.equal(h.seen.length,0);
  t.mock.timers.tick(1);await flushRender();assert.equal(h.seen.length,1);assert.equal(h.seen[0].at,1700);
  const options=h.seen[0].options;
  assert.equal(options.startOffset,0);assert.ok(Math.abs(options.handoverAt-frameMs(66-1.5)/1000)<1e-9);assert.equal(options.playbackRate,undefined);
  assert.equal(options.clockTime(),0);t.mock.timers.tick(1000);assert.ok(Math.abs(options.clockTime()-1)<1e-9,'the clock is the table clock from the step start');
  await result;
});

// K04 F5: the plan's filmed steps are asked for when it begins, so no step waits for the server at its time.
test('a timed plan asks for the answers of its filmed steps when it begins, not after the server turn',async t=>{
  const h=timedPorts(t,{events:[{type:'speak',line:'goodluck'},filmedBox(6,1),filmedBox(0,2)]});
  const result=h.start();await flushRender();
  assert.deepEqual(h.prepareOptions,[{selectAhead:true}]);
  assert.deepEqual(h.prepared[0].map(event=>event.filmedTake?.takeKey??null),[null,'7:i','1:v']);
  t.mock.timers.tick(10000);await result;
  const shown=[],options=[];
  const cards={restore(){},sync(){},clear(){},close(){},show:draw=>shown.push(draw),reveal(){},begin(){},frame(){},finish(){}};
  const media={state(){},close(){},prepareSequence(_value,value){options.push(value);},present:()=>assert.fail('no film after the server turn')};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now,filmedProfile:dragan,dealerId:'dragan'});t.after(()=>ports.close());
  const round={phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand']},signal=new AbortController().signal;
  ports.restoreSnapshot(seated(1,{serverNow:Date.now()}),{signal});
  ports.restoreSnapshot(seated(2,{phase:'round',roundId:'round-1',presentationVer:1,serverNow:Date.now(),round,plan:{id:'late',startAt:Date.now()-5000,endAt:Date.now()+1000,turnAt:Date.now()-1}}),{signal});
  await ports.present({roomId,ver:1,talkId:'late',kind:'plan',startAt:Date.now()-5000,endAt:Date.now()+1000,events:[filmedBox(6,1),filmedBox(0,2)]},{signal});
  assert.deepEqual(options,[{selectAhead:false}],'past turnAt every card shows at once: nothing to ask for');assert.deepEqual(shown,[1,2]);
});

test('joined takes chain back to back: an early handover waits for the boundary before the next take',async t=>{
  const h=timedPorts(t,{events:[filmedBox(6,1),filmedBox(0,2)]});
  const result=h.start();t.mock.timers.tick(700);await flushRender();assert.equal(h.seen.length,1);
  assert.deepEqual(h.prepared[0].map(event=>event.filmedTake.takeKey),['7:i','1:v']);
  t.mock.timers.tick(frameMs(66)-1);await flushRender();assert.equal(h.seen.length,1,'the second take is not started before its time');
  t.mock.timers.tick(1);await flushRender();assert.equal(h.seen.length,2);assert.equal(h.seen[1].at,1000+700+frameMs(66));
  assert.equal(h.seen[1].options.startOffset,0);await result;
});

test('a step reached late joins in phase and one whose time is over shows its committed card without film',async t=>{
  const late=timedPorts(t,{events:[filmedBox(0,9)]});
  t.mock.timers.tick(1100);const first=late.start();await flushRender();
  assert.equal(late.seen.length,1);assert.equal(late.seen[0].at,2100);assert.ok(Math.abs(late.seen[0].options.startOffset-.4)<1e-9,'400 ms late: seek into phase');
  await first;
  const expired=timedPorts(t,{events:[filmedBox(0,9),{type:'reveal',to:'dealer',shoeDraw:8}],enableTimers:false});
  // 1:iv (66 frames) then the flip after an 80 ms gap: arrive 300 ms into the flip's time
  t.mock.timers.tick(700+frameMs(66)+80+300);const second=expired.start();await flushRender();
  assert.equal(expired.seen.length,1,'no film for the take whose time is over (K app.js:182); the reveal that follows plays');
  assert.deepEqual(expired.shown,[9],'the expired deal shows its committed card at once');
  assert.equal(expired.seen[0].event.type,'reveal');assert.ok(Math.abs(expired.seen[0].options.startOffset-.3)<1e-9,'the reveal joins in phase');
  await second;assert.equal(expired.revealed.length,1,'the committed reveal is applied once, by the step itself');
});

test('a filmed chain after speech anchors where it begins and keeps the clock inside the chain',async t=>{
  const h=timedPorts(t,{events:[{type:'speak',line:'goodluck'},filmedBox(6,1),filmedBox(0,2)],
    present:event=>event.type==='speak'?new Promise(resolve=>setTimeout(()=>resolve(true),2500)):true});
  const result=h.start();await flushRender();
  assert.equal(h.seen.length,1);assert.equal(h.seen[0].at,1000,'speech is not on the take clock');assert.equal(h.seen[0].options.startOffset,undefined);
  t.mock.timers.tick(2500);await flushRender();
  assert.equal(h.seen.length,2);assert.equal(h.seen[1].at,3500,'the first take starts when the speech is over, with no seek');assert.equal(h.seen[1].options.startOffset,0);
  t.mock.timers.tick(frameMs(66)-1);await flushRender();assert.equal(h.seen.length,2);
  t.mock.timers.tick(1);await flushRender();assert.equal(h.seen.length,3);assert.equal(h.seen[2].at,3500+frameMs(66));
  await result;
});

test('a chain longer than the game window plays at the fitted rate on a fitted clock; the window itself is untouched',async t=>{
  const h=timedPorts(t,{events:[filmedBox(0,9)],endAt:1000+2000});
  const result=h.start();t.mock.timers.tick(700);await flushRender();
  assert.equal(h.seen.length,1);assert.equal(h.seen[0].options.playbackRate,2);
  t.mock.timers.tick(500);assert.ok(Math.abs(h.seen[0].options.clockTime()-1)<1e-9,'take time runs twice as fast');
  await result;
});

test('without a profile, a start time or a matching filmed order the steps play untimed as before',async t=>{
  const order=timedPorts(t,{events:[{type:'deal',to:'dealer',box:null,shoeDraw:7,faceDown:false},filmedBox(0,6)]});
  const first=order.start();await flushRender();
  assert.equal(order.seen.length,2,'both steps start at once: the published order is not the filmed chain');
  assert.equal(order.seen[0].options.startOffset,undefined);assert.equal(order.prepared[0][0].filmedTake,undefined);
  await first;
  const untimed=timedPorts(t,{events:[filmedBox(0,9)],enableTimers:false});delete untimed.plan.startAt;
  const second=untimed.start();await flushRender();assert.equal(untimed.seen.length,1);assert.equal(untimed.seen[0].options.handoverAt,undefined);
  await second;
});

const reducedFilmedMaterial=()=>{
  const transitions={toShoe:{id:'to-shoe',sha256:'a'.repeat(64),durationMs:2000},fromShoe:{id:'from-shoe',sha256:'b'.repeat(64),durationMs:1000}};
  return {revision:'native-film-v2-'+'c'.repeat(64),dealerId:'dragan',language:'sv',leadMs:10000,cardMs:6000,
    media:[...dragan.takes.filter(take=>take.variant==='').map(take=>({id:'take-'+take.target,sha256:take.sha256})),
      ...Object.values(transitions).map(({id,sha256})=>({id,sha256}))],
    film:{schemaVersion:1,profileId:dragan.id,transitions}};
};

test('a reduced frozen bank prefetches and hands over the exact take selected with shoe transitions',async t=>{
  const take=dragonTake('1:base'),h=timedPorts(t,{events:[filmedBox(0,1)],filmedMaterial:reducedFilmedMaterial()});
  const pending=h.start();await flushRender();
  assert.deepEqual(h.prepared[0][0].filmedTake,{profileId:dragan.id,takeKey:take.key,sha256:take.sha256});
  t.mock.timers.tick(699);await flushRender();assert.equal(h.seen.length,0);
  t.mock.timers.tick(1);await flushRender();assert.equal(h.seen[0].at,1700,'begin the complete entry clip at the chain start');
  assert.equal(h.seen[0].options.startOffset,0);
  assert.equal(h.seen[0].options.handoverAt,frameMs(Math.min(take.frames,Math.max(take.frames-1.5,take.clearFrame+1)))/1000);
  assert.equal(h.seen[0].options.clockTime(),0,'entry duration is not counted as take time');
  await pending;
});

test('late live shoe entry reanchors the local chain while an expired complete chain only shows committed cards',async t=>{
  const material=reducedFilmedMaterial(),events=[filmedBox(0,1),filmedBox(1,2)];
  const firstDuration=frameMs(dragonTake('1:base').frames);
  const h=timedPorts(t,{events,filmedMaterial:material});
  t.mock.timers.tick(3200);const pending=h.start();await flushRender();
  assert.equal(h.seen.length,1);assert.equal(h.seen[0].options.startOffset,0,'play the entire entry and its take from the start');
  assert.equal(h.plan.endAt,31000,'the server deadline stays unchanged');
  t.mock.timers.tick(2000+firstDuration-1);await flushRender();assert.equal(h.seen.length,1);
  t.mock.timers.tick(1);await flushRender();assert.equal(h.seen.length,2,'next joined take waits for full entry and first take');
  assert.equal(h.seen[1].options.startOffset,0);await pending;
  const expired=timedPorts(t,{events:[filmedBox(0,3)],filmedMaterial:material,enableTimers:false});
  t.mock.timers.tick(700+2000+firstDuration+1000);
  await expired.start();assert.equal(expired.seen.length,0);assert.deepEqual(expired.shown,[3]);
});


// K04-i-d on staging (27 Oct 2026, cc415cd8): the dealer's goodluck clip answered 404 while the
// server round was already in decisions; the table showed no text, no cards and no buttons.
const missingGoodluckPlan=at=>({roomId,ver:1,talkId:'plan-missing',auditSeq:1,status:'ready',kind:'plan',windowId:'window-1',configVersion:'cfg-1',language:'sv',
  startAt:at,endAt:at+12000,lines:[],events:[{type:'speak',line:'goodluck'},{type:'deal',to:'box',box:0,shoeDraw:1,faceDown:false},
    {type:'deal',to:'dealer',box:null,shoeDraw:2,faceDown:false},{type:'deal',to:'box',box:0,shoeDraw:3,faceDown:false},
    {type:'deal',to:'dealer',box:null,shoeDraw:4,faceDown:true},{type:'turn',box:0,handIndex:0}]});
test('a missing goodluck file ends that step and the film of its plan at once: cards now, the buttons at the server turn time',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const seen=[],shown=[],states=[],renders=[],errors=[],sockets=[];
  const cards={restore(){},sync(){},clear(){},close(){},show:draw=>shown.push(draw),reveal(){},begin(){},frame(){},finish(){}};
  // The goodluck file is gone (404); every deal clip would still be downloading.
  const media={state:value=>states.push(value),prepareSequence(){},close(){},
    async present(event,options){seen.push(event.type);if(event.type==='speak'){options.onUnavailable();return false;}return new Promise(()=>{});}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now});
  const commands={state:'idle',send:async()=>({status:'ok',result:{op:'act',version:3}}),stop(){}};
  const controller=createSharedRoomController({roomId,commands,view:{bind(){},render:value=>renders.push(value),close(){}},presentation:ports,now:Date.now});
  class Socket extends EventTarget{readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}
    message(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,...value})}));}}
  const client=createSharedRoomClient({roomId,browserOrigin:'https://game.invalid',WebSocket:Socket,callbackTimeoutMs:30000,
    restoreSnapshot:controller.restoreSnapshot,present:controller.present,onError:error=>errors.push(error)});
  t.after(()=>{client.stop();controller.stop();});client.start();
  sockets[0].message({snapshot:seated(1,{serverNow:Date.now()}),presentation:null});await flushRender();
  const plan=missingGoodluckPlan(Date.now()),round={phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand']};
  sockets[0].message({snapshot:seated(2,{phase:'round',roundId:'round-1',presentationVer:1,serverNow:Date.now(),round,
    plan:{id:'plan-missing',startAt:plan.startAt,endAt:plan.endAt,turnAt:plan.endAt},actionDeadline:plan.endAt+15000}),presentation:plan});
  await flushRender();await flushRender();
  assert.deepEqual(seen,['speak'],'no deal film is loaded after the missing file');
  assert.deepEqual(shown,[1,2,3,4],'every committed card is shown at once');
  assert.equal(states.at(-1).action,false,'the presentation is over and the dealer returns to idle');
  assert.equal(renders.at(-1).busy,false);assert.deepEqual(renders.at(-1).can.act,[],'the server has not opened the turn yet');
  t.mock.timers.tick(11999);await flushRender();assert.deepEqual(renders.at(-1).can.act,[]);
  t.mock.timers.tick(2);await flushRender();
  assert.deepEqual(renders.at(-1).can.act,['hit','stand'],'the buttons appear at the server turn time');
  t.mock.timers.tick(30000);await flushRender();assert.deepEqual(errors,[]);assert.equal(client.status().state,'running');
});

test('after a missing file the remaining filmed steps of that plan neither wait for their clock nor load film',async t=>{
  const h=timedPorts(t,{events:[{type:'speak',line:'goodluck'},filmedBox(6,1),filmedBox(0,2),{type:'reveal',to:'dealer',shoeDraw:3}],
    present:(event,options)=>{if(event.type!=='speak')return true;options.onUnavailable();return false;}});
  await h.start();
  assert.deepEqual(h.seen.map(row=>row.event.type),['speak']);assert.deepEqual(h.shown,[1,2]);
  assert.deepEqual(h.revealed,[1000],'no step waited for its time on the table clock');
});

test('a late unavailable callback from a finished clip cannot skip the steps that follow',async t=>{
  let late;
  const h=timedPorts(t,{events:[{type:'speak',line:'goodluck'},{type:'speak',line:'insurance'},{type:'speak',line:'win'}],
    present:(event,options)=>{if(event.line==='goodluck')late=options.onUnavailable;else if(event.line==='insurance')late();return true;}});
  await h.start();
  assert.deepEqual(h.seen.map(row=>row.event.line),['goodluck','insurance','win']);
});

// K04-i-e on staging (27 Oct 2026): at 400 kbit/s a 1.1-1.7 MB deal clip needs 22-34 s before its first frame.
test('a slow clip download that keeps receiving bytes holds its step past thirty seconds without a renderer timeout',async t=>{
  const plan=await sevenSeatPlan();plan.presentation.events=[plan.presentation.events.find(event=>event.type==='deal')];plan.presentation.lines=[];
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});let context;const done=deferred();
  const h=timedPresentation(t,async(_event,options)=>{context=options;options.onProgress({clip:1,phase:'prepare'});options.onProgress({clip:1,phase:'play'});await done.promise;return true;});
  h.sockets[0].message({snapshot:snapshot(),presentation:null});await flushRender();h.sockets[0].message(plan);await flushRender();
  for(let second=10;second<=60;second+=10){t.mock.timers.tick(10000);context.onProgress({clip:1,phase:'download',received:second*50000});await flushRender();assert.deepEqual(h.errors,[]);}
  context.onProgress({clip:1,phase:'frame',time:0});done.resolve();await flushRender();
  assert.equal(h.client.status().state,'running');assert.deepEqual(h.errors,[]);assert.equal(context.signal.aborted,false);
});

test('a download whose byte count stops moving still fails closed after thirty seconds',async t=>{
  const plan=await sevenSeatPlan();plan.presentation.events=[plan.presentation.events.find(event=>event.type==='deal')];plan.presentation.lines=[];
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});let context;
  const h=timedPresentation(t,async(_event,options)=>{context=options;options.onProgress({clip:1,phase:'prepare'});options.onProgress({clip:1,phase:'play'});return new Promise(()=>{});});
  h.sockets[0].message({snapshot:snapshot(),presentation:null});await flushRender();h.sockets[0].message(plan);await flushRender();
  context.onProgress({clip:1,phase:'download',received:4096});
  for(let i=0;i<5;i++){t.mock.timers.tick(5000);context.onProgress({clip:1,phase:'download',received:4096});await flushRender();assert.deepEqual(h.errors,[]);}
  t.mock.timers.tick(5000);await flushRender();
  assert.deepEqual(h.errors,[{code:'shared_room_renderer_timeout'}]);assert.equal(context.signal.aborted,true);
});

// K04 F2 on staging (28 Oct 2026, 13aa5a01, 400 kbit/s): turnAt came 56.5 s into the run, the server stood
// for the player at 72 s and the first cards showed at 92 s. A 1.58 MB deal clip kept downloading from 59 to
// 91 s after its step had passed the table clock; only steps that had not started were skipped.
const slowDownload=options=>new Promise(resolve=>{
  options.onProgress({clip:1,phase:'prepare'});options.onProgress({clip:1,phase:'play'});
  // 50 kB/s keeps arriving, so the silence guard never ends this clip.
  let received=0;const tick=()=>{if(options.signal.aborted)return;received+=50000;options.onProgress({clip:1,phase:'download',received});setTimeout(tick,1000);};
  setTimeout(tick,1000);options.signal.addEventListener('abort',()=>resolve(false),{once:true});
});
const playsFor=(ms,options)=>new Promise(resolve=>{
  options.onProgress({clip:1,phase:'prepare'});options.onProgress({clip:1,phase:'play'});
  let at=0;const frame=()=>{options.onProgress({clip:1,phase:'frame',time:at/1000});options.onFrame(at/1000);};frame();
  const tick=()=>{at+=250;frame();if(at>=ms){options.onProgress({clip:1,phase:'complete'});resolve(true);}else setTimeout(tick,250);};setTimeout(tick,250);
});
function slowTable(t,{present,windowMs,filmedProfile=null,dealerId=null}){
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const seen=[],shown=[],states=[],renders=[],errors=[],mediaErrors=[],sockets=[];
  const syncs=[];
  const cards={restore(){},sync:round=>syncs.push(round),clear(){},close(){},show:draw=>shown.push({draw,at:Date.now()}),reveal(){},begin(){},frame(){},finish(){}};
  const media={state:value=>states.push(value),prepareSequence(){},close(){},
    present(event,options){seen.push({event,options,at:Date.now()});return present(event,options);}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now,filmedProfile,dealerId,onError:code=>mediaErrors.push(code)});
  const commands={state:'idle',send:async()=>({status:'ok',result:{op:'act',version:3}}),stop(){}};
  const controller=createSharedRoomController({roomId,commands,view:{bind(){},render:value=>renders.push(value),close(){}},presentation:ports,now:Date.now});
  class Socket extends EventTarget{readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}
    message(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,...value})}));}}
  const client=createSharedRoomClient({roomId,browserOrigin:'https://game.invalid',WebSocket:Socket,callbackTimeoutMs:30000,
    restoreSnapshot:controller.restoreSnapshot,present:controller.present,onError:error=>errors.push(error)});
  t.after(()=>{client.stop();controller.stop();});client.start();
  const plan={...missingGoodluckPlan(1000),talkId:'plan-slow',endAt:1000+windowMs};
  const round={phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand']};
  return {seen,shown,states,renders,errors,mediaErrors,client,plan,sockets,syncs,round,
    async open(){
      sockets[0].message({snapshot:seated(1,{serverNow:Date.now()}),presentation:null});await flushRender();
      sockets[0].message({snapshot:seated(2,{phase:'round',roundId:'round-1',presentationVer:1,serverNow:Date.now(),round,
        plan:{id:'plan-slow',startAt:plan.startAt,endAt:plan.endAt,turnAt:plan.endAt},actionDeadline:plan.endAt+15000}),presentation:plan});
      await flushRender();
    },
    async until(at){while(Date.now()<at){t.mock.timers.tick(Math.min(250,at-Date.now()));await flushRender();}},
    act:()=>renders.at(-1).can.act,
  };
}

test('at 400 kbit/s a deal clip still loading when its step time is over is left: its card shows now and hit/stand open at turnAt',async t=>{
  const h=slowTable(t,{windowMs:27600,filmedProfile:dragan,dealerId:'dragan',present:(event,options)=>event.type==='speak'?playsFor(2500,options):slowDownload(options)});
  await h.open();
  // goodluck plays 1.0-3.5 s; the chain anchors after it (+1.8 s): 1:i, dealer:base, 1:base and hole:base
  // are due at 6.25, 7.875, 9.5 and 11.125 s on the table clock.
  const due=[1000+1800+3450,1000+1800+5075,1000+1800+6700,1000+1800+8325];
  await h.until(due[0]-250);assert.deepEqual(h.shown,[],'the first deal is still within its time');
  await h.until(due[0]);
  assert.deepEqual(h.shown.map(row=>row.draw),[1],'its committed card shows when the step time is over');
  const first=h.seen.find(row=>row.event.shoeDraw===1).options.signal;assert.equal(first.aborted,true);assert.equal(first.reason.late,true);
  await h.until(due[3]);
  assert.deepEqual(h.shown.map(row=>row.draw),[1,2,3,4]);
  h.shown.forEach((row,i)=>assert.ok(row.at<=due[i]+250,`card ${row.draw} by its step time`));
  assert.equal(h.seen.filter(row=>row.event.type==='deal').every(row=>row.options.signal.reason?.late===true),true);
  assert.equal(h.states.at(-1).action,false,'the presentation is over; the dealer returns to idle');
  assert.equal(h.renders.at(-1).busy,false);assert.deepEqual(h.act(),[],'the server has not opened the turn yet');
  await h.until(h.plan.endAt-1);assert.deepEqual(h.act(),[]);
  await h.until(h.plan.endAt+2);assert.deepEqual(h.act(),['hit','stand'],'the buttons open at turnAt');
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.mediaErrors,[],'a late step is not a media error');assert.equal(h.client.status().state,'running');
});

test('a clip still loading at the server turn time is left: every committed card shows and hit/stand open at turnAt',async t=>{
  const h=slowTable(t,{windowMs:12000,present:(_event,options)=>slowDownload(options)});
  await h.open();
  await h.until(h.plan.endAt-250);assert.deepEqual(h.shown,[]);assert.deepEqual(h.act(),[]);
  await h.until(h.plan.endAt+2);
  assert.deepEqual(h.seen.map(row=>row.event.type),['speak'],'no deal film is loaded after turnAt');
  assert.equal(h.seen[0].options.signal.reason.late,true);
  assert.deepEqual(h.shown.map(row=>row.draw),[1,2,3,4]);assert.ok(h.shown.every(row=>row.at<=h.plan.endAt+250));
  assert.deepEqual(h.act(),['hit','stand']);assert.equal(h.renders.at(-1).busy,false);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.mediaErrors,[]);
});

test('a clip that already plays at turnAt plays to its end; the steps after it show their cards without film',async t=>{
  const h=slowTable(t,{windowMs:12000,present:(event,options)=>event.type==='speak'?new Promise(resolve=>setTimeout(()=>resolve(playsFor(12500,options)),1000)):slowDownload(options)});
  await h.open();
  await h.until(h.plan.endAt+1000);
  assert.equal(h.seen[0].options.signal.aborted,false,'a clip that shows frames is never cut by turnAt');
  assert.deepEqual(h.shown.map(row=>row.draw),[1,2,3,4],'K04 R2a: the committed cards show at turnAt, not when the clip ends');
  await h.until(1000+1000+12500+250);
  assert.deepEqual(h.seen.map(row=>row.event.type),['speak']);assert.deepEqual(h.shown.map(row=>row.draw),[1,2,3,4]);
  assert.deepEqual(h.act(),['hit','stand']);assert.deepEqual(h.errors,[]);assert.deepEqual(h.mediaErrors,[]);
});

// Mocked timers replace the global setTimeout only.
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// K04 F3 (staging 28 Oct 2026, 43b7404e): hit/stand opened 1.1-2.6 s after turnAt. The controller and the
// presentation took the server's clock only after the media binding read (GET /binding, 1-2.5 s in staging),
// so both table clocks ran that much behind the server. The clock belongs to the moment the frame arrived.
test('a slow binding read never moves the table clock: cards and hit/stand still come at the server turnAt',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const BINDING_MS=2500,SKEW_MS=40000,server=()=>Date.now()+SKEW_MS;
  const shown=[],renders=[],errors=[],mediaErrors=[],sockets=[],restored=[];
  const cards={restore(){},sync(){},clear(){},close(){},show:draw=>shown.push({draw,at:Date.now()}),reveal(){},begin(){},frame(){},finish(){}};
  // Every clip is still loading: only the table clock can end the steps.
  const media={state(){},prepareSequence(){},close(){},present:(_event,options)=>new Promise(resolve=>options.signal.addEventListener('abort',()=>resolve(false),{once:true}))};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now,onError:code=>mediaErrors.push(code)});
  const presentation={close:ports.close,present:ports.present,
    restoreSnapshot:(value,options)=>{restored.push(options.receivedAt);return wait(BINDING_MS).then(()=>ports.restoreSnapshot(value,options));}};
  const commands={state:'idle',send:async()=>({status:'ok',result:{op:'act',version:3}}),stop(){}};
  const controller=createSharedRoomController({roomId,commands,view:{bind(){},render:value=>renders.push(value),close(){}},presentation,now:Date.now});
  class Socket extends EventTarget{readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}
    message(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,...value})}));}}
  const client=createSharedRoomClient({roomId,browserOrigin:'https://game.invalid',WebSocket:Socket,callbackTimeoutMs:30000,
    restoreSnapshot:controller.restoreSnapshot,present:controller.present,onError:error=>errors.push(error)});
  t.after(()=>{client.stop();controller.stop();});client.start();
  const until=async at=>{while(Date.now()<at){t.mock.timers.tick(Math.min(50,at-Date.now()));await flushRender();}};
  sockets[0].message({snapshot:seated(1,{serverNow:server()}),presentation:null});await until(Date.now()+BINDING_MS+100);
  const plan={...missingGoodluckPlan(server()),talkId:'plan-binding'},turnAt=plan.endAt-SKEW_MS;
  const round={phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand']};
  const arrived=Date.now();
  sockets[0].message({snapshot:seated(2,{phase:'round',roundId:'round-1',presentationVer:1,serverNow:server(),round,
    plan:{id:'plan-binding',startAt:plan.startAt,endAt:plan.endAt,turnAt:plan.endAt},actionDeadline:plan.endAt+15000}),presentation:plan});
  await flushRender();assert.equal(restored.at(-1),arrived,'the socket hands over the arrival time of the frame');
  await until(turnAt-1);assert.deepEqual(renders.at(-1).can.act,[]);assert.deepEqual(shown,[],'no card before the server turn time');
  await until(turnAt+1);
  assert.deepEqual(renders.at(-1).can.act,['hit','stand'],'the buttons open at the server turnAt, not one binding read later');
  assert.deepEqual(shown.map(row=>row.draw),[1,2,3,4]);assert.ok(shown.every(row=>row.at<=turnAt+50),'every committed card shows at turnAt');
  assert.deepEqual(errors,[]);assert.deepEqual(mediaErrors,[]);
});

// K04 R2 (review of #478): a take that shows frames at turnAt plays to its end, and `presenting` kept hit/stand
// closed until the plan was over, up to a whole take (about 2.75 s) past turnAt. The decision opens on the
// server's clock; the film may still finish on screen, and every other control waits for it.
test('hit/stand and insurance open at turnAt while a take still plays; every other control waits for the presentation',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  for(const phase of ['decisions','insurance']){
    const playing=deferred();
    const h=harness(t,{now:Date.now,presentation:{restoreSnapshot(){},present:()=>playing.promise,close(){}}});
    const round={phase,active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand']};
    await h.restore(seated(2,{phase:'round',roundId:'round-1',serverNow:Date.now(),round,plan:{id:'p',startAt:Date.now()-500,endAt:Date.now()+500,turnAt:Date.now()+500},
      actionDeadline:Date.now()+15500,me:{...seated().me,insuranceDue:phase==='insurance'}}));
    const presenting=h.controller.present({ver:1},{signal:new AbortController().signal});
    const can=()=>h.renders.at(-1).can;
    assert.deepEqual(can().act,[]);assert.equal(can().insurance,false);assert.equal(can().refill,false,'no control while the plan plays before turnAt');
    t.mock.timers.tick(499);assert.deepEqual(can().act,[]);assert.equal(can().insurance,false);
    t.mock.timers.tick(2);
    if(phase==='decisions')assert.deepEqual(can().act,['hit','stand'],'hit/stand at turnAt although the take still plays');
    else assert.equal(can().insurance,true,'insurance at turnAt although the take still plays');
    assert.equal(h.renders.at(-1).busy,true);assert.equal(can().refill,false,'other controls still wait for the presentation');
    if(phase==='decisions'){await h.controller.dispatch('act',{action:'stand'});assert.equal(h.calls.at(-1).action,'stand');}
    playing.resolve();await presenting;
    if(phase==='insurance')assert.equal(can().refill,true,'the rest opens when the presentation is over');
  }
});

test('a take still playing at turnAt no longer holds hit/stand: the buttons open at turnAt and the film plays to its end',async t=>{
  const h=slowTable(t,{windowMs:12000,present:(event,options)=>event.type==='speak'?new Promise(resolve=>setTimeout(()=>resolve(playsFor(12500,options)),1000)):slowDownload(options)});
  await h.open();
  await h.until(h.plan.endAt-1);assert.deepEqual(h.act(),[]);
  await h.until(h.plan.endAt+2);
  assert.deepEqual(h.act(),['hit','stand'],'the buttons open at the server turnAt');
  assert.equal(h.renders.at(-1).busy,true,'the take still plays');assert.equal(h.seen[0].options.signal.aborted,false,'turnAt never cuts a take that shows frames');
  assert.deepEqual(h.shown.map(row=>row.draw),[1,2,3,4],'K04 R2a: every committed card shows at turnAt with the buttons');
  assert.ok(h.shown.every(row=>row.at<=h.plan.endAt+2));
  await h.until(1000+1000+12500+250);
  assert.deepEqual(h.shown.map(row=>row.draw),[1,2,3,4]);assert.deepEqual(h.act(),['hit','stand']);assert.deepEqual(h.errors,[]);assert.deepEqual(h.mediaErrors,[]);
});

// K04 R2a (review of #481): at turnAt hit/stand opened while the plan's cards could still be hidden: a film part
// that shows frames plays on, the step loop waits for it, and only then did the remaining steps show their cards.
test('at turnAt the card of a take that still plays and every later card of the plan show; the take plays to its end',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const log=[];let options;
  const cards={restore(){},sync(){},clear(){},close(){},show:draw=>log.push(['show',draw,Date.now()]),reveal:()=>log.push(['reveal',null,Date.now()]),
    begin:(_video,event)=>{log.push(['begin',event.shoeDraw,Date.now()]);return 'token-'+event.shoeDraw;},
    frame:token=>log.push(['frame',token,Date.now()]),finish:(token,draw)=>log.push(['finish',draw,Date.now()])};
  const media={state(){},prepareSequence(){},close(){},present(event,value){
    if(event.shoeDraw!==1)assert.fail('no film after turnAt');
    options=value;value.onProgress({clip:1,phase:'prepare'});value.onSelected({id:'take'},event);value.onProgress({clip:1,phase:'play'});
    return new Promise(resolve=>{let at=0;const tick=()=>{value.onProgress({clip:1,phase:'frame',time:at/1000});value.onFrame(at/1000);at+=250;if(at>3000)resolve(true);else setTimeout(tick,250);};tick();});}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now});t.after(()=>ports.close());
  const round={phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[],legalActions:['hit','stand']},signal=new AbortController().signal;
  ports.restoreSnapshot(seated(1,{serverNow:Date.now()}),{signal});
  const turnAt=Date.now()+1000;
  ports.restoreSnapshot(seated(2,{phase:'round',roundId:'round-1',presentationVer:1,serverNow:Date.now(),round,plan:{id:'p',startAt:Date.now(),endAt:turnAt,turnAt}}),{signal});
  const events=[{type:'deal',to:'box',box:0,shoeDraw:1,faceDown:false},{type:'deal',to:'dealer',box:null,shoeDraw:2,faceDown:false},{type:'deal',to:'box',box:0,shoeDraw:3,faceDown:false}];
  let done=false;const presenting=ports.present({roomId,ver:1,talkId:'turn',kind:'plan',startAt:Date.now(),endAt:turnAt,events},{signal}).then(()=>{done=true;});
  await flushRender();
  const until=async at=>{while(Date.now()<at){t.mock.timers.tick(Math.min(250,at-Date.now()));await flushRender();}};
  await until(turnAt-1);
  assert.deepEqual(log.filter(([kind])=>kind!=='frame'),[['begin',1,1000]],'before turnAt the first card follows its take');
  await until(turnAt);
  assert.deepEqual(log.filter(([kind,,at])=>kind!=='frame'&&at===turnAt),[['finish',1,turnAt],['show',1,turnAt],['show',2,turnAt],['show',3,turnAt]],
    'the playing card is placed and every later card shows at turnAt');
  assert.equal(options.signal.aborted,false,'the take is not cut');assert.equal(done,false,'it plays on');
  await until(1000+3500);await presenting;assert.equal(done,true);
  assert.deepEqual(log.filter(([kind,,at])=>at>turnAt),[],'no card is moved, shown or finished again after turnAt');
});

// K04 review of #481: the insurance box showed as soon as the snapshot carried insuranceDue, at the start of the
// plan, before the dealer's up card was dealt on screen; it told the player of the dealer's ace before its step.
test('the insurance box stays hidden until turnAt, when every card of the plan shows',()=>{
  const {document,nodes}=documentFixture();const view=createSharedRoomView({document});view.bind({dispatch(){},selectChip(){},retry(){}});
  const s=seated(2,{phase:'round',roundId:'round-1',serverNow:1000,round:{phase:'insurance',active:0,hands:[{box:0,cards:[]}],dealer:[]},
    plan:{id:'p',startAt:1000,endAt:5000,turnAt:5000},actionDeadline:20000,me:{...seated().me,insuranceDue:true}});
  const can={join:false,bet:false,leave:false,act:[],insurance:false},render=(snapshot,serverNow,insurance=false)=>
    view.render({snapshot,chip:.5,can:{...can,insurance},notice:'',retry:false,busy:true,connected:true,serverNow});
  render(s,1000);assert.equal(nodes.get('insurance').hidden,true,'not at the start of the plan');
  render(s,4999);assert.equal(nodes.get('insurance').hidden,true,'not before turnAt');
  render(s,5000,true);assert.equal(nodes.get('insurance').hidden,false,'at turnAt');assert.equal(nodes.get('ins-no').disabled,false);
  render(s,9000);assert.equal(nodes.get('insurance').hidden,false,'a reconnect inside the insurance window shows it at once');
  render({...s,me:{...s.me,insuranceDue:false}},9000);assert.equal(nodes.get('insurance').hidden,true,'answered or not due');
  render({...s,round:{...s.round,phase:'decisions'}},9000);assert.equal(nodes.get('insurance').hidden,true,'not outside the insurance phase');
  view.close();
});

test('a film part that shows frames plays on past its step time; a later part of the same step does not start after it',async t=>{
  let first;
  const h=timedPorts(t,{events:[filmedBox(0,9)],present:(_event,options)=>{first=options;return playsFor(4000,options);}});
  const pending=h.start();t.mock.timers.tick(700);await flushRender();assert.equal(h.seen.length,1);
  // 1:iv is due 700+2750 ms after the start; its frames keep it until 4 s after it began.
  for(let i=0;i<16;i++){t.mock.timers.tick(250);await flushRender();}
  await pending;assert.equal(first.signal.aborted,false);assert.deepEqual(h.shown,[9]);
  let second;
  const parts=timedPorts(t,{events:[filmedBox(0,8)],enableTimers:false,present:(_event,options)=>{second=options;
    return playsFor(4000,options).then(()=>{options.onProgress({clip:2,phase:'prepare'});return new Promise(()=>{});});}});
  const later=parts.start();t.mock.timers.tick(700);await flushRender();
  for(let i=0;i<16;i++){t.mock.timers.tick(250);await flushRender();}
  await later;assert.equal(second.signal.reason?.late,true,'the next part of a step whose time is over is left');assert.deepEqual(parts.shown,[8]);
});

// K04-i-e on staging (27 Oct 2026, 400 kbit/s, 400 ms RTT): the 912 KB idle clip outlasted the 30 s
// render callback, ending in "Bordet kunde inte uppdateras" with seat, chips, bet and ready disabled.
test('a dealer film that shows no frame for a minute never blocks seat, chips, bet or ready',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const sockets=[],renders=[];let mediaOptions;
  class Socket extends EventTarget{readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}}
  const app=await mountSharedRoomApp({document,window,fetchImpl:async url=>bindingResponse(url),
    createSocket:options=>createSharedRoomClient({...options,WebSocket:Socket}),
    createCommands:()=>({state:'idle',send:async()=>({status:'ok',result:{op:'ready',version:2}}),stop(){}}),
    createView:()=>({bind(){},render:value=>renders.push(value),close(){}}),
    createPresentation:async options=>{mediaOptions=options;return{restoreSnapshot(){},present(){},close(){}};}});
  t.after(app.close);
  const bets=[{main:5,pp:0,tp:0},...snapshot().bets.slice(1)];
  sockets[0].dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,snapshot:seated(1,{bets,serverNow:Date.now()}),presentation:null})}));
  for(let i=0;i<4;i++)await flushRender();
  for(let second=5;second<=60;second+=5){t.mock.timers.tick(5000);await flushRender();}
  const last=renders.at(-1);
  assert.equal(app.controller.state.connected,true);assert.equal(last.connected,true);assert.equal(last.busy,false,'chips are enabled');
  for(const op of ['join','bet','ready'])assert.equal(last.can[op],true,op);
  assert.equal(document.documentElement.dataset.presentationStartup,'ready');
  assert.equal(renders.some(row=>/kunde inte uppdateras/.test(row.notice)),false);assert.equal(sockets[0].readyState,1,'the table socket stays open');
  mediaOptions.onReady('astrid');assert.equal(app.controller.state.connected,true,'the late first dealer frame changes no authority');
});

test('the dealer place reads Dealern laddas… until the first verified frame, and a failed film says so',async t=>{
  const {document,nodes}=documentFixture(),window=new EventTarget();window.matchMedia=()=>({matches:false});window.fetch=async()=>Response.json({});
  let media,ready=0;
  const selection={presentation:'local',dealer:'astrid',localDealer:'astrid',operator:'north',roomId,packageRevision:1,registeredDealers:[{id:'astrid',label:'Astrid'}]};
  const port=await mountSharedRoomPresentation({document,window,selection,onReady:id=>{assert.equal(id,'astrid');ready++;},onError(){},createComposition:()=>null,
    loadAdapters:async()=>[{PerformancePlayer:class{dispose(){}}},{createLocalPresentation:async value=>{media=value;return{state(){},start(){},close(){}};}},
      {createLocalCardOverlay:()=>({restore(){},sync(){},clear(){},close(){}})}]});
  t.after(()=>port.close());
  const placeholder=()=>nodes.get('scene').children.find(node=>node.className==='shared-room-dealer-placeholder');
  assert.equal(placeholder().textContent,'Dealern laddas…');assert.equal(placeholder().attributes.role,'status');assert.equal(ready,0);
  media.onError(new Error('Film playback stalled'));assert.equal(placeholder().textContent,'Dealern kunde inte visas.');
  media.onIdle();assert.equal(placeholder(),undefined);assert.equal(ready,1);
  media.onError(new Error('later'));assert.equal(placeholder(),undefined,'a later idle error does not bring the placeholder back');
});

// K04 B1 at table level (external review 28 Oct 2026): other players' bets and ready flags, wallet changes and
// presence arrive as new states of the plan that plays. They reach the controls at once; the film, its card cursor
// and the dealer's media state are left alone until the plan is over.
test('twenty states of the playing plan reach the controls at once without touching its film, cards or media state',async t=>{
  const h=slowTable(t,{windowMs:12000,present:(event,options)=>event.type==='speak'?playsFor(9000,options):slowDownload(options)});
  await h.open();await h.until(3000);
  const states=h.states.length,syncs=h.syncs.length,planState={id:'plan-slow',startAt:h.plan.startAt,endAt:h.plan.endAt,turnAt:h.plan.endAt};
  for(let version=3;version<=22;version++){
    h.sockets[0].message({snapshot:seated(version,{phase:'round',roundId:'round-1',presentationVer:1,serverNow:Date.now(),round:h.round,plan:planState,
      actionDeadline:h.plan.endAt+15000,me:{...seated().me,available:1000-version}}),presentation:h.plan});
    await flushRender();
  }
  assert.equal(h.renders.at(-1).snapshot.version,22);assert.equal(h.renders.at(-1).snapshot.me.available,978,'the newest balance shows during the film');
  assert.equal(h.states.length,states,'no media state change while the plan plays');assert.equal(h.syncs.length,syncs,'the card cursor is not touched');
  assert.equal(h.seen[0].options.signal.aborted,false,'the film plays on');assert.deepEqual(h.errors,[]);assert.equal(h.client.status().state,'running');
  await h.until(h.plan.endAt+500);
  assert.deepEqual(h.shown.map(row=>row.draw),[1,2,3,4]);assert.equal(h.seen.filter(row=>row.event.type==='speak').length,1,'the plan played once');
  assert.equal(h.syncs.length,syncs+1,'the newest state reaches the cards when the plan is over');
  assert.deepEqual(h.states.at(-1),{action:false,speech:false,ready:false});assert.deepEqual(h.act(),['hit','stand']);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.mediaErrors,[]);
});

// K04 R2b (review of #481): a hit during a take that still played past turnAt queued its own plan behind the film,
// so the player's card waited for the end of the take. Once the playing plan's time is over a newer plan leaves it.
test('a hit during a take that plays past turnAt starts its own plan now; its card still waits for its step',async t=>{
  const h=slowTable(t,{windowMs:12000,present:(event,options)=>event.type==='speak'?new Promise(resolve=>setTimeout(()=>resolve(playsFor(12500,options)),1000)):slowDownload(options)});
  await h.open();await h.until(h.plan.endAt+500);
  assert.deepEqual(h.act(),['hit','stand']);assert.equal(h.seen[0].options.signal.aborted,false,'turnAt alone never cuts the take');
  const at=Date.now(),hit={roomId,ver:2,talkId:'plan-hit',auditSeq:2,status:'ready',kind:'plan',windowId:'window-1',configVersion:'cfg-1',language:'sv',
    startAt:at,endAt:at+3000,lines:[],events:[{type:'deal',to:'box',box:0,shoeDraw:5,faceDown:false},{type:'turn',box:0,handIndex:0}]};
  h.sockets[0].message({snapshot:seated(3,{phase:'round',roundId:'round-1',presentationVer:2,serverNow:at,round:h.round,
    plan:{id:'plan-hit',startAt:hit.startAt,endAt:hit.endAt,turnAt:hit.endAt},actionDeadline:hit.endAt+15000}),presentation:hit});
  await flushRender();await flushRender();
  assert.equal(h.seen[0].options.signal.aborted,true,'the superseded take is left');assert.equal(h.seen[0].options.signal.reason.late,true);
  assert.deepEqual(h.seen.filter(row=>row.event.type==='deal').map(row=>row.event.shoeDraw),[5],'the hit plan starts now, not when the old take ends');
  assert.equal(h.renders.at(-1).snapshot.version,3);assert.deepEqual(h.act(),[],'its own turnAt opens the next decision');
  assert.equal(h.shown.some(row=>row.draw===5),false,'no card before its step');
  await h.until(hit.endAt-1);assert.equal(h.shown.some(row=>row.draw===5),false);
  await h.until(hit.endAt+2);assert.ok(h.shown.some(row=>row.draw===5));assert.deepEqual(h.act(),['hit','stand']);
  assert.equal(h.shown.filter(row=>row.draw===5).length,1);assert.deepEqual(h.errors,[]);assert.deepEqual(h.mediaErrors,[]);
});

test('a superseded plan is left only once its time is over on the table clock; other presentations play to their end',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  const shown=[],seen=[];
  const cards={restore(){},sync(){},clear(){},close(){},show:draw=>shown.push([draw,Date.now()]),reveal(){},begin(){},frame(){},finish(){}};
  const media={state(){},prepareSequence(){},close(){},present:(_event,options)=>{seen.push(options.signal);return playsFor(10000,options);}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now});t.after(()=>ports.close());
  const signal=new AbortController().signal,until=async at=>{while(Date.now()<at){t.mock.timers.tick(Math.min(250,at-Date.now()));await flushRender();}};
  ports.restoreSnapshot(seated(1,{serverNow:Date.now()}),{signal});ports.restoreSnapshot(seated(2,{presentationVer:1,serverNow:Date.now()}),{signal});
  const plan={roomId,ver:1,talkId:'p',kind:'plan',startAt:1000,endAt:3000,events:[{type:'deal',to:'box',box:0,shoeDraw:1,faceDown:false},{type:'deal',to:'box',box:0,shoeDraw:2,faceDown:false}]};
  const superseded=new AbortController();let done=false;
  const presenting=ports.present(plan,{signal,superseded:superseded.signal}).then(()=>{done=true;});
  await flushRender();superseded.abort();await flushRender();
  await until(2999);assert.equal(seen[0].aborted,false,'the plan’s own time is not over');assert.deepEqual(shown,[]);
  await until(3000);assert.equal(seen[0].aborted,true);assert.deepEqual(shown,[[1,3000],[2,3000]]);await presenting;assert.equal(done,true);
  ports.restoreSnapshot(seated(3,{presentationVer:2,serverNow:Date.now()}),{signal});
  const window={roomId,ver:2,talkId:'w',kind:'window',startAt:Date.now(),endAt:Date.now(),events:[{type:'speak',line:'placebets'}],lines:[]};
  const ended=new AbortController();ended.abort();done=false;
  const speaking=ports.present(window,{signal,superseded:ended.signal}).then(()=>{done=true;});
  await until(Date.now()+9000);assert.equal(seen[1].aborted,false,'a window speech is never cut');assert.equal(done,false);
  await until(Date.now()+1500);await speaking;assert.equal(done,true);
});

// K04 fynd 3 (external review 28 Oct 2026): a network error, a timeout or a 503 from the binding read failed the
// whole table at once. Transient failures are read again a bounded number of times with a growing wait; nothing
// opens before the server has confirmed the binding.
for(const failure of ['network','timeout',502,503,504])
test(`a transient binding read failure (${failure}) is read again before any control opens`,async t=>{
  let reads=0,h;const connected=[];
  const fail=()=>failure==='network'?Promise.reject(new TypeError('Failed to fetch')):failure==='timeout'?Promise.reject(new DOMException('The operation timed out.','TimeoutError'))
    :Promise.resolve(new Response(null,{status:failure}));
  h=await bindingHarness(t,{bindingRetryDelaysMs:[1,1],fetchImpl:async url=>{reads++;connected.push(h.controller.state.connected);return [1,2,4].includes(reads)?fail():bindingResponse(url);}});
  await h.restore(seated(1));
  assert.equal(reads,5,'two failed binding reads and one failed confirmation are each read again');
  assert.deepEqual(connected,[false,false,false,false,false],'no control while the binding is unconfirmed');
  assert.equal(h.mounts.length,1);assert.equal(h.controller.state.connected,true);assert.equal(h.renders.at(-1).can.bet,true);
});

test('a binding read that keeps failing transiently stops after three attempts and opens nothing',async t=>{
  let reads=0;
  const h=await bindingHarness(t,{bindingRetryDelaysMs:[1,1],fetchImpl:async()=>{reads++;return new Response(null,{status:503});}});
  await assert.rejects(h.restore(seated(1)),/shared_room_presentation_binding_unavailable/);
  assert.equal(reads,3);assert.equal(h.mounts.length,0);assert.equal(h.controller.state.connected,false);
});

test('authorization, ownership and contract failures of the binding are never read again',async t=>{
  for(const response of [()=>new Response(null,{status:401}),()=>new Response(null,{status:403}),()=>Response.json({error:'other_conflict'},{status:409}),
    ()=>new Response(null,{status:500}),()=>Response.json({...presentationBinding(),owner:'preview'}),()=>new Response('{',{status:200})]){
    let reads=0;
    const h=await bindingHarness(t,{bindingRetryDelaysMs:[1,1],fetchImpl:async()=>{reads++;return response();}});
    await assert.rejects(h.restore(snapshot()),reason=>reason.code!=='shared_room_presentation_stale');
    assert.equal(reads,1);assert.equal(h.mounts.length,0);assert.equal(h.controller.state.connected,false);h.close();
  }
});

test('a closed connection ends the binding retries at once',async t=>{
  let reads=0;const connection=new AbortController();
  const h=await bindingHarness(t,{bindingRetryDelaysMs:[60,60],fetchImpl:async()=>{reads++;throw new TypeError('Failed to fetch');}});
  const restoring=h.restore(seated(1),connection.signal);await turn();await turn();connection.abort();
  await assert.rejects(restoring,{name:'AbortError'});await delay(100);assert.equal(reads,1);assert.equal(h.controller.state.connected,false);
});

// K04 B5 (external review 28 Oct 2026): the server lets a ready player clear, which withdraws ready
// (coordinator.mjs BET_OPS, clear), but the controls closed clear together with every other bet change.
test('a ready player can clear the bets, which withdraws ready on the server; the server stays the authority',async t=>{
  const h=harness(t),bets=[{main:5,pp:0,tp:0},...snapshot().bets.slice(1)],can=()=>h.renders.at(-1).can;
  const ready=(leaving=false)=>[{id:actor,seats:[0],ready:true,leaving}];
  await h.restore(seated(10,{bets,players:ready()}));
  assert.equal(can().clear,true);assert.equal(can().bet,false);assert.equal(can().ready,false);assert.equal(can().undo,false);
  await h.controller.dispatch('clear');assert.deepEqual(h.calls.at(-1),{op:'clear',windowId:'window-1'});
  await h.restore(seated(11,{bets,deadline:500,players:ready(),me:{...seated().me,pausedUntil:5000}}));
  assert.equal(can().clear,true,'after the deadline and during a pause, as on the server');
  await h.restore(seated(12,{bets,players:ready(true)}));assert.equal(can().clear,false,'never while leaving');
  await h.restore(seated(13,{bets,players:ready(),phase:'settled',roundId:'round-1'}));assert.equal(can().clear,false,'only in the betting phase');
  await h.restore(snapshot(14,{players:[]}));assert.equal(can().clear,false,'only with an own box');
  assert.equal(h.calls.length,1);
});

// External comparison with Kevin's table (28 Oct 2026, B4): the shared table never passed the idle phase, so the
// dealer's decide rest never played while players decided.
test('the shared presentation tells the idle rotation when the table decides',async()=>{
  const {document,nodes}=documentFixture(),window=new EventTarget();window.matchMedia=()=>({matches:false});window.fetch=async()=>Response.json({});
  nodes.set('table2d',new Element());let options;
  const selection={presentation:'local',dealer:'astrid',localDealer:'astrid',operator:'north',roomId,packageRevision:1,registeredDealers:[{id:'astrid',label:'Astrid'}]};
  const port=await mountSharedRoomPresentation({document,window,selection,onReady(){},onError(){},createComposition:()=>null,
    loadAdapters:async()=>[{PerformancePlayer:class{dispose(){}}},{createLocalPresentation:async value=>{options=value;return{state(){},start(){},close(){}};}},
      {createLocalCardOverlay:()=>({restore(){},sync(){},clear(){},close(){}})}]});
  const signal=new AbortController().signal;
  assert.equal(options.idleConfigRead,false,'the confirmed binding stands for the package; idle films skip the read');
  assert.equal(options.idlePhase(),'bets');
  for(const [phase,expected] of [['decisions','decide'],['insurance','decide'],['dealer','bets']]){
    port.restoreSnapshot(seated(2,{phase:'round',roundId:'round-1',round:{phase,active:0,hands:[{box:0,cards:[]}],dealer:[]}}),{signal});
    assert.equal(options.idlePhase(),expected,phase);
  }
  port.restoreSnapshot(seated(3,{phase:'settled',roundId:'round-1',round:{phase:'decisions',active:0,hands:[],dealer:[]}}),{signal});
  assert.equal(options.idlePhase(),'bets','a settled round rests as between hands');port.close();
});

// External comparison with Kevin's table (28 Oct 2026, B3): every WS state called media.state, which stopped the
// dealer's idle film and started it again. Only ready, the idle phase or a new connection changes the dealer's state.
test('a state that changes neither ready, the idle phase nor the connection leaves the dealer’s idle film alone',()=>{
  const states=[];
  const ports=createSharedRoomPresentationPorts({media:{state:value=>states.push(value),close(){}},cards:{restore(){},sync(){},clear(){},close(){}},clock:()=>1000});
  const first=new AbortController(),bob={id:'bob',seats:[1],ready:false,leaving:false};
  ports.restoreSnapshot(seated(1),{signal:first.signal});assert.deepEqual(states,[{ready:false,action:false,speech:false}]);
  ports.restoreSnapshot(seated(2,{owners:[actor,'bob',null,null,null,null,null],players:[...seated().players,bob],bets:[{main:0,pp:0,tp:0},{main:5,pp:0,tp:0},...snapshot().bets.slice(2)]}),{signal:first.signal});
  ports.restoreSnapshot(seated(3,{players:[...seated().players,{...bob,ready:true}]}),{signal:first.signal});
  assert.equal(states.length,1,'another player’s bet or ready keeps the idle film');
  ports.restoreSnapshot(seated(4,{players:[{id:actor,seats:[0],ready:true,leaving:false}]}),{signal:first.signal});
  assert.deepEqual(states.at(-1),{ready:true,action:false,speech:false});assert.equal(states.length,2);
  ports.restoreSnapshot(seated(5,{phase:'round',roundId:'round-1',round:{phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[]}}),{signal:first.signal});
  assert.equal(states.length,3,'the decide phase begins');
  first.abort();assert.equal(states.at(-1).command,'shared-disconnect');
  ports.restoreSnapshot(seated(6,{phase:'round',roundId:'round-1',round:{phase:'decisions',active:0,hands:[{box:0,cards:[]}],dealer:[]}}),{signal:new AbortController().signal});
  assert.deepEqual(states.at(-1),{ready:false,action:false,speech:false},'a new connection always releases the dealer');ports.close();
});

// External comparison with Kevin's table (28 Oct 2026): after the reconnect budget the table asked for a reload.
// A lost connection now offers "Återanslut" (and reconnects by itself when the page or network returns).
test('a connection lost beyond the budget offers Återanslut, keeps the last state and reconnects without a reload',async t=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const sockets=[],renders=[];let actions,commandStops=0;
  class Socket extends EventTarget{readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}
    frame(s){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,snapshot:s,presentation:null})}));}
    ended(code=1006){this.readyState=3;this.dispatchEvent(Object.assign(new Event('close'),{code}));}}
  const app=await mountSharedRoomApp({document,window,fetchImpl:async url=>bindingResponse(url),
    createSocket:options=>createSharedRoomClient({...options,WebSocket:Socket,reconnectDelayMs:1,maxReconnectAttempts:1}),
    createCommands:()=>({state:'idle',stop(){commandStops++;}}),createView:()=>({bind(value){actions=value;},render:value=>renders.push(value),close(){}}),
    createPresentation:async({onReady})=>{onReady('astrid');return{restoreSnapshot(){},present(){},close(){}};}});
  t.after(app.close);sockets[0].frame(seated(1));
  for(let i=0;i<100&&!app.controller.state.connected;i++)await delay(2);
  sockets[0].ended(1000);for(let i=0;i<100&&sockets.length<2;i++)await delay(2);sockets[1].ended(1006);
  for(let i=0;i<100&&!renders.at(-1)?.offline;i++)await delay(2);
  assert.equal(renders.at(-1).offline,true);assert.match(renders.at(-1).notice,/bröts/);assert.doesNotMatch(renders.at(-1).notice,/Ladda om/);
  assert.equal(app.controller.state.closed,false);assert.equal(app.controller.state.connected,false);assert.equal(commandStops,0);
  assert.equal(app.controller.state.snapshot.version,1,'the last server state stays on screen');assert.equal(renders.at(-1).can.bet,false);
  actions.reconnect();assert.equal(sockets.length,3);assert.equal(renders.at(-1).offline,false);
  sockets[2].frame(seated(2));for(let i=0;i<100&&!app.controller.state.connected;i++)await delay(2);
  assert.equal(app.controller.state.snapshot.version,2);assert.equal(renders.at(-1).can.bet,true);assert.equal(renders.at(-1).notice,'');
});

test('the view shows Återanslut only while the connection is lost',()=>{
  const {document,nodes}=documentFixture();let reconnects=0;
  const view=createSharedRoomView({document});view.bind({reconnect:()=>reconnects++});
  const find=(node,text)=>node.children?.find?.(child=>child.textContent===text)??node.children?.map?.(child=>find(child,text)).find(Boolean);
  const button=find(nodes.get('scene'),'Återanslut');assert.ok(button,'the control exists in the clickable control bar');
  const can={join:false,leave:false,bet:false,undo:false,clear:false,doubleBets:false,allSeats:false,repeat:false,ready:false,insurance:false,next:false,refill:false,pause:false,act:[]};
  view.render({snapshot:null,can,notice:'Anslutningen till bordet bröts.',offline:true});assert.equal(button.hidden,false);
  button.click();assert.equal(reconnects,1);
  view.render({snapshot:null,can,notice:'',offline:false});assert.equal(button.hidden,true);view.close();
});

test('a binding read still failing after its retries rereads the room through a fresh socket instead of failing the table',async t=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const sockets=[],errors=[];let reads=0,down=true;
  class Socket extends EventTarget{readyState=1;constructor(){super();sockets.push(this);}close(){this.readyState=3;}
    frame(s){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,snapshot:s,presentation:null})}));}}
  const app=await mountSharedRoomApp({document,window,bindingRetryDelaysMs:[1,1],
    fetchImpl:async url=>{reads++;return down?new Response(null,{status:503}):bindingResponse(url);},
    createSocket:options=>createSharedRoomClient({...options,WebSocket:Socket,reconnectDelayMs:1,onError:error=>{errors.push(error);options.onError(error);}}),
    createCommands:()=>({state:'idle',stop(){}}),createView:()=>({bind(){},render(){},close(){}}),
    createPresentation:async({onReady})=>{onReady('astrid');return{restoreSnapshot(){},present(){},close(){}};}});
  t.after(app.close);sockets[0].frame(seated(1));
  for(let i=0;i<100&&sockets.length<2;i++)await delay(2);
  assert.equal(reads,3);assert.equal(sockets.length,2,'the room is read again through a new socket');
  assert.deepEqual(errors,[]);assert.equal(app.controller.state.closed,false);assert.equal(app.controller.state.connected,false);
  assert.notEqual(document.documentElement.dataset.presentationStartup,'failed');
  down=false;sockets[1].frame(seated(2));for(let i=0;i<100&&!app.controller.state.connected;i++)await delay(2);
  assert.equal(app.controller.state.snapshot.version,2);assert.deepEqual(errors,[]);
});

// Review of #502 (G4): only a state of the same round, window and configuration waits beside the playing plan.
test('a state of another round, window or configuration never waits beside the playing plan',async()=>{
  for(const [label,edit,expected] of [['same',{},[]],['round',{roundId:'round-2'},['clear','sync']],['window',{windowId:'window-2'},['sync']],
    ['configuration',{configVersion:'cfg-2'},['sync']]]){
    const calls=[],states=[];let release;
    const cards={restore(){},sync:()=>calls.push('sync'),clear:()=>calls.push('clear'),close(){},show(){},reveal(){},begin(){},frame(){},finish(){}};
    const media={state:value=>states.push(value),prepareSequence(){},close(){},present:()=>new Promise(resolve=>{release=resolve;})};
    const ports=createSharedRoomPresentationPorts({media,cards,clock:()=>1000}),signal=new AbortController().signal;
    // The first state of a connection restores (and consumes) its presentation; the plan comes with the next one.
    ports.restoreSnapshot(seated(1,{phase:'round',roundId:'round-1'}),{signal});
    ports.restoreSnapshot(seated(2,{phase:'round',roundId:'round-1',presentationVer:1}),{signal});calls.length=0;
    const playing=ports.present({roomId,ver:1,talkId:'t',kind:'plan',startAt:1000,endAt:5000,events:[{type:'deal',to:'box',box:0,shoeDraw:1,faceDown:false}]},{signal});
    await flushRender();const before=states.length;
    ports.restoreSnapshot(seated(3,{phase:'round',roundId:'round-1',presentationVer:1,...edit}),{signal});
    assert.deepEqual(calls,expected,label);if(label==='same')assert.equal(states.length,before,'a held state leaves the dealer alone');
    release(true);await playing;ports.close();
  }
});

// K6 (docs/plans/KEVIN-PORT.md, P-C): a viewer without a seat at a full table waits for one.
const fullTable=(version,extra={})=>snapshot(version,{owners:Array(7).fill('bob'),seatGen:Array(7).fill(1),unopened:false,...extra});
test('the status line tells a viewer without a seat at a full table that he waits for one',()=>{
  const {document,nodes}=documentFixture(),view=createSharedRoomView({document});view.bind({dispatch(){},selectChip(){},retry(){}});
  const can={join:false,bet:false,leave:false,act:[],insurance:false},render=(s,notice='')=>view.render({snapshot:s,chip:.5,can,notice,busy:false,connected:true,serverNow:1000});
  // The text and its title (the full text where a phone clamps the line) always match.
  const line=()=>{const banner=nodes.get('banner');assert.equal(banner.title,banner.textContent,'title follows text');return banner.textContent;};
  render(fullTable(1));assert.equal(line(),'Väntar på plats');
  render(fullTable(2),'Skickar…');assert.equal(line(),'Skickar…','a command notice comes first');
  render(fullTable(3,{me:{...snapshot().me,pausedUntil:5000}}));assert.notEqual(line(),'Väntar på plats','a paused account does not wait');
  render(snapshot(4,{owners:['bob','bob','bob','bob','bob','bob',null],unopened:false}));assert.equal(line(),'Välj plats och lägg insatser','a free seat ends the wait, title too');
  view.close();
});
test('the mounted table sends wait after a full table\'s snapshot, and not while the player has a seat',async t=>{
  const h=await bindingHarness(t);
  await h.restore(seated(1));await delay(5);
  assert.deepEqual(h.writes,[],'a seated player does not wait');
  await h.restore(fullTable(2));
  for(let i=0;i<100&&!h.writes.length;i++)await delay(2);
  assert.deepEqual(h.writes,[{op:'wait'}]);
});
