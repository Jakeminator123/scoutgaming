import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {rouletteDocument} from '../web/games/roulette/http.mjs';
import {backendPlatformPath} from '../apps/croupier-frontend/lib/platform-routing.mjs';
import {BETS,BET_BY_ID} from '../web/games/roulette/rules.mjs';
import {tableBetGeometry,chipBreakdown,TABLE_ARTWORK} from '../web/public/roulette/table-layout.mjs';

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
  assert.match(page.headers.get('content-security-policy'),/media-src 'self'/);
  assert.equal(page.headers.get('cache-control'),'private, no-store');
  for(const asset of ['/roulette/app.mjs','/roulette/style.css','/roulette/scene.mjs','/roulette/media.mjs','/roulette/table-layout.mjs','/roulette/assets/roulette-bord.png','/roulette-rules.mjs']) {
    assert.equal(backendPlatformPath(asset),true);assert.equal((await get(asset)).status,200);
  }
  const image=await get('/roulette/assets/roulette-bord.png');
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
