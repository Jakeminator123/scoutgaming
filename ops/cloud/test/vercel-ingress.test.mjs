import test from 'node:test';
import assert from 'node:assert/strict';
import {readVercelIngressConfig, vercelIngressRequest} from '../vercel-ingress.mjs';
import {proxyHeaders} from '../gateway.mjs';
import {createCloudGateway} from '../gateway.mjs';
import {createServer, request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {presentationCapabilitiesResponse} from '../../../services/game/presentation-capabilities.mjs';

const env = {CROUPIER_VERCEL_TRANSPORT_ORIGIN: 'https://isolated.onrender.com', CROUPIER_PUBLIC_ORIGIN: 'https://preview.example.test', CROUPIER_VERCEL_INGRESS_SECRET: 'isolated-ingress-fixture-'.repeat(3)};
const ingress = readVercelIngressConfig(env);
const request = (url = '/api/table', extra = {}) => ({url, method: 'POST', headers: {host: 'isolated.onrender.com', origin: ingress.publicOrigin,
  cookie: 'player_session=isolated', 'x-croupier-vercel-secret': ingress.secret, 'x-croupier-public-origin': ingress.publicOrigin,
  'x-forwarded-host': 'preview.example.test', 'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin', ...extra}});

test('only a secret-authenticated exact Vercel origin can cross the backend transport boundary', () => {
  assert.equal(readVercelIngressConfig({}), null);
  assert.throws(() => readVercelIngressConfig({...env, CROUPIER_PUBLIC_ORIGIN: env.CROUPIER_VERCEL_TRANSPORT_ORIGIN}));
  const accepted = vercelIngressRequest(request('/api/table?requestId=a%20b', {'x-croupier-lab-authorized': 'browser-spoof'}), ingress);
  assert.equal(accepted.accepted, true); assert.equal(accepted.headers.host, 'preview.example.test');
  assert.equal(accepted.headers.cookie, 'player_session=isolated'); assert.equal(accepted.headers.origin, ingress.publicOrigin);
  assert.equal(accepted.headers['x-croupier-lab-authorized'], undefined);
  assert.equal(accepted.headers['x-croupier-vercel-secret'], undefined);
  const downstream = proxyHeaders(accepted.headers, accepted.headers.host);
  assert.equal(downstream['x-forwarded-host'], 'preview.example.test');
  for (const extra of [{host: 'preview.example.test'}, {'x-croupier-vercel-secret': 'wrong'}, {'x-croupier-public-origin': 'https://evil.example.test'},
    {'x-forwarded-host': 'evil.example.test'}, {'x-forwarded-proto': 'http'}]) assert.equal(vercelIngressRequest(request('/api/table', extra), ingress).accepted, false);
  for (const path of ['/api/auth/lab/check', '/__vercel/admin', '/api/unknown', '/studio/api/%70roject', '/studio/api/../project']) assert.equal(vercelIngressRequest(request(path), ingress).accepted, false, path);
  assert.equal(vercelIngressRequest({...request('/__vercel/lab/session'), method: 'GET'}, ingress).session, true);
  assert.equal(vercelIngressRequest(request('/__vercel/lab/session'), ingress).accepted, false);
});

test('canonical blackjack launch (always on) crosses exact authenticated ingress only', () => {
  const native=readVercelIngressConfig(env);
  assert.equal(native.canonicalGame,true);assert.equal(ingress.canonicalGame,true);
  for (const path of ['/blackjack?launch=fixture.claim.signature','/blackjack/?dealer=mei&launch=fixture.claim.signature']) {
    for (const method of ['GET','HEAD']) {
      const input={...request(path),method},accepted=vercelIngressRequest(input,native);
      assert.equal(accepted.transported,true,path);assert.equal(accepted.headers.host,'preview.example.test');
      assert.equal(accepted.headers.cookie,'player_session=isolated');assert.equal(accepted.headers['x-croupier-vercel-secret'],undefined);
      for (const extra of [{'x-croupier-vercel-secret':'wrong'},{'x-croupier-public-origin':'https://evil.test'},
        {'x-forwarded-host':'evil.test'},{'x-forwarded-proto':'http'}]) {
        assert.equal(vercelIngressRequest({...request(path,extra),method},native).accepted,false);
      }
    }
  }
  for (const path of ['/blackjack','/blackjack/','/blackjack-extra?launch=fixture.claim.signature',
    '/%62lackjack?launch=fixture.claim.signature','/blackjack//?launch=fixture.claim.signature',
    '/blackjack/../game?launch=fixture.claim.signature','/blackjack/api?launch=fixture.claim.signature']) {
    assert.equal(vercelIngressRequest({...request(path),method:'GET'},native).accepted,false,path);
  }
  for (const method of ['POST','PUT','DELETE']) assert.equal(vercelIngressRequest({...request('/blackjack?launch=fixture.claim.signature'),method},native).accepted,false);
  assert.equal(vercelIngressRequest({...request('/game?launch=fixture.claim.signature'),method:'GET'},ingress).transported,true);
});

test('old Render document bookmarks redirect to canonical UI without forwarding credentials or accepting APIs', () => {
  const direct=url=>({url,method:'GET',headers:{host:'isolated.onrender.com'}});
  assert.equal(vercelIngressRequest(direct('/blackjack?dealer=astrid&presentation=local&launch=private&token=secret'),ingress).redirect,'https://preview.example.test/game?dealer=astrid&presentation=local');
  assert.equal(vercelIngressRequest(direct('/studio/activity'),ingress).redirect,'https://preview.example.test/studio/activity');
  assert.equal(vercelIngressRequest(direct('/v2?dealer=amira&rehearsal=1'),ingress).redirect,'https://preview.example.test/v2?dealer=amira&rehearsal=1');
  assert.equal(vercelIngressRequest(direct('/casino.html?dealer=astrid&rehearsal=1&operator=sg-test'),ingress).redirect,'https://preview.example.test/play?dealer=astrid&rehearsal=1');
  assert.equal(vercelIngressRequest(direct('/bo?token=secret'),ingress).redirect,'https://preview.example.test/control/administration');
  const state='a'.repeat(64),token='b'.repeat(43);
  assert.equal(vercelIngressRequest(direct(`/bo/login.html?returnTo=${encodeURIComponent(`/api/bo/lab-login?state=${state}`)}&token=secret`),ingress).redirect,
    `https://preview.example.test/control/login?returnTo=${encodeURIComponent(`/api/bo/lab-login?state=${state}`)}`);
  assert.equal(vercelIngressRequest(direct(`/bo/set-password.html?t=${token}&next=https://evil.invalid`),ingress).redirect,
    `https://preview.example.test/control/set-password?t=${token}`);
  assert.equal(vercelIngressRequest(direct('/bo/login.html?returnTo=https://evil.invalid'),ingress).redirect,'https://preview.example.test/control/login');
  for(const path of ['/api/table','/studio/api/project','/speech-stream','/lipsync-worker','/%62o','//evil.test','/api/auth/bo/callback?code=secret'])assert.equal(vercelIngressRequest(direct(path),ingress).accepted,false,path);
  assert.equal(vercelIngressRequest({...direct('/bo'),method:'POST'},ingress).accepted,false);
  assert.equal(vercelIngressRequest({...direct('/bo'),headers:{host:'evil.test'}},ingress).accepted,false);
  assert.equal(vercelIngressRequest({...request('/game?launch=private'),method:'GET'},ingress).transported,true,'private launch continues through authenticated backend ingress');
});

test('WebSocket and SSE pass through the same authenticated ingress without replay or origin rewriting', () => {
  for (const path of ['/speech-stream', '/lipsync-worker', '/studio/api/inputs/events']) {
    const input = {...request(path), method: 'GET'};
    input.headers.upgrade = 'websocket';
    const accepted = vercelIngressRequest(input, ingress);
    assert.equal(accepted.accepted, true); assert.equal(accepted.headers.origin, ingress.publicOrigin);
    assert.equal(accepted.headers.upgrade, 'websocket');
  }
  assert.equal(vercelIngressRequest({url: '/__cloud/health', method: 'GET', headers: {host: 'isolated.onrender.com'}}, ingress).health, true);
});

test('real HTTP gateway preserves game media ranges and SSE while checking Vercel sessions', async () => {
  let authorized = true, checks = 0, eventRequests = 0;
  const web = createServer((req, res) => {
    if (req.url === '/api/v1/events') {
      eventRequests++; assert.equal(req.headers['x-croupier-lab-authorized'], undefined);
      assert.equal(req.headers['last-event-id'], 'version-17');
      res.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-store' });
      res.write('id: version-18\ndata: {"version":18}\n\n');
      return; // Leave the stream open until the client cancels.
    }
    assert.equal(req.headers.host, 'preview.example.test');
    assert.equal(req.headers['x-croupier-vercel-secret'], undefined);
    assert.equal(req.headers.range, 'bytes=2-4');
    res.writeHead(206, {'Content-Type': 'video/mp4', 'Content-Range': 'bytes 2-4/8', 'Accept-Ranges': 'bytes', ETag: '"unchanged-hash"', 'Cross-Origin-Resource-Policy': 'same-origin'});
    res.end('234');
  });
  const servers = [web];
  try {
    for (const server of servers) {server.listen(0, '127.0.0.1'); await once(server, 'listening');}
    const gateway = createCloudGateway({singleOrigin: true, gameOrigin: ingress.publicOrigin, boOrigin: ingress.publicOrigin, labOrigin: ingress.publicOrigin, streaming: true}, {
      webPort: web.address().port, vercelIngress: ingress,
      sessionCheck: async (cookie, host) => {checks++; assert.equal(cookie, 'player_session=isolated'); assert.equal(host, 'preview.example.test'); return {available: true, authorized};},
    });
    servers.push(gateway); gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
    const get = (path, headers = {}, firstChunk = false) => new Promise((resolve, reject) => {
      const req = httpRequest({host: '127.0.0.1', port: gateway.address().port, method: 'GET', path, headers: request(path, headers).headers}, res => {
        let body = '';
        res.on('data', chunk => {body += chunk; if (firstChunk) {resolve({status: res.statusCode, headers: res.headers, body}); res.destroy();}});
        res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body}));
      });
      req.on('error', reject); req.setTimeout(2000, () => req.destroy(Error('Fixture timed out.'))); req.end();
    });
    const media = await get('/api/presentation/videos/id', {range: 'bytes=2-4'});
    assert.equal(media.status, 206); assert.equal(media.body, '234'); assert.equal(media.headers['content-range'], 'bytes 2-4/8');
    assert.equal(media.headers.etag, '"unchanged-hash"'); assert.equal(media.headers['cross-origin-resource-policy'], 'same-origin');
    const session = await get('/__vercel/lab/session'); assert.equal(session.status, 200);
    const sse = await get('/api/v1/events', {'last-event-id': 'version-17'}, true);
    assert.equal(sse.status, 200); assert.match(sse.body, /id: version-18/); assert.equal(eventRequests, 1);
    authorized = false;
    assert.equal((await get('/__vercel/lab/session')).status, 401);
    assert.equal((await get('/studio/api/inputs/events', {'last-event-id': 'version-18'})).status, 421);
    assert.equal(eventRequests, 1); assert.equal(checks, 2);
    assert.equal((await get('/api/table', {'x-croupier-vercel-secret': 'spoof'})).status, 421);
  } finally {
    for (const server of servers.reverse()) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
  }
});

