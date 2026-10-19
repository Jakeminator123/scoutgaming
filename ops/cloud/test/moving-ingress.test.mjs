import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readVercelIngressConfig,vercelIngressRequest} from '../vercel-ingress.mjs';
import {createCloudGateway} from '../gateway.mjs';
import {createMovingWorkerChannel} from '../../../services/astrid-gpu-worker/gateway/moving-transport.mjs';
const {WebSocket,WebSocketServer}=createRequire(new URL('../../../services/astrid-gpu-worker/gateway/package.json',import.meta.url))('ws');
const origin='https://public.example.test',transport='https://isolated.onrender.com',secret='isolated-ingress-fixture-'.repeat(3);
const env={CROUPIER_VERCEL_TRANSPORT_ORIGIN:transport,CROUPIER_PUBLIC_ORIGIN:origin,CROUPIER_VERCEL_INGRESS_SECRET:secret,
  CROUPIER_MOVING_SPEECH_ENABLED:'1',CROUPIER_MOVING_SPEECH_WORKER_ORIGIN:transport,RENDER_EXTERNAL_URL:transport};
const ingress=readVercelIngressConfig(env),callback='/lipsync-moving/'+'a'.repeat(48)+'?token='+'b'.repeat(64)+'&avatar=dragan';
const bank='/api/moving-speech/bank/'+'c'.repeat(64)+'/archive';
const config={gameOrigin:origin,boOrigin:origin,labOrigin:origin,singleOrigin:true,streaming:false,vercelIngress:ingress,movingSpeech:{workerOrigin:transport}};
const direct=(url,headers={})=>({url,method:'GET',headers:{host:new URL(transport).host,...headers}});
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;}
const close=server=>new Promise(resolve=>server.close(resolve));
const query=(port,path,{method='GET',headers={}}={})=>new Promise((resolve,reject)=>{
  const request=httpRequest({hostname:'127.0.0.1',port,path,method,headers:{host:new URL(transport).host,...headers}},response=>{
    const chunks=[];response.on('data',c=>chunks.push(c));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));
  });request.on('error',reject);request.end();
});
const rejected=ws=>new Promise((resolve,reject)=>{ws.on('error',()=>{});ws.once('open',()=>{ws.terminate();reject(Error('Unexpected101'));});ws.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode);ws.terminate();});});
const socket=(port,path,headers={},protocols=[])=>new WebSocket(`ws://127.0.0.1:${port}${path}`,protocols,{headers:{host:new URL(transport).host,...headers},handshakeTimeout:1000});

test('direct moving capability requires enabled flag and identical Render/transport/worker origins',()=>{
  assert.equal(ingress.movingWorkerOrigin,transport);
  for(const value of ['', '0']){
    const disabled=readVercelIngressConfig({...env,CROUPIER_MOVING_SPEECH_ENABLED:value});
    assert.equal(disabled.movingWorkerOrigin,undefined);
    assert.equal(vercelIngressRequest(direct(bank),disabled).accepted,false);
    assert.equal(vercelIngressRequest(direct(callback,{upgrade:'websocket'}),disabled).accepted,false);
  }
  for(const change of [{CROUPIER_MOVING_SPEECH_WORKER_ORIGIN:'https://other.onrender.com'},
    {RENDER_EXTERNAL_URL:'https://other.onrender.com'},{RENDER_EXTERNAL_URL:undefined},
    {CROUPIER_MOVING_SPEECH_WORKER_ORIGIN:transport+'/path'}]) assert.throws(()=>readVercelIngressConfig({...env,...change}));
});

test('only exact credential-free capability routes bypass signed ingress and spoofed headers are removed',()=>{
  for(const request of [direct(bank),direct(callback,{upgrade:'websocket'})]){
    const verdict=vercelIngressRequest({...request,headers:{...request.headers,'x-croupier-vercel-secret':'spoof','x-croupier-lab-authorized':'spoof',forwarded:'spoof','x-forwarded-host':'spoof','x-worker-id':'spoof'}},ingress);
    assert.equal(verdict.accepted,true);assert.equal(verdict.movingCapability,true);
    assert.equal(verdict.headers.host,new URL(origin).host);assert.equal(verdict.headers['x-forwarded-host'],new URL(origin).host);
    for(const name of ['x-croupier-vercel-secret','x-croupier-lab-authorized','forwarded','x-worker-id'])assert.equal(verdict.headers[name],undefined);
    for(const name of ['origin','cookie','authorization','sec-websocket-protocol','range']) assert.equal(vercelIngressRequest({...request,headers:{...request.headers,[name]:''}},ingress).accepted,false,name);
    assert.equal(vercelIngressRequest({...request,method:'POST'},ingress).accepted,false);
    assert.equal(vercelIngressRequest({...request,headers:{...request.headers,host:new URL(origin).host}},ingress).accepted,false);
  }
  for(const path of [bank+'?x=1',bank+'/',bank.replace('/bank/','/%62ank/'),'/api/moving-speech/'+'a'.repeat(32)+'/rest','/api/table','/api/auth/session','/moving-speech-stream']) assert.equal(vercelIngressRequest(direct(path),ingress).accepted,false,path);
  for(const path of [callback+'&token='+'d'.repeat(64),callback+'&other=x',callback.replace('avatar=dragan','avatar=..'),callback.replace('/'+ 'a'.repeat(48),'/%61'+'a'.repeat(47))]) assert.equal(vercelIngressRequest(direct(path,{upgrade:'websocket'}),ingress).accepted,false,path);
  assert.equal(vercelIngressRequest(direct(callback),ingress).accepted,false);
  assert.equal(vercelIngressRequest(direct(bank,{upgrade:'websocket'}),ingress).accepted,false);
});

