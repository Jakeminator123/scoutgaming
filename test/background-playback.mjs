import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBackgroundPlayback} from '../packages/presentation/runtime/background-playback.mjs';
import {createLayerComposition,validateComposition} from '../packages/presentation/runtime/presentation-composition.mjs';
import {stageGeometry,tableRect} from '../packages/presentation/compositor/geometry.js';
import {defaultCompositionSettings,defaultBlackjackTableGeometry} from '../packages/presentation/contracts/composition-settings.mjs';

const baseId='10000000-0000-4000-8000-000000000001',eventId='10000000-0000-4000-8000-000000000002';
const tableId='10000000-0000-4000-8000-000000000003',tableClipId='10000000-0000-4000-8000-000000000004',otherTableId='10000000-0000-4000-8000-000000000005';
const rule=(changes={})=>({id:'celebrate',assetId:eventId,trigger:{eventId:'speak.blackjack'},maxDurationMs:10000,
  cooldownMs:0,maxPerMinute:12,maxSecondsPerMinute:60,...changes});
function clock(){let at=0,id=0;const timers=new Map();return{now:()=>at,
  setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:at+ms});return id;},clearTimeout:id=>timers.delete(id),
  advance(ms){const end=at+ms;for(let n=0;n<1000;n++){
    const next=[...timers].filter(([,value])=>value.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!next){at=end;return;}timers.delete(next[0]);at=next[1].at;next[1].fn();
  }throw Error('Unbounded scheduler');},size:()=>timers.size};}
function scheduler(rules){const timer=clock(),starts=[],stops=[];
  const player=createBackgroundPlayback({schemaVersion:1,rules},{...timer,onStart:(rule,token)=>starts.push({rule,token,at:timer.now()}),onStop:(token,reason)=>stops.push({token,reason})});
  return{timer,starts,stops,player};}

test('25 second automation is independent, event takes priority and every clip returns to base',()=>{
  const f=scheduler([rule({id:'ambient',trigger:{everyMs:25000}}),rule()]);f.player.start();
  f.timer.advance(24999);assert.equal(f.starts.length,0);f.timer.advance(1);assert.equal(f.starts[0].rule.id,'ambient');
  assert.equal(f.player.event('speak.blackjack','round-1'),true);assert.deepEqual(f.stops,[{token:f.starts[0].token,reason:'event-priority'}]);
  assert.equal(f.player.event('speak.blackjack','round-2'),false,'no event queue or event-on-event interruption');
  f.timer.advance(10000);assert.equal(f.stops.at(-1).reason,'duration');
  assert.equal(f.player.event('speak.blackjack','round-1'),false,'same scoped outcome is not replayed');
  f.timer.advance(15000);assert.equal(f.starts.at(-1).rule.id,'ambient');f.player.close();assert.equal(f.timer.size(),0);
});

test('pause drops automatic opportunities; manual preview uses the same channel and budgets',()=>{
  const f=scheduler([rule({trigger:{everyMs:25000},maxPerMinute:1})]);
  assert.equal(f.player.preview('celebrate'),true,'manual preview works before automatic start');
  assert.equal(f.player.preview('celebrate'),false);f.timer.advance(1000);f.player.finish(f.starts[0].token);
  assert.equal(f.player.preview('celebrate'),false,'preview cannot bypass max starts');
  f.player.start();f.player.pause();f.timer.advance(120000);assert.equal(f.starts.length,1);
  assert.equal(f.player.event('speak.blackjack'),false);f.player.start();f.timer.advance(24999);assert.equal(f.starts.length,1);
  f.timer.advance(1);assert.equal(f.starts.length,2);f.player.close();
});

test('rolling seconds include prior clip tails and release the unused reserved duration',()=>{
  const f=scheduler([rule({maxDurationMs:20000,maxSecondsPerMinute:20})]);f.player.start();
  assert.equal(f.player.event('speak.blackjack','one'),true);f.timer.advance(20000);
  f.timer.advance(35000);assert.equal(f.player.event('speak.blackjack','too-soon'),false,'old tail and new reservation exceed twenty seconds');
  f.timer.advance(5000);assert.equal(f.player.event('speak.blackjack','two'),true);
  f.timer.advance(1000);f.player.finish(f.starts.at(-1).token);
  assert.equal(f.player.event('speak.blackjack','three'),false,'actual elapsed reservation still counts');
  f.timer.advance(60000);assert.equal(f.player.event('speak.blackjack','four'),true);f.player.close();
});

