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
function harness(t,options={}){
  const calls=[],renders=[],events=[];let send=options.send??(async intent=>({status:'ok',result:{op:intent.op,version:10},commandId:'id-1',replay:false}));
  const commands=options.commands??{state:'idle',send(intent){calls.push(intent);return send(intent);},retry(){return send();},stop(){this.state='stopped';}};
  const view={bind(value){this.actions=value;},render(value){renders.push(value);},close(){events.push('view-close');}};
  const presentation=options.presentation??{restoreSnapshot(s){events.push('restore:'+s.version);},present(p){events.push('present:'+p.ver);},close(){events.push('media-close');}};
  const controller=createSharedRoomController({roomId,commands,view,presentation,now:()=>1000});
  t.after(()=>controller.stop());
  return{controller,calls,renders,events,commands,view,setSend:fn=>send=fn,restore:(s,signal)=>controller.restoreSnapshot(s,{signal:signal??new AbortController().signal})};
}

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
    await reset({bets:[{main:5,pp:0,tp:0},...snapshot().bets.slice(1)]});
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

class Element extends EventTarget {
  constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.style={setProperty(){}};this.hidden=false;this.disabled=false;this.className='';this._text='';this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  setAttribute(name,value){this.attributes[name]=String(value);}append(...children){this.children.push(...children);}prepend(...children){this.children.unshift(...children);}replaceChildren(...children){this._text='';this.children=children;}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
}
function documentFixture(){
  const ids=['scene','seats','chips','balance','total-bet','last-win','banner','deal-now','insurance','ins-yes','ins-no','actions','actions-top','undo-btn','clear-btn','double-btn','max-btn','all-sides','add-funds','pitboss','presentation-loading','caption','limits','chat','table-pick'];
  const nodes=new Map(ids.map(id=>[id,new Element()])),acts=['hit','stand','double','split'].map(action=>{const node=new Element('button');node.dataset.act=action;return node;});
  const document={documentElement:{dataset:{sharedRoom:'1',gameLane:'saved',gameDealer:'astrid',gameLocalDealer:'astrid',gamePresentation:'local',gameRegisteredDealers:JSON.stringify([{id:'astrid',label:'Astrid'}]),gameOperator:'north',gamePackageRevision:'1',gameBranding:'{}',gameRoomId:roomId}},
    getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),querySelector:selector=>nodes.get(selector.slice(1)),querySelectorAll:selector=>selector==='[data-act]'?acts:[]};
  return{document,nodes,acts};
}

test('existing DOM receives server balances, native seat/chip controls, Swedish error and explicit retry',()=>{
  const {document,nodes}=documentFixture(),calls=[];const view=createSharedRoomView({document});
  view.bind({dispatch:(...args)=>calls.push(args),selectChip:amount=>calls.push(['chip',amount]),retry:()=>calls.push(['retry'])});
  const can={join:true,bet:true,leave:true,act:[],insurance:false};
  view.render({snapshot:seated(1,{me:{...seated().me,available:17.5}}),chip:.5,can,notice:'Svaret saknas.',retry:true,busy:false,connected:true});
  assert.match(nodes.get('balance').textContent,/17,5 demo/);assert.equal(nodes.get('seats').children.length,7);
  const own=nodes.get('seats').children[0],join=own.children[0].children[0];assert.equal(join.tagName,'BUTTON');join.click();assert.deepEqual(calls[0],['join',{seat:0}]);
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
  view.close();join.click();assert.equal(calls.length,3);
});

test('mounted application wires real WS and HTTP clients; duplicate reconnect state never replays presentation',async t=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const sockets=[],renders=[],events=[],requests=[];
  class Socket extends EventTarget {readyState=1;bufferedAmount=0;constructor(){super();sockets.push(this);}close(){this.readyState=3;}frame(s,p=null){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'shared-room-state',roomId,snapshot:s,presentation:p})}));}}
  const app=await mountSharedRoomApp({document,window,createSocket:options=>createSharedRoomClient({...options,WebSocket:Socket,reconnectDelayMs:1}),
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

test('pagehide during asynchronous media startup closes the returned port and never opens a socket',async()=>{
  const {document}=documentFixture(),window=new EventTarget();window.location={origin:'https://game.invalid'};
  const gate=deferred();let sockets=0,closes=0,stops=0;
  const mounting=mountSharedRoomApp({document,window,createCommands:()=>({stop(){stops++;}}),
    createPresentation:()=>gate.promise,createSocket:()=>{sockets++;},createView:()=>assert.fail('closed startup cannot mount a view')});
  window.dispatchEvent(new Event('pagehide'));gate.resolve({close(){closes++;}});
  await mounting;assert.equal(sockets,0);assert.equal(closes,1);assert.equal(stops,1);
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
  const gate=deferred();let signal;
  const mounting=mountSharedRoomApp({document,window,createCommands:()=>({stop(){}}),
    createPresentation:async options=>{signal=options.signal;await gate.promise;signal.throwIfAborted();},createSocket:()=>assert.fail('closed')});
  window.dispatchEvent(new Event('pagehide'));assert.equal(signal.aborted,true);gate.resolve();await assert.rejects(mounting,{name:'AbortError'});
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

async function sevenSeatPlan() {
  const store=createMemoryTableStore(),table=createTableCoordinator({store,clock:{now:()=>1000},random:deterministicRandom('shared-long-seven')});
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
function timedPorts(t,{present,startAt,endAt,events,enableTimers=true}){
  if(enableTimers)t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
  startAt??=Date.now();endAt??=startAt+30000;
  const seen=[],shown=[],prepared=[],revealed=[];
  const cards={restore(){},sync(){},clear(){},close(){},show:draw=>shown.push(draw),reveal:()=>revealed.push(Date.now()),begin:(_video,source)=>source.shoeDraw,frame(){},finish(){}};
  const media={state(){},prepareSequence(value){prepared.push(value);},async present(event,options){seen.push({event,options,at:Date.now()});return present?present(event,options):true;},close(){}};
  const ports=createSharedRoomPresentationPorts({media,cards,clock:Date.now,filmedProfile:dragan,dealerId:'dragan'});t.after(()=>ports.close());
  const signal=new AbortController().signal;
  ports.restoreSnapshot(seated(1,{serverNow:Date.now()}),{signal});ports.restoreSnapshot(seated(2,{presentationVer:1,serverNow:Date.now()}),{signal});
  const plan={roomId,ver:1,talkId:'timed',kind:'plan',startAt,endAt,events};
  return {seen,shown,prepared,revealed,plan,start:()=>ports.present(plan,{signal})};
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
