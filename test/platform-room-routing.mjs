import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, request as httpRequest} from 'node:http';
import {connect as netConnect} from 'node:net';
import {once} from 'node:events';
import {setImmediate as turn} from 'node:timers/promises';
import {createRequire, registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createCloudGateway} from '../ops/cloud/gateway.mjs';
import {readVercelIngressConfig, vercelIngressRequest} from '../ops/cloud/vercel-ingress.mjs';
import {createSharedRoomUpgrade} from '../services/game/shared-room-upgrade.mjs';
import {createSharedRoomChannel} from '../services/game/shared-room-channel.mjs';

// Speech uses its actual8.22.0; the game upgrade uses its default, separate
// Gateway-owned8.21.3. Neither production dependency is changed by this fixture.
const require = createRequire(new URL('../apps/speech/package.json', import.meta.url));
assert.equal(require('ws/package.json').version, '8.22.0');
assert.equal(createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws/package.json').version, '8.21.3');
const WebSocket = require('ws');
const wsUrl = new URL('wrapper.mjs', pathToFileURL(require.resolve('ws/package.json'))).href;
const hook = registerHooks({resolve(specifier, context, next) {
  if (specifier === 'ws') return next(wsUrl, context);
  if (specifier.startsWith('@croupier/server-transport/')) return next(new URL('../packages/server-transport/' + specifier.split('/').at(-1) + '.mjs', import.meta.url).href, context);
  return next(specifier, context);
}});
let createSpeechIngress;
try {({createSpeechIngress} = await import('../apps/speech/service.mjs'));} finally {hook.deregister();}
const origin = 'https://player.example.test', transport = 'https://engine.example.test';
const env = {CROUPIER_VERCEL_UI:'1',CROUPIER_PUBLIC_ORIGIN:origin,CROUPIER_BACKEND_ORIGIN:transport,
  CROUPIER_VERCEL_TRANSPORT_ORIGIN:transport,
  CROUPIER_VERCEL_INGRESS_SECRET:'isolated-private-room-ingress-'.repeat(3)};
const ingress = readVercelIngressConfig(env);
const signed = {host:'engine.example.test',origin,cookie:'player_session=a',upgrade:'websocket',connection:'Upgrade',
  'x-croupier-vercel-secret':ingress.secret,'x-croupier-public-origin':origin,'x-forwarded-host':'player.example.test','x-forwarded-proto':'https'};
const deny = () => {throw Object.assign(Error('private_session_rejected'),{statusCode:403});};
const deferred = () => {let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
async function listen(server) {await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;}
async function refused(port) {await new Promise((resolve,reject)=>{const socket=netConnect({host:'127.0.0.1',port});socket.on('connect',()=>{socket.destroy();reject(Error('Owned fixture port remained open'));});socket.on('error',error=>error.code==='ECONNREFUSED'?resolve():reject(error));});}
function rejectUpgrade(port, path, headers, method='GET') {
  return new Promise((resolve,reject)=>{const request=httpRequest({hostname:'127.0.0.1',port,path,method,headers:{
    connection:'Upgrade',upgrade:'websocket','sec-websocket-key':'dGhlIHNhbXBsZSBub25jZQ==','sec-websocket-version':'13',...headers}},response=>{response.resume();response.once('end',()=>resolve(response.statusCode));});
    request.once('error',reject);request.once('upgrade',(_response,socket)=>{socket.destroy();reject(Error('Unexpected public101'));});request.end();});
}
async function fixture(t,{admission}={}) {
  const sockets=new Set(),clients=new Set(),ports=[],observed={auth:[],snapshots:[],requests:[],upgrades:0};
  const expiresAt=Date.now()+60000;
  const auth = roomId => ({actorId:'actor-a',sessionId:'session-a',operatorId:'operator-a',roomId,packageRevision:1,expiresAt});
  const roomChannel=createSharedRoomChannel({origin,authorize:async(request,{roomId})=>{
    observed.auth.push({url:request.url,headers:request.headers,roomId});
    if(request.headers.get('cookie')!=='player_session=a'||roomId!=='room-a')deny();
    await admission?.promise;return auth(roomId);
  },revalidate:async()=>auth('room-a'),readSnapshot:async(roomId,actorId)=>{observed.snapshots.push({roomId,actorId});
    return {contract:'blackjack-table/1',roomId,version:1,presentationVer:0,configVersion:'config-a',windowId:'window-a',me:{id:actorId}};
  },readPresentation:async()=>null});
  const channel={close:()=>roomChannel.close(),async prepare(request){const admitted=await roomChannel.prepare(request);return {attach(ws){observed.upgrades++;return admitted.attach(ws);}};}};
  const adapter=createSharedRoomUpgrade({engineOrigin:origin,origin,channel});
  const game=createServer((_request,response)=>{response.writeHead(404);response.end();});
  game.on('upgrade',(request,socket,head)=>{observed.requests.push(request);void Promise.resolve(adapter.handleUpgrade(request,socket,head)).then(handled=>{if(!handled)socket.destroy();});});
  const gateway=createCloudGateway({gameOrigin:origin,boOrigin:origin,labOrigin:origin,singleOrigin:true,streaming:false,vercelIngress:ingress},
    {webPort:await listen(game)});
  const gatewayPort=await listen(gateway);
  class LocalBackend extends WebSocket {constructor(url,protocols,options){super(url.replace('wss://engine.example.test','ws://127.0.0.1:'+gatewayPort),protocols,
    {...options,headers:{...options.headers,host:'engine.example.test'}});}}
  const speech=createSpeechIngress({env,WebSocketImpl:LocalBackend,bridgeOptions:{closeTimeoutMs:20}});
  for(const server of [game,gateway,speech]) {server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});}
  const speechPort=await listen(speech);ports.push(game.address().port,gatewayPort,speechPort);
  t.after(async()=>{for(const client of clients)client.terminate();admission?.resolve();await adapter.close();
    await Promise.all([...sockets].map(socket=>{const closed=once(socket,'close');socket.destroy();return closed;}));
    await Promise.all([game,gateway,speech].map(server=>server.listening?new Promise(resolve=>server.close(resolve)):undefined));
    await turn();assert.equal(sockets.size,0);for(const port of ports)await refused(port);
    t.diagnostic('Speech ws8.22.0/game default ws8.21.3; three owned loopback ports closed and refused; no provider or SQL access');});
  function client(path='/shared-room/room-a',headers={}) {const ws=new WebSocket('ws://127.0.0.1:'+speechPort+path,{headers:{host:'player.example.test',origin,cookie:'player_session=a',...headers}});ws.on('error',()=>{});clients.add(ws);return ws;}
  return {speech,gateway,game,adapter,observed,client,speechPort,gatewayPort};
}