test('cooldown, stale completion and bounded dedupe cannot open concurrent backgrounds',()=>{
  const f=scheduler([rule({cooldownMs:5000,maxDurationMs:1000})]);f.player.start();
  f.player.event('speak.blackjack','first');const stale=f.starts[0].token;f.timer.advance(1000);
  assert.equal(f.player.event('speak.blackjack','cooldown'),false);f.timer.advance(4000);
  assert.equal(f.player.event('speak.blackjack','next'),true);assert.equal(f.player.finish(stale),false);
  f.timer.advance(1000);assert.equal(f.stops.length,2);f.player.close();assert.equal(f.player.preview('celebrate'),false);
});

test('seconds budget applies across multiple short starts and busy automatic ticks never queue',()=>{
  const f=scheduler([rule({maxDurationMs:5000,maxSecondsPerMinute:10})]);f.player.start();
  for(const key of ['one','two']){assert.equal(f.player.event('speak.blackjack',key),true);f.timer.advance(5000);}
  assert.equal(f.player.event('speak.blackjack','three'),false);f.timer.advance(50000);
  assert.equal(f.player.event('speak.blackjack','four'),true);f.player.close();
  const busy=scheduler([rule({id:'ambient',trigger:{everyMs:5000},maxDurationMs:1000}),rule({maxDurationMs:10000})]);
  busy.player.start();busy.player.event('speak.blackjack','one');busy.timer.advance(10000);
  assert.equal(busy.starts.length,1,'a coinciding timeout returns to base instead of draining a missed automatic event');
  busy.timer.advance(5000);assert.equal(busy.starts.length,2);busy.player.close();
});

test('callback failure restores base and closed controllers never replay events',()=>{
  const timer=clock(),stops=[];const player=createBackgroundPlayback({schemaVersion:1,rules:[rule()]},
    {...timer,onStart:()=>{throw Error('decorative decode failed');},onStop:(token,reason)=>stops.push(reason)});
  player.start();assert.equal(player.event('speak.blackjack','one'),true);assert.deepEqual(stops,['error']);
  player.close();assert.equal(timer.size(),0);assert.equal(player.event('speak.blackjack','two'),false);
});

function compositionFixture({videoBase=false,dealerEnabled=true,table=false,otherTable=false,tableEvents=false,board=false}={}){
  const timer=clock(),nodes=new Set(),appended=[],renders=[],tableRenders=[],released=[];
  class Node extends EventTarget{constructor(tag){super();Object.assign(this,{tagName:tag.toUpperCase(),dataset:{},style:{setProperty(){}},complete:true,naturalWidth:720,naturalHeight:1280,
    videoWidth:720,videoHeight:1280,readyState:2,paused:false,playCount:0,pauseCount:0});}
    setAttribute(){}removeAttribute(){}append(node){nodes.add(node);appended.push(node);}remove(){nodes.delete(this);}
    play(){this.paused=false;this.playCount++;return Promise.resolve();}pause(){this.paused=true;this.pauseCount++;}load(){}
    getContext(){return{clearRect(){},drawImage(){}};}}
  const host=new Node('div');host.clientWidth=1080;host.clientHeight=1920;
  const document={hidden:false,documentElement:{dataset:{}},querySelector:()=>host,createElement:tag=>{
    const node=new Node(tag);if(tag==='video'&&(!videoBase||[...nodes].some(node=>node.tagName==='VIDEO')))node.readyState=0;return node;}};
  const descriptor={schemaVersion:1,background:{enabled:true,mode:videoBase?'video':'image',allowed:[baseId,eventId],default:baseId},
    table:table?{enabled:true,allowed:[tableId,...(otherTable?[otherTableId]:[]),tableClipId],default:tableId}:{enabled:false,allowed:[],default:null},dealer:{enabled:dealerEnabled,compatibility:'per-clip'},
    assets:[{id:baseId,role:'background',label:'Base',contentType:videoBase?'video/mp4':'image/png',src:'/api/presentation/layers/north/'+baseId},
      {id:eventId,role:'background',label:'Event',contentType:'video/mp4',src:'/api/presentation/layers/north/'+eventId},
      ...(table?[{id:tableId,role:'table',label:'Bord',contentType:'image/png',src:'/api/presentation/layers/north/'+tableId},
        {id:tableClipId,role:'table',label:'Levande bord',contentType:'video/mp4',src:'/api/presentation/layers/north/'+tableClipId}]:[]),
      ...(table&&otherTable?[{id:otherTableId,role:'table',label:'Annat bord',contentType:'image/png',src:'/api/presentation/layers/north/'+otherTableId}]:[])],
    backgroundPlayback:{schemaVersion:1,rules:[rule()]},
    ...(table?{tablePlayback:{schemaVersion:1,rules:[rule({id:'living',assetId:tableClipId,trigger:{everyMs:5000},maxDurationMs:5000}),
      ...(tableEvents?[rule({id:'table-celebrate',assetId:tableClipId})]:[])]}}:{}),
    ...(board?{settings:{...defaultCompositionSettings(),blackjackTables:[defaultBlackjackTableGeometry(tableId)]}}:{})};
  class Compositor{constructor(canvas){this.canvas=canvas;}dispose(){}release(source){released.push(source);}render(scene,actor,assets){renders.push(assets.get('background')?.el);tableRenders.push(assets.get('table')?.el);}}
  // Board fixtures use the shared stage/table geometry, as the real compositor does.
  class BoardCompositor extends Compositor{geometry(scene){return stageGeometry(scene);}tableGeometry(scene,image){return tableRect(scene,image,stageGeometry(scene));}}
  const composition=createLayerComposition(document,descriptor,{loadRuntime:async()=>({Compositor:board?BoardCompositor:Compositor}),backgroundPlaybackOptions:timer});
  return{composition,descriptor,nodes,appended,renders,tableRenders,released,timer,base:[...nodes].find(node=>node.dataset.layerAsset===baseId),
    tableBase:[...nodes].find(node=>node.dataset.layerAsset===tableId)};
}