test('only exact GET/HEAD feature metadata crosses public Render ingress and drops all credentials',()=>{
  const direct=(url,method='GET',headers={})=>({url,method,headers:{host:'isolated.onrender.com',...headers}});
  for(const method of ['GET','HEAD'])assert.deepEqual(vercelIngressRequest(direct('/api/presentation/capabilities',method,{cookie:'fixture-private',authorization:'Bearer fixture'}),ingress),
    {accepted:true,transported:true,headers:{host:'preview.example.test'}});
  for(const url of ['/api/presentation/capabilities?dealer=nora','/api/presentation/capabilities/','/api/presentation/%63apabilities','/api/presentation/capabilities/media','/api/presentation/config','/api/presentation/select','/api/presentation/layers/north/asset'])
    assert.equal(vercelIngressRequest(direct(url),ingress).accepted,false,url);
  for(const method of ['POST','PUT','DELETE'])assert.equal(vercelIngressRequest(direct('/api/presentation/capabilities',method),ingress).accepted,false);
  assert.equal(vercelIngressRequest(direct('/api/presentation/capabilities','GET',{upgrade:'websocket'}),ingress).accepted,false);
  assert.equal(vercelIngressRequest(direct('/api/presentation/capabilities','GET',{host:'evil.test'}),ingress).accepted,false);
});

