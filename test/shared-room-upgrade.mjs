import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer, request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
import { createSharedRoomUpgrade } from '../services/game/shared-room-upgrade.mjs';
import { createSharedRoomChannel } from '../services/game/shared-room-channel.mjs';
import { SHARED_ROOM_SOCKET } from '../packages/server-transport/paths.mjs';

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
  const calls={prepare:[],upgrade:[],attached:[],identities:[],closed:0},servers=[];
  class Server extends EventEmitter {
    constructor(settings){super();this.settings=settings;servers.push(this);}
    handleUpgrade(request,socket,head,attach){const client=new Client(),headers=[];this.emit('headers',headers,request);calls.upgrade.push({request,socket,head,client,headers});socket.writes.push('101');attach(client);}
    close(callback){this.closed=true;callback();}
  }
  const channel={prepare:async request=>{calls.prepare.push(request);return {attach:client=>calls.attached.push(client)};},close:()=>calls.closed++,...options.channel};
  const adapter=createSharedRoomUpgrade({engineOrigin,origin,WebSocketServer:Server,onSocketIdentity:value=>calls.identities.push(value),...options,channel});
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

test('F11 identities belong to the authorized process/socket, never client headers, and refused/failed attaches have no log',async t=>{
  const first=setup(t),second=setup(t),forged='v1.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  for(const h of [first,first,second]) await h.adapter.handleUpgrade(incoming({headers:{...incoming().headers,
    cookie:'private-cookie','x-croupier-room-instance':forged,'x-forwarded-host':'secret-host'}}),new Raw(),Buffer.alloc(0));
  const records=[...first.calls.identities,...second.calls.identities];
  assert.equal(records.length,3);assert.equal(new Set(records.map(x=>x.processId)).size,1);
  assert.equal(new Set(records.map(x=>x.socketNonce)).size,3);
  for(const [index,record] of records.entries()) {
    assert.deepEqual(Object.keys(record).sort(),['at','event','processId','socketNonce']);
    assert.equal(record.event,'shared_room_socket_identity');assert.ok(Number.isSafeInteger(record.at));
    const upgraded=index<2?first.calls.upgrade[index]:second.calls.upgrade[0];
    assert.deepEqual(upgraded.headers,[`x-croupier-room-instance: v1.${record.processId}.${record.socketNonce}`]);
  }
  const safe=JSON.stringify(records);for(const secret of ['private-cookie','secret-host',forged])assert.equal(safe.includes(secret),false);
  for(const error of [{statusCode:401},{statusCode:403,code:'room_config_missing'}]) {
    const h=setup(t,{channel:{prepare:async()=>{throw error;}}});await h.adapter.handleUpgrade(incoming(),new Raw(),Buffer.alloc(0));
    assert.deepEqual(h.calls.identities,[]);assert.ok(h.calls.upgrade.every(x=>x.headers.length===0));
  }
  const failed=setup(t,{channel:{prepare:async()=>({attach(){throw Error('expired');}})}});
  await failed.adapter.handleUpgrade(incoming(),new Raw(),Buffer.alloc(0));assert.deepEqual(failed.calls.identities,[]);
  const noLog=setup(t,{onSocketIdentity(){throw Error('log unavailable');}});
  await noLog.adapter.handleUpgrade(incoming(),new Raw(),Buffer.alloc(0));assert.equal(noLog.calls.attached.length,1);
  assert.equal(noLog.calls.upgrade[0].client.terminated,false);
});

test('F11 a fresh Node process has a different process identity, without a client-supplied identity option',async()=>{
  const source=`
    import {EventEmitter} from 'node:events';
    import {createSharedRoomUpgrade} from ${JSON.stringify(new URL('../services/game/shared-room-upgrade.mjs',import.meta.url).href)};
    class Server extends EventEmitter {handleUpgrade(r,s,h,done){const c=new EventEmitter();c.readyState=3;done(c);}close(done){done();}}
    const raw=Object.assign(new EventEmitter(),{readable:true,writable:true,readableEnded:false,destroyed:false,pause(){},resume(){}});
    const request=Object.assign(new EventEmitter(),{method:'GET',url:'/shared-room/synthetic',headers:{host:'engine.invalid',origin:'https://player.invalid',upgrade:'websocket',connection:'Upgrade'},rawHeaders:[]});
    const upgrade=createSharedRoomUpgrade({engineOrigin:'https://engine.invalid',origin:'https://player.invalid',WebSocketServer:Server,
      channel:{async prepare(){return {attach(){}};},close(){}},onSocketIdentity:row=>console.log(JSON.stringify(row))});
    await upgrade.handleUpgrade(request,raw,Buffer.alloc(0));await upgrade.close();`;
  const run=()=>promisify(execFile)(process.execPath,['--input-type=module','-e',source],{timeout:5000,windowsHide:true,
    env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot}});
  const [a,b]=await Promise.all([run(),run()]);
  assert.notEqual(JSON.parse(a.stdout).processId,JSON.parse(b.stdout).processId);
});