test('runtime validates exact background grants and requires an enabled base',()=>{
  const f=compositionFixture();assert.doesNotThrow(()=>validateComposition(f.descriptor));
  for(const change of [v=>v.background.allowed.pop(),v=>v.assets[1].role='table',v=>v.assets[1].contentType='image/png',v=>v.background.enabled=false]){
    const bad=structuredClone(f.descriptor);change(bad);assert.throws(()=>validateComposition(bad));
  }f.composition.close();
});

test('event decode never blocks dealer preparation; ended restores the same running base',async()=>{
  const f=compositionFixture({videoBase:true});await f.composition.prepareClip();f.composition.renderFrame({videoWidth:720,videoHeight:1280});
  assert.equal(f.composition.backgroundEvent('speak.blackjack','round-1'),true);
  const event=[...f.nodes].find(node=>node.className?.includes('presentation-background-event'));
  assert.equal(event.muted,true);assert.equal(event.loop,false);assert.equal(f.base.loop,true);assert.equal(f.base.pauseCount,0);
  assert.equal(await f.composition.prepareClip(),true,'undecoded background is not in dealer pending loads');
  f.composition.renderFrame({videoWidth:720,videoHeight:1280});assert.equal(f.renders.at(-1),f.base);
  event.dispatchEvent(new Event('loadeddata'));await Promise.resolve();assert.equal(f.renders.at(-1),event);
  event.dispatchEvent(new Event('ended'));assert.equal(f.renders.at(-1),f.base);assert.equal(f.base.pauseCount,0);assert.equal(f.nodes.has(event),false);
  assert.deepEqual(f.released,[event],'completed event releases its GPU texture');
  f.composition.close();assert.equal(f.timer.size(),0);
});

test('dealer-disabled backgrounds keep the correct plane order and release replaced media textures',async()=>{
  const f=compositionFixture({dealerEnabled:false});await f.composition.prepareClip();f.composition.renderFrame({videoWidth:720,videoHeight:1280});
  assert.equal(f.base.style.visibility,'');f.composition.backgroundEvent('speak.blackjack','round-1');
  const event=[...f.nodes].find(node=>node.dataset.layerAsset===eventId);
  assert.equal(event.style.visibility,'hidden','loading retains the visible base');
  event.dispatchEvent(new Event('loadeddata'));await Promise.resolve();assert.equal(event.style.visibility,'');
  assert.match(event.className,/\bpresentation-background\b/,'event shares background z-index below the table');
  event.dispatchEvent(new Event('ended'));assert.deepEqual(f.released,[event]);assert.equal(f.base.style.visibility,'');
  f.composition.setBackground(baseId);assert.deepEqual(f.released,[event,f.base]);f.composition.close();
});