test('actual isolated Render gateway forwards public feature metadata only to the new backend',async t=>{
  let calls=0;
  const web=createServer(async(req,res)=>{
    calls++;assert.equal(req.headers.host,'preview.example.test');assert.equal(req.headers.cookie,undefined);
    assert.equal(req.headers.authorization,undefined);assert.equal(req.headers['x-croupier-vercel-secret'],undefined);
    const response=presentationCapabilitiesResponse(new Request('http://local'+req.url,{method:req.method,headers:req.headers}));
    assert.ok(response);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:await response.text());
  });
  web.listen(0,'127.0.0.1');await once(web,'listening');
  const gateway=createCloudGateway({singleOrigin:true,gameOrigin:ingress.publicOrigin,boOrigin:ingress.publicOrigin,labOrigin:ingress.publicOrigin,streaming:true},
    {webPort:web.address().port,vercelIngress:ingress});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  t.after(()=>{gateway.closeAllConnections();gateway.close();web.closeAllConnections();web.close();});
  const get=(path,method='GET',headers={})=>new Promise((resolve,reject)=>{
    const req=httpRequest({host:'127.0.0.1',port:gateway.address().port,method,path,headers:{host:'isolated.onrender.com',cookie:'fixture-cookie',authorization:'Bearer fixture',...headers}},res=>{
      let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));
    });req.on('error',reject);req.end();
  });
  const result=await get('/api/presentation/capabilities');assert.equal(result.status,200);
  assert.deepEqual(JSON.parse(result.body),{schemaVersion:2,registeredDealerIds:['nora'],compositing:'per-clip',rooms:'operator-owned-v2'});
  assert.equal(result.headers['cache-control'],'no-store');assert.equal((await get('/api/presentation/capabilities','HEAD')).body,'');
  assert.equal((await get('/api/presentation/config')).status,421);
  const v3=await get('/api/presentation/capabilities','GET',{'x-presentation-capability-version':'3'});assert.equal(v3.status,200);assert.equal(JSON.parse(v3.body).schemaVersion,3);assert.equal(v3.headers.vary,'X-Presentation-Capability-Version');
  assert.equal((await get('/api/presentation/registered-idle/north/room-johanna/7/johanna')).status,421);
  assert.equal((await get('/api/presentation/capabilities','POST')).status,421);assert.equal(calls,3);
});