// Real loopback ws hops exercise the same response-header events as Render ->
// Vercel -> a Node collector. HTTPS origins remain validated by the proxy; only
// the injected fixture transport maps the trusted backend to a loopback server.
let createPlatformNativeWebSocketServer;
if(realWs) {
  const require=createRequire(new URL('../apps/speech/package.json',import.meta.url));
  const wsUrl=new URL('wrapper.mjs',pathToFileURL(require.resolve('ws/package.json'))).href;
  const hook=registerHooks({resolve(specifier,context,next){return next(specifier==='ws'?wsUrl:specifier,context);}});
  try {({createPlatformNativeWebSocketServer}=await import('../packages/server-transport/node-server.mjs'));}finally{hook.deregister();}
}
async function identityProxy(t,{identity,corruptAccept=false,realEngine=false,failAuth=false,headersExtra=[]}={}) {
  const backend=createServer(),records=[],peers=new Set(),raws=new Set(),upstreams=[],clients=[];let adapter,wss,proxy;
  t.after(async()=>{
    for(const ws of [...clients,...upstreams,...peers])ws.terminate();
    await adapter?.close();if(wss)await new Promise(resolve=>wss.close(resolve));
    for(const raw of raws)raw.destroy();
    await Promise.all([proxy,backend].filter(s=>s?.listening).map(s=>new Promise(resolve=>s.close(resolve))));
  });
  backend.on('connection',s=>{raws.add(s);s.once('close',()=>raws.delete(s));});
  await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
  const backendOrigin=`http://127.0.0.1:${backend.address().port}`;
  if(realEngine) {
    const channel={async prepare(request){
      if(failAuth || request.headers.get('cookie')!=='player_session=synthetic')throw Object.assign(Error('private-auth-detail'),{statusCode:401});
      return {attach(ws){peers.add(ws);ws.once('close',()=>peers.delete(ws));ws.send('{"type":"synthetic-state"}');}};
    },close(){for(const ws of peers)ws.close(1012,'shared_room_restart');}};
    adapter=createSharedRoomUpgrade({engineOrigin:backendOrigin,origin,channel,WebSocketServer:realWs.WebSocketServer,onSocketIdentity:row=>records.push(row)});
    backend.on('upgrade',(req,socket,head)=>{void adapter.handleUpgrade(req,socket,head);});
  }else{
    wss=new realWs.WebSocketServer({noServer:true});
    wss.on('headers',headers=>{
      if(identity!==undefined)headers.push(`x-croupier-room-instance: ${identity}`);
      headers.push(...headersExtra);
      if(corruptAccept)headers[headers.findIndex(x=>x.startsWith('Sec-WebSocket-Accept:'))]='Sec-WebSocket-Accept: invalid';
    });
    backend.on('upgrade',(req,socket,head)=>wss.handleUpgrade(req,socket,head,ws=>{peers.add(ws);ws.once('close',()=>peers.delete(ws));}));
  }
  class Loopback extends realWs.WebSocket {
    constructor(url,protocols,options){assert.equal(new URL(url).origin,'wss://engine.invalid');super(backendOrigin.replace('http:','ws:')+new URL(url).pathname,protocols,options);upstreams.push(this);}
  }
  proxy=createPlatformNativeWebSocketServer(SHARED_ROOM_SOCKET,{env:{CROUPIER_PUBLIC_ORIGIN:origin,CROUPIER_BACKEND_ORIGIN:engineOrigin,
    CROUPIER_VERCEL_INGRESS_SECRET:'synthetic-fixture-ingress-'.repeat(2)},WebSocketImpl:Loopback,bridgeOptions:{closeTimeoutMs:20}});
  proxy.on('connection',s=>{raws.add(s);s.once('close',()=>raws.delete(s));});
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
  const open=(extra={})=>new Promise((resolve,reject)=>{
    const client=new realWs.WebSocket(`ws://127.0.0.1:${proxy.address().port}/shared-room/room-a`,{
      origin,headers:{host:'player.invalid',cookie:'player_session=synthetic',...extra},handshakeTimeout:2000});clients.push(client);
    let reply;client.on('upgrade',r=>{reply=r;});client.once('open',()=>resolve({client,reply}));
    client.once('unexpected-response',(_req,r)=>{reply=r;r.resume();client.terminate();resolve({client,reply:r});});
    client.on('error',error=>{if(!reply)reject(error);});
  });
  return {open,records,adapter};
}

