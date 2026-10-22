import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createRequire } from 'node:module';
import { createServer, request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { createSharedRoomUpgrade } from '../services/game/shared-room-upgrade.mjs';
import { createSharedRoomChannel } from '../services/game/shared-room-channel.mjs';

const origin='https://player.invalid',engineOrigin='https://engine.invalid';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
class Raw extends EventEmitter {
  readable=true;writable=true;readableEnded=false;destroyed=false;paused=false;writes=[];
  pause(){this.paused=true;return this;}
  resume(){this.paused=false;return this;}
  end(value,callback){this.writes.push(value);callback?.();return this;}
  destroy(){if(this.destroyed)return this;this.destroyed=true;this.readable=false;this.writable=false;this.emit('close');return this;}
}
class Client extends EventEmitter {
  terminated=false;
  terminate(){if(!this.terminated){this.terminated=true;this.emit('close');}}
}
function incoming(overrides={}) {
  return Object.assign(new EventEmitter(),{method:'GET',url:'/shared-room/room-a',aborted:false,
    headers:{host:'engine.invalid',origin,connection:'Upgrade',upgrade:'websocket','sec-websocket-key':'dGhlIHNhbXBsZSBub25jZQ==','sec-websocket-version':'13'},rawHeaders:[]},overrides);
}
function setup(t,options={}) {
  const calls={prepare:[],upgrade:[],attached:[],closed:0},servers=[];
  class Server {
    constructor(settings){this.settings=settings;servers.push(this);}
    handleUpgrade(request,socket,head,attach){const client=new Client();calls.upgrade.push({request,socket,head,client});socket.writes.push('101');attach(client);}
    close(callback){this.closed=true;callback();}
  }
  const channel={prepare:async request=>{calls.prepare.push(request);return {attach:client=>calls.attached.push(client)};},close:()=>calls.closed++,...options.channel};
  const adapter=createSharedRoomUpgrade({engineOrigin,origin,WebSocketServer:Server,...options,channel});
  t.after(()=>adapter.close());
  return {adapter,calls,server:servers[0]};
}
const clean=(request,socket)=>{for(const name of ['close','end','error'])assert.equal(socket.listenerCount(name),0,name);assert.equal(request.listenerCount('aborted'),0);};

test('configured host/origin and strict owned paths reject before authentication; other paths are untouched',async t=>{
  assert.throws(()=>createSharedRoomUpgrade({engineOrigin,origin}));
  const h=setup(t);
  for(const path of ['/speech-stream','/moving-speech-stream','/lipsync-moving/a','/shared-room-other/a']) {
    const socket=new Raw();assert.equal(h.adapter.handleUpgrade(incoming({url:path}),socket,Buffer.alloc(0)),false);
    assert.equal(socket.destroyed,false);assert.equal(socket.writes.length,0);
  }
  const headers=incoming().headers;
  const malformed=[
    {url:'/shared-room'}, {url:'/shared-room/'}, {url:'/shared-room/room-a?actorId=other'}, {url:'/shared-room/room-a#x'},
    {url:'/shared-room/%72oom-a'}, {url:'/shared-room/a/../room-a'}, {url:'/shared-room/room-a/'}, {method:'POST'},
    {headers:{...headers,host:'wrong.invalid','x-forwarded-host':'engine.invalid'}},
    {headers:{...headers,origin:'https://wrong.invalid'}}, {headers:{...headers,origin:undefined}},
    {headers:{...headers,upgrade:'h2c'}}, {headers:{...headers,connection:'keep-alive'}},
    {headers:{...headers,'sec-websocket-protocol':'actor.other'}},
    {rawHeaders:['Host','engine.invalid','host','wrong.invalid']}
  ];
  for(const change of malformed){const request=incoming(change),socket=new Raw();assert.equal(await h.adapter.handleUpgrade(request,socket,Buffer.alloc(0)),true);assert.match(socket.writes[0],/^HTTP\/1.1 403/);clean(request,socket);}
  const socket=new Raw();await h.adapter.handleUpgrade(incoming(),socket,Buffer.alloc(1039));assert.match(socket.writes[0],/^HTTP\/1.1 403/);
  assert.equal(h.calls.prepare.length,0);assert.equal(h.calls.upgrade.length,0);
});

test('ws owns the protocol; authorization finishes before 101 and bounded head survives without trusting forwarded headers',async t=>{
  const gate=deferred(),authStarted=deferred();let observed;
  const h=setup(t,{channel:{prepare:async request=>{observed=request;authStarted.resolve();await gate.promise;return {attach:client=>h.calls.attached.push(client)};}}});
  assert.deepEqual(h.server.settings,{noServer:true,perMessageDeflate:false,maxPayload:1024,handleProtocols:h.server.settings.handleProtocols});
  const request=incoming({headers:{...incoming().headers,'x-forwarded-host':'spoof.invalid',forwarded:'host=spoof.invalid',cookie:'player_session=server-owned'}}),socket=new Raw(),head=Buffer.from([1,2,3]);
  const pending=h.adapter.handleUpgrade(request,socket,head);await authStarted.promise;
  assert.equal(socket.paused,true);assert.equal(h.calls.upgrade.length,0);assert.equal(socket.writes.length,0);
  head[0]=99;gate.resolve();assert.equal(await pending,true);
  assert.equal(observed.url,engineOrigin+'/shared-room/room-a');assert.equal(observed.headers.get('host'),'engine.invalid');assert.equal(observed.headers.get('x-forwarded-host'),null);assert.equal(observed.headers.get('forwarded'),null);
  assert.equal(observed.headers.get('cookie'),'player_session=server-owned');assert.equal(h.calls.attached.length,1);assert.deepEqual(h.calls.upgrade[0].head,Buffer.from([1,2,3]));
  assert.equal(socket.paused,false);clean(request,socket);
  assert.equal(await h.adapter.handleUpgrade(request,socket,Buffer.alloc(0)),true);assert.equal(h.calls.upgrade.length,1);
});

test('auth rejection and invalid prepared binding cannot emit 101 or expose internal failures',async t=>{
  for(const [failure,status] of [[{statusCode:401},401],[{statusCode:403},403],[{statusCode:409},409],[new Error('private password'),503]]) {
    const h=setup(t,{channel:{prepare:async()=>{throw failure;}}}),socket=new Raw(),request=incoming();
    await h.adapter.handleUpgrade(request,socket,Buffer.alloc(0));assert.match(socket.writes[0],new RegExp(`^HTTP/1.1 ${status}`));assert.equal(socket.writes.join('').includes('password'),false);assert.equal(h.calls.upgrade.length,0);clean(request,socket);
  }
  const h=setup(t,{channel:{prepare:async()=>({actorId:'client'})}}),socket=new Raw();
  await h.adapter.handleUpgrade(incoming(),socket,Buffer.alloc(0));assert.equal(h.calls.upgrade.length,0);assert.match(socket.writes[0],/^HTTP\/1.1 503/);
});

test('early close, end, error, request abort, timeout and stop prevent a late upgrade and abort the request',async t=>{
  for(const event of ['close','end','error','aborted','timeout','stop']) {
    const gate=deferred(),started=deferred();let requestSignal;
    const h=setup(t,{handshakeMs:event==='timeout'?10:1000,channel:{prepare:async request=>{requestSignal=request.signal;started.resolve();await gate.promise;return {attach:()=>assert.fail('Late attach')};}}});
    const request=incoming(),socket=new Raw();const pending=h.adapter.handleUpgrade(request,socket,Buffer.alloc(0));await started.promise;
    if(event==='stop')await h.adapter.close();
    else if(event==='timeout')await delay(25);
    else if(event==='aborted')request.emit('aborted');
    else if(event==='close')socket.destroy();
    else socket.emit(event,event==='error'?Error('private socket error'):undefined);
    assert.equal(await pending,true,event);gate.resolve();await turn();
    assert.equal(requestSignal.aborted,true,event);assert.equal(h.calls.upgrade.length,0,event);assert.equal(socket.destroyed,true,event);clean(request,socket);
    assert.equal(socket.writes.some(value=>value==='101'),false,event);
  }
});

test('pending capacity, stopped admission, attach failure and shutdown release only owned sockets',async t=>{
  const gate=deferred(),started=deferred();
  const h=setup(t,{maxPending:1,channel:{prepare:async()=>{started.resolve();await gate.promise;return {attach:()=>{}};}}});
  const first=new Raw(),request=incoming(),pending=h.adapter.handleUpgrade(request,first,Buffer.alloc(0));await started.promise;
  const second=new Raw();assert.equal(await h.adapter.handleUpgrade(incoming(),second,Buffer.alloc(0)),true);assert.match(second.writes[0],/^HTTP\/1.1 503/);
  await h.adapter.close();await pending;gate.resolve();await turn();assert.equal(first.destroyed,true);assert.equal(h.calls.upgrade.length,0);
  const stopped=new Raw();await h.adapter.handleUpgrade(incoming(),stopped,Buffer.alloc(0));assert.match(stopped.writes[0],/^HTTP\/1.1 503/);
  const foreign=new Raw();assert.equal(h.adapter.handleUpgrade(incoming({url:'/speech-stream'}),foreign,Buffer.alloc(0)),false);assert.equal(foreign.destroyed,false);
  const failure=setup(t,{channel:{prepare:async()=>({attach:()=>{throw Error('expired binding');}})}});
  await failure.adapter.handleUpgrade(incoming(),new Raw(),Buffer.alloc(0));assert.equal(failure.calls.upgrade[0].client.terminated,true);
  const live=setup(t);await live.adapter.handleUpgrade(incoming(),new Raw(),Buffer.alloc(0));await live.adapter.close();await live.adapter.close();
  assert.equal(live.calls.upgrade[0].client.terminated,true);assert.equal(live.calls.closed,1);assert.equal(live.server.closed,true);
});

// Match the production gateway's existing dependency. Local runs can use a
// process-local NODE_PATH to that already-installed package; never install here.
let realWs;try{realWs=createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json',import.meta.url))('ws');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
if(process.env.CI&&!realWs)throw Error('CI requires the existing gateway ws dependency for room upgrade verification');
test('real loopback HTTP/ws admission reaches the channel, rejects forged hosts/auth, and releases its port',
  {skip:!realWs&&'Existing gateway ws dependency is unavailable; socket-port cases remain mandatory',timeout:5000},async t=>{
  const server=createServer((_req,res)=>{res.writeHead(404);res.end();});
  const rawSockets=new Set();server.on('connection',socket=>{rawSockets.add(socket);socket.on('close',()=>rawSockets.delete(socket));});
  let adapter,client,port,upgrades=0,authorizations=0,reads=0;
  const auth={actorId:'actor-a',sessionId:'session-a',operatorId:'operator-a',roomId:'room-a',packageRevision:1,expiresAt:Date.now()+60000};
  const channel=createSharedRoomChannel({origin,authorize:async request=>{authorizations++;if(request.headers.get('cookie')!=='player_session=valid')throw Object.assign(Error('private auth detail'),{statusCode:401});return auth;},
    revalidate:async()=>auth,readSnapshot:async()=>{reads++;return {contract:'blackjack-table/1',roomId:'room-a',version:1,presentationVer:0,configVersion:'config-a',windowId:'window-a',me:{id:'actor-a'}};},readPresentation:async()=>null});
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port;
    class ObservedServer extends realWs.WebSocketServer {handleUpgrade(...args){upgrades++;return super.handleUpgrade(...args);}}
    adapter=createSharedRoomUpgrade({engineOrigin:`http://127.0.0.1:${port}`,origin,channel,WebSocketServer:ObservedServer});
    server.on('upgrade',(request,socket,head)=>{void Promise.resolve(adapter.handleUpgrade(request,socket,head)).then(handled=>{if(!handled)socket.destroy();});});
    assert.equal(server.listenerCount('upgrade'),1);
    const denied=headers=>new Promise((resolve,reject)=>{
      const req=httpRequest({hostname:'127.0.0.1',port,path:'/shared-room/room-a',headers:{origin,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':'dGhlIHNhbXBsZSBub25jZQ==',...headers}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});
      req.on('error',reject);req.on('upgrade',(_r,socket)=>{socket.destroy();reject(Error('Unexpected 101'));});req.end();
    });
    assert.equal(await denied({Host:'forged.invalid','x-forwarded-host':`127.0.0.1:${port}`,Cookie:'player_session=valid'}),403);
    assert.equal(authorizations,0);assert.equal(reads,0);assert.equal(upgrades,0);
    assert.equal(await denied({Cookie:'player_session=invalid'}),401);assert.equal(reads,0);assert.equal(upgrades,0);
    assert.equal(await denied({Cookie:'player_session=valid','Sec-WebSocket-Key':'invalid'}),400);assert.equal(reads,0);
    client=new realWs.WebSocket(`ws://127.0.0.1:${port}/shared-room/room-a`,{origin,headers:{cookie:'player_session=valid'}});
    const message=once(client,'message');await once(client,'open');const [bytes]=await message;
    const frame=JSON.parse(bytes.toString());assert.equal(frame.snapshot.me.id,'actor-a');assert.equal(frame.roomId,'room-a');assert.equal(client.extensions,'');assert.equal(client.protocol,'');
    const closed=once(client,'close');client.send(JSON.stringify({actorId:'other',op:'bet'}));const [code]=await closed;assert.equal(code,1008);assert.equal(reads,1);
  } finally {
    client?.terminate();await adapter?.close();channel.close();for(const socket of rawSockets)socket.destroy();
    if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
  assert.equal(server.listening,false);assert.equal(rawSockets.size,0);
  await new Promise((resolve,reject)=>{const socket=connect({host:'127.0.0.1',port});socket.on('connect',()=>{socket.destroy();reject(Error('Owned port remained open'));});socket.on('error',error=>error.code==='ECONNREFUSED'?resolve():reject(error));});
  const wsVersion=createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json',import.meta.url))('ws/package.json').version;
  t.diagnostic('ws '+wsVersion+'; loopbackport '+port+' closed, zero owned sockets, subsequent connect ECONNREFUSED');
});