test('frozen idle never gets the public capability exception and requires complete existing Vercel transport authentication',()=>{
  const path='/api/presentation/registered-idle/north/room-johanna/7/johanna';
  const direct={url:path,method:'GET',headers:{host:'isolated.onrender.com',cookie:'player_session=fixture',range:'bytes=0-15'}};
  assert.deepEqual(vercelIngressRequest(direct,ingress),{accepted:false,transported:false});
  const transported=vercelIngressRequest({...request(path,{range:'bytes=0-15'}),method:'GET'},ingress);assert.equal(transported.accepted,true);assert.equal(transported.headers.range,'bytes=0-15');assert.equal(transported.headers.cookie,'player_session=isolated');
  for(const extra of [{'x-croupier-vercel-secret':undefined},{'x-croupier-public-origin':'https://foreign.invalid'},{'x-forwarded-host':'foreign.invalid'}])assert.equal(vercelIngressRequest({...request(path,extra),method:'GET'},ingress).accepted,false);
  assert.equal(vercelIngressRequest({...request(path+'/record'),method:'GET'},ingress).accepted,false);
});

test('frozen event media retains signed transport and never becomes public feature metadata',()=>{
  const path='/api/presentation/registered-video/north/room-johanna/7/johanna/00000000-0000-4000-8000-000000000083';
  const direct={url:path,method:'GET',headers:{host:'isolated.onrender.com',cookie:'player_session=fixture',range:'bytes=0-15'}};
  assert.equal(vercelIngressRequest(direct,ingress).accepted,false);
  const transported=vercelIngressRequest({...request(path,{range:'bytes=0-15'}),method:'GET'},ingress);
  assert.equal(transported.accepted,true);assert.equal(transported.headers.range,'bytes=0-15');assert.equal(transported.headers.cookie,'player_session=isolated');
  for(const extra of [{'x-croupier-vercel-secret':undefined},{'x-croupier-public-origin':'https://foreign.invalid'},{'x-forwarded-host':'foreign.invalid'}]) assert.equal(vercelIngressRequest({...request(path,extra),method:'GET'},ingress).accepted,false);
  assert.equal(vercelIngressRequest({...request(path+'/record'),method:'GET'},ingress).accepted,false);
});