test('F11 public socket metadata matches authorized engine log, ignores forged request headers and preserves 1012',
  {skip:!realWs,timeout:5000},async t=>{
    const h=await identityProxy(t,{realEngine:true});
    const first=await h.open({'x-croupier-room-instance':'forged-by-client','x-forwarded-host':'private-spoof'}),second=await h.open();
    assert.equal(h.records.length,2);
    for(const [i,value] of [first,second].entries()) {
      const record=h.records[i];assert.equal(value.reply.headers['x-croupier-room-instance'],`v1.${record.processId}.${record.socketNonce}`);
      assert.equal(value.reply.headers['set-cookie'],undefined);assert.equal(value.reply.headers.authorization,undefined);
    }
    assert.equal(h.records[0].processId,h.records[1].processId);assert.notEqual(h.records[0].socketNonce,h.records[1].socketNonce);
    assert.equal(JSON.stringify(h.records).includes('synthetic'),false);assert.equal(JSON.stringify(h.records).includes('private-spoof'),false);
    const closed=once(first.client,'close');await h.adapter.close();assert.equal((await closed)[0],1012);
  });
test('F11 unauthorized sockets expose no identity headers or correlation logs',
  {skip:!realWs,timeout:5000},async t=>{
    const h=await identityProxy(t,{realEngine:true,failAuth:true}),r=await h.open();
    assert.equal(r.reply.statusCode,401);assert.equal(r.reply.headers['x-croupier-room-instance'],undefined);assert.deepEqual(h.records,[]);
  });
test('F11 proxy refuses malformed, duplicate and unverified upstream identity; old engines remain without evidence',
  {skip:!realWs,timeout:10000},async t=>{
    const valid='v1.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    for(const options of [{identity:'private-cookie-secret'},{identity:valid,headersExtra:[`X-Croupier-Room-Instance: ${valid}`]},
      {identity:valid,corruptAccept:true}]){
      const h=await identityProxy(t,options),r=await h.open();assert.equal(r.reply.statusCode,502);
      assert.equal(r.reply.headers['x-croupier-room-instance'],undefined);
      assert.equal(JSON.stringify(r.reply.headers).includes('private-cookie-secret'),false);
    }
    const old=await identityProxy(t,{headersExtra:['Set-Cookie: private-cookie-secret','X-Private-Header: private-value']});
    const r=await old.open({'x-croupier-room-instance':valid});assert.equal(r.reply.statusCode,101);
    for(const name of ['x-croupier-room-instance','set-cookie','x-private-header'])assert.equal(r.reply.headers[name],undefined);
  });
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

// B2: a server restart (SIGTERM -> service close -> upgrade close) reaches a real browser
// socket as 1012, so the client reconnects instead of stopping (1000) or seeing 1006.
test('service shutdown closes an open real socket with 1012 before the transport is released',
  {skip:!realWs&&'Existing gateway ws dependency is unavailable',timeout:5000},async()=>{
  const server=createServer((_req,res)=>{res.writeHead(404);res.end();});
  const auth={actorId:'actor-a',sessionId:'session-a',operatorId:'operator-a',roomId:'room-a',packageRevision:1,expiresAt:Date.now()+60000};
  const channel=createSharedRoomChannel({origin,authorize:async()=>auth,revalidate:async()=>auth,
    readSnapshot:async()=>({contract:'blackjack-table/1',roomId:'room-a',version:1,presentationVer:0,configVersion:'config-a',windowId:'window-a',me:{id:'actor-a'}}),readPresentation:async()=>null});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
  const adapter=createSharedRoomUpgrade({engineOrigin:`http://127.0.0.1:${port}`,origin,channel,WebSocketServer:realWs.WebSocketServer});
  server.on('upgrade',(request,socket,head)=>{void Promise.resolve(adapter.handleUpgrade(request,socket,head)).then(handled=>{if(!handled)socket.destroy();});});
  const client=new realWs.WebSocket(`ws://127.0.0.1:${port}/shared-room/room-a`,{origin});
  try {
    const message=once(client,'message');await once(client,'open');await message;
    const closed=once(client,'close');await adapter.close();
    const [code,reason]=await closed;assert.equal(code,1012);assert.equal(reason.toString(),'shared_room_restart');
  } finally { client.terminate();if(server.listening)await new Promise(resolve=>server.close(resolve)); }
});