test('signed room ingress permits only exact GET/Host/Origin/cookie and strips internal authority',()=>{
  const request={method:'GET',url:'/shared-room/room-a',headers:{...signed,'x-croupier-lab-authorized':'spoof','x-forwarded-for':'spoof'}};
  const accepted=vercelIngressRequest(request,ingress);assert.equal(accepted.accepted,true);
  assert.equal(accepted.headers.host,'player.example.test');assert.equal(accepted.headers.cookie,signed.cookie);assert.equal(accepted.headers.origin,origin);
  for(const name of ['x-croupier-vercel-secret','x-croupier-public-origin','x-croupier-lab-authorized','x-forwarded-for'])assert.equal(accepted.headers[name],undefined,name);
  for(const headers of [{host:'player.example.test'},{origin:'https://other.invalid'},{origin:undefined},{cookie:undefined},{cookie:''},
    {'x-croupier-vercel-secret':'wrong'},{'x-forwarded-host':'other.invalid'},{authorization:'Bearer worker'},{'x-worker-id':'worker'},{'sec-websocket-protocol':'ticket.private'}])
    assert.equal(vercelIngressRequest({...request,headers:{...signed,...headers}},ingress).accepted,false);
  for(const url of ['/shared-room','/shared-room/','/shared-room/a?x=y','/shared-room/a?','/shared-room/%61','/shared-room/a/../room-a','/shared-room/a/','/shared-room/'+'a'.repeat(129)])
    assert.equal(vercelIngressRequest({...request,url},ingress).accepted,false,url);
  assert.equal(vercelIngressRequest({...request,method:'POST'},ingress).accepted,false);
  assert.equal(vercelIngressRequest({...request,rawHeaders:['Host','engine.example.test','host','other.invalid']},ingress).accepted,false);
});