test('active shared room endpoints retain complete signed ingress and exact media identities',()=>{
  const id='00000000-0000-4000-8000-000000000083';
  const paths=[['/api/presentation/shared-room/room_a-2/binding?configVersion=cfg-1&windowId=unopened','GET'],
    ['/api/presentation/shared-room/room_a-2/config?operatorSlug=north&roomId=room_a-2&packageRevision=7&dealerId=astrid','GET'],
    ['/api/presentation/shared-room/room_a-2/idle-advice','POST'],['/api/presentation/room-idle/north/room_a-2/7/astrid','GET'],
    ['/api/presentation/room-video/north/room_a-2/7/astrid/'+id,'GET'],['/api/presentation/room-layers/north/room_a-2/7/'+id,'GET']];
  for(const [path,method]of paths){
    const input={...request(path,{range:'bytes=2-7','if-range':'"frozen"','if-none-match':'"frozen"'}),method};
    const accepted=vercelIngressRequest(input,ingress);assert.equal(accepted.accepted,true,path);
    assert.equal(accepted.headers.host,'preview.example.test');assert.equal(accepted.headers.cookie,'player_session=isolated');
    assert.equal(accepted.headers.range,'bytes=2-7');assert.equal(accepted.headers['if-range'],'"frozen"');assert.equal(accepted.headers['if-none-match'],'"frozen"');
    assert.equal(accepted.headers['x-croupier-vercel-secret'],undefined);assert.equal(accepted.headers['x-croupier-public-origin'],undefined);
    if(path.includes('/room-'))assert.equal(vercelIngressRequest({...input,method:'HEAD'},ingress).accepted,true);
    assert.equal(vercelIngressRequest({url:path,method,headers:{host:'isolated.onrender.com',cookie:'player_session=isolated'}},ingress).accepted,false);
    for(const extra of [{'x-croupier-vercel-secret':'wrong'},{'x-croupier-public-origin':'https://foreign.invalid'},{'x-forwarded-host':'foreign.invalid'},{host:'preview.example.test'}])
      assert.equal(vercelIngressRequest({...request(path,extra),method},ingress).accepted,false);
  }
  for(const path of ['/api/presentation/shared-room/room-a/unknown','/api/presentation/shared-room/room-a/binding/extra',
    '/api/presentation/shared-room/room%2Da/config','/api/presentation/shared-room/room-a/../room-b/binding','/api/presentation/shared-room/Room-a/binding',
    '/api/presentation/room-idle/north/room-a/0/astrid','/api/presentation/room-idle/north/room-a/9007199254740992/astrid',
    '/api/presentation/room-video/north/room-a/7/astrid/not-a-uuid','/api/presentation/room-layers/north/room-a/7/'+id+'/extra','/api/presentation/unknown'])
    assert.equal(vercelIngressRequest({...request(path),method:'GET'},ingress).accepted,false,path);
});