// Nyckel→bolag (docs/plans/NYCKEL-BOLAG.md): a browser sees a rejected handshake only as 1006 and retried
// for a minute (receipt O02 partner-key-shared-table). A partner refused by name for its key's company
// gets 101 and at once 1008 with that code instead; no other refusal opens a socket.
// Preview 29 Oct 2026: an open room without published game settings is refused by name the same way.
test('a partner refused for its key company, or a room without game settings, is closed with 1008 and the code, never attached', async t => {
  for (const code of ['partner_operator_mismatch', 'partner_key_unbound', 'room_config_missing']) {
    const closed = [], attached = [];
    class Refused extends Client { close(status, reason) { closed.push([status, reason]); this.terminate(); } }
    class Server {
      handleUpgrade(request, socket, head, done) { socket.writes.push('101'); done(new Refused()); }
      close(callback) { callback(); }
    }
    const channel = { prepare: async () => { throw Object.assign(new Error(code), { code, statusCode: 403 }); }, close() {} };
    const adapter = createSharedRoomUpgrade({ engineOrigin, origin, WebSocketServer: Server, channel });
    t.after(() => adapter.close());
    const request = incoming(), socket = new Raw();
    assert.equal(await adapter.handleUpgrade(request, socket, Buffer.alloc(0)), true);
    assert.deepEqual(closed, [[1008, code]]); assert.deepEqual(attached, []);
    assert.deepEqual(socket.writes, ['101']); assert.equal(socket.paused, false); clean(request, socket);
  }
  for (const [error, status] of [[{ code: 'studio_forbidden', statusCode: 403 }, 403], [{ code: 'partner_operator_mismatch', statusCode: 503 }, 503],
    [{ code: 'partner_key_operator_invalid', statusCode: 403 }, 403], [{ code: 'shared_room_unauthorized', statusCode: 401 }, 401],
    [{ code: 'room_config_missing', statusCode: 503 }, 503]]) {
    const h = setup(t, { channel: { prepare: async () => { throw Object.assign(new Error(error.code), error); } } });
    const request = incoming(), socket = new Raw();
    assert.equal(await h.adapter.handleUpgrade(request, socket, Buffer.alloc(0)), true);
    assert.match(socket.writes[0], new RegExp(`^HTTP/1.1 ${status} `)); assert.equal(h.calls.upgrade.length, 0); clean(request, socket);
  }
});

test('a real socket of a partner refused for its key company sees 1008 with the code and no room frame',
  {skip:!realWs&&'Existing gateway ws dependency is unavailable',timeout:5000},async()=>{
  const server=createServer((_req,res)=>{res.writeHead(404);res.end();});
  let reads=0;
  const channel=createSharedRoomChannel({origin,authorize:async()=>{throw Object.assign(Error('partner_operator_mismatch'),{code:'partner_operator_mismatch',statusCode:403});},
    revalidate:async()=>assert.fail('a refused socket is never revalidated'),readSnapshot:async()=>{reads++;return null;},readPresentation:async()=>null});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
  const adapter=createSharedRoomUpgrade({engineOrigin:`http://127.0.0.1:${port}`,origin,channel,WebSocketServer:realWs.WebSocketServer});
  server.on('upgrade',(request,socket,head)=>{void Promise.resolve(adapter.handleUpgrade(request,socket,head)).then(handled=>{if(!handled)socket.destroy();});});
  const client=new realWs.WebSocket(`ws://127.0.0.1:${port}/shared-room/room-a`,{origin,headers:{cookie:'player_session=partner'}});
  try {
    const messages=[];client.on('message',data=>messages.push(data));
    const [code,reason]=await once(client,'close');
    assert.equal(code,1008);assert.equal(reason.toString(),'partner_operator_mismatch');assert.deepEqual(messages,[]);assert.equal(reads,0);
  } finally { client.terminate();await adapter.close();channel.close();if(server.listening)await new Promise(resolve=>server.close(resolve)); }
});
