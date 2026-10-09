import test from 'node:test';
import assert from 'node:assert/strict';
import {readVercelIngressConfig, vercelIngressRequest} from '../vercel-ingress.mjs';
import {proxyHeaders} from '../gateway.mjs';
import {createCloudGateway} from '../gateway.mjs';
import {createServer, request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {presentationCapabilitiesResponse} from '../../../web/presentation-capabilities.mjs';

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

test('canonical blackjack launch crosses exact authenticated ingress only under the shared Neon flag', () => {
  const native=readVercelIngressConfig({...env,CROUPIER_STUDIO_NEON_POLICY:'1'});
  assert.equal(native.canonicalGame,true);assert.equal(Object.hasOwn(ingress,'canonicalGame'),false);
  for (const path of ['/blackjack?launch=fixture.claim.signature','/blackjack/?dealer=mei&launch=fixture.claim.signature']) {
    for (const method of ['GET','HEAD']) {
      const input={...request(path),method},accepted=vercelIngressRequest(input,native);
      assert.equal(accepted.transported,true,path);assert.equal(accepted.headers.host,'preview.example.test');
      assert.equal(accepted.headers.cookie,'player_session=isolated');assert.equal(accepted.headers['x-croupier-vercel-secret'],undefined);
      assert.equal(vercelIngressRequest(input,ingress).accepted,false,'off mode keeps blackjack outside authenticated game ingress');
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

test('real HTTP gateway preserves media ranges and streams SSE, checking Lab access on every reconnect', async () => {
  let authorized = true, checks = 0, labRequests = 0;
  const web = createServer((req, res) => {
    assert.equal(req.headers.host, 'preview.example.test');
    assert.equal(req.headers['x-croupier-vercel-secret'], undefined);
    assert.equal(req.headers.range, 'bytes=2-4');
    res.writeHead(206, {'Content-Type': 'video/mp4', 'Content-Range': 'bytes 2-4/8', 'Accept-Ranges': 'bytes', ETag: '"unchanged-hash"', 'Cross-Origin-Resource-Policy': 'same-origin'});
    res.end('234');
  });
  const lab = createServer((req, res) => {
    labRequests++; assert.equal(req.headers['x-croupier-lab-authorized'], 'lab-fixture-internal-secret-'.repeat(3));
    assert.equal(req.headers['last-event-id'], 'version-17');
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store'});
    res.write('id: version-18\ndata: {"version":18}\n\n');
    // Keep the connection open; the first event must reach the client now.
  });
  const servers = [web, lab];
  try {
    for (const server of servers) {server.listen(0, '127.0.0.1'); await once(server, 'listening');}
    const gateway = createCloudGateway({singleOrigin: true, gameOrigin: ingress.publicOrigin, boOrigin: ingress.publicOrigin, labOrigin: ingress.publicOrigin, streaming: true}, {
      webPort: web.address().port, labPort: lab.address().port, vercelIngress: ingress, labInternalSecret: 'lab-fixture-internal-secret-'.repeat(3),
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
    const sse = await get('/studio/api/inputs/events', {'last-event-id': 'version-17'}, true);
    assert.equal(sse.status, 200); assert.match(sse.body, /id: version-18/); assert.equal(labRequests, 1);
    authorized = false;
    assert.equal((await get('/__vercel/lab/session')).status, 401);
    assert.equal((await get('/studio/api/inputs/events', {'last-event-id': 'version-18'})).status, 401);
    assert.equal(labRequests, 1); assert.equal(checks, 4);
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
    const response=presentationCapabilitiesResponse(new Request('http://local'+req.url,{method:req.method}));
    assert.ok(response);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:await response.text());
  });
  web.listen(0,'127.0.0.1');await once(web,'listening');
  const gateway=createCloudGateway({singleOrigin:true,gameOrigin:ingress.publicOrigin,boOrigin:ingress.publicOrigin,labOrigin:ingress.publicOrigin,streaming:true},
    {webPort:web.address().port,vercelIngress:ingress,labInternalSecret:'isolated-lab-secret-'.repeat(3)});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  t.after(()=>{gateway.closeAllConnections();gateway.close();web.closeAllConnections();web.close();});
  const get=(path,method='GET')=>new Promise((resolve,reject)=>{
    const req=httpRequest({host:'127.0.0.1',port:gateway.address().port,method,path,headers:{host:'isolated.onrender.com',cookie:'fixture-cookie',authorization:'Bearer fixture'}},res=>{
      let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));
    });req.on('error',reject);req.end();
  });
  const result=await get('/api/presentation/capabilities');assert.equal(result.status,200);
  assert.deepEqual(JSON.parse(result.body),{schemaVersion:1,registeredDealerIds:['nora'],compositing:'per-clip'});
  assert.equal(result.headers['cache-control'],'no-store');assert.equal((await get('/api/presentation/capabilities','HEAD')).body,'');
  assert.equal((await get('/api/presentation/config')).status,421);
  assert.equal((await get('/api/presentation/capabilities','POST')).status,421);assert.equal(calls,2);
});