test('owned HTTP gateway carries shared binding queries and media GET HEAD Range through the same signed boundary',async t=>{
  const id='00000000-0000-4000-8000-000000000083',seen=[];
  const config='/api/presentation/shared-room/room-a/config?operatorSlug=north&roomId=room-a&packageRevision=7&dealerId=astrid';
  const binding='/api/presentation/shared-room/room-a/binding?configVersion=cfg-1&windowId=window-1';
  const advice='/api/presentation/shared-room/room-a/idle-advice';
  const media=['/api/presentation/room-idle/north/room-a/7/astrid','/api/presentation/room-video/north/room-a/7/astrid/'+id,'/api/presentation/room-layers/north/room-a/7/'+id];
  const web=createServer((req,res)=>{
    seen.push({url:req.url,method:req.method});assert.equal(req.headers.host,'preview.example.test');assert.equal(req.headers.cookie,'player_session=isolated');
    assert.equal(req.headers['x-croupier-vercel-secret'],undefined);assert.equal(req.headers['x-croupier-public-origin'],undefined);
    if([binding,config,advice].includes(req.url)){
      assert.equal(req.method,req.url===advice?'POST':'GET');res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end('{"owner":"web"}');return;
    }
    assert.ok(media.includes(req.url));assert.equal(req.headers.range,'bytes=2-4');assert.equal(req.headers['if-range'],'"frozen"');
    res.writeHead(req.method==='HEAD'?200:206,{'Content-Type':'video/mp4','Content-Length':req.method==='HEAD'?'8':'3',
      ...(req.method==='HEAD'?{}:{'Content-Range':'bytes 2-4/8'}),'Accept-Ranges':'bytes',ETag:'"frozen"','Cache-Control':'private, no-cache, must-revalidate'});
    res.end(req.method==='HEAD'?undefined:'234');
  });
  const servers=[web];t.after(async()=>{for(const server of servers.reverse()){server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}});
  web.listen(0,'127.0.0.1');await once(web,'listening');
  const gateway=createCloudGateway({singleOrigin:true,gameOrigin:ingress.publicOrigin,boOrigin:ingress.publicOrigin,labOrigin:ingress.publicOrigin,streaming:true},
    {webPort:web.address().port,vercelIngress:ingress});servers.push(gateway);gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  const send=(path,method='GET',extra={})=>new Promise((resolve,reject)=>{
    const input=request(path,extra),req=httpRequest({hostname:'127.0.0.1',port:gateway.address().port,path,method,headers:input.headers},res=>{
      let body='';res.on('data',part=>body+=part);res.once('error',reject);res.once('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});
    req.once('error',reject);req.setTimeout(2000,()=>req.destroy(Error('Owned ingress fixture timed out')));req.end();
  });
  for(const [path,method]of [[binding,'GET'],[config,'GET'],[advice,'POST']]){const response=await send(path,method);assert.equal(response.status,200);assert.equal(response.body,'{"owner":"web"}');}
  for(const path of media){
    const headers={range:'bytes=2-4','if-range':'"frozen"'},get=await send(path,'GET',headers),head=await send(path,'HEAD',headers);
    assert.equal(get.status,206);assert.equal(get.body,'234');assert.equal(get.headers['content-range'],'bytes 2-4/8');assert.equal(get.headers.etag,'"frozen"');
    assert.equal(head.status,200);assert.equal(head.body,'');assert.equal(head.headers['content-length'],'8');assert.equal(head.headers.etag,'"frozen"');
  }
  assert.equal(seen.length,9);
  for(const path of [binding,media[0]])assert.equal((await send(path,'GET',{'x-croupier-vercel-secret':'wrong'})).status,421);
  assert.equal((await send('/api/presentation/shared-room/room-a/unknown')).status,421);assert.equal(seen.length,9);
});

test('Studio preview HTML, commands and media require signed ingress and preserve only existing session cookies', () => {
  const id='10000000-0000-4000-8000-000000000001',base='/api/studio-preview/'+id;
  for(const [path,method] of [['/api/studio-preview','POST'],['/studio-preview/'+id+'?dealer=amira','GET'],
    [base+'/table','POST'],[base+'/session','GET'],[base+'/videos/'+id,'HEAD'],[base+'/layers/'+id,'GET'],[base,'DELETE']]) {
    const original={...request(path,{cookie:'lab_session=existing-admin'}),method};
    const result=vercelIngressRequest(original,ingress);
    assert.equal(result.transported,true,path);assert.equal(result.headers.cookie,'lab_session=existing-admin');
    assert.equal(result.headers['x-croupier-vercel-secret'],undefined);
    for(const fields of [{'x-croupier-vercel-secret':''},{'x-forwarded-host':'foreign.test'},{'x-croupier-public-origin':'https://foreign.test'}])
      assert.equal(vercelIngressRequest({...original,headers:{...original.headers,...fields}},ingress).accepted,false,path);
  }
  for(const path of [base+'/chat',base+'/deposit',base+'/videos/../private',base+'/layers/'+id+'/more','/studio-preview/'+id+'/extra'])
    assert.equal(vercelIngressRequest(request(path),ingress).accepted,false,path);
});
test('published company directory uses the exact existing signed public transport without exposing adjacent APIs',()=>{
  const accepted=vercelIngressRequest({...request('/api/operators'),method:'GET'},ingress);
  assert.equal(accepted.accepted,true);assert.equal(accepted.transported,true);
  assert.equal(vercelIngressRequest({...request('/api/operators'),method:'GET',headers:{host:'isolated.onrender.com'}},ingress).accepted,false);
  for(const path of ['/api/operators/','/api/operators/private/users','/api/operator','/api/operators%2f']){
    assert.equal(vercelIngressRequest({...request(path),method:'GET'},ingress).accepted,false,path);
  }
});

test('game-only gateway keeps the Web-backed Vercel session check and misdirects the signed Lab API without contacting any Lab port', async () => {
  let checks = 0, authorityStatus = 200, webRequests = 0;
  const web = createServer((req, res) => {
    assert.equal(req.headers.host, 'preview.example.test');
    if (req.url === '/api/auth/lab/check') {
      checks++; assert.equal(req.headers.cookie, 'player_session=isolated');
      assert.equal(req.headers['x-croupier-lab-authorized'], undefined);
      res.writeHead(authorityStatus); res.end(); return;
    }
    webRequests++; res.writeHead(401); res.end();
  });
  const servers = [web];
  try {
    for (const server of servers) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); }
    const gateway = createCloudGateway({ singleOrigin: true, gameOrigin: ingress.publicOrigin, boOrigin: ingress.publicOrigin, labOrigin: ingress.publicOrigin, streaming: false }, {
      webPort: web.address().port, vercelIngress: ingress,
    });
    servers.push(gateway); gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
    const get = (path, headers = {}) => new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: gateway.address().port, method: 'GET', path, headers: request(path, headers).headers }, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject); req.setTimeout(2000, () => req.destroy(Error('Fixture timed out.'))); req.end();
    });
    assert.equal(await get('/__vercel/lab/session'), 200); assert.equal(checks, 1);
    for (const path of ['/studio/api/inputs/events', '/studio/api/project', '/studio/api/videos']) assert.equal(await get(path), 421, path);
    assert.equal(await get('/api/table'), 401);
    // The retired Lab login is no longer an ingress path; it never reaches Web.
    assert.equal(await get('/api/auth/lab/start?next=%2Fstudio'), 421);
    assert.equal(checks, 1); assert.equal(webRequests, 1);
    authorityStatus = 401; assert.equal(await get('/__vercel/lab/session'), 401);
    authorityStatus = 503; assert.equal(await get('/__vercel/lab/session'), 503);
    assert.equal(checks, 3);
    const direct = await new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: gateway.address().port, method: 'GET', path: '/studio', headers: { host: 'isolated.onrender.com' } }, res => { res.resume(); res.on('end', () => resolve(res)); });
      req.on('error', reject); req.end();
    });
    assert.equal(direct.statusCode, 307); assert.equal(direct.headers.location, 'https://preview.example.test/studio', 'old Render bookmarks still lead to the canonical UI');
  } finally {
    for (const server of servers.reverse()) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
