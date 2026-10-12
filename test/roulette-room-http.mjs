import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {rouletteDocument} from '../web/games/roulette/http.mjs';
import {backendPlatformPath} from '../apps/croupier-frontend/lib/platform-routing.mjs';

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
  for(const asset of ['/roulette/app.mjs','/roulette/style.css','/roulette/scene.mjs','/roulette-rules.mjs']) {
    assert.equal(backendPlatformPath(asset),true);assert.equal((await get(asset)).status,200);
  }
  assert.equal(backendPlatformPath('/api/roulette/table'),true);assert.equal(backendPlatformPath('/play/roulette'),true);
  assert.equal((await get('/roulette/private.mjs')).status,404);
  assert.equal((await get('/play/roulette?operator=north&table=other')).status,404);
  assert.equal((await get(path+'&table=room-one')).status,400);
  assert.equal((await get(path,{method:'POST'})).status,405);
  assert.equal((await get(path,{method:'HEAD'})).status,200);
  assert.equal((await get('/play/roulette')).headers.get('location'),'/play');
  assert.equal((await get('/roulette?operator=north&table=room-one')).headers.get('location'),'/play/roulette?operator=north&table=room-one');
});
