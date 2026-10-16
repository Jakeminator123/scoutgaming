import test from 'node:test';
import {zoomComposition} from '../lab/lib/composition-zoom.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {rouletteDocument} from '../web/games/roulette/http.mjs';
import {backendPlatformPath} from '../apps/croupier-frontend/lib/platform-routing.mjs';
import {BETS,BET_BY_ID} from '../web/games/roulette/rules.mjs';
import {tableBetGeometry,chipBreakdown,TABLE_ARTWORK} from '../web/public/roulette/table-layout.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {validatePublicOperatorRooms} from '../web/public/operator-rooms-contract.mjs';
import {validatePublicOperatorPreview,previewMediaPath} from '../web/public/operator-preview-contract.mjs';
import {readChoices,choicesStorageKey} from '../web/public/player-choices.mjs';
import {defaultCompositionSettings} from '../web/public/composition-settings.mjs';

test('room document preserves login context and serves only explicit public assets',async t=>{
  let authenticated=false,reads=0;
  const resolveRoom=async context=>{reads++;if(context.table!=='room-one')throw Object.assign(Error('unavailable'),{statusCode:404});};
  const server=createServer((req,res)=>void rouletteDocument(req,res,{authenticated,guestPreview:false,resolveRoom}).then(handled=>{if(!handled){res.writeHead(404);res.end();}}));
  await new Promise(resolve=>server.listen(0,'127.0.0.2',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.2:${server.address().port}`,get=(path,options)=>fetch(base+path,{redirect:'manual',...options});
  const path='/play/roulette?operator=north&table=room-one&dealer=astrid';
  const login=await get(path);assert.equal(login.status,303);
  assert.equal(login.headers.get('location'),'/player-login?returnTo='+encodeURIComponent(path));assert.equal(reads,0);
  authenticated=true;
  const page=await get(path);assert.equal(page.status,200);assert.match(await page.text(),/id="spin"/);
  assert.match(page.headers.get('content-security-policy'),/media-src 'self' blob: https:\/\/agents-results\.d-id\.com;/);
  assert.match(page.headers.get('content-security-policy'),/connect-src 'self' https:\/\/api\.d-id\.com;/);
  assert.match(page.headers.get('content-security-policy'),/script-src 'self';/);
  assert.equal(page.headers.get('cache-control'),'private, no-store');
  for(const asset of ['/roulette/app.mjs','/roulette/style.css','/roulette/scene.mjs','/roulette/media.mjs','/roulette/table-layout.mjs','/roulette/wheel.mjs','/roulette/wheel-motion.mjs','/roulette/assets/roulette-bord.png','/roulette-rules.mjs']) {
    assert.equal(backendPlatformPath(asset),true);assert.equal((await get(asset)).status,200);
  }
  const image=await get('/roulette/assets/roulette-bord.png');
  assert.doesNotMatch(image.headers.get('content-security-policy'),/d-id\.com/);
  assert.equal(image.headers.get('content-type'),'image/png');
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
  const head=await get('/roulette/assets/roulette-bord.png',{method:'HEAD'});assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await get('/roulette/assets/private.png')).status,404);
  assert.equal(backendPlatformPath('/api/roulette/table'),true);assert.equal(backendPlatformPath('/play/roulette'),true);
  assert.equal((await get('/roulette/private.mjs')).status,404);
  assert.equal((await get('/play/roulette?operator=north&table=other')).status,404);
  assert.equal((await get(path+'&table=room-one')).status,400);
  assert.equal((await get(path,{method:'POST'})).status,405);
  assert.equal((await get(path,{method:'HEAD'})).status,200);
  assert.equal((await get('/play/roulette')).headers.get('location'),'/play');
  assert.equal((await get('/roulette?operator=north&table=room-one')).headers.get('location'),'/play/roulette?operator=north&table=room-one');
});

function contains(polygon,[x,y]) {
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;
  }
  return hit;
}
test('photographed number centres and outside labels resolve to exactly one intended target',()=>{
  const targets=BETS.map(bet=>({id:bet.id,...tableBetGeometry(bet)})).filter(row=>row.polygon);
  // Independently read fiducials from the supplied original PNG.
  for(const [id,point] of [['straight-0',[837,383]],['straight-1',[748,405]],['straight-2',[836,405]],['straight-3',[927,405]],['straight-19',[731,550]],['straight-34',[718,703]],['straight-36',[958,703]],['low',[470,774]],['red',[769,775]],['black',[899,775]],['high',[1210,775]],['dozen-1',[630,738]],['dozen-3',[1026,738]]]) {
    assert.deepEqual(targets.filter(row=>contains(row.polygon,point)).map(row=>row.id),[id]);
  }
  assert.equal(targets.length,46);
  for(const bet of BETS) {
    const {anchor}=tableBetGeometry(bet);
    assert.ok(anchor.every(Number.isFinite),bet.id);
    assert.ok(anchor[0]>=0&&anchor[0]<=TABLE_ARTWORK.width&&anchor[1]>=0&&anchor[1]<=TABLE_ARTWORK.height,bet.id);
  }
  assert.equal(tableBetGeometry(BET_BY_ID['column-1']).polygon,null);
});
test('split and corner stacks stay on shared boundaries; chip stacks preserve the displayed total',()=>{
  const split=tableBetGeometry(BET_BY_ID['split-1-2']).anchor;
  assert.ok(split[0]>790&&split[0]<803&&split[1]>400&&split[1]<412);
  const corner=tableBetGeometry(BET_BY_ID['corner-1']).anchor;
  assert.ok(corner[0]>788&&corner[0]<802&&corner[1]>414&&corner[1]<419);
  assert.deepEqual(chipBreakdown(6),[5,1]);
  assert.deepEqual(chipBreakdown(31),[25,5,1]);
  assert.equal(chipBreakdown(2000).length,9);
});

function sceneFixture({deferReady=false,playWheelStart}={}){
  const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
  const context={operatorSlug:'north',roomId:'room-one',packageRevision:7,dealerId:'astrid'};
  const table={enabled:true,default:ids[0],allowed:ids.slice(0,2).map((id,index)=>({id,label:`Table ${index}`}))};
  const background={enabled:false,mode:'baked',default:null,allowed:[]};
  const catalog={schemaVersion:1,operator:{slug:'north',name:'North'},packageRevision:7,rooms:[{
    id:'room-one',name:'Roulette',game:'roulette',laneId:'roulette-lane',presentation:{id:'roulette-scene',label:'Roulette'},
    dealerDefault:'astrid',playUrl:'/play/roulette?operator=north&table=room-one',
    dealers:[{id:'astrid',label:'Astrid',presentation:'layered',independentLayers:true,table,background}],
  }]};
  const tables=ids.map((id,index)=>({id,label:`Table ${index}`,contentType:index?'video/webm':'image/png',src:previewMediaPath(context,'table',id)}));
  const settings=defaultCompositionSettings();settings.desktop.table={width:.63,x:.13,y:.41};
  const preview={schemaVersion:1,operatorSlug:'north',roomId:'room-one',packageRevision:7,dealer:{id:'astrid',label:'Astrid'},independentLayers:true,settings,
    media:{dealer:null,tables,backgrounds:[]}};
  const room={operator:'north',id:'room-one',packageRevision:7,dealer:'astrid',name:'Roulette',operatorName:'North'};
  const prototype={src:'/roulette/assets/roulette-bord.png',contentType:'image/png'},prototypeMask={src:'/prototype-mask.png',contentType:'image/png'};
  const elements=new Map(),calls=[],fetches=[],stored={},windowListeners={},wheelCalls=[],wheelOptions=[];
  const element=()=>({hidden:false,attributes:{},listeners:{},classList:{toggle(){}},setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(name,listener){this.listeners[name]=listener;},append(){}});
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element};
  const sceneSource=readFileSync(new URL('../web/public/roulette/scene.mjs',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'').replace('export async function mountRoomScene','async function mountRoomScene');
  let closed=0;
  const mount=runInNewContext(sceneSource+'\nmountRoomScene;',{document,URLSearchParams,AbortController,AbortSignal,setTimeout,clearTimeout,performance,
    window:{addEventListener(name,listener){windowListeners[name]=listener;}},localStorage:{getItem:key=>stored[key]??null},
    fetch:async url=>{fetches.push(url);return Response.json(url.endsWith('/rooms')?catalog:preview);},
    validatePublicOperatorRooms,validatePublicOperatorPreview,readChoices,ROULETTE_TABLE:prototype,ROULETTE_TABLE_MASK:prototypeMask,
    rouletteSceneSettings:value=>({...value,prototypeGeometry:true}),
    mountRouletteWheel:()=>({play:(number,id,options)=>{wheelCalls.push(number);wheelOptions.push(options);return Promise.resolve();},showOutcome(){},close(){}}),
    mountPublishedScene(_canvas,options){calls.push(options);if(!deferReady)options.onReady();return {close(){closed++;},toggle(){},playWheelStart};},
  });
  return {ids,catalog,table,preview,room,calls,elements,fetches,prototype,prototypeMask,windowListeners,wheelCalls,wheelOptions,
    choose:id=>{stored[choicesStorageKey('north')]=JSON.stringify({tableAsset:id});},run:options=>mount(room,options),closed:()=>closed};
}

test('only the selected table gets its start film and video cues start one authoritative spin',async()=>{
  for(const match of [true,false]){
    let starts=0;
    const f=sceneFixture({playWheelStart:async({onFrame})=>{starts++;onFrame(2000);assert.equal(f.wheelCalls.length,0);onFrame(2500);onFrame(4500);assert.equal(f.wheelOptions[0].clock(),2000);return true;}});
    if(match)f.preview.media.tables[0].designId='roulette-anna-v1';
    const context={operatorSlug:'north',roomId:'room-one',packageRevision:7,dealerId:'astrid'};
    const clip={src:previewMediaPath(context,'dealer',f.ids[0]),contentType:'video/webm',compositing:{mode:'alpha'},framing:{scale:1,x:0,y:0}};
    f.preview.media.dealer={...clip,wheelStart:{...clip,src:previewMediaPath(context,'dealer',f.ids[2]),tableDesignId:'roulette-anna-v1',durationMs:10042,wheelImpulseMs:2500,ballReleaseMs:4500}};
    // Another allowed design can appear in the preview but must not activate
    // this action when the player chose a different table.
    f.preview.media.tables[1].designId='roulette-anna-v1';
    const scene=await f.run();await scene.playRound(8,'same-round');
    assert.equal(starts,match?1:0);assert.deepEqual(f.wheelCalls,[8]);
    if(match)assert.equal(f.wheelOptions[0].ballDelayMs,2000);
    scene.close();
  }
});

test('a fast confirmed round waits for scene readiness; failure or page close releases it',async()=>{
  for(const ending of ['ready','failure','close']){
    const f=sceneFixture({deferReady:true}),scene=await f.run();
    let done=false;const playing=scene.playRound(6).then(()=>{done=true;});await Promise.resolve();
    assert.equal(done,false);assert.deepEqual(f.wheelCalls,[]);
    if(ending==='ready')f.calls[0].onReady();else if(ending==='failure')f.calls[0].onFailure();else scene.close();
    await playing;assert.equal(done,true);assert.deepEqual(f.wheelCalls,ending==='ready'?[6]:[]);scene.close();
  }
});

test('roulette scene uses the authorized default image with its published geometry, not the prototype mask',async()=>{
  const f=sceneFixture();await f.run();assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].table.id,f.ids[0]);assert.equal(f.calls[0].table.contentType,'image/png');
  assert.deepEqual(f.calls[0].settings,f.preview.settings);assert.equal(f.calls[0].tableMask,null);
  assert.equal(f.elements.get('scene-toggle').hidden,true);assert.equal(f.fetches.length,2);
  f.windowListeners.pagehide();assert.equal(f.closed(),1);
});

test('a stored authorized roulette MP4/WebM scene table enables playback controls',async()=>{
  for(const contentType of ['video/mp4','video/webm']){
    const f=sceneFixture();f.preview.media.tables[1].contentType=contentType;f.choose(f.ids[1]);await f.run();
    assert.equal(f.calls[0].table.id,f.ids[1]);assert.equal(f.calls[0].table.contentType,contentType);
    assert.equal(f.calls[0].tableMask,null);assert.equal(f.elements.get('scene-toggle').hidden,false);
    assert.equal(typeof f.elements.get('scene-toggle').listeners.click,'function');
  }
});

test('foreign choices and unlisted preview files cannot override published roulette table grants',async()=>{
  const f=sceneFixture();f.choose(f.ids[2]);await f.run();assert.equal(f.calls[0].table.id,f.ids[0]);
  const missing=sceneFixture();missing.choose(missing.ids[0]);missing.preview.media.tables=missing.preview.media.tables.slice(1);
  await missing.run();assert.equal(missing.calls[0].table.id,missing.ids[1]);
  const noAllowed=sceneFixture();noAllowed.preview.media.tables=[noAllowed.preview.media.tables[2]];await noAllowed.run();
  assert.equal(noAllowed.calls[0].table,noAllowed.prototype);assert.equal(noAllowed.calls[0].tableMask,noAllowed.prototypeMask);
  assert.equal(noAllowed.calls[0].settings.prototypeGeometry,true);
});

test('disabled table grants use the prototype and a different game or revision mounts no roulette media',async()=>{
  const disabled=sceneFixture();disabled.table.enabled=false;disabled.table.default=null;disabled.table.allowed=[];
  await disabled.run();assert.equal(disabled.calls[0].table,disabled.prototype);
  for(const change of [f=>{f.catalog.rooms[0].game='blackjack';f.catalog.rooms[0].playUrl='/play/blackjack?operator=north&table=room-one';},f=>{f.catalog.packageRevision=8;}]){
    const f=sceneFixture();change(f);await f.run();assert.equal(f.calls.length,0);
    assert.match(f.elements.get('scene-status').textContent,/inte tillgängliga/);
  }
});


test('published scene zoom reaches roulette drawing and hit layers with the same saved table placement',async()=>{
  const f=sceneFixture();const original=structuredClone(f.preview.settings);
  f.preview.settings=zoomComposition(f.preview.settings,'desktop',1.1);
  const placements=[];const scene=await f.run({onTable:value=>placements.push(value)});
  assert.deepEqual(f.calls[0].settings,f.preview.settings);
  assert.equal(f.calls[0].layout,'desktop');
  assert.deepEqual(placements[0].placement,f.preview.settings.desktop.table);
  assert.deepEqual(f.preview.settings.mobile,original.mobile);
  assert.equal(f.calls[0].table.src,f.preview.media.tables[0].src);
  scene.close();
});