test('background errors, page visibility and stale decode callbacks restore base without touching dealer',async()=>{
  const f=compositionFixture({videoBase:true});await f.composition.prepareClip();f.composition.renderFrame({videoWidth:720,videoHeight:1280});
  f.composition.backgroundEvent('speak.blackjack','round-1');const event=[...f.nodes].find(node=>node.dataset.layerAsset===eventId);
  event.dispatchEvent(new Event('error'));assert.equal(f.renders.at(-1),f.base);
  f.composition.backgroundEvent('speak.blackjack','round-2');const stale=[...f.nodes].find(node=>node.dataset.layerAsset===eventId);
  f.composition.setBackgroundVisible(false);assert.equal(f.base.paused,true);assert.equal(f.nodes.has(stale),false);
  stale.dispatchEvent(new Event('loadeddata'));await Promise.resolve();assert.equal(f.renders.at(-1),f.base);
  assert.equal(f.composition.backgroundEvent('speak.blackjack','hidden'),false);f.composition.setBackgroundVisible(true);assert.equal(f.base.paused,false);
  f.composition.close();assert.equal(f.timer.size(),0);
});

test('game background and table notifications precede speech mute admission and never await a decorative clip',async()=>{
  const source=await readFile(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
  const start=source.indexOf('say(t, { force'),end=source.indexOf('speechPoseGate = createSpeechPoseGate');
  assert.ok(start>=0&&end>start,'voice.say is located');
  const say=source.slice(start,end),mute=say.indexOf('if (this.muted');
  const dispatch=/for\s*\(\s*const\s+(\w+)\s+of\s+\[([^\]]*)\]\s*\)\s*try\s*\{\s*layerComposition\?\.\[\1\]\?\.\(\s*'speak\.'\s*\+\s*t\s*,/.exec(say);
  const layers=dispatch?.index??-1;
  // Both positions must exist: a missing marker can never satisfy the order check.
  assert.ok(layers>=0,'layer event dispatch is located');assert.ok(mute>=0,'mute early-return is located');
  assert.deepEqual(dispatch[2].split(',').map(name=>name.trim()),["'backgroundEvent'","'tableEvent'"],'both living layers are notified');
  assert.ok(layers<mute,'background and table events fire before the mute early-return');
  assert.doesNotMatch(say,/await\s+layerComposition/);assert.match(say,/clientSessionRevision.*roomId.*DEALER.key.*tableVersion/);
});

test('runtime validates table playback against enabled table grants and table-role videos',()=>{
  const f=compositionFixture({table:true});assert.doesNotThrow(()=>validateComposition(f.descriptor));
  for(const change of [v=>v.table.enabled=false,v=>v.tablePlayback.rules[0].assetId=eventId,v=>v.assets[3].role='background',
    v=>v.assets[3].contentType='image/png',v=>v.table.allowed.pop(),v=>v.table.default=null]){
    const bad=structuredClone(f.descriptor);change(bad);assert.throws(()=>validateComposition(bad),'table rule rejected: '+change.toString());
  }
  const none=structuredClone(f.descriptor);none.tablePlayback={schemaVersion:1,rules:[]};none.table.enabled=false;assert.doesNotThrow(()=>validateComposition(none));
  f.composition.close();
});

test('table timer starts a silent living clip over the base table and restores it on ended and close',async()=>{
  const f=compositionFixture({table:true});await f.composition.prepareClip();f.composition.renderFrame({videoWidth:720,videoHeight:1280});
  assert.equal(typeof f.composition.tableEvent,'function');assert.equal(f.tableRenders.at(-1),f.tableBase);
  f.timer.advance(4999);assert.equal([...f.nodes].some(node=>node.className?.includes('presentation-table-event')),false);
  f.timer.advance(1);const clip=[...f.nodes].find(node=>node.className?.includes('presentation-table-event'));
  assert.ok(clip);assert.equal(clip.dataset.layerAsset,tableClipId);assert.match(clip.className,/^presentation-plane presentation-table presentation-table-event$/);
  assert.equal(clip.muted,true);assert.equal(clip.loop,false);assert.equal(clip.style.visibility,'hidden','loading keeps the base table');
  assert.equal(f.tableRenders.at(-1),f.tableBase,'undecoded clip is not drawn');
  assert.equal(await f.composition.prepareClip(),true,'table clip is not in dealer pending loads');
  clip.dispatchEvent(new Event('loadeddata'));await Promise.resolve();f.composition.hold();
  assert.equal(f.tableRenders.at(-1),clip,'compositor draws the living clip as the table');assert.equal(f.renders.at(-1),f.base,'background is untouched');
  clip.dispatchEvent(new Event('ended'));assert.equal(f.tableRenders.at(-1),f.tableBase);assert.equal(f.nodes.has(clip),false);assert.deepEqual(f.released,[clip]);
  f.timer.advance(5000);const second=[...f.nodes].find(node=>node.className?.includes('presentation-table-event'));assert.ok(second);
  f.composition.setBackgroundVisible(false);assert.equal(f.nodes.has(second),false,'hidden page stops table clips too');
  f.composition.setBackgroundVisible(true);f.timer.advance(5000);const third=[...f.nodes].find(node=>node.className?.includes('presentation-table-event'));assert.ok(third);
  f.composition.setTable(tableId);assert.equal(f.nodes.has(third),false,'base table change restarts the table player');
  f.timer.advance(5000);const fourth=[...f.nodes].find(node=>node.className?.includes('presentation-table-event'));assert.ok(fourth);
  f.composition.close();assert.equal(f.nodes.has(fourth),false);assert.equal(f.timer.size(),0);
});

test('a table clip of another size never moves the blackjack plane; the base table owns geometry',async()=>{
  const f=compositionFixture({table:true,board:true});let changes=0;f.composition.onGeometryChange(()=>changes++);
  await f.composition.prepareClip();f.composition.renderFrame({videoWidth:720,videoHeight:1280});
  const plane=structuredClone(f.composition.referencePlane()),settled=changes;
  assert.equal(plane.tableGeometry.tableId,tableId,'the board plane comes from the configured base table');
  f.timer.advance(5000);const clip=[...f.nodes].find(node=>node.className?.includes('presentation-table-event'));assert.ok(clip);
  // A wide clip over the portrait base table: its own aspect would give another table rect.
  Object.assign(clip,{videoWidth:1920,videoHeight:540});
  clip.dispatchEvent(new Event('loadeddata'));await Promise.resolve();f.composition.hold();
  assert.equal(f.tableRenders.at(-1),clip,'the clip is still drawn as the living table');
  assert.deepEqual(f.composition.referencePlane(),plane,'seats, bets and dealer cards keep the base table plane');
  assert.equal(changes,settled,'no geometry change while the clip plays');
  clip.dispatchEvent(new Event('ended'));assert.equal(f.tableRenders.at(-1),f.tableBase);
  assert.deepEqual(f.composition.referencePlane(),plane);assert.equal(changes,settled,'no snap back when the clip ends');
  f.composition.close();assert.equal(f.timer.size(),0);
});

test('table clips belong to the default table: another selected table never plays them',async()=>{
  const f=compositionFixture({table:true,otherTable:true,tableEvents:true});
  await f.composition.prepareClip();f.composition.renderFrame({videoWidth:720,videoHeight:1280});
  // Every table clip ever mounted, so a clip that starts and ends inside one advance still counts.
  const started=()=>f.appended.filter(node=>node.className?.includes('presentation-table-event'));
  f.timer.advance(5000);const playing=started()[0];assert.ok(playing,'the default table plays its timer clip');
  f.composition.setTable(otherTableId);assert.equal(f.nodes.has(playing),false,'choosing another table stops the default table clip');
  assert.equal(f.tableRenders.at(-1)?.dataset.layerAsset,otherTableId);
  f.timer.advance(60000);assert.equal(started().length,1,'no timer clip over another table');
  assert.equal(f.composition.tableEvent('speak.blackjack','round-1'),false,'no event clip over another table');
  f.composition.setBackgroundVisible(false);f.composition.setBackgroundVisible(true);f.timer.advance(60000);
  assert.equal(started().length,1,'page visibility does not reopen table clips over another table');
  assert.equal(f.composition.backgroundEvent('speak.blackjack','round-1'),true,'background clips are unaffected');
  f.composition.setTable(tableId);assert.equal(f.composition.tableEvent('speak.blackjack','round-2'),true,'the default table resumes its clips');
  assert.equal(started().length,2);const resumed=started()[1];
  f.composition.close();assert.equal(f.nodes.has(resumed),false);assert.equal(f.timer.size(),0);
});
