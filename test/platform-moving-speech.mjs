import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const frontendRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const WebSocket = frontendRequire('ws'), {WebSocketServer} = WebSocket;
import {createSpeechIngress} from '../apps/croupier-speech/service.mjs';
import {platformConfiguration, platformRoute, backendPlatformPath, PLATFORM_SOCKET_ENDPOINTS} from '../packages/navigation/server/platform-routing.mjs';
const {platformSocketRequest} = await import(pathToFileURL(frontendRequire.resolve('@croupier/server-transport/socket-core')).href);
import {vercelIngressRequest} from '../ops/cloud/vercel-ingress.mjs';

const env = {CROUPIER_VERCEL_UI:'1', CROUPIER_PUBLIC_ORIGIN:'https://public.example.test',
  CROUPIER_BACKEND_ORIGIN:'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN:'https://lab.example.test',
  CROUPIER_VERCEL_INGRESS_SECRET:'isolated-ingress-fixture-'.repeat(3)};
const config = platformConfiguration(env), ingress = {transportOrigin:config.backendOrigin,publicOrigin:config.publicOrigin,secret:config.secret};
const callback = '/lipsync-moving/'+'a'.repeat(48)+'?token='+'b'.repeat(64)+'&avatar=dragan';
const owner = {origin:config.publicOrigin,cookie:'player_session=owner'};
async function listen(server) {server.listen(0,'127.0.0.1');await once(server,'listening');return `ws://127.0.0.1:${server.address().port}`;}
const close = server => new Promise(resolve => server.close(resolve));
async function rejected(url,protocols=[],headers={}) {
  return new Promise((resolve,reject) => {
    const ws = new WebSocket(url,protocols,{headers,handshakeTimeout:1000});
    ws.on('error',()=>{});
    ws.once('open',()=>{ws.terminate();reject(Error('Unexpected public101'));});
    ws.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode);ws.terminate();});
  });
}
function transported(request) {
  return vercelIngressRequest({...request,headers:{...request.headers,host:new URL(config.backendOrigin).host}},ingress);
}