test('gateway streams exact bank bytes only after application capability authorization; unrelated APIs remain blocked',{timeout:5000},async()=>{
  const bytes=Buffer.alloc(6*1024*1024,71),requests=[];
  const web=createServer((req,res)=>{
    requests.push(req);
    assert.equal(req.headers.host,new URL(origin).host);assert.equal(req.headers.cookie,undefined);assert.equal(req.headers['x-croupier-lab-authorized'],undefined);
    if(req.url!==bank){res.writeHead(403);res.end();return;}
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'private, no-store'});res.end(bytes);
  });let gateway;
  try{
    const webPort=await listen(web);gateway=createCloudGateway(config,{labInternalSecret:secret,webPort});const port=await listen(gateway);
    const received=await query(port,bank,{headers:{'x-croupier-lab-authorized':'spoof'}});
    assert.equal(received.status,200);assert.equal(received.headers['content-length'],String(bytes.length));
    assert.equal(createHash('sha256').update(received.body).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
    assert.equal((await query(port,bank.replace('c'.repeat(64),'d'.repeat(64)))).status,403);
    const reached=requests.length;
    for(const path of ['/api/table','/api/moving-speech/'+'a'.repeat(32)+'/rest',bank+'?x=1'])assert.equal((await query(port,path)).status,421);
    for(const headers of [{origin},{cookie:'player=owner'},{range:'bytes=0-1'}])assert.equal((await query(port,bank,{headers})).status,421);
    assert.equal(requests.length,reached);
  }finally{await Promise.all([close(web),...(gateway?[close(gateway)]:[])]);}
});

test('gateway carries owned direct callback and signed moving client independently of legacy streaming flag',{timeout:5000},async()=>{
  const web=createServer(),channel=createMovingWorkerChannel({origin:transport,avatar:'dragan',verifiedAvatar:'dragan'});
  const wss=new WebSocketServer({noServer:true,handleProtocols:p=>p.has('moving-v1')?'moving-v1':false});let gateway,worker,client;const seen=[];
  web.on('upgrade',(req,peer,head)=>{
    seen.push(req.url);
    if(channel.handleUpgrade(req,peer,head))return;
    if(req.url==='/moving-speech-stream'&&req.headers.cookie==='player=owner'){
      wss.handleUpgrade(req,peer,head,ws=>ws.on('message',(data,binary)=>ws.send(data,{binary})));return;
    }
    peer.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
  try{
    gateway=createCloudGateway(config,{labInternalSecret:secret,webPort:await listen(web)});const port=await listen(gateway),url=new URL(channel.callbackUrl),path=url.pathname+url.search;
    const wrong=new URL(channel.callbackUrl);wrong.searchParams.set('token','0'.repeat(64));assert.equal(await rejected(socket(port,wrong.pathname+wrong.search)),403);
    worker=socket(port,path);await once(worker,'open');worker.send('private-pong');assert.equal((await channel.next()).data.toString(),'private-pong');
    const reply=once(worker,'message');await channel.send(Buffer.from('pcm'));assert.deepEqual((await reply)[0],Buffer.from('pcm'));
    assert.equal(await rejected(socket(port,path)),403);
    const protocols=['moving-v1','ticket.fixture.signature'];
    assert.equal(await rejected(socket(port,'/moving-speech-stream',{origin,cookie:'player=owner'},protocols)),421);
    const signed={origin,cookie:'player=owner','x-croupier-vercel-secret':secret,'x-croupier-public-origin':origin,'x-forwarded-host':new URL(origin).host,'x-forwarded-proto':'https'};
    client=socket(port,'/moving-speech-stream',signed,protocols);await once(client,'open');assert.equal(client.protocol,'moving-v1');
    const echoed=once(client,'message');client.send(Buffer.from('patch'));assert.deepEqual((await echoed)[0],Buffer.from('patch'));
    const reached=seen.length;
    for(const extra of [{origin},{cookie:'player=owner'}])assert.equal(await rejected(socket(port,path,extra)),421);
    assert.equal(await rejected(socket(port,'/lipsync-worker')),421);assert.equal(seen.length,reached);
  }finally{worker?.terminate();client?.terminate();channel.close();for(const ws of wss.clients)ws.terminate();wss.close();await Promise.all([close(web),...(gateway?[close(gateway)]:[])]);}
});
test('gateway logs finite bank rejection metadata and strips it from every response',{timeout:5000},async()=>{
 const header='x-croupier-moving-bank-diagnostic',seen=[];let diagnostic='authorization:drift_not_admitting';
 const web=createServer((_req,res)=>{res.writeHead(403,{[header]:diagnostic});res.end();});let gateway;
 try{
  const webPort=await listen(web);gateway=createCloudGateway(config,{labInternalSecret:secret,webPort,onMovingBankRejection:value=>seen.push(value)});
  const port=await listen(gateway),denied=await query(port,bank,{headers:{[header]:'read:rejected'}});
  assert.equal(denied.status,403);assert.equal(denied.headers[header],undefined);
  assert.deepEqual(seen,[{stage:'authorization',code:'drift_not_admitting',httpStatus:403}]);
  diagnostic='authorization:private-token';
  const unknown=await query(port,bank);assert.equal(unknown.status,403);assert.equal(unknown.headers[header],undefined);assert.equal(seen.length,1);
  diagnostic='read:rejected';
  const unrelated=await query(port,'/api/table');assert.equal(unrelated.status,421);assert.equal(seen.length,1);
 }finally{if(gateway)await close(gateway);await close(web);}
});