test('Speech → signed ingress → Gateway → game retains room/session and waits for application auth before public101',{timeout:5000},async t=>{
  const admission=deferred(),h=await fixture(t,{admission}),client=h.client();let opened=false;client.once('open',()=>opened=true);
  while(h.observed.auth.length===0)await turn();assert.equal(opened,false);assert.equal(h.observed.upgrades,0);assert.equal(h.observed.snapshots.length,0);
  const observed=h.observed.auth[0];assert.equal(observed.url,origin+'/shared-room/room-a');assert.equal(observed.headers.get('host'),'player.example.test');
  assert.equal(observed.headers.get('origin'),origin);assert.equal(observed.headers.get('cookie'),'player_session=a');
  for(const name of ['authorization','x-worker-id','x-croupier-vercel-secret','x-croupier-lab-authorized','x-forwarded-host'])assert.equal(observed.headers.get(name),null,name);
  const message=once(client,'message');admission.resolve();await once(client,'open');const [bytes]=await message;
  const frame=JSON.parse(bytes);assert.equal(frame.roomId,'room-a');assert.equal(frame.snapshot.me.id,'actor-a');assert.equal(client.extensions,'');assert.equal(client.protocol,'');
  const closed=once(client,'close');client.send(JSON.stringify({actorId:'other',op:'bet'}));assert.equal((await closed)[0],1008);assert.equal(h.observed.snapshots.length,1);
});

test('public and direct transport failures cannot upgrade, read another room or leak rejected auth',{timeout:5000},async t=>{
  const h=await fixture(t);
  for(const [path,headers,status] of [['/shared-room/room-b',{},403],['/shared-room/room-a',{cookie:'player_session=wrong'},403],
    ['/shared-room/room-a',{host:'forged.invalid'},403],['/shared-room/room-a',{origin:'https://other.invalid'},403],
    ['/shared-room/room-a',{authorization:'Bearer worker'},403],['/shared-room/room-a',{'sec-websocket-protocol':'astrid-v2'},403],
    ['/shared-room/room-a?actorId=other',{},404]]) {
    assert.equal(await rejectUpgrade(h.speechPort,path,{host:'player.example.test',origin,cookie:'player_session=a',...headers}),status,path);
  }
  assert.equal(await rejectUpgrade(h.gatewayPort,'/shared-room/room-a',{...signed,'x-croupier-vercel-secret':'forged'}),421);
  assert.equal(h.observed.upgrades,0);assert.equal(h.observed.snapshots.length,0);
});

test('application stop rejects new handshakes and closes established public peers',{timeout:5000},async t=>{
  const h=await fixture(t),client=h.client();const first=once(client,'message');await once(client,'open');await first;
  const closed=once(client,'close');await h.adapter.close();await closed;
  assert.equal(await rejectUpgrade(h.speechPort,'/shared-room/room-a',{host:'player.example.test',origin,cookie:'player_session=a'}),503);
  assert.equal(h.observed.upgrades,1);
});

test('Gateway close drains an established room tunnel through Speech',{timeout:5000},async t=>{
  const h=await fixture(t),client=h.client();const first=once(client,'message');await once(client,'open');await first;
  const closed=once(client,'close');await new Promise(resolve=>h.gateway.close(resolve));await closed;
  assert.equal(h.gateway.listening,false);assert.equal(h.observed.upgrades,1);
  let rejection;h.gateway.emit('upgrade',{method:'GET',url:'/shared-room/room-a',headers:signed},{destroyed:false,end(value){rejection=value;}},Buffer.alloc(0));
  assert.match(rejection,/^HTTP\/1.1 503/);assert.equal(h.observed.upgrades,1);
});


test('Gateway close aborts pending game admission without a late public101',{timeout:5000},async t=>{
  const admission=deferred(),h=await fixture(t,{admission}),client=h.client();let opened=false;client.once('open',()=>opened=true);
  while(h.observed.auth.length===0)await turn();
  const closed=new Promise(resolve=>client.once('close',resolve));await new Promise(resolve=>h.gateway.close(resolve));await closed;
  admission.resolve();await turn();assert.equal(opened,false);assert.equal(h.observed.upgrades,0);assert.equal(h.observed.snapshots.length,0);
});

test('Speech close drains an established room bridge and closes its listening port',{timeout:5000},async t=>{
  const h=await fixture(t),client=h.client();const first=once(client,'message');await once(client,'open');await first;
  const closed=once(client,'close');await new Promise(resolve=>h.speech.close(resolve));await closed;
  assert.equal(h.speech.listening,false);assert.equal(h.observed.upgrades,1);
});