test('moving routes remain exact and carry bank/rest requests through actual signed Next middleware',async()=>{
  const paths = ['/api/moving-speech/'+'a'.repeat(32)+'/rest', ...['archive','receipt'].map(kind=>'/api/moving-speech/bank/'+'b'.repeat(64)+'/'+kind)];
  const require = createRequire(new URL('../apps/web/package.json',import.meta.url));
  const {transpileModule,ModuleKind,ScriptTarget}=require('typescript'), {NextRequest}=require('next/server');
  const compiled=transpileModule(await readFile(new URL('../apps/web/middleware.ts',import.meta.url),'utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};new Function('require','module','exports',compiled)(require,module,module.exports);
  const previous=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
  try {
    Object.assign(process.env,env);
    for (const path of paths) {
      assert.equal(backendPlatformPath(path),true);
      const response=module.exports.middleware(new NextRequest(config.publicOrigin+path,{headers:{cookie:owner.cookie,'x-croupier-vercel-secret':'spoof'}}));
      assert.equal(response.headers.get('x-middleware-rewrite'),config.backendOrigin+path);
      assert.equal(response.headers.get('x-middleware-request-cookie'),owner.cookie);
      assert.equal(response.headers.get('x-middleware-request-x-croupier-vercel-secret'),config.secret);
      assert.equal(response.headers.get('cdn-cache-control'),'no-store');
      assert.equal(response.headers.get('x-vercel-enable-rewrite-caching'),'0');
    }
    for (const path of ['/api/moving-speech/','/api/moving-speech/random/rest',paths[0]+'/',paths[1]+'/other',paths[1].replace('/bank/','/%62ank/')]) assert.equal(backendPlatformPath(path),false);
    const path='/moving-speech-stream';
    assert.deepEqual(platformRoute(new URL(config.publicOrigin+path),config),{kind:'socket',destination:config.publicOrigin+PLATFORM_SOCKET_ENDPOINTS[path]});
    assert.equal(module.exports.middleware(new NextRequest(config.publicOrigin+PLATFORM_SOCKET_ENDPOINTS[path])).status,400);
    const deployment=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
    for (const source of [path,'/lipsync-moving/:path*']) assert.deepEqual(deployment.rewrites.find(rule=>rule.source===source||rule.source==='/(.*)'),{source,destination:{service:'speech'}});
  } finally {for (const [key,value] of Object.entries(previous)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('moving capability boundary preserves exact query but never forwards browser credentials',()=>{
  const input=platformSocketRequest(new Request(config.publicOrigin+callback,{headers:{upgrade:'websocket',cookie:'private',authorization:'Bearer private','x-worker-id':'private'}}),config);
  assert.equal(input.url,config.backendOrigin.replace('https:','wss:')+callback);
  assert.deepEqual(input.protocols,[]);assert.equal(input.maxPayload,2*1024*1024);assert.equal(input.maxBufferedBytes,4*1024*1024);assert.equal(input.lifetimeMs,180000);
  assert.deepEqual(Object.keys(input.headers).sort(),['x-croupier-public-origin','x-croupier-vercel-secret','x-forwarded-host','x-forwarded-proto']);
  assert.equal(transported({method:'GET',url:callback,headers:input.headers}).accepted,true);
  for(const extra of ['&token='+'c'.repeat(64),'&avatar=dragan','&other=x']) assert.equal(platformSocketRequest(new Request(config.publicOrigin+callback+extra,{headers:{upgrade:'websocket'}}),config).status,403);
  for(const headers of [{origin:config.publicOrigin},{'sec-websocket-protocol':'moving-v1'}]) assert.equal(platformSocketRequest(new Request(config.publicOrigin+callback,{headers:{upgrade:'websocket',...headers}}),config).status,403);
});

test('speech ingress rejects invalid moving origin/protocol/callback before contacting backend',async()=>{
  let calls=0;class Forbidden {constructor(){calls++;throw Error('unexpected backend');}}
  const server=createSpeechIngress({env,WebSocketImpl:Forbidden});
  try {
    const base=await listen(server);
    for(const protocols of [[],['astrid-v2','ticket.body.signature'],['ticket.body.signature','moving-v1']]) assert.equal(await rejected(base+'/moving-speech-stream',protocols,owner),401);
    assert.equal(await rejected(base+'/moving-speech-stream',['moving-v1','ticket.body.signature'],{...owner,origin:'https://foreign.test'}),403);
    assert.equal(await rejected(base+callback,[],{origin:config.publicOrigin}),403);
    assert.equal(await rejected(base+callback+'&other=x'),403);
    for(const path of ['/lipsync-moving/nope?token=x','/moving-speech-stream?ticket=x','/api/platform-moving-speech-stream']) assert.equal(await rejected(base+path),404);
    assert.equal(calls,0);
  } finally {await close(server);}
});

test('moving client media crosses both directions only after backend owner and one-use ticket admission', {timeout:5000},async()=>{
  const backend=createServer(),wss=new WebSocketServer({noServer:true,handleProtocols:p=>p.has('moving-v1')?'moving-v1':false});
  const used=new Set();let service,client;
  backend.on('upgrade',(req,socket,head)=>{
    assert.equal(transported(req).accepted,true);
    const ticket=String(req.headers['sec-websocket-protocol']).split(',').map(x=>x.trim())[1];
    if(req.headers.cookie!==owner.cookie||used.has(ticket)){socket.end('HTTP/1.1 401 Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return;}
    used.add(ticket);wss.handleUpgrade(req,socket,head,ws=>ws.on('message',(data,binary)=>ws.send(data,{binary})));
  });
  try {
    const upstream=await listen(backend);
    class Backend extends WebSocket {constructor(url,protocols,options){assert.equal(options.maxPayload,2*1024*1024);assert.equal(options.followRedirects,false);super(upstream+new URL(url).pathname,protocols,options);}}
    service=createSpeechIngress({env,WebSocketImpl:Backend,bridgeOptions:{closeTimeoutMs:30}});
    const base=await listen(service),protocols=['moving-v1','ticket.fixture.signature'];
    assert.equal(await rejected(base+'/moving-speech-stream',protocols,{...owner,cookie:'player_session=other'}),401);
    client=new WebSocket(base+'/moving-speech-stream',protocols,{headers:owner});await once(client,'open');assert.equal(client.protocol,'moving-v1');
    const reply=once(client,'message');client.send(Buffer.alloc(1024*1024+1,7));const [bytes,binary]=await reply;assert.equal(binary,true);assert.equal(bytes.length,1024*1024+1);
    assert.equal(await rejected(base+'/moving-speech-stream',protocols,owner),401);
    const ended=once(client,'close');client.send(Buffer.alloc(2*1024*1024+1));assert.equal((await ended)[0],1009);
  } finally {client?.terminate();for(const ws of wss.clients)ws.terminate();wss.close();await Promise.all([close(backend),...(service?[close(service)]:[])]);}
});
