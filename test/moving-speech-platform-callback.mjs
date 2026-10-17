import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createSpeechIngress} from '../apps/croupier-speech/service.mjs';
import {platformConfiguration} from '../apps/croupier-frontend/lib/platform-routing.mjs';
import {vercelIngressRequest} from '../ops/cloud/vercel-ingress.mjs';
import {createMovingWorkerChannel} from '../services/astrid-gpu-worker/gateway/moving-transport.mjs';
const {WebSocket}=createRequire(new URL('../services/astrid-gpu-worker/gateway/package.json',import.meta.url))('ws');

const env = {CROUPIER_VERCEL_UI:'1', CROUPIER_PUBLIC_ORIGIN:'https://public.example.test',
  CROUPIER_BACKEND_ORIGIN:'https://isolated.onrender.com', CROUPIER_LAB_UI_ORIGIN:'https://lab.example.test',
  CROUPIER_VERCEL_INGRESS_SECRET:'isolated-ingress-fixture-'.repeat(3)};
const config = platformConfiguration(env), ingress = {transportOrigin:config.backendOrigin,publicOrigin:config.publicOrigin,secret:config.secret};
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

test('actual moving callback channel checks live token before public101 and transports PCM, bind, frames and ACK', {timeout:5000},async()=>{
  const backend=createServer(),channel=createMovingWorkerChannel({origin:config.publicOrigin,avatar:'dragan',verifiedAvatar:'dragan'});
  let service,worker;
  backend.on('upgrade',(req,socket,head)=>{const verdict=transported(req);assert.equal(verdict.accepted,true);assert.equal(req.headers.origin,undefined);assert.equal(req.headers.cookie,undefined);assert.equal(req.headers.authorization,undefined);assert.equal(channel.handleUpgrade(req,socket,head),true);});
  try {
    const upstream=await listen(backend);
    class Backend extends WebSocket {constructor(url,protocols,options){const u=new URL(url);super(upstream+u.pathname+u.search,protocols,options);}}
    service=createSpeechIngress({env,WebSocketImpl:Backend,bridgeOptions:{closeTimeoutMs:30}});const base=await listen(service),url=new URL(channel.callbackUrl),path=url.pathname+url.search;
    const wrong=new URL(channel.callbackUrl);wrong.searchParams.set('token','0'.repeat(64));assert.equal(await rejected(base+wrong.pathname+wrong.search),403);
    worker=new WebSocket(base+path);await once(worker,'open');assert.equal(worker.protocol,'');
    worker.send(JSON.stringify({t:'pong',chunk_ack:true}));assert.deepEqual(JSON.parse((await channel.next()).data.toString()),{t:'pong',chunk_ack:true});
    let reply=once(worker,'message');await channel.send(JSON.stringify({t:'bind',attestation:{fixture:true}}));assert.equal(JSON.parse((await reply)[0]).t,'bind');
    reply=once(worker,'message');await channel.send(Buffer.from('pcm'));assert.deepEqual((await reply)[0],Buffer.from('pcm'));
    worker.send(JSON.stringify({t:'lapp',del:0}));worker.send(Buffer.from('annex-b'));
    assert.equal(JSON.parse((await channel.next()).data).del,0);assert.deepEqual((await channel.next()).data,Buffer.from('annex-b'));
    reply=once(worker,'message');await channel.send(JSON.stringify({t:'ack',id:'fixture',del:0}));assert.equal(JSON.parse((await reply)[0]).t,'ack');
    assert.equal(await rejected(base+path),403);
    const ended=once(worker,'close');worker.close(1000);await ended;
    await assert.rejects(channel.next(),/moving_worker_disconnected/);
  } finally {worker?.terminate();channel.close();await Promise.all([close(backend),...(service?[close(service)]:[])]);}
});